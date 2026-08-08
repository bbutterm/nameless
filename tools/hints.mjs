/**
 * Проверка обучения: сколько раз всплывает каждая из трёх подсказок за
 * прохождение, если игрок действует быстрее, чем 6.5 секунды показа.
 *
 * Запуск: node tools/hints.mjs <url> <outDir>
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/hints';
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
await page.locator('.big-button').first().click();

const counts = new Map();
let prev = '';
let choices = 0;
let shot = 0;

for (let i = 0; i < 900 && choices < 12; i++) {
  const tip = await page.evaluate(() => document.querySelector('.tutorial')?.textContent ?? '');
  if (tip && tip !== prev) {
    counts.set(tip, (counts.get(tip) ?? 0) + 1);
    if (choices >= 1 && shot < 3) {
      await page.screenshot({ path: `${outDir}/hint-again-${shot++}.png` });
    }
    console.log(`шаг ${i}: подсказка «${tip}» (появление №${counts.get(tip)}), выборов позади: ${choices}`);
  }
  prev = tip;

  if (await page.locator('.screen.battle').count()) break;
  const ch = await page.locator('.choice');
  if (await ch.count()) {
    await ch.first().click();
    choices++;
    await page.waitForTimeout(500);
    continue;
  }
  const hint = page.locator('.tap-hint');
  if (await hint.count()) await hint.click();
  await page.waitForTimeout(300);
}

console.log('\nИтог:');
for (const [k, v] of counts) console.log(`  ${v}× — ${k}`);
await browser.close();
