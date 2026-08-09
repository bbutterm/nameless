/**
 * Кто проверяет проверяющего.
 *
 * Фаззер и симулятор боёв — единственная защита от порчи контента, которую
 * невозможно поймать типами. Но до сих пор никто не гарантировал, что они
 * ВООБЩЕ что-то ловят: молчаливый фаззер выглядит точно так же, как зелёный.
 * Здесь на заведомо сломанных синтетических бандлах проверяется, что каждая
 * категория поломки доходит до отчёта.
 */
import { describe, expect, it } from 'vitest';
import type {
  Ability,
  ContentBundle,
  PartyUnit,
  Scene,
  SceneNode,
  UnitDef,
} from '@nameless/engine';
import { content as gameContent } from '@nameless/content';
import { fuzzDialogue, makePersonalities } from './dialogue-fuzz.js';
import { determinismCheck, scriptedBattles, unitWinrates } from './battle-sim.js';
import { exhaustiveLadderCheck, personaRun, PERSONAS } from './resonance.js';

const L = (s: string) => ({ ru: s, en: s });

function bundle(part: Partial<ContentBundle> = {}): ContentBundle {
  return {
    axes: [{ id: 'a', positive: L('+'), negative: L('-'), extreme: 60, start: 0 }],
    scenes: [],
    units: [],
    abilities: [],
    battles: [],
    lives: [],
    memories: [],
    deaths: [],
    chapters: [{ index: 1, id: 'ch1', title: L('ch1'), entryScene: 'start' }],
    speakers: [{ id: 'narrator' }],
    codex: [],
    ...part,
  };
}

function scene(id: string, nodes: SceneNode[], extra: Partial<Scene> = {}): Scene {
  return { id, chapter: 1, title: L(id), entry: nodes[0]?.id ?? 'e', nodes, ...extra };
}

const end = (id = 'e'): SceneNode => ({ kind: 'end', id });
const line = (id: string, next: string): SceneNode => ({ kind: 'narration', id, text: L(id), next });

function ability(id: string, extra: Partial<Ability> = {}): Ability {
  return { id, name: L(id), description: L(id), icon: 'i', target: 'enemy_front', power: 1, cooldown: 0, ...extra };
}

function unit(id: string, extra: Partial<UnitDef> = {}): UnitDef {
  return {
    id,
    name: L(id),
    blurb: L(id),
    art: '',
    faction: 'f',
    tier: 1,
    row: 'front',
    stats: { hp: 30, atk: 8, def: 2, initiative: 5 },
    abilities: ['hit'],
    ...extra,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Фаззер обязан кричать
// ─────────────────────────────────────────────────────────────────────────────

describe('фаззер: тупик в узле выбора', () => {
  it('единственный проходящий вариант — это deadEnd, а не «всё в порядке»', () => {
    const b = bundle({
      scenes: [
        scene('start', [
          {
            kind: 'choice',
            id: 'trap',
            options: [
              { id: 'only', text: L('only'), to: 'e' },
              { id: 'never', text: L('never'), to: 'e', conditions: { kind: 'never' } },
            ],
          },
          end(),
        ]),
      ],
    });
    const report = fuzzDialogue(b, 20);
    expect(report.deadEnds.length, 'фаззер промолчал о тупике').toBeGreaterThan(0);
    expect(report.deadEnds.every((d) => d.node === 'trap')).toBe(true);
    expect(report.deadEnds[0]?.passing).toBe(1);
  });

  it('два безусловных варианта тупиком не считаются', () => {
    const b = bundle({
      scenes: [
        scene('start', [
          {
            kind: 'choice',
            id: 'ok',
            options: [
              { id: 'a', text: L('a'), to: 'e' },
              { id: 'b', text: L('b'), to: 'e' },
            ],
          },
          end(),
        ]),
      ],
    });
    expect(fuzzDialogue(b, 20).deadEnds).toEqual([]);
  });

  it('узел выбора, где ВСЕ варианты условные и ни один не проходит, — тупик у каждой персоны', () => {
    const b = bundle({
      scenes: [
        scene('start', [
          {
            kind: 'choice',
            id: 'dead',
            options: [
              { id: 'x', text: L('x'), to: 'e', conditions: { kind: 'never' } },
              { id: 'y', text: L('y'), to: 'e', conditions: { kind: 'never' } },
            ],
          },
          end(),
        ]),
      ],
    });
    const report = fuzzDialogue(b, 15);
    expect(report.deadEnds).toHaveLength(15);
    expect(report.deadEnds.every((d) => d.passing === 0)).toBe(true);
  });
});

describe('фаззер: битые ссылки', () => {
  it('переход в несуществующий узел доходит до errors', () => {
    const b = bundle({ scenes: [scene('start', [line('a', 'nowhere'), end()])] });
    const report = fuzzDialogue(b, 5);
    expect(report.errors.length, 'фаззер не заметил битую ссылку').toBeGreaterThan(0);
    expect(report.errors.some((e) => e.message.includes('Нет узла'))).toBe(true);
  });

  it('переход в несуществующую сцену тоже доходит до errors', () => {
    const b = bundle({ scenes: [scene('start', [line('a', 'scene:ghost'), end()])] });
    const report = fuzzDialogue(b, 5);
    expect(report.errors.some((e) => e.message.includes('Нет узла'))).toBe(true);
  });

  it('узел death без описанной смерти — отдельная ошибка', () => {
    const b = bundle({ scenes: [scene('start', [{ kind: 'death', id: 'die', death: 'ghost' }])] });
    const report = fuzzDialogue(b, 5);
    expect(report.errors.some((e) => e.message.includes('Нет смерти'))).toBe(true);
  });

  it('целый бандл ошибок не даёт', () => {
    const b = bundle({ scenes: [scene('start', [line('a', 'e'), end()])] });
    expect(fuzzDialogue(b, 5).errors).toEqual([]);
  });
});

describe('фаззер: зацикливание', () => {
  it('узел effects, зацикленный сам на себя, доходит до errors', () => {
    const b = bundle({
      scenes: [
        scene('start', [
          { kind: 'effects', id: 'loop', effects: [{ kind: 'counter', counter: 'c', delta: 1 }], next: 'loop' },
        ]),
      ],
    });
    const report = fuzzDialogue(b, 5);
    expect(report.errors.some((e) => e.message.includes('Зацикливание'))).toBe(true);
  });

  it('кольцо из двух branch-узлов тоже ловится', () => {
    const b = bundle({
      scenes: [
        scene('start', [
          { kind: 'branch', id: 'one', branches: [{ when: { kind: 'always' }, to: 'two' }], fallback: 'two' },
          { kind: 'branch', id: 'two', branches: [{ when: { kind: 'always' }, to: 'one' }], fallback: 'one' },
        ]),
      ],
    });
    expect(fuzzDialogue(b, 5).errors.some((e) => e.message.includes('Зацикливание'))).toBe(true);
  });

  it('кольцо ЧЕРЕЗ выбор не зацикливание — фаззер не должен путать его с ошибкой', () => {
    const b = bundle({
      scenes: [
        scene('start', [
          {
            kind: 'choice',
            id: 'hub',
            options: [
              { id: 'again', text: L('again'), to: 'hub' },
              { id: 'out', text: L('out'), to: 'e' },
            ],
          },
          end(),
        ]),
      ],
    });
    expect(fuzzDialogue(b, 10).errors).toEqual([]);
  });
});

describe('фаззер: мёртвый и лишний текст', () => {
  it('вариант, который не увидит ни одна персона, попадает в neverShownOptions', () => {
    const b = bundle({
      scenes: [
        scene('start', [
          {
            kind: 'choice',
            id: 'c',
            options: [
              { id: 'a', text: L('a'), to: 'e' },
              { id: 'b', text: L('b'), to: 'e' },
              { id: 'ghost', text: L('ghost'), to: 'e', conditions: { kind: 'never' } },
            ],
          },
          end(),
        ]),
      ],
    });
    const report = fuzzDialogue(b, 30);
    expect(report.neverShownOptions.map((o) => o.option)).toContain('ghost');
    expect(report.neverShownOptions.map((o) => o.option)).not.toContain('a');
  });

  it('условие, которое проходит у всех, помечается как лишнее', () => {
    const b = bundle({
      scenes: [
        scene('start', [
          {
            kind: 'choice',
            id: 'c',
            options: [
              { id: 'a', text: L('a'), to: 'e' },
              { id: 'b', text: L('b'), to: 'e' },
              { id: 'pointless', text: L('p'), to: 'e', conditions: { kind: 'always' } },
            ],
          },
          end(),
        ]),
      ],
    });
    expect(fuzzDialogue(b, 25).alwaysShownConditional.map((o) => o.option)).toContain('pointless');
  });

  it('недостижимый узел попадает в unreachableNodes', () => {
    const b = bundle({ scenes: [scene('start', [line('a', 'e'), end(), line('lost', 'e')])] });
    const report = fuzzDialogue(b, 10);
    expect(report.unreachableNodes.map((n) => n.node)).toContain('lost');
    expect(report.unreachableNodes.map((n) => n.node)).not.toContain('a');
  });

  it('охват реплик считается по достигнутым say/narration', () => {
    const b = bundle({ scenes: [scene('start', [line('a', 'b'), line('b', 'e'), end(), line('lost', 'e')])] });
    const report = fuzzDialogue(b, 10);
    expect(report.totalLines).toBe(3);
    expect(report.reachedLines).toBe(2);
    expect(report.lineCoverage).toBeCloseTo(2 / 3, 5);
  });

  it('бандл без реплик даёт охват 1, а не деление на ноль', () => {
    const b = bundle({ scenes: [scene('start', [end()])] });
    const report = fuzzDialogue(b, 5);
    expect(report.lineCoverage).toBe(1);
    expect(report.cleanCoverage).toBe(1);
  });
});

describe('фаззер: честное прохождение с нуля', () => {
  it('ветка за флагом, который ставится ПОЗЖЕ, недостижима чистой персоной', () => {
    // Единственный путь: сначала читается флаг, и только потом ставится.
    // Случайная персона может получить флаг при генерации и «увидеть» ветку —
    // ровно тот класс ошибок, ради которого существует cleanCoverage.
    const b = bundle({
      scenes: [
        scene('start', [
          {
            kind: 'branch',
            id: 'gate',
            branches: [{ when: { kind: 'flag', flag: 'key' }, to: 'secret' }],
            fallback: 'grind',
          },
          line('secret', 'e'),
          { kind: 'effects', id: 'grind', effects: [{ kind: 'flag', flag: 'key', value: true }], next: 'plain' },
          line('plain', 'e'),
          end(),
        ]),
      ],
    });
    const report = fuzzDialogue(b, 40);
    expect(report.cleanOnlyUnreachable, 'узел за поздним флагом не отмечен').toContain('start#secret');
    expect(report.cleanCoverage).toBeLessThan(report.lineCoverage);
  });

  it('линейная сцена достижима целиком и чистой персоной', () => {
    const b = bundle({ scenes: [scene('start', [line('a', 'b'), line('b', 'e'), end()])] });
    const report = fuzzDialogue(b, 20);
    expect(report.cleanCoverage).toBe(1);
    expect(report.cleanOnlyUnreachable).toEqual([]);
  });
});

describe('фаззер: детерминизм и выборка персон', () => {
  const sample = (): ContentBundle =>
    bundle({
      scenes: [
        scene('start', [
          {
            kind: 'choice',
            id: 'c',
            options: [
              { id: 'a', text: L('a'), to: 'e' },
              { id: 'b', text: L('b'), to: 'e', conditions: { kind: 'axis', axis: 'a', op: 'gte', value: 50 } },
              { id: 'f', text: L('f'), to: 'e', fallback: true },
            ],
          },
          end(),
        ]),
      ],
    });

  it('два прогона на одном бандле дают побайтово одинаковый отчёт', () => {
    const a = fuzzDialogue(sample(), 50);
    const b = fuzzDialogue(sample(), 50);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('персоны детерминированы по индексу', () => {
    const b = sample();
    expect(JSON.stringify(makePersonalities(b, 30))).toBe(JSON.stringify(makePersonalities(b, 30)));
  });

  it('выборка отряда достаёт и юнитов из конца реестра (регрессия смещённого slice)', () => {
    const units = [...Array(20)].map((_, i) => unit(`u${i}`));
    const b = bundle({ scenes: [scene('start', [end()])], units, abilities: [ability('hit')] });
    const personas = makePersonalities(b, 200);
    const seen = new Set(personas.flatMap((p) => p.units));
    // Хвост реестра обязан встречаться: раньше filter().slice(0,6) его срезал.
    expect(seen.has('u19'), 'последний юнит реестра не выпал ни одной персоне').toBe(true);
    expect(seen.size).toBe(20);
    // И размер отряда не превышает шести клеток.
    expect(Math.max(...personas.map((p) => p.units.length))).toBeLessThanOrEqual(6);
  });

  it('персоны накрывают оба края каждой оси', () => {
    const b = sample();
    const personas = makePersonalities(b, 200);
    expect(personas.some((p) => (p.axes['a'] ?? 0) <= -60)).toBe(true);
    expect(personas.some((p) => (p.axes['a'] ?? 0) >= 60)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Симулятор боёв
// ─────────────────────────────────────────────────────────────────────────────

describe('battle-sim: цифры значат то, что написано', () => {
  const abilities = [ability('hit', { power: 1 })];
  /** Три одинаковых юнита и один заведомо сильнее всех. */
  const units = [
    unit('even1'),
    unit('even2'),
    unit('even3'),
    unit('even4'),
    unit('titan', { stats: { hp: 90, atk: 20, def: 8, initiative: 9 } }),
  ];

  it('determinismCheck зелёный на нормальном бандле', () => {
    const b = bundle({
      units,
      abilities,
      battles: [{ id: 'b1', name: L('b1'), enemies: [{ unit: 'even1', row: 'front', index: 0 }], turnLimit: 20 }],
    });
    const party: PartyUnit[] = [
      { uid: 'p0', defId: 'even2', hp: 30, xp: 0, level: 1, slot: { row: 'front', index: 0 } },
    ];
    expect(determinismCheck(b, party)).toEqual({ ok: true });
  });

  it('одинаковые юниты держатся около измеренной нулевой точки', () => {
    const b = bundle({ units: units.slice(0, 4), abilities });
    const wr = unitWinrates(b, 30);
    for (const w of wr) {
      expect(Math.abs(w.winrate - w.neutral), `${w.unit}: ${w.winrate} против нормы ${w.neutral}`).toBeLessThanOrEqual(
        0.25,
      );
    }
  });

  it('заведомо сильный юнит выигрывает чаще нулевой точки — иначе турнир слеп', () => {
    const b = bundle({ units, abilities });
    const wr = unitWinrates(b, 40);
    const titan = wr.find((w) => w.unit === 'titan');
    expect(titan, 'титана нет в отчёте').toBeDefined();
    expect(titan?.winrate, 'сильный юнит не отличается от среднего — симулятор не мерит силу').toBeGreaterThan(
      (titan?.neutral ?? 0.5) + 0.05,
    );
  });

  it('в отчёте есть строка на каждый юнит и число боёв больше нуля', () => {
    const b = bundle({ units: units.slice(0, 4), abilities });
    const wr = unitWinrates(b, 12);
    expect(wr).toHaveLength(4);
    for (const w of wr) {
      expect(w.battles).toBeGreaterThan(0);
      expect(w.winrate).toBeGreaterThanOrEqual(0);
      expect(w.winrate).toBeLessThanOrEqual(1);
      expect(w.avgRounds).toBeGreaterThan(0);
    }
  });

  it('тонкая выборка тира помечается и не выносится за коридор', () => {
    const b = bundle({ units: [unit('lonely', { tier: 3 }), unit('even1'), unit('even2')], abilities });
    const lonely = unitWinrates(b, 10).find((w) => w.unit === 'lonely');
    expect(lonely?.thinSample).toBe(true);
    expect(lonely?.inCorridor).toBe(true);
  });

  it('scriptedBattles отчитывается по каждому бою и не оставляет бой незавершённым', () => {
    const b = bundle({
      units,
      abilities,
      battles: [
        { id: 'b1', name: L('b1'), enemies: [{ unit: 'even1', row: 'front', index: 0 }], turnLimit: 20 },
        { id: 'b2', name: L('b2'), enemies: [{ unit: 'titan', row: 'front', index: 0 }], turnLimit: 20 },
      ],
    });
    const party: PartyUnit[] = [
      { uid: 'p0', defId: 'even2', hp: 30, xp: 0, level: 1, slot: { row: 'front', index: 0 } },
      { uid: 'p1', defId: 'even3', hp: 30, xp: 0, level: 1, slot: { row: 'front', index: 1 } },
    ];
    const rep = scriptedBattles(b, () => party, 10);
    expect(rep.map((r) => r.battle)).toEqual(['b1', 'b2']);
    for (const r of rep) {
      expect(r.runs).toBe(10);
      expect(r.avgRounds).toBeGreaterThan(0);
      expect(r.avgSurvivors).toBeGreaterThanOrEqual(0);
      expect(r.avgSurvivors).toBeLessThanOrEqual(1);
    }
    // Против титана отряд из двух середняков должен побеждать реже.
    expect((rep[1] as { winrate: number }).winrate).toBeLessThan((rep[0] as { winrate: number }).winrate);
  });

  it('бандл без юнитов не роняет симулятор', () => {
    expect(unitWinrates(bundle({}), 5)).toEqual([]);
    expect(scriptedBattles(bundle({}), () => [], 5)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Итерация B6: архив узнаёт не всех
// ─────────────────────────────────────────────────────────────────────────────

describe('резонанс: архив узнаёт не всех (B6)', () => {
  // Прореженный вариант того же перебора, что печатает `resonance-proof.ts`:
  // все 512 классов осей, каждый тридцать первый набор закреплённого (шаг
  // делит 32 767 нацело, поэтому полный архив в выборку попадает).
  const rep = exhaustiveLadderCheck(gameContent, 31);

  it('смертей без лота и без реплики не существует', () => {
    expect(rep.combos).toBeGreaterThan(500_000);
    expect(rep.silent).toBe(0);
  });

  it('если лестница досыпала осколки — лот закрепляется', () => {
    expect(rep.fundedButNoLot).toBe(0);
    expect(rep.lots).toBeGreaterThan(0);
  });

  it('«раздел не отзывается» достижимо и всегда с неустойкой', () => {
    expect(rep.noEcho).toBeGreaterThan(0);
  });

  it('контент и движок сходятся: шва «не отзывается, но раздел узнаваем» нет', () => {
    expect(rep.noEchoSeam).toBe(0);
  });

  it('механическая дверь в финал открыта только при полном архиве', () => {
    expect(rep.archiveEmptyEarly).toBe(0);
    expect(rep.archiveEmpty).toBeGreaterThan(0);
  });

  it('три личности приходят к разным наборам и ни одна не выкупает всё', () => {
    const runs = PERSONAS.map((p) => personaRun(gameContent, p, 16));
    const sets = runs.map((r) => [...r.locked].sort().join('|'));
    expect(new Set(sets).size).toBe(runs.length);
    for (const r of runs) {
      expect(r.deaths).toBe(16);
      expect(r.locked.length).toBeGreaterThanOrEqual(6);
      expect(r.locked.length).toBeLessThan(gameContent.memories.length);
      expect(r.silent).toBe(0);
      expect(r.fundedButNoLot).toBe(0);
      expect(r.seam).toBe(0);
    }
  });
});
