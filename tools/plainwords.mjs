/**
 * Простые слова: машинная проверка канцелярского словаря (`docs/ПЕРЕХОД.md`
 * §6–7, задача Р3).
 *
 * Зачем прибор. Владелец дважды отверг мир за то, что законом мира сделали
 * учёт, и оба раза это ловил человек — глазами, на готовом тексте. Глаз
 * устаёт, а корпус в 41 сцену переписывается частями: одно «залоговое»
 * слово, вернувшееся в третью правку четвёртой сцены, никто не заметит.
 * Поэтому словарь считает машина, а пороги назначены заранее (§6), чтобы
 * спор шёл о числе в документе, а не о вкусе рецензента.
 *
 * Словарь двухъярусный, потому что канцелярский язык — часть голоса мира
 * («о страшном — канцелярским языком»). Тир А — слова ушедшего института,
 * им нет места вовсе. Тир Б — фоновая канцелярия, приправа: дозируется, а
 * не запрещается.
 *
 * Что проверяется:
 *   1. тир А — 0 вхождений в видимом игроку тексте сцены;
 *   2. тир Б — не больше `max(6, round(слов/1000*8))` на сцену;
 *   3. тир Б — не больше 2 слов в одной реплике (приправа, не бульон);
 *   4. имена юнитов — словарь одной силы не занимает больше 20% имён
 *      (правило шести словарей: пять сил не должны звучать одним голосом).
 *
 * Что НЕ проверяется (§7): ascii-id и имена файлов (`lombard_yard`,
 * `first_lot`, `great_pawnshop` — id живут как есть), топоним «Заклад» с
 * прописной и прилагательное «закладский» (имя города — шрам, не вывеска),
 * Помянник и `docs/`, а также сцена `silver_counter` — она удаляется
 * этапом С, и краснеть по ней нечем.
 *
 * Запуск: `node tools/plainwords.mjs [--json] [--quiet]`, либо `pnpm plainwords`.
 * Код возврата 1 при любом нарушении. Тот же счёт вызывает симулятор
 * (`packages/sim/src/cli.ts`) — там нарушения сверяются с
 * `sim-baseline.json`, потому что сейчас корпус красный по праву: тексты
 * ещё не переехали, чинит этап С.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Сцены, которые словарём не проверяются (§7 п. 5). */
export const SKIPPED_SCENES = new Set(['silver_counter']);

/**
 * Тир А, русский ряд: совпадение по НАЧАЛУ слова, регистр не важен, кроме
 * оговорённого топонима. `ревизи` — не `ревизор`: Ревизор остаётся
 * персонажем, умирает Ревизия-институт.
 */
const TIER_A_RU = [
  'ломбард',
  'залог',
  'залож',
  'заклад',
  'закладн',
  'вклад',
  'выкуп',
  'обеспечени',
  'прейскурант',
  'списани',
  'ревизи',
  'недоимк',
  'неоплатн',
];

/** Тир А, английское зеркало — по тому же правилу начала слова. */
const TIER_A_EN = ['pawn', 'pledge', 'deposit', 'collateral', 'redemption', 'audit'];

/** Тир А, словосочетания: одним токеном их не поймать. */
const TIER_A_PHRASES = [
  { root: 'вклад первый', re: /вклад\s+первый/giu },
  { root: 'write-off', re: /\bwrite-?off/giu },
  { root: 'price list', re: /\bprice\s+list/giu },
];

/**
 * Тир Б. Список §6 дан словарными формами, а текст живёт в падежах, поэтому
 * у каждого слова свой набор окончаний. Написано руками, а не стеммером:
 * стеммер на коротких основах ловит «лоток» за «лот» и «сверкает» за
 * «сверку», а ложное срабатывание в дозируемом ярусе дороже пропуска —
 * оно учит вычёркивать записи не глядя.
 */
const TIER_B = [
  ['опись', /^опис(ь|и|ью|ей|ям|ями|ях)$/u],
  ['реестр', /^реестр(|а|у|ом|е|ы|ов|ам|ами|ах)$/u],
  ['учёт', /^уч[ёе]т(|а|у|ом|е|ы|ов)$/u],
  ['ведомость', /^ведомост(ь|и|ью|ей|ям|ями|ях)$/u],
  ['протокол', /^протокол(|а|у|ом|е|ы|ов|ам|ами|ах)$/u],
  ['посул', /^посул(|а|у|ом|е|ы|ов|ам|ами|ах)$/u],
  ['взыскание', /^взыскани(е|я|ю|ем|и|й|ям|ями|ях)$/u],
  ['изъятие', /^изъяти(е|я|ю|ем|и|й|ям|ями|ях)$/u],
  ['квитанция', /^квитанци(я|и|ю|ей|й|ям|ями|ях)$/u],
  ['расписка', /^расписк(а|и|е|у|ой|ам|ами|ах)$|^расписок$/u],
  ['бланк', /^бланк(|а|у|ом|е|и|ов|ам|ами|ах)$/u],
  ['графа', /^граф(а|ы|е|у|ой|ам|ами|ах)$|^граф$/u],
  ['пункт', /^пункт(|а|у|ом|е|ы|ов|ам|ами|ах)$/u],
  ['статья', /^стать(я|и|е|ю|ёй|ей|ям|ями|ях)$|^статей$/u],
  ['акт', /^акт(|а|у|ом|е|ы|ов|ам|ами|ах)$/u],
  ['сверка', /^сверк(а|и|е|у|ой|ам|ами|ах)$|^сверок$/u],
  ['смета', /^смет(а|ы|е|у|ой|ам|ами|ах)$/u],
  ['тариф', /^тариф(|а|у|ом|е|ы|ов|ам|ами|ах)$/u],
  ['коэффициент', /^коэффициент(|а|у|ом|е|ы|ов|ам|ами|ах)$/u],
  ['экземпляр', /^экземпляр(|а|у|ом|е|ы|ов|ам|ами|ах)$/u],
  ['журнал', /^журнал(|а|у|ом|е|ы|ов|ам|ами|ах)$/u],
  ['перепись', /^перепис(ь|и|ью|ей|ям|ями|ях)$/u],
  ['понятой', /^понят(ой|ого|ому|ым|ом|ые|ых|ыми)$/u],
  ['предъявитель', /^предъявител(ь|я|ю|ем|е|и|ей|ям|ями|ях)$/u],
  ['явка', /^явк(а|и|е|у|ой|ам|ами|ах)$|^явок$/u],
  ['канцелярия', /^канцеляри(я|и|ю|ей|й|ям|ями|ях)$/u],
  ['контора', /^контор(а|ы|е|у|ой|ам|ами|ах)$|^контор$/u],
  ['курс', /^курс(|а|у|ом|е|ы|ов|ам|ами|ах)$/u],
  ['оценка', /^оценк(а|и|е|у|ой|ам|ами|ах)$|^оценок$/u],
  ['оценщик', /^оценщик(|а|у|ом|е|и|ов|ам|ами|ах)$/u],
  ['надбавка', /^надбавк(а|и|е|у|ой|ам|ами|ах)$|^надбавок$/u],
  ['формуляр', /^формуляр(|а|у|ом|е|ы|ов|ам|ами|ах)$/u],
  ['подшивка', /^подшивк(а|и|е|у|ой|ам|ами|ах)$|^подшивок$/u],
  ['лот', /^лот(|а|у|ом|е|ы|ов|ам|ами|ах)$/u],
];

/** Словари пяти сил для правила имён (§6 п. 4): совпадение по началу слова. */
export const POWER_DICTS = [
  { power: 'засечная стража', stems: ['устав', 'оклик', 'вешк', 'караул', 'наряд', 'стать'] },
  { power: 'Гоньба', stems: ['подорожн', 'расписани', 'груз', 'станци', 'ямск'] },
  { power: 'братство', stems: ['обряд', 'отпускани', 'репа', 'брати'] },
  { power: 'Цех', stems: ['товар', 'срез', 'склянк', 'лот', 'торг'] },
  { power: 'щербатые', stems: ['папк', 'примет', 'перечн', 'картотек', 'зарубк'] },
];

/** Доля имён юнитов, дозволенная одному словарю. */
export const NAME_SHARE_LIMIT = 0.2;

const TOKEN_RE = /[A-Za-zА-Яа-яЁё]+(?:-[A-Za-zА-Яа-яЁё]+)?/gu;

function tokens(text) {
  return String(text).match(TOKEN_RE) ?? [];
}

/** Слов в строке — тем же счётом, что и в схеме контента. */
export function wordCount(text) {
  const t = String(text).trim();
  return t === '' ? 0 : t.split(/\s+/u).length;
}

/**
 * Порог тира Б на сцену (§6 п. 2). Потолок 6 держит короткие сцены: без
 * него сцена на двести слов имела бы право на два канцеляризма и была бы
 * зелёной, состоя из них наполовину.
 */
export function tierBLimit(words) {
  return Math.max(6, Math.round((words / 1000) * 8));
}

/**
 * Тир А в одной строке. `lang` выбирает ряд: русские основы ищутся в `ru`,
 * английское зеркало — в `en`. Возвращает список найденных основ со словами.
 */
export function tierAHits(text, lang) {
  const hits = [];
  const roots = lang === 'en' ? TIER_A_EN : TIER_A_RU;
  for (const word of tokens(text)) {
    const low = word.toLowerCase();
    if (lang !== 'en' && low.startsWith('заклад')) {
      // §7 п. 2: имя города и его прилагательное разрешены, «закладная»
      // (бумага ушедшего мира) — нет, и прописная буква её не спасает.
      if (/^закладск/u.test(low)) continue;
      if (/^закладн/u.test(low)) {
        hits.push({ root: 'закладн', word });
        continue;
      }
      if (word.startsWith('З')) continue;
      hits.push({ root: 'заклад', word });
      continue;
    }
    const root = roots.find((r) => low.startsWith(r));
    if (root) hits.push({ root, word });
  }
  for (const { root, re } of TIER_A_PHRASES) {
    for (const m of String(text).matchAll(re)) hits.push({ root, word: m[0] });
  }
  return hits;
}

/** Тир Б в одной строке (только русский ярус: список §6 дан по-русски). */
export function tierBHits(text) {
  const hits = [];
  for (const word of tokens(text)) {
    const low = word.toLowerCase();
    const found = TIER_B.find(([, re]) => re.test(low));
    if (found) hits.push({ root: found[0], word });
  }
  return hits;
}

/**
 * Видимый игроку текст сцены: заголовок, реплики, нарратив, лор, вопросы
 * выбора, тексты вариантов и подписи фишек. Id узлов, флаги, оси, имена
 * файлов и `keywords` не берутся: id не переименовываются (§7 п. 1), а
 * `keywords.match` — это кусок уже посчитанной реплики, и брать его значит
 * считать одно слово дважды.
 */
export function visibleLines(scene) {
  const out = [];
  const put = (where, loc) => {
    if (!loc || typeof loc !== 'object') return;
    if (typeof loc.ru === 'string') out.push({ where, lang: 'ru', text: loc.ru });
    if (typeof loc.en === 'string') out.push({ where, lang: 'en', text: loc.en });
  };
  put('title', scene.title);
  for (const n of scene.nodes ?? []) {
    put(`${n.id}`, n.title);
    put(`${n.id}`, n.text);
    put(`${n.id}`, n.prompt);
    for (const o of n.options ?? []) {
      put(`${n.id}/${o.id}`, o.text);
      put(`${n.id}/${o.id}`, o.chip?.label);
    }
  }
  return out;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listJson(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listJson(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out.sort();
}

/** Проверка одной сцены. Возвращает нарушения и замеры. */
export function checkScene(scene) {
  const lines = visibleLines(scene);
  const words = lines
    .filter((l) => l.lang === 'ru')
    .reduce((a, l) => a + wordCount(l.text), 0);
  const limit = tierBLimit(words);

  const tierA = [];
  const perLine = [];
  let tierBTotal = 0;
  const tierBRoots = new Map();

  for (const line of lines) {
    for (const h of tierAHits(line.text, line.lang)) {
      tierA.push({ where: line.where, lang: line.lang, ...h, quote: quote(line.text, h.word) });
    }
    if (line.lang !== 'ru') continue;
    const b = tierBHits(line.text);
    tierBTotal += b.length;
    for (const h of b) tierBRoots.set(h.root, (tierBRoots.get(h.root) ?? 0) + 1);
    // Реплика — одна видимая строка: узел, вопрос выбора или кнопка.
    if (b.length > 2) {
      perLine.push({ where: line.where, count: b.length, words: b.map((h) => h.word) });
    }
  }

  return {
    id: scene.id,
    words,
    limit,
    tierA,
    tierB: tierBTotal,
    tierBOver: tierBTotal > limit,
    tierBRoots: [...tierBRoots.entries()].sort((a, b) => b[1] - a[1]),
    perLine,
  };
}

function quote(text, word) {
  const i = text.indexOf(word);
  if (i < 0) return text.slice(0, 60);
  return `…${text.slice(Math.max(0, i - 24), i + word.length + 24).trim()}…`;
}

/** Правило шести словарей: доля имён юнитов на каждый словарь силы. */
export function checkNames(units) {
  const total = units.length;
  return POWER_DICTS.map(({ power, stems }) => {
    const matched = units.filter((u) =>
      tokens(u.name?.ru ?? '').some((w) => stems.some((s) => w.toLowerCase().startsWith(s))),
    );
    return {
      power,
      total,
      matched: matched.length,
      share: total === 0 ? 0 : matched.length / total,
      limit: NAME_SHARE_LIMIT,
      over: total > 0 && matched.length / total > NAME_SHARE_LIMIT,
      names: matched.map((u) => u.name.ru),
    };
  });
}

/**
 * Полный прогон по корпусу. `root` — корень репозитория.
 * Возвращает замеры и нарушения; печать и код возврата — снаружи.
 */
export function checkPlainwords(root = repoRoot()) {
  const dataDir = join(root, 'packages', 'content', 'data');
  const scenes = [];
  const skipped = [];
  for (const file of listJson(join(dataDir, 'scenes'))) {
    const scene = readJson(file);
    if (SKIPPED_SCENES.has(scene.id)) {
      skipped.push(scene.id);
      continue;
    }
    scenes.push(checkScene(scene));
  }
  const units = [];
  for (const file of listJson(join(dataDir, 'units'))) {
    const arr = readJson(file);
    if (Array.isArray(arr)) units.push(...arr);
  }
  const names = checkNames(units);

  const tierAScenes = scenes.filter((s) => s.tierA.length > 0);
  const tierBScenes = scenes.filter((s) => s.tierBOver);
  const perLineScenes = scenes.filter((s) => s.perLine.length > 0);
  const namesOver = names.filter((n) => n.over);

  return {
    scenes,
    skipped,
    names,
    unitsTotal: units.length,
    tierAScenes,
    tierAHits: tierAScenes.reduce((a, s) => a + s.tierA.length, 0),
    tierBScenes,
    perLineScenes,
    perLineHits: perLineScenes.reduce((a, s) => a + s.perLine.length, 0),
    namesOver,
    violations:
      tierAScenes.length + tierBScenes.length + perLineScenes.length + namesOver.length,
  };
}

export function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

/** Отчёт человеку: сцена, что нарушено, сколько и предел. */
export function report(r) {
  const out = [];
  out.push(
    `Простые слова: сцен ${r.scenes.length}, юнитов ${r.unitsTotal}` +
      (r.skipped.length ? `, пропущено по §7: ${r.skipped.join(', ')}` : ''),
  );

  out.push('');
  out.push(`── Тир А (порог 0): сцен с нарушением ${r.tierAScenes.length}, вхождений ${r.tierAHits}`);
  for (const s of r.tierAScenes) {
    const byRoot = new Map();
    for (const h of s.tierA) byRoot.set(h.root, (byRoot.get(h.root) ?? 0) + 1);
    const list = [...byRoot.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w}×${n}`);
    out.push(`!! ${s.id.padEnd(24)} ${s.tierA.length} вхожд. при пределе 0: ${list.join(', ')}`);
    for (const h of s.tierA.slice(0, 3)) {
      out.push(`     ${h.where} (${h.lang}): «${h.word}» ${h.quote}`);
    }
    if (s.tierA.length > 3) out.push(`     …и ещё ${s.tierA.length - 3}`);
  }

  out.push('');
  out.push(`── Тир Б (порог max(6, слов/1000×8) на сцену): сцен сверх предела ${r.tierBScenes.length}`);
  for (const s of r.tierBScenes) {
    const list = s.tierBRoots.map(([w, n]) => `${w}×${n}`).join(', ');
    out.push(`!! ${s.id.padEnd(24)} ${s.tierB} при пределе ${s.limit} (слов ${s.words}): ${list}`);
  }

  out.push('');
  out.push(`── Тир Б в одной реплике (порог 2): реплик сверх предела ${r.perLineHits}`);
  for (const s of r.perLineScenes) {
    for (const l of s.perLine) {
      out.push(`!! ${s.id}#${l.where}: ${l.count} при пределе 2 — ${l.words.join(', ')}`);
    }
  }

  out.push('');
  out.push(`── Имена юнитов (словарь одной силы ≤ ${Math.round(NAME_SHARE_LIMIT * 100)}%)`);
  for (const n of r.names) {
    const mark = n.over ? '!!' : '  ';
    out.push(
      `${mark} ${n.power.padEnd(18)} ${n.matched}/${n.total} = ${(n.share * 100).toFixed(1)}%` +
        (n.matched ? `: ${n.names.join(', ')}` : ''),
    );
  }

  out.push('');
  out.push(
    r.violations === 0
      ? 'ИТОГ: чисто — тир А пуст, тир Б в пределах, ни один словарь не занял пятую часть имён'
      : `ИТОГ: нарушений ${r.violations} ` +
        `(тир А ${r.tierAScenes.length} сцен, тир Б ${r.tierBScenes.length} сцен, ` +
        `реплик ${r.perLineHits}, словарей имён ${r.namesOver.length})`,
  );
  return out;
}

/**
 * Короткий отчёт — для симулятора, который печатает десяток разделов подряд.
 * Полный список нарушений остаётся за `node tools/plainwords.mjs`: тридцать
 * сцен построчно внутри прогона симулятора не читает никто.
 */
export function brief(r) {
  const out = [];
  const worstA = [...r.tierAScenes].sort((a, b) => b.tierA.length - a.tierA.length).slice(0, 5);
  const worstB = [...r.tierBScenes].sort((a, b) => b.tierB - a.tierB).slice(0, 5);
  out.push(
    `сцен ${r.scenes.length} (пропущено по §7: ${r.skipped.length}), юнитов ${r.unitsTotal}`,
  );
  out.push(
    `${r.tierAScenes.length ? '!!' : '  '} тир А (порог 0): ${r.tierAHits} вхождений ` +
      `в ${r.tierAScenes.length} сценах` +
      (worstA.length ? `; хуже всех ${worstA.map((s) => `${s.id} ${s.tierA.length}`).join(', ')}` : ''),
  );
  out.push(
    `${r.tierBScenes.length ? '!!' : '  '} тир Б (порог max(6, слов/1000×8)): ` +
      `${r.tierBScenes.length} сцен сверх предела` +
      (worstB.length
        ? `; хуже всех ${worstB.map((s) => `${s.id} ${s.tierB}/${s.limit}`).join(', ')}`
        : ''),
  );
  out.push(
    `${r.perLineHits ? '!!' : '  '} тир Б в реплике (порог 2): ${r.perLineHits} реплик сверх предела`,
  );
  for (const n of r.names) {
    out.push(
      `${n.over ? '!!' : '  '} имена, словарь силы «${n.power}»: ` +
        `${n.matched}/${n.total} = ${(n.share * 100).toFixed(1)}% при пределе 20%`,
    );
  }
  if (r.violations > 0) out.push('   полный список: node tools/plainwords.mjs');
  return out;
}

/**
 * Нарушения в виде строк для `sim-baseline.json`. Записи АГРЕГИРОВАНЫ по
 * правилу, а не по сцене: корпус переезжает целиком (этап С), и три десятка
 * записей вида `plainwords:ch1/lombard_yard` пришлось бы вычёркивать по
 * одной, а любая переименованная сцена приезжала бы как «новое красное» —
 * то есть база сообщала бы о ходе переезда, а не о состоянии языка. Три
 * записи по трём правилам гаснут независимо: починили тир А — база сразу
 * скажет «устарела» по нему одному.
 */
export function findings(r) {
  const out = [];
  // Причина должна читаться с экрана, а не быть простынёй на тридцать сцен:
  // полный список всегда лежит в `node tools/plainwords.mjs`.
  const few = (items) =>
    items.length > 8 ? `${items.slice(0, 8).join(', ')} …и ещё ${items.length - 8}` : items.join(', ');
  if (r.tierAScenes.length > 0) {
    out.push({
      kind: 'plainwords',
      id: 'tierA',
      value: r.tierAHits,
      note:
        `тир А (слова ушедшего мира, порог 0): ${r.tierAHits} вхождений в ${r.tierAScenes.length} сценах — ` +
        few(r.tierAScenes.map((s) => s.id)),
    });
  }
  if (r.tierBScenes.length > 0) {
    out.push({
      kind: 'plainwords',
      id: 'tierB',
      value: r.tierBScenes.length,
      note:
        `тир Б сверх нормы max(6, слов/1000×8) в ${r.tierBScenes.length} сценах: ` +
        few(r.tierBScenes.map((s) => `${s.id} ${s.tierB}/${s.limit}`)),
    });
  }
  if (r.perLineHits > 0) {
    out.push({
      kind: 'plainwords',
      id: 'tierBPerLine',
      value: r.perLineHits,
      note:
        `больше 2 слов тира Б в одной реплике, случаев ${r.perLineHits}: ` +
        few(r.perLineScenes.flatMap((s) => s.perLine.map((l) => `${s.id}#${l.where} ${l.count}`))),
    });
  }
  for (const n of r.namesOver) {
    out.push({
      kind: 'plainwords',
      id: `names:${n.power}`,
      value: Number((n.share * 100).toFixed(1)),
      note:
        `словарь силы «${n.power}» занял ${(n.share * 100).toFixed(1)}% имён юнитов ` +
        `(${n.matched} из ${n.total}) при пределе 20%: ${few(n.names)}`,
    });
  }
  return out;
}

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const r = checkPlainwords();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ violations: r.violations, findings: findings(r) }, null, 2));
  } else if (!process.argv.includes('--quiet')) {
    for (const line of report(r)) console.log(line);
  }
  process.exit(r.violations > 0 ? 1 : 0);
}
