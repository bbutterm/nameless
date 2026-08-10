import { describe, expect, it } from 'vitest';
import {
  act,
  beginRound,
  currentActor,
  indexCombat,
  playerAbilityBar,
  readyPlayerAbilities,
  runAuto,
  startBattle,
  type BattleState,
} from './combat.js';
import { amplifyAbility, derivePlayerPowers, mergeAmplify, NO_AMPLIFY } from './powers.js';
import { deserialize, serialize } from './save.js';
import { createInitialState, SAVE_VERSION, type GameState } from './state.js';
import type {
  Ability,
  BattleDef,
  ContentBundle,
  Memory,
  PartyUnit,
  UnitDef,
} from './types.js';

const t = (ru: string) => ({ ru, en: ru });

/**
 * Фикстура — КАРКАСНАЯ. Ни одно умение здесь не претендует на канон: это
 * заведомо безымянные заглушки, чтобы проверить механику, а не содержание.
 */
const abilities: Ability[] = [
  { id: 'hit', name: t('Удар'), description: t('Удар'), icon: 'sword', target: 'enemy_front', power: 1, cooldown: 0 },
  {
    id: 'pw_strike',
    name: t('Умение А'),
    description: t('Умение А'),
    icon: 'spark',
    target: 'enemy_any',
    power: 1,
    cooldown: 2,
  },
  {
    id: 'pw_ward',
    name: t('Умение Б'),
    description: t('Умение Б'),
    icon: 'shield',
    target: 'self',
    power: 0,
    cooldown: 3,
    effects: [{ kind: 'shield', amount: 10, turns: 2 }],
  },
  {
    id: 'pw_free',
    name: t('Умение В'),
    description: t('Умение В'),
    icon: 'wing',
    target: 'self',
    power: 0,
    cooldown: 4,
    effects: [{ kind: 'buff', stat: 'atk', amount: 3, turns: 2 }],
  },
];

function unitDef(id: string, over: Partial<UnitDef> & { stats: UnitDef['stats']; row: UnitDef['row'] }): UnitDef {
  return { id, name: t(id), blurb: t(id), art: '', faction: 'test', tier: 1, abilities: ['hit'], ...over };
}

const units: UnitDef[] = [
  unitDef('bruiser', { row: 'front', stats: { hp: 40, atk: 10, def: 5, initiative: 10 } }),
  unitDef('wall', { row: 'front', stats: { hp: 5000, atk: 1, def: 40, initiative: 1 } }),
  unitDef('glass', { row: 'back', stats: { hp: 8, atk: 1, def: 0, initiative: 2 } }),
];

function memory(id: string, over: Partial<Memory> = {}): Memory {
  return {
    id,
    life: 'test_life',
    name: t(id),
    revelation: t(id),
    icon: 'book',
    cost: 1,
    ...over,
  };
}

const memories: Memory[] = [
  memory('m_grant', { powers: [{ kind: 'grant', ability: 'pw_strike' }] }),
  memory('m_amp1', { powers: [{ kind: 'amplify', ability: 'pw_strike', amplify: { power: 0.5 } }] }),
  memory('m_amp2', {
    powers: [{ kind: 'amplify', ability: 'pw_strike', amplify: { power: 1, cooldown: -1, piercing: true } }],
  }),
  memory('m_revoke', { powers: [{ kind: 'revoke', ability: 'pw_strike', note: t('Отдано') }] }),
  memory('m_ward', { powers: [{ kind: 'grant', ability: 'pw_ward' }] }),
  memory('m_ward_amp', {
    powers: [{ kind: 'amplify', ability: 'pw_ward', amplify: { effectScale: 2, turns: 1 } }],
  }),
  memory('m_free', { powers: [{ kind: 'grant', ability: 'pw_free', costsTurn: false }] }),
  memory('m_ghost', { powers: [{ kind: 'grant', ability: 'net_takoy' }] }),
  // Воспоминание без умений — ровно такие лежат в data/ сегодня.
  memory('m_plain'),
];

const bundle: ContentBundle = {
  axes: [],
  scenes: [],
  units,
  abilities,
  battles: [],
  lives: [],
  memories,
  deaths: [],
  chapters: [],
  speakers: [],
  codex: [],
};

const idx = indexCombat(bundle);

function party(...specs: [string, 'front' | 'back', number][]): PartyUnit[] {
  return specs.map(([defId, row, index], i) => {
    const def = units.find((u) => u.id === defId);
    return { uid: `p${i}:${defId}`, defId, hp: def?.stats.hp ?? 1, xp: 0, level: 1, slot: { row, index } };
  });
}

const battle = (id: string, enemies: BattleDef['enemies'], turnLimit?: number): BattleDef =>
  turnLimit === undefined ? { id, name: t(id), enemies } : { id, name: t(id), enemies, turnLimit };

/** Бой, где первым по инициативе всегда ходит игрок (у врага она = 1). */
function fight(seed: string, locked: string[], turnLimit?: number): BattleState {
  const powers = derivePlayerPowers(locked, bundle).abilities;
  return startBattle(
    idx,
    battle('pw', [{ unit: 'wall', row: 'front', index: 0 }], turnLimit),
    party(['bruiser', 'front', 0]),
    seed,
    powers,
  );
}

describe('вывод умений из воспоминаний', () => {
  it('пустой список воспоминаний — пустой набор умений', () => {
    expect(derivePlayerPowers([], bundle)).toEqual({ abilities: [], revoked: [] });
  });

  it('воспоминание без поля powers ничего не даёт (старые пятнадцать файлов)', () => {
    expect(derivePlayerPowers(['m_plain'], bundle).abilities).toHaveLength(0);
  });

  it('«дать» кладёт умение в набор', () => {
    const set = derivePlayerPowers(['m_grant'], bundle);
    expect(set.abilities.map((p) => p.id)).toEqual(['pw_strike']);
    expect(set.abilities[0]?.grantedBy).toEqual(['m_grant']);
    expect(set.abilities[0]?.ability.power).toBe(1);
  });

  it('«усилить» копится по всем закреплённым воспоминаниям', () => {
    const set = derivePlayerPowers(['m_grant', 'm_amp1', 'm_amp2'], bundle);
    const p = set.abilities[0];
    if (!p) throw new Error('умение потерялось');
    expect(p.ability.power).toBeCloseTo(2.5); // 1 + 0.5 + 1
    expect(p.ability.cooldown).toBe(1); // 2 − 1
    expect(p.ability.piercing).toBe(true);
    expect(p.amplifiedBy).toEqual(['m_amp1', 'm_amp2']);
  });

  it('усиление правит числа внутри effects, не трогая запись реестра', () => {
    const set = derivePlayerPowers(['m_ward', 'm_ward_amp'], bundle);
    const eff = set.abilities[0]?.ability.effects?.[0];
    expect(eff).toEqual({ kind: 'shield', amount: 20, turns: 3 });
    // Общий реестр остался как был — усиление игрока не течёт в юнитов.
    expect(abilities.find((a) => a.id === 'pw_ward')?.effects?.[0]).toEqual({
      kind: 'shield',
      amount: 10,
      turns: 2,
    });
  });

  it('итог не зависит от порядка закрепления', () => {
    const orders = [
      ['m_grant', 'm_amp1', 'm_amp2', 'm_ward', 'm_ward_amp'],
      ['m_ward_amp', 'm_amp2', 'm_grant', 'm_ward', 'm_amp1'],
      ['m_amp2', 'm_ward', 'm_amp1', 'm_ward_amp', 'm_grant'],
    ];
    const results = orders.map((o) => JSON.stringify(derivePlayerPowers(o, bundle)));
    expect(new Set(results).size).toBe(1);
  });

  it('повторный вызов на том же входе даёт побайтово тот же результат', () => {
    const a = JSON.stringify(derivePlayerPowers(['m_grant', 'm_amp1'], bundle));
    const b = JSON.stringify(derivePlayerPowers(['m_grant', 'm_amp1'], bundle));
    expect(a).toEqual(b);
  });

  it('дубликат в lockedMemories не удваивает усиление', () => {
    const once = derivePlayerPowers(['m_grant', 'm_amp1'], bundle);
    const twice = derivePlayerPowers(['m_grant', 'm_amp1', 'm_amp1'], bundle);
    expect(twice).toEqual(once);
  });

  it('умение, которого нет в реестре, молча выпадает, а не роняет вывод', () => {
    expect(derivePlayerPowers(['m_ghost'], bundle).abilities).toHaveLength(0);
  });
});

describe('отнимающее воспоминание', () => {
  it('отнимает умение и объясняет, кто отнял', () => {
    const set = derivePlayerPowers(['m_grant', 'm_amp1', 'm_revoke'], bundle);
    expect(set.abilities).toHaveLength(0);
    expect(set.revoked).toEqual([
      { id: 'pw_strike', by: ['m_revoke'], note: t('Отдано'), wasGranted: true },
    ]);
  });

  it('отнятое не возвращается, в каком бы порядке ни закрепляли', () => {
    const before = derivePlayerPowers(['m_revoke', 'm_grant'], bundle);
    const after = derivePlayerPowers(['m_grant', 'm_revoke'], bundle);
    expect(before.abilities).toHaveLength(0);
    expect(after.abilities).toHaveLength(0);
  });

  it('отнятое умение не доезжает до боя', () => {
    const s = fight('revoked', ['m_grant', 'm_revoke']);
    expect(s.player.abilities).toHaveLength(0);
    const me = currentActor(s);
    if (!me) throw new Error('нет актора');
    const s1 = act(idx, s, { ability: 'pw_strike', targetUid: s.units.find((u) => u.side === 'enemy')?.uid });
    expect(s1.events.some((e) => e.type === 'blocked' && e.reason === 'ability')).toBe(true);
    expect(s1.events.some((e) => e.type === 'damage')).toBe(false);
  });

  it('отнятое, которого никто не давал, помечено wasGranted: false', () => {
    const set = derivePlayerPowers(['m_revoke'], bundle);
    expect(set.revoked[0]?.wasGranted).toBe(false);
  });
});

describe('умение игрока в бою', () => {
  it('умение применяет карта, чей ход, и тратит на это ход', () => {
    const s0 = fight('cast', ['m_grant']);
    const me = currentActor(s0);
    const foe = s0.units.find((u) => u.side === 'enemy');
    if (!me || me.side !== 'player' || !foe) throw new Error('первым должен ходить игрок');
    const s1 = act(idx, s0, { ability: 'pw_strike', targetUid: foe.uid });
    expect(s1.events.some((e) => e.type === 'act' && e.ability === 'pw_strike')).toBe(true);
    expect(s1.events.some((e) => e.type === 'damage')).toBe(true);
    expect(s1.units.find((u) => u.uid === me.uid)?.acted).toBe(true);
  });

  it('перезарядка умения общая и тикает раундами боя', () => {
    const s0 = fight('cd', ['m_grant']);
    const foe = s0.units.find((u) => u.side === 'enemy');
    const s1 = act(idx, s0, { ability: 'pw_strike', targetUid: foe?.uid });
    expect(s1.player.cooldowns['pw_strike']).toBe(2);
    const me = s1.units.find((u) => u.side === 'player');
    if (!me) throw new Error('нет юнита');
    // Кулдаун умения НЕ пишется на карту: она произнесла, но не владеет.
    expect(me.cooldowns['pw_strike']).toBeUndefined();
    expect(readyPlayerAbilities(s1, me)).toHaveLength(0);

    const r2 = beginRound(idx, s1);
    expect(r2.player.cooldowns['pw_strike']).toBe(1);
    const r3 = beginRound(idx, r2);
    expect(r3.player.cooldowns['pw_strike']).toBe(0);
    const meLater = r3.units.find((u) => u.side === 'player');
    if (!meLater) throw new Error('нет юнита');
    expect(readyPlayerAbilities(r3, meLater).map((p) => p.id)).toEqual(['pw_strike']);
  });

  it('перезарядка не переносится между боями: новый бой начинается с готового умения', () => {
    const s0 = fight('carry-1', ['m_grant']);
    const foe = s0.units.find((u) => u.side === 'enemy');
    const spent = act(idx, s0, { ability: 'pw_strike', targetUid: foe?.uid });
    expect(spent.player.cooldowns['pw_strike']).toBe(2);
    const next = fight('carry-2', ['m_grant']);
    expect(next.player.cooldowns['pw_strike']).toBe(0);
  });

  it('умение на мёртвой цели блокируется и не сжигает перезарядку', () => {
    const two = battle('deadt', [
      { unit: 'wall', row: 'front', index: 0 },
      { unit: 'glass', row: 'back', index: 0 },
    ]);
    const s0 = startBattle(
      idx,
      two,
      party(['bruiser', 'front', 0]),
      'dead-power',
      derivePlayerPowers(['m_grant'], bundle).abilities,
    );
    const glass = s0.units.find((u) => u.defId === 'glass');
    if (!glass) throw new Error('нет цели');
    const withDead: BattleState = {
      ...s0,
      units: s0.units.map((u) => (u.uid === glass.uid ? { ...u, alive: false, hp: 0 } : u)),
    };
    expect(currentActor(withDead)?.side).toBe('player');
    const s1 = act(idx, withDead, { ability: 'pw_strike', targetUid: glass.uid });
    expect(s1.events.some((e) => e.type === 'blocked' && e.reason === 'target')).toBe(true);
    expect(s1.player.cooldowns['pw_strike']).toBe(0);
    expect(s1.outcome).toBe('ongoing');
  });

  it('умение врагу недоступно, даже если у игрока оно есть', () => {
    const s0 = fight('enemy-cast', ['m_grant']);
    const foe = s0.units.find((u) => u.side === 'enemy');
    if (!foe) throw new Error('нет врага');
    // Ставим врага первым в очередь и просим применить умение игрока.
    const enemyTurn: BattleState = { ...s0, order: [foe.uid], turnIndex: 0 };
    const s1 = act(idx, enemyTurn, { ability: 'pw_strike', targetUid: s0.units[0]?.uid });
    expect(s1.events.some((e) => e.type === 'blocked' && e.reason === 'ability')).toBe(true);
  });

  it('умение вне очереди хода не съедает ход, но уходит в перезарядку', () => {
    const s0 = fight('free', ['m_free']);
    const me = currentActor(s0);
    if (!me) throw new Error('нет актора');
    const s1 = act(idx, s0, { ability: 'pw_free' });
    expect(currentActor(s1)?.uid).toBe(me.uid);
    expect(s1.turnIndex).toBe(s0.turnIndex);
    expect(s1.units.find((u) => u.uid === me.uid)?.acted).toBe(false);
    expect(s1.player.cooldowns['pw_free']).toBe(4);
    // …и повторно его уже не применить, поэтому очередь не может залипнуть.
    const s2 = act(idx, s1, { ability: 'pw_free' });
    expect(s2.events.some((e) => e.type === 'blocked' && e.reason === 'ability')).toBe(true);
  });

  it('бой с умениями обеими сторонами-ботами доигрывается и остаётся детерминированным', () => {
    const p = derivePlayerPowers(['m_grant', 'm_amp2', 'm_free', 'm_ward'], bundle).abilities;
    const b = battle('auto', [{ unit: 'glass', row: 'front', index: 0 }], 0);
    const run = () =>
      runAuto(idx, startBattle(idx, b, party(['bruiser', 'front', 0]), 'auto-seed', p));
    const a = run();
    const c = run();
    expect(a.outcome).not.toBe('ongoing');
    expect(JSON.stringify(a.events)).toEqual(JSON.stringify(c.events));
  });

  it('пустой набор умений не меняет бой ни на одно событие', () => {
    const b = battle('same', [{ unit: 'glass', row: 'front', index: 0 }], 0);
    const bare = runAuto(idx, startBattle(idx, b, party(['bruiser', 'front', 0]), 'same-seed'));
    const empty = runAuto(idx, startBattle(idx, b, party(['bruiser', 'front', 0]), 'same-seed', []));
    const noPowers = runAuto(
      idx,
      startBattle(idx, b, party(['bruiser', 'front', 0]), 'same-seed', derivePlayerPowers(['m_plain'], bundle).abilities),
    );
    expect(JSON.stringify(empty.events)).toEqual(JSON.stringify(bare.events));
    expect(JSON.stringify(noPowers.events)).toEqual(JSON.stringify(bare.events));
  });
});

describe('панель умений для клиента', () => {
  it('готовое умение отдаётся со списком законных целей', () => {
    const s = fight('bar-ready', ['m_grant']);
    const bar = playerAbilityBar(s);
    expect(bar).toHaveLength(1);
    expect(bar[0]?.state).toEqual({ kind: 'ready' });
    expect(bar[0]?.actorUid).toBe(currentActor(s)?.uid);
    expect(bar[0]?.targets).toEqual([s.units.find((u) => u.side === 'enemy')?.uid]);
  });

  it('после применения показывает, сколько раундов ждать', () => {
    const s0 = fight('bar-cd', ['m_grant']);
    const foe = s0.units.find((u) => u.side === 'enemy');
    const s1 = act(idx, s0, { ability: 'pw_strike', targetUid: foe?.uid });
    expect(playerAbilityBar(s1)[0]?.state).toEqual({ kind: 'cooldown', turns: 2 });
  });

  it('на чужом ходу умение недоступно и говорит почему', () => {
    const s0 = fight('bar-turn', ['m_grant']);
    const foe = s0.units.find((u) => u.side === 'enemy');
    if (!foe) throw new Error('нет врага');
    const enemyTurn: BattleState = { ...s0, order: [foe.uid], turnIndex: 0 };
    expect(playerAbilityBar(enemyTurn)[0]?.state).toEqual({
      kind: 'unavailable',
      reason: 'notYourTurn',
    });
  });

  it('законченный бой гасит панель целиком', () => {
    const s0 = fight('bar-over', ['m_grant']);
    const over: BattleState = { ...s0, outcome: 'win' };
    expect(playerAbilityBar(over)[0]?.state).toEqual({ kind: 'unavailable', reason: 'battleOver' });
  });

  it('порядок кнопок стабилен и не зависит от порядка закрепления', () => {
    const a = playerAbilityBar(fight('bar-order-a', ['m_ward', 'm_grant'])).map((s) => s.power.id);
    const b = playerAbilityBar(fight('bar-order-b', ['m_grant', 'm_ward'])).map((s) => s.power.id);
    expect(a).toEqual(b);
    expect(a).toEqual(['pw_strike', 'pw_ward']);
  });
});

describe('сейв старой версии', () => {
  function v1Save(patch: Partial<GameState>): string {
    const base = createInitialState({
      seed: 'old-run',
      axes: [{ id: 'mercy_cruelty', start: 0 }],
      chapter: 2,
      scene: 'some_scene',
      node: 'n1',
      now: 1_700_000_000_000,
    });
    const state = { ...base, ...patch, version: 1 } as Record<string, unknown>;
    // Версия 1 не знала Помянника — поле убираем, как в настоящем старом сейве.
    delete state['codexPending'];
    return JSON.stringify({ version: 1, savedAt: 1_700_000_000_000, state });
  }

  it('сейв версии 1 грузится, прогресс на месте, умения выводятся из него', () => {
    const raw = v1Save({
      lockedMemories: ['m_grant', 'm_amp1'],
      fragments: { m_grant: 3 },
      deaths: 2,
      gold: 17,
      awakenedLives: ['test_life'],
    });
    const loaded = deserialize(raw);
    expect(loaded.ok).toBe(true);
    expect(loaded.migrated).toBe(true);
    const s = loaded.state;
    if (!s) throw new Error('сейв не загрузился');
    // Прогресс не потерян.
    expect(s.lockedMemories).toEqual(['m_grant', 'm_amp1']);
    expect(s.deaths).toBe(2);
    expect(s.gold).toBe(17);
    expect(s.awakenedLives).toEqual(['test_life']);
    // Умения — производная, поэтому старый сейв получает их без миграции.
    const set = derivePlayerPowers(s.lockedMemories, bundle);
    expect(set.abilities.map((p) => p.id)).toEqual(['pw_strike']);
    expect(set.abilities[0]?.ability.power).toBeCloseTo(1.5);
  });

  it('умения не добавили полей в сейв: версия и round-trip прежние', () => {
    const base = createInitialState({
      seed: 'rt',
      axes: [{ id: 'mercy_cruelty', start: 0 }],
      chapter: 1,
      scene: 's',
      node: 'n',
      now: 1,
    });
    const s: GameState = { ...base, lockedMemories: ['m_grant'] };
    const back = deserialize(serialize(s, 2));
    expect(back.ok).toBe(true);
    expect(back.state).toEqual({ ...s, version: SAVE_VERSION });
    expect(Object.keys(back.state ?? {})).toEqual(Object.keys(s));
  });
});

describe('арифметика усилений', () => {
  it('нейтральное усиление возвращает ту же запись способности', () => {
    const base = abilities[1] as Ability;
    expect(amplifyAbility(base, NO_AMPLIFY)).toBe(base);
    expect(amplifyAbility(base, {})).toBe(base);
  });

  it('слияние усилений коммутативно', () => {
    const a = { power: 0.5, effectScale: 2, turns: 1 };
    const b = { power: -0.2, cooldown: -1, effectScale: 1.5, piercing: true };
    expect(mergeAmplify(a, b)).toEqual(mergeAmplify(b, a));
  });

  it('сила и перезарядка не уходят ниже нуля', () => {
    const base = abilities[1] as Ability;
    const weak = amplifyAbility(base, { power: -10, cooldown: -10 });
    expect(weak.power).toBe(0);
    expect(weak.cooldown).toBe(0);
  });
});
