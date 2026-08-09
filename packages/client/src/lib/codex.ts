/**
 * Помянник в localStorage. Отдельный ключ от сейва (CODEX §4, §9) — сознательно:
 * `clearSave()` и «Новая игра» стирают забег, а книга должна пережить и то, и
 * другое. Смешать их в одном ключе значило бы одной строкой кода однажды
 * стереть память игрока вместе с прогрессом.
 *
 * Запись сюда — только из церемонии смерти и финала забега (`store/game.tsx`),
 * больше ниоткуда: сцены не пишут в книгу напрямую (CODEX §9).
 */
const KEY = 'nameless:codex:v1';

/** Версия конверта книги. Растёт при несовместимом изменении формы. */
const VERSION = 1;

export interface CodexLineRecord {
  /** Номер забега, в котором строка была дописана — только для статистики церемонии. */
  run: number;
  /** Гаснет открытием записи — управляет точкой «есть новое» в списке. */
  seen: boolean;
}

export interface CodexEnvelope {
  version: number;
  /** Сколько забегов начато. Нужен только как метка `run` у новых строк. */
  runs: number;
  lines: Record<string, CodexLineRecord>;
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Миграции книги. Ключ — версия, ИЗ которой мигрируем — по образцу `save.ts`.
 * Пока пусто: книга родилась версией 1, мигрировать не из чего.
 */
const migrations: Record<number, Migration> = {};

function emptyEnvelope(): CodexEnvelope {
  return { version: VERSION, runs: 0, lines: {} };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Структурная проверка после миграций — по той же причине, что и в `save.ts`:
 * без неё битый JSON из localStorage доходил бы до экрана и падал глубоко
 * внутри рендера, где причину было бы не найти. Здесь цена ошибки выше:
 * это единственная база данных, которая переживает «Новую игру», поэтому
 * при любом сомнении в форме — пустая книга, а не исключение.
 */
function checkShape(data: Record<string, unknown>): data is { runs: number; lines: Record<string, unknown> } {
  if (typeof data.runs !== 'number' || !Number.isFinite(data.runs)) return false;
  if (!isRecord(data.lines)) return false;
  for (const rec of Object.values(data.lines)) {
    if (!isRecord(rec)) return false;
    if (typeof rec.run !== 'number' || typeof rec.seen !== 'boolean') return false;
  }
  return true;
}

/** Читает книгу. Битое хранилище не роняет игру — возвращает пустую книгу. */
export function loadCodex(): CodexEnvelope {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return emptyEnvelope();
  }
  if (!raw) return emptyEnvelope();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyEnvelope();
  }
  if (!isRecord(parsed) || typeof parsed.version !== 'number') return emptyEnvelope();

  let data = parsed as Record<string, unknown>;
  for (let v = parsed.version; v < VERSION; v++) {
    const m = migrations[v];
    if (!m) return emptyEnvelope();
    data = m(data);
  }
  if (!checkShape(data)) return emptyEnvelope();

  return {
    version: VERSION,
    runs: data.runs,
    lines: data.lines as Record<string, CodexLineRecord>,
  };
}

function persist(env: CodexEnvelope): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(env));
  } catch {
    // Переполнение или приватный режим: страница не допишется, игра продолжается.
  }
}

/**
 * Дописывает в книгу только те строки, которых там ещё нет — дедупликация
 * живёт здесь, а не в движке (CODEX §9: движок про прошлые забеги не знает).
 * Возвращает список реально дописанных id — им церемония смерти показывает такт.
 */
export function commitPending(lineIds: readonly string[], run: number): string[] {
  if (lineIds.length === 0) return [];
  const env = loadCodex();
  const added: string[] = [];
  for (const id of lineIds) {
    if (env.lines[id]) continue;
    env.lines[id] = { run, seen: false };
    added.push(id);
  }
  if (added.length > 0) persist(env);
  return added;
}

/** Гасит точку «есть новое» у перечисленных строк (открытием записи). */
export function markEntrySeen(lineIds: readonly string[]): void {
  const env = loadCodex();
  let changed = false;
  for (const id of lineIds) {
    const rec = env.lines[id];
    if (rec && !rec.seen) {
      rec.seen = true;
      changed = true;
    }
  }
  if (changed) persist(env);
}

/** Есть ли среди перечисленных строк хоть одна непрочитанная. */
export function hasNew(lineIds: readonly string[]): boolean {
  const env = loadCodex();
  return lineIds.some((id) => env.lines[id]?.seen === false);
}

/**
 * Новый забег начался — растит счётчик и возвращает новое значение. Считаем
 * забеги по «Новой игре» (`startNew`), а не по смертям: смерть здесь не
 * заканчивает забег, а продолжает его (CODEX §4).
 */
export function bumpRuns(): number {
  const env = loadCodex();
  env.runs += 1;
  persist(env);
  return env.runs;
}

/** Стирает книгу целиком. Единственный явный способ — кнопка в настройках. */
export function wipeCodex(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // не критично
  }
}
