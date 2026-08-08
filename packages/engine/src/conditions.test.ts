import { describe, expect, it } from 'vitest';
import { collectRefs, compare, emptyRefs, evalCondition } from './conditions.js';
import { createInitialState, type GameState } from './state.js';
import type { Condition, PartyUnit } from './types.js';

function unit(defId: string, i: number): PartyUnit {
  return { uid: `${defId}#${i}`, defId, hp: 10, xp: 0, level: 1, slot: { row: 'front', index: i } };
}

function state(patch: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    seed: 'test',
    axes: [
      { id: 'mercy_cruelty', start: 0 },
      { id: 'grasp_release', start: 0 },
    ],
    chapter: 1,
    scene: 'chulan',
    node: 'start',
    now: 0,
  });
  return { ...base, ...patch };
}

describe('compare', () => {
  it('покрывает все шесть операций', () => {
    expect(compare(5, 'gte', 5)).toBe(true);
    expect(compare(4, 'gte', 5)).toBe(false);
    expect(compare(5, 'lte', 5)).toBe(true);
    expect(compare(6, 'lte', 5)).toBe(false);
    expect(compare(6, 'gt', 5)).toBe(true);
    expect(compare(5, 'gt', 5)).toBe(false);
    expect(compare(4, 'lt', 5)).toBe(true);
    expect(compare(5, 'lt', 5)).toBe(false);
    expect(compare(5, 'eq', 5)).toBe(true);
    expect(compare(5, 'neq', 5)).toBe(false);
    expect(compare(4, 'neq', 5)).toBe(true);
  });
});

describe('evalCondition', () => {
  it('отсутствие условия — истина', () => {
    expect(evalCondition(undefined, state())).toBe(true);
  });

  it('always / never', () => {
    expect(evalCondition({ kind: 'always' }, state())).toBe(true);
    expect(evalCondition({ kind: 'never' }, state())).toBe(false);
  });

  it('ось сравнивается по значению', () => {
    const s = state({ axes: { mercy_cruelty: -55, grasp_release: 0 } });
    expect(evalCondition({ kind: 'axis', axis: 'mercy_cruelty', op: 'lte', value: -40 }, s)).toBe(true);
    expect(evalCondition({ kind: 'axis', axis: 'mercy_cruelty', op: 'gte', value: 40 }, s)).toBe(false);
  });

  it('неизвестная ось считается нулём', () => {
    expect(evalCondition({ kind: 'axis', axis: 'nope', op: 'eq', value: 0 }, state())).toBe(true);
  });

  it('флаг по умолчанию false, value:false ловит непоставленный флаг', () => {
    const s = state({ flags: { dogovor_naiden: true } });
    expect(evalCondition({ kind: 'flag', flag: 'dogovor_naiden' }, s)).toBe(true);
    expect(evalCondition({ kind: 'flag', flag: 'dogovor_naiden', value: false }, s)).toBe(false);
    expect(evalCondition({ kind: 'flag', flag: 'nikogda', value: false }, s)).toBe(true);
    expect(evalCondition({ kind: 'flag', flag: 'nikogda' }, s)).toBe(false);
  });

  it('счётчик по умолчанию ноль', () => {
    const s = state({ counters: { lots_sold: 3 } });
    expect(evalCondition({ kind: 'counter', counter: 'lots_sold', op: 'gte', value: 3 }, s)).toBe(true);
    expect(evalCondition({ kind: 'counter', counter: 'lots_bought', op: 'eq', value: 0 }, s)).toBe(true);
  });

  it('воспоминание и жизнь проверяются по закреплённым спискам', () => {
    const s = state({ lockedMemories: ['pervyy_posul'], awakenedLives: ['posulshchik'] });
    expect(evalCondition({ kind: 'memory', memory: 'pervyy_posul' }, s)).toBe(true);
    expect(evalCondition({ kind: 'memory', memory: 'zima_bez_khleba' }, s)).toBe(false);
    expect(evalCondition({ kind: 'life', life: 'posulshchik' }, s)).toBe(true);
    expect(evalCondition({ kind: 'life', life: 'smolokur' }, s)).toBe(false);
  });

  it('visited смотрит на посещённые сцены', () => {
    const s = state({ visitedScenes: ['chulan', 'mokrye_ryady'] });
    expect(evalCondition({ kind: 'visited', scene: 'chulan' }, s)).toBe(true);
    expect(evalCondition({ kind: 'visited', scene: 'tot_bereg' }, s)).toBe(false);
  });

  it('deaths и chapter', () => {
    const s = state({ deaths: 2, chapter: 3 });
    expect(evalCondition({ kind: 'deaths', op: 'gte', value: 2 }, s)).toBe(true);
    expect(evalCondition({ kind: 'deaths', op: 'gt', value: 2 }, s)).toBe(false);
    expect(evalCondition({ kind: 'chapter', op: 'eq', value: 3 }, s)).toBe(true);
  });

  it('hasUnit и partySize', () => {
    const s = state({ party: [unit('gar', 0), unit('vodonos', 1)] });
    expect(evalCondition({ kind: 'hasUnit', unit: 'gar' }, s)).toBe(true);
    expect(evalCondition({ kind: 'hasUnit', unit: 'posul' }, s)).toBe(false);
    expect(evalCondition({ kind: 'partySize', op: 'gte', value: 2 }, s)).toBe(true);
    expect(evalCondition({ kind: 'partySize', op: 'gt', value: 2 }, s)).toBe(false);
  });

  it('all требует всех, any — хотя бы одного', () => {
    const s = state({ axes: { mercy_cruelty: 70, grasp_release: -70 } });
    const mercy: Condition = { kind: 'axis', axis: 'mercy_cruelty', op: 'gte', value: 60 };
    const grasp: Condition = { kind: 'axis', axis: 'grasp_release', op: 'gte', value: 60 };
    expect(evalCondition({ kind: 'all', of: [mercy, grasp] }, s)).toBe(false);
    expect(evalCondition({ kind: 'any', of: [mercy, grasp] }, s)).toBe(true);
    expect(evalCondition({ kind: 'all', of: [mercy] }, s)).toBe(true);
  });

  it('not переворачивает', () => {
    expect(evalCondition({ kind: 'not', of: { kind: 'always' } }, state())).toBe(false);
    expect(evalCondition({ kind: 'not', of: { kind: 'never' } }, state())).toBe(true);
  });

  it('вложенные all/any/not считаются рекурсивно', () => {
    const s = state({
      axes: { mercy_cruelty: 65, grasp_release: -65 },
      flags: { revizor_prishel: true },
      lockedMemories: ['kolodets'],
    });
    const cond: Condition = {
      kind: 'all',
      of: [
        { kind: 'any', of: [
          { kind: 'axis', axis: 'mercy_cruelty', op: 'gte', value: 60 },
          { kind: 'memory', memory: 'net_takogo' },
        ] },
        { kind: 'not', of: { kind: 'all', of: [
          { kind: 'flag', flag: 'revizor_prishel' },
          { kind: 'axis', axis: 'grasp_release', op: 'gte', value: 0 },
        ] } },
        { kind: 'memory', memory: 'kolodets' },
      ],
    };
    expect(evalCondition(cond, s)).toBe(true);

    const broken: Condition = { kind: 'all', of: [cond, { kind: 'never' }] };
    expect(evalCondition(broken, s)).toBe(false);
  });
});

describe('collectRefs', () => {
  it('пустое условие ничего не собирает', () => {
    const refs = collectRefs(undefined);
    expect(refs.flags.size).toBe(0);
  });

  it('достаёт id из глубины вложенных условий', () => {
    const cond: Condition = {
      kind: 'any',
      of: [
        { kind: 'not', of: { kind: 'flag', flag: 'kalitka_zaperta' } },
        { kind: 'all', of: [
          { kind: 'axis', axis: 'reason_obsession', op: 'lte', value: -40 },
          { kind: 'counter', counter: 'krysy', op: 'gte', value: 1 },
          { kind: 'memory', memory: 'opis_vsego' },
          { kind: 'life', life: 'perechen' },
          { kind: 'visited', scene: 'nizhnie_khranilishcha' },
          { kind: 'hasUnit', unit: 'svidetel' },
        ] },
      ],
    };
    const refs = collectRefs(cond, emptyRefs());
    expect([...refs.flags]).toEqual(['kalitka_zaperta']);
    expect([...refs.axes]).toEqual(['reason_obsession']);
    expect([...refs.counters]).toEqual(['krysy']);
    expect([...refs.memories]).toEqual(['opis_vsego']);
    expect([...refs.lives]).toEqual(['perechen']);
    expect([...refs.scenes]).toEqual(['nizhnie_khranilishcha']);
    expect([...refs.units]).toEqual(['svidetel']);
  });
});
