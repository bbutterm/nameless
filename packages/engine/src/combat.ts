import type {
  Ability,
  AbilityId,
  BattleDef,
  BattleEffect,
  BattleUnitState,
  ContentBundle,
  PartyUnit,
  Row,
  Side,
  StatusEffect,
  UnitDef,
} from './types.js';
import { Rng, type RngState } from './rng.js';

/** Смягчение урона бронёй: dmg = raw * K/(K+def). K подобран симулятором. */
export const ARMOR_K = 50;
/** Разброс урона — ±12%. */
export const DAMAGE_VARIANCE = 0.12;
export const SLOTS_PER_ROW = 3;
/** Ниже этого числа раундов бой не успевает стать интересным, выше — надоедает. */
export const DEFAULT_TURN_LIMIT = 30;

export type BattleOutcome = 'ongoing' | 'win' | 'lose' | 'draw';

export type BattleEvent =
  | { type: 'round'; round: number }
  | { type: 'intent'; uid: string; ability: AbilityId; targetUid?: string; icon: string }
  | { type: 'act'; uid: string; ability: AbilityId; targetUid?: string; anim: string }
  | { type: 'damage'; uid: string; amount: number; hpAfter: number; crit: boolean }
  | { type: 'heal'; uid: string; amount: number; hpAfter: number }
  | { type: 'status'; uid: string; status: StatusEffect['kind']; turns: number }
  | { type: 'death'; uid: string }
  | { type: 'blocked'; uid: string; reason: string }
  | { type: 'outcome'; result: BattleOutcome };

export interface BattleState {
  battleId: string;
  rng: RngState;
  round: number;
  /** Очередь uid на текущий раунд. */
  order: string[];
  turnIndex: number;
  units: BattleUnitState[];
  events: BattleEvent[];
  outcome: BattleOutcome;
  turnLimit: number;
}

export interface CombatIndex {
  units: Map<string, UnitDef>;
  abilities: Map<string, Ability>;
  battles: Map<string, BattleDef>;
}

export function indexCombat(bundle: ContentBundle): CombatIndex {
  return {
    units: new Map(bundle.units.map((u) => [u.id, u])),
    abilities: new Map(bundle.abilities.map((a) => [a.id, a])),
    battles: new Map(bundle.battles.map((b) => [b.id, b])),
  };
}

/** Прирост статов за уровень: +12% hp/atk, +8% def. */
export function scaleStats(def: UnitDef, level: number): {
  hp: number;
  atk: number;
  def: number;
  initiative: number;
} {
  const l = Math.max(1, level) - 1;
  return {
    hp: Math.round(def.stats.hp * (1 + 0.12 * l)),
    atk: Math.round(def.stats.atk * (1 + 0.12 * l)),
    def: Math.round(def.stats.def * (1 + 0.08 * l)),
    initiative: def.stats.initiative,
  };
}

function makeUnit(
  def: UnitDef,
  side: Side,
  row: Row,
  index: number,
  level: number,
  uid: string,
  hp?: number,
): BattleUnitState {
  const s = scaleStats(def, level);
  const cooldowns: Record<AbilityId, number> = {};
  return {
    uid,
    defId: def.id,
    side,
    row,
    index,
    hp: hp ?? s.hp,
    maxHp: s.hp,
    atk: s.atk,
    def: s.def,
    initiative: s.initiative,
    alive: (hp ?? s.hp) > 0,
    cooldowns,
    statuses: [],
    acted: false,
  };
}

export function startBattle(
  idx: CombatIndex,
  battle: BattleDef,
  party: PartyUnit[],
  seed: string,
): BattleState {
  const rng = new Rng(`${seed}:${battle.id}`);
  const units: BattleUnitState[] = [];

  for (const p of party) {
    const def = idx.units.get(p.defId);
    if (!def) continue;
    units.push(makeUnit(def, 'player', p.slot.row, p.slot.index, p.level, p.uid, p.hp));
  }
  battle.enemies.forEach((e, i) => {
    const def = idx.units.get(e.unit);
    if (!def) return;
    units.push(makeUnit(def, 'enemy', e.row, e.index, e.level ?? 1, `e${i}:${e.unit}`));
  });

  for (const u of units) {
    const def = idx.units.get(u.defId);
    if (!def) continue;
    for (const aid of def.abilities) {
      const ab = idx.abilities.get(aid);
      u.cooldowns[aid] = ab?.initialCooldown ?? 0;
    }
  }

  const state: BattleState = {
    battleId: battle.id,
    rng: rng.snapshot(),
    round: 0,
    order: [],
    turnIndex: 0,
    units,
    events: [],
    outcome: 'ongoing',
    // 0 в данных означает «без лимита» (так объявлено в BattleDef), а не «ноль ходов»:
    // буквальное чтение превращало такой бой в мгновенное поражение.
    turnLimit: battle.turnLimit === undefined ? DEFAULT_TURN_LIMIT : battle.turnLimit || Number.MAX_SAFE_INTEGER,
  };
  return beginRound(idx, state);
}

function living(state: BattleState, side?: Side): BattleUnitState[] {
  return state.units.filter((u) => u.alive && (side ? u.side === side : true));
}

export function beginRound(idx: CombatIndex, state: BattleState): BattleState {
  const rng = Rng.restore(state.rng);
  const round = state.round + 1;
  // Статусы копируются поштучно: щиты убывают мутацией, и общие ссылки
  // на объекты статуса сломали бы воспроизводимость боя по сиду.
  const units = state.units.map((u) => ({
    ...u,
    acted: false,
    statuses: u.statuses.map((st) => ({ ...st })),
  }));

  // Урон/лечение от статусов, тик длительностей.
  const events: BattleEvent[] = [{ type: 'round', round }];
  for (const u of units) {
    if (!u.alive) continue;
    let hp = u.hp;
    for (const st of u.statuses) {
      if (st.kind === 'dot' && st.turns > 0) {
        hp -= st.amount;
        events.push({ type: 'damage', uid: u.uid, amount: st.amount, hpAfter: Math.max(0, hp), crit: false });
      }
    }
    u.hp = Math.max(0, hp);
    if (u.hp === 0) {
      u.alive = false;
      events.push({ type: 'death', uid: u.uid });
    }
    u.statuses = u.statuses
      .map((st) => ({ ...st, turns: st.turns - 1 }))
      .filter((st) => st.turns > 0);
    for (const key of Object.keys(u.cooldowns)) {
      u.cooldowns[key] = Math.max(0, (u.cooldowns[key] ?? 0) - 1);
    }
  }

  const alive = units.filter((u) => u.alive);
  const order = alive
    .map((u) => ({ uid: u.uid, init: effectiveStat(u, 'initiative') + rng.float(0, 0.999) }))
    .sort((a, b) => b.init - a.init)
    .map((x) => x.uid);

  let next: BattleState = {
    ...state,
    round,
    units,
    order,
    turnIndex: 0,
    events: [...state.events, ...events],
    rng: rng.snapshot(),
  };
  next = rollIntents(idx, next);
  next = skipDeadOrStunned(idx, next);
  return checkOutcome(next);
}

export function effectiveStat(u: BattleUnitState, stat: 'atk' | 'def' | 'initiative'): number {
  let v = u[stat];
  for (const st of u.statuses) {
    if ((st.kind === 'buff' || st.kind === 'debuff') && st.stat === stat) {
      v += st.kind === 'buff' ? st.amount : -st.amount;
    }
  }
  return Math.max(0, v);
}

export function isStunned(u: BattleUnitState): boolean {
  return u.statuses.some((s) => s.kind === 'stun' && s.turns > 0);
}

export function shieldOf(u: BattleUnitState): number {
  return u.statuses.filter((s) => s.kind === 'shield').reduce((a, s) => a + s.amount, 0);
}

export function unitAbilities(idx: CombatIndex, u: BattleUnitState): Ability[] {
  const def = idx.units.get(u.defId);
  if (!def) return [];
  return def.abilities.map((a) => idx.abilities.get(a)).filter((a): a is Ability => !!a);
}

export function readyAbilities(idx: CombatIndex, u: BattleUnitState): Ability[] {
  return unitAbilities(idx, u).filter((a) => (u.cooldowns[a.id] ?? 0) <= 0);
}

/**
 * Правило строя: ближний бой достаёт только передний ряд противника,
 * пока в нём кто-то жив. Пустой передний ряд открывает задний.
 */
export function legalTargets(
  state: BattleState,
  actorUid: string,
  ability: Ability,
): BattleUnitState[] {
  const actor = state.units.find((u) => u.uid === actorUid);
  if (!actor || !actor.alive) return [];
  const foes = living(state, actor.side === 'player' ? 'enemy' : 'player');
  const allies = living(state, actor.side);

  switch (ability.target) {
    case 'self':
      return [actor];
    case 'ally_one':
      return allies;
    case 'ally_all':
      return allies;
    case 'enemy_all':
    case 'enemy_row':
      return foes;
    case 'enemy_any':
      return foes;
    case 'enemy_front': {
      if (ability.piercing) return foes;
      const front = foes.filter((u) => u.row === 'front');
      return front.length > 0 ? front : foes;
    }
    default:
      return foes;
  }
}

/** Цели, по которым реально пройдёт эффект (для AoE разворачивает выбор в список). */
export function resolveTargets(
  state: BattleState,
  actor: BattleUnitState,
  ability: Ability,
  targetUid: string | undefined,
): BattleUnitState[] {
  const primary = state.units.find((u) => u.uid === targetUid && u.alive);
  const foes = living(state, actor.side === 'player' ? 'enemy' : 'player');
  const allies = living(state, actor.side);
  switch (ability.target) {
    case 'self':
      return [actor];
    case 'ally_all':
      return allies;
    case 'enemy_all':
      return foes;
    case 'enemy_row':
      return primary ? foes.filter((u) => u.row === primary.row) : foes;
    default:
      return primary ? [primary] : [];
  }
}

export function computeDamage(
  rng: Rng,
  attacker: BattleUnitState,
  target: BattleUnitState,
  power: number,
): { amount: number; crit: boolean } {
  const atk = effectiveStat(attacker, 'atk');
  const def = effectiveStat(target, 'def');
  const raw = atk * power;
  const mitigated = raw * (ARMOR_K / (ARMOR_K + def));
  const variance = rng.float(1 - DAMAGE_VARIANCE, 1 + DAMAGE_VARIANCE);
  const crit = rng.chance(0.08);
  const amount = Math.max(1, Math.round(mitigated * variance * (crit ? 1.5 : 1)));
  return { amount, crit };
}

export interface Action {
  ability: AbilityId;
  targetUid?: string;
}

export function currentActor(state: BattleState): BattleUnitState | undefined {
  const uid = state.order[state.turnIndex];
  if (!uid) return undefined;
  return state.units.find((u) => u.uid === uid && u.alive);
}

export function isPlayerTurn(state: BattleState): boolean {
  return state.outcome === 'ongoing' && currentActor(state)?.side === 'player';
}

/** Применяет действие текущего актора и передаёт ход дальше. */
export function act(idx: CombatIndex, state: BattleState, action: Action): BattleState {
  if (state.outcome !== 'ongoing') return state;
  const actor = currentActor(state);
  if (!actor) return advanceTurn(idx, state);

  const ability = idx.abilities.get(action.ability);
  if (!ability || (actor.cooldowns[ability.id] ?? 0) > 0) {
    return advanceTurn(idx, {
      ...state,
      events: [...state.events, { type: 'blocked', uid: actor.uid, reason: 'ability' }],
    });
  }

  const rng = Rng.restore(state.rng);
  const units = state.units.map((u) => ({ ...u, statuses: u.statuses.map((st) => ({ ...st })) }));
  const self = units.find((u) => u.uid === actor.uid);
  if (!self) return advanceTurn(idx, state);

  const targets = resolveTargets({ ...state, units }, self, ability, action.targetUid);
  const events: BattleEvent[] = [
    { type: 'act', uid: self.uid, ability: ability.id, targetUid: action.targetUid, anim: ability.anim ?? 'lunge' },
  ];

  const effects: BattleEffect[] =
    ability.effects && ability.effects.length > 0
      ? ability.effects
      : [{ kind: 'damage', power: ability.power }];

  for (const eff of effects) {
    for (const tRef of targets) {
      const t = units.find((u) => u.uid === tRef.uid);
      if (!t || !t.alive) continue;
      applyBattleEffect(rng, self, t, eff, events);
      if (t.hp <= 0 && t.alive) {
        t.alive = false;
        t.hp = 0;
        events.push({ type: 'death', uid: t.uid });
      }
    }
  }

  self.cooldowns = { ...self.cooldowns, [ability.id]: ability.cooldown };
  self.acted = true;

  const next: BattleState = {
    ...state,
    units,
    events: [...state.events, ...events],
    rng: rng.snapshot(),
  };
  return advanceTurn(idx, checkOutcome(next));
}

function applyBattleEffect(
  rng: Rng,
  actor: BattleUnitState,
  target: BattleUnitState,
  eff: BattleEffect,
  events: BattleEvent[],
): void {
  switch (eff.kind) {
    case 'damage': {
      const { amount, crit } = computeDamage(rng, actor, target, eff.power);
      let left = amount;
      // Щиты съедают урон первыми.
      for (const st of target.statuses) {
        if (st.kind === 'shield' && left > 0) {
          const absorbed = Math.min(st.amount, left);
          st.amount -= absorbed;
          left -= absorbed;
        }
      }
      target.statuses = target.statuses.filter((s) => !(s.kind === 'shield' && s.amount <= 0));
      target.hp = Math.max(0, target.hp - left);
      events.push({ type: 'damage', uid: target.uid, amount, hpAfter: target.hp, crit });
      break;
    }
    case 'heal': {
      const amount = Math.max(1, Math.round(effectiveStat(actor, 'atk') * eff.power));
      target.hp = Math.min(target.maxHp, target.hp + amount);
      events.push({ type: 'heal', uid: target.uid, amount, hpAfter: target.hp });
      break;
    }
    case 'shield':
      target.statuses.push({ kind: 'shield', amount: eff.amount, turns: eff.turns });
      events.push({ type: 'status', uid: target.uid, status: 'shield', turns: eff.turns });
      break;
    case 'buff':
      target.statuses.push({ kind: 'buff', stat: eff.stat, amount: eff.amount, turns: eff.turns });
      events.push({ type: 'status', uid: target.uid, status: 'buff', turns: eff.turns });
      break;
    case 'debuff':
      target.statuses.push({ kind: 'debuff', stat: eff.stat, amount: eff.amount, turns: eff.turns });
      events.push({ type: 'status', uid: target.uid, status: 'debuff', turns: eff.turns });
      break;
    case 'dot':
      target.statuses.push({ kind: 'dot', amount: eff.amount, turns: eff.turns, tag: eff.tag });
      events.push({ type: 'status', uid: target.uid, status: 'dot', turns: eff.turns });
      break;
    case 'stun':
      target.statuses.push({ kind: 'stun', amount: 0, turns: eff.turns });
      events.push({ type: 'status', uid: target.uid, status: 'stun', turns: eff.turns });
      break;
    case 'cleanse':
      target.statuses = target.statuses.filter((s) => s.kind !== 'dot' && s.kind !== 'debuff' && s.kind !== 'stun');
      events.push({ type: 'status', uid: target.uid, status: 'cleanse', turns: 0 });
      break;
    case 'revive':
      if (!target.alive) {
        target.alive = true;
        target.hp = Math.max(1, Math.round(target.maxHp * eff.hpPercent));
        events.push({ type: 'heal', uid: target.uid, amount: target.hp, hpAfter: target.hp });
      }
      break;
    default: {
      const _exhaustive: never = eff;
      void _exhaustive;
    }
  }
}

function advanceTurn(idx: CombatIndex, state: BattleState): BattleState {
  if (state.outcome !== 'ongoing') return state;
  const next = { ...state, turnIndex: state.turnIndex + 1 };
  if (next.turnIndex >= next.order.length) {
    if (next.round >= next.turnLimit) {
      return { ...next, outcome: 'lose', events: [...next.events, { type: 'outcome', result: 'lose' }] };
    }
    return beginRound(idx, next);
  }
  return skipDeadOrStunned(idx, next);
}

function skipDeadOrStunned(idx: CombatIndex, state: BattleState): BattleState {
  let s = state;
  let guard = 0;
  while (s.outcome === 'ongoing' && guard++ < 64) {
    const uid = s.order[s.turnIndex];
    if (!uid) {
      if (s.round >= s.turnLimit) {
        return { ...s, outcome: 'lose', events: [...s.events, { type: 'outcome', result: 'lose' }] };
      }
      return beginRound(idx, s);
    }
    const u = s.units.find((x) => x.uid === uid);
    if (u && u.alive && !isStunned(u)) return s;
    if (u && u.alive && isStunned(u)) {
      s = { ...s, events: [...s.events, { type: 'blocked', uid: u.uid, reason: 'stun' }] };
    }
    s = { ...s, turnIndex: s.turnIndex + 1 };
    if (s.turnIndex >= s.order.length) {
      if (s.round >= s.turnLimit) {
        return { ...s, outcome: 'lose', events: [...s.events, { type: 'outcome', result: 'lose' }] };
      }
      return beginRound(idx, s);
    }
  }
  return s;
}

export function checkOutcome(state: BattleState): BattleState {
  if (state.outcome !== 'ongoing') return state;
  const players = living(state, 'player').length;
  const enemies = living(state, 'enemy').length;
  if (players === 0 && enemies === 0) {
    return { ...state, outcome: 'draw', events: [...state.events, { type: 'outcome', result: 'draw' }] };
  }
  if (enemies === 0) {
    return { ...state, outcome: 'win', events: [...state.events, { type: 'outcome', result: 'win' }] };
  }
  if (players === 0) {
    return { ...state, outcome: 'lose', events: [...state.events, { type: 'outcome', result: 'lose' }] };
  }
  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// ИИ: намерения врагов и автобой для симулятора
// ─────────────────────────────────────────────────────────────────────────────

/** Выбор действия ботом: приоритет добиванию, лечению раненых, иначе сильнейшая готовая способность. */
export function planAction(
  idx: CombatIndex,
  state: BattleState,
  actor: BattleUnitState,
): Action | undefined {
  const ready = readyAbilities(idx, actor);
  if (ready.length === 0) return undefined;
  const rng = Rng.restore(state.rng).fork(`ai:${actor.uid}:${state.round}:${state.turnIndex}`);

  const allies = living(state, actor.side);
  const healer = ready.find((a) => a.effects?.some((e) => e.kind === 'heal') || a.target === 'ally_one');
  if (healer) {
    const hurt = allies
      .filter((u) => u.hp < u.maxHp * 0.55)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) return { ability: healer.id, targetUid: hurt.uid };
  }

  // Самая «дорогая» готовая способность — но не тратим AoE на одну цель.
  const foesAlive = living(state, actor.side === 'player' ? 'enemy' : 'player').length;
  const scored = ready
    .filter((a) => a.target !== 'ally_one' && a.target !== 'ally_all')
    .map((a) => {
      let score = a.power * (a.cooldown > 0 ? 1.25 : 1);
      if (a.target === 'enemy_all') score *= Math.min(foesAlive, 3) * 0.8;
      if (a.target === 'enemy_row') score *= 1.4;
      return { a, score };
    })
    .sort((x, y) => y.score - x.score);

  const chosen = scored[0]?.a ?? ready[0];
  if (!chosen) return undefined;

  const targets = legalTargets(state, actor.uid, chosen);
  if (targets.length === 0) return undefined;
  // Добить, если можем; иначе самая слабая цель; изредка — случайная, чтобы бой не был роботом.
  const finishable = targets.find((t) => t.hp <= effectiveStat(actor, 'atk') * chosen.power * 0.5);
  const weakest = targets.slice().sort((a, b) => a.hp - b.hp)[0];
  const target = finishable ?? (rng.chance(0.15) ? rng.pick(targets) : weakest);
  return { ability: chosen.id, targetUid: target?.uid };
}

/** Проставляет иконки намерений всем живым врагам на текущий раунд. */
export function rollIntents(idx: CombatIndex, state: BattleState): BattleState {
  const units = state.units.map((u) => {
    if (!u.alive || u.side !== 'enemy') return { ...u, intent: undefined };
    const plan = planAction(idx, state, u);
    if (!plan) return { ...u, intent: undefined };
    const ab = idx.abilities.get(plan.ability);
    return {
      ...u,
      intent: { ability: plan.ability, targetUid: plan.targetUid, icon: ab?.icon ?? 'sword' },
    };
  });
  const events: BattleEvent[] = units
    .filter((u) => u.intent)
    .map((u) => ({
      type: 'intent' as const,
      uid: u.uid,
      ability: u.intent!.ability,
      targetUid: u.intent!.targetUid,
      icon: u.intent!.icon,
    }));
  return { ...state, units, events: [...state.events, ...events] };
}

/** Ход бота (враг или обе стороны в симуляции). */
export function autoAct(idx: CombatIndex, state: BattleState): BattleState {
  const actor = currentActor(state);
  if (!actor) return state;
  const plan = actor.side === 'enemy' && actor.intent
    ? { ability: actor.intent.ability, targetUid: actor.intent.targetUid }
    : planAction(idx, state, actor);
  if (!plan) {
    return act(idx, state, { ability: '__pass__' });
  }
  // Цель могла умереть до хода — переприцеливаемся.
  const ab = idx.abilities.get(plan.ability);
  const target = state.units.find((u) => u.uid === plan.targetUid);
  if (ab && (!target || !target.alive)) {
    const alt = legalTargets(state, actor.uid, ab).sort((a, b) => a.hp - b.hp)[0];
    return act(idx, state, { ability: plan.ability, targetUid: alt?.uid });
  }
  return act(idx, state, plan);
}

/** Прогон боя до конца обеими сторонами-ботами. Используется симулятором. */
export function runAuto(idx: CombatIndex, state: BattleState, maxSteps = 2000): BattleState {
  let s = state;
  let steps = 0;
  while (s.outcome === 'ongoing' && steps++ < maxSteps) {
    s = autoAct(idx, s);
  }
  return s;
}
