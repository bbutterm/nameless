/**
 * Границы, которые никто не проверял, и регрессии на найденные баги.
 *
 * Тесты с пометкой РЕГРЕССИЯ красные без соответствующей правки движка —
 * это их назначение.
 */
import { describe, expect, it } from 'vitest';
import {
  act,
  beginRound,
  currentActor,
  indexCombat,
  isRevive,
  legalTargets,
  planAction,
  readyAbilities,
  runAuto,
  autoAct,
  startBattle,
  type BattleState,
  type CombatIndex,
} from './combat.js';
import { applyEffect, createInitialState, scaledMaxHp, type GameState } from './state.js';
import { filterOptions, indexContent, resolve } from './dialogue.js';
import { applyDeath, levelFromXp, selectMemoryOnDeath } from './progression.js';
import type {
  Ability,
  BattleDef,
  ContentBundle,
  Memory,
  Option,
  PartyUnit,
  Scene,
  UnitDef,
} from './types.js';

const L = (s: string) => ({ ru: s, en: s });

function ab(p: Partial<Ability> & { id: string }): Ability {
  return {
    name: L(p.id),
    description: L(p.id),
    icon: 'i',
    target: 'enemy_front',
    power: 1,
    cooldown: 0,
    ...p,
  };
}

function un(p: Partial<UnitDef> & { id: string }): UnitDef {
  return {
    name: L(p.id),
    blurb: L(p.id),
    art: '',
    faction: 'f',
    tier: 1,
    row: 'front',
    stats: { hp: 30, atk: 10, def: 0, initiative: 5 },
    abilities: ['hit'],
    ...p,
  } as UnitDef;
}

function bundleOf(part: Partial<ContentBundle>): ContentBundle {
  return {
    axes: [],
    scenes: [],
    units: [],
    abilities: [],
    battles: [],
    lives: [],
    memories: [],
    deaths: [],
    chapters: [],
    speakers: [],
    ...part,
  };
}

function party(defs: { id: string; row?: 'front' | 'back'; hp?: number; level?: number }[], units: UnitDef[]): PartyUnit[] {
  return defs.map((d, i) => {
    const def = units.find((u) => u.id === d.id) as UnitDef;
    const level = d.level ?? 1;
    return {
      uid: `p${i}:${d.id}`,
      defId: d.id,
      hp: d.hp ?? scaledMaxHp(def.stats.hp, level),
      xp: 0,
      level,
      slot: { row: d.row ?? (i < 3 ? 'front' : 'back'), index: i % 3 },
    };
  });
}

function baseState(over: Partial<GameState> = {}): GameState {
  return {
    ...createInitialState({
      seed: 's',
      axes: [{ id: 'a', start: 0 }],
      chapter: 1,
      scene: 'sc',
      node: 'n',
      now: 0,
    }),
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Размер отряда
// ─────────────────────────────────────────────────────────────────────────────

describe('границы: размер отряда', () => {
  const abilities = [ab({ id: 'hit', power: 0.8 })];
  const units = [un({ id: 'fighter' }), un({ id: 'weak', stats: { hp: 6, atk: 3, def: 0, initiative: 3 } })];

  it('отряд из одного юнита доводит бой до исхода', () => {
    const battle: BattleDef = {
      id: 'b',
      name: L('b'),
      enemies: [{ unit: 'weak', row: 'front', index: 0 }],
      turnLimit: 20,
    };
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    const st = runAuto(idx, startBattle(idx, battle, party([{ id: 'fighter' }], units), 'one'));
    expect(st.outcome).not.toBe('ongoing');
    expect(st.units.filter((u) => u.side === 'player')).toHaveLength(1);
  });

  it('отряд из шести встаёт в оба ряда и все шестеро попадают в очередь', () => {
    const battle: BattleDef = {
      id: 'b',
      name: L('b'),
      enemies: [{ unit: 'weak', row: 'front', index: 0 }],
      turnLimit: 20,
    };
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    const six = party(
      [...Array(6)].map((_, i) => ({ id: 'fighter', row: i < 3 ? ('front' as const) : ('back' as const) })),
      units,
    );
    const st = startBattle(idx, battle, six, 'six');
    expect(st.units.filter((u) => u.side === 'player')).toHaveLength(6);
    expect(new Set(st.order).size).toBe(st.order.length);
    expect(st.order).toHaveLength(7);
  });

  it('пустой отряд — мгновенное поражение, а не зависание', () => {
    const battle: BattleDef = {
      id: 'b',
      name: L('b'),
      enemies: [{ unit: 'weak', row: 'front', index: 0 }],
      turnLimit: 0,
    };
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    const st = startBattle(idx, battle, [], 'empty');
    expect(st.outcome).toBe('lose');
  });

  it('седьмого юнита в отряд не взять: клеток шесть', () => {
    let s = baseState();
    const ctx = { unitStats: () => ({ hp: 10, row: 'front' as const }) };
    for (let i = 0; i < 9; i++) s = applyEffect(s, { kind: 'recruit', unit: 'x' }, ctx);
    expect(s.party).toHaveLength(6);
    expect(new Set(s.party.map((u) => `${u.slot.row}:${u.slot.index}`)).size).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Вырожденные бои
// ─────────────────────────────────────────────────────────────────────────────

describe('границы: вырожденные бои', () => {
  it('у всех врагов 1 hp — бой заканчивается победой в первом же раунде', () => {
    const abilities = [ab({ id: 'hit', power: 0.5 })];
    const units = [
      un({ id: 'hero', stats: { hp: 40, atk: 12, def: 0, initiative: 20 } }),
      un({ id: 'paper', stats: { hp: 1, atk: 1, def: 0, initiative: 1 } }),
    ];
    const battle: BattleDef = {
      id: 'b',
      name: L('b'),
      enemies: [
        { unit: 'paper', row: 'front', index: 0 },
        { unit: 'paper', row: 'front', index: 1 },
      ],
      turnLimit: 30,
    };
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    const st = runAuto(idx, startBattle(idx, battle, party([{ id: 'hero' }, { id: 'hero' }], units), 'p'));
    expect(st.outcome).toBe('win');
    expect(st.units.filter((u) => u.side === 'enemy' && u.alive)).toHaveLength(0);
  });

  it('power: 0 без явных эффектов всё равно наносит минимум единицу — бой не встаёт', () => {
    const abilities = [ab({ id: 'hit', power: 0 })];
    const units = [
      un({ id: 'a', stats: { hp: 4, atk: 10, def: 0, initiative: 5 } }),
      un({ id: 'b', stats: { hp: 4, atk: 10, def: 0, initiative: 4 } }),
    ];
    const battle: BattleDef = {
      id: 'b',
      name: L('b'),
      enemies: [{ unit: 'b', row: 'front', index: 0 }],
      turnLimit: 0,
    };
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    const st = runAuto(idx, startBattle(idx, battle, party([{ id: 'a' }], units), 'z'), 5000);
    expect(st.outcome).not.toBe('ongoing');
    const dmg = st.events.filter((e) => e.type === 'damage');
    expect(dmg.length).toBeGreaterThan(0);
    for (const e of dmg) if (e.type === 'damage') expect(e.amount).toBeGreaterThanOrEqual(1);
  });

  it('способность с power: 0 и только бафом урона не наносит', () => {
    const abilities = [
      ab({ id: 'hit', power: 0.6 }),
      ab({ id: 'rally', target: 'self', power: 0, cooldown: 0, effects: [{ kind: 'buff', stat: 'atk', amount: 5, turns: 2 }] }),
    ];
    const units = [un({ id: 'a', abilities: ['rally'] }), un({ id: 'b' })];
    const battle: BattleDef = { id: 'b', name: L('b'), enemies: [{ unit: 'b', row: 'front', index: 0 }], turnLimit: 3 };
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    let st = startBattle(idx, battle, party([{ id: 'a' }], units), 'buff');
    const ti = st.order.indexOf('p0:a');
    st = act(idx, { ...st, turnIndex: ti }, { ability: 'rally' });
    const self = st.units.find((u) => u.uid === 'p0:a');
    expect(self?.statuses.some((s) => s.kind === 'buff')).toBe(true);
    // Урона себе баф не нанёс.
    expect(self?.hp).toBe(self?.maxHp);
  });

  it('все способности на стартовом кулдауне: юнит пропускает ход, бой продолжается', () => {
    const abilities = [
      ab({ id: 'hit', power: 0.6 }),
      ab({ id: 'slow', power: 0.6, initialCooldown: 3, cooldown: 3 }),
    ];
    const units = [un({ id: 'lazy', abilities: ['slow'] }), un({ id: 'foe' })];
    const battle: BattleDef = { id: 'b', name: L('b'), enemies: [{ unit: 'foe', row: 'front', index: 0 }], turnLimit: 12 };
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    const st0 = startBattle(idx, battle, party([{ id: 'lazy' }], units), 'cd');
    const lazy = st0.units.find((u) => u.uid === 'p0:lazy') as NonNullable<
      ReturnType<typeof currentActor>
    >;
    expect(readyAbilities(idx, lazy)).toHaveLength(0);
    expect(planAction(idx, st0, lazy)).toBeUndefined();
    const st = runAuto(idx, st0, 5000);
    expect(st.outcome).not.toBe('ongoing');
    expect(st.events.some((e) => e.type === 'blocked' && e.reason === 'ability')).toBe(true);
  });

  it('оглушение всей стороны: раунды идут, статус истекает, бой не виснет', () => {
    const abilities = [
      ab({ id: 'hit', power: 0.4 }),
      ab({ id: 'wave', target: 'enemy_all', power: 0, cooldown: 9, effects: [{ kind: 'stun', turns: 3 }] }),
    ];
    const units = [
      un({ id: 'shocker', abilities: ['wave', 'hit'], stats: { hp: 40, atk: 8, def: 0, initiative: 30 } }),
      un({ id: 'mob', stats: { hp: 20, atk: 6, def: 0, initiative: 5 } }),
    ];
    const battle: BattleDef = {
      id: 'b',
      name: L('b'),
      enemies: [
        { unit: 'mob', row: 'front', index: 0 },
        { unit: 'mob', row: 'front', index: 1 },
        { unit: 'mob', row: 'back', index: 0 },
      ],
      turnLimit: 0,
    };
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    let st = startBattle(idx, battle, party([{ id: 'shocker' }], units), 'stun');
    // Глушим всю вражескую сторону разом.
    const ti = st.order.indexOf('p0:shocker');
    st = act(idx, { ...st, turnIndex: ti }, { ability: 'wave' });
    expect(st.units.filter((u) => u.side === 'enemy' && u.statuses.some((s) => s.kind === 'stun'))).toHaveLength(3);
    const done = runAuto(idx, st, 5000);
    expect(done.outcome).not.toBe('ongoing');
    expect(done.events.filter((e) => e.type === 'blocked' && e.reason === 'stun').length).toBeGreaterThan(0);
  });

  it('оглушение обеих сторон разом не сжигает стек и не роняет бой без лимита', () => {
    const abilities = [
      ab({ id: 'hit', power: 0.4 }),
      ab({ id: 'freeze', target: 'enemy_all', power: 0, cooldown: 0, effects: [{ kind: 'stun', turns: 6 }] }),
    ];
    const units = [un({ id: 'a', abilities: ['freeze', 'hit'] }), un({ id: 'b', abilities: ['freeze', 'hit'] })];
    const battle: BattleDef = { id: 'b', name: L('b'), enemies: [{ unit: 'b', row: 'front', index: 0 }], turnLimit: 0 };
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    let st = startBattle(idx, battle, party([{ id: 'a' }], units), 'freeze');
    // Вручную вешаем длинный stun на всех: бой обязан пережить пустые раунды.
    st = {
      ...st,
      units: st.units.map((u) => ({ ...u, statuses: [{ kind: 'stun' as const, amount: 0, turns: 25 }] })),
    };
    expect(() => runAuto(idx, st, 20000)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// РЕГРЕССИЯ: воскрешение
// ─────────────────────────────────────────────────────────────────────────────

describe('РЕГРЕССИЯ: revive был недостижим', () => {
  const abilities = [
    ab({ id: 'hit', power: 0.6 }),
    ab({
      id: 'raise',
      target: 'ally_one',
      power: 0,
      cooldown: 4,
      effects: [{ kind: 'revive', hpPercent: 0.5 }],
    }),
  ];
  const units = [
    un({ id: 'medic', abilities: ['raise', 'hit'], row: 'back', stats: { hp: 40, atk: 8, def: 0, initiative: 9 } }),
    un({ id: 'tank', stats: { hp: 30, atk: 8, def: 0, initiative: 6 } }),
    un({ id: 'foe', stats: { hp: 60, atk: 9, def: 0, initiative: 1 } }),
  ];
  const battle: BattleDef = {
    id: 'b',
    name: L('b'),
    enemies: [{ unit: 'foe', row: 'front', index: 0 }],
    turnLimit: 20,
  };

  function withDeadTank(): { idx: CombatIndex; st: BattleState } {
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    let st = startBattle(idx, battle, party([{ id: 'tank' }, { id: 'medic', row: 'back' }], units), 'rev');
    st = {
      ...st,
      units: st.units.map((u) => (u.uid === 'p0:tank' ? { ...u, hp: 0, alive: false } : u)),
    };
    return { idx, st };
  }

  it('isRevive отличает воскрешение от лечения', () => {
    expect(isRevive(abilities[1] as Ability)).toBe(true);
    expect(isRevive(abilities[0] as Ability)).toBe(false);
  });

  it('павший союзник — законная цель воскрешения, живой — нет', () => {
    const { idx, st } = withDeadTank();
    const targets = legalTargets(st, 'p1:medic', abilities[1] as Ability);
    expect(targets.map((t) => t.uid)).toEqual(['p0:tank']);
    // Обычное лечение по-прежнему видит только живых.
    expect(
      legalTargets(st, 'p1:medic', ab({ id: 'cure', target: 'ally_one', power: 0, effects: [{ kind: 'heal', power: 0.5 }] })).map(
        (t) => t.uid,
      ),
    ).toEqual(['p1:medic']);
  });

  it('воскрешение действительно поднимает павшего с долей максимума', () => {
    const { idx, st } = withDeadTank();
    const ti = st.order.indexOf('p1:medic');
    const after = act(idx, { ...st, turnIndex: ti }, { ability: 'raise', targetUid: 'p0:tank' });
    const tank = after.units.find((u) => u.uid === 'p0:tank');
    expect(tank?.alive).toBe(true);
    expect(tank?.hp).toBe(Math.round((tank?.maxHp ?? 0) * 0.5));
    expect(after.events.some((e) => e.type === 'blocked')).toBe(false);
  });

  it('бот сам выбирает поднять павшего, если умеет', () => {
    const { idx, st } = withDeadTank();
    const medic = st.units.find((u) => u.uid === 'p1:medic') as NonNullable<
      ReturnType<typeof currentActor>
    >;
    expect(planAction(idx, st, medic)).toEqual({ ability: 'raise', targetUid: 'p0:tank' });
  });

  it('поднимать некого — способность не выбирается и не блокирует ход', () => {
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    const st = startBattle(idx, battle, party([{ id: 'tank' }, { id: 'medic', row: 'back' }], units), 'rev2');
    expect(legalTargets(st, 'p1:medic', abilities[1] as Ability)).toHaveLength(0);
    const medic = st.units.find((u) => u.uid === 'p1:medic') as NonNullable<
      ReturnType<typeof currentActor>
    >;
    expect(planAction(idx, st, medic)?.ability).not.toBe('raise');
  });

  it('живых не осталось — бой уже проигран, воскрешать некому (задокументированная граница)', () => {
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    let st = startBattle(idx, battle, party([{ id: 'medic', row: 'back' }], units), 'rev3');
    st = {
      ...st,
      units: st.units.map((u) => (u.side === 'player' ? { ...u, hp: 0, alive: false } : u)),
    };
    // Исход считается сразу, как только сторона опустела: воскрешение
    // «в последний момент» невозможно by design — это правило, а не баг.
    const after = runAuto(idx, st, 200);
    expect(after.outcome).toBe('lose');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// РЕГРЕССИЯ: холостой автобой
// ─────────────────────────────────────────────────────────────────────────────

describe('РЕГРЕССИЯ: autoAct не крутит холостые итерации', () => {
  const abilities = [ab({ id: 'hit', power: 0.6 })];
  const units = [
    un({ id: 'a', stats: { hp: 20, atk: 8, def: 0, initiative: 9 } }),
    un({ id: 'b', stats: { hp: 20, atk: 8, def: 0, initiative: 3 } }),
  ];
  const battle: BattleDef = { id: 'b', name: L('b'), enemies: [{ unit: 'b', row: 'front', index: 0 }], turnLimit: 20 };

  it('очередь указывает на павшего — ход передаётся дальше, а не замирает', () => {
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    let st = startBattle(idx, battle, party([{ id: 'a' }], units), 'idle');
    // Валим того, чей сейчас ход, не трогая очередь: ровно то, что делает
    // сейв, реплей или эффект, поправивший юнита в обход beginRound.
    const uid = st.order[st.turnIndex] as string;
    st = { ...st, units: st.units.map((u) => (u.uid === uid ? { ...u, hp: 0, alive: false } : u)) };
    const one = autoAct(idx, st);
    expect(one === st, 'autoAct вернул то же самое состояние — это холостой цикл').toBe(false);
    expect(runAuto(idx, st, 500).outcome).not.toBe('ongoing');
  });

  it('обе стороны пали вне очереди — runAuto закрывает бой ничьёй, а не «ongoing»', () => {
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    let st = startBattle(idx, battle, party([{ id: 'a' }], units), 'idle2');
    st = { ...st, units: st.units.map((u) => ({ ...u, hp: 0, alive: false })) };
    const after = runAuto(idx, st, 500);
    expect(after.outcome).toBe('draw');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// РЕГРЕССИЯ: кулдауны прошлого состояния
// ─────────────────────────────────────────────────────────────────────────────

describe('РЕГРЕССИЯ: beginRound не правит прошлое состояние', () => {
  const abilities = [ab({ id: 'hit', power: 0.05, cooldown: 0, initialCooldown: 5 })];
  const units = [
    un({ id: 'a', stats: { hp: 400, atk: 1, def: 0, initiative: 5 } }),
    un({ id: 'b', stats: { hp: 400, atk: 1, def: 0, initiative: 4 } }),
  ];
  const battle: BattleDef = { id: 'b', name: L('b'), enemies: [{ unit: 'b', row: 'front', index: 0 }], turnLimit: 40 };

  it('кулдаун в снимке раунда не меняется задним числом', () => {
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    const s0 = startBattle(idx, battle, party([{ id: 'a' }], units), 'cd');
    const seen = s0.units.find((u) => u.uid === 'p0:a')?.cooldowns['hit'];
    const s1 = beginRound(idx, s0);
    const s2 = beginRound(idx, s1);
    expect(s0.units.find((u) => u.uid === 'p0:a')?.cooldowns['hit']).toBe(seen);
    expect(s1.units.find((u) => u.uid === 'p0:a')?.cooldowns['hit']).toBe((seen ?? 0) - 1);
    expect(s2.units.find((u) => u.uid === 'p0:a')?.cooldowns['hit']).toBe((seen ?? 0) - 2);
  });

  it('состояния раундов не делят один объект кулдаунов', () => {
    const idx = indexCombat(bundleOf({ units, abilities, battles: [battle] }));
    const s0 = startBattle(idx, battle, party([{ id: 'a' }], units), 'cd2');
    const s1 = beginRound(idx, s0);
    expect(s0.units[0]?.cooldowns).not.toBe(s1.units[0]?.cooldowns);
    expect(s0.units[0]?.statuses).not.toBe(s1.units[0]?.statuses);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// РЕГРЕССИЯ: порядок кнопок
// ─────────────────────────────────────────────────────────────────────────────

describe('РЕГРЕССИЯ: порядок вариантов — всегда порядок объявления', () => {
  const o = (id: string, extra: Partial<Option> = {}): Option => ({
    id,
    text: L(id),
    to: 'n',
    ...extra,
  });

  it('добор страховочным не выбрасывает его в хвост', () => {
    const options = [
      o('first', { fallback: true }),
      o('second', { conditions: { kind: 'always' } }),
    ];
    // Проходит только второй, первый добирается как страховочный —
    // и обязан остаться первым, как написано в сцене.
    const state = baseState();
    const withNever = [o('first', { fallback: true, conditions: { kind: 'never' } }), options[1] as Option];
    expect(filterOptions(withNever, state).map((x) => x.id)).toEqual(['first', 'second']);
  });

  it('добор по priority тоже уважает порядок объявления', () => {
    const options = [
      o('alpha', { conditions: { kind: 'never' }, priority: 1 }),
      o('beta', { conditions: { kind: 'never' }, priority: 9 }),
    ];
    expect(filterOptions(options, baseState()).map((x) => x.id)).toEqual(['alpha', 'beta']);
  });

  it('порядок не зависит от того, какие варианты прошли', () => {
    const mk = (passing: 'a' | 'b') => [
      o('a', { fallback: true, conditions: passing === 'a' ? { kind: 'always' } : { kind: 'never' } }),
      o('b', { fallback: true, conditions: passing === 'b' ? { kind: 'always' } : { kind: 'never' } }),
    ];
    expect(filterOptions(mk('a'), baseState()).map((x) => x.id)).toEqual(['a', 'b']);
    expect(filterOptions(mk('b'), baseState()).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Память и смерть на границах
// ─────────────────────────────────────────────────────────────────────────────

describe('границы: память и смерть', () => {
  const mem = (id: string, cost: number, life = 'life'): Memory => ({
    id,
    life,
    name: L(id),
    revelation: L(id),
    icon: 'i',
    cost,
  });
  const world = (memories: Memory[]): ContentBundle =>
    bundleOf({
      memories,
      lives: [
        {
          id: 'life',
          name: L('life'),
          flavor: L('f'),
          icon: 'i',
          axis: 'a',
          pole: 'positive',
          memories: memories.map((m) => m.id),
        },
      ],
    });

  it('воспоминание с cost: 0 закрепляется даже без единого осколка', () => {
    const w = world([mem('free', 0)]);
    expect(selectMemoryOnDeath(baseState(), w)?.id).toBe('free');
  });

  it('cost: 0 не перебивает воспоминание, набравшее осколки', () => {
    const w = world([mem('free', 0), mem('earned', 2)]);
    const s = baseState({ fragments: { earned: 3 } });
    expect(selectMemoryOnDeath(s, w)?.id).toBe('earned');
  });

  it('смерть без единого воспоминания в мире не ломает пробуждение', () => {
    const res = applyDeath(baseState(), bundleOf({}), {
      id: 'd',
      name: L('d'),
      wakeScene: 'wake',
      wakeText: L('w'),
    });
    expect(res.memory).toBeUndefined();
    expect(res.lifeAwakened).toBe(false);
    expect(res.state.scene).toBe('wake');
    expect(res.state.node).toBe('@entry');
    expect(res.state.deaths).toBe(1);
  });

  it('смерть чистит ленту текущей сцены, но не память о пройденном', () => {
    const s = baseState({
      log: [{ nodeId: 'n', scene: 'sc', kind: 'narration', ru: 'р', en: 'e' }],
      visitedScenes: ['sc'],
      seenNodes: ['sc#n'],
    });
    const res = applyDeath(s, bundleOf({}), { id: 'd', name: L('d'), wakeScene: 'w', wakeText: L('w') });
    expect(res.state.log).toEqual([]);
    expect(res.state.visitedScenes).toEqual(['sc']);
    expect(res.state.seenNodes).toEqual(['sc#n']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Вырожденные сцены
// ─────────────────────────────────────────────────────────────────────────────

describe('границы: вырожденные сцены', () => {
  const sceneBundle = (scenes: Scene[]): ContentBundle => bundleOf({ scenes });

  it('сцена из одного узла end — это шаг end, а не ошибка', () => {
    const idx = indexContent(
      sceneBundle([{ id: 'only', chapter: 1, title: L('only'), entry: 'e', nodes: [{ kind: 'end', id: 'e' }] }]),
    );
    const r = resolve(idx, baseState({ scene: 'only', node: '@entry' }));
    expect(r.step.kind).toBe('end');
    expect(r.state.seenNodes).toContain('only#e');
  });

  it('сцена, чей entry не существует, даёт ошибку с адресом узла', () => {
    const idx = indexContent(
      sceneBundle([{ id: 'broken', chapter: 1, title: L('b'), entry: 'missing', nodes: [{ kind: 'end', id: 'e' }] }]),
    );
    const r = resolve(idx, baseState({ scene: 'broken', node: '@entry' }));
    expect(r.step.kind).toBe('error');
    if (r.step.kind === 'error') expect(r.step.message).toContain('broken#missing');
  });

  it('узел effects, зацикленный сам на себя, обрывается ошибкой зацикливания', () => {
    const idx = indexContent(
      sceneBundle([
        {
          id: 'loop',
          chapter: 1,
          title: L('l'),
          entry: 'a',
          nodes: [{ kind: 'effects', id: 'a', effects: [{ kind: 'counter', counter: 'c', delta: 1 }], next: 'a' }],
        },
      ]),
    );
    const r = resolve(idx, baseState({ scene: 'loop', node: '@entry' }));
    expect(r.step.kind).toBe('error');
    if (r.step.kind === 'error') expect(r.step.message).toContain('Зацикливание');
  });

  it('глава 0 у сцены не сбрасывает текущую главу игрока', () => {
    const idx = indexContent(
      sceneBundle([{ id: 'neutral', chapter: 0, title: L('n'), entry: 'e', nodes: [{ kind: 'end', id: 'e' }] }]),
    );
    const r = resolve(idx, baseState({ scene: 'neutral', node: '@entry', chapter: 3 }));
    expect(r.state.chapter).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Известное расхождение: xp-эффект и уровень
// ─────────────────────────────────────────────────────────────────────────────

describe('известное расхождение: эффект xp не поднимает уровень', () => {
  const ctx = { unitStats: () => ({ hp: 20, row: 'front' as const }) };

  it('applyEffect(xp) копит опыт, но уровень остаётся прежним', () => {
    const s = baseState({
      party: [{ uid: 'u', defId: 'd', hp: 20, xp: 0, level: 1, slot: { row: 'front', index: 0 } }],
    });
    const after = applyEffect(s, { kind: 'xp', amount: 400 }, ctx);
    expect(after.party[0]?.xp).toBe(400);
    // Уровень по опыту был бы третьим, но applyEffect его не пересчитывает:
    // это делает только grantXp после боя. Тест фиксирует текущий контракт —
    // если поведение меняют, менять надо осознанно (см. docs/TEST_REPORT.md).
    expect(levelFromXp(400)).toBe(3);
    expect(after.party[0]?.level).toBe(1);
  });

  it('следствие: лечение после xp-эффекта упирается в максимум СТАРОГО уровня', () => {
    let s = baseState({
      party: [{ uid: 'u', defId: 'd', hp: 5, xp: 0, level: 1, slot: { row: 'front', index: 0 } }],
    });
    s = applyEffect(s, { kind: 'xp', amount: 400 }, ctx);
    s = applyEffect(s, { kind: 'heal', amount: 999 }, ctx);
    expect(s.party[0]?.hp).toBe(scaledMaxHp(20, 1));
    expect(s.party[0]?.hp).toBeLessThan(scaledMaxHp(20, 3));
  });
});
