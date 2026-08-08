import type { ContentBundle, DeathDef, Memory, MemoryId, PastLife, UnitDef } from './types.js';
import { applyEffects, scaledMaxHp, type EffectContext, type GameState } from './state.js';

/** Опыт для следующего уровня: 100, 250, 450, 700… */
export function xpForLevel(level: number): number {
  return Math.round(50 * level * (level + 1));
}

export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (lvl < 10 && xp >= xpForLevel(lvl)) lvl++;
  return lvl;
}

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
 * Какое воспоминание закрепит эта смерть.
 * Решают поступки, а не игрок: побеждает воспоминание с наибольшим числом
 * осколков; при равенстве — то, чья жизнь ближе к текущему полюсу своей оси.
 * Возвращает undefined, если закреплять нечего (осколков не набрано).
 */
export function selectMemoryOnDeath(state: GameState, content: ContentBundle): Memory | undefined {
  const lifeById = new Map(content.lives.map((l) => [l.id, l]));
  const candidates = content.memories
    .filter((m) => !state.lockedMemories.includes(m.id))
    .map((m) => {
      const frags = state.fragments[m.id] ?? 0;
      const life = lifeById.get(m.life);
      const axisValue = life ? (state.axes[life.axis] ?? 0) : 0;
      const pull = life ? (life.pole === 'positive' ? axisValue : -axisValue) : 0;
      return { m, frags, pull };
    })
    .filter((c) => c.frags >= c.m.cost);

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
): DeathOutcome {
  const memory = selectMemoryOnDeath(state, content);
  let s: GameState = {
    ...state,
    deaths: state.deaths + 1,
    log: [],
  };

  let life: PastLife | undefined;
  let lifeAwakened = false;

  if (memory) {
    s = { ...s, lockedMemories: [...s.lockedMemories, memory.id] };
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
