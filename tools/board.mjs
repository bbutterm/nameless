/**
 * Доска боя глазами и в числах — на ДВУХ составах, а не на одном.
 *
 * Зачем отдельный инструмент. `battlelab.mjs` доходит до первой стычки, а она
 * всегда одна и та же: двое врагов против двоих своих. Половина дефектов доски
 * видна только на другом полюсе — шесть на шесть, где места нет вообще
 * (метки намерений, размер карточек, перенос имён, длина очереди). Дойти до
 * такого боя честной игрой можно только через полглавы, поэтому второй состав
 * подставляется правкой сейва: отряд из шести и узел сцены, который ведёт в
 * `battle_scavengers` (3 + 3). Игра при этом настоящая — движок, разметка и
 * стили те же, подменены только данные отряда.
 *
 * Печатает по каждому составу: высоты рядов, число карточек и пустых слотов,
 * размер карточки, кегль подписи и — главное — влезает ли самое длинное СЛОВО
 * имени в строку целиком (иначе браузер рвёт его посередине,
 * «Невостребованны/й залог»).
 *
 * Запуск: node tools/board.mjs <url> <outDir> [ширина] [высота]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173';
const outDir = process.argv[3] ?? '/tmp/playtest/board';
const W = Number(process.argv[4] ?? 390);
const H = Number(process.argv[5] ?? 844);
mkdirSync(outDir, { recursive: true });
const tag = `${W}x${H}`;

const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  locale: 'ru-RU',
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.big-button').first().click();

const FIGHT = ['не отдавать', 'драться', 'встать', 'бить', 'не вмешиваться', 'на мостки', 'не мешать'];
for (let i = 0; i < 400; i++) {
  if (await page.locator('.screen.battle').count()) break;
  // Бирка новобранца (В2) перекрывает экран подложкой, и до её закрытия любой
  // тап уходит в подложку, а не в кнопку: проход падал на «tag-backdrop
  // intercepts pointer events». Ветка та же, что в `battlelab.mjs`, — это
  // хвост, честно записанный в итоге В2.
  const backdrop = page.locator('.tag-backdrop');
  if (await backdrop.count()) {
    await backdrop.first().click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(150);
    continue;
  }
  const ch = page.locator('.choice');
  if (await ch.count()) {
    const texts = await page.evaluate(() =>
      [...document.querySelectorAll('.choice')].map((b) => b.textContent.toLowerCase()),
    );
    let k = texts.findIndex((t) => FIGHT.some((w) => t.includes(w)));
    if (k < 0) k = 0;
    await ch.nth(k).click();
  } else {
    const hint = page.locator('.tap-hint');
    if (await hint.count()) await hint.click();
  }
  await page.waitForTimeout(150);
}
if (!(await page.locator('.screen.battle').count())) {
  console.log('до боя не дошли');
  await browser.close();
  process.exit(1);
}

/** Всё, что можно проверить числом, а не на глаз. */
const measure = () =>
  page.evaluate(() => {
    // Ширина самого длинного слова против ширины строки подписи: если слово
    // шире — браузер перенесёт его посреди буквы, и имя перестанет читаться.
    // Меряем настоящим узлом в том же стиле, а не прикидкой по числу знаков.
    const wordWidth = (el, word) => {
      const probe = document.createElement('span');
      probe.textContent = word;
      probe.style.cssText = `position:absolute;white-space:pre;visibility:hidden;font:${getComputedStyle(el).font}`;
      el.appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    };
    const cards = [...document.querySelectorAll('.card:not(.empty)')].map((c) => {
      const n = c.querySelector('.card-name');
      const r = c.getBoundingClientRect();
      const words = (n?.textContent ?? '').split(/\s+/);
      const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '');
      // clientWidth включает padding подписи (3px с каждой стороны) — текст
      // раскладывается в content-box, поэтому вычитаем.
      const line = n ? n.clientWidth - 6 : 0;
      const word = n ? wordWidth(n, longest) : 0;
      return {
        name: n?.textContent ?? '',
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
        font: n ? parseFloat(getComputedStyle(n).fontSize) : 0,
        longest,
        word: +word.toFixed(1),
        line: +line.toFixed(1),
        broken: word > line + 0.5,
        clipped: n ? n.scrollHeight > n.clientHeight + 1 : false,
        offBottom: r.bottom > document.documentElement.clientHeight,
      };
    });
    return {
      rows: [...document.querySelectorAll('.row')].map((r) => ({
        cls: r.className.replace('row ', ''),
        h: +r.getBoundingClientRect().height.toFixed(1),
        cards: r.querySelectorAll('.card:not(.empty)').length,
        empty: r.querySelectorAll('.card.empty').length,
      })),
      cards,
      queue: document.querySelectorAll('.queue-chip').length,
      threats: document.querySelectorAll('.threat-mark').length,
      field: +(document.querySelector('.field')?.getBoundingClientRect().height ?? 0).toFixed(1),
      hint: +(document.querySelector('.field > .tutorial')?.getBoundingClientRect().height ?? 0).toFixed(1),
    };
  });

const report = (title, m) => {
  console.log(`\n── ${title} (${tag}) ──`);
  console.log(`поле ${m.field}px, подсказка обучения ${m.hint}px, очередь ${m.queue}, меток намерений ${m.threats}`);
  for (const r of m.rows) console.log(`  ряд ${r.cls}: ${r.h}px, карт ${r.cards}, пустых ${r.empty}`);
  const c = m.cards[0];
  if (c) console.log(`  карточка ${c.w}×${c.h}`);
  for (const x of m.cards) {
    const bad = [
      x.broken ? `ИМЯ РВЁТСЯ («${x.longest}» ${x.word}px > строка ${x.line}px)` : '',
      x.clipped ? 'ИМЯ ОБРЕЗАНО' : '',
      x.offBottom ? 'НИЖЕ ЭКРАНА' : '',
    ].filter(Boolean);
    if (bad.length) console.log(`  «${x.name}» ${x.font}px — ${bad.join(', ')}`);
  }
};

await page.waitForTimeout(1000);
await page.screenshot({ path: `${outDir}/two-${tag}.png` });
report('двое врагов, подсказка обучения на экране', await measure());
// Подсказка живёт 6.5 с и уходит сама — доску надо посмотреть и без неё.
await page.waitForTimeout(7000);
await page.screenshot({ path: `${outDir}/two-nohint-${tag}.png` });
report('двое врагов, подсказка ушла', await measure());

// ── Полный строй. Отряд из шести и узел сцены, ведущий в бой на шестерых.
const SIX = [
  ['unclaimed_pledge', 'front', 0],
  ['throat_taker', 'front', 1],
  ['tight_fist', 'front', 2],
  ['dusty_errand_boy', 'back', 0],
  ['ledger_clerk', 'back', 1],
  ['promise_pedlar', 'back', 2],
];
await page.evaluate((six) => {
  const env = JSON.parse(localStorage.getItem('nameless:save:v1'));
  env.state.party = six.map(([defId, row, index], i) => ({
    uid: `board-${i}`,
    defId,
    hp: 24,
    xp: 0,
    level: 1,
    slot: { row, index },
  }));
  env.state.scene = 'pier_dust';
  env.state.node = 'fight_scavengers';
  localStorage.setItem('nameless:save:v1', JSON.stringify(env));
}, SIX);
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.big-button').first().click();
await page.waitForTimeout(1200);
if (!(await page.locator('.screen.battle').count())) {
  console.log('полный бой не поднялся:', (await page.evaluate(() => document.body.innerText)).slice(0, 200));
} else {
  await page.screenshot({ path: `${outDir}/six-${tag}.png` });
  report('шесть на шесть', await measure());
}

console.log(`\nошибок консоли: ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log('  ' + e);
await browser.close();
process.exit(errors.length === 0 ? 0 : 1);
