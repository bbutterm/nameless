/**
 * Звук и вибрация в браузере: живы ли они вообще.
 *
 * Проверяется не наличие кода, а состояние: браузеры не дают звук до первого
 * жеста, и `AudioContext`, созданный вне жеста, остаётся `suspended` навсегда.
 * Такую тишину не видно ни в одном тесте — игра работает, просто молчит.
 *
 * Запуск: node tools/soundcheck.mjs <url>
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173';
const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: 'ru-RU',
});
const page = await ctx.newPage();

// Перехватываем создание контекстов и вызовы вибрации ДО загрузки страницы.
await page.addInitScript(() => {
  window.__ctxs = [];
  window.__vibes = [];
  const Real = window.AudioContext;
  window.AudioContext = class extends Real {
    constructor(...a) {
      super(...a);
      window.__ctxs.push(this);
    }
  };
  navigator.vibrate = (p) => {
    window.__vibes.push(p);
    return true;
  };
});

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

const state = async (label) => {
  const r = await page.evaluate(() => ({
    ctxs: window.__ctxs.length,
    states: window.__ctxs.map((c) => c.state),
    vibes: window.__vibes.length,
  }));
  console.log(
    `${label.padEnd(28)} контекстов ${r.ctxs} [${r.states.join(', ') || '—'}]  вызовов вибрации ${r.vibes}`,
  );
  return r;
};

await state('до касания');
await page.locator('.big-button').first().click();
await page.waitForTimeout(500);
await state('после «Новой игры»');

// Несколько тапов по ленте — это и есть обычная игра.
for (let i = 0; i < 6; i++) {
  const ch = page.locator('.choice');
  if (await ch.count()) await ch.first().click();
  else await page.mouse.click(195, 400);
  await page.waitForTimeout(120);
}
const after = await state('после шести касаний');

console.log('');
if (after.ctxs === 0) {
  console.log('!! AudioContext не создан вовсе — звука нет и быть не может');
} else if (after.states.some((s) => s === 'suspended')) {
  console.log('!! контекст ЗАВИС в suspended: звук не зазвучит, пока его не разбудят resume()');
} else {
  console.log('   звук: контекст запущен, звучать может');
}
console.log(
  after.vibes > 0
    ? `   вибрация: игра просит её ${after.vibes} раз — код живой`
    : '!! вибрация: игра не попросила ни разу',
);

await browser.close();
