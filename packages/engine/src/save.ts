import { SAVE_VERSION, type GameState } from './state.js';

export interface SaveEnvelope {
  version: number;
  savedAt: number;
  state: GameState;
}

export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/**
 * Миграции сейвов. Ключ — версия, ИЗ которой мигрируем.
 * Добавляя поле в GameState, поднимай SAVE_VERSION и клади сюда миграцию,
 * иначе игроки с ночной сборкой потеряют прохождение.
 */
export const migrations: Record<number, Migration> = {};

export function serialize(state: GameState, now: number): string {
  const envelope: SaveEnvelope = { version: SAVE_VERSION, savedAt: now, state };
  return JSON.stringify(envelope);
}

export interface LoadResult {
  ok: boolean;
  state?: GameState;
  error?: string;
  migrated?: boolean;
}

export function deserialize(raw: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Сейв повреждён: не читается JSON' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Сейв повреждён' };
  const env = parsed as Partial<SaveEnvelope>;
  if (typeof env.version !== 'number' || !env.state) {
    return { ok: false, error: 'Сейв без версии' };
  }
  if (env.version > SAVE_VERSION) {
    return { ok: false, error: 'Сейв из более новой версии игры' };
  }

  let data = env.state as unknown as Record<string, unknown>;
  let migrated = false;
  for (let v = env.version; v < SAVE_VERSION; v++) {
    const m = migrations[v];
    if (!m) return { ok: false, error: `Нет миграции с версии ${v}` };
    data = m(data);
    migrated = true;
  }
  const shapeError = checkShape(data);
  if (shapeError) return { ok: false, error: shapeError };

  const state = data as unknown as GameState;
  return { ok: true, state: { ...state, version: SAVE_VERSION }, migrated };
}

/**
 * Структурная проверка после миграций. Без неё `{"version":1,"state":{}}` из
 * localStorage проходил как валидный сейв, а падало потом глубоко в движке —
 * на `state.log.push` или обходе пустого отряда, где причину уже не видно.
 *
 * Проверяем форму, а не смысл: что поле есть и нужного типа. Ссылочная
 * целостность (существует ли такая сцена, такой юнит) — не наша забота:
 * контент между версиями меняется, и сейв, ссылающийся на удалённую сцену,
 * должен доходить до движка и падать там внятно, а не отбраковываться здесь.
 *
 * Намеренно руками, а не через zod: движок обязан оставаться без зависимостей.
 */
function checkShape(data: Record<string, unknown>): string | null {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

  const strings: Array<keyof GameState> = ['seed', 'scene', 'node'];
  for (const key of strings) {
    if (typeof data[key] !== 'string') return `Сейв повреждён: поле «${key}» не строка`;
  }

  const numbers: Array<keyof GameState> = ['gold', 'chapter', 'deaths'];
  for (const key of numbers) {
    if (typeof data[key] !== 'number' || !Number.isFinite(data[key])) {
      return `Сейв повреждён: поле «${key}» не число`;
    }
  }

  const arrays: Array<keyof GameState> = [
    'party',
    'lockedMemories',
    'awakenedLives',
    'visitedScenes',
    'seenNodes',
    'log',
  ];
  for (const key of arrays) {
    if (!Array.isArray(data[key])) return `Сейв повреждён: поле «${key}» не список`;
  }

  const records: Array<keyof GameState> = ['axes', 'flags', 'counters', 'fragments'];
  for (const key of records) {
    if (!isObj(data[key])) return `Сейв повреждён: поле «${key}» не словарь`;
  }

  const rng = data['rng'];
  if (!isObj(rng) || typeof rng['seed'] !== 'number' || typeof rng['calls'] !== 'number') {
    return 'Сейв повреждён: состояние генератора случайных чисел не читается';
  }

  return null;
}
