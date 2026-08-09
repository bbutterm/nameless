/**
 * Снимает те экраны, которые нужны художнику: диалог с портретами,
 * опись (архив), титул. Ходит по игре, пока не встретит нужное.
 * node artshot.mjs <url> <outDir>
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4200';
const outDir = process.argv[3] ?? '/tmp/artshot';
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
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.screenshot({ path: `${outDir}/00-title.png` });
await page.locator('.big-button').first().click();
await page.waitForTimeout(400);

let portraitShots = 0;
const seenSpeakers = new Set();

for (let step = 0; step < 900; step++) {
  if (portraitShots >= 4) break;
  const n = await page.locator('.portrait').count();
  if (n >= 2) {
    const names = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.bubble-name')).map((e) => e.textContent),
    );
    const key = names.join('|');
    if (!seenSpeakers.has(key) && names.length >= 2) {
      seenSpeakers.add(key);
      portraitShots++;
      await page.screenshot({ path: `${outDir}/10-dialogue-portraits-${portraitShots}.png` });
      console.log('портреты:', names.join(', '));
    }
  }
  const ch = page.locator('.choice');
  if (await ch.count()) {
    await ch.first().click();
  } else if (await page.locator('.screen.battle').count()) {
    break;
  } else {
    await page.locator('.dialogue').click({ position: { x: 195, y: 300 } }).catch(() => {});
  }
  await page.waitForTimeout(120);
}

// Опись
const arch = page.locator('.archive-button');
if (await arch.count()) {
  await arch.first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/20-archive.png` });
  const tabs = page.locator('.sheet-tabs button');
  const tn = await tabs.count();
  for (let i = 1; i < tn; i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outDir}/21-archive-tab${i}.png` });
  }
}

console.log('ошибки:', errors.length ? errors : 'нет');
await browser.close();
