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

type Pattern = 'tap' | 'choice' | 'hit' | 'crit' | 'death' | 'memory' | 'recruit';

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  choice: 18,
  hit: 26,
  crit: [30, 40, 55],
  death: [60, 60, 120],
  memory: [16, 90, 16, 90, 40],
  /*
   * Вербовка: щелчок бирки и следом то, что тяжелее его. До В4 здесь стояло
   * `choice` — то же, что у любой кнопки диалога, — и рука не отличала
   * «человек пошёл с тобой» от «я нажал ответ». Жалоба владельца «вербовку
   * нужно более подсвечивать» на ощупь выглядела именно так.
   */
  recruit: [14, 70, 42],
};

export function vibrate(pattern: Pattern): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(PATTERNS[pattern]);
  } catch {
    // Safari молча не умеет — и хорошо
  }
}
