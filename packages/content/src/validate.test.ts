/**
 * Тесты валидатора: на синтетических бандлах, а не на настоящем контенте.
 *
 * Правило: каждая проверка валидатора должна иметь ДВА теста — «ловит порчу»
 * и «молчит на здоровом». Валидатор без второго теста быстро обрастает
 * ложными срабатываниями, сценаристы приучаются игнорировать предупреждения,
 * и щит перестаёт быть щитом.
 */
import { describe, expect, it } from 'vitest';
import type {
  Ability,
  BattleDef,
  Chapter,
  CodexEntry,
  Condition,
  ContentBundle,
  DeathDef,
  Effect,
  Memory,
  PastLife,
  Scene,
  SceneNode,
  UnitDef,
} from '@nameless/engine';
import { validateBundle, type Issue } from './validate.js';

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

const endNode = (id = 'e'): SceneNode => ({ kind: 'end', id });
const narr = (id: string, next: string): SceneNode => ({ kind: 'narration', id, text: L(id), next });

function ability(id: string, extra: Partial<Ability> = {}): Ability {
  return {
    id,
    name: L(id),
    description: L(id),
    icon: 'i',
    target: 'enemy_front',
    power: 1,
    cooldown: 0,
    ...extra,
  };
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
    stats: { hp: 20, atk: 5, def: 1, initiative: 5 },
    abilities: ['hit'],
    ...extra,
  };
}

const life = (id: string, memories: string[], extra: Partial<PastLife> = {}): PastLife => ({
  id,
  name: L(id),
  flavor: L(id),
  icon: 'i',
  axis: 'a',
  pole: 'positive',
  memories,
  ...extra,
});

const memory = (id: string, lifeId: string, cost: number): Memory => ({
  id,
  life: lifeId,
  name: L(id),
  revelation: L(id),
  icon: 'i',
  cost,
});

const codexEntry = (id: string, kind: CodexEntry['kind'], extra: Partial<CodexEntry> = {}): CodexEntry => ({
  id,
  kind,
  name: L(id),
  blurb: L(id),
  signs: L(`приметы ${id}`),
  lines: [{ id: `${id}_l1`, text: L(`строка ${id}`), source: 'seen', unlock: { kind: 'meet', speaker: id } }],
  ...extra,
});

/** Только сообщения нужного уровня — тесты сверяются по подстроке, не по формату. */
function messages(issues: Issue[], level?: Issue['level']): string[] {
  return issues.filter((i) => !level || i.level === level).map((i) => `${i.where}: ${i.message}`);
}
const has = (issues: Issue[], substr: string): boolean =>
  issues.some((i) => i.message.includes(substr));

// ─────────────────────────────────────────────────────────────────────────────
// Здоровый бандл
// ─────────────────────────────────────────────────────────────────────────────

/** Минимальный бандл, на котором валидатор обязан молчать целиком. */
function healthy(): ContentBundle {
  return bundle({
    scenes: [
      scene('start', [
        narr('intro', 'fight'),
        { kind: 'battle', id: 'fight', battle: 'b1', onWin: 'win', onLose: 'die' },
        { kind: 'effects', id: 'win', effects: [{ kind: 'fragment', memory: 'm1', amount: 2 }], next: 'die' },
        { kind: 'death', id: 'die', death: 'd1' },
      ]),
      scene('wake', [endNode('e')]),
    ],
    units: [unit('u1')],
    abilities: [ability('hit')],
    battles: [{ id: 'b1', name: L('b1'), enemies: [{ unit: 'u1', row: 'front', index: 0 }] }],
    lives: [life('l1', ['m1'])],
    memories: [memory('m1', 'l1', 2)],
    deaths: [{ id: 'd1', name: L('d1'), wakeScene: 'wake', wakeText: L('w') }],
  });
}

describe('валидатор молчит на здоровом бандле', () => {
  it('ни ошибок, ни предупреждений', () => {
    const issues = validateBundle(healthy());
    expect(messages(issues)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Воспоминание, которое нельзя закрепить
// ─────────────────────────────────────────────────────────────────────────────

describe('осколки против cost', () => {
  it('осколков в игре меньше, чем стоит воспоминание', () => {
    const b = healthy();
    (b.memories[0] as Memory).cost = 5; // а даётся всего 2
    const issues = validateBundle(b);
    expect(has(issues, 'Осколков во всей игре 2, а нужно 5')).toBe(true);
  });

  it('осколков ровно столько, сколько нужно, — молчит', () => {
    const b = healthy();
    (b.memories[0] as Memory).cost = 2;
    expect(has(validateBundle(b), 'Осколков во всей игре')).toBe(false);
  });

  it('осколки собираются из всех источников: сцены, награды боя, гранты жизни', () => {
    const b = healthy();
    (b.memories[0] as Memory).cost = 4;
    (b.battles[0] as BattleDef).rewards = [{ kind: 'fragment', memory: 'm1' }];
    (b.lives[0] as PastLife).grants = [{ kind: 'fragment', memory: 'm1' }];
    expect(has(validateBundle(b), 'Осколков во всей игре')).toBe(false);
  });

  it('воспоминания без единого осколка помечаются отдельным сообщением', () => {
    const b = healthy();
    b.memories.push(memory('m2', 'l1', 1));
    (b.lives[0] as PastLife).memories.push('m2');
    expect(has(validateBundle(b), 'Осколков не даёт ни один эффект')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Бои и смерти, до которых не дойти
// ─────────────────────────────────────────────────────────────────────────────

describe('мёртвый контент: бои и смерти', () => {
  it('бой, на который не ссылается ни один узел battle', () => {
    const b = healthy();
    b.battles.push({ id: 'orphan', name: L('orphan'), enemies: [{ unit: 'u1', row: 'front', index: 0 }] });
    expect(has(validateBundle(b), 'На бой не ссылается ни один узел battle')).toBe(true);
  });

  it('бой, чей узел лежит в недостижимой сцене', () => {
    const b = healthy();
    b.battles.push({ id: 'hidden', name: L('hidden'), enemies: [{ unit: 'u1', row: 'front', index: 0 }] });
    // На сцену ссылается сама себя — «связана», но пути от entry главы нет.
    b.scenes.push(
      scene('island', [
        { kind: 'battle', id: 'f', battle: 'hidden', onWin: 'scene:island', onLose: 'scene:island' },
      ]),
    );
    const issues = validateBundle(b);
    expect(has(issues, 'лежит в недостижимой сцене')).toBe(true);
    expect(has(issues, 'Сцена недостижима от entry ни одной главы')).toBe(true);
  });

  it('смерть, на которую не ведёт ни один узел death, — её wakeScene недостижима', () => {
    const b = healthy();
    b.deaths.push({ id: 'unused', name: L('unused'), wakeScene: 'wake', wakeText: L('w') });
    expect(has(validateBundle(b), 'На смерть не ссылается ни один узел death')).toBe(true);
  });

  it('сцена пробуждения, куда ведёт только недостижимая смерть, ловится как недостижимая', () => {
    const b = healthy();
    b.deaths.push({ id: 'd2', name: L('d2'), wakeScene: 'limbo', wakeText: L('w') });
    b.scenes.push(scene('limbo', [endNode('e')]));
    // Узел death для d2 существует, но лежит в сцене, до которой не дойти.
    b.scenes.push(scene('island', [{ kind: 'death', id: 'x', death: 'd2' }]));
    const issues = validateBundle(b);
    expect(has(issues, 'Узел этой смерти лежит в недостижимой сцене')).toBe(true);
    expect(messages(issues).some((m) => m.includes('scene:limbo'))).toBe(true);
  });

  it('используемые бой и смерть предупреждений не дают', () => {
    const issues = validateBundle(healthy());
    expect(has(issues, 'На бой не ссылается')).toBe(false);
    expect(has(issues, 'На смерть не ссылается')).toBe(false);
    expect(has(issues, 'недостижима')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// available против условия перехода
// ─────────────────────────────────────────────────────────────────────────────

describe('available сцены против условия перехода из хаба', () => {
  /** Хаб с одним вариантом, ведущим в сцену с заданным available. */
  function hub(optionCond: Condition | undefined, available: Condition, effects?: Effect[]): ContentBundle {
    return bundle({
      scenes: [
        scene('start', [
          {
            kind: 'choice',
            id: 'hub',
            options: [
              { id: 'go', text: L('go'), to: 'scene:target', conditions: optionCond, effects },
              { id: 'stay', text: L('stay'), to: 'e', fallback: true },
            ],
          },
          endNode('e'),
        ]),
        scene('target', [endNode('t')], { available }),
      ],
    });
  }

  it('флаг требуется вариантом как false, а сценой — как true', () => {
    const issues = validateBundle(
      hub({ kind: 'flag', flag: 'door', value: false }, { kind: 'flag', flag: 'door', value: true }),
    );
    expect(has(issues, 'противоречит её available')).toBe(true);
    expect(has(issues, 'флаг «door» требуется и true, и false')).toBe(true);
  });

  it('ось: вариант хочет ≤ -50, сцена хочет ≥ 40', () => {
    const issues = validateBundle(
      hub({ kind: 'axis', axis: 'a', op: 'lte', value: -50 }, { kind: 'axis', axis: 'a', op: 'gte', value: 40 }),
    );
    expect(has(issues, 'axis:a не может быть одновременно')).toBe(true);
  });

  it('главы: вариант для первой, сцена — для третьей и дальше', () => {
    const issues = validateBundle(
      hub({ kind: 'chapter', op: 'eq', value: 1 }, { kind: 'chapter', op: 'gte', value: 3 }),
    );
    expect(has(issues, 'chapter не может быть одновременно')).toBe(true);
  });

  it('вариант САМ ставит нужный флаг перед переходом — это не противоречие', () => {
    const issues = validateBundle(
      hub({ kind: 'flag', flag: 'door', value: false }, { kind: 'flag', flag: 'door', value: true }, [
        { kind: 'flag', flag: 'door', value: true },
      ]),
    );
    expect(has(issues, 'противоречит её available')).toBe(false);
  });

  it('вариант двигает ось, о значении которой спорить нельзя, — молчит', () => {
    const issues = validateBundle(
      hub({ kind: 'axis', axis: 'a', op: 'lte', value: -50 }, { kind: 'axis', axis: 'a', op: 'gte', value: 40 }, [
        { kind: 'axis', axis: 'a', delta: 100 },
      ]),
    );
    expect(has(issues, 'не может быть одновременно')).toBe(false);
  });

  it('условия совместимы — молчит', () => {
    const issues = validateBundle(
      hub({ kind: 'axis', axis: 'a', op: 'gte', value: 20 }, { kind: 'axis', axis: 'a', op: 'gte', value: 10 }),
    );
    expect(has(issues, 'противоречит её available')).toBe(false);
  });

  it('условие с any/not не раскладывается — ложных срабатываний нет', () => {
    const issues = validateBundle(
      hub(
        { kind: 'any', of: [{ kind: 'flag', flag: 'door', value: false }, { kind: 'always' }] },
        { kind: 'flag', flag: 'door', value: true },
      ),
    );
    expect(has(issues, 'противоречит её available')).toBe(false);
  });

  it('ветка branch в сцену с несовместимым available тоже ловится', () => {
    const b = bundle({
      scenes: [
        scene('start', [
          {
            kind: 'branch',
            id: 'br',
            branches: [{ when: { kind: 'flag', flag: 'k', value: false }, to: 'scene:target' }],
            fallback: 'e',
          },
          endNode('e'),
        ]),
        scene('target', [endNode('t')], { available: { kind: 'flag', flag: 'k', value: true } }),
      ],
    });
    expect(has(validateBundle(b), 'противоречит её available')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Эффекты-пустышки
// ─────────────────────────────────────────────────────────────────────────────

describe('эффекты, которые ничего не делают', () => {
  it('heal с нулевым или отрицательным amount', () => {
    const b = healthy();
    (b.scenes[0] as Scene).nodes.push({
      kind: 'effects',
      id: 'noop',
      effects: [{ kind: 'heal', amount: -5 }],
      next: 'die',
    });
    expect(has(validateBundle(b), 'heal с amount=-5 ничего не делает')).toBe(true);
  });

  it('fragment с amount 0 не приближает закрепление', () => {
    const b = healthy();
    (b.scenes[0] as Scene).nodes.push({
      kind: 'effects',
      id: 'noop',
      effects: [{ kind: 'fragment', memory: 'm1', amount: 0 }],
      next: 'die',
    });
    expect(has(validateBundle(b), 'не приближает воспоминание к закреплению')).toBe(true);
  });

  it('отрицательный xp отмечается: уровень пересчитается вниз', () => {
    const b = healthy();
    (b.battles[0] as BattleDef).rewards = [{ kind: 'xp', amount: -10 }];
    expect(has(validateBundle(b), 'отнимает опыт')).toBe(true);
  });

  it('положительные amount молчат', () => {
    const b = healthy();
    (b.battles[0] as BattleDef).rewards = [
      { kind: 'xp', amount: 10 },
      { kind: 'heal', amount: 5 },
    ];
    const issues = validateBundle(b);
    expect(has(issues, 'ничего не делает')).toBe(false);
    expect(has(issues, 'отнимает опыт')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Бой, который некому закончить
// ─────────────────────────────────────────────────────────────────────────────

describe('бой без лимита ходов', () => {
  function withHealerEnemy(turnLimit: number | undefined): ContentBundle {
    const b = healthy();
    b.abilities.push(
      ability('mercy', { target: 'ally_one', power: 0, effects: [{ kind: 'heal', power: 0.5 }] }),
    );
    b.units.push(unit('healer', { abilities: ['mercy'] }));
    (b.battles[0] as BattleDef).enemies = [{ unit: 'healer', row: 'front', index: 0 }];
    (b.battles[0] as BattleDef).turnLimit = turnLimit;
    return b;
  }

  it('враги без единой урон-способности и turnLimit 0 — предупреждение', () => {
    expect(has(validateBundle(withHealerEnemy(0)), 'бой может не закончиться никогда')).toBe(true);
  });

  it('те же враги, но с лимитом ходов — молчит', () => {
    expect(has(validateBundle(withHealerEnemy(12)), 'бой может не закончиться никогда')).toBe(false);
  });

  it('turnLimit 0 при враге с обычной атакой — молчит', () => {
    const b = healthy();
    (b.battles[0] as BattleDef).turnLimit = 0;
    expect(has(validateBundle(b), 'бой может не закончиться никогда')).toBe(false);
  });

  it('способность без явных эффектов считается наносящей урон', () => {
    const b = healthy();
    (b.abilities[0] as Ability).power = 0;
    (b.abilities[0] as Ability).effects = undefined;
    (b.battles[0] as BattleDef).turnLimit = 0;
    // power: 0 без effects всё равно бьёт минимум на единицу — бой закончится.
    expect(has(validateBundle(b), 'бой может не закончиться никогда')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Помянник (CODEX §2, §9)
// ─────────────────────────────────────────────────────────────────────────────

describe('Помянник: ссылки записи', () => {
  it('kind person ссылается на несуществующего говорящего — ошибка', () => {
    const b = bundle({ codex: [codexEntry('ghost', 'person')] });
    expect(has(validateBundle(b), 'не найдена среди говорящих')).toBe(true);
  });

  it('kind person на существующего говорящего — молчит', () => {
    const b = bundle({ speakers: [{ id: 'narrator' }, { id: 'osoka' }], codex: [codexEntry('osoka', 'person')] });
    expect(has(validateBundle(b), 'не найдена среди говорящих')).toBe(false);
  });

  it('kind life ссылается на несуществующую жизнь — ошибка', () => {
    const b = bundle({ codex: [codexEntry('ghost_life', 'life')] });
    expect(has(validateBundle(b), 'не найдена среди прошлых жизней')).toBe(true);
  });

  it('kind life на существующую жизнь — молчит', () => {
    const b = bundle({
      lives: [life('smolokur', ['m1'])],
      memories: [memory('m1', 'smolokur', 2)],
      codex: [
        codexEntry('smolokur', 'life', {
          lines: [
            { id: 'smolokur_l1', text: L('строка'), source: 'seen', unlock: { kind: 'memory', memory: 'm1' } },
          ],
        }),
      ],
    });
    expect(has(validateBundle(b), 'не найдена среди прошлых жизней')).toBe(false);
  });
});

describe('Помянник: unlock ссылается на существующее', () => {
  it('meet на несуществующего говорящего — ошибка', () => {
    const b = bundle({
      speakers: [{ id: 'narrator' }, { id: 'osoka' }],
      codex: [codexEntry('osoka', 'person', { lines: [{ id: 'l1', text: L('x'), source: 'seen', unlock: { kind: 'meet', speaker: 'ghost' } }] })],
    });
    expect(has(validateBundle(b), 'несуществующего говорящего «ghost»')).toBe(true);
  });

  it('player_death_with на несуществующего говорящего — ошибка', () => {
    const b = bundle({
      speakers: [{ id: 'narrator' }, { id: 'osoka' }],
      codex: [
        codexEntry('osoka', 'person', {
          lines: [{ id: 'l1', text: L('x'), source: 'after_death', unlock: { kind: 'player_death_with', speaker: 'ghost' } }],
        }),
      ],
    });
    expect(has(validateBundle(b), 'несуществующего говорящего «ghost»')).toBe(true);
  });

  it('node на несуществующую сцену — ошибка', () => {
    const b = bundle({
      speakers: [{ id: 'narrator' }, { id: 'osoka' }],
      codex: [
        codexEntry('osoka', 'person', {
          lines: [{ id: 'l1', text: L('x'), source: 'seen', unlock: { kind: 'node', scene: 'ghost', node: 'n' } }],
        }),
      ],
    });
    expect(has(validateBundle(b), 'несуществующую сцену «ghost»')).toBe(true);
  });

  it('node на существующую сцену, но несуществующий узел — ошибка', () => {
    const b = bundle({
      scenes: [scene('start', [endNode('e')])],
      speakers: [{ id: 'narrator' }, { id: 'osoka' }],
      codex: [
        codexEntry('osoka', 'person', {
          lines: [{ id: 'l1', text: L('x'), source: 'seen', unlock: { kind: 'node', scene: 'start', node: 'ghost' } }],
        }),
      ],
    });
    expect(has(validateBundle(b), 'несуществующий узел «ghost» в сцене «start»')).toBe(true);
  });

  it('node на существующую сцену и узел — молчит', () => {
    const b = bundle({
      scenes: [scene('start', [endNode('e')])],
      speakers: [{ id: 'narrator' }, { id: 'osoka' }],
      codex: [
        codexEntry('osoka', 'person', {
          lines: [{ id: 'l1', text: L('x'), source: 'seen', unlock: { kind: 'node', scene: 'start', node: 'e' } }],
        }),
      ],
    });
    expect(has(validateBundle(b), 'unlock ссылается на несуществующий')).toBe(false);
  });

  it('memory на несуществующее воспоминание — ошибка', () => {
    const b = bundle({
      speakers: [{ id: 'narrator' }, { id: 'osoka' }],
      codex: [
        codexEntry('osoka', 'person', {
          lines: [{ id: 'l1', text: L('x'), source: 'seen', unlock: { kind: 'memory', memory: 'ghost' } }],
        }),
      ],
    });
    expect(has(validateBundle(b), 'несуществующее воспоминание «ghost»')).toBe(true);
  });
});

describe('Помянник: форма записи', () => {
  it('дубликат id строки между двумя разными записями — ошибка', () => {
    const b = bundle({
      speakers: [{ id: 'narrator' }, { id: 'osoka' }, { id: 'tminny' }],
      codex: [
        codexEntry('osoka', 'person', { lines: [{ id: 'dup', text: L('a'), source: 'seen', unlock: { kind: 'meet', speaker: 'osoka' } }] }),
        codexEntry('tminny', 'person', { lines: [{ id: 'dup', text: L('b'), source: 'seen', unlock: { kind: 'meet', speaker: 'tminny' } }] }),
      ],
    });
    expect(has(validateBundle(b), 'Дубликат id строки Помянника: «dup»')).toBe(true);
  });

  it('уникальные id строк — молчит', () => {
    const b = bundle({
      speakers: [{ id: 'narrator' }, { id: 'osoka' }, { id: 'tminny' }],
      codex: [codexEntry('osoka', 'person'), codexEntry('tminny', 'person')],
    });
    expect(has(validateBundle(b), 'Дубликат id строки Помянника')).toBe(false);
  });

  it('больше одной строки с source «last» — ошибка', () => {
    const b = bundle({
      speakers: [{ id: 'narrator' }, { id: 'osoka' }],
      codex: [
        codexEntry('osoka', 'person', {
          lines: [
            { id: 'l1', text: L('a'), source: 'last', unlock: { kind: 'meet', speaker: 'osoka' } },
            { id: 'l2', text: L('b'), source: 'last', unlock: { kind: 'meet', speaker: 'osoka' } },
          ],
        }),
      ],
    });
    expect(has(validateBundle(b), 'строк с source «last» — последняя строка на запись только одна')).toBe(true);
  });

  it('ровно одна строка с source «last» — молчит', () => {
    const b = bundle({
      speakers: [{ id: 'narrator' }, { id: 'osoka' }],
      codex: [
        codexEntry('osoka', 'person', {
          lines: [
            { id: 'l1', text: L('a'), source: 'seen', unlock: { kind: 'meet', speaker: 'osoka' } },
            { id: 'l2', text: L('b'), source: 'last', unlock: { kind: 'meet', speaker: 'osoka' } },
          ],
        }),
      ],
    });
    expect(has(validateBundle(b), 'source «last»')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ранее существовавшие проверки — не сломались ли
// ─────────────────────────────────────────────────────────────────────────────

describe('старые проверки на месте', () => {
  it('битая ссылка на узел — ошибка', () => {
    const b = bundle({ scenes: [scene('start', [narr('a', 'nowhere'), endNode('e')])] });
    expect(has(validateBundle(b), 'Переход в несуществующий узел')).toBe(true);
  });

  it('битая ссылка на сцену — ошибка', () => {
    const b = bundle({ scenes: [scene('start', [narr('a', 'scene:ghost'), endNode('e')])] });
    expect(has(validateBundle(b), 'Нет сцены')).toBe(true);
  });

  it('дубликат id сцены — ошибка', () => {
    const b = bundle({ scenes: [scene('start', [endNode('e')]), scene('start', [endNode('e')])] });
    expect(has(validateBundle(b), 'Дубликат id: start')).toBe(true);
  });

  it('recruit неизвестного юнита — ошибка', () => {
    const b = bundle({
      scenes: [
        scene('start', [
          { kind: 'effects', id: 'a', effects: [{ kind: 'recruit', unit: 'ghost' }], next: 'e' },
          endNode('e'),
        ]),
      ],
    });
    expect(has(validateBundle(b), 'неизвестного юнита «ghost»')).toBe(true);
  });

  it('available, невыполнимое статически', () => {
    const b = bundle({
      scenes: [
        scene('start', [narr('a', 'scene:x'), endNode('e')]),
        scene('x', [endNode('e')], { available: { kind: 'never' } }),
      ],
    });
    expect(has(validateBundle(b), 'available статически невыполнимо')).toBe(true);
  });

  it('узел, недостижимый внутри своей сцены', () => {
    const b = bundle({ scenes: [scene('start', [narr('a', 'e'), endNode('e'), narr('lost', 'e')])] });
    expect(has(validateBundle(b), 'Узел недостижим из entry сцены')).toBe(true);
  });
});

/**
 * Умения игрока, приходящие от воспоминаний. Каркас: ни одного настоящего
 * умения тут нет и быть не должно — только форма и её проверки.
 */
describe('умения от воспоминаний', () => {
  const withPowers = (powers: NonNullable<Memory['powers']>): Memory => ({
    ...memory('m1', 'l1', 1),
    powers,
  });

  const base = (powers: NonNullable<Memory['powers']>, extra: Partial<ContentBundle> = {}) =>
    bundle({
      abilities: [ability('hit'), ability('pw')],
      units: [unit('u', { abilities: ['hit'] })],
      lives: [life('l1', ['m1'])],
      memories: [withPowers(powers)],
      ...extra,
    });

  it('молчит на здоровом: воспоминание даёт умение из реестра', () => {
    const issues = validateBundle(base([{ kind: 'grant', ability: 'pw' }]));
    expect(has(issues, 'Умение «pw» не найдено')).toBe(false);
    expect(has(issues, 'не привязана ни к одному юниту')).toBe(false);
  });

  it('воспоминания без powers валидны — старые файлы править не надо', () => {
    const b = bundle({
      abilities: [ability('hit')],
      units: [unit('u', { abilities: ['hit'] })],
      lives: [life('l1', ['m1'])],
      memories: [memory('m1', 'l1', 1)],
    });
    expect(has(validateBundle(b), 'Умение')).toBe(false);
  });

  it('ловит умение, которого нет в реестре способностей', () => {
    expect(has(validateBundle(base([{ kind: 'grant', ability: 'net_takoy' }])), 'Умение «net_takoy» не найдено')).toBe(
      true,
    );
  });

  it('ловит усиление умения, которого никто не даёт', () => {
    const issues = validateBundle(base([{ kind: 'amplify', ability: 'pw', amplify: { power: 1 } }]));
    expect(has(issues, 'Усиление умения «pw», которого не даёт ни одно воспоминание')).toBe(true);
  });

  it('молчит, когда усиление опирается на выданное умение', () => {
    const issues = validateBundle(
      base([
        { kind: 'grant', ability: 'pw' },
        { kind: 'amplify', ability: 'pw', amplify: { power: 1 } },
      ]),
    );
    expect(has(issues, 'Усиление умения')).toBe(false);
  });

  it('ловит отнимание того, чего никто не давал', () => {
    expect(has(validateBundle(base([{ kind: 'revoke', ability: 'pw' }])), 'отнимать нечего')).toBe(true);
  });

  it('ловит умение вне очереди хода с нулевой перезарядкой', () => {
    const b = base([{ kind: 'grant', ability: 'pw', costsTurn: false }]);
    expect(has(validateBundle(b), 'нужна ≥1')).toBe(true);
  });

  it('молчит, когда у умения вне очереди есть перезарядка', () => {
    const b = bundle({
      abilities: [ability('hit'), ability('pw', { cooldown: 3 })],
      units: [unit('u', { abilities: ['hit'] })],
      lives: [life('l1', ['m1'])],
      memories: [withPowers([{ kind: 'grant', ability: 'pw', costsTurn: false }])],
    });
    expect(has(validateBundle(b), 'нужна ≥1')).toBe(false);
  });

  it('ловит столкновение id умения игрока и способности юнита', () => {
    const b = bundle({
      abilities: [ability('hit')],
      units: [unit('u', { abilities: ['hit'] })],
      lives: [life('l1', ['m1'])],
      memories: [withPowers([{ kind: 'grant', ability: 'hit' }])],
    });
    expect(has(validateBundle(b), 'делят один id')).toBe(true);
  });
});
