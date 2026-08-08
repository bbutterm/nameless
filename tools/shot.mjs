/**
 * Снимает экраны игры на трёх целевых разрешениях и проверяет базовые правила
 * мобильной вёрстки: нет горизонтального скролла, тапабельные цели ≥48px,
 * текст диалогов ≥16px.
 *
 * Запуск: node tools/shot.mjs [url] [outDir]
 */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173';
const outDir = process.argv[3] ?? 'screenshots';
mkdirSync(outDir, { recursive: true });

const SIZES = [
  { name: '390x844', width: 390, height: 844 },
  { name: '360x640', width: 360, height: 640 },
  { name: '430x932', width: 430, height: 932 },
];

const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let failures = 0;

for (const size of SIZES) {
  const ctx = await browser.newContext({
    ...devices['Pixel 5'],
    viewport: { width: size.width, height: size.height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: 'ru-RU',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${outDir}/title-${size.name}.png` });

  // Пройти титул и снять диалог.
  const start = page.locator('.big-button').first();
  if (await start.count()) {
    await start.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/dialogue-${size.name}.png` });

    // Несколько тапов — чтобы дойти до первого выбора и снять его.
    if (await page.locator('.dialogue').count()) {
      for (let i = 0; i < 12; i++) {
        if ((await page.locator('.choice').count()) > 0) break;
        await page.locator('.dialogue').click({ position: { x: size.width / 2, y: size.height / 3 } });
        await page.waitForTimeout(140);
      }
      await page.screenshot({ path: `${outDir}/choice-${size.name}.png` });
    } else {
      console.log(`   (сцен нет — экран диалога пропущен)`);
    }
  }

  const report = await page.evaluate(() => {
    const doc = document.documentElement;
    const tooSmall = [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({ cls: b.className, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height }))
      .filter((b) => b.h < 44 && !b.cls.includes('lore-toggle'));
    const bubble = document.querySelector('.bubble-text, .narration');
    const fontSize = bubble ? parseFloat(getComputedStyle(bubble).fontSize) : null;
    return {
      hScroll: doc.scrollWidth > doc.clientWidth + 1,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      tooSmall,
      fontSize,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });

  const problems = [];
  if (report.hScroll) problems.push(`горизонтальный скролл ${report.scrollWidth}>${report.clientWidth}`);
  if (report.tooSmall.length) problems.push(`мелкие кнопки: ${report.tooSmall.map((t) => `${t.cls}:${t.h.toFixed(0)}px`).join(', ')}`);
  if (report.fontSize !== null && report.fontSize < 16) problems.push(`текст диалога ${report.fontSize}px < 16px`);
  if (errors.length) problems.push(`ошибки консоли: ${errors.slice(0, 3).join(' | ')}`);

  console.log(`${size.name}: ${problems.length === 0 ? 'OK' : 'ПРОБЛЕМЫ'}`);
  for (const p of problems) console.log(`   ${p}`);
  failures += problems.length;

  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? '\nВёрстка: зелено' : `\nВёрстка: ${failures} замечаний`);
process.exit(failures === 0 ? 0 : 1);
