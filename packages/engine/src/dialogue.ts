import type { ContentBundle, Option, Scene, SceneNode } from './types.js';
import { evalCondition } from './conditions.js';
import { indexCodex, noteCodexEvent, type CodexIndex } from './codex.js';
import { applyEffects, markVisited, type EffectContext, type GameState, type LogEntry } from './state.js';

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;

/**
 * Сколько мест на экране может занять «заработанное» — вариант, открытый
 * условием (прожитой жизнью, флагом, памятью, осью, числом смертей).
 *
 * Число не выбрано, а выведено: `MAX_OPTIONS - MIN_OPTIONS`. Два места из
 * четырёх закреплены за общедоступными вариантами, и это даёт сразу две вещи.
 * Первое: железное правило «≥2 варианта при любой личности» держится на
 * вариантах, которые проходят у кого угодно, а не на удачно сложившихся статах.
 * Второе, и оно важнее: игроку с тремя прожитыми жизнями узел остаётся выбором,
 * а не витриной способностей — обычный путь никуда не девается, и отказаться от
 * заработанного можно, не выходя из узла.
 */
export const EARNED_SLOTS = MAX_OPTIONS - MIN_OPTIONS;

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
  codex: CodexIndex;
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
    codex: indexCodex(bundle),
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
  let s = normalizeEntry(idx, state);
  for (let i = 0; i < MAX_AUTO_STEPS; i++) {
    const key = `${s.scene}#${s.node}`;
    const node = idx.nodes.get(key);
    if (!node) return { state: s, step: { kind: 'error', message: `Нет узла ${key}` } };
    s = markVisited(s, s.scene, s.node);
    s = notePassed(idx, s, node);

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
        // Переход вида "scene:id" ставит node='@entry' — его надо развернуть
        // в настоящий узел, иначе следующий виток цикла не найдёт узел вовсе.
        s = normalizeEntry(idx, goTo(s, node.next));
        break;
      }
      case 'branch': {
        const hit = node.branches.find((b) => evalCondition(b.when, s));
        s = normalizeEntry(idx, goTo(s, hit ? hit.to : node.fallback));
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

/**
 * Узел прожит: отметить это в Помяннике. Три события за один проход —
 * узел, встреча (если у узла есть говорящий) и флаги мира.
 *
 * Флаги проверяются целиком, а не по изменению: узел, поставивший флаг,
 * и узел, на котором этот флаг наконец что-то значит, — разные узлы, и
 * ловить момент установки пришлось бы во всех местах, где эффекты
 * применяются. Дедупликация делает повтор бесплатным.
 */
function notePassed(idx: ContentIndex, state: GameState, node: SceneNode): GameState {
  let s = noteCodexEvent(state, idx.codex, {
    kind: 'node',
    scene: state.scene,
    node: node.id,
  });
  if (node.kind === 'say') {
    s = noteCodexEvent(s, idx.codex, { kind: 'meet', speaker: node.speaker });
  }
  return noteCodexEvent(s, idx.codex, { kind: 'flags', flags: s.flags });
}

export function goTo(state: GameState, to: string): GameState {
  const ref = parseRef(to, state.scene);
  return { ...state, scene: ref.scene, node: ref.node ?? '@entry' };
}

/**
 * Переход по 'scene:id' без указания узла — подставляет entry сцены.
 * Заодно синхронизирует номер главы: он живёт в сцене, а условия
 * `{kind:'chapter'}` читают его из состояния, и без синхронизации игрок
 * навсегда оставался бы в первой главе с точки зрения проверок.
 */
export function normalizeEntry(idx: ContentIndex, state: GameState): GameState {
  const scene = idx.scenes.get(state.scene);
  if (!scene) return state;
  const chapter = scene.chapter > 0 ? scene.chapter : state.chapter;
  if (state.node !== '@entry') {
    return chapter === state.chapter ? state : { ...state, chapter };
  }
  return { ...state, node: scene.entry, chapter };
}

/**
 * «Заработанный» вариант — открытый условием и не страховочный. Страховочный
 * (`fallback`) тоже бывает с условием, но он по назначению общедоступный:
 * его задача — не дать узлу схлопнуться, а не наградить за прожитое.
 */
function isEarned(o: Option): boolean {
  return o.conditions !== undefined && !o.fallback;
}

/**
 * Под квоту заработанных попадают только варианты БЕЗ явного `priority`.
 * Явный приоритет — ручка автора, и она главнее правила отбора: если автор
 * поднял вариант руками, движок не двигает его обратно. На этом держатся хабы,
 * где двери в сцены расставлены приоритетами 3–9, и стена найма, где двадцать
 * четыре условных вербовки стоят на одном приоритете 5.
 */
function underQuota(o: Option): boolean {
  return isEarned(o) && o.priority === undefined;
}

/**
 * Порядок ОТБОРА (не показа): priority по убыванию → заработанное выше
 * общедоступного → порядок объявления. Ключи полные и однозначные, порядок
 * объявления уникален, поэтому сортировка детерминирована: один и тот же игрок
 * в одном и том же узле видит одно и то же.
 */
function byRank(options: Option[], list: Option[]): Option[] {
  const declared = new Map<Option, number>(options.map((o, i) => [o, i]));
  return list.slice().sort((a, b) => {
    const p = (b.priority ?? 0) - (a.priority ?? 0);
    if (p !== 0) return p;
    const e = Number(isEarned(b)) - Number(isEarned(a));
    if (e !== 0) return e;
    return (declared.get(a) ?? 0) - (declared.get(b) ?? 0);
  });
}

/**
 * Кого из прошедших пустить на экран, когда их больше четырёх.
 *
 * Раньше выигрывали объявленные раньше, и это выкидывало «заработанное» ради
 * общедоступного, стоящего в файле выше: редкая реплика, открытая прожитой
 * жизнью или флагом, проигрывала кнопке «пройти мимо» просто по номеру строки.
 * Теперь при равном `priority` заработанное идёт первым, но не больше
 * EARNED_SLOTS штук — остальное откладывается в хвост и берётся, только если
 * общедоступных не хватило добрать до четырёх.
 */
function selectVisible(options: Option[], passing: Option[]): Option[] {
  const taken: Option[] = [];
  const deferred: Option[] = [];
  let earned = 0;
  for (const o of byRank(options, passing)) {
    if (taken.length >= MAX_OPTIONS) break;
    if (underQuota(o)) {
      if (earned >= EARNED_SLOTS) {
        deferred.push(o);
        continue;
      }
      earned++;
    }
    taken.push(o);
  }
  for (const o of deferred) {
    if (taken.length >= MAX_OPTIONS) break;
    taken.push(o);
  }
  return taken;
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

  // Порядок кнопок — всегда порядок объявления в сцене. Ветка добора
  // (страховочные и priority) дописывала варианты в хвост, и один и тот же
  // узел выбора показывался разным игрокам в РАЗНОМ порядке — при том, что
  // ветка обрезки до четырёх порядок как раз восстанавливала.
  const inDeclarationOrder = (list: Option[]): Option[] =>
    list.slice().sort((a, b) => options.indexOf(a) - options.indexOf(b));

  if (chosen.length <= MAX_OPTIONS) return inDeclarationOrder(chosen);
  return inDeclarationOrder(selectVisible(options, chosen));
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
/**
 * Сколько записей ленты храним. Лента нужна ровно для одного — прокрутить
 * вверх и перечитать, что было только что; двести пузырей это заведомо
 * больше, чем кто-либо листает.
 *
 * Предел нужен, потому что его не было: комментарий у поля `log` обещал
 * «ленту текущей сцены», но между сценами она не чистилась ни разу за всю
 * игру. Замер на тридцати прогонах: медиана пика 49 записей, максимум 1206 в
 * хабе — около 190 КБ в сейве. Дальше localStorage упирается в квоту,
 * `saveGame` глотает исключение молча, и игрок теряет час игры, не увидев на
 * экране ни слова. Обрезка снизу дешевле любой починки хранилища.
 */
export const LOG_LIMIT = 200;

/** Приписывает запись в ленту, не давая ей расти без предела. */
function appendLog(log: readonly LogEntry[], entry: LogEntry): LogEntry[] {
  const next = [...log, entry];
  return next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next;
}

export function choose(idx: ContentIndex, state: GameState, optionId: string): GameState {
  const node = idx.nodes.get(`${state.scene}#${state.node}`);
  if (!node || node.kind !== 'choice') return state;
  const available = filterOptions(node.options, state);
  const option = available.find((o) => o.id === optionId);
  if (!option) return state;
  let s = applyEffects(state, option.effects, idx.effectCtx);
  s = {
    ...s,
    log: appendLog(s.log, {
      nodeId: node.id,
      scene: s.scene,
      kind: 'choice-made',
      ru: option.text.ru,
      en: option.text.en,
      chosenOptionId: option.id,
    }),
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
  return {
    ...state,
    log: appendLog(state.log, {
      nodeId: node.id,
      scene: state.scene,
      kind: node.kind,
      speaker: node.kind === 'say' ? node.speaker : undefined,
      ru: node.text.ru,
      en: node.text.en,
    }),
  };
}
