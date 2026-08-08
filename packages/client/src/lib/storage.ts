import { deserialize, serialize, type GameState } from '@nameless/engine';

const KEY = 'nameless:save:v1';

/**
 * Сейвы в localStorage. IndexedDB здесь избыточен: одно прохождение —
 * это десятки килобайт, а localStorage переживает перезапуск standalone-PWA
 * надёжнее, чем кажется. Версионирование — внутри движка (save.ts).
 */
export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, serialize(state, Date.now()));
  } catch {
    // Переполнение или приватный режим: игра продолжается, прогресс не переживёт вкладку.
  }
}

export function loadGame(): { state?: GameState; error?: string } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  const res = deserialize(raw);
  if (!res.ok) return { error: res.error };
  return { state: res.state };
}

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // не критично
  }
}
