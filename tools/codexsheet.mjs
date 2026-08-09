/**
 * «Помянник»: справочник, который переживает забег. Проверяем три вещи,
 * которые ломаются тихо: книга открывается с титула ДО начала игры, список
 * пуст на чистом хранилище, и запись читается на 390px без горизонтального
 * скролла.
 *
 * Запуск: node tools/codexsheet.mjs <url> <outDir>
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/codex';
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
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}/01-title.png` });

const openBook = page.getByRole('button', { name: /Помянник/i });
const found = (await openBook.count()) > 0;
console.log('кнопка «Помянник» на титуле:', found ? 'есть' : 'НЕТ');
if (found) {
  await openBook.first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/02-empty.png` });
}

// Книга наполняется только по мёртвому времени, поэтому подкладываем
// хранилище напрямую: экран проверяется отдельно от способа, каким в него
// попадают строки, — тот проверен тестами движка.
await page.evaluate(() => {
  const lines = {};
  for (const id of ['osoka_l1', 'osoka_l2', 'tminny_l1', 'gladen_l1', 'smolokur_l1']) {
    lines[id] = { run: 1, seen: false };
  }
  localStorage.setItem('nameless:codex:v1', JSON.stringify({ version: 1, runs: 1, lines }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const again = page.getByRole('button', { name: /Помянник/i });
if ((await again.count()) > 0) {
  await again.first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/03-list.png` });
  const rows = page.locator('.codex-row');
  const n = await rows.count();
  console.log('строк в списке:', n);
  if (n > 0) {
    await rows.first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outDir}/04-entry.png` });
  }
}

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth + 1,
);
console.log('горизонтальный скролл:', overflow ? 'ЕСТЬ (брак)' : 'нет');
console.log('ошибок в консоли:', errors.length, errors.slice(0, 3).join(' | '));

await browser.close();
