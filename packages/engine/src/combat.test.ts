import { describe, expect, it } from 'vitest';
import {
  ARMOR_K,
  act,
  commonActions,
  COVER_ABILITY_ID,
  beginRound,
  computeDamage,
  currentActor,
  effectiveStat,
  indexCombat,
  isStunned,
  legalTargets,
  readyAbilities,
  runAuto,
  scaleStats,
  shieldOf,
  startBattle,
  type BattleState,
} from './combat.js';
import { Rng } from './rng.js';
import type { Ability, BattleDef, ContentBundle, PartyUnit, UnitDef } from './types.js';

const t = (ru: string) => ({ ru, en: ru });

const abilities: Ability[] = [
  { id: 'hit', name: t('Удар'), description: t('Удар'), icon: 'sword', target: 'enemy_front', power: 1, cooldown: 0 },
  { id: 'burst', name: t('Замах'), description: t('Замах'), icon: 'hammer', target: 'enemy_front', power: 2, cooldown: 2 },
  { id: 'reach', name: t('Багор'), description: t('Багор'), icon: 'bow', target: 'enemy_any', power: 1, cooldown: 0 },
  {
    id: 'pierce',
    name: t('Насквозь'),
    description: t('Насквозь'),
    icon: 'dagger',
    target: 'enemy_front',
    power: 1,
    cooldown: 0,
    piercing: true,
  },
  {
    id: 'guard',
    name: t('Заслон'),
    description: t('Заслон'),
    icon: 'shield',
    target: 'self',
    power: 0,
    cooldown: 3,
    effects: [{ kind: 'shield', amount: 20, turns: 2 }],
  },
  {
    id: 'mend',
    name: t('Ветошь'),
    description: t('Ветошь'),
    icon: 'heal',
    target: 'ally_one',
    power: 0,
    cooldown: 1,
    effects: [{ kind: 'heal', power: 1 }],
  },
];

function unitDef(id: string, over: Partial<UnitDef> & { stats: UnitDef['stats']; row: UnitDef['row'] }): UnitDef {
  return {
    id,
    name: t(id),
    blurb: t(id),
    art: '',
    faction: 'test',
    tier: 1,
    abilities: ['hit'],
    ...over,
  };
}

const units: UnitDef[] = [
  unitDef('bruiser', { row: 'front', stats: { hp: 40, atk: 10, def: 5, initiative: 10 }, abilities: ['hit', 'burst'] }),
  unitDef('archer', { row: 'back', stats: { hp: 30, atk: 9, def: 3, initiative: 12 }, abilities: ['reach'] }),
  unitDef('wall', { row: 'front', stats: { hp: 50, atk: 6, def: 8, initiative: 6 }, abilities: ['guard', 'hit'] }),
  unitDef('glass', { row: 'back', stats: { hp: 10, atk: 5, def: 0, initiative: 5 }, abilities: ['hit'] }),
  unitDef('slayer', { row: 'front', stats: { hp: 200, atk: 100, def: 20, initiative: 20 }, abilities: ['hit'] }),
  unitDef('titan', { row: 'front', stats: { hp: 5000, atk: 1, def: 40, initiative: 5 }, abilities: ['hit'] }),
  unitDef('needle', { row: 'back', stats: { hp: 26, atk: 8, def: 2, initiative: 11 }, abilities: ['pierce'] }),
  unitDef('medic', { row: 'back', stats: { hp: 28, atk: 8, def: 4, initiative: 9 }, abilities: ['mend', 'reach'] }),
];

const bundle: ContentBundle = {
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
};

const idx = indexCombat(bundle);

function party(...specs: [string, 'front' | 'back', number][]): PartyUnit[] {
  return specs.map(([defId, row, index], i) => {
    const def = units.find((u) => u.id === defId);
    return {
      uid: `p${i}:${defId}`,
      defId,
      hp: def?.stats.hp ?? 1,
      xp: 0,
      level: 1,
      slot: { row, index },
    };
  });
}

function battle(id: string, enemies: BattleDef['enemies'], turnLimit?: number): BattleDef {
  return turnLimit === undefined
    ? { id, name: t(id), enemies }
    : { id, name: t(id), enemies, turnLimit };
}

const stripEvents = (s: BattleState) => JSON.stringify(s.events);

describe('scaleStats', () => {
  it('первый уровень не масштабирует', () => {
    const def = units.find((u) => u.id === 'bruiser') as UnitDef;
    expect(scaleStats(def, 1)).toEqual({ hp: 40, atk: 10, def: 5, initiative: 10 });
  });

  it('уровень 5 — +48% hp/atk, +32% def, инициатива не растёт', () => {
    const def = units.find((u) => u.id === 'bruiser') as UnitDef;
    expect(scaleStats(def, 5)).toEqual({ hp: 59, atk: 15, def: 7, initiative: 10 });
  });

  it('уровень ниже единицы приравнивается к первому', () => {
    const def = units.find((u) => u.id === 'wall') as UnitDef;
    expect(scaleStats(def, 0)).toEqual(scaleStats(def, 1));
  });
});

describe('computeDamage', () => {
  it('держится в коридоре формулы atk*power*K/(K+def) с разбросом и критом', () => {
    const s = startBattle(idx, battle('b', [['glass', 'back', 0] as const].map(([u, r, i]) => ({ unit: u, row: r, index: i }))), party(['bruiser', 'front', 0]), 'dmg');
    const attacker = s.units.find((u) => u.side === 'player');
    const target = s.units.find((u) => u.side === 'enemy');
    if (!attacker || !target) throw new Error('фикстура сломана');
    const base = (attacker.atk * 1 * ARMOR_K) / (ARMOR_K + target.def);
    const rng = new Rng('dmg-rolls');
    let crits = 0;
    for (let i = 0; i < 300; i++) {
      const { amount, crit } = computeDamage(rng, attacker, target, 1);
      if (crit) crits++;
      expect(amount).toBeGreaterThanOrEqual(Math.floor(base * 0.88));
      expect(amount).toBeLessThanOrEqual(Math.ceil(base * 1.12 * 1.5));
    }
    expect(crits).toBeGreaterThan(0);
    expect(crits).toBeLessThan(120);
  });

  it('урон никогда не меньше единицы', () => {
    const s = startBattle(idx, battle('b2', [{ unit: 'titan', row: 'front', index: 0 }]), party(['titan', 'front', 0]), 'min');
    const a = s.units[0];
    const b = s.units[1];
    if (!a || !b) throw new Error('фикстура сломана');
    const rng = new Rng('min-rolls');
    for (let i = 0; i < 50; i++) expect(computeDamage(rng, a, b, 0.01).amount).toBeGreaterThanOrEqual(1);
  });
});

describe('правило строя', () => {
  const b = battle('row', [
    { unit: 'bruiser', row: 'front', index: 0 },
    { unit: 'archer', row: 'back', index: 0 },
  ]);

  it('ближний бой видит только передний ряд, пока тот жив', () => {
    const s = startBattle(idx, b, party(['bruiser', 'front', 0]), 'row');
    const me = s.units.find((u) => u.side === 'player');
    if (!me) throw new Error('нет игрока');
    const hit = abilities.find((a) => a.id === 'hit') as Ability;
    const targets = legalTargets(s, me.uid, hit);
    expect(targets.map((x) => x.defId)).toEqual(['bruiser']);
  });

  it('пустой передний ряд открывает задний', () => {
    const s0 = startBattle(idx, b, party(['bruiser', 'front', 0]), 'row');
    const s: BattleState = {
      ...s0,
      units: s0.units.map((u) => (u.side === 'enemy' && u.row === 'front' ? { ...u, alive: false, hp: 0 } : u)),
    };
    const me = s.units.find((u) => u.side === 'player');
    if (!me) throw new Error('нет игрока');
    const hit = abilities.find((a) => a.id === 'hit') as Ability;
    expect(legalTargets(s, me.uid, hit).map((x) => x.defId)).toEqual(['archer']);
  });

  it('enemy_any достаёт задний ряд сразу', () => {
    const s = startBattle(idx, b, party(['archer', 'back', 0]), 'row');
    const me = s.units.find((u) => u.side === 'player');
    if (!me) throw new Error('нет игрока');
    const reach = abilities.find((a) => a.id === 'reach') as Ability;
    expect(legalTargets(s, me.uid, reach)).toHaveLength(2);
  });

  it('piercing обходит прикрытие', () => {
    const s = startBattle(idx, b, party(['needle', 'back', 0]), 'row');
    const me = s.units.find((u) => u.side === 'player');
    if (!me) throw new Error('нет игрока');
    const pierce = abilities.find((a) => a.id === 'pierce') as Ability;
    expect(legalTargets(s, me.uid, pierce)).toHaveLength(2);
  });

  it('союзные цели не пересекаются с вражескими', () => {
    const s = startBattle(idx, b, party(['medic', 'back', 0], ['bruiser', 'front', 0]), 'row');
    const me = s.units.find((u) => u.defId === 'medic');
    if (!me) throw new Error('нет лекаря');
    const mend = abilities.find((a) => a.id === 'mend') as Ability;
    expect(legalTargets(s, me.uid, mend).every((u) => u.side === 'player')).toBe(true);
  });
});

describe('детерминизм боя', () => {
  const b = battle('det', [
    { unit: 'bruiser', row: 'front', index: 0 },
    { unit: 'wall', row: 'front', index: 1 },
    { unit: 'archer', row: 'back', index: 0 },
  ]);
  const p = party(['bruiser', 'front', 0], ['wall', 'front', 1], ['archer', 'back', 0]);

  it('два прогона одного сида дают одинаковый лог событий', () => {
    const a = runAuto(idx, startBattle(idx, b, p, 'seed-42'));
    const c = runAuto(idx, startBattle(idx, b, p, 'seed-42'));
    expect(stripEvents(a)).toEqual(stripEvents(c));
    expect(a.outcome).toBe(c.outcome);
  });

  it('очередь хода воспроизводима, ничьи по инициативе разводятся сидом', () => {
    const s1 = startBattle(idx, b, p, 'order');
    const s2 = startBattle(idx, b, p, 'order');
    expect(s1.order).toEqual(s2.order);
    expect(s1.order).toHaveLength(6);
  });

  it('разные сиды дают разные бои', () => {
    const logs = new Set(
      ['s1', 's2', 's3', 's4', 's5'].map((seed) => stripEvents(runAuto(idx, startBattle(idx, b, p, seed)))),
    );
    expect(logs.size).toBeGreaterThan(1);
  });
});

describe('исходы', () => {
  it('победа: враг умирает, в логе есть death и outcome', () => {
    const s = runAuto(
      idx,
      startBattle(idx, battle('kill', [{ unit: 'glass', row: 'front', index: 0 }]), party(['slayer', 'front', 0]), 'kill'),
    );
    expect(s.outcome).toBe('win');
    expect(s.events.some((e) => e.type === 'death')).toBe(true);
    expect(s.events.at(-1)).toEqual({ type: 'outcome', result: 'win' });
  });

  it('поражение по лимиту раундов', () => {
    const s = runAuto(
      idx,
      startBattle(idx, battle('stall', [{ unit: 'titan', row: 'front', index: 0 }], 3), party(['titan', 'front', 0]), 'stall'),
    );
    expect(s.outcome).toBe('lose');
    expect(s.round).toBeLessThanOrEqual(3);
  });

  it('обоюдная гибель от dot при бое без лимита — ничья, а не переполнение стека', () => {
    // turnLimit: 0 означает «без лимита». До починки пустая очередь раунда
    // заводила beginRound рекурсивно до исчерпания стека.
    const s0 = startBattle(
      idx,
      battle('wipe', [{ unit: 'wall', row: 'front', index: 0 }], 0),
      party(['glass', 'back', 0]),
      'wipe',
    );
    const doomed: BattleState = {
      ...s0,
      units: s0.units.map((u) => ({ ...u, statuses: [{ kind: 'dot' as const, amount: 9999, turns: 3 }] })),
    };
    const s = beginRound(idx, doomed);
    expect(s.outcome).toBe('draw');
    expect(s.events.at(-1)).toEqual({ type: 'outcome', result: 'draw' });
  });

  it('dot в начале раунда убивает и закрывает бой', () => {
    const s0 = startBattle(idx, battle('dot', [{ unit: 'wall', row: 'front', index: 0 }]), party(['glass', 'back', 0]), 'dot');
    const poisoned: BattleState = {
      ...s0,
      units: s0.units.map((u) =>
        u.side === 'player' ? { ...u, statuses: [{ kind: 'dot' as const, amount: 999, turns: 2 }] } : u,
      ),
    };
    const s = beginRound(idx, poisoned);
    expect(s.units.find((u) => u.side === 'player')?.alive).toBe(false);
    expect(s.outcome).toBe('lose');
  });
});

describe('статусы и кулдауны', () => {
  const b = battle('fx', [{ unit: 'wall', row: 'front', index: 0 }]);

  it('кулдаун блокирует повторное применение', () => {
    const s0 = startBattle(idx, b, party(['bruiser', 'front', 0]), 'cd');
    const me = currentActor(s0);
    const foe = s0.units.find((u) => u.side === 'enemy');
    if (!me || me.side !== 'player' || !foe) throw new Error('первым должен ходить игрок');
    expect(readyAbilities(idx, me).map((a) => a.id)).toContain('burst');
    const s1 = act(idx, s0, { ability: 'burst', targetUid: foe.uid });
    const meAfter = s1.units.find((u) => u.uid === me.uid);
    if (!meAfter) throw new Error('юнит исчез');
    expect(meAfter.cooldowns['burst']).toBe(2);
    expect(readyAbilities(idx, meAfter).map((a) => a.id)).not.toContain('burst');
    expect(readyAbilities(idx, meAfter).map((a) => a.id)).toContain('hit');
  });

  it('щит съедает урон раньше hp', () => {
    const s0 = startBattle(idx, b, party(['bruiser', 'front', 0]), 'shield');
    const foe = s0.units.find((u) => u.side === 'enemy');
    if (!foe) throw new Error('нет врага');
    const shielded: BattleState = {
      ...s0,
      units: s0.units.map((u) =>
        u.uid === foe.uid ? { ...u, statuses: [{ kind: 'shield' as const, amount: 999, turns: 5 }] } : u,
      ),
    };
    const s1 = act(idx, shielded, { ability: 'hit', targetUid: foe.uid });
    const after = s1.units.find((u) => u.uid === foe.uid);
    if (!after) throw new Error('враг исчез');
    const dmg = s1.events.find((e) => e.type === 'damage');
    expect(dmg && dmg.type === 'damage' ? dmg.amount : 0).toBeGreaterThan(0);
    expect(after.hp).toBe(after.maxHp);
    expect(shieldOf(after)).toBeLessThan(999);
  });

  it('оглушение пропускает ход и оставляет запись в логе', () => {
    const s0 = startBattle(idx, b, party(['bruiser', 'front', 0]), 'stun');
    const foe = s0.units.find((u) => u.side === 'enemy');
    if (!foe) throw new Error('нет врага');
    const stunned: BattleState = {
      ...s0,
      units: s0.units.map((u) =>
        u.uid === foe.uid ? { ...u, statuses: [{ kind: 'stun' as const, amount: 0, turns: 5 }] } : u,
      ),
    };
    expect(isStunned(stunned.units.find((u) => u.uid === foe.uid) as never)).toBe(true);
    const s1 = act(idx, stunned, { ability: 'hit', targetUid: foe.uid });
    expect(
      s1.events.some((e) => e.type === 'blocked' && e.uid === foe.uid && e.reason === 'stun'),
    ).toBe(true);
  });

  it('неизвестная способность блокируется, а не ломает ход', () => {
    const s0 = startBattle(idx, b, party(['bruiser', 'front', 0]), 'bad');
    const s1 = act(idx, s0, { ability: '__net_takoy__' });
    expect(s1.events.some((e) => e.type === 'blocked' && e.reason === 'ability')).toBe(true);
    expect(s1.outcome).toBe('ongoing');
  });

  it('чужая способность из общего реестра блокируется', () => {
    // 'reach' есть в реестре, но bruiser ей не владеет — кулдаун чужой
    // способности не должен читаться как «готова».
    const s0 = startBattle(idx, b, party(['bruiser', 'front', 0]), 'foreign');
    const foe = s0.units.find((u) => u.side === 'enemy');
    const s1 = act(idx, s0, { ability: 'reach', targetUid: foe?.uid });
    expect(s1.events.some((e) => e.type === 'blocked' && e.reason === 'ability')).toBe(true);
    expect(s1.events.some((e) => e.type === 'damage')).toBe(false);
  });

  it('прямой uid заднего ряда не обходит прикрытие переднего', () => {
    const cover = battle('cover', [
      { unit: 'wall', row: 'front', index: 0 },
      { unit: 'glass', row: 'back', index: 0 },
    ]);
    const s0 = startBattle(idx, cover, party(['bruiser', 'front', 0]), 'cover-uid');
    expect(currentActor(s0)?.side).toBe('player');
    const back = s0.units.find((u) => u.side === 'enemy' && u.row === 'back');
    const s1 = act(idx, s0, { ability: 'hit', targetUid: back?.uid });
    expect(s1.events.some((e) => e.type === 'blocked' && e.reason === 'target')).toBe(true);
    expect(s1.events.some((e) => e.type === 'damage')).toBe(false);
  });

  it('мёртвая цель блокирует удар и не сжигает кулдаун', () => {
    const two = battle('deadt', [
      { unit: 'wall', row: 'front', index: 0 },
      { unit: 'glass', row: 'back', index: 0 },
    ]);
    const s0 = startBattle(idx, two, party(['bruiser', 'front', 0]), 'dead-target');
    const glass = s0.units.find((u) => u.defId === 'glass' && u.side === 'enemy');
    if (!glass) throw new Error('нет цели');
    const withDead: BattleState = {
      ...s0,
      units: s0.units.map((u) => (u.uid === glass.uid ? { ...u, alive: false, hp: 0 } : u)),
    };
    expect(currentActor(withDead)?.side).toBe('player');
    const me = currentActor(withDead);
    const s1 = act(idx, withDead, { ability: 'burst', targetUid: glass.uid });
    expect(s1.events.some((e) => e.type === 'blocked' && e.reason === 'target')).toBe(true);
    const after = s1.units.find((u) => u.uid === me?.uid);
    expect(after?.cooldowns['burst']).toBe(0);
  });

  it('effectiveStat складывает бафы и дебафы и не уходит ниже нуля', () => {
    const s = startBattle(idx, b, party(['bruiser', 'front', 0]), 'stat');
    const me = s.units.find((u) => u.side === 'player');
    if (!me) throw new Error('нет игрока');
    const buffed = {
      ...me,
      statuses: [
        { kind: 'buff' as const, stat: 'atk' as const, amount: 4, turns: 2 },
        { kind: 'debuff' as const, stat: 'def' as const, amount: 99, turns: 2 },
      ],
    };
    expect(effectiveStat(buffed, 'atk')).toBe(me.atk + 4);
    expect(effectiveStat(buffed, 'def')).toBe(0);
    expect(effectiveStat(buffed, 'initiative')).toBe(me.initiative);
  });

  it('лечение не поднимает выше максимума', () => {
    const s0 = startBattle(idx, b, party(['medic', 'back', 0], ['bruiser', 'front', 0]), 'heal');
    const medic = s0.units.find((u) => u.defId === 'medic');
    if (!medic) throw new Error('нет лекаря');
    const ordered: BattleState = { ...s0, order: [medic.uid, ...s0.order.filter((u) => u !== medic.uid)], turnIndex: 0 };
    const s1 = act(idx, ordered, { ability: 'mend', targetUid: medic.uid });
    const after = s1.units.find((u) => u.uid === medic.uid);
    expect(after?.hp).toBe(after?.maxHp);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// «Заслонить» (DIRECTION_COMBAT §B.C1)
// ─────────────────────────────────────────────────────────────────────────────

describe('заслон', () => {
  const coverAbility: Ability = {
    id: COVER_ABILITY_ID,
    name: t('Заслонить'),
    description: t('Заслонить'),
    icon: 'shield',
    target: 'ally_one',
    power: 0,
    cooldown: 0,
    effects: [{ kind: 'cover', turns: 2 }],
  };
  const sweep: Ability = {
    id: 'sweep',
    name: t('Оземь'),
    description: t('Оземь'),
    icon: 'hammer',
    target: 'enemy_all',
    power: 1,
    cooldown: 0,
  };
  const sweeper = unitDef('sweeper', {
    row: 'front',
    stats: { hp: 40, atk: 10, def: 5, initiative: 10 },
    abilities: ['sweep'],
  });
  const cBundle: ContentBundle = {
    ...bundle,
    units: [...units, sweeper],
    abilities: [...abilities, coverAbility, sweep],
  };
  const cIdx = indexCombat(cBundle);
  /** Тот же мир, но без записи заслона в контенте: общего действия нет. */
  const plainIdx = indexCombat({ ...cBundle, abilities: [...abilities, sweep] });
  const b = battle('cover', [
    { unit: 'archer', row: 'front', index: 0 },
    { unit: 'sweeper', row: 'front', index: 1 },
  ]);
  const p = party(['wall', 'front', 0], ['glass', 'back', 0], ['archer', 'back', 1]);

  const find = (s: BattleState, defId: string, side: 'player' | 'enemy') => {
    const u = s.units.find((x) => x.defId === defId && x.side === side);
    if (!u) throw new Error(`нет юнита ${defId}/${side}`);
    return u;
  };

  /** Заслон поставлен: `wall` поручился за `wardDef`. Ходит уже кто угодно. */
  function withCover(wardDef: string): BattleState {
    const s0 = startBattle(cIdx, b, p, 'cover-seed');
    const guard = find(s0, 'wall', 'player');
    const ward = find(s0, wardDef, 'player');
    const ordered: BattleState = {
      ...s0,
      order: [guard.uid, ...s0.order.filter((u) => u !== guard.uid)],
      turnIndex: 0,
    };
    return act(cIdx, ordered, { ability: COVER_ABILITY_ID, targetUid: ward.uid });
  }

  /** Поставить в очередь одного стрелка и дать ему ударить по цели. */
  function shoot(s: BattleState, ability: string, targetUid: string, shooter = 'archer'): BattleState {
    const foe = find(s, shooter, 'enemy');
    return act(cIdx, { ...s, order: [foe.uid], turnIndex: 0 }, { ability, targetUid });
  }

  it('заслонять может только передний ряд', () => {
    const s = startBattle(cIdx, b, p, 'cover-seed');
    expect(legalTargets(s, find(s, 'archer', 'player').uid, coverAbility)).toHaveLength(0);
    expect(legalTargets(s, find(s, 'wall', 'player').uid, coverAbility).length).toBeGreaterThan(0);
  });

  it('за себя поручиться нельзя', () => {
    const s = startBattle(cIdx, b, p, 'cover-seed');
    const front = find(s, 'wall', 'player');
    expect(legalTargets(s, front.uid, coverAbility).some((u) => u.uid === front.uid)).toBe(false);
  });

  it('общее действие выдаётся переднему ряду и не занимает слот способностей', () => {
    const s = startBattle(cIdx, b, p, 'cover-seed');
    const front = find(s, 'wall', 'player');
    expect(commonActions(cIdx, front).map((a) => a.id)).toEqual([COVER_ABILITY_ID]);
    expect(commonActions(cIdx, find(s, 'archer', 'player'))).toHaveLength(0);
    expect(readyAbilities(cIdx, front).map((a) => a.id)).not.toContain(COVER_ABILITY_ID);
  });

  it('без записи в контенте общего действия нет вовсе', () => {
    const s = startBattle(plainIdx, b, p, 'cover-seed');
    expect(commonActions(plainIdx, find(s, 'wall', 'player'))).toHaveLength(0);
  });

  it('одноцелевой удар принимает поручившийся, а не цель', () => {
    const s1 = withCover('glass');
    const ward = find(s1, 'glass', 'player');
    const guard = find(s1, 'wall', 'player');
    const s2 = shoot(s1, 'reach', ward.uid);
    expect(s2.units.find((u) => u.uid === ward.uid)?.hp).toBe(ward.hp);
    expect(s2.units.find((u) => u.uid === guard.uid)?.hp).toBeLessThan(guard.hp);
    expect(
      s2.events.some((e) => e.type === 'cover' && e.uid === guard.uid && e.targetUid === ward.uid),
    ).toBe(true);
  });

  it('площадь проходит мимо заслона', () => {
    const s1 = withCover('glass');
    const ward = find(s1, 'glass', 'player');
    const s2 = shoot(s1, 'sweep', ward.uid, 'sweeper');
    expect(s2.units.find((u) => u.uid === ward.uid)?.hp).toBeLessThan(ward.hp);
    expect(s2.events.some((e) => e.type === 'cover')).toBe(false);
  });

  it('заряд один: второй удар за тот же раунд идёт в цель', () => {
    const s1 = withCover('archer');
    const ward = find(s1, 'archer', 'player');
    const s2 = shoot(s1, 'reach', ward.uid);
    expect(s2.units.find((u) => u.uid === ward.uid)?.hp).toBe(ward.hp);
    const s3 = shoot(s2, 'reach', ward.uid);
    expect(s3.units.find((u) => u.uid === ward.uid)?.hp).toBeLessThan(ward.hp);
  });

  it('не складывается: второй заслон той же цели заменяет первого', () => {
    const s1 = withCover('glass');
    expect(find(s1, 'glass', 'player').statuses.filter((s) => s.kind === 'cover')).toHaveLength(1);
  });

  it('тело одно: поручившись за второго, первого не держит', () => {
    const s1 = withCover('glass');
    const guard = find(s1, 'wall', 'player');
    const other = find(s1, 'archer', 'player');
    const s2 = act(cIdx, { ...s1, order: [guard.uid], turnIndex: 0 }, {
      ability: COVER_ABILITY_ID,
      targetUid: other.uid,
    });
    expect(find(s2, 'glass', 'player').statuses.some((s) => s.kind === 'cover')).toBe(false);
    expect(find(s2, 'archer', 'player').statuses.some((s) => s.kind === 'cover')).toBe(true);
  });

  it('поручительство снимается собственным ходом поручившегося', () => {
    const s1 = withCover('glass');
    const guard = find(s1, 'wall', 'player');
    const foe = find(s1, 'archer', 'enemy');
    const s2 = act(cIdx, { ...s1, order: [guard.uid], turnIndex: 0 }, {
      ability: 'hit',
      targetUid: foe.uid,
    });
    expect(find(s2, 'glass', 'player').statuses.some((s) => s.kind === 'cover')).toBe(false);
  });

  it('павший поручитель никого не держит', () => {
    const s1 = withCover('glass');
    const guard = find(s1, 'wall', 'player');
    const ward = find(s1, 'glass', 'player');
    const fallen: BattleState = {
      ...s1,
      units: s1.units.map((u) => (u.uid === guard.uid ? { ...u, alive: false, hp: 0 } : u)),
    };
    const s2 = shoot(fallen, 'reach', ward.uid);
    expect(s2.units.find((u) => u.uid === ward.uid)?.hp).toBeLessThan(ward.hp);
  });

  it('заслон не пишет перезарядку на карту', () => {
    expect(find(withCover('glass'), 'wall', 'player').cooldowns[COVER_ABILITY_ID]).toBeUndefined();
  });

  it('бой с заслоном остаётся детерминированным по сиду', () => {
    const a = runAuto(cIdx, startBattle(cIdx, b, p, 'cover-det'));
    const c = runAuto(cIdx, startBattle(cIdx, b, p, 'cover-det'));
    expect(stripEvents(a)).toBe(stripEvents(c));
  });
});
