/**
 * «Первые тридцать секунд»: игра запускается как у человека, который ничего
 * о ней не знает. Реалистичный темп чтения, снимки в ключевые моменты,
 * лог появления/исчезновения трёх обучающих подсказок.
 *
 * Запуск: node tools/first30.mjs <url> <outDir>
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/first30';
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
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

const t0 = Date.now();
const log = [];
const note = async (what) => {
  const tip = await page.evaluate(() => {
    const e = document.querySelector('.tutorial');
    return e ? { text: e.textContent, cls: e.className, box: e.getBoundingClientRect().toJSON() } : null;
  });
  log.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${what} | подсказка: ${tip ? tip.text : '—'}`);
};

await page.screenshot({ path: `${outDir}/00-title.png` });
await note('титул');
await page.locator('.big-button').first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/01-first-screen.png` });
await note('первый экран сцены');
await page.waitForTimeout(2000);
await page.screenshot({ path: `${outDir}/02-hint-tap.png` });
await note('через 3 с — подсказка «коснись»');

// Читающий человек тапает примерно раз в 2.5 секунды.
for (let i = 0; i < 6; i++) {
  const ch = await page.locator('.choice').count();
  if (ch > 0) break;
  await page.locator('.screen.dialogue').click({ position: { x: 195, y: 400 } });
  await page.waitForTimeout(2500);
  await note(`тап ${i + 1}`);
}
await page.screenshot({ path: `${outDir}/03-before-choice.png` });

// Дождаться выбора
for (let i = 0; i < 30; i++) {
  if ((await page.locator('.choice').count()) > 0) break;
  await page.locator('.screen.dialogue').click({ position: { x: 195, y: 400 } });
  await page.waitForTimeout(700);
}
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/04-choice.png` });
await note('первый выбор');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/05-choice-hint.png` });
await note('выбор + подсказка');

// Сделали выбор — смотрим, вернётся ли подсказка «коснись» ещё раз.
await page.locator('.choice').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/06-after-choice.png` });
await note('через 1.5 с после выбора');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/07-after-choice-4s.png` });
await note('через 4 с после выбора');

console.log(log.join('\n'));
await browser.close();
