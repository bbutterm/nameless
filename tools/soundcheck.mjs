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
  /*
   * Аудио-элементы игры живут ВНЕ DOM: `new Audio()` не добавляет ничего на
   * страницу, а Web Audio тянет звук прямо из элемента. Через
   * `querySelectorAll('audio')` их не найти никогда — первая версия этой
   * проверки так и говорила «играет 0» при исправно играющей музыке.
   * Поэтому запоминаем их в момент вызова `play()`.
   */
  window.__media = [];
  const realPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (!window.__media.includes(this)) window.__media.push(this);
    const p = realPlay.apply(this, arguments);
    if (p && p.catch) p.catch((e) => window.__playErrors.push(`${e.name}: ${e.message}`));
    return p;
  };
  window.__playErrors = [];
});

// Запросы за музыкой считаем отдельно: она обязана НЕ грузиться до того, как
// понадобилась, — первая сцена тянет шесть килобайт, и это правило легко
// потерять одной строкой `preload`.
const musicHits = [];
page.on('request', (r) => {
  if (/\/assets\/.*\.(m4a|mp3|ogg|opus|webm|wav)(\?|$)/.test(r.url())) musicHits.push(r.url());
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
console.log(`   запросов за музыкой до касания: ${musicHits.length}`);
const beforeTouch = musicHits.length;
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
  beforeTouch === 0
    ? '   музыка: до касания не загружалась — верно'
    : `!! музыка: ${beforeTouch} запросов ДО касания, первая загрузка потяжелела`,
);
// Даём звуку секунду: `play()` асинхронен, и «ещё не начало» выглядит
// точно так же, как «не заиграет никогда».
await page.waitForTimeout(1200);
const music = await page.evaluate(() => ({
  // Играет — это не «не на паузе», а «время идёт»: элемент с нулевым
  // currentTime может стоять на паузе внутри и врать наружу.
  playing: window.__media.filter((a) => !a.paused && a.currentTime > 0).length,
  known: window.__media.length,
  errors: window.__playErrors,
}));
console.log(
  musicHits.length === 0
    ? '   музыка: файлов нет — слот пуст, игра молчит как раньше'
    : `   музыка: загружено ${musicHits.length}, элементов ${music.known}, ` +
      `реально играет ${music.playing}`,
);
for (const e of music.errors) console.log(`   !! play() отказал: ${e}`);
console.log(
  after.vibes > 0
    ? `   вибрация: игра просит её ${after.vibes} раз — код живой`
    : '!! вибрация: игра не попросила ни разу',
);

await browser.close();
