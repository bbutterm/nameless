/**
 * Церемония смерти на маленьком экране: помещается ли она целиком и виден ли
 * без прокрутки главный (единственный) переход дальше.
 *
 * Запуск: node tools/deathcheck.mjs <url> <outDir> [ширина] [высота]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/death';
const width = Number(process.argv[4] ?? 390);
const height = Number(process.argv[5] ?? 844);
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

for (let i = 0; i < 700; i++) {
  if (await page.locator('.screen.death').count()) break;
  if (await page.locator('.screen.battle').count()) {
    const over = page.locator('.battle-over .big-button');
    if (await over.count()) {
      await over.click();
      await page.waitForTimeout(400);
      continue;
    }
    const ab = page.locator('.ability:not(.cooling)');
    if (await ab.count()) {
      await ab.first().click();
      await page.waitForTimeout(80);
      const t = page.locator('.card.targetable');
      if (await t.count()) await t.first().click();
    }
    await page.waitForTimeout(260);
    continue;
  }
  const ch = page.locator('.choice');
  if (await ch.count()) {
    // Идём туда, где дерутся: на мостках отряд из двоих гарантированно ложится.
    const FIGHT = ['на мостки', 'не отдавать', 'не вмешиваться', 'не мешать', 'драться'];
    const texts = await page.evaluate(() =>
      [...document.querySelectorAll('.choice')].map((b) => b.textContent.toLowerCase()),
    );
    let i = texts.findIndex((t) => FIGHT.some((w) => t.includes(w)));
    if (i < 0) i = 0;
    await ch.nth(i).click();
  } else {
    const h = page.locator('.tap-hint');
    if (await h.count()) await h.click();
  }
  await page.waitForTimeout(180);
}

if (!(await page.locator('.screen.death').count())) {
  console.log('до смерти не дошли');
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(3400);
await page.screenshot({ path: `${outDir}/death-${width}x${height}.png` });
const m = await page.evaluate(() => {
  const s = document.querySelector('.screen.death');
  const btn = document.querySelector('.death-footer .big-button');
  const r = btn?.getBoundingClientRect();
  return {
    vh: document.documentElement.clientHeight,
    scrollH: s.scrollHeight,
    clientH: s.clientHeight,
    scrollTop: s.scrollTop,
    btn: r ? { top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) } : null,
    memoryText: document.querySelector('.memory-text')?.textContent?.length ?? 0,
  };
});
const below = m.btn ? m.btn.bottom > m.vh : null;
console.log(
  `${width}×${height}: экран смерти ${m.scrollH}px в окне ${m.clientH}px, прокрутка ${m.scrollTop}. ` +
    `Кнопка «Дальше»: ${m.btn ? `${m.btn.top}…${m.btn.bottom}` : 'нет'} → ${below ? 'НИЖЕ СГИБА, надо скроллить' : 'видна'}`,
);
await browser.close();
