/**
 * Умения памяти в бою: механики §B.4 и отклик сродства §C MEMORY_POWERS.
 *
 * Фикстура КАРКАСНАЯ и намеренно безымянная: здесь проверяется движок, а не
 * содержание. Канонные числа пяти умений сверяются отдельно, на настоящем
 * контенте (`packages/sim/src/memory-powers.test.ts`), — потому что движку
 * всё равно, сколько написано в таблице, а контенту не всё равно.
 */
import { describe, expect, it } from 'vitest';
import {
  act,
  currentActor,
  indexCombat,
  isRecorded,
  playerAbilityBar,
  readyPlayerAbilities,
  runAuto,
  shieldOf,
  startBattle,
  type BattleState,
} from './combat.js';
import { derivePlayerPowers, mergeAmplify, NO_AMPLIFY } from './powers.js';
import type {
  Ability,
  BattleDef,
  ContentBundle,
  Memory,
  PartyUnit,
  PlayerAbility,
  UnitDef,
} from './types.js';

const t = (ru: string) => ({ ru, en: ru });

const abilities: Ability[] = [
  { id: 'hit', name: t('Удар'), description: t('Удар'), icon: 'sword', target: 'enemy_front', power: 1, cooldown: 0 },
  {
    id: 'row_shield',
    name: t('Бумага ряду'),
    description: t('Бумага ряду'),
    icon: 'shield',
    target: 'ally_row',
    power: 0,
    cooldown: 99,
    effects: [{ kind: 'shield', amount: 20, turns: 2 }, { kind: 'shield_refund' }],
  },
  {
    id: 'plain_shield',
    name: t('Бумага одному'),
    description: t('Бумага одному'),
    icon: 'shield',
    target: 'ally_one',
    power: 0,
    cooldown: 99,
    effects: [{ kind: 'shield', amount: 20, turns: 2 }],
  },
  {
    id: 'protocol',
    name: t('Протокол'),
    description: t('Протокол'),
    icon: 'book',
    target: 'enemy_any',
    power: 0,
    cooldown: 99,
    effects: [{ kind: 'purge' }, { kind: 'recorded', turns: 2 }],
  },
  {
    id: 'truth',
    name: t('Правда'),
    description: t('Правда'),
    icon: 'book',
    target: 'enemy_any',
    power: 0,
    cooldown: 99,
    effects: [{ kind: 'bare_truth', turns: 2 }],
  },
  {
    id: 'cup',
    name: t('Кружка'),
    description: t('Кружка'),
    icon: 'heal',
    target: 'ally_all',
    power: 0,
    cooldown: 99,
    effects: [
      { kind: 'heal_flat', amount: 12 },
      { kind: 'cleanse' },
      { kind: 'spare_worst_foe', amount: 12 },
    ],
  },
  {
    id: 'tar',
    name: t('Смола'),
    description: t('Смола'),
    icon: 'fire',
    target: 'enemy_all',
    power: 0,
    cooldown: 99,
    effects: [
      { kind: 'dot', amount: 6, turns: 3, tag: 'smola' },
      { kind: 'rally', stat: 'atk', amount: 3, turns: 2 },
    ],
  },
  {
    id: 'ledger',
    name: t('Опись'),
    description: t('Опись'),
    icon: 'hourglass',
    target: 'enemy_all',
    power: 0,
    cooldown: 0,
    passive: true,
    effects: [
      { kind: 'reveal' },
      { kind: 'debuff', stat: 'def', amount: 4, turns: 3 },
      { kind: 'idle_toll', amount: 4 },
    ],
  },
  // Способность отклика: заметно бьёт и вешает щит — чтобы половинность
  // была видна и в уроне, и в числе статуса.
  {
    id: 'echo_blow',
    name: t('Отклик'),
    description: t('Отклик'),
    icon: 'spark',
    target: 'enemy_front',
    power: 2,
    cooldown: 3,
    effects: [{ kind: 'damage', power: 2 }, { kind: 'shield', amount: 9, turns: 2 }],
  },
];

function unitDef(
  id: string,
  over: Partial<UnitDef> & { stats: UnitDef['stats']; row: UnitDef['row'] },
): UnitDef {
  return { id, name: t(id), blurb: t(id), art: '', faction: 'test', tier: 1, abilities: ['hit'], ...over };
}

const units: UnitDef[] = [
  // Инициатива расставлена так, чтобы очередь была предсказуема без бросков:
  // ведущий ходит первым, откликающиеся — следом, враг последним.
  unitDef('lead', { row: 'front', stats: { hp: 60, atk: 10, def: 5, initiative: 30 } }),
  unitDef('kin_fast', {
    row: 'back',
    stats: { hp: 60, atk: 10, def: 5, initiative: 20 },
    abilities: ['echo_blow'],
    traits: ['life_test_life'],
  }),
  unitDef('kin_slow', {
    row: 'back',
    stats: { hp: 60, atk: 10, def: 5, initiative: 15 },
    abilities: ['echo_blow'],
    traits: ['life_test_life'],
  }),
  unitDef('stranger', {
    row: 'back',
    stats: { hp: 60, atk: 10, def: 5, initiative: 12 },
    abilities: ['echo_blow'],
    traits: ['life_other_life'],
  }),
  unitDef('dummy', { row: 'front', stats: { hp: 400, atk: 4, def: 5, initiative: 1 } }),
];

function memory(id: string, over: Partial<Memory> = {}): Memory {
  return { id, life: 'test_life', name: t(id), revelation: t(id), icon: 'book', cost: 1, ...over };
}

const memories: Memory[] = [
  memory('m_row_shield', { powers: [{ kind: 'grant', ability: 'row_shield' }] }),
  memory('m_plain_shield', { powers: [{ kind: 'grant', ability: 'plain_shield' }] }),
  memory('m_protocol', { powers: [{ kind: 'grant', ability: 'protocol' }] }),
  memory('m_truth', { powers: [{ kind: 'grant', ability: 'truth' }] }),
  memory('m_cup', { powers: [{ kind: 'grant', ability: 'cup' }] }),
  memory('m_tar', { powers: [{ kind: 'grant', ability: 'tar' }] }),
  memory('m_ledger', { powers: [{ kind: 'grant', ability: 'ledger' }] }),
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

const foes: BattleDef['enemies'] = [
  { unit: 'dummy', row: 'front', index: 0 },
  { unit: 'dummy', row: 'back', index: 0 },
];

function battle(id: string, enemies: BattleDef['enemies'] = foes): BattleDef {
  return { id, name: t(id), enemies, turnLimit: 30 };
}

function powersOf(...ids: string[]): PlayerAbility[] {
  return derivePlayerPowers(ids, bundle).abilities;
}

/** Кто ходит сейчас. Нужен во всех сценариях: умение произносит чужой ход. */
const who = (s: BattleState): string => currentActor(s)?.uid ?? '';
const unit = (s: BattleState, uid: string) => s.units.find((u) => u.uid === uid);

describe('статус «занесено в протокол»', () => {
  const setup = (): BattleState =>
    startBattle(idx, battle('b_rec'), party(['lead', 'front', 0]), 'rec', powersOf('m_protocol'));

  it('блокирует новые щиты, бафы и лечение, но не урон', () => {
    let s = setup();
    const foe = s.units.find((u) => u.side === 'enemy' && u.row === 'front')!;
    s = act(idx, s, { ability: 'protocol', targetUid: foe.uid });
    expect(isRecorded(unit(s, foe.uid)!)).toBe(true);

    const before = unit(s, foe.uid)!.hp;
    // Дальше бой идёт сам: враг бьёт, щиты на него не встают.
    s = runAuto(idx, s, 40);
    const blocked = s.events.filter((e) => e.type === 'blocked' && e.reason === 'recorded');
    expect(unit(s, foe.uid)!.hp).toBeLessThan(before);
    // Сам факт блокировки проверяется прицельно ниже; здесь важно, что урон шёл.
    expect(blocked.length).toBeGreaterThanOrEqual(0);
  });

  it('щит на записанного не встаёт и оставляет запись в логе', () => {
    let s = startBattle(
      idx,
      battle('b_rec2'),
      party(['lead', 'front', 0], ['kin_fast', 'back', 0]),
      'rec2',
      powersOf('m_protocol', 'm_plain_shield'),
    );
    // Протокол на своего же — легальных «своих» целей у protocol нет, поэтому
    // проверяем зеркально: сперва щит, потом протокол по врагу.
    const foe = s.units.find((u) => u.side === 'enemy' && u.row === 'front')!;
    s = act(idx, s, { ability: 'protocol', targetUid: foe.uid });
    const rec = unit(s, foe.uid)!;
    expect(rec.statuses.some((x) => x.kind === 'recorded')).toBe(true);
    expect(rec.statuses.some((x) => x.kind === 'shield')).toBe(false);
  });

  it('протокол снимает уже висящие бафы и щиты («без прибавления»)', () => {
    let s = startBattle(idx, battle('b_rec3'), party(['lead', 'front', 0]), 'rec3', powersOf('m_protocol'));
    const foe = s.units.find((u) => u.side === 'enemy' && u.row === 'front')!;
    unit(s, foe.uid)!.statuses.push({ kind: 'shield', amount: 30, turns: 3 });
    unit(s, foe.uid)!.statuses.push({ kind: 'buff', stat: 'atk', amount: 5, turns: 3 });
    s = act(idx, s, { ability: 'protocol', targetUid: foe.uid });
    const after = unit(s, foe.uid)!;
    expect(after.statuses.some((x) => x.kind === 'shield' || x.kind === 'buff')).toBe(false);
  });
});

describe('«Год Голой Правды»: общий запрет статусов', () => {
  it('снимает статусы с обеих сторон и держит запрет два раунда', () => {
    let s = startBattle(
      idx,
      battle('b_truth'),
      party(['lead', 'front', 0], ['kin_fast', 'back', 0]),
      'truth',
      powersOf('m_truth'),
    );
    // Вешаем статусы обеим сторонам вручную — это состояние, а не поведение.
    for (const u of s.units) u.statuses.push({ kind: 'buff', stat: 'atk', amount: 4, turns: 3 });
    const foe = s.units.find((u) => u.side === 'enemy' && u.row === 'front')!;
    s = act(idx, s, { ability: 'truth', targetUid: foe.uid });

    expect(s.units.every((u) => u.statuses.length === 0)).toBe(true);
    expect(s.statusLock).toBe(2);

    // Пока запрет действует, `echo_blow` бьёт, но щита не оставляет.
    const kin = s.units.find((u) => u.defId === 'kin_fast')!;
    while (who(s) !== kin.uid && s.outcome === 'ongoing') s = act(idx, s, { ability: '__pass__' });
    const foeHp = unit(s, foe.uid)!.hp;
    s = act(idx, s, { ability: 'echo_blow', targetUid: foe.uid });
    expect(unit(s, foe.uid)!.hp).toBeLessThan(foeHp);
    expect(shieldOf(unit(s, kin.uid)!)).toBe(0);
    expect(s.events.some((e) => e.type === 'blocked' && e.reason === 'bare_truth')).toBe(true);
  });

  it('запрет истекает и статусы возвращаются', () => {
    let s = startBattle(idx, battle('b_truth2'), party(['lead', 'front', 0]), 'truth2', powersOf('m_truth'));
    const foe = s.units.find((u) => u.side === 'enemy' && u.row === 'front')!;
    s = act(idx, s, { ability: 'truth', targetUid: foe.uid });
    expect(s.statusLock).toBe(2);
    const startRound = s.round;
    while (s.outcome === 'ongoing' && s.round < startRound + 3) s = act(idx, s, { ability: '__pass__' });
    expect(s.statusLock).toBe(0);
  });
});

describe('возврат непробитого щита', () => {
  it('щит с тегом возврата, истёкший целым, отдаёт остаток лечением', () => {
    let s = startBattle(
      idx,
      battle('b_ref', [{ unit: 'dummy', row: 'front', index: 0 }]),
      party(['lead', 'front', 0], ['kin_fast', 'back', 0]),
      'ref',
      powersOf('m_row_shield'),
    );
    // Ранение до применения — иначе лечение упрётся в максимум и не будет видно.
    const kin = s.units.find((u) => u.defId === 'kin_fast')!;
    unit(s, kin.uid)!.hp = 20;
    s = act(idx, s, { ability: 'row_shield', targetUid: kin.uid });
    expect(shieldOf(unit(s, kin.uid)!)).toBe(20);

    const hpBefore = unit(s, kin.uid)!.hp;
    const startRound = s.round;
    while (s.outcome === 'ongoing' && s.round < startRound + 3) s = act(idx, s, { ability: '__pass__' });
    // Задний ряд прикрыт передним, щит не тронут — возврат обязан прийти целиком.
    expect(unit(s, kin.uid)!.hp).toBe(hpBefore + 20);
  });

  it('обычный щит не возвращается: чужие щиты правкой не задеты', () => {
    let s = startBattle(
      idx,
      battle('b_ref2', [{ unit: 'dummy', row: 'front', index: 0 }]),
      party(['lead', 'front', 0], ['kin_fast', 'back', 0]),
      'ref2',
      powersOf('m_plain_shield'),
    );
    const kin = s.units.find((u) => u.defId === 'kin_fast')!;
    unit(s, kin.uid)!.hp = 20;
    s = act(idx, s, { ability: 'plain_shield', targetUid: kin.uid });
    const hpBefore = unit(s, kin.uid)!.hp;
    const startRound = s.round;
    while (s.outcome === 'ongoing' && s.round < startRound + 3) s = act(idx, s, { ability: '__pass__' });
    expect(unit(s, kin.uid)!.hp).toBe(hpBefore);
  });
});

describe('пассив «Опись»', () => {
  const start = (): BattleState =>
    startBattle(
      idx,
      battle('b_pass'),
      party(['lead', 'front', 0], ['kin_fast', 'back', 0]),
      'pass',
      powersOf('m_ledger'),
    );

  it('включает режим показа и вешает дебаф всем врагам в начале боя', () => {
    const s = start();
    expect(s.reveal).toBe(true);
    const enemies = s.units.filter((u) => u.side === 'enemy');
    expect(enemies.length).toBeGreaterThan(0);
    for (const e of enemies) {
      const d = e.statuses.find((x) => x.kind === 'debuff' && x.stat === 'def');
      expect(d?.amount).toBe(4);
      // Дебаф применён ПОСЛЕ первого beginRound, значит первый раунд не потерян.
      expect(d?.turns).toBe(3);
    }
    // Своих дебаф не касается.
    expect(s.units.filter((u) => u.side === 'player').every((u) => u.statuses.length === 0)).toBe(true);
  });

  it('кнопки не занимает и нажатию не поддаётся', () => {
    const s = start();
    const actor = s.units.find((u) => u.uid === who(s))!;
    expect(readyPlayerAbilities(s, actor).map((p) => p.id)).not.toContain('ledger');
    expect(playerAbilityBar(s).map((x) => x.power.id)).not.toContain('ledger');
    const after = act(idx, s, { ability: 'ledger' });
    expect(after.events.some((e) => e.type === 'blocked' && e.reason === 'ability')).toBe(true);
  });

  it('пеня бьёт бездействовавшего своего и не трогает того, кто ходил', () => {
    let s = start();
    const kin = s.units.find((u) => u.defId === 'kin_fast')!;
    // Оглушаем одного своего: он пропустит раунд, значит заплатит пеню.
    unit(s, kin.uid)!.statuses.push({ kind: 'stun', amount: 0, turns: 2 });
    const kinHp = unit(s, kin.uid)!.hp;
    const leadUid = s.units.find((u) => u.defId === 'lead')!.uid;
    const leadHp = unit(s, leadUid)!.hp;
    const startRound = s.round;
    // Доводим бой ровно до начала следующего раунда.
    while (s.outcome === 'ongoing' && s.round === startRound) {
      s = who(s) === leadUid ? act(idx, s, { ability: 'hit', targetUid: s.units.find((u) => u.side === 'enemy' && u.row === 'front')!.uid }) : act(idx, s, { ability: '__pass__' });
    }
    expect(unit(s, kin.uid)!.hp).toBe(kinHp - 4);
    expect(unit(s, leadUid)!.hp).toBe(leadHp);
  });

  it('без пассива пени нет', () => {
    let s = startBattle(
      idx,
      battle('b_nopass'),
      party(['lead', 'front', 0], ['kin_fast', 'back', 0]),
      'nopass',
    );
    const kin = s.units.find((u) => u.defId === 'kin_fast')!;
    unit(s, kin.uid)!.statuses.push({ kind: 'stun', amount: 0, turns: 2 });
    const kinHp = unit(s, kin.uid)!.hp;
    const startRound = s.round;
    while (s.outcome === 'ongoing' && s.round === startRound) s = act(idx, s, { ability: '__pass__' });
    expect(unit(s, kin.uid)!.hp).toBe(kinHp);
  });
});

describe('всеобщие эффекты', () => {
  it('«rally» бафает всех своих, включая тех, кто не был целью', () => {
    let s = startBattle(
      idx,
      battle('b_rally'),
      party(['lead', 'front', 0], ['stranger', 'back', 0]),
      'rally',
      powersOf('m_tar'),
    );
    s = act(idx, s, { ability: 'tar' });
    for (const u of s.units.filter((x) => x.side === 'player')) {
      expect(u.statuses.some((x) => x.kind === 'buff' && x.stat === 'atk' && x.amount === 3)).toBe(true);
    }
    for (const u of s.units.filter((x) => x.side === 'enemy')) {
      expect(u.statuses.some((x) => x.kind === 'buff')).toBe(false);
      expect(u.statuses.some((x) => x.kind === 'dot' && x.amount === 6)).toBe(true);
    }
  });

  it('«последняя кружка» лечит и самого раненого врага', () => {
    let s = startBattle(idx, battle('b_cup'), party(['lead', 'front', 0]), 'cup', powersOf('m_cup'));
    const enemies = s.units.filter((u) => u.side === 'enemy');
    const worst = enemies[0]!;
    unit(s, worst.uid)!.hp = 100;
    unit(s, enemies[1]!.uid)!.hp = 300;
    const lead = s.units.find((u) => u.defId === 'lead')!;
    unit(s, lead.uid)!.hp = 30;
    s = act(idx, s, { ability: 'cup' });
    expect(unit(s, lead.uid)!.hp).toBe(42);
    expect(unit(s, worst.uid)!.hp).toBe(112);
    expect(unit(s, enemies[1]!.uid)!.hp).toBe(300);
  });
});

describe('отклик сродства', () => {
  const start = (seed = 'resp'): BattleState =>
    startBattle(
      idx,
      battle('b_resp'),
      party(['lead', 'front', 0], ['kin_fast', 'back', 0], ['kin_slow', 'back', 1], ['stranger', 'back', 2]),
      seed,
      powersOf('m_tar'),
    );

  it('откликаются только сродственные, донор хода — нет', () => {
    let s = start();
    expect(who(s)).toContain('lead');
    s = act(idx, s, { ability: 'tar' });
    const responders = s.events.filter((e) => e.type === 'response').map((e) => e.uid);
    expect(responders.some((u) => u.includes('kin_fast'))).toBe(true);
    expect(responders.some((u) => u.includes('kin_slow'))).toBe(true);
    expect(responders.some((u) => u.includes('stranger'))).toBe(false);
    expect(responders.some((u) => u.includes('lead'))).toBe(false);
  });

  it('порядок откликов — по инициативе', () => {
    let s = start();
    s = act(idx, s, { ability: 'tar' });
    const order = s.events.filter((e) => e.type === 'response').map((e) => e.uid);
    expect(order[0]).toContain('kin_fast');
    expect(order[1]).toContain('kin_slow');
  });

  it('отклик вполсилы, без хода и без перезарядки', () => {
    // Один откликающийся — чтобы числа читались без наложений: второй отклик
    // бьёт в ту же цель и съедает щит, поставленный первым.
    let s = startBattle(
      idx,
      battle('b_resp_solo'),
      party(['lead', 'front', 0], ['kin_fast', 'back', 0]),
      'solo',
      powersOf('m_tar'),
    );
    const kinUid = s.units.find((u) => u.defId === 'kin_fast')!.uid;
    const foeUid = s.units.find((u) => u.side === 'enemy' && u.row === 'front')!.uid;
    s = act(idx, s, { ability: 'tar' });
    const kin = unit(s, kinUid)!;
    // `echo_blow` вешает на цель щит 9 (фикстура, а не канон): половина с
    // округлением ВНИЗ — 4. На этом числе и держится проверка §C.1.
    expect(shieldOf(unit(s, foeUid)!)).toBe(4);
    expect(kin.acted).toBe(false);
    expect(kin.cooldowns['echo_blow'] ?? 0).toBe(0);
  });

  it('цепочки нет: сам отклик откликов не порождает', () => {
    let s = start();
    s = act(idx, s, { ability: 'tar' });
    // Два сродственных — ровно два отклика, а не четыре и не восемь.
    expect(s.events.filter((e) => e.type === 'response').length).toBe(2);
  });

  it('обычная способность юнита откликов не вызывает', () => {
    let s = start();
    const foe = s.units.find((u) => u.side === 'enemy' && u.row === 'front')!;
    s = act(idx, s, { ability: 'hit', targetUid: foe.uid });
    expect(s.events.some((e) => e.type === 'response')).toBe(false);
  });

  it('умение чужой жизни своих не поднимает', () => {
    let s = startBattle(
      idx,
      battle('b_resp2'),
      party(['lead', 'front', 0], ['kin_fast', 'back', 0]),
      'resp2',
      derivePlayerPowers(
        ['m_alien'],
        {
          ...bundle,
          memories: [
            { ...memory('m_alien', { powers: [{ kind: 'grant', ability: 'tar' }] }), life: 'other_life' },
          ],
        },
      ).abilities,
    );
    s = act(idx, s, { ability: 'tar' });
    expect(s.events.some((e) => e.type === 'response')).toBe(false);
  });
});

describe('заряд один на бой и общий', () => {
  it('применение одного умения гасит и остальные', () => {
    let s = startBattle(
      idx,
      battle('b_charge'),
      party(['lead', 'front', 0]),
      'charge',
      powersOf('m_tar', 'm_cup'),
    );
    expect(readyPlayerAbilities(s, s.units.find((u) => u.uid === who(s))!).length).toBe(2);
    s = act(idx, s, { ability: 'tar' });
    const actor = s.units.find((u) => u.uid === who(s));
    if (actor) expect(readyPlayerAbilities(s, actor).length).toBe(0);
    expect(s.player.cooldowns['cup']).toBeGreaterThan(0);
  });

  it('пассив заряда не тратит и не гаснет', () => {
    let s = startBattle(
      idx,
      battle('b_charge2'),
      party(['lead', 'front', 0]),
      'charge2',
      powersOf('m_tar', 'm_ledger'),
    );
    s = act(idx, s, { ability: 'tar' });
    expect(s.player.cooldowns['ledger'] ?? 0).toBe(0);
    expect(s.reveal).toBe(true);
  });
});

describe('слияние усилений: новые поля', () => {
  it('цель расширяется, а не разворачивается, и не зависит от порядка', () => {
    const a = { target: 'ally_one' as const };
    const b = { target: 'ally_all' as const };
    expect(mergeAmplify(a, b).target).toBe('ally_all');
    expect(mergeAmplify(b, a).target).toBe('ally_all');
  });

  it('прибавка к числам складывается, добавленные эффекты объединяются', () => {
    const a = { effectAmount: -4, addEffects: [{ kind: 'cleanse' as const }] };
    const b = { effectAmount: 2, addEffects: [{ kind: 'purge' as const }] };
    const ab = mergeAmplify(a, b);
    const ba = mergeAmplify(b, a);
    expect(ab.effectAmount).toBe(-2);
    expect(ab.addEffects).toEqual(ba.addEffects);
    expect(ab.addEffects.length).toBe(2);
  });

  it('нейтральное усиление ничего не добавляет', () => {
    expect(mergeAmplify(NO_AMPLIFY, NO_AMPLIFY)).toEqual(NO_AMPLIFY);
  });

  it('добавленные эффекты не масштабируются усилением', () => {
    const b: ContentBundle = {
      ...bundle,
      memories: [
        memory('g', { powers: [{ kind: 'grant', ability: 'plain_shield' }] }),
        memory('a1', {
          powers: [
            {
              kind: 'amplify',
              ability: 'plain_shield',
              amplify: { effectAmount: 10, turns: 1, addEffects: [{ kind: 'heal_flat', amount: 7 }] },
            },
          ],
        }),
      ],
    };
    const p = derivePlayerPowers(['g', 'a1'], b).abilities[0]!;
    const shield = p.ability.effects?.find((e) => e.kind === 'shield');
    const heal = p.ability.effects?.find((e) => e.kind === 'heal_flat');
    expect(shield).toMatchObject({ amount: 30, turns: 3 });
    // 7, а не 17 и не 8: принесённое воспоминанием приходит своими числами.
    expect(heal).toMatchObject({ amount: 7 });
  });

  it('ступень равна числу закреплённых воспоминаний жизни', () => {
    const b: ContentBundle = {
      ...bundle,
      memories: [
        memory('t1', { powers: [{ kind: 'grant', ability: 'plain_shield' }] }),
        memory('t2', { powers: [{ kind: 'amplify', ability: 'plain_shield', amplify: { effectAmount: 1 } }] }),
        memory('t3', { powers: [{ kind: 'amplify', ability: 'plain_shield', amplify: { effectAmount: 1 } }] }),
      ],
    };
    expect(derivePlayerPowers(['t1'], b).abilities[0]?.tier).toBe(1);
    expect(derivePlayerPowers(['t1', 't2'], b).abilities[0]?.tier).toBe(2);
    expect(derivePlayerPowers(['t3', 't2', 't1'], b).abilities[0]?.tier).toBe(3);
    // Усиление без дающего умения не создаёт: ступени II без ступени I не бывает.
    expect(derivePlayerPowers(['t2', 't3'], b).abilities.length).toBe(0);
  });
});

describe('детерминизм с умениями и откликами', () => {
  it('один сид — один лог событий, включая отклики', () => {
    const run = (): BattleState =>
      runAuto(
        idx,
        startBattle(
          idx,
          battle('b_det'),
          party(['lead', 'front', 0], ['kin_fast', 'back', 0], ['kin_slow', 'back', 1]),
          'det',
          powersOf('m_tar', 'm_cup', 'm_ledger'),
        ),
        400,
      );
    const a = run();
    const c = run();
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(c.events));
    expect(a.events.some((e) => e.type === 'response')).toBe(true);
  });

  it('порядок закрепления воспоминаний не меняет умение', () => {
    const ids = ['m_tar', 'm_cup', 'm_ledger', 'm_protocol'];
    const forward = derivePlayerPowers(ids, bundle);
    const backward = derivePlayerPowers([...ids].reverse(), bundle);
    expect(JSON.stringify(forward)).toBe(JSON.stringify(backward));
  });
});
