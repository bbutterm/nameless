import type { CompareOp, Condition } from './types.js';
import type { GameState } from './state.js';

export function compare(a: number, op: CompareOp, b: number): boolean {
  switch (op) {
    case 'gte':
      return a >= b;
    case 'lte':
      return a <= b;
    case 'gt':
      return a > b;
    case 'lt':
      return a < b;
    case 'eq':
      return a === b;
    case 'neq':
      return a !== b;
    default: {
      const _exhaustive: never = op;
      void _exhaustive;
      return false;
    }
  }
}

/**
 * Чистая проверка условия. Никакой случайности: одно и то же состояние
 * всегда даёт один и тот же набор доступных вариантов — иначе фаззер бесполезен.
 */
export function evalCondition(cond: Condition | undefined, state: GameState): boolean {
  if (!cond) return true;
  switch (cond.kind) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'all':
      return cond.of.every((c) => evalCondition(c, state));
    case 'any':
      return cond.of.some((c) => evalCondition(c, state));
    case 'not':
      return !evalCondition(cond.of, state);
    case 'axis':
      return compare(state.axes[cond.axis] ?? 0, cond.op, cond.value);
    case 'flag':
      return (state.flags[cond.flag] ?? false) === (cond.value ?? true);
    case 'counter':
      return compare(state.counters[cond.counter] ?? 0, cond.op, cond.value);
    case 'memory':
      return state.lockedMemories.includes(cond.memory);
    case 'life':
      return state.awakenedLives.includes(cond.life);
    case 'visited':
      return state.visitedScenes.includes(cond.scene);
    case 'deaths':
      return compare(state.deaths, cond.op, cond.value);
    case 'chapter':
      return compare(state.chapter, cond.op, cond.value);
    case 'hasUnit':
      return state.party.some((u) => u.defId === cond.unit);
    case 'partySize':
      return compare(state.party.length, cond.op, cond.value);
    default: {
      const _exhaustive: never = cond;
      void _exhaustive;
      return false;
    }
  }
}

/** Собирает все id, на которые ссылается условие — для валидации сирот-флагов. */
export function collectRefs(cond: Condition | undefined, out: ConditionRefs = emptyRefs()): ConditionRefs {
  if (!cond) return out;
  switch (cond.kind) {
    case 'all':
    case 'any':
      cond.of.forEach((c) => collectRefs(c, out));
      break;
    case 'not':
      collectRefs(cond.of, out);
      break;
    case 'axis':
      out.axes.add(cond.axis);
      break;
    case 'flag':
      out.flags.add(cond.flag);
      break;
    case 'counter':
      out.counters.add(cond.counter);
      break;
    case 'memory':
      out.memories.add(cond.memory);
      break;
    case 'life':
      out.lives.add(cond.life);
      break;
    case 'visited':
      out.scenes.add(cond.scene);
      break;
    case 'hasUnit':
      out.units.add(cond.unit);
      break;
    default:
      break;
  }
  return out;
}

export interface ConditionRefs {
  axes: Set<string>;
  flags: Set<string>;
  counters: Set<string>;
  memories: Set<string>;
  lives: Set<string>;
  scenes: Set<string>;
  units: Set<string>;
}

export function emptyRefs(): ConditionRefs {
  return {
    axes: new Set(),
    flags: new Set(),
    counters: new Set(),
    memories: new Set(),
    lives: new Set(),
    scenes: new Set(),
    units: new Set(),
  };
}
