import { describe, expect, it } from 'vitest';
import {
  applyDeath,
  grantXp,
  levelFromXp,
  lifeProgress,
  memoryFragmentProgress,
  memoryIdsOfLife,
  recruitableUnits,
  selectMemoryOnDeath,
  xpForLevel,
} from './progression.js';
import { evalCondition } from './conditions.js';
import { applyEffect, createInitialState, scaledMaxHp, type EffectContext, type GameState } from './state.js';
import type { ContentBundle, DeathDef, PartyUnit, UnitDef } from './types.js';

const t = (ru: string) => ({ ru, en: ru });

function unitDef(id: string, over: Partial<UnitDef> = {}): UnitDef {
  return {
    id,
    name: t(id),
    blurb: t(id),
    art: '',
    faction: 'echo',
    tier: 1,
    row: 'back',
    stats: { hp: 40, atk: 10, def: 5, initiative: 10 },
    abilities: ['hit'],
    ...over,
  };
}

const content: ContentBundle = {
  axes: [{ id: 'mercy_cruelty', positive: t('Милосердие'), negative: t('Жестокость'), extreme: 60, start: 0 }],
  scenes: [],
  units: [
    unitDef('vodonos'),
    unitDef('gar'),
    unitDef('sprout', { evolvesTo: 'bloom', evolveAt: 250 }),
    unitDef('bloom', { tier: 2, stats: { hp: 60, atk: 15, def: 8, initiative: 10 } }),
    unitDef('always_here'),
    unitDef('only_kind', { recruitable: { kind: 'axis', axis: 'mercy_cruelty', op: 'gte', value: 40 } }),
    unitDef('only_cruel', { recruitable: { kind: 'axis', axis: 'mercy_cruelty', op: 'lte', value: -40 } }),
  ],
  abilities: [
    { id: 'hit', name: t('Удар'), description: t('Удар'), icon: 'sword', target: 'enemy_front', power: 1, cooldown: 0 },
  ],
  battles: [],
  lives: [
    {
      id: 'klyuchar',
      name: t('Ключарь'),
      flavor: t('Я никому не отказал.'),
      icon: 'key',
      axis: 'mercy_cruelty',
      pole: 'positive',
      memories: ['kolodets', 'otkaz'],
      grants: [{ kind: 'recruit', unit: 'vodonos' }],
    },
    {
      id: 'smolokur',
      name: t('Смолокур'),
      flavor: t('Быстрая война милосерднее долгой.'),
      icon: 'fire',
      axis: 'mercy_cruelty',
      pole: 'negative',
      memories: ['ples'],
      grants: [{ kind: 'recruit', unit: 'gar' }],
    },
  ],
  memories: [
    { id: 'kolodets', life: 'klyuchar', name: t('Колодец'), revelation: t('Вода была общей.'), icon: 'key', cost: 5 },
    { id: 'otkaz', life: 'klyuchar', name: t('Отказ'), revelation: t('Отказа не было.'), icon: 'key', cost: 5 },
    { id: 'ples', life: 'smolokur', name: t('Плёс'), revelation: t('Город горел.'), icon: 'fire', cost: 5,
      grants: [{ kind: 'flag', flag: 'ples_zakreplen', value: true }] },
  ],
  deaths: [],
  chapters: [],
  speakers: [],
};

const death: DeathDef = {
  id: 'nozh_v_ryadakh',
  name: t('Нож в Мокрых рядах'),
  wakeScene: 'chulan',
  wakeText: t('Труха собирается обратно.'),
};

const ctx: EffectContext = {
  unitStats: (id) => {
    const u = content.units.find((x) => x.id === id);
    return u ? { hp: u.stats.hp, row: u.row } : undefined;
  },
};

function member(defId: string, hp: number, xp = 0, level = 1): PartyUnit {
  return { uid: `u:${defId}`, defId, hp, xp, level, slot: { row: 'front', index: 0 } };
}

function state(patch: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    seed: 'prog',
    axes: [{ id: 'mercy_cruelty', start: 0 }],
    chapter: 1,
    scene: 'mokrye_ryady',
    node: 'n1',
    now: 0,
  });
  return { ...base, ...patch };
}

describe('опыт и уровни', () => {
  it('xpForLevel = 50·l·(l+1)', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(300);
    expect(xpForLevel(3)).toBe(600);
    expect(xpForLevel(4)).toBe(1000);
  });

  it('levelFromXp растёт по порогам и упирается в десятый', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(299)).toBe(2);
    expect(levelFromXp(300)).toBe(3);
    expect(levelFromXp(10_000_000)).toBe(10);
  });

  it('grantXp поднимает уровень и сообщает об этом', () => {
    const units = new Map(content.units.map((u) => [u.id, u]));
    const r = grantXp(state({ party: [member('vodonos', 40)] }), units, 100);
    expect(r.state.party[0]?.level).toBe(2);
    expect(r.levelUps).toEqual([{ uid: 'u:vodonos', from: 1, to: 2 }]);
    expect(r.evolutions).toHaveLength(0);
  });

  it('grantXp с явным списком не трогает остальных', () => {
    const units = new Map(content.units.map((u) => [u.id, u]));
    const s = state({ party: [member('vodonos', 40), member('gar', 40)] });
    const r = grantXp(s, units, 100, ['u:vodonos']);
    expect(r.state.party[0]?.xp).toBe(100);
    expect(r.state.party[1]?.xp).toBe(0);
  });

  it('эволюция срабатывает на evolveAt и меняет defId', () => {
    const units = new Map(content.units.map((u) => [u.id, u]));
    const r = grantXp(state({ party: [member('sprout', 40)] }), units, 250);
    expect(r.state.party[0]?.defId).toBe('bloom');
    expect(r.evolutions).toEqual([{ uid: 'u:sprout', from: 'sprout', to: 'bloom' }]);
  });

  it('до порога эволюции ничего не происходит', () => {
    const units = new Map(content.units.map((u) => [u.id, u]));
    const r = grantXp(state({ party: [member('sprout', 40)] }), units, 249);
    expect(r.state.party[0]?.defId).toBe('sprout');
    expect(r.evolutions).toHaveLength(0);
  });
});

describe('selectMemoryOnDeath', () => {
  it('нечего закреплять — undefined', () => {
    expect(selectMemoryOnDeath(state({ fragments: { kolodets: 4 } }), content)).toBeUndefined();
  });

  it('побеждает воспоминание с наибольшим числом осколков', () => {
    const s = state({ fragments: { kolodets: 5, ples: 9 } });
    expect(selectMemoryOnDeath(s, content)?.id).toBe('ples');
  });

  it('при равенстве осколков решает ось: тянет к своему полюсу', () => {
    const kind = state({ fragments: { kolodets: 5, ples: 5 }, axes: { mercy_cruelty: 40 } });
    expect(selectMemoryOnDeath(kind, content)?.id).toBe('kolodets');
    const cruel = state({ fragments: { kolodets: 5, ples: 5 }, axes: { mercy_cruelty: -40 } });
    expect(selectMemoryOnDeath(cruel, content)?.id).toBe('ples');
  });

  it('при полном равенстве порядок стабилен (по id)', () => {
    const s = state({ fragments: { kolodets: 5, otkaz: 5 }, axes: { mercy_cruelty: 0 } });
    expect(selectMemoryOnDeath(s, content)?.id).toBe('kolodets');
  });

  it('уже закреплённое не выдаётся повторно', () => {
    const s = state({ fragments: { kolodets: 9, ples: 5 }, lockedMemories: ['kolodets'] });
    expect(selectMemoryOnDeath(s, content)?.id).toBe('ples');
  });
});

describe('applyDeath', () => {
  it('считает смерть, закрепляет лот, будит жизнь и восстанавливает отряд', () => {
    const s = state({
      fragments: { ples: 6 },
      party: [member('gar', 3)],
      deaths: 1,
      log: [{ nodeId: 'n1', scene: 'mokrye_ryady', kind: 'narration', ru: 'x', en: 'x' }],
    });
    const out = applyDeath(s, content, death, ctx);
    expect(out.memory?.id).toBe('ples');
    expect(out.life?.id).toBe('smolokur');
    expect(out.lifeAwakened).toBe(true);
    expect(out.state.deaths).toBe(2);
    expect(out.state.lockedMemories).toContain('ples');
    expect(out.state.flags['ples_zakreplen']).toBe(true);
    expect(out.state.party.find((u) => u.defId === 'gar')?.hp).toBe(40);
    expect(out.state.scene).toBe('chulan');
    expect(out.state.node).toBe('@entry');
    expect(out.state.log).toHaveLength(0);
  });

  it('жизнь просыпается один раз, второе воспоминание её не будит', () => {
    const first = applyDeath(state({ fragments: { kolodets: 5, otkaz: 5 } }), content, death, ctx);
    expect(first.lifeAwakened).toBe(true);
    expect(first.memory?.id).toBe('kolodets');
    const second = applyDeath({ ...first.state, fragments: { otkaz: 5 } }, content, death, ctx);
    expect(second.memory?.id).toBe('otkaz');
    expect(second.lifeAwakened).toBe(false);
    expect(second.state.awakenedLives).toEqual(['klyuchar']);
  });

  it('восстановление после смерти уважает уровень: hp = уровневый максимум', () => {
    const out = applyDeath(state({ party: [member('gar', 3, 1000, 5)] }), content, death, ctx);
    expect(out.state.party[0]?.hp).toBe(scaledMaxHp(40, 5)); // 59, а не базовые 40
  });

  it('смерть без готовых осколков всё равно возвращает отряд в чулан', () => {
    const out = applyDeath(state({ party: [member('vodonos', 1)] }), content, death, ctx);
    expect(out.memory).toBeUndefined();
    expect(out.lifeAwakened).toBe(false);
    expect(out.state.party[0]?.hp).toBe(40);
    expect(out.state.scene).toBe('chulan');
  });

  it('грант жизни приводит отголосок в отряд', () => {
    const out = applyDeath(state({ fragments: { ples: 5 } }), content, death, ctx);
    expect(out.state.party.some((u) => u.defId === 'gar')).toBe(true);
  });
});

describe('heal-эффект и уровневый максимум', () => {
  it('лечит до уровневого максимума, а не до базового', () => {
    // Уровень 5: максимум 59. Раньше max брался из базовых статов (40).
    const s = state({ party: [member('vodonos', 50, 1000, 5)] });
    const r = applyEffect(s, { kind: 'heal', amount: 100 }, ctx);
    expect(r.party[0]?.hp).toBe(scaledMaxHp(40, 5));
  });

  it('никогда не снижает hp: прокачанный юнит выше базового максимума не режется', () => {
    const s = state({ party: [member('vodonos', 55, 1000, 5)] });
    const r = applyEffect(s, { kind: 'heal', amount: 1 }, ctx);
    expect(r.party[0]?.hp).toBeGreaterThanOrEqual(55);
  });
});

describe('вспомогательные счётчики', () => {
  it('lifeProgress считает закреплённое из жизни', () => {
    const life = content.lives[0];
    if (!life) throw new Error('нет жизни');
    expect(lifeProgress(state({ lockedMemories: ['kolodets'] }), life)).toEqual({ locked: 1, total: 2 });
  });

  it('memoryFragmentProgress показывает готовность', () => {
    const m = content.memories[0];
    if (!m) throw new Error('нет воспоминания');
    expect(memoryFragmentProgress(state({ fragments: { kolodets: 2 } }), m)).toEqual({
      have: 2,
      need: 5,
      ready: false,
    });
    expect(memoryFragmentProgress(state({ fragments: { kolodets: 5 } }), m).ready).toBe(true);
  });

  it('memoryIdsOfLife собирает воспоминания жизни', () => {
    expect(memoryIdsOfLife(content, 'klyuchar')).toEqual(['kolodets', 'otkaz']);
  });

  it('recruitableUnits режет по осям', () => {
    const kind = recruitableUnits(state({ axes: { mercy_cruelty: 60 } }), content, evalCondition).map((u) => u.id);
    expect(kind).toContain('only_kind');
    expect(kind).not.toContain('only_cruel');
    const cruel = recruitableUnits(state({ axes: { mercy_cruelty: -60 } }), content, evalCondition).map((u) => u.id);
    expect(cruel).toContain('only_cruel');
    expect(cruel).not.toContain('only_kind');
    expect(cruel).toContain('always_here');
  });

  it('в середине оси крайние наёмники недоступны оба', () => {
    const mid = recruitableUnits(state({ axes: { mercy_cruelty: 0 } }), content, evalCondition).map((u) => u.id);
    expect(mid).not.toContain('only_kind');
    expect(mid).not.toContain('only_cruel');
    expect(mid).toContain('always_here');
  });
});
