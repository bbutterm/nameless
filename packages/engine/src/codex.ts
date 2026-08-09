import type { CodexEntry, CodexLine, CodexUnlock, ContentBundle } from './types.js';
import type { GameState } from './state.js';

/**
 * Помянник, сторона движка. Здесь только одно: **когда строка считается
 * найденной**. Как она выглядит и где лежит — не наше дело (экран и
 * хранилище клиента, CODEX §7 и §9).
 *
 * Правило разделения: движок кладёт id строки в `state.codexPending` и
 * забывает о ней. Дедупликация против уже написанного — на стороне
 * хранилища: движок не знает про прошлые забеги и знать не должен, иначе
 * сейв начнёт зависеть от книги, которая его переживает.
 */

/** Событие забега, на которое может быть подвешена строка. */
export type CodexEvent =
  | { kind: 'meet'; speaker: string }
  | { kind: 'node'; scene: string; node: string }
  | { kind: 'memory'; memory: string }
  | { kind: 'player_death_with'; speakers: readonly string[] }
  | { kind: 'flags'; flags: Record<string, boolean> };

export interface CodexIndex {
  entries: CodexEntry[];
  byLineId: Map<string, CodexLine>;
  /** Владелец строки — чтобы экран знал, на какую страницу её класть. */
  entryOfLine: Map<string, CodexEntry>;
  meet: Map<string, string[]>;
  node: Map<string, string[]>;
  memory: Map<string, string[]>;
  deathWith: Map<string, string[]>;
  flag: Map<string, string[]>;
}

function push(map: Map<string, string[]>, key: string, id: string): void {
  const cur = map.get(key);
  if (cur) cur.push(id);
  else map.set(key, [id]);
}

/** Ключ узла — тот же, что у `ContentIndex.nodes`: "scene#node". */
export function nodeKey(scene: string, node: string): string {
  return `${scene}#${node}`;
}

export function indexCodex(bundle: Pick<ContentBundle, 'codex'>): CodexIndex {
  const idx: CodexIndex = {
    entries: bundle.codex ?? [],
    byLineId: new Map(),
    entryOfLine: new Map(),
    meet: new Map(),
    node: new Map(),
    memory: new Map(),
    deathWith: new Map(),
    flag: new Map(),
  };
  for (const entry of idx.entries) {
    for (const line of entry.lines) {
      idx.byLineId.set(line.id, line);
      idx.entryOfLine.set(line.id, entry);
      const u: CodexUnlock = line.unlock;
      switch (u.kind) {
        case 'meet':
          push(idx.meet, u.speaker, line.id);
          break;
        case 'node':
          push(idx.node, nodeKey(u.scene, u.node), line.id);
          break;
        case 'memory':
          push(idx.memory, u.memory, line.id);
          break;
        case 'player_death_with':
          push(idx.deathWith, u.speaker, line.id);
          break;
        case 'flag':
          push(idx.flag, u.flag, line.id);
          break;
      }
    }
  }
  return idx;
}

/** Какие строки открывает это событие. Порядок — как в контенте. */
export function linesForEvent(idx: CodexIndex, event: CodexEvent): string[] {
  switch (event.kind) {
    case 'meet':
      return idx.meet.get(event.speaker) ?? [];
    case 'node':
      return idx.node.get(nodeKey(event.scene, event.node)) ?? [];
    case 'memory':
      return idx.memory.get(event.memory) ?? [];
    case 'player_death_with':
      return event.speakers.flatMap((s) => idx.deathWith.get(s) ?? []);
    case 'flags':
      return Object.entries(event.flags)
        .filter(([, on]) => on)
        .flatMap(([f]) => idx.flag.get(f) ?? []);
  }
}

/**
 * Кладёт строки в очередь забега. Возвращает то же состояние, если ничего
 * нового: экономия ре-рендеров клиента и честный `===` в тестах.
 */
export function pushCodexPending(state: GameState, lineIds: readonly string[]): GameState {
  if (lineIds.length === 0) return state;
  const have = new Set(state.codexPending);
  const add = lineIds.filter((id) => !have.has(id));
  if (add.length === 0) return state;
  return { ...state, codexPending: [...state.codexPending, ...add] };
}

/** Событие → состояние. Основная точка входа для движка и клиента. */
export function noteCodexEvent(
  state: GameState,
  idx: CodexIndex | undefined,
  event: CodexEvent,
): GameState {
  if (!idx) return state;
  return pushCodexPending(state, linesForEvent(idx, event));
}

/**
 * Кто был рядом, когда игрока не стало: все, кто говорил в ленте текущей
 * сцены. Лента чистится каждой смертью (`applyDeath`), поэтому это ровно
 * «люди последнего эпизода», а не всё прохождение.
 */
export function speakersAtDeath(state: GameState): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of state.log) {
    const s = entry.speaker;
    if (!s || s === 'player' || s === 'narrator' || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
