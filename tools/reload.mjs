/**
 * Переживает ли сейв перезагрузку страницы. Играем немного, перезагружаем
 * посреди сцены, жмём «Продолжить» и сравниваем состояние и ленту.
 *
 * Запуск: node tools/reload.mjs <url> <outDir> [шагов до перезагрузки]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/reload';
const N = Number(process.argv[4] ?? 40);
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

const snap = () =>
  page.evaluate(() => {
    const raw = localStorage.getItem('nameless:save:v1');
    const s = raw ? JSON.parse(raw).state : null;
    return {
      save: s && { scene: s.scene, node: s.node, logLen: s.log.length, deaths: s.deaths, axes: s.axes, party: s.party.map((u) => u.defId) },
      feedItems: document.querySelectorAll('.feed > *').length,
      lastText: document.querySelector('.feed')?.textContent?.slice(-120) ?? '',
      mode: document.querySelector('.screen')?.className ?? '',
    };
  });

for (let i = 0; i < N; i++) {
  if (await page.locator('.screen.battle, .screen.death').count()) break;
  const ch = page.locator('.choice');
  if (await ch.count()) {
    await ch.first().click();
  } else {
    const h = page.locator('.tap-hint');
    if (await h.count()) await h.click();
  }
  await page.waitForTimeout(220);
}

const before = await snap();
await page.screenshot({ path: `${outDir}/before-reload.png` });
console.log('ДО перезагрузки:', JSON.stringify(before, null, 1));

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/after-reload-title.png` });
const titleButtons = await page.evaluate(() =>
  [...document.querySelectorAll('.title button')].map((b) => b.textContent),
);
console.log('кнопки на титуле после перезагрузки:', JSON.stringify(titleButtons));

await page.locator('.big-button').first().click();
await page.waitForTimeout(800);
const after = await snap();
await page.screenshot({ path: `${outDir}/after-resume.png` });
console.log('ПОСЛЕ продолжения:', JSON.stringify(after, null, 1));

const same =
  before.save.scene === after.save.scene &&
  before.save.node === after.save.node &&
  JSON.stringify(before.save.axes) === JSON.stringify(after.save.axes) &&
  JSON.stringify(before.save.party) === JSON.stringify(after.save.party);
console.log(same ? 'СОСТОЯНИЕ СОВПАЛО' : 'СОСТОЯНИЕ РАЗОШЛОСЬ');
console.log(
  `лента: было ${before.feedItems} блоков (${before.save.logLen} в сейве), стало ${after.feedItems} (${after.save.logLen})`,
);

await browser.close();
