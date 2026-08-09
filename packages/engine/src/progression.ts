import type { ContentBundle, DeathDef, Memory, MemoryId, PastLife, UnitDef } from './types.js';
import { indexCodex, noteCodexEvent, speakersAtDeath, type CodexIndex } from './codex.js';
import { applyEffects, scaledMaxHp, type EffectContext, type GameState } from './state.js';

import { levelFromXp } from './levels.js';

export { levelFromXp, xpForLevel, MAX_LEVEL } from './levels.js';

export interface ProgressionResult {
  state: GameState;
  /** Что показать игроку: повышения уровня и эволюции. */
  levelUps: { uid: string; from: number; to: number }[];
  evolutions: { uid: string; from: string; to: string }[];
}

/** Раздаёт опыт после боя и проводит эволюции. */
export function grantXp(
  state: GameState,
  units: Map<string, UnitDef>,
  amount: number,
  uids?: string[],
): ProgressionResult {
  const levelUps: ProgressionResult['levelUps'] = [];
  const evolutions: ProgressionResult['evolutions'] = [];
  const party = state.party.map((u) => {
    if (uids && !uids.includes(u.uid)) return u;
    const xp = u.xp + amount;
    const level = levelFromXp(xp);
    let defId = u.defId;
    const def = units.get(u.defId);
    if (def?.evolvesTo && def.evolveAt !== undefined && xp >= def.evolveAt) {
      const evolved = units.get(def.evolvesTo);
      if (evolved) {
        evolutions.push({ uid: u.uid, from: defId, to: evolved.id });
        defId = evolved.id;
      }
    }
    if (level !== u.level) levelUps.push({ uid: u.uid, from: u.level, to: level });
    return { ...u, xp, level, defId };
  });
  return { state: { ...state, party }, levelUps, evolutions };
}

// ─────────────────────────────────────────────────────────────────────────────
// Смерть и закрепление воспоминаний
// ─────────────────────────────────────────────────────────────────────────────

export interface DeathOutcome {
  state: GameState;
  memory?: Memory;
  life?: PastLife;
  /** Жизнь пробудилась именно этой смертью. */
  lifeAwakened: boolean;
}

/**
 * Порог узнавания. Архив не подаёт наверх раздел той жизни, чей полюс игрок
 * прожил В ОБРАТНУЮ сторону хотя бы на столько: милосердный не получит
 * Смолокура, потому что он не тот человек, и архив это знает (CANON 3.5).
 *
 * Число то же, что у нижней ступени лестницы резонанса (STORY_GLOBAL 3.4):
 * лестница досыпает осколки жизни при `pull >= 20`, движок отказывает при
 * `pull <= -20`. Между ними полоса «не определился» — там архив отвечает
 * нейтральным разделом и движок ему не мешает. Разъедутся эти два числа —
 * появится смерть, на которой склянка поднялась, а лот не закрепился.
 */
export const RECOGNITION_THRESHOLD = 20;

/**
 * Префикс служебного счётчика, которым лестница резонанса помечает выданные
 * ЕЮ осколки: `_res:<memoryId>`.
 *
 * Зачем вообще различать. Осколок поступка и осколок неустойки лежат в одном
 * `fragments`, но стоят разного: первый игрок оплатил выбором, второй ему
 * досыпал архив. Если не различать, лестница сама себе открывает любой раздел
 * (досыпала до цены — значит, «набрано честно»), и фильтр узнавания
 * превращается в тавтологию. Счётчик пишет контент — в тех же `effects`-узлах,
 * что выдают осколок; движок только вычитает. Служебные счётчики с
 * подчёркиванием в этом состоянии уже живут (`_recruits`), новых полей в
 * `GameState` не заводится и версия сейва не двигается.
 */
export const RESONANCE_COUNTER_PREFIX = '_res:';

/** Осколки, набранные поступками: всё, что не досыпал архив. */
export function deedFragments(state: GameState, memory: Memory): number {
  const total = state.fragments[memory.id] ?? 0;
  const byResonance = state.counters[RESONANCE_COUNTER_PREFIX + memory.id] ?? 0;
  return Math.max(0, total - byResonance);
}

/** Тяга оси к полюсу жизни: +100 — игрок ровно эта жизнь, −100 — её обратная. */
export function lifePull(state: GameState, life: PastLife): number {
  const axisValue = state.axes[life.axis] ?? 0;
  return life.pole === 'positive' ? axisValue : -axisValue;
}

/**
 * Узнаёт ли архив игрока в этой жизни. «Не узнаёт» — только про прожитый
 * обратный полюс: середина оси не отказ, а неопределённость.
 */
export function lifeRecognizes(
  state: GameState,
  life: PastLife,
  threshold: number = RECOGNITION_THRESHOLD,
): boolean {
  return lifePull(state, life) > -threshold;
}

/**
 * Какое воспоминание закрепит эта смерть.
 * Решают поступки, а не игрок: побеждает воспоминание с наибольшим числом
 * осколков; при равенстве — то, чья жизнь ближе к текущему полюсу своей оси.
 * Возвращает undefined, если закреплять нечего (осколков не набрано ИЛИ
 * набраны они в разделе, который игрока не узнаёт).
 */
export function selectMemoryOnDeath(state: GameState, content: ContentBundle): Memory | undefined {
  const lifeById = new Map(content.lives.map((l) => [l.id, l]));
  const candidates = content.memories
    .filter((m) => !state.lockedMemories.includes(m.id))
    .map((m) => {
      const frags = state.fragments[m.id] ?? 0;
      const life = lifeById.get(m.life);
      const pull = life ? lifePull(state, life) : 0;
      // Жизнь без описания в контенте — не повод молчать: ведёт себя как
      // нейтральная (pull 0), архив её узнаёт.
      const recognized = life ? lifeRecognizes(state, life) : true;
      return { m, frags, pull, recognized };
    })
    .filter((c) => c.frags >= c.m.cost)
    // Раздел, чей обратный полюс прожит, кандидатом не является — КРОМЕ
    // случая, когда осколки в него набраны поступками: за это уже заплачено
    // выбором, и архив не вправе не отдать (DIRECTION B6).
    .filter((c) => c.recognized || deedFragments(state, c.m) >= c.m.cost);

  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => {
    if (b.frags !== a.frags) return b.frags - a.frags;
    if (b.pull !== a.pull) return b.pull - a.pull;
    return a.m.id.localeCompare(b.m.id);
  });
  return candidates[0]?.m;
}

/** Жизнь считается пробуждённой, когда закреплено её первое воспоминание. */
export function applyDeath(
  state: GameState,
  content: ContentBundle,
  death: DeathDef,
  ctx?: EffectContext,
  codexIdx?: CodexIndex,
): DeathOutcome {
  const memory = selectMemoryOnDeath(state, content);
  const codex = codexIdx ?? indexCodex(content);
  // Кто был рядом — считается ДО очистки ленты: после неё свидетелей нет.
  const witnesses = speakersAtDeath(state);
  let s: GameState = {
    ...state,
    deaths: state.deaths + 1,
    log: [],
  };
  s = noteCodexEvent(s, codex, { kind: 'player_death_with', speakers: witnesses });

  let life: PastLife | undefined;
  let lifeAwakened = false;

  if (memory) {
    s = { ...s, lockedMemories: [...s.lockedMemories, memory.id] };
    s = noteCodexEvent(s, codex, { kind: 'memory', memory: memory.id });
    s = applyEffects(s, memory.grants, ctx);
    life = content.lives.find((l) => l.id === memory.life);
    if (life && !s.awakenedLives.includes(life.id)) {
      s = { ...s, awakenedLives: [...s.awakenedLives, life.id] };
      s = applyEffects(s, life.grants, ctx);
      lifeAwakened = true;
    }
  }

  // Отряд восстанавливается: смерть бессмертного откатывает мир, но не память.
  const unitById = new Map(content.units.map((u) => [u.id, u]));
  s = {
    ...s,
    party: s.party.map((u) => {
      const def = unitById.get(u.defId);
      // Восстановление — до уровневого максимума: базовый hp занизил бы
      // (а то и срезал бы) здоровье прокачанных юнитов.
      return { ...u, hp: def ? scaledMaxHp(def.stats.hp, u.level) : u.hp };
    }),
    scene: death.wakeScene,
    node: '@entry',
  };

  return { state: s, memory, life, lifeAwakened };
}

/** Сколько воспоминаний жизни уже закреплено — для UI «мозаики памяти». */
export function lifeProgress(state: GameState, life: PastLife): { locked: number; total: number } {
  const locked = life.memories.filter((m) => state.lockedMemories.includes(m)).length;
  return { locked, total: life.memories.length };
}

/** Кто согласен идти в отряд при текущих осях. */
export function recruitableUnits(
  state: GameState,
  content: ContentBundle,
  evalFn: (c: NonNullable<UnitDef['recruitable']>, s: GameState) => boolean,
): UnitDef[] {
  return content.units.filter((u) => !u.recruitable || evalFn(u.recruitable, state));
}

export function memoryFragmentProgress(
  state: GameState,
  memory: Memory,
): { have: number; need: number; ready: boolean } {
  const have = state.fragments[memory.id] ?? 0;
  return { have, need: memory.cost, ready: have >= memory.cost };
}

export function memoryIdsOfLife(content: ContentBundle, lifeId: string): MemoryId[] {
  return content.memories.filter((m) => m.life === lifeId).map((m) => m.id);
}
