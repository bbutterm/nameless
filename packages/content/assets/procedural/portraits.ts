/**
 * portraits.ts — лица «Безымянного». Выполнение канона `docs/PORTRAITS.md`.
 *
 * Портрет — гравюра, а не аватарка: череп с провалами глазниц, штриховка по
 * теневой половине, впалые щёки, ни одной улыбки. Кожа у всех одна, костяная;
 * цвет дома лицо не красит — он живёт в вороте и предмете роли (канон §0).
 *
 * Почему отдельный файл, а не `procedural.ts`: там процедурные ЗАГЛУШКИ (фон,
 * рамка, иконка) — графика, которую не жалко заменить. Лица — контент: их
 * значения писал ведущий по миру, и правятся они по канону, а не по вкусу
 * программиста. Разные причины изменения — разные файлы.
 *
 * Детерминизм (STYLE §7.6): ни `Math.random`, ни `Date.now`, ни счётчиков
 * модуля. Все идентификаторы внутри SVG выводятся хэшем от (id + состояние),
 * поэтому `portraitSvg(id, s) === portraitSvg(id, s)` побайтово при любом
 * порядке вызовов. В прототипе `tools/faces-proto.mjs` был модульный `let UID`
 * — он давал разный SVG на одинаковых аргументах, и это был бы брак.
 *
 * Зависимостей нет намеренно: пакет контента не должен знать про движок, а
 * состояние приходит явным аргументом `PortraitState`, а не целым GameState.
 */

// ---------------------------------------------------------------------------
// Палитра
// ---------------------------------------------------------------------------

/**
 * Значения продублированы из `assets/palette.css` ровно так же, как в
 * `procedural.ts#PALETTE`, и по той же причине: модуль обязан оставаться без
 * импортов, чтобы его можно было запускать хоть в Node, хоть в браузере, хоть
 * в тесте. Новых hex здесь нет: цвета домов — переменные темы, а костяной,
 * чернильный и волосяной тон взяты из утверждённого прототипа.
 */
const P = {
  /** --bg-1: ниша, в которой висит портрет. */
  bg1: '#151219',
  /** Чернила гравюры: тени, глазницы, линии. Тон прототипа. */
  ink: '#0a090b',
  /** Кожа. Единственная на всех — канон §4.8. */
  bone: '#cdc4bb',
  /** Волосы. Тон прототипа. */
  hair: '#1c1820',
  /** --text-dim: седина и сталь. */
  dim: '#9a90a0',
  /** --memory: линия отголоска, единственное исключение из «цвет не красит лицо». */
  memory: '#7fd3d0',
} as const;

/** Дом — это цвет ворота и предмета, не кожи (канон §0). */
export type House = 'accent' | 'steel' | 'danger' | 'memory' | 'lie' | 'faint';

const HOUSE_TONE: Record<House, string> = {
  accent: '#c9a227', // --accent: Учёт и Великий Ломбард
  steel: '#9a90a0', // --text-dim: стража
  danger: '#c1483f', // --danger: Ревизия
  memory: '#7fd3d0', // --memory: Братство и память
  lie: '#b06fd0', // --lie: Цех Жадной Памяти
  faint: '#6b6470', // --text-faint: безымянные
};

// ---------------------------------------------------------------------------
// Словарь черт (канон §1)
// ---------------------------------------------------------------------------

export type HairKind = 'crop' | 'bun' | 'long' | 'bald' | 'kerchief' | 'hood' | 'cap' | 'visor';
export type BeardKind = 'none' | 'stubble' | 'mustache' | 'short' | 'full';
export type CollarKind = 'v' | 'stand' | 'scarf' | 'rag' | 'chain' | 'none';
export type GazeKind = 'down' | 'straight' | 'past' | 'aside';
export type NoseKind = 'straight' | 'blunt' | 'hook' | 'broken' | 'sharp';
export type LipsKind = 'line' | 'pressed' | 'parted';
export type ScarKind = 'none' | 'brow' | 'cheek' | 'lip';
export type PropKind =
  | 'none'
  | 'pince'
  | 'pen_ear'
  | 'whistle'
  | 'jar_cord'
  | 'receipt'
  | 'lot_jar'
  | 'helm_line'
  /** Коромысло Водоноса — предмет отголоска из канона §3.1, не из списка §1.2. */
  | 'yoke';

/** Полный набор черт одного лица. Все шкалы 0..1, кроме `mouth` и `tilt`. */
export interface Face {
  house: House;
  /** 0 узкая челюсть … 1 тяжёлая. */
  jaw: number;
  /** 0 ровная щека … 1 впалая. */
  cheek: number;
  /** 0 лёгкое надбровье … 1 нависшее. */
  brow: number;
  /** 0 короткое лицо … 1 длинное. */
  long: number;
  /** 0 ребёнок … 1 глубокая старость. Здесь возраст = стаж. */
  age: number;
  /** Перекос. У живых не бывает ниже 0.1 — нулевая симметрия нечеловечна. */
  asym: number;
  /** Выцветание: 0 полный контраст … 1 человека почти нет. */
  fade: number;
  /** Осанка: 0 свисшие узкие плечи … 1 прямые широкие. */
  shoulders: number;
  /** Тяжесть век: 0 распахнут … 1 щель. */
  lid: number;
  /** Чернота глазниц: 0 живой глаз с бликом … 1 провал. */
  socket: number;
  /** Борозды: 0 гладко … 1 лицо расчерчено. */
  furrows: number;
  /** Брыли. */
  jowl: number;
  /** Изгиб рта −4 вниз … +4 вверх. Выше +4 улыбки нет и не будет. */
  mouth: number;
  /** Ширина рта: 0 узел … 1 прорезь во всю челюсть. */
  mouthW: number;
  /** Наклон головы −1..+1. */
  tilt: number;
  /** Насколько торчат уши. */
  ears: number;
  hair: HairKind;
  beard: BeardKind;
  collar: CollarKind;
  gaze: GazeKind;
  nose: NoseKind;
  lips: LipsKind;
  scar: ScarKind;
  prop: PropKind;
  /** Лучики у глаз вместо носогубных складок — оговорка канона §1.2 для Прощая. */
  furrowsAtEyes: boolean;
  /** Склянка полна (Жичка) или пуста (Голос из трухи) — канон §2.8. */
  propFull: boolean;
  /** Отголосок: контур разомкнут, глаз нет, линия цвета памяти (канон §3.1). */
  echo: boolean;
}

/**
 * Умолчания канона §2: «Не названные параметры — по умолчанию (0.5, none, 0)».
 * Отступление одно и осознанное: `socket` по умолчанию 0.35, а не 0.5 —
 * половина шкалы черноты глазниц у всего реестра сразу читается как «мертвецы»
 * и съедает `socket` как черту Ревизора. Лица, которым провал положен, задают
 * его явно.
 */
const DEFAULTS: Omit<Face, 'house'> = {
  jaw: 0.5,
  cheek: 0.5,
  brow: 0.5,
  long: 0.5,
  age: 0.5,
  asym: 0.15,
  fade: 0,
  shoulders: 0.5,
  lid: 0.5,
  socket: 0.35,
  furrows: 0,
  jowl: 0,
  mouth: 0,
  mouthW: 0.5,
  tilt: 0,
  ears: 0.3,
  hair: 'crop',
  beard: 'none',
  collar: 'v',
  gaze: 'straight',
  nose: 'straight',
  lips: 'line',
  scar: 'none',
  prop: 'none',
  furrowsAtEyes: false,
  propFull: false,
  echo: false,
};

type FaceSpec = Partial<Face> & { house: House };

function makeFace(spec: FaceSpec): Face {
  return { ...DEFAULTS, ...spec };
}

// ---------------------------------------------------------------------------
// Состояние игры, от которого зависят лица
// ---------------------------------------------------------------------------

/**
 * Явный, маленький срез состояния — не `GameState`. Пакет контента не знает
 * про движок, а функция обязана оставаться чистой: всё, что может изменить
 * рисунок, приходит сюда аргументом и ничем больше.
 */
export interface PortraitState {
  /** Сколько раз игрок умирал. Двигает серость игрока и сид мертвеца. */
  readonly deaths?: number;
  /** Игрок на краю оси отпускания — серость идёт вдвое медленнее (канон §7.2). */
  readonly releaseEdge?: boolean;
  /** Номер главы: по нему Клёста становится больше. */
  readonly chapter?: number;
  /** Стадия Ревизора = уровень тайны. Не задана — выводится из главы. */
  readonly revizorStage?: 1 | 2 | 3;
}

/** Серость игрока: единственный видимый счётчик прогресса (канон §2.2). */
export function playerFade(state: PortraitState): number {
  const deaths = Math.max(0, Math.floor(state.deaths ?? 0));
  const step = state.releaseEdge === true ? 0.025 : 0.05;
  return Math.min(0.8, 0.15 + step * deaths);
}

/** Клёст выцвел не до конца потому, что игрок его помнит (канон §2.4). */
function klyostFade(state: PortraitState): number {
  const chapter = state.chapter ?? 1;
  if (chapter >= 3) return 0.1;
  if (chapter === 2) return 0.25;
  return 0.45;
}

/**
 * Стадия Ревизора. Владелец может задать её явно; пока такого решения нет,
 * она идёт за главой — «уровень тайны» растёт вместе с сюжетом.
 */
function revizorStage(state: PortraitState): 1 | 2 | 3 {
  if (state.revizorStage !== undefined) return state.revizorStage;
  const chapter = state.chapter ?? 1;
  return chapter >= 3 ? 3 : chapter === 2 ? 2 : 1;
}

/**
 * Заготовка канона §8: в финале параметры Ревизора сдвигаются к параметрам
 * игрока при `fade 0` («лицо игрока до серости»). Включается решением
 * владельца, не программиста, — до тех пор третья стадия просто третья
 * ступень человечности.
 */
const REVIZOR_FINAL_IS_PLAYER = false;

// ---------------------------------------------------------------------------
// Таблица лиц (канон §2 и §3.1)
// ---------------------------------------------------------------------------

/**
 * Двадцать одно говорящее лицо. Значения — из канона; где канон даёт прозу,
 * число выбрано здесь и описано в комментарии. Отклонения от канонных цифр
 * помечены явно: канон разрешает ±0.1, пока держится графа «чем не сосед».
 */
const FACES: Record<string, FaceSpec> = {
  // ── Великий Ломбард и Учёт ────────────────────────────────────────────────

  /** Осока: молодая, но веки не по возрасту — смену на границе никто не сменяет. */
  osoka: {
    house: 'accent',
    jaw: 0.2, cheek: 0.5, brow: 0.35, long: 0.55, age: 0.3,
    hair: 'bun', beard: 'none', collar: 'stand',
    // Канон даёт .65; поднято до .75 (в пределах ±0.1) — иначе на 44px Осока и
    // младший оценщик отличались одной позицией из пяти: оба «стойка без
    // предмета, лицо голое», и разводил их только убор.
    shoulders: 0.75,
    lid: 0.6, gaze: 'past', socket: 0.2, nose: 'sharp',
    mouth: 1, mouthW: 0.35, lips: 'line', furrows: 0.2, asym: 0.2,
  },

  /** Тминный: двадцать лет первого яруса висят на лице. */
  tminny: {
    house: 'accent',
    jaw: 0.55, cheek: 0.6, brow: 0.6, long: 0.7, age: 0.75,
    hair: 'crop', beard: 'short', collar: 'stand', shoulders: 0.45,
    lid: 0.5, gaze: 'aside', nose: 'blunt',
    mouth: 0, mouthW: 0.6, lips: 'pressed', furrows: 0.6, asym: 0.3,
    jowl: 0.55, prop: 'pince',
  },

  /** Младший оценщик: ещё быстрый, ещё не насмотрелся. */
  otsenshchik: {
    house: 'accent',
    jaw: 0.4, cheek: 0.55, brow: 0.45, long: 0.5, age: 0.35,
    hair: 'cap', beard: 'none', collar: 'stand',
    // Канон даёт .5; опущено до .4 — см. комментарий у Осоки, пара разводится
    // осанкой, потому что больше в первой группе разводить нечем.
    shoulders: 0.4,
    lid: 0.25, gaze: 'down', nose: 'straight',
    mouth: 0, mouthW: 0.5, lips: 'line', furrows: 0.25, asym: 0.25,
  },

  /** Писарь читальни: двадцать лет над графой согнули плечи и высушили лицо. */
  pisar_chitalni: {
    house: 'accent',
    jaw: 0.3, cheek: 0.6, brow: 0.4, long: 0.7, age: 0.55,
    hair: 'bald', beard: 'none', collar: 'stand', shoulders: 0.2,
    lid: 0.7, gaze: 'down', nose: 'sharp',
    mouth: -1, mouthW: 0.4, lips: 'line', furrows: 0.5, asym: 0.35,
    prop: 'pen_ear',
  },

  /** Сторож архива: ночная служба, считает и во сне. */
  storozh_arkhiva: {
    house: 'accent',
    jaw: 0.6, cheek: 0.3, brow: 0.5, long: 0.35, age: 0.65,
    hair: 'crop', beard: 'stubble', collar: 'scarf', shoulders: 0.35,
    lid: 0.55, gaze: 'past', nose: 'blunt',
    mouth: 0, mouthW: 0.45, lips: 'parted', furrows: 0.45, asym: 0.4,
  },

  /** Клёст: единственный ребёнок реестра. `fade` подставляется по главе. */
  klyost: {
    house: 'accent',
    jaw: 0.05, cheek: 0.35, brow: 0.15, long: 0.3, age: 0.08,
    hair: 'crop', beard: 'none', collar: 'v', shoulders: 0.15,
    lid: 0.1, gaze: 'straight', socket: 0, nose: 'blunt',
    mouth: 3, mouthW: 0.5, lips: 'line', furrows: 0, asym: 0.3,
    prop: 'whistle', ears: 0.75,
  },

  // ── Стража ────────────────────────────────────────────────────────────────

  /** Дратва: чин здесь равен праву на лицо, и лицо у неё есть. */
  dratva: {
    house: 'steel',
    jaw: 0.95, cheek: 0.2, brow: 0.8, long: 0.3, age: 0.55,
    hair: 'crop', beard: 'none', collar: 'stand', shoulders: 0.9,
    lid: 0.5, gaze: 'straight', socket: 0.3, nose: 'broken',
    mouth: -1, mouthW: 0.55, lips: 'pressed', furrows: 0.5, asym: 0.35,
    scar: 'brow', prop: 'helm_line',
  },

  /** Стражник: бланк двенадцать-бис. Забрало опущено, от человека — подбородок. */
  strazhnik: {
    house: 'steel',
    jaw: 0.7, cheek: 0.4, brow: 0.5, long: 0.45, age: 0.4,
    hair: 'visor', beard: 'stubble', collar: 'stand', shoulders: 0.8,
    gaze: 'straight', mouth: -1, mouthW: 0.5, lips: 'line', asym: 0.2,
  },

  /** Меловщик: человек, который оставляет знак до того, как решится назвать себя. */
  chalk_marker: {
    house: 'steel',
    jaw: 0.35, cheek: 0.55, brow: 0.35, long: 0.6, age: 0.3,
    hair: 'kerchief', beard: 'none', collar: 'rag', shoulders: 0.35,
    lid: 0.35, gaze: 'aside', nose: 'straight',
    mouth: 0, mouthW: 0.45, lips: 'line', furrows: 0.2, asym: 0.3,
    prop: 'chalk',
  },

  // ── Ревизия ───────────────────────────────────────────────────────────────

  /** Ревизор: погрешность, отросшая до фигуры. Стадии — в `stageOf`. */
  revizor: {
    house: 'danger',
    jaw: 0.95, cheek: 0.35, brow: 0.95, long: 0.35, age: 0.6,
    hair: 'bald', beard: 'none', collar: 'stand', shoulders: 0.7,
    lid: 0.3, gaze: 'past', socket: 0.7, nose: 'straight',
    mouth: -2, mouthW: 0.5, lips: 'line', furrows: 0, asym: 0,
  },

  /** Сводчик: человек на нечеловеческой службе, тот самый неотпечатанный бланк. */
  svodchik: {
    house: 'danger',
    jaw: 0.3, cheek: 0.65, brow: 0.5, long: 0.65, age: 0.45,
    hair: 'crop', beard: 'none', collar: 'stand', shoulders: 0.25,
    lid: 0.2, gaze: 'down', nose: 'sharp',
    mouth: -1, mouthW: 0.3, lips: 'pressed', furrows: 0.35, asym: 0.4,
    prop: 'pen_ear',
  },

  /** Старший наряда: служака при новой власти. */
  naryad_revizii: {
    house: 'danger',
    jaw: 0.8, cheek: 0.35, brow: 0.7, long: 0.4, age: 0.5,
    hair: 'cap', beard: 'mustache', collar: 'stand', shoulders: 0.85,
    lid: 0.6, gaze: 'straight', nose: 'blunt',
    mouth: -2, mouthW: 0.6, lips: 'line', furrows: 0.4, asym: 0.25,
  },

  // ── Братство Чистой Головы ────────────────────────────────────────────────

  /** Брат Прощай: единственная полная борода реестра и единственные лучики. */
  proshchai: {
    house: 'memory',
    jaw: 0.6, cheek: 0.4, brow: 0.25, long: 0.5, age: 0.8,
    hair: 'bald', beard: 'full', collar: 'scarf', shoulders: 0.55,
    lid: 0.45, gaze: 'straight', socket: 0, nose: 'blunt',
    mouth: 4, mouthW: 0.6, lips: 'line', furrows: 0.7, furrowsAtEyes: true,
    asym: 0.45, jowl: 0.4,
  },

  /** Брат-огородник: борозды не от горя — от прищура на грядке. */
  brat_ogorodnik: {
    house: 'memory',
    jaw: 0.7, cheek: 0.7, brow: 0.6, long: 0.6, age: 0.5,
    hair: 'kerchief', beard: 'stubble', collar: 'none', shoulders: 0.7,
    lid: 0.4, gaze: 'down', nose: 'straight',
    mouth: -1, mouthW: 0.4, lips: 'pressed', furrows: 0.55, asym: 0.3,
  },

  /** Голос из трухи: живая женщина, у которой кончается вещество памяти. */
  golos_iz_trukhi: {
    house: 'memory',
    jaw: 0.3, cheek: 0.9, brow: 0.4, long: 0.65, age: 0.6,
    hair: 'kerchief', beard: 'none', collar: 'chain', shoulders: 0.2,
    lid: 0.4, gaze: 'straight', nose: 'straight',
    mouth: -1, mouthW: 0.4, lips: 'parted', furrows: 0.5, asym: 0.35,
    fade: 0.7, prop: 'jar_cord', propFull: false,
  },

  // ── Цех Жадной Памяти ─────────────────────────────────────────────────────

  /** Жичка: самое асимметричное лицо реестра — чужие интонации ведут рот вбок. */
  zhichka: {
    house: 'lie',
    jaw: 0.3, cheek: 0.85, brow: 0.5, long: 0.6, age: 0.4,
    hair: 'kerchief', beard: 'none', collar: 'chain', shoulders: 0.4,
    lid: 0.35, gaze: 'aside', nose: 'sharp',
    mouth: 0, mouthW: 0.55, lips: 'line', furrows: 0.3, asym: 0.6,
    prop: 'jar_cord', propFull: true,
  },

  /** Мародёр с весами: человек, чья работа — ждать. */
  marodyor: {
    house: 'lie',
    jaw: 0.65, cheek: 0.6, brow: 0.55, long: 0.45, age: 0.5,
    hair: 'cap', beard: 'stubble', collar: 'rag', shoulders: 0.6,
    lid: 0.75, gaze: 'down', nose: 'broken',
    mouth: -2, mouthW: 0.5, lips: 'line', furrows: 0.4, asym: 0.4,
    scar: 'cheek',
  },

  // ── Безымянные ────────────────────────────────────────────────────────────

  /** Игрок: лицо без примет. `fade` подставляется по числу смертей. */
  player: {
    house: 'faint',
    jaw: 0.5, cheek: 0.5, brow: 0.5, long: 0.5, age: 0.5,
    hair: 'crop', beard: 'none', collar: 'v', shoulders: 0.5,
    lid: 0.4, gaze: 'straight', socket: 0.2, nose: 'straight',
    mouth: 0, mouthW: 0.5, lips: 'line', furrows: 0.15, asym: 0.12,
  },

  /** Попрошайка: не нищий, а вкладчик, и держится за это лицом. */
  poproshayka: {
    house: 'faint',
    jaw: 0.4, cheek: 1, brow: 0.45, long: 0.75, age: 0.7,
    hair: 'long', beard: 'full', collar: 'rag', shoulders: 0.1,
    lid: 0.5, gaze: 'down', socket: 0.4, nose: 'sharp',
    mouth: -3, mouthW: 0.35, lips: 'line', furrows: 0.8, asym: 0.35,
    fade: 0.45, prop: 'receipt',
  },

  // ── Сторонь: люди мира Б (docs/WORLD_B.md) ────────────────────────────────
  // Дом здесь — сила, а не ведомство: щербатым досталась засохшая кровь
  // упразднённой Ревизии (`danger`), засеке — сталь, Гоньбе и людям дороги —
  // тусклый лиловый (`faint`), Цеху — синяк.

  /** Вдова из Щерби: накрывает на двоих и не знает, для кого второй прибор. */
  vdova_shcherb: {
    house: 'danger',
    jaw: 0.35, cheek: 0.7, brow: 0.4, long: 0.6, age: 0.55,
    hair: 'kerchief', beard: 'none', collar: 'rag', shoulders: 0.3,
    lid: 0.35, gaze: 'past', socket: 0.3, nose: 'straight',
    mouth: -2, mouthW: 0.4, lips: 'parted', furrows: 0.5, asym: 0.3,
  },

  /** Хранитель картотеки: держит папки на людей, которых больше нет. */
  khranitel_kartoteki: {
    house: 'danger',
    jaw: 0.45, cheek: 0.55, brow: 0.65, long: 0.7, age: 0.6,
    hair: 'long', beard: 'short', collar: 'scarf', shoulders: 0.3,
    lid: 0.6, gaze: 'aside', socket: 0.45, nose: 'sharp',
    mouth: 0, mouthW: 0.45, lips: 'pressed', furrows: 0.65, asym: 0.35,
    prop: 'pen_ear',
  },

  /** Ямщик Гоньбы: страну держит сшитой тот, кто возит. */
  yamshchik_gonby: {
    house: 'faint',
    jaw: 0.6, cheek: 0.4, brow: 0.5, long: 0.45, age: 0.45,
    hair: 'cap', beard: 'short', collar: 'scarf', shoulders: 0.65,
    lid: 0.45, gaze: 'straight', socket: 0.25, nose: 'blunt',
    mouth: 0, mouthW: 0.55, lips: 'line', furrows: 0.35, asym: 0.25,
  },

  /** Багорщик с Слузы: тянет из воды то, что оплачено. */
  bagorshchik_sluzy: {
    house: 'faint',
    jaw: 0.75, cheek: 0.35, brow: 0.6, long: 0.4, age: 0.5,
    hair: 'crop', beard: 'full', collar: 'rag', shoulders: 0.8,
    lid: 0.4, gaze: 'aside', socket: 0.3, nose: 'broken',
    mouth: -1, mouthW: 0.6, lips: 'pressed', furrows: 0.4, asym: 0.4,
    scar: 'brow',
  },

  /** Паромщица: перевозит и считает — на том берегу всегда на одного меньше. */
  paromshchitsa: {
    house: 'faint',
    jaw: 0.45, cheek: 0.5, brow: 0.45, long: 0.5, age: 0.5,
    hair: 'kerchief', beard: 'none', collar: 'scarf', shoulders: 0.55,
    lid: 0.3, gaze: 'straight', socket: 0.25, nose: 'straight',
    mouth: 0, mouthW: 0.5, lips: 'line', furrows: 0.3, asym: 0.2,
  },

  /** Сержант заставы: окликает идущих из степи по имени. */
  serzhant_zastavy: {
    house: 'steel',
    jaw: 0.7, cheek: 0.45, brow: 0.7, long: 0.5, age: 0.6,
    hair: 'cap', beard: 'full', collar: 'scarf', shoulders: 0.85,
    lid: 0.5, gaze: 'past', socket: 0.35, nose: 'blunt',
    mouth: -1, mouthW: 0.55, lips: 'pressed', furrows: 0.55, asym: 0.3,
  },

  /** Мать-шептунья: знает, как позвать того, кто заберёт невыносимое. */
  mat_sheptunya: {
    house: 'faint',
    jaw: 0.35, cheek: 0.75, brow: 0.4, long: 0.65, age: 0.65,
    hair: 'long', beard: 'none', collar: 'scarf', shoulders: 0.25,
    lid: 0.7, gaze: 'down', socket: 0.4, nose: 'sharp',
    mouth: -1, mouthW: 0.35, lips: 'parted', furrows: 0.7, asym: 0.35,
  },

  /** Марья из Щерби: накрывает на двоих и не знает, для кого второй прибор. */
  marya: {
    house: 'faint',
    jaw: 0.4, cheek: 0.65, brow: 0.35, long: 0.55, age: 0.45,
    hair: 'bun', beard: 'none', collar: 'rag', shoulders: 0.4,
    lid: 0.3, gaze: 'aside', socket: 0.25, nose: 'straight',
    mouth: -2, mouthW: 0.45, lips: 'pressed', furrows: 0.45, asym: 0.25,
  },

  /** Староста: считает по знакомым лицам и всякий раз выходит на одного больше. */
  starosta: {
    house: 'faint',
    jaw: 0.65, cheek: 0.4, brow: 0.6, long: 0.45, age: 0.7,
    hair: 'bald', beard: 'full', collar: 'v', shoulders: 0.6,
    lid: 0.5, gaze: 'past', socket: 0.3, nose: 'blunt',
    mouth: -1, mouthW: 0.55, lips: 'line', furrows: 0.6, asym: 0.3,
    jowl: 0.5,
  },

  /** Скупщик Цеха: в голове шесть чужих жизней, склянка при себе полная. */
  skupshchik_tsekha: {
    house: 'lie',
    jaw: 0.5, cheek: 0.45, brow: 0.55, long: 0.55, age: 0.55,
    hair: 'bald', beard: 'mustache', collar: 'chain', shoulders: 0.5,
    lid: 0.55, gaze: 'aside', socket: 0.35, nose: 'hook',
    mouth: 1, mouthW: 0.5, lips: 'line', furrows: 0.4, asym: 0.3,
    prop: 'lot_jar', propFull: true,
  },

  /**
   * Гладень: примет нет — в этом вся примета. Никакой шкалы на краю, ворот
   * дорожного сюртука застёгнут, лицо запоминается ровно настолько, чтобы
   * потом никто не смог его описать (мир Б, B.6 и запрет I.8: он — сапоги,
   * крошки и просьба воды, а не «тьма»). Веки чуть тяжелее людских, взгляд
   * прямой: он слушает лучше всех, кого ты знал.
   */
  gladen: {
    house: 'faint',
    jaw: 0.5, cheek: 0.5, brow: 0.5, long: 0.5, age: 0.5,
    hair: 'crop', beard: 'short', collar: 'stand', shoulders: 0.5,
    lid: 0.55, gaze: 'straight', socket: 0.3, nose: 'straight',
    mouth: 0, mouthW: 0.5, lips: 'line', furrows: 0.2, asym: 0.1,
  },
};

/** Отголоски (канон §3.1). Лица нужны, но людьми их рисовать нельзя. */
const ECHO_FACES: Record<string, FaceSpec> = {
  /** Гарь: высокий узкий череп, разрывы гуще к макушке, предмета нет. */
  gar: {
    house: 'memory', echo: true,
    long: 1, jaw: 0.3, cheek: 0.6, brow: 0.6, age: 0.5,
    // Плечи есть, но пустые: Гарь — высокий столб, а не сутулый писец. Вместе
    // с выцветанием это даёт вторую и третью позицию различия со Свидетелем,
    // которых требует §1.3: до правки они расходились только предметом.
    hair: 'bald', shoulders: 0.8, fade: 0.9, mouth: -1, mouthW: 0.45,
  },
  /** Водонос: широкие плечи и линия коромысла поперёк них. */
  vodonos: {
    house: 'memory', echo: true,
    long: 0.45, jaw: 0.7, cheek: 0.5, brow: 0.5, age: 0.45,
    hair: 'crop', beard: 'stubble', shoulders: 0.9, mouth: 0, mouthW: 0.5,
    prop: 'yoke',
  },
  /** Посул: двойник на предъявителя — лицо игрока по правилу отголоска. */
  posul: {
    house: 'memory', echo: true,
    jaw: 0.5, cheek: 0.5, brow: 0.5, long: 0.5, age: 0.5,
    hair: 'crop', shoulders: 0.5, mouth: 0, mouthW: 0.5, asym: 0.12,
  },
  /** Свидетель: голова наклонена к бумаге, предмет — перо. */
  svidetel: {
    house: 'memory', echo: true,
    long: 0.55, jaw: 0.45, cheek: 0.55, brow: 0.45, age: 0.55,
    // Свидетель держится в мире крепче прочих отголосков: он записывает, а
    // записанное не выцветает так быстро. Отсюда выцветание ниже.
    hair: 'bald', shoulders: 0.15, fade: 0.68, tilt: -1, gaze: 'down',
    mouth: -1, mouthW: 0.4, prop: 'pen_ear',
  },
};

/** Все id, у которых есть лицо. `narrator` сюда не входит и не войдёт. */
export const PORTRAIT_IDS: readonly string[] = [
  ...Object.keys(FACES),
  'mertvyy_v_ocheredi',
  'ochered',
  ...Object.keys(ECHO_FACES),
];

export const ECHO_IDS: readonly string[] = Object.keys(ECHO_FACES);

/** Дом лица — по нему тест ищет соседей. */
export function houseOf(id: string): House | undefined {
  return (FACES[id] ?? ECHO_FACES[id])?.house;
}

// ---------------------------------------------------------------------------
// Мертвец в очереди: детерминированно от номера смерти
// ---------------------------------------------------------------------------

/** FNV-1a, тот же, что в `procedural.ts`. Детерминированный, без Math.random. */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], r: number): T {
  const i = Math.min(arr.length - 1, Math.floor(r * arr.length));
  return arr[i] as T;
}

/**
 * Каждую смерть в очереди стоит другой человек — и всегда один и тот же страх.
 * Разыгрывается только внешность; константы роли заданы каноном §2.9 и не
 * трогаются: `fade 0` (смерть берёт память, а не плоть — мёртвый выглядит
 * живее уличных живых), распахнутые глаза, приоткрытый рот, лот в руках.
 */
function deadInQueue(state: PortraitState): FaceSpec {
  const rnd = mulberry32(hash32(`dead:${Math.max(0, Math.floor(state.deaths ?? 0))}`));
  const r = Array.from({ length: 10 }, rnd);
  return {
    house: 'faint',
    age: 0.3 + (r[0] ?? 0) * 0.5,
    jaw: 0.2 + (r[1] ?? 0) * 0.6,
    cheek: 0.25 + (r[2] ?? 0) * 0.5,
    long: 0.3 + (r[3] ?? 0) * 0.5,
    brow: 0.3 + (r[4] ?? 0) * 0.4,
    nose: pick(['straight', 'blunt', 'hook', 'broken', 'sharp'] as const, r[5] ?? 0),
    hair: pick(['crop', 'bald', 'long', 'kerchief', 'cap'] as const, r[6] ?? 0),
    beard: pick(['none', 'stubble', 'mustache', 'short', 'full'] as const, r[7] ?? 0),
    // Ворот — по прежней жизни: кем он был до очереди, тем и одет.
    collar: pick(['v', 'stand', 'scarf', 'rag', 'none'] as const, r[8] ?? 0),
    asym: 0.15 + (r[9] ?? 0) * 0.3,
    furrows: 0.2 + (r[0] ?? 0) * 0.4,
    fade: 0,
    socket: 0,
    lid: 0.15,
    gaze: 'straight',
    lips: 'parted',
    mouth: -1,
    mouthW: 0.5,
    shoulders: 0.3,
    prop: 'lot_jar',
  };
}

// ---------------------------------------------------------------------------
// Разрешение лица от id и состояния
// ---------------------------------------------------------------------------

/**
 * Лицо по id и состоянию игры. Чистая функция: одинаковые аргументы — один и
 * тот же объект по значению. `narrator` и незнакомые id лица не получают.
 */
export function resolveFace(id: string, state: PortraitState = {}): Face | undefined {
  if (id === 'narrator' || id === 'ochered') return undefined; // особые случаи, см. portraitSvg
  if (id === 'mertvyy_v_ocheredi') return makeFace(deadInQueue(state));

  const echo = ECHO_FACES[id];
  if (echo !== undefined) {
    // Посул — двойник на предъявителя: лицо игрока при его текущей серости,
    // но по правилу отголоска. Игрок узнаёт себя в заднем ряду.
    if (id === 'posul') {
      const player = FACES['player'];
      if (player === undefined) return makeFace(echo);
      return makeFace({ ...player, ...echo, fade: playerFade(state) });
    }
    return makeFace(echo);
  }

  const base = FACES[id];
  if (base === undefined) return undefined;

  if (id === 'player') return makeFace({ ...base, fade: playerFade(state) });
  if (id === 'klyost') return makeFace({ ...base, fade: klyostFade(state) });
  if (id === 'revizor') {
    const stage = revizorStage(state);
    // Стадия 1 — лицо слишком правильное: у живых asym 0 не бывает, и годов не
    // было, потому что не было биографии. Дальше у функции отрастает мнение —
    // у лица отрастает жизнь.
    if (stage === 1) return makeFace(base);
    if (stage === 2) return makeFace({ ...base, asym: 0.15, furrows: 0.3, socket: 0.3 });
    if (REVIZOR_FINAL_IS_PLAYER) {
      const player = FACES['player'];
      if (player !== undefined) return makeFace({ ...player, house: 'danger', fade: 0 });
    }
    return makeFace({ ...base, asym: 0.35, furrows: 0.5, socket: 0.1 });
  }
  return makeFace(base);
}

// ---------------------------------------------------------------------------
// Проверка «читается на 44px» (канон §1.3)
// ---------------------------------------------------------------------------

/**
 * Первая группа: то, что живёт в ленте на 44px. Возвращается пятёркой значений,
 * потому что сравнивать соседей по дому надо именно по ней — на 44px остального
 * попросту не видно.
 */
export interface FirstGroup {
  hair: HairKind;
  beard: BeardKind;
  /** Ворот и предмет — одна позиция: оба говорят «кто человека одевает». */
  collarProp: string;
  shoulders: number;
  fade: number;
}

export function firstGroup(face: Face): FirstGroup {
  return {
    hair: face.hair,
    beard: face.beard,
    collarProp: `${face.collar}/${face.prop}`,
    shoulders: face.shoulders,
    fade: face.fade,
  };
}

/** Осанка ниже этого порога на 44px читается как одна и та же осанка. */
const SHOULDERS_STEP = 0.25;
/** «Уже 0.15 заметно рядом с нулём» — канон §1.2. */
const FADE_STEP = 0.15;

/**
 * Сколько позиций первой группы различают два лица. Канон §1.3 требует ≥2 у
 * соседей по дому. Числовые шкалы считаются различающимися только за порогом:
 * разница в 0.05 осанки на 44px — это не различие, а самообман.
 */
export function readableDiff(a: Face, b: Face): string[] {
  const fa = firstGroup(a);
  const fb = firstGroup(b);
  const out: string[] = [];
  if (fa.hair !== fb.hair) out.push('hair');
  if (fa.beard !== fb.beard) out.push('beard');
  if (fa.collarProp !== fb.collarProp) out.push('collar+prop');
  if (Math.abs(fa.shoulders - fb.shoulders) >= SHOULDERS_STEP - 1e-9) out.push('shoulders');
  if (Math.abs(fa.fade - fb.fade) >= FADE_STEP - 1e-9) out.push('fade');
  return out;
}

/**
 * Различие отголосков канон §3.1 строит иначе — «предметом и пропорцией»:
 * у следа одного дня нет ни причёски, ни бороды, ни ворота, и требовать от
 * него две позиции людской первой группы значит требовать украшений.
 */
export function echoDiff(a: Face, b: Face): string[] {
  const out: string[] = [];
  if (a.prop !== b.prop) out.push('prop');
  if (Math.abs(a.long - b.long) >= SHOULDERS_STEP - 1e-9) out.push('long');
  if (Math.abs(a.jaw - b.jaw) >= SHOULDERS_STEP - 1e-9) out.push('jaw');
  if (Math.abs(a.shoulders - b.shoulders) >= SHOULDERS_STEP - 1e-9) out.push('shoulders');
  return out;
}

/**
 * Шкалы формы. Только по ним считается правило §4.4 «не больше двух параметров
 * на краях»: канон применяет его к форме, а не к стажу — иначе его собственный
 * Клёст (`age .08`, `lid .1`, `socket 0`, `furrows 0`) оказался бы шаржем,
 * хотя он ровно то, чем должен быть, — ребёнок.
 */
export const SHAPE_SCALES = ['jaw', 'cheek', 'brow', 'long', 'shoulders', 'mouthW', 'jowl'] as const;

export function edgeScales(face: Face): string[] {
  return SHAPE_SCALES.filter((k) => {
    const v = face[k];
    return v <= 0.1 || v >= 0.9;
  });
}

// ---------------------------------------------------------------------------
// Рисунок
// ---------------------------------------------------------------------------

const W = 160;
const H = 160;
const CX = 80;

function num(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

interface Geom {
  top: number;
  chin: number;
  wL: number;
  wR: number;
  halfW: number;
  eyeY: number;
  noseY: number;
  mouthY: number;
  cheekIn: number;
  crown: number;
  head: string;
}

/**
 * Разметка головы не двигается: глаза 0.42, нос 0.66, рот 0.82 высоты лица.
 * Двигается форма — это то, что делает двадцать пять лиц одной гравюрой, а не
 * двадцатью пятью стилями. Единственное исключение — детская пропорция Клёста
 * (канон §4.4): глаза садятся ниже по черепу, свод круче.
 */
function geometry(f: Face): Geom {
  const top = 34 - f.long * 14;
  const chin = 112 + f.long * 18;
  const halfW = 23 + f.jaw * 15;
  const cheekIn = 4 + f.cheek * 8;
  // Детскость считается от возраста, а не отдельным флагом: ребёнок в реестре
  // один, и лишний ключ в таблице означал бы, что их может быть больше.
  const child = clamp01((0.15 - f.age) / 0.15);
  const eyeY = top + (chin - top) * (0.42 + child * 0.06);
  const noseY = top + (chin - top) * 0.66;
  const mouthY = top + (chin - top) * 0.82;
  const wL = halfW * (1 - f.asym * 0.11);
  const wR = halfW * (1 + f.asym * 0.11);
  // Свод: у ребёнка шире и круглее, у взрослого повторяет ширину скул.
  const crown = 1 + child * 0.2;
  const head = `M ${num(CX - wL)} ${num(eyeY - 6)}
    C ${num(CX - wL * crown)} ${num(top + 4)}, ${num(CX - wL * 0.55 * crown)} ${num(top - 6)}, ${num(CX)} ${num(top - 6)}
    C ${num(CX + wR * 0.55 * crown)} ${num(top - 6)}, ${num(CX + wR * crown)} ${num(top + 4)}, ${num(CX + wR)} ${num(eyeY - 6)}
    C ${num(CX + wR)} ${num(eyeY + 10)}, ${num(CX + wR - cheekIn)} ${num(noseY + 4)}, ${num(CX + wR * 0.62)} ${num(mouthY + 4)}
    C ${num(CX + wR * 0.44)} ${num(chin - 2)}, ${num(CX + 10)} ${num(chin + 4)}, ${num(CX)} ${num(chin + 4)}
    C ${num(CX - 10)} ${num(chin + 4)}, ${num(CX - wL * 0.44)} ${num(chin - 2)}, ${num(CX - wL * 0.62)} ${num(mouthY + 4)}
    C ${num(CX - wL + cheekIn)} ${num(noseY + 4)}, ${num(CX - wL)} ${num(eyeY + 10)}, ${num(CX - wL)} ${num(eyeY - 6)} Z`;
  return { top, chin, wL, wR, halfW, eyeY, noseY, mouthY, cheekIn, crown, head };
}

/** Плечи. На 44px это единственная черта ниже подбородка, которую видно. */
function shouldersPath(f: Face, g: Geom, fill: string): string {
  const span = 34 + f.shoulders * 30;
  // Свисшие плечи падают круто (контрольная точка ниже), прямые расходятся вбок.
  const drop = 6 + (1 - f.shoulders) * 18;
  return `<path d="M ${num(CX - span)} ${H} C ${num(CX - span + 6)} ${num(g.chin + drop)}, ${num(CX - 20)} ${num(g.chin + 2)}, ${CX} ${num(g.chin + 2)}
    C ${num(CX + 20)} ${num(g.chin + 2)}, ${num(CX + span - 6)} ${num(g.chin + drop)}, ${num(CX + span)} ${H} Z" fill="${fill}"/>`;
}

/** Ворот — главный носитель цвета дома: говорит, кто человека одевает. */
function collarPath(f: Face, g: Geom, hue: string): string {
  const y = g.chin + 3;
  switch (f.collar) {
    case 'v':
      return `<path d="M ${num(CX - 13)} ${num(y)} L ${CX} ${num(y + 14)} L ${num(CX + 13)} ${num(y)}" stroke="${hue}" stroke-width="2.4" fill="none" opacity="0.8"/>`;
    case 'stand':
      // Казённая стойка: два отворота вверх и кант по краю.
      return `<path d="M ${num(CX - 17)} ${num(y + 15)} L ${num(CX - 13)} ${num(y - 2)} L ${num(CX + 13)} ${num(y - 2)} L ${num(CX + 17)} ${num(y + 15)}" stroke="${hue}" stroke-width="2.4" fill="none" opacity="0.85"/>
        <path d="M ${num(CX - 11)} ${num(y + 4)} L ${CX} ${num(y + 11)} L ${num(CX + 11)} ${num(y + 4)}" stroke="${hue}" stroke-width="1.2" fill="none" opacity="0.45"/>`;
    case 'scarf':
      // Платок: одна толстая дуга и узел сбоку — силуэт, а не складки.
      return `<path d="M ${num(CX - 21)} ${num(y + 3)} q 21 12 42 0" stroke="${hue}" stroke-width="5" fill="none" opacity="0.7" stroke-linecap="round"/>
        <path d="M ${num(CX + 13)} ${num(y + 7)} l 7 11 l -6 -2 Z" fill="${hue}" opacity="0.7"/>`;
    case 'rag':
      // Рваньё: ломаная линия. Рабочее оно или нищее — говорит остальное лицо.
      return `<path d="M ${num(CX - 19)} ${num(y + 1)} l 6 9 l 6 -6 l 6 10 l 6 -8 l 6 7" stroke="${hue}" stroke-width="2.2" fill="none" opacity="0.8" stroke-linejoin="miter"/>`;
    case 'chain':
      // Шнурок: сама склянка висит на нём предметом `jar_cord`.
      return `<path d="M ${num(CX - 12)} ${num(y - 1)} L ${CX} ${num(y + 13)} L ${num(CX + 12)} ${num(y - 1)}" stroke="${hue}" stroke-width="1.2" fill="none" opacity="0.85"/>`;
    case 'none':
      return '';
  }
}

/** Глаз. `lid` — усталость, `socket` — сколько в глазах осталось человека. */
function eyePath(f: Face, g: Geom, s: -1 | 1, ink: number): string {
  const w = s < 0 ? g.wL : g.wR;
  const ex = CX + s * (w * 0.46);
  const ey = g.eyeY - 1;
  const socketOp = (0.18 + f.socket * 0.55) * ink;
  const socket = `<ellipse cx="${num(ex)}" cy="${num(ey)}" rx="${num(11 + f.cheek * 2)}" ry="${num(7 + f.brow * 3)}" fill="${P.ink}" opacity="${num(socketOp)}"/>`;

  // Раскрытие века: 0 — распахнут, 1 — щель. Веко тяжелеет и с возрастом.
  const open = 1.1 + (1 - clamp01(f.lid + f.age * 0.15)) * 4.6;
  const lid = `<path d="M ${num(ex - 8)} ${num(ey)} q 8 ${num(-open)} 16 0 q -8 ${num(open + 0.6)} -16 0 Z" fill="${P.ink}" opacity="${num(0.95 * ink)}"/>`;

  // Блик тусклый и маленький: светящийся зрачок делает из человека нежить,
  // а канон §4.3 запрещает светящиеся глаза прямо.
  let gx = 0;
  let gy = 0;
  let glintOp = (1 - f.socket) * 0.5;
  switch (f.gaze) {
    case 'down': gy = 1.8; break;
    case 'straight': break;
    case 'past': gx = s * 1.8; glintOp *= 0.55; break; // не сфокусирован — сквозь
    case 'aside': gx = 2.6; break; // вбок, на вещь, а не на человека
  }
  const glint = glintOp <= 0.05
    ? ''
    : `<circle cx="${num(ex + gx)}" cy="${num(ey + gy)}" r="1.7" fill="${P.bone}" opacity="${num(glintOp * ink)}"/>`;

  const bag = f.age > 0.25
    ? `<path d="M ${num(ex - 8)} ${num(ey + 7)} q 8 ${num(2 + f.age * 3)} 16 0" stroke="${P.ink}" stroke-width="1.4" fill="none" opacity="${num((0.2 + f.age * 0.35) * ink)}"/>`
    : '';

  // Асимметрия: одна бровь выше. Годы вопроса «который вы сегодня под этим именем».
  const lift = s * f.asym * 3;
  const brow = `<path d="M ${num(ex - 11)} ${num(g.eyeY - 8 - f.brow * 4 + lift)} q 11 ${num(-4 - f.brow * 4)} 22 ${num(1 + f.brow)}" stroke="${P.ink}" stroke-width="${num(2.2 + f.brow * 2)}" fill="none" stroke-linecap="round" opacity="${num(0.95 * ink)}"/>`;

  return socket + lid + glint + bag + brow;
}

function nosePath(f: Face, g: Geom): string {
  const bridge = g.eyeY + 6;
  switch (f.nose) {
    case 'straight': return `M ${num(CX - 1)} ${num(bridge)} L ${num(CX - 4)} ${num(g.noseY)} q 4 3 8 0`;
    case 'blunt': return `M ${num(CX - 2)} ${num(bridge)} L ${num(CX - 7)} ${num(g.noseY)} q 7 4 14 0`;
    case 'hook': return `M ${num(CX - 1)} ${num(bridge)} C ${num(CX - 3)} ${num(g.noseY - 8)}, ${num(CX + 3)} ${num(g.noseY - 4)}, ${num(CX + 2)} ${num(g.noseY + 2)} q -5 2 -7 -2`;
    case 'broken': return `M ${num(CX - 1)} ${num(bridge)} L ${num(CX + 3)} ${num(g.noseY - 8)} L ${num(CX - 4)} ${num(g.noseY)} q 5 3 9 -1`;
    case 'sharp': return `M ${CX} ${num(bridge)} L ${num(CX - 2)} ${num(g.noseY + 2)} q 2 1 4 -1`;
  }
}

/**
 * Рот в двух измерениях: `mouthW` — ширина, `mouth` — изгиб. Знак изгиба
 * канонный: минус вниз, плюс вверх; в SVG ось Y растёт вниз, поэтому в
 * контрольную точку идёт `-mouth`.
 */
function mouthPath(f: Face, g: Geom, ink: number): string {
  const mw = 5 + f.mouthW * 11;
  // Перекос рта: у Жички он всегда чуть сдвинут — договаривает чужое.
  const dx = f.asym * 2.5;
  const x0 = CX - mw + dx;
  const y = g.mouthY;
  const c = -f.mouth;
  switch (f.lips) {
    case 'line':
      return `<path d="M ${num(x0)} ${num(y)} q ${num(mw)} ${num(c)} ${num(mw * 2)} 0" stroke="${P.ink}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="${num(0.85 * ink)}"/>`;
    case 'pressed':
      // Сжатая двойная — пауза перед цифрой.
      return `<path d="M ${num(x0)} ${num(y)} q ${num(mw)} ${num(c)} ${num(mw * 2)} 0" stroke="${P.ink}" stroke-width="2.8" fill="none" stroke-linecap="round" opacity="${num(0.9 * ink)}"/>
        <path d="M ${num(x0 + 2)} ${num(y - 3.6)} q ${num(mw - 2)} ${num(c * 0.6)} ${num((mw - 2) * 2)} 0" stroke="${P.ink}" stroke-width="1" fill="none" opacity="${num(0.4 * ink)}"/>`;
    case 'parted':
      // Приоткрытая тёмная щель. Зубов нет ни у кого и никогда (канон §4.1).
      return `<path d="M ${num(x0)} ${num(y - 1)} q ${num(mw)} ${num(c - 1)} ${num(mw * 2)} 0 q ${num(-mw)} 5.5 ${num(-mw * 2)} 0 Z" fill="${P.ink}" opacity="${num(0.95 * ink)}"/>
        <path d="M ${num(x0)} ${num(y - 1)} q ${num(mw)} ${num(c - 1)} ${num(mw * 2)} 0" stroke="${P.bone}" stroke-width="1" fill="none" opacity="${num(0.25 * ink)}"/>`;
  }
}

/** Волосы. Возвращают разметку заданным тоном, чтобы седину класть вторым слоем. */
function hairPath(f: Face, g: Geom, fill: string, hue: string): string {
  const { wL, wR, top, eyeY, chin } = g;
  switch (f.hair) {
    case 'bald':
      return '';
    case 'crop':
      return `<path d="M ${num(CX - wL - 2)} ${num(eyeY - 4)} C ${num(CX - wL - 3)} ${num(top - 6)}, ${num(CX + wR + 3)} ${num(top - 6)}, ${num(CX + wR + 2)} ${num(eyeY - 4)}
        C ${num(CX + wR * 0.8)} ${num(eyeY - 16)}, ${num(CX + wR * 0.2)} ${num(eyeY - 9)}, ${num(CX - wL * 0.1)} ${num(eyeY - 14)}
        C ${num(CX - wL * 0.5)} ${num(eyeY - 18)}, ${num(CX - wL * 0.8)} ${num(eyeY - 10)}, ${num(CX - wL - 2)} ${num(eyeY - 4)} Z" fill="${fill}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.16"/>`;
    case 'bun':
      return `<path d="M ${num(CX - wL - 1)} ${num(eyeY - 12)} C ${num(CX - wL)} ${num(top - 5)}, ${num(CX + wR)} ${num(top - 5)}, ${num(CX + wR + 1)} ${num(eyeY - 12)}
        C ${num(CX + wR * 0.5)} ${num(top + 7)}, ${num(CX - wL * 0.5)} ${num(top + 7)}, ${num(CX - wL - 1)} ${num(eyeY - 12)} Z" fill="${fill}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.16"/>
        <circle cx="${CX}" cy="${num(top - 9)}" r="11" fill="${fill}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.16"/>`;
    case 'long':
      return `<path d="M ${num(CX - wL - 3)} ${num(chin - 14)} C ${num(CX - wL - 6)} ${num(top + 6)}, ${num(CX - wL * 0.5)} ${num(top - 9)}, ${CX} ${num(top - 9)}
        C ${num(CX + wR * 0.5)} ${num(top - 9)}, ${num(CX + wR + 6)} ${num(top + 6)}, ${num(CX + wR + 3)} ${num(chin - 14)}
        C ${num(CX + wR - 2)} ${num(g.noseY)}, ${num(CX + wR - 3)} ${num(eyeY - 10)}, ${num(CX + wR * 0.55)} ${num(top + 8)}
        C ${CX} ${num(top + 16)}, ${num(CX - wL * 0.55)} ${num(top + 8)}, ${num(CX - wL + 3)} ${num(eyeY - 10)}
        C ${num(CX - wL + 2)} ${num(g.noseY)}, ${num(CX - wL + 2)} ${num(g.noseY + 8)}, ${num(CX - wL - 3)} ${num(chin - 14)} Z" fill="${fill}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.14"/>`;
    case 'kerchief':
      return `<path d="M ${num(CX - wL - 3)} ${num(eyeY - 6)} C ${num(CX - wL - 3)} ${num(top - 8)}, ${num(CX + wR + 3)} ${num(top - 8)}, ${num(CX + wR + 3)} ${num(eyeY - 6)}
        C ${num(CX + wR)} ${num(eyeY - 13)}, ${num(CX - wL)} ${num(eyeY - 13)}, ${num(CX - wL - 3)} ${num(eyeY - 6)} Z" fill="${hue}" opacity="0.38"/>
        <path d="M ${num(CX + wR)} ${num(eyeY - 8)} l 12 16 l -10 -3 Z" fill="${hue}" opacity="0.38"/>`;
    case 'hood':
      return `<path d="M ${num(CX - wL - 9)} ${num(chin + 6)} C ${num(CX - wL - 11)} ${num(top - 2)}, ${num(CX + wR + 11)} ${num(top - 2)}, ${num(CX + wR + 9)} ${num(chin + 6)}
        C ${num(CX + wR)} ${num(eyeY - 16)}, ${num(CX - wL)} ${num(eyeY - 16)}, ${num(CX - wL - 9)} ${num(chin + 6)} Z" fill="${P.ink}"/>`;
    case 'cap':
      // Казённый картуз: околыш цвета дома работает за предмет.
      return `<path d="M ${num(CX - wL - 4)} ${num(eyeY - 11)} h ${num(wL + wR + 8)} l -3 -7 C ${num(CX + wR * 0.6)} ${num(top - 6)}, ${num(CX - wL * 0.6)} ${num(top - 6)}, ${num(CX - wL + 1)} ${num(eyeY - 18)} Z" fill="${P.ink}"/>
        <rect x="${num(CX - wL - 8)}" y="${num(eyeY - 12)}" width="${num(wL + wR + 16)}" height="4" rx="2" fill="${hue}" opacity="0.55"/>`;
    case 'visor':
      return `<path d="M ${num(CX - wL - 2)} ${num(eyeY - 10)} C ${num(CX - wL - 2)} ${num(top - 6)}, ${num(CX + wR + 2)} ${num(top - 6)}, ${num(CX + wR + 2)} ${num(eyeY - 10)} Z" fill="${P.ink}"/>
        <rect x="${num(CX - wL - 2)}" y="${num(eyeY - 9)}" width="${num(wL + wR + 4)}" height="9" fill="${P.ink}"/>
        <rect x="${num(CX - wL + 3)}" y="${num(eyeY - 5)}" width="${num(wL + wR - 6)}" height="2.4" fill="${hue}" opacity="0.75"/>`;
  }
}

/**
 * Борода — силуэт нижней трети лица, дёшево и громко. В городе, где всё
 * считается, ухоженность бороды — строка в описи человека.
 */
function beardPath(f: Face, g: Geom, fill: string): string {
  const { wL, wR, mouthY, chin, halfW, noseY } = g;
  switch (f.beard) {
    case 'none':
      return '';
    case 'stubble':
      // Точечное поле по золотому углу: детерминированно и без сетки.
      return `<g fill="${P.bone}" opacity="0.3">${Array.from({ length: 42 }, (_, i) => {
        const a = (i * 137.5 * Math.PI) / 180;
        const rx = Math.cos(a) * halfW * 0.62;
        const ry = mouthY + 3 + Math.abs(Math.sin(a)) * (chin - mouthY) * 0.75;
        return `<circle cx="${num(CX + rx)}" cy="${num(ry)}" r="1.1"/>`;
      }).join('')}</g>`;
    case 'mustache':
      // Казённая служба: усы щёткой, ровно по ширине рта.
      return `<path d="M ${num(CX - 11)} ${num(noseY + 3)} q 11 -3 22 0 q -3 7.5 -11 7.5 q -8 0 -11 -7.5 Z" fill="${fill}" stroke="${P.bone}" stroke-width="0.7" stroke-opacity="0.16"/>`;
    case 'short':
      // Опрятность оценщика: борода по челюсти, подстрижена.
      return `<path d="M ${num(CX - wL * 0.66)} ${num(mouthY - 3)} C ${num(CX - wL * 0.7)} ${num(chin - 2)}, ${num(CX - 9)} ${num(chin + 8)}, ${CX} ${num(chin + 8)}
        C ${num(CX + 9)} ${num(chin + 8)}, ${num(CX + wR * 0.7)} ${num(chin - 2)}, ${num(CX + wR * 0.66)} ${num(mouthY - 3)}
        C ${num(CX + wR * 0.36)} ${num(mouthY + 2)}, ${num(CX - wL * 0.36)} ${num(mouthY + 2)}, ${num(CX - wL * 0.66)} ${num(mouthY - 3)} Z" fill="${fill}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.18"/>`;
    case 'full':
      return `<path d="M ${num(CX - wL * 0.7)} ${num(mouthY - 4)} C ${num(CX - wL * 0.75)} ${num(chin + 4)}, ${num(CX - 10)} ${num(chin + 16)}, ${CX} ${num(chin + 17)}
        C ${num(CX + 10)} ${num(chin + 16)}, ${num(CX + wR * 0.75)} ${num(chin + 4)}, ${num(CX + wR * 0.7)} ${num(mouthY - 4)}
        C ${num(CX + wR * 0.4)} ${num(mouthY + 3)}, ${num(CX - wL * 0.4)} ${num(mouthY + 3)}, ${num(CX - wL * 0.7)} ${num(mouthY - 4)} Z" fill="${fill}" stroke="${P.bone}" stroke-width="0.9" stroke-opacity="0.2"/>`;
  }
}

/** Борозды: носогубные и две лобные. У Прощая — у глаз, не у рта. */
function furrowPath(f: Face, g: Geom, ink: number): string {
  if (f.furrows <= 0.02) return '';
  const op = (0.2 + f.furrows * 0.45) * ink;
  if (f.furrowsAtEyes) {
    // Лучики. Единственное лицо, которому они положены, — тепло без улыбки.
    const rays = ([-1, 1] as const)
      .map((s) => {
        const w = s < 0 ? g.wL : g.wR;
        const ex = CX + s * (w * 0.46);
        return [0, 1, 2]
          .map((i) => `<path d="M ${num(ex + s * 12)} ${num(g.eyeY - 3 + i * 4)} l ${num(s * (5 + f.furrows * 4))} ${num(-2 + i * 2)}" stroke-width="1.2"/>`)
          .join('');
      })
      .join('');
    return `<g stroke="${P.ink}" fill="none" stroke-linecap="round" opacity="${num(op)}">${rays}</g>`;
  }
  const brow = f.furrows > 0.4
    ? `<path d="M ${num(CX - 14)} ${num(g.top + 12)} q 14 ${num(-3 - f.furrows * 2)} 28 0" stroke-width="1.2"/>
       <path d="M ${num(CX - 12)} ${num(g.top + 18)} q 12 ${num(-2 - f.furrows * 2)} 24 0" stroke-width="1"/>`
    : '';
  return `<g stroke="${P.ink}" fill="none" stroke-linecap="round" opacity="${num(op)}">
    <path d="M ${num(CX - 6)} ${num(g.noseY + 2)} q ${num(-5 - f.furrows * 4)} ${num((g.mouthY - g.noseY) * 1.5)} ${num(-2)} ${num((g.mouthY - g.noseY) * 2.1)}" stroke-width="${num(1.3 + f.furrows)}"/>
    <path d="M ${num(CX + 6)} ${num(g.noseY + 2)} q ${num(5 + f.furrows * 4)} ${num((g.mouthY - g.noseY) * 1.5)} ${num(2)} ${num((g.mouthY - g.noseY) * 2.1)}" stroke-width="${num(1.3 + f.furrows)}"/>
    ${brow}</g>`;
}

/** Брыли: второй овал у подбородка. В голодном городе почти ни у кого. */
function jowlPath(f: Face, g: Geom, ink: number): string {
  if (f.jowl <= 0.05) return '';
  const d = 4 + f.jowl * 6;
  return `<g stroke="${P.ink}" fill="none" stroke-linecap="round" opacity="${num((0.25 + f.jowl * 0.3) * ink)}" stroke-width="${num(1.2 + f.jowl)}">
    <path d="M ${num(CX - g.wL * 0.5)} ${num(g.mouthY - 2)} q ${num(-d)} ${num((g.chin - g.mouthY) * 0.7)} ${num(d * 0.7)} ${num((g.chin - g.mouthY) * 1.05)}"/>
    <path d="M ${num(CX + g.wR * 0.5)} ${num(g.mouthY - 2)} q ${num(d)} ${num((g.chin - g.mouthY) * 0.7)} ${num(-d * 0.7)} ${num((g.chin - g.mouthY) * 1.05)}"/></g>`;
}

/** Шов: белая зажившая линия. Не рана и не кровь — запись о старой драке. */
function scarPath(f: Face, g: Geom): string {
  const line = (d: string): string =>
    `<path d="${d}" stroke="${P.bone}" stroke-width="1.6" fill="none" opacity="0.55" stroke-linecap="round"/>`;
  switch (f.scar) {
    case 'none': return '';
    case 'brow': return line(`M ${num(CX - g.wL * 0.62)} ${num(g.eyeY - 15)} l 4 14`);
    case 'cheek': return line(`M ${num(CX + g.wR * 0.62)} ${num(g.eyeY + 9)} l -6 15`);
    case 'lip': return line(`M ${num(CX - 5)} ${num(g.mouthY - 8)} l 3 13`);
  }
}

/**
 * Предмет — вещь, которая физически влезает в кадр головы и плеч. Это не знак
 * говорящего из ART_PASS §1 (тот живёт своей лентой): предмет согласован со
 * знаком по смыслу, но не копирует его.
 */
function propPath(f: Face, g: Geom, hue: string): string {
  const { wL, wR, eyeY, chin } = g;
  const span = 34 + f.shoulders * 30;
  switch (f.prop) {
    case 'none':
      return '';
    case 'pince':
      return `<g stroke="${hue}" stroke-width="1.6" fill="none" opacity="0.85">
        <circle cx="${num(CX - wL * 0.46)}" cy="${num(eyeY)}" r="9"/><circle cx="${num(CX + wR * 0.46)}" cy="${num(eyeY)}" r="9"/>
        <path d="M ${num(CX - wL * 0.46 + 9)} ${num(eyeY)} h ${num((wL + wR) * 0.46 - 18)}"/></g>`;
    case 'pen_ear':
      return `<g opacity="0.9"><path d="M ${num(CX + wR - 1)} ${num(eyeY - 4)} l 13 -16" stroke="${hue}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M ${num(CX + wR + 11)} ${num(eyeY - 19)} l 5 -6 l 1 6 Z" fill="${hue}"/></g>`;
    case 'whistle':
      // Кличка от свистка. Читается силуэтом даже на 44px — потому и на шнурке.
      return `<g opacity="0.92"><path d="M ${num(CX - 12)} ${num(chin + 2)} L ${CX} ${num(chin + 14)} L ${num(CX + 12)} ${num(chin + 2)}" stroke="${hue}" stroke-width="1.2" fill="none"/>
        <rect x="${num(CX - 4)}" y="${num(chin + 13)}" width="12" height="6" rx="2.5" fill="${P.bg1}" stroke="${hue}" stroke-width="1.6"/>
        <circle cx="${num(CX + 4)}" cy="${num(chin + 16)}" r="1.4" fill="${hue}"/></g>`;
    case 'jar_cord':
      // Склянка на шнурке. Полная — заливкой, пустая — контуром: канон §2.8.
      return `<g opacity="0.92"><rect x="${num(CX - 4)}" y="${num(chin + 12)}" width="8" height="11" rx="2"
          fill="${f.propFull ? hue : P.bg1}" fill-opacity="${f.propFull ? '0.75' : '1'}" stroke="${hue}" stroke-width="1.5"/>
        <rect x="${num(CX - 2)}" y="${num(chin + 9)}" width="4" height="4" fill="${hue}" opacity="0.8"/></g>`;
    case 'receipt':
      // Расписка, разглаженная, у груди: он не нищий, он вкладчик.
      return `<g opacity="0.95"><path d="M ${num(CX + 8)} ${num(chin + 9)} l 17 4 l -4 16 l -17 -4 Z" fill="${P.bg1}" stroke="${hue}" stroke-width="1.4"/>
        <g stroke="${hue}" stroke-width="1" opacity="0.75">
          <path d="M ${num(CX + 11)} ${num(chin + 14)} l 11 2.6"/>
          <path d="M ${num(CX + 10)} ${num(chin + 18)} l 11 2.6"/>
          <path d="M ${num(CX + 9)} ${num(chin + 22)} l 7 1.7"/></g></g>`;
    case 'lot_jar':
      // Лот в руках снизу кадра: держит двумя руками, как торт, и боится наклонить.
      return `<g opacity="0.95">
        <rect x="${num(CX - 8)}" y="${num(H - 22)}" width="16" height="19" rx="3" fill="${P.bg1}" stroke="${hue}" stroke-width="1.6"/>
        <rect x="${num(CX - 4)}" y="${num(H - 26)}" width="8" height="5" rx="1.5" fill="${hue}" opacity="0.8"/>
        <path d="M ${num(CX - 20)} ${H} q 2 -12 12 -13" stroke="${P.bone}" stroke-width="3.4" fill="none" opacity="0.42" stroke-linecap="round"/>
        <path d="M ${num(CX + 20)} ${H} q -2 -12 -12 -13" stroke="${P.bone}" stroke-width="3.4" fill="none" opacity="0.42" stroke-linecap="round"/></g>`;
    case 'helm_line':
      // Светлая полоса поперёк лба: шлем она снимает, когда говорит с людьми.
      return `<rect x="${num(CX - wL + 2)}" y="${num(eyeY - 15)}" width="${num(wL + wR - 4)}" height="4.5" fill="${P.bone}" opacity="0.26"/>`;
    case 'yoke':
      // Коромысло Водоноса: одна линия поперёк плеч и два свеса.
      return `<g stroke="${hue}" stroke-width="2.2" fill="none" opacity="0.7" stroke-linecap="round">
        <path d="M ${num(CX - span + 4)} ${num(chin + 20)} q ${num(span - 4)} -7 ${num(2 * span - 8)} 0"/>
        <path d="M ${num(CX - span + 8)} ${num(chin + 20)} v 9 M ${num(CX + span - 8)} ${num(chin + 20)} v 9" stroke-width="1.2"/></g>`;
  }
}

/**
 * Штриховка по теневой половине. При выцветании линий становится меньше:
 * забытое теряет цвет физически, и рисуется это недостачей линий, а не осыпью
 * и не дырами (канон §4.2).
 */
function hatch(f: Face, g: Geom, color: string, ink: number): string {
  const count = Math.max(4, Math.round(13 - f.fade * 7));
  return Array.from({ length: count }, (_, i) =>
    `<line x1="${num(CX + 2 + i * 3.4)}" y1="${num(g.top - 10)}" x2="${num(CX - 12 + i * 3.4)}" y2="${num(g.chin + 12)}" stroke="${color}" stroke-width="2" opacity="${num((0.06 + i * 0.055) * ink)}"/>`,
  ).join('');
}

function cheekHollow(f: Face, g: Geom, color: string, ink: number): string {
  const op = (0.3 + f.cheek * 0.35) * ink;
  return `<path d="M ${num(CX - g.wL * 0.72)} ${num(g.eyeY + 8)} q ${num(g.wL * 0.3)} ${num((g.chin - g.eyeY) * 0.32)} ${num(g.wL * 0.16)} ${num((g.chin - g.eyeY) * 0.55)}" stroke="${color}" stroke-width="${num(1.5 + f.cheek)}" fill="none" opacity="${num(op)}"/>
    <path d="M ${num(CX + g.wR * 0.72)} ${num(g.eyeY + 8)} q ${num(-g.wR * 0.3)} ${num((g.chin - g.eyeY) * 0.32)} ${num(-g.wR * 0.16)} ${num((g.chin - g.eyeY) * 0.55)}" stroke="${color}" stroke-width="${num(1.5 + f.cheek)}" fill="none" opacity="${num(op)}"/>`;
}

function earPath(f: Face, g: Geom, uid: string, ink: number): string {
  if (f.ears < 0.15) return '';
  return `<g fill="url(#sk-${uid})" stroke="${P.ink}" stroke-width="1" opacity="${num(0.85 * ink)}">
    <ellipse cx="${num(CX - g.wL - f.ears * 3)}" cy="${num(g.eyeY + 6)}" rx="${num(3 + f.ears * 4)}" ry="${num(7 + f.ears * 4)}"/>
    <ellipse cx="${num(CX + g.wR + f.ears * 3)}" cy="${num(g.eyeY + 6)}" rx="${num(3 + f.ears * 4)}" ry="${num(7 + f.ears * 4)}"/></g>`;
}

// ---------------------------------------------------------------------------
// Сборка
// ---------------------------------------------------------------------------

function svgWrap(inner: string, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${label}">${inner}</svg>`;
}

/** Живое лицо: череп, штриховка, глаза, работа, ворот, предмет. */
function drawHuman(f: Face, uid: string): string {
  const g = geometry(f);
  const hue = HOUSE_TONE[f.house];
  // Выцветание: контур и глаза бледнеют, штриховка редеет, чернота глазниц
  // сереет — не потому, что цвет другой, а потому, что чернил меньше.
  const ink = 1 - 0.7 * f.fade;
  // Седина — вторым слоем поверх волосяного тона: так один и тот же путь
  // работает и чёрным, и седым, и в палитре не заводится третий тон волос.
  const grey = clamp01((f.age - 0.45) / 0.55) * 0.75;
  const hairs = hairPath(f, g, P.hair, hue);
  const hairGrey = grey > 0.02 && (f.hair === 'crop' || f.hair === 'bun' || f.hair === 'long')
    ? `<g opacity="${num(grey)}">${hairPath(f, g, P.dim, hue)}</g>`
    : '';
  const beards = beardPath(f, g, P.hair);
  const beardGrey = grey > 0.02 && (f.beard === 'short' || f.beard === 'full' || f.beard === 'mustache')
    ? `<g opacity="${num(grey)}">${beardPath(f, g, P.dim)}</g>`
    : '';
  // Забрало опущено — от человека остаются рот и подбородок. Чин здесь равен
  // праву на лицо, и это правило пары Дратва/Стражник (канон §2.5).
  const eyes = f.hair === 'visor' ? '' : eyePath(f, g, -1, ink) + eyePath(f, g, 1, ink);
  const neckSinews = f.age > 0.55
    ? `<g stroke="${P.ink}" stroke-width="1.6" opacity="${num(0.5 * ink)}" fill="none">
       <path d="M ${num(CX - 7)} ${num(g.chin + 4)} q -2 8 -4 12"/><path d="M ${num(CX + 7)} ${num(g.chin + 4)} q 2 8 4 12"/></g>`
    : '';

  const body = `
    ${shouldersPath(f, g, P.ink)}
    ${neckSinews}
    ${collarPath(f, g, hue)}
    ${earPath(f, g, uid, ink)}
    <path d="${g.head}" fill="url(#sk-${uid})"/>
    <g clip-path="url(#c-${uid})">${hatch(f, g, P.ink, ink)}${cheekHollow(f, g, P.ink, ink)}</g>
    <path d="${g.head}" fill="none" stroke="${P.bone}" stroke-width="1" opacity="${num(0.22 * ink)}"/>
    ${eyes}
    <path d="${nosePath(f, g)}" stroke="${P.ink}" stroke-width="2" fill="none" opacity="${num(0.75 * ink)}" stroke-linecap="round"/>
    ${furrowPath(f, g, ink)}
    ${mouthPath(f, g, ink)}
    ${jowlPath(f, g, ink)}
    ${beards}${beardGrey}${hairs}${hairGrey}
    ${scarPath(f, g)}
    ${propPath(f, g, hue)}`;

  const tilt = f.tilt !== 0
    ? ` transform="rotate(${num(f.tilt * 7)} ${CX} ${num(g.chin)})"`
    : '';

  return `<defs>
    <linearGradient id="sk-${uid}" x1="0" y1="0" x2="1" y2="0.15">
      <stop offset="0%" stop-color="${P.bone}" stop-opacity="${num(0.62 * ink)}"/>
      <stop offset="46%" stop-color="${P.bone}" stop-opacity="${num(0.4 * ink)}"/>
      <stop offset="47%" stop-color="${P.bone}" stop-opacity="${num(0.17 * ink)}"/>
      <stop offset="100%" stop-color="${P.bone}" stop-opacity="${num(0.07 * ink)}"/>
    </linearGradient>
    <clipPath id="c-${uid}"><path d="${g.head}"/></clipPath>
  </defs><g${tilt}>${body}</g>`;
}

/**
 * Отголосок (канон §3.1). Две вещи, видные сразу и на 105px:
 *  1) контур не замкнут — линия головы разорвана, и штриховка проходит сквозь
 *     границу наружу: у живого силуэт закрывается, у памяти нет края;
 *  2) глаз нет вовсе — на месте глазниц штриховка не прерывается и не темнеет:
 *     память не смотрит, её смотрят.
 * Никакого свечения, дыма и «призрачных» градиентов: нарушенная гравюра, а не
 * привидение.
 */
function drawEcho(f: Face, uid: string): string {
  const g = geometry(f);
  const line = P.memory;
  // Рисунок разрывов детерминирован: длины штрихов и сдвиг выведены из uid,
  // поэтому у каждого отголоска свой ритм, но всегда один и тот же.
  const seed = hash32(uid);
  const gap = 9 + (seed % 7);
  const dash = `${44 + (seed % 13)} ${gap} ${58 + ((seed >> 4) % 11)} ${gap + 4} ${30 + ((seed >> 8) % 9)} ${gap + 8}`;
  const offset = seed % 40;

  // Штриховка НЕ обрезана по черепу — она и должна выходить наружу.
  const strokes = Array.from({ length: 11 }, (_, i) =>
    `<line x1="${num(CX + 2 + i * 3.6)}" y1="${num(g.top - 20)}" x2="${num(CX - 16 + i * 3.6)}" y2="${num(g.chin + 24)}" stroke="${line}" stroke-width="1.6" opacity="${num(0.06 + i * 0.034)}"/>`,
  ).join('');

  const tilt = f.tilt !== 0 ? ` transform="rotate(${num(f.tilt * 7)} ${CX} ${num(g.chin)})"` : '';

  return `<g${tilt}>
    <!-- Подложка силуэта: на 44px один разорванный контур в 1.6px исчезает
         совсем, и отголосок в ленте читается как пустая плашка. Заливка тусклая
         и БЕЗ черт — форму видно, а «нарушенная гравюра» остаётся нарушенной. -->
    <path d="${g.head}" fill="${line}" opacity="0.07"/>
    <path d="M ${num(CX - (34 + f.shoulders * 30))} ${H} C ${num(CX - (34 + f.shoulders * 30) + 6)} ${num(g.chin + 6 + (1 - f.shoulders) * 18)}, ${num(CX - 20)} ${num(g.chin + 2)}, ${CX} ${num(g.chin + 2)}
      C ${num(CX + 20)} ${num(g.chin + 2)}, ${num(CX + (34 + f.shoulders * 30) - 6)} ${num(g.chin + 6 + (1 - f.shoulders) * 18)}, ${num(CX + (34 + f.shoulders * 30))} ${H}"
      fill="none" stroke="${line}" stroke-width="2" opacity="0.55" stroke-dasharray="${dash}" stroke-dashoffset="${offset}"/>
    ${strokes}
    <path d="${g.head}" fill="none" stroke="${line}" stroke-width="2.4" opacity="0.85" stroke-dasharray="${dash}" stroke-dashoffset="${offset}"/>
    <path d="${nosePath(f, g)}" stroke="${line}" stroke-width="1.4" fill="none" opacity="0.34" stroke-linecap="round"/>
    <path d="M ${num(CX - (5 + f.mouthW * 11))} ${num(g.mouthY)} q ${num(5 + f.mouthW * 11)} ${num(-f.mouth)} ${num((5 + f.mouthW * 11) * 2)} 0" stroke="${line}" stroke-width="1.4" fill="none" opacity="0.34" stroke-linecap="round"/>
    ${propPath(f, g, line)}
  </g>`;
}

/**
 * Очередь (канон §2.3). Одного лица нет — и своих черт нет ни у кого: три
 * контура голов друг за другом, ближний с редкой штриховкой, дальние бледнее.
 * В очереди на игрока не смотрят, это неприлично; черты получает только тот,
 * кто из очереди выходит.
 */
function drawQueue(): string {
  const parts = ([
    { dx: -20, dy: 12, s: 0.86, fade: 0.5 },
    { dx: 4, dy: 4, s: 0.78, fade: 0.7 },
    { dx: 26, dy: -2, s: 0.7, fade: 0.85 },
  ] as const)
    .map((q, i) => {
      const f = makeFace({
        house: 'faint',
        jaw: 0.45 + i * 0.1,
        long: 0.5 - i * 0.08,
        cheek: 0.6,
        asym: 0.2 + i * 0.1,
        fade: q.fade,
      });
      const g = geometry(f);
      const ink = 1 - 0.7 * q.fade;
      const hatchInner = i === 0
        ? `<g clip-path="url(#c-q${i})">${hatch(f, g, P.ink, ink)}</g>`
        : '';
      return `<g transform="translate(${q.dx} ${q.dy}) scale(${q.s}) translate(${num(CX * (1 / q.s - 1))} ${num(CX * (1 / q.s - 1))})" opacity="${num(0.35 + ink * 0.6)}">
        <clipPath id="c-q${i}"><path d="${g.head}"/></clipPath>
        <path d="${g.head}" fill="url(#sk-q)" />
        ${hatchInner}
        <path d="${g.head}" fill="none" stroke="${P.bone}" stroke-width="1" opacity="${num(0.3 * ink)}"/>
      </g>`;
    })
    // Дальние рисуются первыми, ближний поверх.
    .reverse()
    .join('');

  return `<defs><linearGradient id="sk-q" x1="0" y1="0" x2="1" y2="0.15">
      <stop offset="0%" stop-color="${P.bone}" stop-opacity="0.3"/>
      <stop offset="47%" stop-color="${P.bone}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${P.bone}" stop-opacity="0.05"/>
    </linearGradient></defs>${parts}`;
}

/** Пустая ниша: слот есть, лица нет. Отказ от лица — решение, а не дыра. */
function drawEmptyNiche(): string {
  return `<rect width="${W}" height="${H}" fill="${P.bg1}"/>`;
}

// ---------------------------------------------------------------------------
// Точка входа
// ---------------------------------------------------------------------------

/**
 * Портрет говорящего. Состояние — ЯВНЫЙ аргумент: канон требует лиц, зависящих
 * от игры (серость игрока растёт со смертями, Клёста становится больше по
 * главам, у Ревизора отрастает биография), а STYLE §7.6 требует чистой
 * функции. Одни и те же аргументы дают побайтово один и тот же SVG.
 *
 * Рассказчик лица не имеет и не получит: у жителя есть вклад, у вклада опись,
 * у описи лицо; рассказчик — не житель. Ему возвращается пустая ниша.
 */
export function portraitSvg(id: string, state: PortraitState = {}): string {
  if (id === 'narrator') return svgWrap(drawEmptyNiche(), 'narrator');
  if (id === 'ochered') return svgWrap(drawQueue(), 'portrait ochered');

  const face = resolveFace(id, state);
  if (face === undefined) return svgWrap(drawEmptyNiche(), `portrait ${id}`);

  // Уникальный суффикс идентификаторов внутри SVG — от аргументов, а не от
  // счётчика модуля: два одинаковых вызова обязаны дать одинаковую строку,
  // иначе ломается и кеш, и тест детерминизма.
  const uid = hash32(`${id}|${face.fade}|${face.asym}|${face.jaw}|${face.long}|${face.age}`).toString(36);

  return svgWrap(face.echo ? drawEcho(face, uid) : drawHuman(face, uid), `portrait ${id}`);
}

/** Есть ли у роли процедурное лицо. Ни рассказчик, ни незнакомцы его не имеют. */
export function hasPortrait(id: string): boolean {
  return id !== 'narrator' && (id === 'ochered' || resolveFace(id) !== undefined);
}
