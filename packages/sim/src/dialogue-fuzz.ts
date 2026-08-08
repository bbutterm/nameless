/**
 * Фаззер диалогов. Прогоняет сцены сотнями случайных «личностей» и ловит:
 * тупики (<2 вариантов), недостижимые узлы, условия, которые не проходят никогда,
 * сироты-флаги и зацикливания.
 */
import {
  createInitialState,
  indexContent,
  normalizeEntry,
  rawPassingOptions,
  resolve,
  Rng,
  type ContentBundle,
  type GameState,
  type Option,
} from '@nameless/engine';

export interface Personality {
  id: string;
  axes: Record<string, number>;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  visited: string[];
  lockedMemories: string[];
  awakenedLives: string[];
  units: string[];
  deaths: number;
  chapter: number;
}

/** Собирает имена флагов и счётчиков, которые где-либо ставятся или проверяются. */
function collectNames(content: ContentBundle): { flags: string[]; counters: string[] } {
  const flags = new Set<string>();
  const counters = new Set<string>();
  const walkCond = (c: unknown): void => {
    if (!c || typeof c !== 'object') return;
    const o = c as Record<string, unknown>;
    if (o['kind'] === 'flag' && typeof o['flag'] === 'string') flags.add(o['flag']);
    if (o['kind'] === 'counter' && typeof o['counter'] === 'string') counters.add(o['counter']);
    if (Array.isArray(o['of'])) (o['of'] as unknown[]).forEach(walkCond);
    else if (o['of']) walkCond(o['of']);
  };
  const walkEffects = (effects: readonly { kind: string; flag?: string; counter?: string }[]): void => {
    for (const e of effects) {
      if (e.kind === 'flag' && e.flag) flags.add(e.flag);
      if (e.kind === 'counter' && e.counter) counters.add(e.counter);
    }
  };
  for (const s of content.scenes) {
    walkCond(s.available);
    for (const n of s.nodes) {
      if (n.kind === 'choice') {
        for (const opt of n.options) {
          walkCond(opt.conditions);
          walkEffects(opt.effects ?? []);
        }
      }
      if (n.kind === 'branch') n.branches.forEach((b) => walkCond(b.when));
      if (n.kind === 'effects') walkEffects(n.effects);
    }
  }
  return { flags: [...flags].sort(), counters: [...counters].sort() };
}

export function makePersonalities(content: ContentBundle, count: number): Personality[] {
  const { flags: flagNames, counters: counterNames } = collectNames(content);
  const memoryIds = content.memories.map((m) => m.id);
  const lifeIds = content.lives.map((l) => l.id);
  const unitIds = content.units.map((u) => u.id);
  const maxChapter = Math.max(1, ...content.chapters.map((c) => c.index));

  const out: Personality[] = [];
  for (let i = 0; i < count; i++) {
    const rng = new Rng(`persona:${i}`);
    const axes: Record<string, number> = {};
    for (const a of content.axes) {
      // Края важнее середины: именно там диалоги схлопываются.
      const roll = rng.next();
      axes[a.id] =
        roll < 0.2 ? rng.int(-100, -60) : roll > 0.8 ? rng.int(60, 100) : rng.int(-59, 59);
    }
    const flags: Record<string, boolean> = {};
    for (const f of flagNames) if (rng.chance(0.45)) flags[f] = true;
    // Счётчики и посещённые сцены обязаны быть СЛУЧАЙНЫМИ, а не «всё пройдено»:
    // иначе условия вида «сюда ещё не ходил» не проходят ни у кого, и целые
    // ветки хабов выглядят мёртвыми, хотя на самом деле мертва только выборка.
    const counters: Record<string, number> = {};
    for (const c of counterNames) counters[c] = rng.int(0, 4);
    const visited = content.scenes.filter(() => rng.chance(0.4)).map((s) => s.id);
    const lockedMemories = memoryIds.filter(() => rng.chance(0.3));
    const awakenedLives = [
      ...new Set([
        ...lifeIds.filter(() => rng.chance(0.3)),
        ...lockedMemories
          .map((m) => content.memories.find((x) => x.id === m)?.life)
          .filter((x): x is string => !!x),
      ]),
    ];
    out.push({
      id: `p${i}`,
      axes,
      flags,
      counters,
      visited,
      lockedMemories,
      awakenedLives,
      units: unitIds.filter(() => rng.chance(0.25)).slice(0, 6),
      deaths: rng.int(0, 4),
      chapter: rng.int(1, maxChapter),
    });
  }
  return out;
}

function stateFrom(content: ContentBundle, p: Personality, scene: string, node: string): GameState {
  const base = createInitialState({
    seed: p.id,
    axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
    chapter: p.chapter,
    scene,
    node,
    now: 0,
  });
  return {
    ...base,
    axes: { ...base.axes, ...p.axes },
    flags: p.flags,
    counters: p.counters,
    lockedMemories: p.lockedMemories,
    awakenedLives: p.awakenedLives,
    deaths: p.deaths,
    party: p.units.map((u, i) => ({
      uid: `f${i}:${u}`,
      defId: u,
      hp: 10,
      xp: 0,
      level: 1,
      slot: { row: i < 3 ? ('front' as const) : ('back' as const), index: i % 3 },
    })),
    visitedScenes: p.visited,
  };
}

export interface DeadEnd {
  scene: string;
  node: string;
  personality: string;
  passing: number;
}

export interface FuzzReport {
  personalities: number;
  choiceNodes: number;
  deadEnds: DeadEnd[];
  /** Варианты, которые не показались НИ ОДНОЙ личности — мёртвый текст. */
  neverShownOptions: { scene: string; node: string; option: string }[];
  /** Варианты, которые показывались всем — возможно, условие лишнее. */
  alwaysShownConditional: { scene: string; node: string; option: string }[];
  unreachableNodes: { scene: string; node: string }[];
  errors: { scene: string; node: string; message: string }[];
  /** Доля реплик (say/narration), достижимых хоть какой-то личностью. */
  lineCoverage: number;
  totalLines: number;
  reachedLines: number;
}

/**
 * Основная проверка железного правила: при ЛЮБОЙ комбинации статов
 * в узле выбора остаётся ≥2 варианта БЕЗ страховочного механизма движка.
 */
export function fuzzDialogue(content: ContentBundle, personalityCount = 300): FuzzReport {
  const idx = indexContent(content);
  const personalities = makePersonalities(content, personalityCount);

  const deadEnds: DeadEnd[] = [];
  const errors: FuzzReport['errors'] = [];
  const shownCount = new Map<string, number>();
  const optionKeys: { key: string; scene: string; node: string; option: Option }[] = [];
  let choiceNodes = 0;

  for (const scene of content.scenes) {
    for (const node of scene.nodes) {
      if (node.kind !== 'choice') continue;
      choiceNodes++;
      for (const o of node.options) {
        const key = `${scene.id}#${node.id}#${o.id}`;
        shownCount.set(key, 0);
        optionKeys.push({ key, scene: scene.id, node: node.id, option: o });
      }
      for (const p of personalities) {
        const st = stateFrom(content, p, scene.id, node.id);
        const passing = rawPassingOptions(node.options, st);
        for (const o of passing) {
          const key = `${scene.id}#${node.id}#${o.id}`;
          shownCount.set(key, (shownCount.get(key) ?? 0) + 1);
        }
        if (passing.length < 2) {
          deadEnds.push({ scene: scene.id, node: node.id, personality: p.id, passing: passing.length });
        }
      }
    }
  }

  const neverShownOptions = optionKeys
    .filter((o) => (shownCount.get(o.key) ?? 0) === 0)
    .map((o) => ({ scene: o.scene, node: o.node, option: o.option.id }));
  const alwaysShownConditional = optionKeys
    .filter(
      (o) =>
        o.option.conditions !== undefined &&
        !o.option.fallback &&
        (shownCount.get(o.key) ?? 0) === personalities.length,
    )
    .map((o) => ({ scene: o.scene, node: o.node, option: o.option.id }));

  // Проход по игре: случайные личности случайно кликают, собираем достижимость.
  const reached = new Set<string>();
  for (const p of personalities) {
    for (const chapter of content.chapters) {
      const rng = new Rng(`walk:${p.id}:${chapter.id}`);
      let st = normalizeEntry(idx, stateFrom(content, p, chapter.entryScene, '@entry'));
      for (let steps = 0; steps < 400; steps++) {
        const r = resolve(idx, st);
        st = r.state;
        // Берём seenNodes, а не текущий узел: resolve проходит сквозь effects и
        // branch, не останавливаясь на них, и без этого служебные узлы вечно
        // числились бы недостижимыми.
        for (const key of st.seenNodes) reached.add(key);
        if (r.step.kind === 'error') {
          errors.push({ scene: st.scene, node: st.node, message: r.step.message });
          break;
        }
        if (r.step.kind === 'end') break;
        if (r.step.kind === 'bubble') {
          st = { ...st, scene: st.scene, node: st.node };
          const node = r.step.node;
          st = normalizeEntry(idx, { ...st, ...jump(st, node.next) });
          continue;
        }
        if (r.step.kind === 'choice') {
          const pick = rng.pick(r.step.options);
          if (!pick) break;
          st = normalizeEntry(idx, { ...st, ...jump(st, pick.to) });
          continue;
        }
        if (r.step.kind === 'battle') {
          // Симулируем исход броском: путь поражения тоже должен быть проходим.
          const to = rng.chance(0.75) ? r.step.node.onWin : r.step.node.onLose;
          st = normalizeEntry(idx, { ...st, ...jump(st, to) });
          continue;
        }
        if (r.step.kind === 'death') {
          const deathId = r.step.node.death;
          const death = content.deaths.find((d) => d.id === deathId);
          if (!death) {
            errors.push({ scene: st.scene, node: st.node, message: `Нет смерти ${deathId}` });
            break;
          }
          st = normalizeEntry(idx, { ...st, scene: death.wakeScene, node: '@entry', deaths: st.deaths + 1 });
          continue;
        }
      }
    }
  }

  const lineNodes: string[] = [];
  for (const s of content.scenes) {
    for (const n of s.nodes) {
      if (n.kind === 'say' || n.kind === 'narration') lineNodes.push(`${s.id}#${n.id}`);
    }
  }
  const reachedLines = lineNodes.filter((k) => reached.has(k)).length;

  const unreachableNodes = content.scenes.flatMap((s) =>
    s.nodes.filter((n) => !reached.has(`${s.id}#${n.id}`)).map((n) => ({ scene: s.id, node: n.id })),
  );

  return {
    personalities: personalities.length,
    choiceNodes,
    deadEnds,
    neverShownOptions,
    alwaysShownConditional,
    unreachableNodes,
    errors,
    lineCoverage: lineNodes.length === 0 ? 1 : reachedLines / lineNodes.length,
    totalLines: lineNodes.length,
    reachedLines,
  };
}

function jump(st: GameState, to: string): { scene: string; node: string } {
  if (to.startsWith('scene:')) {
    const rest = to.slice(6);
    const hash = rest.indexOf('#');
    if (hash === -1) return { scene: rest, node: '@entry' };
    return { scene: rest.slice(0, hash), node: rest.slice(hash + 1) };
  }
  return { scene: st.scene, node: to };
}
