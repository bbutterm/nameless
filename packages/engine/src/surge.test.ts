/**
 * «Наддать» — заём темпа под процент (DIRECTION_COMBAT §B.C2).
 *
 * Проверяется не «работает ли множитель», а то, ради чего механика заведена:
 * что заём НАСТОЯЩИЙ (за него платят своим ходом), что платят его все
 * одинаково — и медленные, и быстрые, — и что незаконная наддача не отнимает
 * у игрока ход.
 */
import { describe, expect, it } from 'vitest';
import {
  act,
  canSurge,
  currentActor,
  indexCombat,
  isWinded,
  planAction,
  startBattle,
  SURGE_POWER,
  type BattleState,
} from './combat.js';
import type { Ability, BattleDef, ContentBundle, PartyUnit, UnitDef } from './types.js';

const t = (ru: string) => ({ ru, en: ru });

const abilities: Ability[] = [
  { id: 'hit', name: t('Удар'), description: t('Удар'), icon: 'sword', target: 'enemy_front', power: 1, cooldown: 0 },
  {
    // Способность, которой наддача запрещена данными.
    id: 'odd',
    name: t('Странность'),
    description: t('Странность'),
    icon: 'sword',
    target: 'enemy_front',
    power: 1,
    cooldown: 0,
    surge: false,
  },
  {
    id: 'mend',
    name: t('Ветошь'),
    description: t('Ветошь'),
    icon: 'heal',
    target: 'ally_one',
    power: 0,
    cooldown: 0,
    effects: [{ kind: 'heal', power: 1 }],
  },
];
// Урон живёт в `effects`: наддача усиливает именно его.
for (const id of ['hit', 'odd']) {
  const a = abilities.find((x) => x.id === id) as Ability;
  a.effects = [{ kind: 'damage', power: 1 }];
}

function unitDef(id: string, over: Partial<UnitDef> & { stats: UnitDef['stats']; row: UnitDef['row'] }): UnitDef {
  return { id, name: t(id), blurb: t(id), art: '', faction: 'test', tier: 1, abilities: ['hit'], ...over };
}

const units: UnitDef[] = [
  unitDef('swift', { row: 'front', stats: { hp: 40, atk: 10, def: 5, initiative: 20 } }),
  unitDef('slow', { row: 'front', stats: { hp: 40, atk: 10, def: 5, initiative: 1 } }),
  unitDef('odd_one', { row: 'front', stats: { hp: 40, atk: 10, def: 5, initiative: 20 }, abilities: ['odd'] }),
  unitDef('healer', { row: 'back', stats: { hp: 30, atk: 10, def: 3, initiative: 19 }, abilities: ['mend'] }),
  // Мешок: живёт долго, чтобы бой не кончился раньше замера.
  unitDef('sack', { row: 'front', stats: { hp: 400, atk: 1, def: 0, initiative: 2 } }),
  // Тонкая цель: обычный удар не добивает, наддача добивает.
  unitDef('thin', { row: 'front', stats: { hp: 12, atk: 1, def: 0, initiative: 2 } }),
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
    return { uid: `p${i}:${defId}`, defId, hp: def?.stats.hp ?? 1, xp: 0, level: 1, slot: { row, index } };
  });
}

const battle = (id: string, enemies: BattleDef['enemies']): BattleDef => ({ id, name: t(id), enemies });

/** Сколько hp снял первый удар текущего актора. */
function strike(state: BattleState, surge: boolean): { dealt: number; after: BattleState } {
  const foe = state.units.find((u) => u.side === 'enemy');
  const before = foe?.hp ?? 0;
  const after = act(idx, state, { ability: 'hit', targetUid: foe?.uid, ...(surge ? { surge: true } : {}) });
  const now = after.units.find((u) => u.uid === foe?.uid)?.hp ?? 0;
  return { dealt: before - now, after };
}

describe('наддать: сила', () => {
  it('наддача бьёт в полтора раза сильнее того же удара по тому же сиду', () => {
    const start = () =>
      startBattle(idx, battle('b', [{ unit: 'sack', row: 'front', index: 0 }]), party(['swift', 'front', 0]), 'seed');
    const plain = strike(start(), false).dealt;
    const loud = strike(start(), true).dealt;
    /*
     * Разброс и крит берутся из одного и того же сида, поэтому отношение
     * ровно множительное — но округление стоит ПОСЛЕ умножения, и точное
     * равенство `loud === round(plain * 1.5)` неверно: округлённое, умноженное
     * на полтора, и умноженное, а потом округлённое, расходятся на единицу.
     * (Первая редакция теста требовала равенства и падала на 16 против 17 —
     * врал тест, а не движок.) Допуск в одну точку — это и есть цена
     * округления, больше ей взяться неоткуда.
     */
    expect(Math.abs(loud - plain * SURGE_POWER)).toBeLessThanOrEqual(1);
    expect(loud).toBeGreaterThan(plain);
  });

  it('лечение наддать нельзя: заём темпа слышен в ударе, а не в числе побольше', () => {
    const mend = abilities.find((a) => a.id === 'mend') as Ability;
    const s = startBattle(idx, battle('b', [{ unit: 'sack', row: 'front', index: 0 }]), party(['healer', 'back', 0]), 's');
    const actor = currentActor(s);
    expect(actor && canSurge(mend, actor)).toBe(false);
  });

  it('`surge: false` в данных запрещает наддачу', () => {
    const odd = abilities.find((a) => a.id === 'odd') as Ability;
    const s = startBattle(idx, battle('b', [{ unit: 'sack', row: 'front', index: 0 }]), party(['odd_one', 'front', 0]), 's');
    const actor = currentActor(s);
    expect(actor && canSurge(odd, actor)).toBe(false);
  });
});

describe('наддать: цена', () => {
  it('наддавший пропускает свой следующий ход, а не раунд', () => {
    let s = startBattle(idx, battle('b', [{ unit: 'sack', row: 'front', index: 0 }]), party(['swift', 'front', 0]), 'seed');
    const me = currentActor(s)?.uid;
    s = strike(s, true).after;
    expect(isWinded(s.units.find((u) => u.uid === me) as never)).toBe(true);
    // Крутим бой, пока очередь снова не дойдёт до наддавшего.
    let skipped = false;
    for (let i = 0; i < 40 && s.outcome === 'ongoing'; i++) {
      if (s.events.some((e) => e.type === 'blocked' && e.uid === me && e.reason === 'winded')) {
        skipped = true;
        break;
      }
      const a = currentActor(s);
      if (!a) break;
      const plan = planAction(idx, s, a);
      s = plan ? act(idx, s, plan) : act(idx, s, { ability: 'hit' });
    }
    expect(skipped).toBe(true);
    // Долг погашен ровно один раз: отдышка снята.
    expect(isWinded(s.units.find((u) => u.uid === me) as never)).toBe(false);
  });

  it('медленный платит за наддачу столько же, сколько быстрый: один свой ход', () => {
    const debt = (defId: string): number => {
      let s = startBattle(
        idx,
        battle('b', [{ unit: 'sack', row: 'front', index: 0 }]),
        party([defId, 'front', 0]),
        'seed',
      );
      // Дожидаемся своего хода: медленный ходит после мешка.
      for (let i = 0; i < 8 && currentActor(s)?.side !== 'player'; i++) {
        const a = currentActor(s);
        s = a ? act(idx, s, planAction(idx, s, a) ?? { ability: 'hit' }) : s;
      }
      const me = currentActor(s)?.uid;
      s = strike(s, true).after;
      let missed = 0;
      for (let i = 0; i < 60 && s.outcome === 'ongoing' && missed === 0; i++) {
        const a = currentActor(s);
        if (!a) break;
        s = act(idx, s, planAction(idx, s, a) ?? { ability: 'hit' });
        missed = s.events.filter((e) => e.type === 'blocked' && e.uid === me && e.reason === 'winded').length;
      }
      return missed;
    };
    // Один пропуск и там и там. Тикай отдышка раундами, медленный отделался бы
    // нулём: до его хода раунд успевает смениться.
    expect(debt('swift')).toBe(1);
    expect(debt('slow')).toBe(1);
  });

  it('в отдышке наддать нельзя: занимать нечего, ход уже отдан', () => {
    const hit = abilities.find((a) => a.id === 'hit') as Ability;
    let s = startBattle(idx, battle('b', [{ unit: 'sack', row: 'front', index: 0 }]), party(['swift', 'front', 0]), 'seed');
    const me = currentActor(s)?.uid;
    s = strike(s, true).after;
    const winded = s.units.find((u) => u.uid === me) as never;
    expect(canSurge(hit, winded)).toBe(false);
  });

  it('незаконная наддача не отнимает ход: удар проходит обычным', () => {
    const start = () =>
      startBattle(idx, battle('b', [{ unit: 'sack', row: 'front', index: 0 }]), party(['odd_one', 'front', 0]), 'seed');
    const foe = () => start().units.find((u) => u.side === 'enemy');
    const plain = act(idx, start(), { ability: 'odd', targetUid: foe()?.uid });
    const tried = act(idx, start(), { ability: 'odd', targetUid: foe()?.uid, surge: true });
    const hp = (s: BattleState) => s.units.find((u) => u.side === 'enemy')?.hp;
    expect(hp(tried)).toBe(hp(plain));
    expect(tried.events.some((e) => e.type === 'surge')).toBe(false);
    expect(tried.events.some((e) => e.type === 'blocked')).toBe(false);
  });
});

describe('наддать: политика бота', () => {
  const thin = battle('thin', [{ unit: 'thin', row: 'front', index: 0 }]);

  it('«на добивание» наддаёт там, где обычный удар не добьёт', () => {
    const s = startBattle(idx, thin, party(['swift', 'front', 0]), 'seed');
    const actor = currentActor(s) as never;
    // 10 атаки против 0 брони — 10 урона, у цели 12: обычным не добить,
    // наддачей (15) добить.
    expect(planAction(idx, s, actor, { surge: 'finish' })?.surge).toBe(true);
  });

  it('«на добивание» не наддаёт в мешок, которого всё равно не свалить', () => {
    const s = startBattle(
      idx,
      battle('sack', [{ unit: 'sack', row: 'front', index: 0 }]),
      party(['swift', 'front', 0]),
      'seed',
    );
    const actor = currentActor(s) as never;
    expect(planAction(idx, s, actor, { surge: 'finish' })?.surge).toBeUndefined();
  });

  it('«никогда» и «всегда» — крайности, между которыми и меряется цена', () => {
    const s = startBattle(idx, thin, party(['swift', 'front', 0]), 'seed');
    const actor = currentActor(s) as never;
    expect(planAction(idx, s, actor, { surge: 'never' })?.surge).toBeUndefined();
    expect(planAction(idx, s, actor, { surge: 'always' })?.surge).toBe(true);
  });
});
