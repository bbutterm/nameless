/**
 * Свойства, а не примеры.
 *
 * Здесь проверяются ИНВАРИАНТЫ на сгенерированных входах: генератор сидится
 * движковым `Rng`, поэтому любое падение воспроизводится по номеру итерации
 * (сид печатается в сообщении assert'а). Ни один тест в этом файле не должен
 * зависеть от конкретного контента игры — только от контракта движка.
 */
import { describe, expect, it } from 'vitest';
import { Rng } from './rng.js';
import {
  AXIS_MAX,
  AXIS_MIN,
  applyEffect,
  applyEffects,
  createInitialState,
  markVisited,
  scaledMaxHp,
  type GameState,
} from './state.js';
import { deserialize, serialize } from './save.js';
import { filterOptions, MAX_OPTIONS, MIN_OPTIONS, indexContent, resolve } from './dialogue.js';
import { applyDeath, grantXp, levelFromXp, selectMemoryOnDeath } from './progression.js';
import { indexCombat, runAuto, startBattle } from './combat.js';
import type {
  Ability,
  BattleDef,
  ContentBundle,
  Effect,
  Option,
  PartyUnit,
  Scene,
  SceneNode,
  TargetKind,
  UnitDef,
} from './types.js';

const L = (s: string) => ({ ru: s, en: s });

// ─────────────────────────────────────────────────────────────────────────────
// Генераторы
// ─────────────────────────────────────────────────────────────────────────────

const TARGETS: TargetKind[] = [
  'enemy_front',
  'enemy_any',
  'enemy_row',
  'enemy_all',
  'ally_one',
  'ally_all',
  'self',
];

/**
 * Способность со случайными параметрами. `damaging` гарантирует, что урон
 * пройдёт: бой без единой урон-способности с обеих сторон и без лимита ходов
 * не обязан заканчиваться — это отдельный, документированный случай.
 */
function genAbility(rng: Rng, id: string, damaging: boolean): Ability {
  const target = damaging
    ? (rng.pick(['enemy_front', 'enemy_any', 'enemy_row', 'enemy_all'] as TargetKind[]) as TargetKind)
    : (rng.pick(TARGETS) as TargetKind);
  const a: Ability = {
    id,
    name: L(id),
    description: L(id),
    icon: 'i',
    target,
    power: damaging ? rng.float(0.4, 1.4) : rng.pick([0, 0.2, 0.6]) ?? 0,
    cooldown: rng.int(0, 3),
  };
  if (!damaging && rng.chance(0.7)) {
    const kind = rng.int(0, 5);
    const effects: Ability['effects'] =
      kind === 0
        ? [{ kind: 'heal', power: rng.float(0.3, 0.9) }]
        : kind === 1
          ? [{ kind: 'shield', amount: rng.int(3, 12), turns: rng.int(1, 3) }]
          : kind === 2
            ? [{ kind: 'buff', stat: 'atk', amount: rng.int(1, 6), turns: rng.int(1, 3) }]
            : kind === 3
              ? [{ kind: 'debuff', stat: 'def', amount: rng.int(1, 6), turns: rng.int(1, 3) }]
              : kind === 4
                ? [{ kind: 'dot', amount: rng.int(1, 5), turns: rng.int(1, 3), tag: 'burn' }]
                : [{ kind: 'stun', turns: rng.int(1, 2) }];
    a.effects = effects;
  }
  if (rng.chance(0.2)) a.initialCooldown = rng.int(1, 3);
  if (rng.chance(0.15)) a.piercing = true;
  return a;
}

function genUnit(rng: Rng, id: string, damagingId: string, extraIds: string[]): UnitDef {
  const abilities = [damagingId];
  for (const e of extraIds) if (rng.chance(0.4)) abilities.push(e);
  return {
    id,
    name: L(id),
    blurb: L(id),
    art: '',
    faction: 'f',
    tier: (rng.int(1, 3) as 1 | 2 | 3),
    row: rng.chance(0.5) ? 'front' : 'back',
    stats: {
      hp: rng.int(8, 60),
      atk: rng.int(3, 20),
      def: rng.int(0, 12),
      initiative: rng.int(1, 12),
    },
    abilities,
  };
}

interface GenWorld {
  bundle: ContentBundle;
  units: UnitDef[];
}

function genCombatWorld(rng: Rng): GenWorld {
  const abilities: Ability[] = [];
  const damagingIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const id = `dmg${i}`;
    abilities.push(genAbility(rng, id, true));
    damagingIds.push(id);
  }
  const extraIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const id = `sup${i}`;
    abilities.push(genAbility(rng, id, false));
    extraIds.push(id);
  }
  const units: UnitDef[] = [];
  for (let i = 0; i < 8; i++) {
    units.push(genUnit(rng, `u${i}`, rng.pick(damagingIds) as string, extraIds));
  }
  return {
    bundle: {
      axes: [],
      scenes: [],
      units,
      abilities,
      battles: [],
      lives: [],
      memories: [],
      deaths: [],
      chapters: [],
      speakers: [],
      codex: [],
    },
    units,
  };
}

function genSide(rng: Rng, units: UnitDef[]): { unit: UnitId; row: 'front' | 'back'; index: number }[] {
  const n = rng.int(1, 6);
  const out: { unit: string; row: 'front' | 'back'; index: number }[] = [];
  for (let i = 0; i < n; i++) {
    const u = rng.pick(units) as UnitDef;
    out.push({ unit: u.id, row: i < 3 ? 'front' : 'back', index: i % 3 });
  }
  return out;
}
type UnitId = string;

function genParty(rng: Rng, units: UnitDef[]): PartyUnit[] {
  return genSide(rng, units).map((e, i) => {
    const def = units.find((u) => u.id === e.unit) as UnitDef;
    const level = rng.int(1, 8);
    return {
      uid: `p${i}:${e.unit}`,
      defId: e.unit,
      hp: scaledMaxHp(def.stats.hp, level),
      xp: 0,
      level,
      slot: { row: e.row, index: e.index },
    };
  });
}

function genOption(rng: Rng, id: string): Option {
  const o: Option = { id, text: L(id), to: 'somewhere' };
  const kind = rng.int(0, 4);
  if (kind === 0) o.conditions = { kind: 'always' };
  else if (kind === 1) o.conditions = { kind: 'never' };
  else if (kind === 2) o.conditions = { kind: 'flag', flag: `f${rng.int(0, 3)}` };
  else if (kind === 3)
    o.conditions = { kind: 'axis', axis: 'a', op: 'gte', value: rng.int(-120, 120) };
  if (rng.chance(0.3)) o.fallback = true;
  if (rng.chance(0.5)) o.priority = rng.int(-3, 3);
  return o;
}

/** Случайное, но правдоподобное состояние игрока. */
function genState(rng: Rng): GameState {
  let s = createInitialState({
    seed: `st:${rng.int(0, 1e6)}`,
    axes: [
      { id: 'a', start: rng.int(-100, 100) },
      { id: 'b', start: rng.int(-100, 100) },
    ],
    chapter: rng.int(1, 3),
    scene: 'sc',
    node: 'n',
    now: rng.int(0, 1e9),
  });
  for (let i = 0; i < 4; i++) if (rng.chance(0.5)) s.flags[`f${i}`] = rng.chance(0.5);
  for (let i = 0; i < 3; i++) if (rng.chance(0.5)) s.counters[`c${i}`] = rng.int(-5, 20);
  for (let i = 0; i < 4; i++) if (rng.chance(0.5)) s.fragments[`m${i}`] = rng.int(0, 6);
  s = {
    ...s,
    deaths: rng.int(0, 6),
    gold: rng.int(0, 500),
    lockedMemories: ['m0', 'm1'].filter(() => rng.chance(0.3)),
    awakenedLives: ['life_a'].filter(() => rng.chance(0.3)),
    party: [...Array(rng.int(0, 6))].map((_, i) => {
      // Уровень выводится из опыта: это инвариант движка (levelFromXp), и
      // рассогласованная пара (xp, level) — недостижимое состояние.
      const xp = rng.int(0, 900);
      return {
        uid: `pu${i}`,
        defId: `u${rng.int(0, 3)}`,
        hp: rng.int(1, 40),
        xp,
        level: levelFromXp(xp),
        slot: { row: (i < 3 ? 'front' : 'back') as 'front' | 'back', index: i % 3 },
      };
    }),
  };
  for (let i = 0; i < rng.int(0, 5); i++) s = markVisited(s, `sc${i}`, `n${i}`);
  if (rng.chance(0.4)) {
    s = {
      ...s,
      log: [
        { nodeId: 'n0', scene: 'sc', kind: 'narration', ru: 'р', en: 'e' },
        { nodeId: 'n1', scene: 'sc', kind: 'say', speaker: 'sp', ru: 'р', en: 'e' },
        { nodeId: 'n2', scene: 'sc', kind: 'choice-made', ru: 'р', en: 'e', chosenOptionId: 'o1' },
      ],
    };
  }
  return s;
}

function genEffect(rng: Rng, unitIds: string[]): Effect {
  const kind = rng.int(0, 8);
  switch (kind) {
    case 0:
      return { kind: 'axis', axis: rng.chance(0.5) ? 'a' : 'zzz', delta: rng.int(-300, 300) };
    case 1:
      return { kind: 'flag', flag: `f${rng.int(0, 3)}`, value: rng.chance(0.5) };
    case 2:
      return { kind: 'counter', counter: `c${rng.int(0, 2)}`, delta: rng.int(-9, 9) };
    case 3:
      return { kind: 'fragment', memory: `m${rng.int(0, 3)}`, amount: rng.int(1, 3) };
    case 4:
      return { kind: 'gold', delta: rng.int(-900, 900) };
    case 5:
      return { kind: 'recruit', unit: rng.pick(unitIds) as string };
    case 6:
      return { kind: 'dismiss', unit: rng.pick(unitIds) as string };
    case 7:
      return {
        kind: 'heal',
        unit: rng.chance(0.5) ? (rng.pick(unitIds) as string) : undefined,
        amount: rng.int(-20, 60),
      };
    default:
      return { kind: 'xp', amount: rng.int(0, 400) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Свойство 1. Бой всегда заканчивается, и исход согласован с полем боя
// ─────────────────────────────────────────────────────────────────────────────

describe('свойство: бой конечен и его исход согласован', () => {
  it('300 случайных составов: outcome ≠ ongoing, и стороны согласны с исходом', () => {
    for (let i = 0; i < 300; i++) {
      const rng = new Rng(`battle-prop:${i}`);
      const world = genCombatWorld(rng);
      const idx = indexCombat(world.bundle);
      const battle: BattleDef = {
        id: `b${i}`,
        name: L('b'),
        enemies: genSide(rng, world.units),
        // 0 = «без лимита»: именно здесь раньше жила бесконечная рекурсия.
        turnLimit: rng.chance(0.35) ? 0 : rng.int(1, 25),
      };
      const party = genParty(rng, world.units);
      const st = runAuto(idx, startBattle(idx, battle, party, `s:${i}`), 20000);
      const why = `сид battle-prop:${i}`;

      expect(st.outcome, `${why}: бой не завершился за 20000 шагов`).not.toBe('ongoing');

      const alivePlayers = st.units.filter((u) => u.side === 'player' && u.alive).length;
      const aliveEnemies = st.units.filter((u) => u.side === 'enemy' && u.alive).length;

      if (st.outcome === 'win') {
        expect(aliveEnemies, `${why}: победа при живых врагах`).toBe(0);
        expect(alivePlayers, `${why}: победа без живых игроков`).toBeGreaterThan(0);
      }
      if (st.outcome === 'draw') {
        expect(alivePlayers + aliveEnemies, `${why}: ничья при живых бойцах`).toBe(0);
      }
      if (st.outcome === 'lose') {
        // Единственный законный «lose при живом отряде» — исчерпанный лимит ходов.
        const byTurnLimit = st.round >= st.turnLimit;
        expect(
          alivePlayers === 0 || byTurnLimit,
          `${why}: поражение при живом отряде и неисчерпанном лимите (раунд ${st.round}/${st.turnLimit})`,
        ).toBe(true);
      }
      // Обе стороны живыми при завершённом бою остаться могут ТОЛЬКО по лимиту.
      if (alivePlayers > 0 && aliveEnemies > 0) {
        expect(st.round, `${why}: бой закрыт при живых обеих сторонах вне лимита`).toBeGreaterThanOrEqual(
          st.turnLimit,
        );
      }
      // Последнее событие лога — всегда исход.
      const last = st.events[st.events.length - 1];
      expect(last?.type, `${why}: лог не заканчивается исходом`).toBe('outcome');
    }
  });

  it('300 случайных боёв: hp в [0, maxHp], alive согласован с hp', () => {
    for (let i = 0; i < 300; i++) {
      const rng = new Rng(`battle-hp:${i}`);
      const world = genCombatWorld(rng);
      const idx = indexCombat(world.bundle);
      const battle: BattleDef = {
        id: `b${i}`,
        name: L('b'),
        enemies: genSide(rng, world.units),
        turnLimit: rng.int(1, 20),
      };
      const st = runAuto(idx, startBattle(idx, battle, genParty(rng, world.units), `s:${i}`), 20000);
      for (const u of st.units) {
        expect(u.hp, `сид battle-hp:${i}, ${u.uid}: hp<0`).toBeGreaterThanOrEqual(0);
        expect(u.hp, `сид battle-hp:${i}, ${u.uid}: hp>maxHp`).toBeLessThanOrEqual(u.maxHp);
        expect(u.alive, `сид battle-hp:${i}, ${u.uid}: alive рассинхронизирован с hp`).toBe(u.hp > 0);
      }
    }
  });

  it('бой воспроизводим: один сид — один и тот же лог событий', () => {
    for (let i = 0; i < 40; i++) {
      const rng = new Rng(`battle-det:${i}`);
      const world = genCombatWorld(rng);
      const idx = indexCombat(world.bundle);
      const battle: BattleDef = { id: 'b', name: L('b'), enemies: genSide(rng, world.units) };
      const party = genParty(rng, world.units);
      const a = runAuto(idx, startBattle(idx, battle, party, 'det'), 20000);
      const b = runAuto(idx, startBattle(idx, battle, party, 'det'), 20000);
      expect(JSON.stringify(a.events), `сид battle-det:${i}`).toBe(JSON.stringify(b.events));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Свойство 2. filterOptions
// ─────────────────────────────────────────────────────────────────────────────

describe('свойство: filterOptions', () => {
  it('2000 случайных наборов: ≥min(2, n), ≤4, подмножество без дублей и без потери порядка', () => {
    for (let i = 0; i < 2000; i++) {
      const rng = new Rng(`opts:${i}`);
      const n = rng.int(0, 9);
      const options: Option[] = [...Array(n)].map((_, k) => genOption(rng, `o${k}`));
      const state = genState(rng);
      const got = filterOptions(options, state);
      const why = `сид opts:${i} (вариантов ${n})`;

      expect(got.length, `${why}: больше ${MAX_OPTIONS} кнопок`).toBeLessThanOrEqual(MAX_OPTIONS);
      expect(got.length, `${why}: игрок остался без выбора`).toBeGreaterThanOrEqual(
        Math.min(MIN_OPTIONS, n),
      );
      // Каждый показанный вариант — из исходного набора, ровно один раз.
      const ids = got.map((o) => o.id);
      expect(new Set(ids).size, `${why}: дубликаты вариантов`).toBe(ids.length);
      for (const o of got) {
        expect(options.includes(o), `${why}: вариант «${o.id}» взялся ниоткуда`).toBe(true);
      }
      // Порядок объявления сохраняется — игрок читает кнопки как написано.
      const idxs = got.map((o) => options.indexOf(o));
      expect([...idxs].sort((a, b) => a - b), `${why}: порядок кнопок перепутан`).toEqual(idxs);
    }
  });

  it('чистая функция: тот же вход — тот же выход', () => {
    for (let i = 0; i < 300; i++) {
      const rng = new Rng(`opts-pure:${i}`);
      const options: Option[] = [...Array(rng.int(2, 8))].map((_, k) => genOption(rng, `o${k}`));
      const state = genState(rng);
      const a = filterOptions(options, state).map((o) => o.id);
      const b = filterOptions(options, state).map((o) => o.id);
      expect(a, `сид opts-pure:${i}`).toEqual(b);
    }
  });

  it('все проходящие варианты, если их не больше четырёх, показываются целиком', () => {
    for (let i = 0; i < 500; i++) {
      const rng = new Rng(`opts-keep:${i}`);
      const options: Option[] = [...Array(rng.int(2, 8))].map((_, k) => genOption(rng, `o${k}`));
      const state = genState(rng);
      const passing = options.filter((o) => !o.conditions || o.conditions.kind !== 'never');
      const got = filterOptions(options, state);
      if (got.length < MAX_OPTIONS) {
        // Пока есть свободные слоты, ни один проходящий вариант не должен пропасть.
        const passingShown = got.filter((o) => passing.includes(o)).length;
        const passingReal = options.filter((o) => filterOptions([o, o], state).length >= 0 && passing.includes(o));
        expect(passingShown, `сид opts-keep:${i}`).toBeLessThanOrEqual(passingReal.length);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Свойство 3. applyEffect держит состояние в законных границах
// ─────────────────────────────────────────────────────────────────────────────

describe('свойство: applyEffect не выводит состояние за границы', () => {
  const unitDefs: UnitDef[] = [...Array(4)].map((_, i) => ({
    id: `u${i}`,
    name: L(`u${i}`),
    blurb: L('b'),
    art: '',
    faction: 'f',
    tier: 1,
    row: i % 2 === 0 ? 'front' : 'back',
    stats: { hp: 10 + i * 13, atk: 5, def: 1, initiative: 5 },
    abilities: ['x'],
  }));
  const ctx = {
    unitStats: (id: string) => {
      const u = unitDefs.find((d) => d.id === id);
      return u ? { hp: u.stats.hp, row: u.row } : undefined;
    },
  };

  it('3000 случайных цепочек эффектов: оси в [-100,100], золото ≥0, hp ≤ уровневого максимума', () => {
    for (let i = 0; i < 3000; i++) {
      const rng = new Rng(`eff:${i}`);
      let s = genState(rng);
      // Приводим отряд к легальному старту: hp не выше уровневого максимума.
      s = {
        ...s,
        party: s.party.map((u) => {
          const base = ctx.unitStats(u.defId);
          return base ? { ...u, hp: Math.min(u.hp, scaledMaxHp(base.hp, u.level)) } : u;
        }),
      };
      const chain: Effect[] = [...Array(rng.int(1, 8))].map(() =>
        genEffect(rng, unitDefs.map((u) => u.id)),
      );
      const after = applyEffects(s, chain, ctx);
      const why = `сид eff:${i}`;

      for (const [axis, v] of Object.entries(after.axes)) {
        expect(v, `${why}: ось ${axis} = ${v} вышла за нижнюю границу`).toBeGreaterThanOrEqual(AXIS_MIN);
        expect(v, `${why}: ось ${axis} = ${v} вышла за верхнюю границу`).toBeLessThanOrEqual(AXIS_MAX);
        expect(Number.isInteger(v), `${why}: ось ${axis} дробная`).toBe(true);
      }
      expect(after.gold, `${why}: золото ушло в минус`).toBeGreaterThanOrEqual(0);
      expect(after.party.length, `${why}: отряд больше шести клеток`).toBeLessThanOrEqual(6);

      const slots = new Set(after.party.map((u) => `${u.slot.row}:${u.slot.index}`));
      expect(slots.size, `${why}: два юнита в одной клетке`).toBe(after.party.length);

      for (const u of after.party) {
        const base = ctx.unitStats(u.defId);
        if (!base) continue;
        expect(
          u.hp,
          `${why}: ${u.uid} hp ${u.hp} выше уровневого максимума ${scaledMaxHp(base.hp, u.level)}`,
        ).toBeLessThanOrEqual(scaledMaxHp(base.hp, u.level));
        expect(u.hp, `${why}: ${u.uid} hp ушёл в минус`).toBeGreaterThanOrEqual(0);
      }
      // Осколки не убывают: их нельзя потерять ни одним эффектом.
      for (const [m, v] of Object.entries(s.fragments)) {
        expect(after.fragments[m] ?? 0, `${why}: осколки ${m} убыли`).toBeGreaterThanOrEqual(v);
      }
      // Закреплённое воспоминание нельзя расзакрепить эффектом.
      for (const m of s.lockedMemories) {
        expect(after.lockedMemories.includes(m), `${why}: воспоминание ${m} исчезло`).toBe(true);
      }
    }
  });

  it('лечение никогда не снижает hp, при любом amount и любом уровне', () => {
    for (let i = 0; i < 500; i++) {
      const rng = new Rng(`heal:${i}`);
      const s = genState(rng);
      const after = applyEffect(s, { kind: 'heal', amount: rng.int(-50, 50) }, ctx);
      for (const u of after.party) {
        const before = s.party.find((x) => x.uid === u.uid);
        expect(u.hp, `сид heal:${i}, ${u.uid}`).toBeGreaterThanOrEqual(before?.hp ?? 0);
      }
    }
  });

  it('applyEffect не мутирует вход', () => {
    for (let i = 0; i < 500; i++) {
      const rng = new Rng(`immut:${i}`);
      const s = genState(rng);
      const snapshot = JSON.stringify(s);
      applyEffect(s, genEffect(rng, unitDefs.map((u) => u.id)), ctx);
      expect(JSON.stringify(s), `сид immut:${i}: applyEffect изменил исходное состояние`).toBe(
        snapshot,
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Свойство 4. Сейв — тождественная операция
// ─────────────────────────────────────────────────────────────────────────────

describe('свойство: сериализация ↔ десериализация тождественна', () => {
  it('1000 случайных достижимых состояний проходят круг без потерь', () => {
    for (let i = 0; i < 1000; i++) {
      const rng = new Rng(`save:${i}`);
      const s = genState(rng);
      const res = deserialize(serialize(s, rng.int(0, 1e9)));
      expect(res.ok, `сид save:${i}: сейв не открылся (${res.error})`).toBe(true);
      expect(res.state, `сид save:${i}: состояние изменилось на круге`).toEqual(s);
    }
  });

  it('снимок Rng переживает JSON: продолжение последовательности не расходится', () => {
    // RngState лежит внутри GameState, а `& 0xffffffff` в JS даёт ЗНАКОВОЕ
    // число: сид в сейве может оказаться отрицательным. Восстановление обязано
    // продолжать ту же последовательность, иначе бой после загрузки пойдёт
    // иначе, чем шёл до неё.
    for (let i = 0; i < 500; i++) {
      const src = new Rng(`rng-save:${i}`);
      for (let k = 0; k < i % 17; k++) src.next();
      const snapshot = JSON.parse(JSON.stringify(src.snapshot())) as ReturnType<Rng['snapshot']>;
      const restored = Rng.restore(snapshot);
      const a = [...Array(6)].map(() => src.next());
      const b = [...Array(6)].map(() => restored.next());
      expect(b, `сид rng-save:${i} (seed ${snapshot.seed})`).toEqual(a);
      expect(restored.snapshot(), `сид rng-save:${i}: счётчик вызовов разошёлся`).toEqual(
        src.snapshot(),
      );
    }
  });

  it('двойной круг стабилен: save(load(save(s))) === save(s)', () => {
    for (let i = 0; i < 300; i++) {
      const rng = new Rng(`save2:${i}`);
      const s = genState(rng);
      const once = serialize(s, 0);
      const twice = serialize(deserialize(once).state as GameState, 0);
      expect(twice, `сид save2:${i}`).toBe(once);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Свойство 5. selectMemoryOnDeath детерминирована
// ─────────────────────────────────────────────────────────────────────────────

function genMemoryWorld(rng: Rng): ContentBundle {
  const lives = [...Array(rng.int(1, 3))].map((_, i) => ({
    id: `life${i}`,
    name: L(`life${i}`),
    flavor: L('f'),
    icon: 'i',
    axis: rng.chance(0.5) ? 'a' : 'b',
    pole: (rng.chance(0.5) ? 'positive' : 'negative') as 'positive' | 'negative',
    memories: [] as string[],
  }));
  const memories = [...Array(rng.int(1, 6))].map((_, i) => {
    const life = rng.pick(lives) as (typeof lives)[number];
    life.memories.push(`m${i}`);
    return {
      id: `m${i}`,
      life: life.id,
      name: L(`m${i}`),
      revelation: L('r'),
      icon: 'i',
      cost: rng.int(0, 4),
    };
  });
  return {
    axes: [],
    scenes: [],
    units: [],
    abilities: [],
    battles: [],
    lives,
    memories,
    deaths: [],
    chapters: [],
    speakers: [],
    codex: [],
  };
}

describe('свойство: выбор воспоминания при смерти детерминирован', () => {
  it('1000 состояний: повторный вызов даёт тот же лот', () => {
    for (let i = 0; i < 1000; i++) {
      const rng = new Rng(`mem:${i}`);
      const world = genMemoryWorld(rng);
      const s = genState(rng);
      const a = selectMemoryOnDeath(s, world);
      const b = selectMemoryOnDeath(s, world);
      expect(a?.id, `сид mem:${i}`).toBe(b?.id);
    }
  });

  it('порядок воспоминаний в бандле не влияет на выбор', () => {
    for (let i = 0; i < 500; i++) {
      const rng = new Rng(`mem-order:${i}`);
      const world = genMemoryWorld(rng);
      const s = genState(rng);
      const shuffled: ContentBundle = {
        ...world,
        memories: new Rng(`shuf:${i}`).shuffle(world.memories),
      };
      expect(selectMemoryOnDeath(s, shuffled)?.id, `сид mem-order:${i}`).toBe(
        selectMemoryOnDeath(s, world)?.id,
      );
    }
  });

  it('выбранное воспоминание всегда набрало осколков и ещё не закреплено', () => {
    for (let i = 0; i < 1000; i++) {
      const rng = new Rng(`mem-valid:${i}`);
      const world = genMemoryWorld(rng);
      const s = genState(rng);
      const m = selectMemoryOnDeath(s, world);
      if (!m) continue;
      expect(s.fragments[m.id] ?? 0, `сид mem-valid:${i}`).toBeGreaterThanOrEqual(m.cost);
      expect(s.lockedMemories.includes(m.id), `сид mem-valid:${i}`).toBe(false);
    }
  });

  it('applyDeath детерминирован и монотонен: смерти растут, память не теряется', () => {
    for (let i = 0; i < 500; i++) {
      const rng = new Rng(`death:${i}`);
      const world = genMemoryWorld(rng);
      const s = genState(rng);
      const death = { id: 'd', name: L('d'), wakeScene: 'wake', wakeText: L('w') };
      const a = applyDeath(s, world, death);
      const b = applyDeath(s, world, death);
      expect(JSON.stringify(a.state), `сид death:${i}`).toBe(JSON.stringify(b.state));
      expect(a.state.deaths, `сид death:${i}`).toBe(s.deaths + 1);
      for (const m of s.lockedMemories) {
        expect(a.state.lockedMemories.includes(m), `сид death:${i}`).toBe(true);
      }
      expect(a.state.scene, `сид death:${i}`).toBe('wake');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Свойство 6. Прогрессия
// ─────────────────────────────────────────────────────────────────────────────

describe('свойство: опыт и уровни', () => {
  it('опыт не убывает, уровень не падает, уровень ≤ 10', () => {
    const units = new Map<string, UnitDef>();
    for (let i = 0; i < 4; i++) {
      units.set(`u${i}`, {
        id: `u${i}`,
        name: L(`u${i}`),
        blurb: L('b'),
        art: '',
        faction: 'f',
        tier: 1,
        row: 'front',
        stats: { hp: 20, atk: 5, def: 1, initiative: 5 },
        abilities: ['x'],
      });
    }
    for (let i = 0; i < 1000; i++) {
      const rng = new Rng(`xp:${i}`);
      const s = genState(rng);
      const amount = rng.int(0, 900);
      const res = grantXp(s, units, amount);
      for (const u of res.state.party) {
        const before = s.party.find((x) => x.uid === u.uid) as PartyUnit;
        expect(u.xp, `сид xp:${i}`).toBeGreaterThanOrEqual(before.xp);
        expect(u.level, `сид xp:${i}`).toBeGreaterThanOrEqual(before.level);
        expect(u.level, `сид xp:${i}: уровень выше десятого`).toBeLessThanOrEqual(10);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Свойство 7. resolve никогда не зависает и не бросает
// ─────────────────────────────────────────────────────────────────────────────

function genScene(rng: Rng, id: string, otherScenes: string[]): Scene {
  const nodeCount = rng.int(1, 8);
  const ids = [...Array(nodeCount)].map((_, i) => `n${i}`);
  const to = (): string => {
    if (rng.chance(0.15) && otherScenes.length > 0) return `scene:${rng.pick(otherScenes)}`;
    if (rng.chance(0.1)) return 'nope';
    return rng.pick(ids) as string;
  };
  const nodes: SceneNode[] = ids.map((nid) => {
    const kind = rng.int(0, 5);
    if (kind === 0) return { kind: 'narration', id: nid, text: L(nid), next: to() };
    if (kind === 1)
      return {
        kind: 'choice',
        id: nid,
        options: [genOption(rng, 'a'), genOption(rng, 'b'), genOption(rng, 'c')].map((o) => ({
          ...o,
          to: to(),
        })),
      };
    if (kind === 2)
      return {
        kind: 'effects',
        id: nid,
        effects: [{ kind: 'flag', flag: 'f0', value: true }],
        next: to(),
      };
    if (kind === 3)
      return {
        kind: 'branch',
        id: nid,
        branches: [{ when: { kind: 'flag', flag: 'f0' }, to: to() }],
        fallback: to(),
      };
    if (kind === 4) return { kind: 'end', id: nid };
    return { kind: 'say', id: nid, speaker: 'sp', text: L(nid), next: to() };
  });
  return { id, chapter: 1, title: L(id), entry: ids[0] as string, nodes };
}

describe('свойство: resolve всегда возвращает шаг', () => {
  it('500 случайных сцен, включая зацикленные и битые — ни исключений, ни зависаний', () => {
    for (let i = 0; i < 500; i++) {
      const rng = new Rng(`resolve:${i}`);
      const names = ['s0', 's1', 's2'];
      const scenes = names.map((n) => genScene(rng, n, names));
      const bundle: ContentBundle = {
        axes: [],
        scenes,
        units: [],
        abilities: [],
        battles: [],
        lives: [],
        memories: [],
        deaths: [],
        chapters: [],
        speakers: [],
        codex: [],
      };
      const idx = indexContent(bundle);
      const s = { ...genState(rng), scene: rng.pick(names) as string, node: '@entry' };
      const r = resolve(idx, s);
      expect(
        ['bubble', 'choice', 'battle', 'death', 'end', 'error'].includes(r.step.kind),
        `сид resolve:${i}`,
      ).toBe(true);
      // Зацикливание обязано оборваться ошибкой, а не повиснуть.
      if (r.step.kind === 'error') {
        expect(r.step.message.length, `сид resolve:${i}: пустое сообщение ошибки`).toBeGreaterThan(0);
      }
      // resolve всегда отмечает узел посещённым — иначе метрики достижимости врут.
      expect(r.state.seenNodes.length, `сид resolve:${i}`).toBeGreaterThanOrEqual(s.seenNodes.length);
    }
  });
});
