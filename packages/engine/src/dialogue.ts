import type { ContentBundle, Option, Scene, SceneNode } from './types.js';
import { evalCondition } from './conditions.js';
import { applyEffects, markVisited, type EffectContext, type GameState } from './state.js';

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;

export interface SceneRef {
  scene: string;
  node?: string;
}

/** Разбирает ссылку перехода: "node", "scene:id", "scene:id#node". */
export function parseRef(to: string, currentScene: string): SceneRef {
  if (to.startsWith('scene:')) {
    const rest = to.slice('scene:'.length);
    const hash = rest.indexOf('#');
    if (hash === -1) return { scene: rest };
    return { scene: rest.slice(0, hash), node: rest.slice(hash + 1) };
  }
  return { scene: currentScene, node: to };
}

export interface ContentIndex {
  scenes: Map<string, Scene>;
  nodes: Map<string, SceneNode>; // ключ "sceneId#nodeId"
  bundle: ContentBundle;
  effectCtx: EffectContext;
}

export function indexContent(bundle: ContentBundle): ContentIndex {
  const scenes = new Map<string, Scene>();
  const nodes = new Map<string, SceneNode>();
  for (const s of bundle.scenes) {
    scenes.set(s.id, s);
    for (const n of s.nodes) nodes.set(`${s.id}#${n.id}`, n);
  }
  const unitById = new Map(bundle.units.map((u) => [u.id, u]));
  return {
    scenes,
    nodes,
    bundle,
    effectCtx: {
      unitStats: (id) => {
        const u = unitById.get(id);
        return u ? { hp: u.stats.hp, row: u.row } : undefined;
      },
    },
  };
}

export type Step =
  | { kind: 'bubble'; node: Extract<SceneNode, { kind: 'say' | 'narration' | 'lore' }> }
  | { kind: 'choice'; node: Extract<SceneNode, { kind: 'choice' }>; options: Option[] }
  | { kind: 'battle'; node: Extract<SceneNode, { kind: 'battle' }> }
  | { kind: 'death'; node: Extract<SceneNode, { kind: 'death' }> }
  | { kind: 'end' }
  | { kind: 'error'; message: string };

export interface Resolved {
  state: GameState;
  step: Step;
}

const MAX_AUTO_STEPS = 256;

/**
 * Приводит состояние к ближайшему «показываемому» узлу, по пути применяя
 * эффекты и развилки. Циклы обрываются на MAX_AUTO_STEPS — это баг контента,
 * и фаззер должен его увидеть, а не зависнуть.
 */
export function resolve(idx: ContentIndex, state: GameState): Resolved {
  let s = state;
  for (let i = 0; i < MAX_AUTO_STEPS; i++) {
    const key = `${s.scene}#${s.node}`;
    const node = idx.nodes.get(key);
    if (!node) return { state: s, step: { kind: 'error', message: `Нет узла ${key}` } };
    s = markVisited(s, s.scene, s.node);

    switch (node.kind) {
      case 'say':
      case 'narration':
      case 'lore':
        return { state: s, step: { kind: 'bubble', node } };
      case 'choice': {
        const options = filterOptions(node.options, s);
        return { state: s, step: { kind: 'choice', node, options } };
      }
      case 'battle':
        return { state: s, step: { kind: 'battle', node } };
      case 'death':
        return { state: s, step: { kind: 'death', node } };
      case 'end':
        return { state: s, step: { kind: 'end' } };
      case 'effects': {
        s = applyEffects(s, node.effects, idx.effectCtx);
        s = goTo(s, node.next);
        break;
      }
      case 'branch': {
        const hit = node.branches.find((b) => evalCondition(b.when, s));
        s = goTo(s, hit ? hit.to : node.fallback);
        break;
      }
      default: {
        const _exhaustive: never = node;
        void _exhaustive;
        return { state: s, step: { kind: 'error', message: 'Неизвестный тип узла' } };
      }
    }
  }
  return {
    state: s,
    step: { kind: 'error', message: `Зацикливание в сцене ${s.scene} (узел ${s.node})` },
  };
}

export function goTo(state: GameState, to: string): GameState {
  const ref = parseRef(to, state.scene);
  return { ...state, scene: ref.scene, node: ref.node ?? '@entry' };
}

/** Переход по 'scene:id' без указания узла — подставляет entry сцены. */
export function normalizeEntry(idx: ContentIndex, state: GameState): GameState {
  if (state.node !== '@entry') return state;
  const scene = idx.scenes.get(state.scene);
  if (!scene) return state;
  return { ...state, node: scene.entry };
}

/**
 * ЖЕЛЕЗНОЕ ПРАВИЛО: после фильтрации остаётся ≥2 варианта при любой личности.
 * Порядок спасения: подходящие → страховочные (fallback) → добор по priority.
 * Последний шаг — аварийный: фаззер помечает такие узлы как нарушение,
 * но игрок в тупике не остаётся никогда.
 */
export function filterOptions(options: Option[], state: GameState): Option[] {
  const passing = options.filter((o) => evalCondition(o.conditions, state));
  const chosen: Option[] = [...passing];

  if (chosen.length < MIN_OPTIONS) {
    for (const o of options) {
      if (chosen.includes(o)) continue;
      if (o.fallback) chosen.push(o);
      if (chosen.length >= MIN_OPTIONS) break;
    }
  }
  if (chosen.length < MIN_OPTIONS) {
    const rest = options
      .filter((o) => !chosen.includes(o))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const o of rest) {
      chosen.push(o);
      if (chosen.length >= MIN_OPTIONS) break;
    }
  }

  if (chosen.length <= MAX_OPTIONS) return chosen;
  return chosen
    .slice()
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, MAX_OPTIONS)
    .sort((a, b) => options.indexOf(a) - options.indexOf(b));
}

/** Проверка без страховок — нужна фаззеру, чтобы поймать настоящие тупики. */
export function rawPassingOptions(options: Option[], state: GameState): Option[] {
  return options.filter((o) => evalCondition(o.conditions, state));
}

/** Игрок тапнул по пузырю — идём дальше. */
export function advance(idx: ContentIndex, state: GameState): GameState {
  const node = idx.nodes.get(`${state.scene}#${state.node}`);
  if (!node) return state;
  if (node.kind === 'say' || node.kind === 'narration' || node.kind === 'lore') {
    return normalizeEntry(idx, goTo(state, node.next));
  }
  return state;
}

/** Игрок выбрал вариант. */
export function choose(idx: ContentIndex, state: GameState, optionId: string): GameState {
  const node = idx.nodes.get(`${state.scene}#${state.node}`);
  if (!node || node.kind !== 'choice') return state;
  const available = filterOptions(node.options, state);
  const option = available.find((o) => o.id === optionId);
  if (!option) return state;
  let s = applyEffects(state, option.effects, idx.effectCtx);
  s = {
    ...s,
    log: [
      ...s.log,
      {
        nodeId: node.id,
        scene: s.scene,
        kind: 'choice-made',
        ru: option.text.ru,
        en: option.text.en,
        chosenOptionId: option.id,
      },
    ],
  };
  return normalizeEntry(idx, goTo(s, option.to));
}

/** Записывает показанный пузырь в ленту (для скролла вверх и реплеев). */
export function pushBubble(
  state: GameState,
  node: Extract<SceneNode, { kind: 'say' | 'narration' | 'lore' }>,
): GameState {
  const last = state.log[state.log.length - 1];
  if (last && last.nodeId === node.id && last.scene === state.scene) return state;
  const ru = node.kind === 'lore' ? node.text.ru : node.text.ru;
  const en = node.kind === 'lore' ? node.text.en : node.text.en;
  return {
    ...state,
    log: [
      ...state.log,
      {
        nodeId: node.id,
        scene: state.scene,
        kind: node.kind,
        speaker: node.kind === 'say' ? node.speaker : undefined,
        ru,
        en,
      },
    ],
  };
}
