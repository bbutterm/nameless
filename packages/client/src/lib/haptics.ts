/** Вибрация. Отключаемая: не всем нравится, а на слабых телефонах ещё и лагает. */
const KEY = 'nameless:haptics';

let enabled = true;
try {
  enabled = localStorage.getItem(KEY) !== '0';
} catch {
  enabled = true;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

export function setHaptics(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // не критично
  }
}

type Pattern = 'tap' | 'choice' | 'hit' | 'crit' | 'death' | 'memory';

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  choice: 18,
  hit: 26,
  crit: [30, 40, 55],
  death: [60, 60, 120],
  memory: [16, 90, 16, 90, 40],
};

export function vibrate(pattern: Pattern): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(PATTERNS[pattern]);
  } catch {
    // Safari молча не умеет — и хорошо
  }
}
