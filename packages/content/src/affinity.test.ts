/**
 * Сродство существ и личностей — таблица §C.4 `docs/MEMORY_POWERS.md`.
 *
 * Зачем отдельный файл проверок. Сродство выражено трейтом `life_*`, то есть
 * обычной строкой в массиве: опечатка в ней ничем не отличается от отсутствия
 * сродства, и юнит просто молча перестанет откликаться. Заметить это в бою
 * невозможно — отклик и так не у всех. Поэтому таблица продублирована здесь
 * целиком и сверяется поимённо: расхождение между каноном и данными обязано
 * ронять сборку, а не тихо гасить механику.
 *
 * Отказы в таблице такие же осмысленные, как сродства, и проверяются наравне:
 * Братство не отзывается на чужие воспоминания принципиально, полюса без
 * жизни (хват и отпускание) резонировать не с чем, а счетоводы обратного
 * полюса не отзываются по правилу — руки узнали бы, человек нет.
 */
import { describe, expect, it } from 'vitest';
import { content } from './index.js';

/** Канон §C.4, переписанный руками. Менять — только вслед за документом. */
const AFFINITY: Record<string, string[]> = {
  smolokur: ['gar', 'tar_burner', 'throat_taker', 'ferry_hook', 'hook_man'],
  klyuchar: ['vodonos', 'almshouse_sister', 'grateful_debtor'],
  posulshchik: ['posul', 'promise_pedlar', 'borrowed_face', 'guild_hoarder_vey', 'memory_thief_orsa'],
  chistopisets: ['svidetel', 'sworn_witness', 'plain_speaker', 'chalk_marker', 'hole_reader'],
  perechen: ['debt_bailiff', 'pawn_appraiser_dusk', 'archive_rat', 'flask_hoarder'],
};

/** Осознанно без сродства — §C.4, нижняя часть таблицы. */
const NO_AFFINITY = [
  'brother_ash',
  'pale_deacon',
  'empty_head_elder',
  'barefoot_brother',
  'gravedigger_of_things',
  'tight_fist',
  'pledge_holder',
  'ledger_clerk',
  'cold_reckoner',
  'unclaimed_pledge',
  'dusty_errand_boy',
  'relay_driver',
  'pocket_cutter',
  'hollow_sergeant',
  'vault_lock',
  'wandering_debtor',
  'line_hailer',
  'beacon_warden',
];

const lifeTrait = (id: string): string | undefined =>
  content.units.find((u) => u.id === id)?.traits?.find((t) => t.startsWith('life_'));

describe('сродство существ и личностей', () => {
  it('таблица покрывает весь ростер и ровно по разу', () => {
    const listed = [...Object.values(AFFINITY).flat(), ...NO_AFFINITY];
    expect(new Set(listed).size, 'юнит попал в таблицу дважды').toBe(listed.length);
    expect([...listed].sort()).toEqual(content.units.map((u) => u.id).sort());
  });

  it('каждому сродственному юниту проставлен трейт своей жизни', () => {
    for (const [life, units] of Object.entries(AFFINITY)) {
      for (const id of units) {
        expect(lifeTrait(id), `${id} без сродства к ${life}`).toBe(`life_${life}`);
      }
    }
  });

  it('несродственным сродство не приписано', () => {
    for (const id of NO_AFFINITY) {
      expect(lifeTrait(id), `${id} получил сродство, которого канон ему не давал`).toBeUndefined();
    }
  });

  it('трейт жизни у юнита ровно один и указывает на существующую жизнь', () => {
    const lives = new Set(content.lives.map((l) => l.id));
    for (const u of content.units) {
      const found = (u.traits ?? []).filter((t) => t.startsWith('life_'));
      expect(found.length, `${u.id}: трейтов жизни ${found.length}`).toBeLessThanOrEqual(1);
      for (const t of found) {
        expect(lives.has(t.slice('life_'.length)), `${u.id}: жизни ${t} не существует`).toBe(true);
      }
    }
  });

  it('распределение по жизням — то самое, неравное', () => {
    // Ключарю мало кто ровня: милосердных в этой стране мало, и это правда
    // мира, а не недосмотр таблицы (§C.4, итог).
    const counts = Object.fromEntries(
      Object.entries(AFFINITY).map(([life, u]) => [life, u.length]),
    );
    expect(counts).toEqual({
      smolokur: 5,
      klyuchar: 3,
      posulshchik: 5,
      chistopisets: 5,
      perechen: 4,
    });
    expect(NO_AFFINITY.length).toBe(18);
  });

  it('у каждой жизни есть хоть один сродственный юнит — иначе умение немо', () => {
    for (const life of content.lives) {
      const kin = content.units.filter((u) => (u.traits ?? []).includes(`life_${life.id}`));
      expect(kin.length, `жизнь ${life.id} без сродственных`).toBeGreaterThan(0);
    }
  });
});
