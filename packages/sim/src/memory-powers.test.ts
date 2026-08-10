/**
 * Пять умений памяти на настоящем контенте: числа §A `docs/MEMORY_POWERS.md`.
 *
 * Зачем отдельно от движковых проверок. Движку всё равно, сколько написано в
 * таблице канона: он честно исполнит и 6, и 600. Механика ступеней собрана из
 * коммутативных поправок (`amplify`), то есть числа ступени II и III не лежат
 * в данных прямо, а ВЫЧИСЛЯЮТСЯ из базовой записи и слитых поправок. Опечатка
 * в поправке даёт правдоподобное число, которое никто не заметит. Поэтому
 * таблицы §A.2–A.6 переписаны сюда целиком и сверяются с тем, что получает бой.
 *
 * Живёт в sim, а не в engine: только здесь есть и настоящий контент, и право
 * его читать.
 */
import { describe, expect, it } from 'vitest';
import { content } from '@nameless/content';
import { derivePlayerPowers, type BattleEffect, type PlayerAbility } from '@nameless/engine';

/** Воспоминания жизни по цене — тот самый порядок ступеней I → II → III. */
function ladder(life: string): string[] {
  return content.memories
    .filter((m) => m.life === life)
    .slice()
    .sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((m) => m.id);
}

function atTier(life: string, tier: number): PlayerAbility {
  const powers = derivePlayerPowers(ladder(life).slice(0, tier), content).abilities;
  expect(powers.length).toBe(1);
  return powers[0] as PlayerAbility;
}

const effects = (p: PlayerAbility): BattleEffect[] => p.ability.effects ?? [];

describe('лестницы ступеней собраны из воспоминаний', () => {
  it('у каждой из пяти жизней ровно три воспоминания, ценой 2, 3, 4', () => {
    for (const life of ['smolokur', 'klyuchar', 'posulshchik', 'chistopisets', 'perechen']) {
      const mems = content.memories.filter((m) => m.life === life);
      expect(mems.length, life).toBe(3);
      expect(mems.map((m) => m.cost).sort(), life).toEqual([2, 3, 4]);
    }
  });

  it('каждое из пятнадцати воспоминаний что-то делает с умениями', () => {
    for (const m of content.memories) {
      expect((m.powers ?? []).length, m.id).toBeGreaterThan(0);
    }
  });

  it('дешёвое воспоминание даёт, два дорогих усиливают', () => {
    for (const life of ['smolokur', 'klyuchar', 'posulshchik', 'chistopisets', 'perechen']) {
      const [first, second, third] = ladder(life);
      const byId = new Map(content.memories.map((m) => [m.id, m]));
      expect(byId.get(first as string)?.powers?.[0]?.kind, life).toBe('grant');
      expect(byId.get(second as string)?.powers?.[0]?.kind, life).toBe('amplify');
      expect(byId.get(third as string)?.powers?.[0]?.kind, life).toBe('amplify');
    }
  });

  it('ступень равна числу закреплённых воспоминаний', () => {
    for (const life of ['smolokur', 'klyuchar', 'posulshchik', 'chistopisets', 'perechen']) {
      for (let n = 1; n <= 3; n++) expect(atTier(life, n).tier, `${life}:${n}`).toBe(n);
    }
  });

  it('умение знает свою жизнь — по ней бой ищет сродственных', () => {
    for (const life of ['smolokur', 'klyuchar', 'posulshchik', 'chistopisets', 'perechen']) {
      expect(atTier(life, 1).life, life).toBe(life);
    }
  });

  it('одно усиление без дающего умения не создаёт', () => {
    for (const life of ['smolokur', 'klyuchar', 'posulshchik', 'chistopisets', 'perechen']) {
      const [, second, third] = ladder(life);
      expect(derivePlayerPowers([second as string], content).abilities.length, life).toBe(0);
      expect(derivePlayerPowers([second as string, third as string], content).abilities.length, life).toBe(0);
    }
  });

  it('ни одно воспоминание умений не отнимает: зарубка несрезаема (§F.1)', () => {
    for (const m of content.memories) {
      expect((m.powers ?? []).some((p) => p.kind === 'revoke'), m.id).toBe(false);
    }
  });

  it('порядок закрепления не меняет ни одно умение', () => {
    const all = content.memories.map((m) => m.id);
    const forward = derivePlayerPowers(all, content);
    const backward = derivePlayerPowers([...all].reverse(), content);
    const shuffled = derivePlayerPowers([...all].sort((a, b) => (a > b ? -1 : 1)), content);
    expect(JSON.stringify(backward)).toBe(JSON.stringify(forward));
    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(forward));
  });

  it('все пять умений живут одновременно и не сливаются в одно', () => {
    const all = derivePlayerPowers(content.memories.map((m) => m.id), content).abilities;
    expect(all.length).toBe(5);
    expect(new Set(all.map((p) => p.life)).size).toBe(5);
  });
});

describe('§A.2 Смолокур — «Развести смолу»', () => {
  it('I: ряд врагов, dot 5 на 2 раунда, мгновенного урона нет', () => {
    const p = atTier('smolokur', 1);
    expect(p.ability.target).toBe('enemy_row');
    expect(p.ability.power).toBe(0);
    expect(effects(p)).toEqual([{ kind: 'dot', amount: 5, turns: 2, tag: 'smola' }]);
  });

  it('II: все враги, dot растёт до 6 на 3 раунда', () => {
    const p = atTier('smolokur', 2);
    expect(p.ability.target).toBe('enemy_all');
    expect(effects(p)).toEqual([{ kind: 'dot', amount: 6, turns: 3, tag: 'smola' }]);
  });

  it('III: то же плюс +3 атаки на 2 раунда каждому живому своему', () => {
    const p = atTier('smolokur', 3);
    expect(p.ability.target).toBe('enemy_all');
    expect(effects(p)).toEqual([
      { kind: 'dot', amount: 6, turns: 3, tag: 'smola' },
      { kind: 'rally', stat: 'atk', amount: 3, turns: 2 },
    ]);
  });
});

describe('§A.3 Ключарь — «Подать кружку»', () => {
  it('I: один свой, лечение 14 и снятие эффектов', () => {
    const p = atTier('klyuchar', 1);
    expect(p.ability.target).toBe('ally_one');
    expect(effects(p)).toEqual([{ kind: 'heal_flat', amount: 14 }, { kind: 'cleanse' }]);
  });

  it('II: весь отряд, лечение 10 каждому', () => {
    const p = atTier('klyuchar', 2);
    expect(p.ability.target).toBe('ally_all');
    expect(effects(p)).toEqual([{ kind: 'heal_flat', amount: 10 }, { kind: 'cleanse' }]);
  });

  it('III: отряду 12 — и столько же самому раненому врагу', () => {
    const p = atTier('klyuchar', 3);
    expect(p.ability.target).toBe('ally_all');
    expect(effects(p)).toEqual([
      { kind: 'heal_flat', amount: 12 },
      { kind: 'cleanse' },
      { kind: 'spare_worst_foe', amount: 12 },
    ]);
  });
});

describe('§A.4 Посульщик — «Выписать посул»', () => {
  it('I: один свой, щит 15 на 2 раунда', () => {
    const p = atTier('posulshchik', 1);
    expect(p.ability.target).toBe('ally_one');
    expect(effects(p)).toEqual([{ kind: 'shield', amount: 15, turns: 2 }]);
  });

  it('II: ряд своих, щит 14 на 2 раунда', () => {
    const p = atTier('posulshchik', 2);
    expect(p.ability.target).toBe('ally_row');
    expect(effects(p)).toEqual([{ kind: 'shield', amount: 14, turns: 2 }]);
  });

  it('III: щит 20 и возврат непробитого остатка лечением', () => {
    const p = atTier('posulshchik', 3);
    expect(p.ability.target).toBe('ally_row');
    expect(effects(p)).toEqual([
      { kind: 'shield', amount: 20, turns: 2 },
      { kind: 'shield_refund' },
    ]);
  });
});

describe('§A.5 Чистописец — «Занести в протокол»', () => {
  it('I: один враг, снятие прибавлений и протокол на 2 раунда', () => {
    const p = atTier('chistopisets', 1);
    expect(p.ability.target).toBe('enemy_any');
    expect(effects(p)).toEqual([{ kind: 'purge' }, { kind: 'recorded', turns: 2 }]);
  });

  it('II: то же по ряду врагов', () => {
    const p = atTier('chistopisets', 2);
    expect(p.ability.target).toBe('enemy_row');
    expect(effects(p)).toEqual([{ kind: 'purge' }, { kind: 'recorded', turns: 2 }]);
  });

  it('III: всем обеим сторонам — чистый лист и два раунда без статусов', () => {
    const p = atTier('chistopisets', 3);
    expect(effects(p)).toEqual([
      { kind: 'purge' },
      { kind: 'recorded', turns: 2 },
      { kind: 'bare_truth', turns: 2 },
    ]);
  });
});

describe('§A.6 Перечень — «Опись» (пассив)', () => {
  it('I: только режим показа, кнопки нет', () => {
    const p = atTier('perechen', 1);
    expect(p.ability.passive).toBe(true);
    // Дебаф нулевой величины — способ сказать «на этой ступени его ещё нет»:
    // движок такой статус не вешает вовсе.
    expect(effects(p)).toEqual([
      { kind: 'reveal' },
      { kind: 'debuff', stat: 'def', amount: 0, turns: 2 },
    ]);
  });

  it('II: плюс −2 брони всем врагам на 2 раунда', () => {
    const p = atTier('perechen', 2);
    expect(effects(p)).toEqual([
      { kind: 'reveal' },
      { kind: 'debuff', stat: 'def', amount: 2, turns: 2 },
    ]);
  });

  it('III: −4 брони на 3 раунда и пеня 4 hp бездействовавшему', () => {
    const p = atTier('perechen', 3);
    expect(effects(p)).toEqual([
      { kind: 'reveal' },
      { kind: 'debuff', stat: 'def', amount: 4, turns: 3 },
      { kind: 'idle_toll', amount: 4 },
    ]);
  });

  it('пассив не масштабируется от атаки носителя — носителя у него нет', () => {
    for (let n = 1; n <= 3; n++) {
      const p = atTier('perechen', n);
      expect(p.ability.power).toBe(0);
      expect(effects(p).some((e) => e.kind === 'heal' || e.kind === 'damage')).toBe(false);
    }
  });
});

describe('§B.1 заряд один на бой', () => {
  it('у всех непассивных умений перезарядка длиннее любого боя', () => {
    const all = derivePlayerPowers(content.memories.map((m) => m.id), content).abilities;
    for (const p of all) {
      if (p.ability.passive) continue;
      expect(p.ability.cooldown, p.id).toBeGreaterThan(30);
      expect(p.costsTurn, p.id).toBe(true);
    }
  });
});

describe('§C.4 сродство читается трейтом', () => {
  it('у каждой жизни есть хотя бы один юнит-отголосок с её трейтом', () => {
    for (const life of ['smolokur', 'klyuchar', 'posulshchik', 'chistopisets', 'perechen']) {
      const kin = content.units.filter((u) => (u.traits ?? []).includes(`life_${life}`));
      expect(kin.length, life).toBeGreaterThanOrEqual(3);
    }
  });

  it('трейт сродства не заведён ни для одной жизни, которой нет в реестре', () => {
    const lives = new Set(content.lives.map((l) => l.id));
    for (const u of content.units) {
      for (const tr of u.traits ?? []) {
        if (!tr.startsWith('life_')) continue;
        expect(lives.has(tr.slice('life_'.length)), `${u.id}:${tr}`).toBe(true);
      }
    }
  });
});
