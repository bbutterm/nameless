/**
 * Прохождение игры «личностью»: выбор варианта не случайный, а по смыслу
 * текста кнопки. Три персоны:
 *   cruel    — самый жестокий/эгоистичный из доступных
 *   merciful — самый милосердный
 *   seeker   — «расследующий»: архив, опись, вопросы, пересчёт
 *
 * Словари собраны по реальным текстам кнопок из packages/content/data/scenes.
 * При равенстве очков персона добирает фиксированным правилом (жестокий —
 * последний вариант, милосердный — первый, расследующий — средний), чтобы
 * прохождения расходились и на нейтральных развилках вроде выбора квартала.
 *
 * Пишет след прохождения (сцены, выборы, отряд, воспоминания) в
 * <outDir>/trace.json.
 *
 * Запуск: node tools/persona.mjs <url> <outDir> <persona> [maxSteps]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/persona';
const persona = process.argv[4] ?? 'cruel';
const maxSteps = Number(process.argv[5] ?? 6000);
mkdirSync(outDir, { recursive: true });

const W = {
  cruel: {
    plus: [
      'задым', 'огон', 'спалить', 'сжечь', 'выжечь', 'запалить', 'поднести', 'опрокинуть',
      'смол', 'гарь', 'добить', 'прижать', 'разбить', 'столкнуть', 'вытолкать', 'где короче',
      'за плату', 'по грошу', 'взять долю', 'пусть бежит', 'пусть отработают', 'пусть тушат',
      'быстр', 'дешевле', 'не ждать', 'указать на', 'не мешать', 'снести', 'горло',
      'кончайте', 'за запястье', 'не отпустить', 'силой', 'угроз', 'что бывает с',
      'забрать всё', 'оставить себе', 'не отдам', 'подороже', 'с покойника', 'донести',
      'выгнать', 'убить', 'резать', 'ударить', 'сначала тот', 'наряд', 'взять за',
      'потребовать', 'велеть', 'заставить', 'отнять', 'один раз', 'уходить пешком одному',
    ],
    minus: [
      'помочь', 'отдать', 'простить', 'пощадить', 'встать между', 'предупредить', 'спасти',
      'бесплатно', 'поделиться', 'мёрзнет', 'отпустить', 'перевязать', 'напоить', 'выкупить',
      'не спрашивая', 'сесть рядом',
    ],
  },
  merciful: {
    plus: [
      'мёрзнет', 'отдать', 'отдай', 'мальчишке', 'мальчику', 'наверх первым', 'встать между',
      'не откажу', 'оставь себе', 'напоить', 'поить', 'налить', 'оплатить', 'обойти всю очередь',
      'два ведра', 'бесплатно', 'сесть рядом', 'досидеть', 'накрыть', 'отпустить', 'перевязать',
      'выкупить', 'не спрашивая', 'не втягивать', 'вынести', 'предупредить', 'окликнуть',
      'одёрнуть', 'позвать сторожа', 'вместо него', 'отвезти', 'свой хлеб', 'принести им',
      'идти рядом', 'рубаху', 'простите', 'кружка воды', 'подвинуть', 'отослать',
      'отправить мальч', 'увести всех', 'вернуть', 'помочь', 'спасти', 'заслонить', 'пощадить',
      'простить', 'поделиться', 'всем хватит', 'остальных не трогайте', 'по кружке',
    ],
    minus: [
      'задым', 'сжечь', 'выжечь', 'спалить', 'запалить', 'добить', 'горло', 'угроз',
      'забрать всё', 'оставить себе', 'донести', 'выгнать', 'за плату', 'по грошу',
      'взять долю', 'разбить', 'столкнуть', 'вытолкать', 'прижать',
    ],
  },
  seeker: {
    plus: [
      'переписать', 'пересчитать', 'опис', 'сверить', 'сверя', 'посчитать', 'сосчитать',
      'считать', 'счита', 'по пунктам', 'пункт', 'номер', 'спросить', 'спрашивать', 'узнать',
      'архив', 'каталог', 'стеллаж', 'ящик', 'карточк', 'бирк', 'список', 'реестр',
      'прочитать', 'читать', 'записать', 'искать', 'что значит', 'сколько', 'почему',
      'цифрами', 'прейскурант', 'справк', 'лист', 'бумаж', 'бумаг', 'до утра', 'до темноты',
      'ночь', 'связк', 'дважды', 'вслух', 'проверить', 'выяснить', 'где хранится',
      'кто её составлял', 'фундамент', 'сверку', 'узел',
    ],
    minus: ['промолчать', 'отмахнуться', 'пройти мимо', 'ничего не трогать'],
  },
};

function score(text) {
  const s = text.toLowerCase();
  const w = W[persona];
  let v = 0;
  for (const p of w.plus) if (s.includes(p)) v += 2;
  for (const m of w.minus) if (s.includes(m)) v -= 3;
  return v;
}

function tieBreak(n) {
  if (persona === 'cruel') return n - 1;
  if (persona === 'merciful') return 0;
  return Math.min(n - 1, Math.floor(n / 2));
}

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
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

const snap = () =>
  page.evaluate(() => {
    try {
      const raw = localStorage.getItem('nameless:save:v1');
      if (!raw) return null;
      const s = JSON.parse(raw).state;
      return {
        chapter: s.chapter,
        scene: s.scene,
        node: s.node,
        deaths: s.deaths,
        axes: s.axes,
        party: s.party.map((u) => u.defId),
        locked: s.lockedMemories,
        lives: s.awakenedLives,
        visited: s.visitedScenes,
        flags: Object.keys(s.flags).filter((k) => s.flags[k]),
        gold: s.gold,
        logLen: s.log.length,
      };
    } catch {
      return null;
    }
  });

const trace = { persona, choices: [], scenes: [], deaths: [], battles: [], chapters: [], errors, notes: [] };

await page.locator('.big-button').first().click();
await page.waitForTimeout(400);

let lastScene = null;
let lastChapter = null;
let deathShots = 0;
let battleShots = 0;
let stuck = 0;
let lastSig = '';
let bubbles = 0;
let step;
const seenOptions = new Map();
const loops = new Map();

for (step = 0; step < maxSteps; step++) {
  const mode = await page.evaluate(() => {
    if (document.querySelector('.screen.battle')) return 'battle';
    if (document.querySelector('.screen.death')) return 'death';
    if (document.querySelector('.screen.dialogue')) return 'dialogue';
    if (document.querySelector('.screen.title')) return 'title';
    return 'unknown';
  });

  const s = await snap();
  const sig = [
    mode,
    s?.scene,
    s?.node,
    s?.logLen,
    s?.deaths,
    await page.evaluate(() => {
      const b = document.querySelector('.screen.battle');
      if (!b) return '';
      return (
        (document.querySelector('.battle-top')?.textContent ?? '') +
        [...document.querySelectorAll('.card-hp')].map((e) => e.textContent).join(',')
      );
    }),
  ].join('|');
  if (sig === lastSig) stuck++;
  else stuck = 0;
  lastSig = sig;
  if (stuck > 80) {
    trace.notes.push(`ЗАЛИПАНИЕ на шаге ${step}, режим ${mode}, ${s?.scene}#${s?.node}`);
    await page.screenshot({ path: `${outDir}/${persona}-stuck.png` });
    break;
  }

  if (mode === 'death') {
    if (deathShots < 3) {
      await page.waitForTimeout(3300);
      await page.screenshot({ path: `${outDir}/${persona}-death${deathShots}.png` });
    }
    const info = await page.evaluate(() => ({
      name: document.querySelector('.death-name')?.textContent ?? '',
      wake: document.querySelector('.death-wake')?.textContent ?? '',
      memory: document.querySelector('.memory-name')?.textContent ?? '',
      memText: document.querySelector('.memory-text')?.textContent ?? '',
      life: document.querySelector('.life-name')?.textContent ?? '',
      count: document.querySelector('.death-count')?.textContent ?? '',
    }));
    if (!trace.deaths.some((d) => d.count === info.count)) {
      deathShots++;
      trace.deaths.push({ ...info, atScene: s?.scene, locked: s?.locked, party: s?.party });
    }
    const btn = page.locator('.death-footer .big-button');
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(500);
    } else await page.waitForTimeout(400);
    continue;
  }

  if (mode === 'battle') {
    const over = page.locator('.battle-over .big-button');
    if (await over.count()) {
      const res = await page.evaluate(() => ({
        outcome: document.querySelector('.outcome')?.className ?? '',
        text: document.querySelector('.outcome')?.textContent ?? '',
        spoils: [...document.querySelectorAll('.spoil')].map((e) => e.textContent),
      }));
      trace.battles.push({ scene: s?.scene, ...res });
      if (battleShots < 4) {
        await page.screenshot({ path: `${outDir}/${persona}-battle-over${battleShots}.png` });
        battleShots++;
      }
      await over.click();
      await page.waitForTimeout(500);
      continue;
    }
    const ab = page.locator('.ability');
    const n = await ab.count();
    if (n > 0) {
      await ab.nth(n - 1).click();
      await page.waitForTimeout(90);
      let tgt = page.locator('.card.targetable');
      if ((await tgt.count()) === 0) {
        await ab.nth(0).click();
        await page.waitForTimeout(90);
        tgt = page.locator('.card.targetable');
      }
      if (await tgt.count()) {
        await tgt.first().click();
        await page.waitForTimeout(280);
        continue;
      }
    }
    await page.waitForTimeout(240);
    continue;
  }

  if (mode === 'dialogue') {
    if (s && s.scene !== lastScene) {
      lastScene = s.scene;
      trace.scenes.push({ scene: s.scene, chapter: s.chapter, deaths: s.deaths, party: s.party });
    }
    if (s && s.chapter !== lastChapter) {
      lastChapter = s.chapter;
      trace.chapters.push({ chapter: s.chapter, atStep: step, scene: s.scene });
    }

    const choiceCount = await page.locator('.choice').count();
    if (choiceCount > 0) {
      const opts = await page.evaluate(() =>
        [...document.querySelectorAll('.choice')].map((b) => ({
          chip: b.querySelector('.chip')?.textContent ?? '',
          text: b.querySelector('.choice-text')?.textContent ?? b.textContent,
        })),
      );
      // Живой игрок не жмёт в хабе одну и ту же кнопку по кругу: уже взятые
      // в этом узле варианты штрафуются, иначе бот вечно перечитывает доску.
      const key = `${s?.scene}#${s?.node}`;
      const taken = seenOptions.get(key) ?? new Set();
      const scores = opts.map((o) => score(o.chip + ' ' + o.text) - (taken.has(o.text) ? 100 : 0));
      const top = Math.max(...scores);
      const ties = scores.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0);
      const best = ties.length > 1 ? ties[Math.min(ties.length - 1, tieBreak(ties.length))] : ties[0];
      taken.add(opts[best].text);
      seenOptions.set(key, taken);
      loops.set(key, (loops.get(key) ?? 0) + 1);
      if ((loops.get(key) ?? 0) > 12) {
        trace.notes.push(`ЦИКЛ: узел ${key} пройден ${loops.get(key)} раз`);
        await page.screenshot({ path: `${outDir}/${persona}-loop.png` });
        break;
      }
      const prompt = await page.evaluate(
        () => document.querySelector('.choice-prompt')?.textContent ?? '',
      );
      trace.choices.push({
        scene: s?.scene,
        node: s?.node,
        prompt,
        options: opts.map((o) => (o.chip ? `[${o.chip}] ${o.text}` : o.text)),
        picked: opts[best].text,
        chip: opts[best].chip,
        score: top,
        tie: ties.length > 1,
      });
      await page.locator('.choice').nth(best).click();
      await page.waitForTimeout(200);
      continue;
    }

    const hint = page.locator('.tap-hint');
    if (await hint.count()) await hint.click();
    else await page.locator('.screen.dialogue').click({ position: { x: 195, y: 30 } });
    bubbles++;
    await page.waitForTimeout(90);
    continue;
  }

  if (mode === 'title' && bubbles > 5) {
    trace.notes.push(`Титул/финал на шаге ${step}`);
    await page.screenshot({ path: `${outDir}/${persona}-end.png` });
    break;
  }
  await page.waitForTimeout(150);
}

const final = await snap();
trace.final = final;
trace.steps = step;
trace.bubbles = bubbles;
await page.screenshot({ path: `${outDir}/${persona}-final.png` });
writeFileSync(`${outDir}/trace.json`, JSON.stringify(trace, null, 2));

console.log(`персона: ${persona}`);
console.log(`шагов: ${step}, пузырей: ${bubbles}, выборов: ${trace.choices.length}`);
console.log(`сцен: ${trace.scenes.length}, боёв: ${trace.battles.length}, смертей: ${trace.deaths.length}`);
console.log(`глава: ${final?.chapter}, сцена: ${final?.scene}`);
console.log(`оси: ${JSON.stringify(final?.axes)}`);
console.log(`отряд: ${(final?.party ?? []).join(', ')}`);
console.log(`воспоминания: ${(final?.locked ?? []).join(', ')}`);
console.log(`жизни: ${(final?.lives ?? []).join(', ')}`);
console.log(`посещено сцен: ${(final?.visited ?? []).length}`);
console.log(`ошибок: ${errors.length}`);
for (const e of errors.slice(0, 6)) console.log('   ' + e);
for (const n of trace.notes) console.log('! ' + n);

await browser.close();
