/**
 * Полигон боёв: правила набора отряда, память попыток и арифметика счёта.
 *
 * Это отладочный ПРИБОР, а не часть игры. Он существует ради одного числа:
 * весь балансовый коридор замерен ботом (жадная эвристика в сорок строк), а
 * играет человек, и разрыв между ними до сих пор никто не мерил. Полигон даёт
 * сыграть один бой десять раз подряд и увидеть свою долю побед рядом с долей
 * бота на том же бою.
 *
 * Здесь нет ни React, ни DOM — только чистые правила и один ключ хранилища.
 * Так их можно накрыть тестами, а тесты тут не роскошь: прибор, который врёт,
 * хуже отсутствующего прибора.
 */
import {
  botrates,
  content,
  type BotRate,
} from '@nameless/content';
import {
  defaultParty,
  derivePlayerPowers,
  namedParty,
  type BattleDef,
  type PartyUnit,
  type PlayerAbility,
} from '@nameless/engine';

/** Глава, под которую собирается отряд. Тот же выбор, что и у симулятора. */
export type RangeChapter = 1 | 2 | 3;
/** Ступень памяти: 0 — «нет», дальше I/II/III. */
export type RangeTier = 0 | 1 | 2 | 3;

export const RANGE_CHAPTERS: readonly RangeChapter[] = [1, 2, 3];
export const RANGE_TIERS: readonly RangeTier[] = [0, 1, 2, 3];
/** Уровень отряда. Выше пятого игрок к третьей главе не доходит. */
export const RANGE_LEVELS: readonly number[] = [1, 2, 3, 4, 5];

export interface RangeSetup {
  chapter: RangeChapter;
  level: number;
  tier: RangeTier;
}

export const RANGE_DEFAULT: RangeSetup = { chapter: 1, level: 1, tier: 0 };

/**
 * Адрес полигона. Хеш, а не тайный жест по титулу: жест, о котором надо
 * догадаться, однажды находит обычный игрок — а тут прибор, который стирать
 * прохождение не должен, но и попадаться на глаза не должен тоже.
 */
export const RANGE_HASH = 'полигон';

/** Открыт ли полигон текущим адресом. Кодированный хеш (`%D0%BF…`) — тот же адрес. */
export function isRangeHash(hash: string): boolean {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Битая процентная последовательность — значит, точно не наш адрес.
  }
  return decoded === RANGE_HASH;
}

// ── Отряд ───────────────────────────────────────────────────────────────────

/**
 * Отряд для боя на полигоне. Правило то же, что в симуляторе (`roster.ts`):
 * бой, объявивший `expectParty`, меряется ровно объявленным составом — иначе
 * бой-знакомство для двоих получает шестерых и даёт ложные 100%.
 *
 * Уровень при этом слушается всегда, в том числе у названного отряда: на
 * полигоне его крутит рука, и «почему ползунок ничего не делает на первом бое
 * главы» — вопрос, на который прибор отвечать не должен.
 */
export function rangeParty(def: BattleDef, setup: RangeSetup): PartyUnit[] {
  if (def.expectParty?.length) return namedParty(content.units, def.expectParty, setup.level);
  return defaultParty(content.units, setup.chapter, setup.level);
}

/** Слушается ли выбор главы этим боем, или состав ему продиктован. */
export function partyIsFixed(def: BattleDef): boolean {
  return !!def.expectParty?.length;
}

/**
 * Умения памяти ступени N: первые N воспоминаний КАЖДОЙ жизни по цене.
 *
 * Порядок — по цене (2 → 3 → 4), как объявлено каноном, а не по алфавиту id:
 * у трёх жизней из пяти первым по алфавиту идёт усиливающее воспоминание, и
 * «ступень I» вышла бы усилением без дающего, то есть пустым набором. Ровно на
 * этом однажды обжёгся симулятор — отчёт выглядел правдоподобно и мерил бой
 * без умения.
 */
export function rangePowers(tier: RangeTier): readonly PlayerAbility[] {
  if (tier === 0) return [];
  const byLife = new Map<string, string[]>();
  const ordered = content.memories
    .slice()
    .sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const m of ordered) {
    const list = byLife.get(m.life) ?? [];
    if (list.length < tier) list.push(m.id);
    byLife.set(m.life, list);
  }
  const locked = [...byLife.values()].flat().sort();
  return derivePlayerPowers(locked, content).abilities;
}

/**
 * Сид боя. Номер попытки в нём обязателен: без него десять прогонов подряд —
 * это десять одинаковых боёв, и «выиграл 10 из 10» означает «выиграл один бой
 * и повторил запись десять раз». С номером бои разные, но воспроизводимые —
 * `Math.random()` в игровом коде запрещён, и правильно.
 */
export function rangeSeed(battleId: string, attempt: number): string {
  return `range:${battleId}:${attempt}`;
}

// ── Счёт ────────────────────────────────────────────────────────────────────

/**
 * Ключ полигона. ОТДЕЛЬНЫЙ от сюжетного сейва (`nameless:save:v1`), и это не
 * аккуратность, а условие работы прибора: владелец проходит игру и гоняет
 * полигон в один вечер. Полигон, стерший прохождение, обесценил бы оба замера
 * разом — поэтому отсюда в сейв не ведёт ни одна строчка, ни на чтение, ни на
 * запись.
 */
const KEY = 'nameless:range:v1';
const VERSION = 1;

export interface RangeTally {
  played: number;
  won: number;
}

export interface RangeScore {
  version: number;
  battles: Record<string, RangeTally>;
  /**
   * Последняя выбранная настройка. Живёт в хранилище, а не в состоянии экрана,
   * ровно потому, что экран уходит на время боя и возвращается заново: без
   * этого каждый прогон начинался бы с трёх повторных нажатий, а замер ради
   * которого прибор и сделан — это десять прогонов подряд.
   */
  setup: RangeSetup;
}

export function emptyScore(): RangeScore {
  return { version: VERSION, battles: {}, setup: RANGE_DEFAULT };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Битое хранилище прибор не роняет: пустой счёт честнее исключения в рендере. */
export function loadScore(): RangeScore {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return emptyScore();
  }
  if (!raw) return emptyScore();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyScore();
  }
  if (!isRecord(data) || !isRecord(data.battles)) return emptyScore();
  const battles: Record<string, RangeTally> = {};
  for (const [id, tally] of Object.entries(data.battles)) {
    if (!isRecord(tally)) continue;
    const played = tally.played;
    const won = tally.won;
    if (typeof played !== 'number' || typeof won !== 'number') continue;
    if (!Number.isFinite(played) || !Number.isFinite(won)) continue;
    battles[id] = { played, won };
  }
  return { version: VERSION, battles, setup: readSetup(data.setup) };
}

/** Настройка из хранилища. Всё, что не узнали, заменяется значением по умолчанию. */
function readSetup(raw: unknown): RangeSetup {
  if (!isRecord(raw)) return RANGE_DEFAULT;
  const chapter = RANGE_CHAPTERS.find((c) => c === raw.chapter) ?? RANGE_DEFAULT.chapter;
  const tier = RANGE_TIERS.find((t) => t === raw.tier) ?? RANGE_DEFAULT.tier;
  const level = RANGE_LEVELS.find((l) => l === raw.level) ?? RANGE_DEFAULT.level;
  return { chapter, level, tier };
}

function writeScore(score: RangeScore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(score));
  } catch {
    // Приватный режим или переполнение: счёт не переживёт вкладку, замер — да.
  }
}

/** Сколько раз этот бой уже отыгран. Он же — номер следующей попытки для сида. */
export function attemptsOf(score: RangeScore, battleId: string): number {
  return score.battles[battleId]?.played ?? 0;
}

/** Записывает исход и возвращает обновлённый счёт (для мгновенной перерисовки). */
export function recordResult(battleId: string, won: boolean): RangeScore {
  const score = loadScore();
  const prev = score.battles[battleId] ?? { played: 0, won: 0 };
  const next: RangeScore = {
    ...score,
    battles: {
      ...score.battles,
      [battleId]: { played: prev.played + 1, won: prev.won + (won ? 1 : 0) },
    },
  };
  writeScore(next);
  return next;
}

/** Запоминает выбор трёх переключателей. Счёт при этом не трогается. */
export function saveSetup(setup: RangeSetup): RangeScore {
  const next: RangeScore = { ...loadScore(), setup };
  writeScore(next);
  return next;
}

export function clearScore(): RangeScore {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // не критично
  }
  return emptyScore();
}

// ── Список боёв и итог ──────────────────────────────────────────────────────

export interface RangeRow {
  def: BattleDef;
  /** Глава, в которой бой встречается по сюжету. Не встречается нигде — 0. */
  chapter: number;
  bot: BotRate | undefined;
  tally: RangeTally | undefined;
  /** Бой, который по сюжету проигрывают: балансовый коридор к нему неприменим. */
  lethal: boolean;
}

/** Глава каждого боя — по сцене, из которой в него входят. */
function chapterOfBattle(): Map<string, number> {
  const out = new Map<string, number>();
  for (const sc of content.scenes) {
    for (const n of sc.nodes) {
      if (n.kind === 'battle' && !out.has(n.battle)) out.set(n.battle, sc.chapter);
    }
  }
  return out;
}

/**
 * Все бои игры, по главам. Порядок внутри главы — как в контенте: он совпадает
 * с порядком файлов, то есть примерно с порядком прохождения, и это полезнее
 * алфавита. `localeCompare` не используется нигде — он зависит от локали среды.
 */
export function rangeRows(score: RangeScore): RangeRow[] {
  const chapters = chapterOfBattle();
  return content.battles
    .map((def, i) => ({
      def,
      i,
      chapter: chapters.get(def.id) ?? 0,
      bot: botrates.battles[def.id],
      tally: score.battles[def.id],
      lethal: !!def.tags?.includes('lethal'),
    }))
    .sort((a, b) => a.chapter - b.chapter || a.i - b.i)
    .map(({ def, chapter, bot, tally, lethal }) => ({ def, chapter, bot, tally, lethal }));
}

export interface RangeTotals {
  /** Сколько боёв отыграно всего (прогонов, не разных боёв). */
  played: number;
  won: number;
  /** Доля побед человека, 0..1. */
  human: number;
  /**
   * Доля побед бота НА ТЕХ ЖЕ боях и в той же пропорции: винрейты бота
   * взвешены числом твоих прогонов каждого боя. Простое среднее по боям
   * сравнивало бы твои десять прогонов одной драки со средним по девятнадцати
   * — и разрыв мерил бы выбор боёв, а не игру.
   */
  bot: number;
  /** Разрыв в ПУНКТАХ (человек минус бот). Ради него всё и затевалось. */
  gapPoints: number;
  /** Прогоны боёв, которых нет в снимке бота: в сравнение они не вошли. */
  unmeasured: number;
}

export function rangeTotals(rows: readonly RangeRow[]): RangeTotals {
  let played = 0;
  let won = 0;
  let botWeighted = 0;
  let botWeight = 0;
  let unmeasured = 0;
  for (const r of rows) {
    if (!r.tally || r.tally.played === 0) continue;
    played += r.tally.played;
    won += r.tally.won;
    if (r.bot) {
      botWeighted += r.bot.winrate * r.tally.played;
      botWeight += r.tally.played;
    } else {
      unmeasured += r.tally.played;
    }
  }
  const human = played > 0 ? won / played : 0;
  const bot = botWeight > 0 ? botWeighted / botWeight : 0;
  return {
    played,
    won,
    human,
    bot,
    gapPoints: Math.round(human * 100) - Math.round(bot * 100),
    unmeasured,
  };
}

/** Проценты печатаем целыми: у прибора с десятками прогонов десятые — шум. */
export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** Дата снимка бота — печатается рядом с его цифрами, чтобы они не старели молча. */
export const BOT_MEASURED = botrates.measured;
