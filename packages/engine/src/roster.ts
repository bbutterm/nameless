/**
 * Отряды «как у игрока в этой точке сюжета».
 *
 * Правило родилось в симуляторе и жило в его cli. Пока измеритель был один,
 * это было незаметно; с появлением полигона боёв (клиент) измерителей стало
 * два, и они сравнивают свои числа ДРУГ С ДРУГОМ: «бот выигрывает 66%, а ты
 * 80%». Такое сравнение имеет смысл ровно до тех пор, пока обе стороны выходят
 * в бой одним и тем же отрядом. Копия правила в клиенте разошлась бы с
 * оригиналом на первой же правке — и разрыв в пунктах начал бы мерить
 * расхождение двух функций, а не разницу между человеком и эвристикой.
 *
 * Поэтому правило живёт в движке: и симулятор, и клиент берут его отсюда.
 */
import { scaledMaxHp } from './state.js';
import type { PartyUnit, Row, UnitDef, UnitId } from './types.js';

/** Сколько клеток в одном ряду строя. */
const ROW_SLOTS = 3;

/**
 * Отряд «среднего игрока» заданной главы: потолок тира и уровень.
 *
 * Берутся сильнейшие доступные юниты: к этой главе игрок уже выбирал, кого
 * держать в строю, и держал он не самых слабых.
 */
export function defaultParty(
  units: readonly UnitDef[],
  maxTier: number,
  level: number,
): PartyUnit[] {
  const pool = units.filter((u) => u.tier <= maxTier);
  const byTier = (a: UnitDef, b: UnitDef): number => b.tier - a.tier;
  const front = pool.filter((u) => u.row === 'front').sort(byTier).slice(0, ROW_SLOTS);
  const back = pool.filter((u) => u.row === 'back').sort(byTier).slice(0, ROW_SLOTS);
  const out: PartyUnit[] = [];
  const push = (u: UnitDef, row: Row, i: number): void => {
    out.push({
      uid: `d${out.length}`,
      defId: u.id,
      hp: scaledMaxHp(u.stats.hp, level),
      xp: 0,
      level,
      slot: { row, index: i },
    });
  };
  front.forEach((u, i) => push(u, 'front', i));
  back.forEach((u, i) => push(u, 'back', i));
  return out;
}

/**
 * Отряд по именам: ровно тот, что есть у игрока в этой точке сюжета.
 *
 * Нужен боям, объявившим `expectParty`: бой-знакомство в начале главы
 * проходится вдвоём, и мерить его шестью сильнейшими юнитами тира — мерить
 * не тот вход, там любой состав даёт 100%.
 *
 * Уровень по умолчанию первый: так этот отряд и заводился в симуляторе, и
 * менять его молча значило бы сдвинуть все замеренные числа разом. Полигон
 * передаёт уровень явно — там его крутит рука.
 */
export function namedParty(
  units: readonly UnitDef[],
  ids: readonly UnitId[],
  level = 1,
): PartyUnit[] {
  const byId = new Map(units.map((u) => [u.id, u]));
  const out: PartyUnit[] = [];
  let front = 0;
  let back = 0;
  for (const id of ids) {
    const u = byId.get(id);
    if (!u) continue;
    const row = u.row;
    const index = row === 'front' ? front++ : back++;
    // Лишний юнит ряда молча выпадает: строй — это три клетки, и «седьмой в
    // переднем ряду» не выражается ничем. Ловит такое валидатор контента.
    if (index >= ROW_SLOTS) continue;
    out.push({
      uid: `n${out.length}`,
      defId: u.id,
      hp: scaledMaxHp(u.stats.hp, level),
      xp: 0,
      level,
      slot: { row, index },
    });
  }
  return out;
}
