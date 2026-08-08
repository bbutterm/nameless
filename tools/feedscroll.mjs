/**
 * Можно ли перечитать ленту: набираем длинную сцену и проверяем, доступен ли
 * скролл вверх и виден ли самый первый блок сцены.
 *
 * Запуск: node tools/feedscroll.mjs <url> <outDir>
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/feed';
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

const measure = () =>
  page.evaluate(() => {
    const f = document.querySelector('.feed');
    if (!f) return null;
    const first = f.firstElementChild;
    const fr = first?.getBoundingClientRect();
    const rr = f.getBoundingClientRect();
    return {
      items: f.children.length,
      scrollH: f.scrollHeight,
      clientH: f.clientHeight,
      scrollTop: f.scrollTop,
      maxScroll: f.scrollHeight - f.clientHeight,
      overflowY: getComputedStyle(f).overflowY,
      justify: getComputedStyle(f).justifyContent,
      firstTop: fr ? +fr.top.toFixed(1) : null,
      feedTop: +rr.top.toFixed(1),
      firstAbove: fr ? fr.top < rr.top - 1 : false,
      firstText: (first?.textContent ?? '').slice(0, 45),
    };
  });

let best = null;
for (let i = 0; i < 120; i++) {
  if (await page.locator('.screen.battle, .screen.death').count()) break;
  const m = await measure();
  if (m && (!best || m.items > best.items)) best = m;
  if (m && m.items >= 14) break;
  const ch = page.locator('.choice');
  if (await ch.count()) await ch.first().click();
  else {
    const t = page.locator('.tap-hint');
    if (await t.count()) await t.click();
  }
  await page.waitForTimeout(150);
}

const m = await measure();
console.log('лента:', JSON.stringify(m, null, 1));
await page.screenshot({ path: `${outDir}/feed-long.png` });

// Пробуем проскроллить вверх всеми доступными способами.
await page.evaluate(() => {
  document.querySelector('.feed').scrollTop = -9999;
});
const a = await measure();
await page.mouse.move(195, 400);
await page.mouse.wheel(0, -2000);
await page.waitForTimeout(400);
const b = await measure();
console.log(`scrollTop после scrollTop=-9999: ${a.scrollTop}; после колеса вверх: ${b.scrollTop}`);
console.log(
  `внизу ленты первый блок «${m.firstText}» ${m.firstAbove ? 'ВЫШЕ видимой области' : 'виден'};` +
    ` после прокрутки вверх он ${b.firstAbove ? 'ВСЁ ЕЩЁ НЕДОСТУПЕН' : 'виден — перечитать можно'}`,
);
await page.screenshot({ path: `${outDir}/feed-after-scroll-up.png` });

await browser.close();
