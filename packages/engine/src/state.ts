import type {
  AxisId,
  CounterId,
  Effect,
  FlagId,
  LifeId,
  MemoryId,
  PartyUnit,
  SceneId,
  UnitId,
} from './types.js';
import type { RngState } from './rng.js';

/** Версия схемы сейва. Растёт при любом несовместимом изменении GameState. */
export const SAVE_VERSION = 1;

export interface GameState {
  version: number;
  /** Сид прохождения — вся случайность выводится из него. */
  seed: string;
  rng: RngState;

  /** Скрытые оси личности. Игроку не показываются НИКОГДА. */
  axes: Record<AxisId, number>;
  flags: Record<FlagId, boolean>;
  counters: Record<CounterId, number>;

  /** Накопленные осколки по каждому воспоминанию. */
  fragments: Record<MemoryId, number>;
  /** Воспоминания, закреплённые смертью — навсегда. */
  lockedMemories: MemoryId[];
  /** Пробуждённые прошлые жизни. */
  awakenedLives: LifeId[];

  party: PartyUnit[];
  gold: number;

  chapter: number;
  scene: SceneId;
  node: string;
  visitedScenes: SceneId[];
  /** Узлы, которые игрок уже читал — для метрик достижимости. */
  seenNodes: string[];
  deaths: number;

  /** Лента текущей сцены: что уже показано (для скролла вверх). */
  log: LogEntry[];
  startedAt: number;
  updatedAt: number;
}

export interface LogEntry {
  nodeId: string;
  scene: SceneId;
  kind: 'say' | 'narration' | 'lore' | 'choice-made' | 'system';
  speaker?: string;
  /** Уже локализованный на момент показа? Нет — храним оба, язык может меняться. */
  ru: string;
  en: string;
  chosenOptionId?: string;
}

export const AXIS_MIN = -100;
export const AXIS_MAX = 100;

export function clampAxis(v: number): number {
  return Math.max(AXIS_MIN, Math.min(AXIS_MAX, Math.round(v)));
}

export function createInitialState(params: {
  seed: string;
  axes: { id: AxisId; start: number }[];
  chapter: number;
  scene: SceneId;
  node: string;
  now: number;
}): GameState {
  const axes: Record<AxisId, number> = {};
  for (const a of params.axes) axes[a.id] = clampAxis(a.start);
  return {
    version: SAVE_VERSION,
    seed: params.seed,
    rng: { seed: 0, calls: 0 },
    axes,
    flags: {},
    counters: {},
    fragments: {},
    lockedMemories: [],
    awakenedLives: [],
    party: [],
    gold: 0,
    chapter: params.chapter,
    scene: params.scene,
    node: params.node,
    visitedScenes: [],
    seenNodes: [],
    deaths: 0,
    log: [],
    startedAt: params.now,
    updatedAt: params.now,
  };
}

/** Все мутации состояния — только здесь. Возвращает новый объект. */
export function applyEffect(state: GameState, effect: Effect, ctx?: EffectContext): GameState {
  switch (effect.kind) {
    case 'axis': {
      const cur = state.axes[effect.axis] ?? 0;
      return { ...state, axes: { ...state.axes, [effect.axis]: clampAxis(cur + effect.delta) } };
    }
    case 'flag':
      return { ...state, flags: { ...state.flags, [effect.flag]: effect.value } };
    case 'counter': {
      const cur = state.counters[effect.counter] ?? 0;
      return { ...state, counters: { ...state.counters, [effect.counter]: cur + effect.delta } };
    }
    case 'fragment': {
      const cur = state.fragments[effect.memory] ?? 0;
      return {
        ...state,
        fragments: { ...state.fragments, [effect.memory]: cur + (effect.amount ?? 1) },
      };
    }
    case 'awakenLife':
      if (state.awakenedLives.includes(effect.life)) return state;
      return { ...state, awakenedLives: [...state.awakenedLives, effect.life] };
    case 'recruit': {
      const uid = `${effect.unit}#${state.party.length}-${state.counters['_recruits'] ?? 0}`;
      const def = ctx?.unitStats?.(effect.unit);
      const slot = nextFreeSlot(state.party, def?.row ?? 'front');
      if (!slot) return state;
      const unit: PartyUnit = {
        uid,
        defId: effect.unit,
        hp: def?.hp ?? 10,
        xp: 0,
        level: 1,
        slot,
      };
      return {
        ...state,
        party: [...state.party, unit],
        counters: { ...state.counters, _recruits: (state.counters['_recruits'] ?? 0) + 1 },
      };
    }
    case 'dismiss':
      return { ...state, party: state.party.filter((u) => u.defId !== effect.unit) };
    case 'heal':
      return {
        ...state,
        party: state.party.map((u) => {
          if (effect.unit && u.defId !== effect.unit) return u;
          const max = ctx?.unitStats?.(u.defId)?.hp ?? u.hp;
          return { ...u, hp: Math.min(max, u.hp + effect.amount) };
        }),
      };
    case 'gold':
      return { ...state, gold: Math.max(0, state.gold + effect.delta) };
    case 'xp':
      return {
        ...state,
        party: state.party.map((u) =>
          effect.unit && u.defId !== effect.unit ? u : { ...u, xp: u.xp + effect.amount },
        ),
      };
    default: {
      const _exhaustive: never = effect;
      void _exhaustive;
      return state;
    }
  }
}

export interface EffectContext {
  unitStats?: (id: UnitId) => { hp: number; row: 'front' | 'back' } | undefined;
}

export function applyEffects(
  state: GameState,
  effects: Effect[] | undefined,
  ctx?: EffectContext,
): GameState {
  if (!effects || effects.length === 0) return state;
  let s = state;
  for (const e of effects) s = applyEffect(s, e, ctx);
  return s;
}

export const PARTY_SLOTS_PER_ROW = 3;

export function nextFreeSlot(
  party: PartyUnit[],
  prefer: 'front' | 'back',
): { row: 'front' | 'back'; index: number } | undefined {
  const rows: ('front' | 'back')[] = prefer === 'front' ? ['front', 'back'] : ['back', 'front'];
  for (const row of rows) {
    const taken = new Set(party.filter((u) => u.slot.row === row).map((u) => u.slot.index));
    for (let i = 0; i < PARTY_SLOTS_PER_ROW; i++) {
      if (!taken.has(i)) return { row, index: i };
    }
  }
  return undefined;
}

export function markVisited(state: GameState, scene: string, node: string): GameState {
  const visitedScenes = state.visitedScenes.includes(scene)
    ? state.visitedScenes
    : [...state.visitedScenes, scene];
  const key = `${scene}#${node}`;
  const seenNodes = state.seenNodes.includes(key) ? state.seenNodes : [...state.seenNodes, key];
  return { ...state, visitedScenes, seenNodes };
}
