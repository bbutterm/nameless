/**
 * Опыт и уровни. Вынесено в отдельный модуль намеренно: формулу читают и
 * `state.ts` (применение эффекта `xp`), и `progression.ts` (награда за бой),
 * а прямая ссылка между ними дала бы цикл импортов.
 */

/** Опыт до следующего уровня: 100, 300, 600, 1000… */
export function xpForLevel(level: number): number {
  return Math.round(50 * level * (level + 1));
}

export const MAX_LEVEL = 10;

export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (lvl < MAX_LEVEL && xp >= xpForLevel(lvl)) lvl++;
  return lvl;
}
