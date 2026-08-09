import { describe, expect, it } from 'vitest';
import {
  indexCodex,
  linesForEvent,
  noteCodexEvent,
  pushCodexPending,
  speakersAtDeath,
} from './codex.js';
import { indexContent, resolve } from './dialogue.js';
import { applyDeath } from './progression.js';
import { createInitialState, type GameState } from './state.js';
import type { CodexEntry, ContentBundle, DeathDef, Scene } from './types.js';

const t = (ru: string) => ({ ru, en: ru });

function entry(id: string, lines: CodexEntry['lines']): CodexEntry {
  return {
    id,
    kind: 'person',
    name: t(id),
    blurb: t('подпись'),
    signs: t('приметы'),
    lines,
  };
}

function bundle(patch: Partial<ContentBundle> = {}): ContentBundle {
  return {
    axes: [{ id: 'mercy_cruelty', positive: t('М'), negative: t('Ж'), extreme: 60, start: 0 }],
    scenes: [],
    units: [],
    abilities: [],
    battles: [],
    lives: [],
    memories: [],
    deaths: [],
    chapters: [],
    speakers: [],
    codex: [],
    ...patch,
  };
}

function st(patch: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    seed: 'codex',
    axes: [{ id: 'mercy_cruelty', start: 0 }],
    chapter: 1,
    scene: 'shcherb',
    node: 'n1',
    now: 0,
  });
  return { ...base, ...patch };
}

const codex: CodexEntry[] = [
  entry('osoka', [
    { id: 'osoka_l1', text: t('встреча'), source: 'seen', unlock: { kind: 'meet', speaker: 'osoka' } },
    {
      id: 'osoka_l2',
      text: t('узел'),
      source: 'seen',
      unlock: { kind: 'node', scene: 'shcherb', node: 'n2' },
    },
    {
      id: 'osoka_l3',
      text: t('после твоей смерти'),
      source: 'after_death',
      unlock: { kind: 'player_death_with', speaker: 'osoka' },
    },
  ]),
  entry('tminny', [
    { id: 'tminny_l1', text: t('флаг'), source: 'heard', unlock: { kind: 'flag', flag: 'dogovor' } },
    {
      id: 'tminny_l2',
      text: t('воспоминание'),
      source: 'seen',
      unlock: { kind: 'memory', memory: 'ples_gorit' },
    },
  ]),
];

describe('indexCodex', () => {
  it('раскладывает строки по видам условий', () => {
    const idx = indexCodex({ codex });
    expect(idx.byLineId.size).toBe(5);
    expect(idx.entryOfLine.get('tminny_l1')?.id).toBe('tminny');
    expect(linesForEvent(idx, { kind: 'meet', speaker: 'osoka' })).toEqual(['osoka_l1']);
    expect(linesForEvent(idx, { kind: 'node', scene: 'shcherb', node: 'n2' })).toEqual(['osoka_l2']);
    expect(linesForEvent(idx, { kind: 'memory', memory: 'ples_gorit' })).toEqual(['tminny_l2']);
  });

  it('событие без строк не выдумывает их', () => {
    const idx = indexCodex({ codex });
    expect(linesForEvent(idx, { kind: 'meet', speaker: 'никого' })).toEqual([]);
    expect(linesForEvent(idx, { kind: 'flags', flags: { dogovor: false } })).toEqual([]);
  });

  it('флаги открывают строки только поднятые', () => {
    const idx = indexCodex({ codex });
    expect(linesForEvent(idx, { kind: 'flags', flags: { dogovor: true, прочее: true } })).toEqual([
      'tminny_l1',
    ]);
  });
});

describe('очередь забега', () => {
  it('одна и та же строка не встаёт в очередь дважды', () => {
    const idx = indexCodex({ codex });
    let s = noteCodexEvent(st(), idx, { kind: 'meet', speaker: 'osoka' });
    s = noteCodexEvent(s, idx, { kind: 'meet', speaker: 'osoka' });
    expect(s.codexPending).toEqual(['osoka_l1']);
  });

  it('пустое добавление возвращает то же состояние', () => {
    const s = st();
    expect(pushCodexPending(s, [])).toBe(s);
    expect(pushCodexPending(s, ['osoka_l1'])).not.toBe(s);
  });
});

describe('свидетели последней сцены', () => {
  it('рассказчик и сам игрок свидетелями не считаются', () => {
    const s = st({
      log: [
        { nodeId: 'n1', scene: 'shcherb', kind: 'narration', speaker: 'narrator', ru: '', en: '' },
        { nodeId: 'n2', scene: 'shcherb', kind: 'say', speaker: 'osoka', ru: '', en: '' },
        { nodeId: 'n3', scene: 'shcherb', kind: 'say', speaker: 'player', ru: '', en: '' },
        { nodeId: 'n4', scene: 'shcherb', kind: 'say', speaker: 'osoka', ru: '', en: '' },
      ],
    });
    expect(speakersAtDeath(s)).toEqual(['osoka']);
  });
});

describe('движок сам отмечает прожитое', () => {
  const scene: Scene = {
    id: 'shcherb',
    chapter: 1,
    title: t('Щербь'),
    entry: 'n1',
    nodes: [
      { kind: 'say', id: 'n1', speaker: 'osoka', text: t('раз'), next: 'n2' },
      { kind: 'narration', id: 'n2', text: t('два'), next: 'n3' },
      { kind: 'end', id: 'n3' },
    ],
  };

  it('показанный узел и первая встреча кладут строки в очередь', () => {
    const idx = indexContent(bundle({ scenes: [scene], codex }));
    const first = resolve(idx, st());
    expect(first.state.codexPending).toEqual(['osoka_l1']);
    const second = resolve(idx, { ...first.state, node: 'n2' });
    expect(second.state.codexPending).toEqual(['osoka_l1', 'osoka_l2']);
  });

  it('смерть отдаёт и строку свидетеля, и строку закреплённого воспоминания', () => {
    const content = bundle({
      codex,
      memories: [
        {
          id: 'ples_gorit',
          life: 'smolokur',
          name: t('Плёс горит'),
          revelation: t('горел'),
          icon: 'fire',
          cost: 1,
          grants: [],
        },
      ],
      lives: [
        {
          id: 'smolokur',
          name: t('Смолокур'),
          flavor: t('вкус'),
          icon: 'fire',
          axis: 'mercy_cruelty',
          pole: 'negative',
          memories: ['ples_gorit'],
          grants: [],
        },
      ],
    });
    const death: DeathDef = {
      id: 'drowned',
      name: t('Утонул'),
      wakeScene: 'chulan',
      wakeText: t('Чулан. Сутки спустя.'),
    };
    const before = st({
      fragments: { ples_gorit: 3 },
      log: [{ nodeId: 'n1', scene: 'shcherb', kind: 'say', speaker: 'osoka', ru: '', en: '' }],
    });
    const out = applyDeath(before, content, death);
    expect(out.memory?.id).toBe('ples_gorit');
    expect(out.state.codexPending).toEqual(['osoka_l3', 'tminny_l2']);
    // Лента очищена смертью, но свидетеля успели посчитать до этого.
    expect(out.state.log).toEqual([]);
  });
});
