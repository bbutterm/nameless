import { describe, expect, it } from 'vitest';
import {
  advance,
  choose,
  filterOptions,
  indexContent,
  parseRef,
  rawPassingOptions,
  resolve,
  normalizeEntry,
  MAX_OPTIONS,
  MIN_OPTIONS,
  LOG_LIMIT,
  pushBubble,
} from './dialogue.js';
import { createInitialState, type GameState } from './state.js';
import type { ContentBundle, Option, Scene } from './types.js';

const t = (ru: string) => ({ ru, en: ru });

function bundle(scenes: Scene[]): ContentBundle {
  return {
    axes: [{ id: 'mercy_cruelty', positive: t('М'), negative: t('Ж'), extreme: 60, start: 0 }],
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
}

function st(scene: string, node: string, patch: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    seed: 'dlg',
    axes: [{ id: 'mercy_cruelty', start: 0 }],
    chapter: 1,
    scene,
    node,
    now: 0,
  });
  return { ...base, ...patch };
}

const opt = (id: string, p: Partial<Option> = {}): Option => ({
  id,
  text: t(id),
  to: 'end',
  ...p,
});

describe('parseRef', () => {
  it('локальный узел остаётся в текущей сцене', () => {
    expect(parseRef('node2', 'chulan')).toEqual({ scene: 'chulan', node: 'node2' });
  });
  it('scene:id без узла', () => {
    expect(parseRef('scene:prilavok', 'chulan')).toEqual({ scene: 'prilavok' });
  });
  it('scene:id#node', () => {
    expect(parseRef('scene:prilavok#ochered', 'chulan')).toEqual({
      scene: 'prilavok',
      node: 'ochered',
    });
  });
});

describe('filterOptions — железное правило ≥2', () => {
  it('пропускает подходящие варианты', () => {
    const options = [opt('a'), opt('b', { conditions: { kind: 'never' } }), opt('c')];
    expect(filterOptions(options, st('s', 'n')).map((o) => o.id)).toEqual(['a', 'c']);
  });

  it('добирает страховочными, когда не прошло ничего', () => {
    const options = [
      opt('a', { conditions: { kind: 'never' }, fallback: true }),
      opt('b', { conditions: { kind: 'never' }, fallback: true }),
      opt('c', { conditions: { kind: 'never' } }),
    ];
    const out = filterOptions(options, st('s', 'n'));
    expect(out).toHaveLength(MIN_OPTIONS);
    expect(out.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('в крайнем случае добирает по priority, но всё равно даёт два', () => {
    const options = [
      opt('a', { conditions: { kind: 'never' }, priority: 1 }),
      opt('b', { conditions: { kind: 'never' }, priority: 5 }),
      opt('c', { conditions: { kind: 'never' }, priority: 3 }),
    ];
    const out = filterOptions(options, st('s', 'n'));
    expect(out).toHaveLength(MIN_OPTIONS);
    expect(out.map((o) => o.id).sort()).toEqual(['b', 'c']);
  });

  it('никогда не оставляет игрока с одной кнопкой', () => {
    const options = [opt('a', { conditions: { kind: 'never' } }), opt('b', { conditions: { kind: 'never' } })];
    expect(filterOptions(options, st('s', 'n')).length).toBeGreaterThanOrEqual(MIN_OPTIONS);
  });

  it('режет до четырёх по priority, сохраняя порядок объявления', () => {
    const options = [
      opt('o1', { priority: 1 }),
      opt('o2', { priority: 6 }),
      opt('o3', { priority: 2 }),
      opt('o4', { priority: 5 }),
      opt('o5', { priority: 3 }),
      opt('o6', { priority: 4 }),
    ];
    const out = filterOptions(options, st('s', 'n'));
    expect(out).toHaveLength(MAX_OPTIONS);
    expect(out.map((o) => o.id)).toEqual(['o2', 'o4', 'o5', 'o6']);
  });

  it('rawPassingOptions не спасает — он для фаззера', () => {
    const options = [opt('a', { conditions: { kind: 'never' }, fallback: true })];
    expect(rawPassingOptions(options, st('s', 'n'))).toHaveLength(0);
  });

  it('условия читают настоящее состояние', () => {
    const options = [
      opt('cruel', { conditions: { kind: 'axis', axis: 'mercy_cruelty', op: 'lte', value: -40 } }),
      opt('plain'),
      opt('kind', { conditions: { kind: 'axis', axis: 'mercy_cruelty', op: 'gte', value: 40 } }),
    ];
    const s = st('s', 'n', { axes: { mercy_cruelty: -60 } });
    expect(filterOptions(options, s).map((o) => o.id)).toEqual(['cruel', 'plain']);
  });
});

describe('resolve', () => {
  const scenes: Scene[] = [
    {
      id: 'hall',
      chapter: 1,
      title: t('Зал'),
      entry: 'fx',
      nodes: [
        { kind: 'effects', id: 'fx', effects: [{ kind: 'axis', axis: 'mercy_cruelty', delta: 8 }], next: 'fork' },
        {
          kind: 'branch',
          id: 'fork',
          branches: [{ when: { kind: 'axis', axis: 'mercy_cruelty', op: 'gte', value: 5 }, to: 'kind' }],
          fallback: 'cold',
        },
        { kind: 'narration', id: 'kind', text: t('Вы придержали дверь.'), next: 'stop' },
        { kind: 'narration', id: 'cold', text: t('Дверь закрылась сама.'), next: 'stop' },
        { kind: 'end', id: 'stop' },
        {
          kind: 'choice',
          id: 'ask',
          options: [
            opt('leave', { to: 'scene:yard', effects: [{ kind: 'flag', flag: 'ushel', value: true }] }),
            opt('stay', { to: 'stop' }),
          ],
        },
      ],
    },
    {
      id: 'yard',
      chapter: 1,
      title: t('Двор'),
      entry: 'y1',
      nodes: [{ kind: 'narration', id: 'y1', text: t('Труха под ногами.'), next: 'y2' }, { kind: 'end', id: 'y2' }],
    },
    {
      id: 'loop',
      chapter: 1,
      title: t('Петля'),
      entry: 'l',
      nodes: [{ kind: 'effects', id: 'l', effects: [{ kind: 'counter', counter: 'c', delta: 1 }], next: 'l' }],
    },
    {
      id: 'brk',
      chapter: 1,
      title: t('Обрыв'),
      entry: 'b',
      nodes: [{ kind: 'effects', id: 'b', effects: [{ kind: 'counter', counter: 'c', delta: 1 }], next: 'nowhere' }],
    },
    {
      id: 'jump',
      chapter: 1,
      title: t('Прыжок'),
      entry: 'j',
      nodes: [{ kind: 'effects', id: 'j', effects: [{ kind: 'gold', delta: 3 }], next: 'scene:yard' }],
    },
  ];
  const idx = indexContent(bundle(scenes));

  it('проходит сквозь effects и branch до пузыря', () => {
    const r = resolve(idx, st('hall', 'fx'));
    expect(r.step.kind).toBe('bubble');
    expect(r.state.axes['mercy_cruelty']).toBe(8);
    if (r.step.kind === 'bubble') expect(r.step.node.id).toBe('kind');
  });

  it('branch уходит в fallback, когда не сошлось', () => {
    const r = resolve(idx, st('hall', 'fork'));
    expect(r.step.kind).toBe('bubble');
    if (r.step.kind === 'bubble') expect(r.step.node.id).toBe('cold');
  });

  it('отмечает посещённые сцены и узлы', () => {
    const r = resolve(idx, st('hall', 'fx'));
    expect(r.state.visitedScenes).toContain('hall');
    expect(r.state.seenNodes).toContain('hall#fx');
  });

  it('на choice возвращает отфильтрованные варианты', () => {
    const r = resolve(idx, st('hall', 'ask'));
    expect(r.step.kind).toBe('choice');
    if (r.step.kind === 'choice') expect(r.step.options).toHaveLength(2);
  });

  it('end — это шаг end, а не ошибка', () => {
    expect(resolve(idx, st('hall', 'stop')).step.kind).toBe('end');
  });

  it('обрывает зацикливание, а не висит', () => {
    const r = resolve(idx, st('loop', 'l'));
    expect(r.step.kind).toBe('error');
    if (r.step.kind === 'error') expect(r.step.message).toMatch(/Зацикливание/);
  });

  it('ошибка на битой ссылке', () => {
    const r = resolve(idx, st('brk', 'b'));
    expect(r.step.kind).toBe('error');
    if (r.step.kind === 'error') expect(r.step.message).toMatch(/Нет узла brk#nowhere/);
  });

  it('переход scene:id разворачивается в entry сцены', () => {
    const r = resolve(idx, st('jump', 'j'));
    expect(r.state.scene).toBe('yard');
    expect(r.state.node).toBe('y1');
    expect(r.state.gold).toBe(3);
  });

  it('ошибка на несуществующем стартовом узле', () => {
    const r = resolve(idx, st('hall', 'net_takogo'));
    expect(r.step.kind).toBe('error');
  });

  it('@entry подставляет entry сцены', () => {
    const r = resolve(idx, st('yard', '@entry'));
    expect(r.state.node).toBe('y1');
  });
});

describe('advance и choose', () => {
  const scenes: Scene[] = [
    {
      id: 'hall',
      chapter: 1,
      title: t('Зал'),
      entry: 'n1',
      nodes: [
        { kind: 'narration', id: 'n1', text: t('Пахнет серебром.'), next: 'pick' },
        {
          kind: 'choice',
          id: 'pick',
          options: [
            opt('pay', {
              to: 'scene:yard',
              effects: [
                { kind: 'gold', delta: -4 },
                { kind: 'axis', axis: 'mercy_cruelty', delta: 8 },
              ],
            }),
            opt('walk', { to: 'n1' }),
          ],
        },
      ],
    },
    {
      id: 'yard',
      chapter: 1,
      title: t('Двор'),
      entry: 'y1',
      nodes: [{ kind: 'end', id: 'y1' }],
    },
  ];
  const idx = indexContent(bundle(scenes));

  it('advance идёт по next пузыря', () => {
    expect(advance(idx, st('hall', 'n1')).node).toBe('pick');
  });

  it('advance на не-пузыре ничего не меняет', () => {
    const s = st('hall', 'pick');
    expect(advance(idx, s)).toEqual(s);
  });

  it('choose применяет эффекты, пишет лог и переходит', () => {
    const s = choose(idx, st('hall', 'pick', { gold: 10 }), 'pay');
    expect(s.gold).toBe(6);
    expect(s.axes['mercy_cruelty']).toBe(8);
    expect(s.scene).toBe('yard');
    expect(s.node).toBe('y1');
    expect(s.log.at(-1)?.chosenOptionId).toBe('pay');
  });

  it('choose с неизвестным вариантом — no-op', () => {
    const s = st('hall', 'pick');
    expect(choose(idx, s, 'net')).toEqual(s);
  });
});

describe('синхронизация главы', () => {
  it('номер главы берётся из сцены при переходе', () => {
    const idx = indexContent(
      bundle([
        { id: 's1', chapter: 1, title: t('а'), entry: 'n1', nodes: [{ kind: 'end', id: 'n1' }] },
        { id: 's2', chapter: 2, title: t('б'), entry: 'n1', nodes: [{ kind: 'end', id: 'n1' }] },
      ]),
    );
    expect(normalizeEntry(idx, st('s2', '@entry', { chapter: 1 })).chapter).toBe(2);
    // Уже развёрнутый узел тоже подтягивает главу: игрок мог войти по прямой ссылке.
    expect(normalizeEntry(idx, st('s2', 'n1', { chapter: 1 })).chapter).toBe(2);
  });
});

describe('лента не растёт без предела', () => {
  it('после LOG_LIMIT записей хранятся только последние', () => {
    // Кольцо из трёх реплик: pushBubble глушит только подряд идущий повтор
    // одного узла, поэтому цикл длиной три даёт бесконечную ленту.
    const content = bundle([
      {
        id: 'ring',
        chapter: 1,
        title: t('кольцо'),
        entry: 'a',
        nodes: [
          { kind: 'narration', id: 'a', text: t('раз'), next: 'b' },
          { kind: 'narration', id: 'b', text: t('два'), next: 'c' },
          { kind: 'narration', id: 'c', text: t('три'), next: 'a' },
        ],
      } as Scene,
    ]);
    const idx = indexContent(content);
    let st = createInitialState({
      seed: 'log',
      axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
      chapter: 1,
      scene: 'ring',
      node: '@entry',
      now: 0,
    });
    st = normalizeEntry(idx, st);

    // Гоняем заведомо дольше предела: без обрезки лента росла до 1206 записей
    // (около 190 КБ в сейве), упиралась в квоту localStorage, а исключение
    // глоталось молча — игрок терял час игры, не увидев ни слова на экране.
    for (let i = 0; i < LOG_LIMIT * 3; i++) {
      const r = resolve(idx, st);
      // Ленту наполняет клиент: resolve только сообщает, что показать.
      st = r.step.kind === 'bubble' ? pushBubble(r.state, r.step.node) : r.state;
      if (r.step.kind !== 'bubble') break;
      st = advance(idx, st);
    }
    expect(st.log.length).toBe(LOG_LIMIT);
    // Обрезается начало, а не конец: игрок должен видеть последнее.
    expect(st.log[st.log.length - 1]?.ru).toBe('три');
  });
});
