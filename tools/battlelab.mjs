/**
 * Разбор боя руками: доходим до первой стычки, играем осмысленно и замеряем,
 * что игрок реально видит — чей ход, кого можно бить, что делает способность,
 * читаются ли карточки. Плюс проверка геометрии карточек и переполнения поля.
 *
 * Второй проход — ЗАМЕР ОЩУЩЕНИЯ (`docs/БОЙ_ЗАМЕРЫ.md`, метрики Б, В, Г):
 * сколько бой идёт в секундах на живом клиенте вместе с паузами анимаций,
 * сколько тапов стоит один ход и через сколько миллисекунд экран отвечает на
 * палец. Симулятор этого не видит: он считает раунды, а игрок ждёт секунды.
 *
 * Запуск: node tools/battlelab.mjs <url> <outDir> [ширина] [высота]
 * Клиент надо поднять самому и передать URL явно: `pnpm --filter @nameless/client
 * preview --port 4180` (собранный) или `pnpm dev` (:5173).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/battle';
const width = Number(process.argv[4] ?? 390);
const height = Number(process.argv[5] ?? 844);
mkdirSync(outDir, { recursive: true });
const tag = `${width}x${height}`;

const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width, height },
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

// Идём в первую попавшуюся драку: в хабе выбираем мостки, дальше — вариант с дракой.
const FIGHT_WORDS = ['не отдавать', 'драться', 'встать', 'бить', 'не вмешиваться', 'на мостки', 'не мешать'];
for (let i = 0; i < 400; i++) {
  if (await page.locator('.screen.battle').count()) break;
  // Бирка новобранца перекрывает экран подложкой, и до её закрытия любой тап
  // уходит в подложку, а не в кнопку. Без этой ветки проход падал на
  // «tag-backdrop intercepts pointer events» на тех прохождениях, где спутник
  // вербуется до драки, — то есть примерно на половине.
  const backdrop = page.locator('.tag-backdrop');
  if (await backdrop.count()) {
    await backdrop.first().click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(150);
    continue;
  }
  const ch = page.locator('.choice');
  const n = await ch.count();
  if (n > 0) {
    const texts = await page.evaluate(() =>
      [...document.querySelectorAll('.choice')].map((b) => b.textContent.toLowerCase()),
    );
    let idx = texts.findIndex((t) => FIGHT_WORDS.some((w) => t.includes(w)));
    if (idx < 0) idx = 0;
    await ch.nth(idx).click();
  } else {
    const h = page.locator('.tap-hint');
    if (await h.count()) await h.click();
  }
  await page.waitForTimeout(200);
}

if (!(await page.locator('.screen.battle').count())) {
  console.log('до боя не дошли');
  await page.screenshot({ path: `${outDir}/no-battle-${tag}.png` });
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/battle-start-${tag}.png` });

const geom = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const cards = [...document.querySelectorAll('.card:not(.empty)')].map((c) => {
    const r = c.getBoundingClientRect();
    const name = c.querySelector('.card-name');
    return {
      name: name?.textContent ?? '',
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      top: +r.top.toFixed(1),
      bottom: +r.bottom.toFixed(1),
      offTop: r.top < 0,
      offBottom: r.bottom > vh,
      nameFont: name ? parseFloat(getComputedStyle(name).fontSize) : null,
      nameClipped: name ? name.scrollHeight > name.clientHeight + 1 : false,
      hpFont: parseFloat(getComputedStyle(c.querySelector('.card-hp')).fontSize),
      hpText: c.querySelector('.card-hp')?.textContent ?? '',
      intent: !!c.querySelector('.intent'),
      intentTitle: c.querySelector('.intent')?.getAttribute('title') ?? '',
      targetable: c.classList.contains('targetable'),
      selected: c.classList.contains('selected'),
    };
  });
  // В опись идут ВСЕ кнопки, включая серые: с Б2 способность на перезарядке
  // не исчезает, а стоит на месте с числом, и «сколько кнопок на панели» —
  // это теперь весь набор юнита, а не только готовое.
  const abilities = [...document.querySelectorAll('.ability')].map((a) => {
    const r = a.getBoundingClientRect();
    return {
      text: a.textContent,
      cooling: a.classList.contains('cooling'),
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      font: parseFloat(getComputedStyle(a.querySelector('span')).fontSize),
      title: a.getAttribute('title') ?? '',
      aria: a.getAttribute('aria-label') ?? '',
    };
  });
  return {
    vw,
    vh,
    cards,
    abilities,
    hint: document.querySelector('.battle-hint')?.textContent ?? '',
    top: document.querySelector('.battle-top')?.textContent ?? '',
    fieldOverflow: (() => {
      const f = document.querySelector('.field');
      return f ? { scrollH: f.scrollHeight, clientH: f.clientHeight } : null;
    })(),
    hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
});
console.log(`\n── ${tag} ─────────────────────────`);
console.log('верхняя строка:', geom.top, '| подсказка:', JSON.stringify(geom.hint));
console.log('поле:', JSON.stringify(geom.fieldOverflow), 'гориз. скролл:', geom.hScroll);
for (const c of geom.cards) {
  const flags = [
    c.offTop ? 'ВЫШЕ ЭКРАНА' : '',
    c.offBottom ? 'НИЖЕ ЭКРАНА' : '',
    c.nameClipped ? 'ИМЯ ОБРЕЗАНО' : '',
    c.intent ? `намерение(${c.intentTitle})` : 'намерения нет',
  ].filter(Boolean);
  console.log(
    `  карта «${c.name}» ${c.w}×${c.h} top=${c.top} имя ${c.nameFont}px hp ${c.hpFont}px «${c.hpText}» ${flags.join(' ')}`,
  );
}
console.log('способности:');
for (const a of geom.abilities) {
  console.log(
    `  «${a.text}»${a.cooling ? ' [серая, перезарядка]' : ''} ${a.w}×${a.h}, шрифт ${a.font}px, title=«${a.title}» aria=«${a.aria}»`,
  );
}

// Выбираем способность и смотрим, кто подсветился целью.
if (geom.abilities.length) {
  await page.locator('.ability:not(.cooling)').first().click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outDir}/battle-targets-${tag}.png` });
  const t = await page.evaluate(() => ({
    hint: document.querySelector('.battle-hint')?.textContent ?? '',
    targetable: [...document.querySelectorAll('.card.targetable')].map(
      (c) => c.querySelector('.card-name')?.textContent,
    ),
    all: [...document.querySelectorAll('.card:not(.empty)')].map((c) => ({
      n: c.querySelector('.card-name')?.textContent,
      row: c.closest('.row')?.className,
      side: c.className.includes('enemy') ? 'enemy' : 'player',
      targetable: c.classList.contains('targetable'),
      disabled: c.disabled,
    })),
  }));
  console.log('после выбора способности подсказка:', JSON.stringify(t.hint));
  console.log('можно бить:', JSON.stringify(t.targetable));
  console.log('все карты:', JSON.stringify(t.all));

  // Тапаем по НЕдоступной цели — есть ли хоть какой-то отклик?
  const forbidden = await page.locator('.card:not(.empty):not(.targetable)').filter({ hasNot: page.locator('.selected') });
  if (await forbidden.count()) {
    const before = await page.evaluate(() => document.body.innerText);
    await forbidden.first().click({ force: true });
    await page.waitForTimeout(350);
    const after = await page.evaluate(() => document.body.innerText);
    console.log(
      'тап по недоступной цели изменил экран:',
      before !== after ? 'да' : 'НЕТ (молчание)',
    );
    await page.screenshot({ path: `${outDir}/battle-forbidden-${tag}.png` });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ЗАМЕР ОЩУЩЕНИЯ (docs/БОЙ_ЗАМЕРЫ.md, метрики Б, В, Г)
//
// Симулятор считает раунды, а игрок ждёт секунды: между двумя его тапами
// клиент прокручивает ходы ботов по 480 мс, держит рывок карточки 420 мс и
// цифру урона 900 мс. Ни одно из этих чисел не видно из `pnpm sim`, а жалоба
// «не динамичный» — ровно про них.
//
// Проход идёт в ЧИСТОЙ вкладке: первый проход уже потыкал в способности и
// в запрещённую цель, и мерить время боя после этого значило бы мерить свои
// же следы.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Дойти до следующего боя ровно тем же путём, что и первый проход.
 * `fresh` — начать игру с нуля; иначе продолжаем с того места, где стоим.
 */
let walkStop = '';
async function walkToBattle(p, fresh = true) {
  walkStop = 'кончились шаги прохода';
  if (fresh) {
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.clear());
    await p.reload({ waitUntil: 'networkidle' });
    await p.locator('.big-button').first().click();
  }
  for (let i = 0; i < 600; i++) {
    if (await p.locator('.screen.battle').count()) {
      // Экран боя мог остаться от ПРЕДЫДУЩЕГО боя с открытым итогом: пока
      // «Дальше» не нажата, мы стоим не в новом бою, а в хвосте старого.
      if (!(await p.locator('.battle-over').count())) return true;
      await p.locator('.battle-over .big-button').first().click();
      await p.waitForTimeout(150);
      continue;
    }
    // Церемония смерти — конец прохождения: дальше боёв не будет.
    if (await p.locator('.memory-card, .death-stage').count()) {
      walkStop = 'церемония смерти';
      return false;
    }
    // Бирка новобранца перекрывает экран подложкой: пока её не убрать, любой
    // тап уходит в подложку, а не в кнопку. Игрок закрывает её тем же жестом.
    const backdrop = p.locator('.tag-backdrop');
    if (await backdrop.count()) {
      await backdrop.first().click({ position: { x: 5, y: 5 } });
      await p.waitForTimeout(120);
      continue;
    }
    const ch = p.locator('.choice');
    if (await ch.count()) {
      const texts = await p.evaluate(() =>
        [...document.querySelectorAll('.choice')].map((b) => b.textContent.toLowerCase()),
      );
      let idx = texts.findIndex((t) => FIGHT_WORDS.some((w) => t.includes(w)));
      if (idx < 0) idx = 0;
      await ch.nth(idx).click();
    } else {
      const h = p.locator('.tap-hint');
      if (await h.count()) await h.click();
    }
    await p.waitForTimeout(120);
  }
  return !!(await p.locator('.screen.battle').count());
}

/**
 * Секундомер тапа. Момент нажатия берётся ИЗ САМОЙ СТРАНИЦЫ, с обработчика
 * `pointerdown` в фазе перехвата, а не из времени вызова из Node: между
 * командой и настоящим событием лежит канал управления браузером, и его
 * задержка попала бы в цифру отклика как задержка игры.
 *
 * Меряются две разные вещи, и путать их нельзя:
 *   dom   — когда экран ИЗМЕНИЛСЯ (первая мутация DOM);
 *   frame — когда изменение доехало до ближайшего кадра. Это ближе к тому, что
 *           игрок называет «ответило», и именно frame идёт в отчёт.
 */
const ARM_TAP = () => {
  const lab = (window.__lab ??= { t0: 0, dom: null, frame: null, armed: false });
  if (!window.__labInstalled) {
    window.__labInstalled = true;
    document.addEventListener(
      'pointerdown',
      () => {
        if (window.__lab.armed) window.__lab.t0 = performance.now();
      },
      true,
    );
    new MutationObserver(() => {
      const l = window.__lab;
      if (!l.armed || !l.t0 || l.dom !== null) return;
      l.dom = performance.now() - l.t0;
      requestAnimationFrame(() => {
        l.frame = performance.now() - l.t0;
      });
    }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  }
  lab.armed = true;
  lab.t0 = 0;
  lab.dom = null;
  lab.frame = null;
};

const feelPage = await ctx.newPage();
/** Сколько боёв подряд мерить. Первый бой — обучающий и короче прочих. */
const FEEL_BATTLES = Number(process.env.BATTLELAB_BATTLES ?? 4);
const taps = [];
const battlesMeasured = [];

for (let bi = 0; bi < FEEL_BATTLES; bi++) {
  if (!(await walkToBattle(feelPage, bi === 0))) {
    if (bi > 0) console.log(`   (дальше боёв не набрали: ${walkStop})`);
    break;
  }
  await feelPage.evaluate(ARM_TAP);
  let tapCount = 0;
  let turns = 0;
  /** Сколько миллисекунд игрок сидел, не имея права хода. */
  let waitingMs = 0;
  let lastIdleStart = null;
  const t0 = Date.now();

  /** Тап с секундомером: копит отклик в общий список. */
  const tap = async (locator) => {
    await feelPage.evaluate(ARM_TAP);
    await locator.click();
    tapCount++;
    const r = await feelPage
      .waitForFunction(() => window.__lab.frame !== null, null, { timeout: 1500 })
      .then(() => feelPage.evaluate(() => ({ dom: window.__lab.dom, frame: window.__lab.frame })))
      .catch(() => null);
    taps.push(r ?? { dom: null, frame: null });
  };

  // Играем ТАК БЫСТРО, КАК ПОЗВОЛЯЕТ ЭКРАН: своих пауз не добавляем, только
  // опрашиваем поле каждые 25 мс. Значит, полученное время боя — нижняя
  // граница: всё, что осталось, — это анимации и ходы ботов, а не раздумья.
  for (let step = 0; step < 900; step++) {
    if (await feelPage.locator('.battle-over').count()) break;
    if (!(await feelPage.locator('.screen.battle').count())) break;
    /*
     * Жмём только ГОТОВУЮ кнопку. До Б2 панель отдавала одни готовые, и
     * `.ability` значило то же самое; с Б2 серая кнопка стоит на своём месте
     * и на нажатие отвечает сроком, а не ходом. Без `:not(.cooling)` прибор
     * упирался бы в неё и считал бы лишние тапы — то есть замер (в) тапов на
     * ход перестал бы мерить игрока и начал мерить дефект прибора.
     */
    const ability = feelPage.locator('.ability:not(.cooling)').first();
    if (await ability.count()) {
      if (lastIdleStart !== null) {
        waitingMs += Date.now() - lastIdleStart;
        lastIdleStart = null;
      }
      await tap(ability);
      const target = feelPage.locator('.card.targetable').first();
      if (await target.count()) {
        await tap(target);
        turns++;
      }
      continue;
    }
    if (lastIdleStart === null) lastIdleStart = Date.now();
    await feelPage.waitForTimeout(25);
  }
  if (lastIdleStart !== null) waitingMs += Date.now() - lastIdleStart;
  const ms = Date.now() - t0;
  const finished = !!(await feelPage.locator('.battle-over').count());
  const rounds = await feelPage.evaluate(() => {
    const m = /Раунд\s+(\d+)/.exec(document.querySelector('.battle-top')?.textContent ?? '');
    return m ? Number(m[1]) : null;
  });
  if (bi === 0) await feelPage.screenshot({ path: `${outDir}/battle-feel-${tag}.png` });
  battlesMeasured.push({ ms, rounds, tapCount, turns, waitingMs, finished });
}

const q = (xs, p) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

console.log('\n── ощущение боя (метрики Б, В, Г) ──────────────────');
if (battlesMeasured.length === 0) {
  console.log('до боя не дошли: замер Б/В/Г не сделан');
} else {
  const sum = (pick) => battlesMeasured.reduce((a, b) => a + pick(b), 0);
  const totalMs = sum((b) => b.ms);
  const totalTaps = sum((b) => b.tapCount);
  const totalTurns = sum((b) => b.turns);
  const totalWait = sum((b) => b.waitingMs);
  const totalRounds = sum((b) => b.rounds ?? 0);
  const unfinished = battlesMeasured.filter((b) => !b.finished).length;
  for (const [i, b] of battlesMeasured.entries()) {
    console.log(
      `   бой ${i + 1}${i === 0 ? ' (обучающий)' : ''}: ${(b.ms / 1000).toFixed(1)} с, раундов ${b.rounds ?? '—'}, ` +
        `ходов ${b.turns}, тапов ${b.tapCount}, ожидание ${(b.waitingMs / 1000).toFixed(1)} с` +
        `${b.finished ? '' : '  БОЙ НЕ ЗАКОНЧИЛСЯ'}`,
    );
  }
  console.log(
    `Б длительность боя: в среднем ${(totalMs / 1000 / battlesMeasured.length).toFixed(1)} с по ` +
      `${battlesMeasured.length} боям${unfinished ? ` (${unfinished} не закончились — цифра неполная)` : ''}` +
      `${totalRounds ? `, ${(totalMs / 1000 / totalRounds).toFixed(1)} с на раунд` : ''}`,
  );
  console.log(
    `   ожидание без права хода ${((totalWait / Math.max(1, totalMs)) * 100).toFixed(0)}% времени боя; ` +
      `тапы шли мгновенно, так что это НИЖНЯЯ ГРАНИЦА — живой игрок ещё и думает`,
  );
  console.log(
    `В тапов ${totalTaps} на ${totalTurns} ходов = ${(totalTaps / Math.max(1, totalTurns)).toFixed(2)} тапа на ход`,
  );
  const frames = taps.map((t) => t.frame).filter((v) => typeof v === 'number');
  const mute = taps.filter((t) => t.frame === null).length;
  console.log(
    `Г отклик на тап по ${taps.length} тапам: медиана ${q(frames, 0.5)?.toFixed(0) ?? '—'} мс, ` +
      `девять из десяти в ${q(frames, 0.9)?.toFixed(0) ?? '—'} мс, ` +
      `худший ${frames.length ? Math.max(...frames).toFixed(0) : '—'} мс` +
      `${mute ? `; тапов без отклика ${mute}` : ''}`,
  );
  console.log(
    `   (отклик меряется до ближайшего КАДРА после первой мутации DOM; ` +
      `рывок карточки живёт 420 мс, цифра урона 900 мс — они в отклик не входят)`,
  );
}

await browser.close();
