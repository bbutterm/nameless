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
  const state = data as unknown as GameState;
  return { ok: true, state: { ...state, version: SAVE_VERSION }, migrated };
}
