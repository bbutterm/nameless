/**
 * «Опись»: отряд, мозаика памяти, перестановка строя. Открываем после первой
 * смерти и смотрим, читается ли она и работает ли обмен слотами.
 *
 * Запуск: node tools/archivesheet.mjs <url> <outDir> [ширина] [высота]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/sheet';
const width = Number(process.argv[4] ?? 360);
const height = Number(process.argv[5] ?? 640);
mkdirSync(outDir, { recursive: true });

const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width, height },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  locale: 'ru-RU',
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.big-button').first().click();

const FIGHT = ['на мостки', 'не вмешиваться', 'не мешать'];
let died = false;
for (let i = 0; i < 700 && !died; i++) {
  if (await page.locator('.screen.death').count()) {
    const b = page.locator('.death-footer .big-button');
    if (await b.count()) {
      await b.click();
      died = true;
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(300);
    continue;
  }
  if (await page.locator('.screen.battle').count()) {
    const over = page.locator('.battle-over .big-button');
    if (await over.count()) {
      await over.click();
      await page.waitForTimeout(400);
      continue;
    }
    const ab = page.locator('.ability');
    if (await ab.count()) {
      await ab.first().click();
      await page.waitForTimeout(80);
      const t = page.locator('.card.targetable');
      if (await t.count()) await t.first().click();
    }
    await page.waitForTimeout(250);
    continue;
  }
  const ch = page.locator('.choice');
  if (await ch.count()) {
    const texts = await page.evaluate(() =>
      [...document.querySelectorAll('.choice')].map((b) => b.textContent.toLowerCase()),
    );
    let i2 = texts.findIndex((t) => FIGHT.some((w) => t.includes(w)));
    if (i2 < 0) i2 = 0;
    await ch.nth(i2).click();
  } else {
    const h = page.locator('.tap-hint');
    if (await h.count()) await h.click();
  }
  await page.waitForTimeout(170);
}

await page.locator('.archive-button').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/sheet-party-${width}.png` });
const party = await page.evaluate(() => ({
  hint: document.querySelector('.swap-hint')?.textContent ?? '',
  items: [...document.querySelectorAll('.party-item')].map((b) => {
    const r = b.getBoundingClientRect();
    return {
      name: b.querySelector('.party-name')?.textContent,
      meta: b.querySelector('.party-meta')?.textContent,
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
    };
  }),
  body: (() => {
    const s = document.querySelector('.sheet-body');
    return { scrollH: s.scrollHeight, clientH: s.clientHeight };
  })(),
  closeVisible: (() => {
    const b = document.querySelector('.sheet-close');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return r.bottom <= document.documentElement.clientHeight;
  })(),
}));
console.log('опись/отряд:', JSON.stringify(party, null, 1));

// Перестановка строя: тапаем двух и смотрим, поменялись ли ряды.
const before = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('nameless:save:v1')).state.party.map((u) => `${u.defId}:${u.slot.row}${u.slot.index}`),
);
const items = page.locator('.party-item');
if ((await items.count()) >= 2) {
  await items.nth(0).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outDir}/sheet-picked-${width}.png` });
  await items.nth(1).click();
  await page.waitForTimeout(400);
}
const after = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('nameless:save:v1')).state.party.map((u) => `${u.defId}:${u.slot.row}${u.slot.index}`),
);
console.log('строй до:', before.join(', '));
console.log('строй после обмена:', after.join(', '), before.join() === after.join() ? '— НЕ ИЗМЕНИЛСЯ' : '— поменялся');

const tabs = page.locator('.sheet-tabs button');
await tabs.nth(1).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}/sheet-memories-${width}.png` });
const mem = await page.evaluate(() => document.querySelector('.sheet-body')?.textContent?.slice(0, 200));
console.log('вкладка памяти:', JSON.stringify(mem));

await browser.close();
