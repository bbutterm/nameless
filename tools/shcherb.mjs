/**
 * Сквозной проход главы «Щербь»: холодный старт → изба Марьи → оклик у вешки
 * → бой → Сход → церемония смерти с тактом Помянника. Снимает ключевые кадры
 * и говорит, на какой реплике впервые звучит обещание игры.
 *
 * Запуск: node tools/shcherb.mjs <url> <outDir>
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/shcherb';
mkdirSync(outDir, { recursive: true });

const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  locale: 'ru-RU',
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.big-button').first().click();
await page.waitForTimeout(400);

/**
 * Куда ведёт глава: по одному разу к Марье и на сход, потом к вешке.
 * Пункт, по которому уже ходили, выбрасывается — иначе хаб и изба Марьи
 * ловят автомат в вечное кольцо, и до смерти он не доходит никогда.
 */
const ROUTE = ['к марье', 'спросить прямо', 'к сходу', 'пересчитать вслух', 'к дозорному огню', 'сказать, что имени нет'];
const used = new Set();
let bubbles = 0;
let promiseAt = null;
let shot = { marya: false, hail: false, battle: false };

for (let step = 0; step < 400; step++) {
  if (await page.locator('.screen.death').count()) break;

  if (await page.locator('.screen.battle').count()) {
    if (!shot.battle) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${outDir}/03-battle.png` });
      shot.battle = true;
    }
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
    await page.waitForTimeout(240);
    continue;
  }

  const texts = await page.evaluate(() =>
    [...document.querySelectorAll('.choice')].map((b) => b.textContent.toLowerCase()),
  );
  if (texts.length) {
    let hit = null;
    let i = texts.findIndex((t) => {
      hit = ROUTE.find((w) => t.includes(w) && !used.has(w));
      return !!hit;
    });
    if (i < 0) i = 0;
    else used.add(hit);
    await page.locator('.choice').nth(i).click();
  } else {
    const feed = await page.evaluate(() => document.body.innerText);
    bubbles++;
    if (promiseAt === null && /вспомнишь кусок/i.test(feed)) promiseAt = bubbles;
    if (!shot.marya && /два прибора/i.test(feed)) {
      await page.screenshot({ path: `${outDir}/01-marya.png` });
      shot.marya = true;
    }
    if (!shot.hail && /Оклик: назовись/i.test(feed)) {
      await page.screenshot({ path: `${outDir}/02-hail.png` });
      shot.hail = true;
    }
    const h = page.locator('.tap-hint');
    if (await h.count()) await h.click();
    else await page.locator('.screen').first().click({ position: { x: 195, y: 700 } });
  }
  await page.waitForTimeout(150);
}

const died = (await page.locator('.screen.death').count()) > 0;
console.log('дошли до смерти:', died ? 'да' : 'НЕТ');
console.log('обещание игры прозвучало на такте:', promiseAt ?? 'не прозвучало');
if (died) {
  await page.waitForTimeout(3600);
  await page.screenshot({ path: `${outDir}/04-death.png` });
  const tact = await page.evaluate(() => ({
    codex: document.querySelector('.codex-tact')?.textContent ?? null,
    memory: document.querySelector('.memory-name')?.textContent ?? null,
    wake: (document.querySelector('.death-wake')?.textContent ?? '').slice(0, 60),
  }));
  console.log('такт Помянника:', tact.codex ?? 'нет');
  console.log('закреплено воспоминание:', tact.memory ?? 'нечего');
}
console.log('ошибок в консоли:', errors.length, errors.slice(0, 2).join(' | '));
await browser.close();
