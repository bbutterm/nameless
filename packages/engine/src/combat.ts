import type {
  Ability,
  AbilityId,
  BattleDef,
  BattleEffect,
  BattleUnitState,
  ContentBundle,
  LifeId,
  PartyUnit,
  PlayerAbility,
  PlayerLoadout,
  Row,
  Side,
  StatusEffect,
  UnitDef,
} from './types.js';
import { Rng, type RngState } from './rng.js';
import { scaledMaxHp } from './state.js';

/**
 * Тег щитов, которые возвращаются лечением, если истекли непробитыми
 * («Лучшие годы», MEMORY_POWERS §A.4). Тег, а не общее правило: щиты в игре
 * носят девять юнитов, и общее правило подняло бы цену каждого из них —
 * то самое «правка общей способности сдвигает норму тира».
 */
export const SHIELD_REFUND_TAG = 'posul_refund';

/** Префикс трейта сродства: юнит жизни «смолокур» несёт `life_smolokur`. */
export const AFFINITY_TRAIT_PREFIX = 'life_';

/** Во сколько раз слабее отклик сродства (MEMORY_POWERS §C.1). */

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
  /**
   * Отклик сродства: юнит той же жизни сорвался следом за рукой героя.
   * Отдельным событием, а не просто `act`, по двум причинам: отклик обязан быть
   * ВИДЕН (MEMORY_POWERS §C.3 — иначе он проигрывает скучной прибавке к урону),
   * и его надо уметь считать — метрика §D.3 требует 1–3 откликов за бой.
   */
  | { type: 'response'; uid: string; ability: AbilityId; targetUid?: string; life: LifeId }
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
  /**
   * Режим «Опись» (Перечень I): точные числа врагов и их намерения открыты
   * игроку с первого раунда. Для движка это ЧИСТО ИНФОРМАЦИОННЫЙ флаг — ни
   * одна формула его не читает, и это сознательно: канон обещает игроку
   * знание, а не преимущество в числах.
   */
  reveal: boolean;
  /**
   * «Первая закрытая строка» (MEMORY_POWERS §C.1) уже прозвучала.
   *
   * У пассива жеста нет, и сродственные ему юниты не могли откликнуться
   * никогда — умение не применяют. Их момент другой: первая гибель врага в
   * бою. Флаг держит обещание «раз в бой».
   */
  firstLine: boolean;
  /**
   * Умения самого игрока на этот бой (от закреплённых воспоминаний).
   *
   * Живут в состоянии боя, а не в `CombatIndex`, по двум причинам: у них есть
   * изменяемая часть (перезарядка), и бой обязан быть самодостаточным —
   * реплей по сиду не должен зависеть от того, какой контент подсунули рядом.
   */
  player: PlayerLoadout;
}

/** Пустой набор: бой без умений игрока ведёт себя ровно как до их появления. */
const EMPTY_LOADOUT: PlayerLoadout = { abilities: [], cooldowns: {} };

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
    hp: scaledMaxHp(def.stats.hp, level),
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

/**
 * @param powers умения игрока (из `derivePlayerPowers`). Не передали — бой
 * идёт как раньше: параметр необязателен намеренно, чтобы симулятор, тесты и
 * старые вызовы клиента продолжали мерить ровно то, что мерили.
 */
export function startBattle(
  idx: CombatIndex,
  battle: BattleDef,
  party: PartyUnit[],
  seed: string,
  powers?: readonly PlayerAbility[],
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

  // Умения игрока входят в бой готовыми (с поправкой на initialCooldown).
  // Перезарядка МЕЖДУ боями не переносится, и это решение, а не упущение:
  // 1) состояние боя нигде не сохраняется, перенос потребовал бы нового поля в
  //    GameState и подъёма версии сейва — платы за то, чего канон не просил;
  // 2) воспоминание — не расходник: оно закреплено навсегда, и «умение ещё не
  //    отдохнуло с прошлой драки» противоречит тому, чем оно является;
  // 3) симулятор гоняет бои независимо друг от друга; перенос сделал бы
  //    прогоны зависимыми, и балансовый коридор перестал бы что-либо значить.
  // Если канон захочет ресурс, переживающий бой (DIRECTION_COMBAT C2), это
  // будет отдельное поле GameState с миграцией, а не тихая правка здесь.
  const loadout: PlayerLoadout = { abilities: [...(powers ?? [])], cooldowns: {} };
  for (const p of loadout.abilities) {
    loadout.cooldowns[p.id] = p.ability.initialCooldown ?? 0;
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
    player: loadout,
    reveal: false,
    firstLine: false,
    // 0 в данных означает «без лимита» (так объявлено в BattleDef), а не «ноль ходов»:
    // буквальное чтение превращало такой бой в мгновенное поражение.
    turnLimit: battle.turnLimit === undefined ? DEFAULT_TURN_LIMIT : battle.turnLimit || Number.MAX_SAFE_INTEGER,
  };
  // Пассивы применяются ПОСЛЕ первого beginRound, а не до него: beginRound
  // тикает длительности, и статус, повешенный раньше, терял бы первый раунд —
  // «в начале боя» превращалось бы в «со второго раунда».
  return applyPassives(idx, beginRound(idx, state));
}

/**
 * Пассивные умения игрока: режим «Опись» и то, что она делает с врагами в
 * начале боя. Кнопки у пассива нет, хода он не тратит и в очередь не входит
 * (MEMORY_POWERS §A.6, §B.3).
 */
function applyPassives(idx: CombatIndex, state: BattleState): BattleState {
  const passives = (state.player ?? EMPTY_LOADOUT).abilities.filter((p) => p.ability.passive);
  if (passives.length === 0) return state;
  const rng = Rng.restore(state.rng);
  const units = state.units.map((u) => ({ ...u, statuses: u.statuses.map((st) => ({ ...st })) }));
  const events: BattleEvent[] = [];
  let reveal = state.reveal;

  const tax = healTax(state);
  for (const p of passives) {
    for (const eff of p.ability.effects ?? []) {
      if (eff.kind === 'reveal') {
        reveal = true;
        continue;
      }
      // Пошлина на лечение читается в момент каждого лечения прямо из набора
      // умений — отдельного поля состояния под неё не заводится.
      if (eff.kind === 'heal_tax') continue;
      const side: Side = p.ability.target.startsWith('enemy') ? 'enemy' : 'player';
      for (const t of units.filter((u) => u.alive && u.side === side)) {
        // Носителя у пассива нет: умение принадлежит игроку, а не карте.
        // Для эффектов, считающих от atk носителя, это значило бы «от atk цели»,
        // поэтому пассивам разрешены только фиксированные числа (см. валидатор).
        applyBattleEffect(rng, t, t, eff, events, tax);
      }
    }
  }
  return { ...state, units, reveal, events: [...state.events, ...events], rng: rng.snapshot() };
}

/**
 * Множитель лечения союзников, объявленный пассивами игрока (Перечень III).
 *
 * Перемножается, а не складывается: два умения, каждое «×0.75», обязаны дать
 * ×0.5625, а не «−50%». Пассивов с пошлиной сегодня один, но правило свёртки
 * лучше задать до того, как появится второй.
 */
export function healTax(state: BattleState): number {
  let factor = 1;
  for (const p of (state.player ?? EMPTY_LOADOUT).abilities) {
    if (!p.ability.passive) continue;
    for (const eff of p.ability.effects ?? []) {
      if (eff.kind === 'heal_tax') factor *= eff.factor;
    }
  }
  return factor;
}

/** Лечение с учётом пошлины. Округление ВНИЗ — так объявлено в §A.6. */
function taxed(amount: number, tax: number): number {
  return tax === 1 ? amount : Math.floor(amount * tax);
}

function living(state: BattleState, side?: Side): BattleUnitState[] {
  return state.units.filter((u) => u.alive && (side ? u.side === side : true));
}

export function beginRound(idx: CombatIndex, state: BattleState): BattleState {
  const rng = Rng.restore(state.rng);
  const round = state.round + 1;
  // Статусы копируются поштучно: щиты убывают мутацией, и общие ссылки
  // на объекты статуса сломали бы воспроизводимость боя по сиду.
  // Статусы И кулдауны копируются поштучно: и те и другие правятся мутацией
  // (щиты убывают, кулдауны тикают), а общая ссылка означала бы, что
  // предыдущее состояние боя задним числом меняется вместе с новым —
  // ломается и реплей по сиду, и мемоизация на клиенте (ссылка та же —
  // перерисовки кулдаунов не будет).
  const units = state.units.map((u) => ({
    ...u,
    acted: false,
    statuses: u.statuses.map((st) => ({ ...st })),
    cooldowns: { ...u.cooldowns },
  }));

  // Урон/лечение от статусов, тик длительностей.
  const events: BattleEvent[] = [{ type: 'round', round }];

  const tax = healTax(state);

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
    const ticked = u.statuses.map((st) => ({ ...st, turns: st.turns - 1 }));
    // Непредъявленный посул — чистая прибыль: щит с тегом возврата, истёкший
    // непробитым, отдаёт остаток лечением 1:1. Только помеченные щиты: чужие
    // щиты не должны менять цену от того, что игрок вспомнил Посульщика.
    if (u.alive) {
      for (const st of ticked) {
        if (st.turns > 0) continue;
        if (st.kind !== 'shield' || st.tag !== SHIELD_REFUND_TAG || st.amount <= 0) continue;
        if (!accepts(u, 'heal_flat')) continue;
        // Возврат посула — тоже лечение, и опись берёт свою четверть и с него:
        // иначе цена Перечня обходилась бы вторым умением.
        const back = u.side === 'player' ? taxed(st.amount, tax) : st.amount;
        if (back <= 0) continue;
        u.hp = Math.min(u.maxHp, u.hp + back);
        events.push({ type: 'heal', uid: u.uid, amount: back, hpAfter: u.hp });
      }
    }
    u.statuses = ticked.filter((st) => st.turns > 0);
    for (const key of Object.keys(u.cooldowns)) {
      u.cooldowns[key] = Math.max(0, (u.cooldowns[key] ?? 0) - 1);
    }
  }

  // Перезарядка умений игрока тикает теми же раундами боя, что и у юнитов:
  // другого счёта времени в бою нет, а два разных счёта игрок бы не свёл.
  // Список умений копируется по ссылке сознательно — он неизменяем внутри боя,
  // меняются только числа перезарядки, и они копируются поштучно.
  const player: PlayerLoadout = {
    abilities: (state.player ?? EMPTY_LOADOUT).abilities,
    cooldowns: { ...(state.player ?? EMPTY_LOADOUT).cooldowns },
  };
  for (const key of Object.keys(player.cooldowns)) {
    player.cooldowns[key] = Math.max(0, (player.cooldowns[key] ?? 0) - 1);
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
    player,
    order,
    turnIndex: 0,
    events: [...state.events, ...events],
    rng: rng.snapshot(),
  };
  // Исход проверяется ДО пропуска ходов: если dot выкосил обе стороны разом,
  // очередь пуста, и skipDeadOrStunned заводил бы новые раунды рекурсивно —
  // при turnLimit «без лимита» это переполняло стек, а с лимитом ничья
  // ошибочно превращалась в поражение по лимиту.
  next = checkOutcome(next);
  if (next.outcome !== 'ongoing') return next;
  // Дот мог закрыть строку описи не хуже удара: первую гибель врага ловим и
  // здесь, иначе отклик Перечня зависел бы от того, кто именно добил.
  next = firstLineResponses(idx, next);
  next = checkOutcome(next);
  if (next.outcome !== 'ongoing') return next;
  next = rollIntents(idx, next);
  return skipDeadOrStunned(idx, next);
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
 * Умения игрока, готовые прямо сейчас, — для конкретного носителя.
 *
 * Носителем может быть ЛЮБАЯ живая карта своей стороны: умение принадлежит
 * игроку, карта только даёт руку. Перезарядка при этом одна на всех.
 */
export function readyPlayerAbilities(state: BattleState, u: BattleUnitState): PlayerAbility[] {
  const loadout = state.player ?? EMPTY_LOADOUT;
  if (u.side !== 'player' || !u.alive) return [];
  // Пассивы («Опись») слота не занимают и нажатия не ждут: их интерфейс —
  // сами цифры на врагах (MEMORY_POWERS §B.3).
  return loadout.abilities.filter(
    (p) => !p.ability.passive && (loadout.cooldowns[p.id] ?? 0) <= 0,
  );
}

/**
 * Разбор действия: чьё это умение, каким оно вышло после усилений, откуда
 * читать перезарядку и тратит ли оно ход.
 *
 * Способность СВОЕГО юнита имеет приоритет над одноимённым умением игрока:
 * у неё своя перезарядка на карте, и подмена её общей была бы тихим изменением
 * поведения существующих юнитов. Совпадение id — повод для предупреждения
 * валидатора, а не для догадок движка.
 */
function resolveAction(
  idx: CombatIndex,
  state: BattleState,
  actor: BattleUnitState,
  abilityId: AbilityId,
):
  | { ability: Ability; fromPlayer: boolean; cooldown: number; spendsTurn: boolean; life?: LifeId }
  | undefined {
  const owns = idx.units.get(actor.defId)?.abilities.includes(abilityId) ?? false;
  if (owns) {
    const ability = idx.abilities.get(abilityId);
    if (!ability) return undefined;
    return { ability, fromPlayer: false, cooldown: actor.cooldowns[abilityId] ?? 0, spendsTurn: true };
  }
  if (actor.side !== 'player') return undefined;
  const loadout = state.player ?? EMPTY_LOADOUT;
  const power = loadout.abilities.find((p) => p.id === abilityId);
  if (!power) return undefined;
  // Пассив кнопкой не нажимается ни игроком, ни ботом: он уже применён в
  // начале боя. Возврат undefined доводит попытку до записи `blocked`.
  if (power.ability.passive) return undefined;
  return {
    ability: power.ability,
    fromPlayer: true,
    ...(power.life ? { life: power.life } : {}),
    cooldown: loadout.cooldowns[abilityId] ?? 0,
    // Умение вне очереди обязано иметь перезарядку: иначе носитель применял бы
    // его бесконечно, очередь не двигалась бы, и бой замирал. Контент с такой
    // ошибкой валидатор краснит, а движок здесь не падает и не зависает — он
    // просто берёт плату ходом.
    spendsTurn: power.costsTurn || power.ability.cooldown <= 0,
  };
}

/**
 * Способность поднимает павших? Тогда её законные цели — наоборот, МЁРТВЫЕ
 * союзники. Без этого эффект `revive` был недостижим втройне: живых целей
 * фильтровал legalTargets, мёртвых отбрасывал resolveTargets, а цикл
 * применения пропускал `!alive`. Эффект существовал в типах, схеме и движке,
 * но не мог сработать никогда.
 */
export function isRevive(ability: Ability): boolean {
  return ability.effects?.some((e) => e.kind === 'revive') ?? false;
}

function fallen(state: BattleState, side: Side): BattleUnitState[] {
  return state.units.filter((u) => !u.alive && u.side === side);
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
  const allies = isRevive(ability) ? fallen(state, actor.side) : living(state, actor.side);

  switch (ability.target) {
    case 'self':
      return [actor];
    case 'ally_one':
      return allies;
    case 'ally_row':
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
  const raising = isRevive(ability);
  const primary = state.units.find((u) => u.uid === targetUid && u.alive !== raising);
  const foes = living(state, actor.side === 'player' ? 'enemy' : 'player');
  const allies = raising ? fallen(state, actor.side) : living(state, actor.side);
  switch (ability.target) {
    case 'self':
      return [actor];
    case 'ally_all':
      return allies;
    case 'enemy_all':
      return foes;
    case 'enemy_row':
      // Без живой первичной цели ряд не определён: пустой список, а не
      // молчаливое превращение удара по ряду в удар по всем.
      return primary ? foes.filter((u) => u.row === primary.row) : [];
    case 'ally_row':
      return primary ? allies.filter((u) => u.row === primary.row) : [];
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

  // Способность должна существовать, принадлежать актору и быть готовой:
  // без проверки владения кулдаун чужой способности читался как 0,
  // и любой юнит мог применить что угодно из общего реестра. «Принадлежать» —
  // это либо своя способность карты, либо умение игрока у карты своей стороны.
  const resolved = resolveAction(idx, state, actor, action.ability);
  if (!resolved || resolved.cooldown > 0) {
    return advanceTurn(idx, {
      ...state,
      events: [...state.events, { type: 'blocked', uid: actor.uid, reason: 'ability' }],
    });
  }
  const { ability, fromPlayer, spendsTurn } = resolved;

  // Одноцелевые способности обязаны бить по легальной живой цели. Раньше
  // мёртвая цель давала «пустой» ход со сгоревшим кулдауном, а прямой uid
  // заднего ряда обходил правило «передний ряд прикрывает задний».
  const needsTarget =
    ability.target === 'enemy_front' ||
    ability.target === 'enemy_any' ||
    ability.target === 'enemy_row' ||
    ability.target === 'ally_row' ||
    ability.target === 'ally_one';
  if (needsTarget) {
    const legal = legalTargets(state, actor.uid, ability);
    if (!action.targetUid || !legal.some((t) => t.uid === action.targetUid)) {
      return advanceTurn(idx, {
        ...state,
        events: [...state.events, { type: 'blocked', uid: actor.uid, reason: 'target' }],
      });
    }
  }

  const rng = Rng.restore(state.rng);
  const units = state.units.map((u) => ({ ...u, statuses: u.statuses.map((st) => ({ ...st })) }));
  const self = units.find((u) => u.uid === actor.uid);
  if (!self) return advanceTurn(idx, state);

  const targets = resolveTargets({ ...state, units }, self, ability, action.targetUid);
  const events: BattleEvent[] = [
    { type: 'act', uid: self.uid, ability: ability.id, targetUid: action.targetUid, anim: ability.anim ?? 'lunge' },
  ];

  const { perTarget, wide } = splitEffects(ability);
  const tax = healTax(state);

  for (const eff of perTarget) {
    for (const tRef of targets) {
      const t = units.find((u) => u.uid === tRef.uid);
      // Мёртвая цель пропускается всем, кроме воскрешения: оно ради неё и есть.
      if (!t || (!t.alive && eff.kind !== 'revive')) continue;
      applyBattleEffect(rng, self, t, eff, events, tax);
      if (t.hp <= 0 && t.alive) {
        t.alive = false;
        t.hp = 0;
        events.push({ type: 'death', uid: t.uid });
      }
    }
  }

  // Всеобщие эффекты — после поцелевых: цена «Года Голой Правды» снимает бафы
  // и щиты со своих ПОСЛЕ того, как протокол лёг на чужих. Собственную работу
  // умение при этом не смывает — хроника переживает год печати.
  applyWideEffects(units, self, wide, events, tax);

  // Перезарядка умения игрока пишется в общий счёт, а не на карту носителя:
  // иначе умение можно было бы «перезарядить», произнеся его другой картой.
  //
  // Заряд ОДИН НА БОЙ И ОБЩИЙ ДЛЯ ВСЕХ умений героя (MEMORY_POWERS §B.1):
  // применение гасит и остальные ромбы. Иначе игрок с тремя вспомненными
  // жизнями получал бы три вмешательства за бой вместо одного — и «раз в бой»
  // как событие превращалось бы в приборную доску.
  const loadout = state.player ?? EMPTY_LOADOUT;
  const player: PlayerLoadout = fromPlayer
    ? {
        abilities: loadout.abilities,
        cooldowns: Object.fromEntries(
          loadout.abilities.map((p) => [
            p.id,
            p.ability.passive
              ? (loadout.cooldowns[p.id] ?? 0)
              : Math.max(loadout.cooldowns[p.id] ?? 0, ability.cooldown),
          ]),
        ),
      }
    : loadout;
  if (!fromPlayer) self.cooldowns = { ...self.cooldowns, [ability.id]: ability.cooldown };
  if (spendsTurn) self.acted = true;

  // Отклик сродства: руки узнают руки (MEMORY_POWERS §C.1). Только от умения
  // героя и только один раз — цепочек «отклик от отклика» нет (§F.8).
  if (fromPlayer && resolved.life) {
    // В обзор кладётся УЖЕ ПОТРАЧЕННЫЙ заряд: иначе `planAction`, к которому
    // отклик обращается за целью, увидел бы умение готовым и посоветовал бы
    // цель под него — под то, что применить уже нельзя.
    affinityResponses(
      idx,
      { ...state, units, player },
      self.side,
      resolved.life,
      action.targetUid,
      rng,
      events,
    );
  }

  let next: BattleState = {
    ...state,
    units,
    player,
    events: [...state.events, ...events],
    rng: rng.snapshot(),
  };
  // Первая закрытая строка — отклик пассива (§C.1). Считается после всего
  // остального в ходе: строка закрывается гибелью, а не намерением.
  next = firstLineResponses(idx, next);
  const settled = checkOutcome(next);
  // Умение вне очереди хода не двигает очередь: носитель применил его и всё
  // ещё ходит. Бесконечности нет — такое умение обязано иметь перезарядку
  // (см. resolveAction), а исход боя проверен до возврата.
  if (!spendsTurn && settled.outcome === 'ongoing') return settled;
  return advanceTurn(idx, settled);
}

/**
 * Приписки, которые запрещает протокол: «без прибавления».
 * Урон, доты и дебафы проходят — протокол не защищает, он отказывает в
 * улучшениях (MEMORY_POWERS §A.5).
 */
const ADDITIONS: ReadonlySet<BattleEffect['kind']> = new Set([
  'buff',
  'shield',
  'heal',
  'heal_flat',
]);

export function isRecorded(u: BattleUnitState): boolean {
  return u.statuses.some((s) => s.kind === 'recorded' && s.turns > 0);
}

/** Примет ли цель этот эффект прямо сейчас — с учётом протокола. */
function accepts(target: BattleUnitState, kind: BattleEffect['kind']): boolean {
  return !(ADDITIONS.has(kind) && isRecorded(target));
}

function applyBattleEffect(
  rng: Rng,
  actor: BattleUnitState,
  target: BattleUnitState,
  eff: BattleEffect,
  events: BattleEvent[],
  /**
   * Множитель лечения союзников (Перечень III). Единица — «пошлины нет», и
   * тогда путь исполнения ровно тот же, что был до появления умений.
   */
  healFactor = 1,
): void {
  if (!accepts(target, eff.kind)) {
    events.push({ type: 'blocked', uid: target.uid, reason: 'recorded' });
    return;
  }
  // Пошлина берётся только со своих: «еда не внесена» — про свой стол.
  const tax = (v: number): number => (target.side === 'player' ? taxed(v, healFactor) : v);
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
      const amount = tax(Math.max(1, Math.round(effectiveStat(actor, 'atk') * eff.power)));
      if (amount <= 0) break;
      target.hp = Math.min(target.maxHp, target.hp + amount);
      events.push({ type: 'heal', uid: target.uid, amount, hpAfter: target.hp });
      break;
    }
    case 'heal_flat': {
      const amount = tax(eff.amount);
      if (amount <= 0) break;
      target.hp = Math.min(target.maxHp, target.hp + amount);
      events.push({ type: 'heal', uid: target.uid, amount, hpAfter: target.hp });
      break;
    }
    case 'shield':
      target.statuses.push({
        kind: 'shield',
        amount: eff.amount,
        turns: eff.turns,
        ...(eff.tag ? { tag: eff.tag } : {}),
      });
      events.push({ type: 'status', uid: target.uid, status: 'shield', turns: eff.turns });
      break;
    // Бафы и дебафы нулевой величины пропускаются: статус, который ничего не
    // меняет, — это шум в логе и лишний чип на карточке. Нулём базовая запись
    // умения обозначает «на этой ступени эффекта ещё нет».
    case 'buff':
      if (eff.amount <= 0) break;
      target.statuses.push({ kind: 'buff', stat: eff.stat, amount: eff.amount, turns: eff.turns });
      events.push({ type: 'status', uid: target.uid, status: 'buff', turns: eff.turns });
      break;
    case 'debuff':
      if (eff.amount <= 0) break;
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
    case 'purge':
      target.statuses = target.statuses.filter((s) => s.kind !== 'buff' && s.kind !== 'shield');
      events.push({ type: 'status', uid: target.uid, status: 'purge', turns: 0 });
      break;
    case 'recorded':
      target.statuses.push({ kind: 'recorded', amount: 0, turns: eff.turns });
      events.push({ type: 'status', uid: target.uid, status: 'recorded', turns: eff.turns });
      break;
    case 'revive':
      if (!target.alive) {
        target.alive = true;
        target.hp = Math.max(1, tax(Math.round(target.maxHp * eff.hpPercent)));
        events.push({ type: 'heal', uid: target.uid, amount: target.hp, hpAfter: target.hp });
      }
      break;
    // Всеобщие и режимные эффекты сюда не доезжают: их отбирает `splitEffects`
    // до цикла по целям. Ветки нужны компилятору — и тому, кто добавит
    // следующий эффект и увидит, что решение «поцелевой или всеобщий» надо
    // принять в двух местах, а не в одном.
    case 'rally':
    case 'spare_worst_foe':
    case 'bare_truth':
    case 'reveal':
    case 'heal_tax':
    case 'shield_refund':
      break;
    default: {
      const _exhaustive: never = eff;
      void _exhaustive;
    }
  }
}

/** Эффекты, у которых своя публика: цель способности к ним отношения не имеет. */
function isWideEffect(e: BattleEffect): boolean {
  return (
    e.kind === 'rally' ||
    e.kind === 'spare_worst_foe' ||
    e.kind === 'bare_truth' ||
    e.kind === 'reveal' ||
    e.kind === 'heal_tax' ||
    e.kind === 'shield_refund'
  );
}

/**
 * Разбор списка эффектов на два: что идёт по целям и что исполняется один раз.
 *
 * Заодно помечает щиты тегом возврата, если умение объявило `shield_refund`.
 * Пометка ставится здесь, а не в `applyBattleEffect`, потому что решение
 * принимается по СОСЕДЯМ эффекта, а не по нему самому.
 */
function splitEffects(ability: Ability): { perTarget: BattleEffect[]; wide: BattleEffect[] } {
  const raw: BattleEffect[] =
    ability.effects && ability.effects.length > 0
      ? ability.effects
      : [{ kind: 'damage', power: ability.power }];
  const refund = raw.some((e) => e.kind === 'shield_refund');
  const perTarget: BattleEffect[] = [];
  const wide: BattleEffect[] = [];
  for (const e of raw) {
    if (isWideEffect(e)) wide.push(e);
    else if (refund && e.kind === 'shield') perTarget.push({ ...e, tag: SHIELD_REFUND_TAG });
    else perTarget.push(e);
  }
  return { perTarget, wide };
}

/** Исполняет всеобщие эффекты: у них своя публика, цель способности их не касается. */
function applyWideEffects(
  units: BattleUnitState[],
  self: BattleUnitState,
  wide: readonly BattleEffect[],
  events: BattleEvent[],
  healFactor = 1,
): void {
  for (const eff of wide) {
    switch (eff.kind) {
      case 'rally': {
        for (const u of units) {
          if (!u.alive || u.side !== self.side) continue;
          if (!accepts(u, 'buff')) {
            events.push({ type: 'blocked', uid: u.uid, reason: 'recorded' });
            continue;
          }
          if (eff.amount <= 0) continue;
          u.statuses.push({ kind: 'buff', stat: eff.stat, amount: eff.amount, turns: eff.turns });
          events.push({ type: 'status', uid: u.uid, status: 'buff', turns: eff.turns });
        }
        break;
      }
      case 'spare_worst_foe': {
        // «Ты стоял с полной кружкой и всё ещё не мог придумать, кому в ней
        // отказать». Самый раненый ПО ДОЛЕ hp — колодец не считает чужих
        // максимумов. Ничьи разводятся строковым сравнением uid, не localeCompare.
        const foes = units.filter((u) => u.alive && u.side !== self.side);
        const worst = foes
          .slice()
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || (a.uid < b.uid ? -1 : 1))[0];
        if (!worst || eff.amount <= 0) break;
        if (!accepts(worst, 'heal_flat')) {
          events.push({ type: 'blocked', uid: worst.uid, reason: 'recorded' });
          break;
        }
        // Пошлина описи берётся только со своих, а этот — чужой: подлечить
        // врага дешевле от того, что герой считает еду, не становится.
        const back = worst.side === 'player' ? taxed(eff.amount, healFactor) : eff.amount;
        if (back <= 0) break;
        worst.hp = Math.min(worst.maxHp, worst.hp + back);
        events.push({ type: 'heal', uid: worst.uid, amount: back, hpAfter: worst.hp });
        break;
      }
      case 'bare_truth': {
        // Цена «Года Голой Правды» (§A.5): бафы и щиты слетают и со СВОИХ —
        // однократно, в момент печати. Хронику, которую умение только что
        // положило на чужих, оно за собой не смывает: протокол — не прибавление.
        for (const u of units) {
          if (!u.alive || u.side !== self.side) continue;
          const before = u.statuses.length;
          u.statuses = u.statuses.filter((s) => s.kind !== 'buff' && s.kind !== 'shield');
          if (u.statuses.length === before) continue;
          events.push({ type: 'status', uid: u.uid, status: 'purge', turns: 0 });
        }
        break;
      }
      default:
        // reveal / heal_tax / shield_refund — режимы, а не действия: они уже
        // прочитаны там, где имеют смысл (пассивы, тег щита).
        break;
    }
  }
}


/**
 * Отклик сродства (MEMORY_POWERS §C.1–C.2, четвёртая редакция).
 *
 * Отклик — НЕ ход и НЕ действие. Это фиксированный микро-эффект роли с одной
 * константой: узнавание руки, а не второй боец на поле.
 *
 * Три предыдущие редакции сняты замером, и все три ошибались одинаково —
 * пытались выразить отклик через ДЕЙСТВИЕ откликающегося:
 *
 *  1. «Первая способность, бесплатно, без кулдауна» — выдавала самый дорогой
 *     ход юнита в обход перезарядки: пустышка давала +11.3 над базой.
 *  2. «Самая дешёвая готовая, вполсилы, кулдаун пишется» — оставила лишнее
 *     действие, и его цена оказалась ценой ремесла: от −2.5 у лекарей до
 *     +7.7 у бойцов при одинаковом числе откликов. Множитель силы был
 *     бессилен: 0.5 → 0.4 снимало один пункт из семи.
 *  3. «Сдвинутый ход плюс отдышка» — обнулила экономику действий, но не цену:
 *     разброс остался 14 пунктов (−6.6 у Ключаря, +7.6 у Смолокура), потому
 *     что «ударить раньше» и «полечить раньше» стоят разного.
 *
 * Вывод, ради которого эта история тут записана: **чужое действие не может
 * стоить одинаково у пяти ремёсел — действие И ЕСТЬ ремесло. Одинаково стоит
 * только фиксированный эффект.** Смешивать редакции запрещено (§F.8).
 */
function responseRoleOf(def: UnitDef | undefined): 'heal' | 'shield' | 'debuff' | 'damage' {
  if (!def) return 'damage';
  // Явная роль в данных старше трейтов: у отголосков боевых трейтов нет вовсе,
  // и без неё все четверо молча стали бы бойцами.
  if (def.responseRole) return def.responseRole;
  const traits = def.traits ?? [];
  // Порядок разбора задан каноном: лекарь важнее щитоносца, щитоносец важнее
  // ломающего. Юнит с двумя трейтами обязан откликаться однозначно.
  if (traits.includes('healer')) return 'heal';
  if (traits.includes('shield') || traits.includes('guard')) return 'shield';
  if (traits.includes('breaker')) return 'debuff';
  return 'damage';
}

/**
 * Цена отклика в hp-эквиваленте (§C.1). Одна на все роли; формы ролей
 * калибруются к ней прибором, поэтому написания несимметричны, а цены — нет.
 */
export const RESPONSE_K = 5;
/**
 * Урон-роль: тройка, и она ОТЛОЖЕННАЯ — дот на один тик, а не удар сейчас.
 *
 * Закон калибровки, доказанный дважды: дорого «куда» и «когда», а не
 * «сколько». Номинал резали двумя независимыми ручками и сняли 0.4 и 0.5
 * пункта; одно прицеливание сняло 1.3. Мгновенность была последней премией
 * урон-роли: удар сейчас закрывает чужой ход, дот — уже нет.
 *
 * Форма взята дословно из «Смолы на воде»: «вода занялась ровно так, как ты
 * обещал совету, — с опозданием на два вдоха».
 */
const RESPONSE_DAMAGE = 3;
const RESPONSE_DOT_TAG = 'response';
/**
 * Дебафф-роль: −3 к атаке на 2 раунда.
 *
 * Написание несимметрично прочим ролям, и это норма: K — одна константа ЦЕНЫ
 * в hp-эквиваленте, а формы ролей калибруются к ней прибором. «Минус два»
 * стоило заметно дешевле пяти чистых, и жизнь, у которой все пятеро
 * сродственных ломают, оказывалась на семь пунктов дешевле той, у которой все
 * пятеро бьют.
 */
const RESPONSE_DEBUFF = 3;
const RESPONSE_TURNS = 2;

function affinityResponses(
  idx: CombatIndex,
  view: BattleState,
  side: Side,
  life: LifeId,
  heroTargetUid: string | undefined,
  rng: Rng,
  events: BattleEvent[],
): void {
  const trait = `${AFFINITY_TRAIT_PREFIX}${life}`;
  const responders = view.units
    .filter(
      (u) =>
        u.alive &&
        u.side === side &&
        // Оглушённый не откликается: рука узнала бы, да некому.
        !isStunned(u) &&
        (idx.units.get(u.defId)?.traits ?? []).includes(trait),
    )
    .sort(
      (a, b) =>
        effectiveStat(b, 'initiative') - effectiveStat(a, 'initiative') || (a.uid < b.uid ? -1 : 1),
    );

  const foes = () => living(view, side === 'player' ? 'enemy' : 'player');
  const allies = () => living(view, side);
  const mostHurt = (list: BattleUnitState[]): BattleUnitState | undefined =>
    list.filter((u) => u.hp < u.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];

  for (const r of responders) {
    if (!r.alive) continue;
    const role = responseRoleOf(idx.units.get(r.defId));

    // Цель микро-эффекта. Урон и дебафф тянутся к цели умения героя, если она
    // враг; поддержка смотрит на своих и выбирает самого раненого.
    let target: BattleUnitState | undefined;
    if (role === 'damage') {
      /*
       * Урон-отклик бьёт САМОГО ЗДОРОВОГО врага, а не цель умения.
       *
       * Причина замеренная. Пять чистых по цели героя слишком часто добивали
       * почти мёртвого — и премия за добивание оказалась пороговой, то есть
       * нечувствительной к номиналу: K 5 → 4 сняла у Смолокура 0.4 пункта из
       * 6.3. Платил не размер отклика, а то, что он закрывал чужой удар.
       * Смена цели снимает премию конструкцией, не трогая номинал.
       */
      target = foes()
        .slice()
        .sort((a, b) => b.hp - a.hp || (a.uid < b.uid ? -1 : 1))[0];
    } else if (role === 'debuff') {
      const named = heroTargetUid ? view.units.find((u) => u.uid === heroTargetUid) : undefined;
      target = named && named.alive && named.side !== side ? named : foes()[0];
    } else if (role === 'shield') {
      /*
       * Щит идёт САМОМУ ЗДОРОВОМУ своему — «подпорка под рабочую руку».
       * Щит раненому нёс премию предотвращения смерти, зеркальную той премии
       * добивания, что снята у урона: и там и там отклик решал исход, а не
       * подталкивал его.
       */
      target = allies()
        .slice()
        .sort((a, b) => b.hp - a.hp || (a.uid < b.uid ? -1 : 1))[0];
    } else {
      // Лечение прицеливать незачем: его потолок — недостающие hp, и премии
      // у него нет по устройству.
      target = mostHurt(allies()) ?? allies()[0];
    }
    if (!target) continue;

    events.push({ type: 'response', uid: r.uid, ability: `response_${role}`, targetUid: target.uid, life });

    if (role === 'damage') {
      // Дот, а не удар: чистый урон, но в начале следующего раунда. Броня
      // по-прежнему не считается — отклику нечем торговаться с защитой.
      applyBattleEffect(
        rng,
        r,
        target,
        { kind: 'dot', amount: RESPONSE_DAMAGE, turns: 1, tag: RESPONSE_DOT_TAG },
        events,
        healTax(view),
      );
    } else if (role === 'heal') {
      applyBattleEffect(rng, r, target, { kind: 'heal_flat', amount: RESPONSE_K }, events, healTax(view));
    } else if (role === 'shield') {
      applyBattleEffect(rng, r, target, { kind: 'shield', amount: RESPONSE_K, turns: RESPONSE_TURNS }, events, healTax(view));
    } else {
      applyBattleEffect(
        rng,
        r,
        target,
        { kind: 'debuff', stat: 'atk', amount: RESPONSE_DEBUFF, turns: RESPONSE_TURNS },
        events,
        healTax(view),
      );
    }
  }
}

/**
 * «Первая закрытая строка» (MEMORY_POWERS §C.1).
 *
 * У Перечня жеста нет — умение пассивное, и до этой правки его сродственные
 * не откликались НИКОГДА: отклик был привязан к применению, а применять
 * пассив нельзя. Момент отклика другой: первая гибель врага в бою. Раз в бой,
 * то же полудействие, ход при этом не тратит никто.
 *
 * Правило записано не «если жизнь = Перечень», а «если умение пассивное»:
 * причина в устройстве умения, а не в его имени, и следующий пассив получит
 * тот же отклик без правки движка.
 */
function firstLineResponses(idx: CombatIndex, state: BattleState): BattleState {
  if (state.firstLine || state.outcome !== 'ongoing') return state;
  const passives = (state.player ?? EMPTY_LOADOUT).abilities.filter(
    (p) => p.ability.passive && p.life,
  );
  if (passives.length === 0) return state;
  // Строка закрывается гибелью врага, а не намерением её закрыть.
  if (!state.units.some((u) => u.side === 'enemy' && !u.alive)) return state;

  const rng = Rng.restore(state.rng);
  const units = state.units.map((u) => ({ ...u, statuses: u.statuses.map((st) => ({ ...st })) }));
  const events: BattleEvent[] = [];
  const view: BattleState = { ...state, units, firstLine: true };
  for (const p of passives) {
    if (!p.life) continue;
    affinityResponses(idx, view, 'player', p.life, undefined, rng, events);
  }
  return {
    ...state,
    units,
    firstLine: true,
    events: [...state.events, ...events],
    rng: rng.snapshot(),
  };
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
  /**
   * Считать ли умения героя. Отклик зовёт эту функцию с `false`: сдвигается
   * ХОД ЮНИТА, а умение героя уже применено — иначе сродственный «откликнулся»
   * бы вторым применением того же умения, и заряд боя перестал бы быть одним.
   */
  options: { hero?: boolean } = {},
): Action | undefined {
  const useHero = options.hero !== false;
  // Бот-игрок ПОЛЬЗУЕТСЯ умениями игрока — сознательно.
  //
  // Живым игроком бот не управляет; обе стороны ботами гоняет только симулятор.
  // Не дай мы боту умения — балансовый коридор не измерил бы их НИКОГДА:
  // сюжетные бои считались бы отрядом без умений, автор канона получал бы
  // зелёный отчёт на умение любой силы, и первым, кто заметил бы перекос, был
  // бы игрок. Поэтому умения входят в общий список готовых наравне со
  // способностями карты и оцениваются той же эвристикой.
  //
  // Умения героя разбираются ОТДЕЛЬНОЙ политикой (`heroPlan`), а не общим
  // списком готовых, как было на каркасе. Причина измеренная: общая эвристика
  // сортирует по `power`, а у четырёх умений памяти из пяти `power` равен нулю
  // — они лечат, щитуют, жгут дотом и стирают статусы. В общем списке они
  // никогда не всплывали бы наверх, и «бот умеет играть механикой» было бы
  // неправдой при зелёном отчёте. Плюс заряд один на бой: такое решение нельзя
  // принимать той же меркой, что выбор между двумя ударами.
  const ready = readyAbilities(idx, actor);
  if (ready.length === 0 && (!useHero || readyPlayerAbilities(state, actor).length === 0)) return undefined;
  const rng = Rng.restore(state.rng).fork(`ai:${actor.uid}:${state.round}:${state.turnIndex}`);

  const allies = living(state, actor.side);
  // Поднять павшего важнее, чем долечить раненого.
  const raiser = ready.find((a) => isRevive(a));
  if (raiser) {
    const dead = fallen(state, actor.side).sort((a, b) => b.maxHp - a.maxHp)[0];
    if (dead) return { ability: raiser.id, targetUid: dead.uid };
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

  // Цена обычного хода этого юнита — мерка, с которой сравнивается всё
  // остальное: и лечение, и умение героя.
  const strikeValue = effectiveStat(actor, 'atk') * (scored[0]?.a.power ?? 1);
  const hero = useHero ? heroPlan(idx, state, actor, strikeValue) : undefined;
  if (hero) return hero;

  const healer = ready.find(
    (a) => !isRevive(a) && (a.effects?.some((e) => e.kind === 'heal') || a.target === 'ally_one'),
  );
  if (healer) {
    const hurt = allies
      .filter((u) => u.hp < u.maxHp * 0.55)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    // Лечение — тоже размен: ход, потраченный на лечение, не наносит урона.
    // Раньше бот лечил, как только у кого-то падало ниже 55% HP, не глядя,
    // сколько это лечение вернёт. Групповое «Чтение белой книги» возвращает
    // 0.3 атаки на союзника — около пяти HP, — а пропущенный удар стоит
    // восемнадцати. Юнит с таким набором проигрывал турнир, играя «правильно»
    // по старому правилу, и это читалось как слабость юнита, хотя слаб был
    // выбор бота. Считаем, сколько HP реально вернётся (лечение сверх
    // максимума не считается), и сравниваем с ценой пропущенного удара.
    // Порог 0.7, а не 1.0: у лечения есть довесок — снятие эффектов, щит,
    // усиление, — который в этой оценке не учитывается.
    if (hurt) {
      const atk = effectiveStat(actor, 'atk');
      const healPower = (healer.effects ?? [])
        .filter((e) => e.kind === 'heal')
        .reduce((sum, e) => sum + (e.kind === 'heal' ? e.power : 0), 0);
      const perAlly = atk * healPower;
      const touched = healer.target === 'ally_all' ? allies : [hurt];
      const restored = touched.reduce((sum, u) => sum + Math.min(perAlly, u.maxHp - u.hp), 0);
      // Союзник на грани — ход стоит потратить независимо от арифметики:
      // ценность здесь не в HP, а в том, что он останется на доске.
      const dying = hurt.hp <= hurt.maxHp * 0.25;
      if (dying || restored >= strikeValue * 0.7) {
        return { ability: healer.id, targetUid: hurt.uid };
      }
    }
  }

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

// ─────────────────────────────────────────────────────────────────────────────
// Политика бота для умений героя (DIRECTION_COMBAT §E.6)
//
// Механику, в которую не умеет играть бот, нельзя замерить. Здесь живёт та
// самая политика: во что бот оценивает каждое из пяти умений, куда целит и
// когда решает, что момент настал. Всё считается в HP-эквиваленте, чтобы
// сравниваться с ценой пропущенного удара — той же меркой, что у лечения.
// ─────────────────────────────────────────────────────────────────────────────

/** Куда бот направит умение героя. Цель выбирается по смыслу эффекта, не по power. */
function heroTargetUid(
  idx: CombatIndex,
  state: BattleState,
  actor: BattleUnitState,
  ability: Ability,
): string | undefined {
  const legal = legalTargets(state, actor.uid, ability);
  if (legal.length === 0) return undefined;
  const byFraction = (a: BattleUnitState, b: BattleUnitState): number =>
    a.hp / a.maxHp - b.hp / b.maxHp || (a.uid < b.uid ? -1 : 1);
  const byHp = (a: BattleUnitState, b: BattleUnitState): number =>
    a.hp - b.hp || (a.uid < b.uid ? -1 : 1);
  switch (ability.target) {
    case 'self':
      return actor.uid;
    case 'ally_one':
    case 'ally_all':
      // И кружка, и посул идут туда, где тоньше: самый раненый по доле hp.
      return legal.slice().sort(byFraction)[0]?.uid;
    // Ряд выбирается ПО ЦЕНЕ РЯДА, а не по его населённости.
    //
    // Прежнее правило («ряд, где больше народу», а при равенстве — передний)
    // делало ступень II Чистописца строго хуже ступени I: протокол на весь ряд
    // всегда ложился на передних мордоворотов, тогда как одноцелевая ступень I
    // выбирала самого ценного врага — лекаря или щитоносца из заднего ряда.
    // Замер показывал −3 пункта там, где умение расширяется, — и это была
    // неспособность бота играть, а не свойство умения (DIRECTION_COMBAT §E.6).
    case 'ally_row':
    case 'enemy_row': {
      const rows: Row[] = ['front', 'back'];
      let best: { uid: string; v: number } | undefined;
      for (const row of rows) {
        const inRow = legal.filter((u) => u.row === row);
        if (inRow.length === 0) continue;
        // Представитель ряда: самый раненый — им же и разрешаются ничьи.
        const rep = inRow.slice().sort(ability.target === 'ally_row' ? byFraction : byHp)[0];
        if (!rep) continue;
        const targets = resolveTargets(state, actor, ability, rep.uid);
        const v = heroValue(idx, state, actor, ability, targets);
        if (!best || v > best.v) best = { uid: rep.uid, v };
      }
      return best?.uid ?? legal.slice().sort(byHp)[0]?.uid;
    }
    default:
      return legal.slice().sort(byHp)[0]?.uid;
  }
}

/**
 * Чем цель живёт по части ПРИБАВЛЕНИЙ — в HP-эквиваленте одного захода.
 *
 * Нужно ровно для протокола: «занесено в протокол» стоит столько, сколько
 * враг не сможет себе и своим прибавить, пока запись висит. Считается по
 * СПОСОБНОСТЯМ, а не по тому, что висит сейчас: запрет бьёт по будущему.
 * Без этого бот оценивал протокол по числу целей и клал ступень II всегда на
 * передний ряд — на тех, кто ничего не прибавляет, — и расширение умения
 * оказывалось хуже его же ступени I.
 */
function additionsWeight(idx: CombatIndex, u: BattleUnitState): number {
  let w = 0;
  const atk = effectiveStat(u, 'atk');
  for (const a of unitAbilities(idx, u)) {
    for (const e of a.effects ?? []) {
      switch (e.kind) {
        case 'heal':
          w += atk * e.power;
          break;
        case 'heal_flat':
          w += e.amount;
          break;
        case 'shield':
          w += e.amount;
          break;
        case 'buff':
        case 'rally':
          w += e.amount * e.turns * (e.stat === 'atk' ? 1 : 0.35);
          break;
        default:
          break;
      }
    }
  }
  return w;
}

/** Во что бот оценивает применение умения — в HP-эквиваленте. */
function heroValue(
  idx: CombatIndex,
  state: BattleState,
  actor: BattleUnitState,
  ability: Ability,
  targets: readonly BattleUnitState[],
): number {
  const atk = effectiveStat(actor, 'atk');
  const { perTarget, wide } = splitEffects(ability);
  const allies = living(state, actor.side);
  const foes = living(state, actor.side === 'player' ? 'enemy' : 'player');
  const withStatus = (u: BattleUnitState, kinds: BattleEffect['kind'][]): boolean =>
    u.statuses.some((s) => kinds.includes(s.kind));
  // Пошлина описи (Перечень III) удешевляет ЧУЖИЕ руки тоже: бот, считающий
  // кружку по номиналу, переоценивал бы её на четверть в каждом бою, где
  // вспомнены обе жизни. Лечение врага пошлиной не облагается — оно чужое.
  const tax = healTax(state);
  const mine = (v: number): number => (actor.side === 'player' ? taxed(v, tax) : v);
  let v = 0;
  for (const e of perTarget) {
    switch (e.kind) {
      case 'damage':
        v += targets.reduce(
          (s, t) => s + atk * e.power * (ARMOR_K / (ARMOR_K + effectiveStat(t, 'def'))),
          0,
        );
        break;
      case 'heal':
        v += targets.reduce((s, t) => s + Math.min(mine(atk * e.power), t.maxHp - t.hp), 0);
        break;
      // Лечение сверх максимума не считается — иначе бот подавал бы кружку
      // здоровым и «тратил заряд» в 100% боёв, красиво и бессмысленно.
      case 'heal_flat':
        v += targets.reduce((s, t) => s + Math.min(mine(e.amount), t.maxHp - t.hp), 0);
        break;
      // Дот проходит мимо брони — считается в лоб.
      case 'dot':
        v += e.amount * e.turns * targets.length;
        break;
      // Щит стоит меньше номинала: часть его истечёт непробитой (что для
      // «Лучших годов» как раз прибыль, но на неё бот не рассчитывает).
      case 'shield':
        v += 0.8 * e.amount * targets.length;
        break;
      case 'buff':
        v += (e.stat === 'atk' ? 1 : 0.5) * e.amount * e.turns * targets.length;
        break;
      case 'debuff':
        v += (e.stat === 'def' ? 0.6 : 0.8) * e.amount * e.turns * targets.length;
        break;
      case 'stun':
        v += atk * e.turns * targets.length;
        break;
      case 'cleanse':
        v += 4 * targets.filter((t) => withStatus(t, ['dot', 'debuff', 'stun'])).length;
        break;
      case 'purge':
        v += 6 * targets.filter((t) => withStatus(t, ['buff', 'shield'])).length;
        break;
      // Протокол ценен ровно против тех, кто живёт прибавлениями. Доля 0.5 —
      // сколько из объявленного арсенала цель успела бы применить за два
      // запрещённых раунда: примерно один заход.
      case 'recorded':
        v += targets.reduce(
          (s, t) => s + Math.max(withStatus(t, ['buff', 'shield']) ? 8 : 3, 0.5 * additionsWeight(idx, t)),
          0,
        );
        break;
      default:
        break;
    }
  }
  for (const e of wide) {
    switch (e.kind) {
      case 'rally':
        v += (e.stat === 'atk' ? 1 : 0.5) * e.amount * e.turns * allies.length;
        break;
      // Подлечить врага — прямой убыток, и бот считает его убытком.
      case 'spare_worst_foe':
        v -= e.amount;
        break;
      case 'bare_truth':
        // Чистая цена: свои бафы и щиты слетают в момент печати. Цена тем
        // выше, чем больше своих прибавлений сейчас висит, — и ровно ноль,
        // когда посулы уже истрачены. Это и есть решение, которое умение
        // ставит перед игроком: применять, когда своё отработало.
        v -= 6 * allies.filter((u) => withStatus(u, ['buff', 'shield'])).length;
        break;
      default:
        break;
    }
  }
  return v;
}

/** Прибавка за отклик сродства: чем больше своих в отряде, тем громче жест. */
function responseValue(
  idx: CombatIndex,
  state: BattleState,
  actor: BattleUnitState,
  life: LifeId | undefined,
): number {
  if (!life) return 0;
  const trait = `${AFFINITY_TRAIT_PREFIX}${life}`;
  let v = 0;
  for (const u of living(state, actor.side)) {
    // Донора не пропускаем: он откликается наравне со всеми (§C.1).
    if (isStunned(u)) continue;
    if (!(idx.units.get(u.defId)?.traits ?? []).includes(trait)) continue;
    // Отклик один и тот же у всех: фиксированный микро-эффект в K единиц.
    // Оценивать его чужой атакой больше нечем и незачем — в этом весь смысл
    // четвёртой редакции.
    v += RESPONSE_K;
  }
  return v;
}

/**
 * Применять ли умение героя прямо сейчас — и какое.
 *
 * Заряд один на бой, поэтому решение не «выгодно ли», а «выгоднее ли, чем
 * приберечь». Порог падает к четвёртому раунду: неиспользованный заряд к
 * концу боя стоит ноль, и умение, забытое в кармане, замерить нельзя
 * (MEMORY_POWERS §D.6 — заряд обязан тратиться в 70–95% боёв).
 */
function heroPlan(
  idx: CombatIndex,
  state: BattleState,
  actor: BattleUnitState,
  strikeValue: number,
): Action | undefined {
  const powers = readyPlayerAbilities(state, actor);
  if (powers.length === 0) return undefined;
  let best: { action: Action; score: number } | undefined;
  for (const p of powers) {
    const targetUid = heroTargetUid(idx, state, actor, p.ability);
    const targets = resolveTargets(state, actor, p.ability, targetUid);
    if (targets.length === 0) continue;
    const score =
      heroValue(idx, state, actor, p.ability, targets) + responseValue(idx, state, actor, p.life);
    if (!best || score > best.score) {
      best = { action: { ability: p.id, ...(targetUid ? { targetUid } : {}) }, score };
    }
  }
  if (!best) return undefined;
  // Ход не отдаётся за убыток ни при каких порогах: заряд, потраченный в
  // минус, хуже заряда, не потраченного вовсе.
  if (best.score <= 0) return undefined;

  // Порог падает по ходу боя: неиспользованный заряд к концу стоит ноль, а в
  // первом раунде он стоит дороже всего — там ещё не видно ни чужих посулов,
  // ни своих ран, и умение, чья цена растёт, сгорает впустую.
  //
  // Первый раунд отделён от второго-третьего по замеру. Ступень II Чистописца
  // мерилась НИЖЕ своей же ступени I (61% против 73%): расширение умения
  // поднимало его сиюминутную оценку ровно настолько, чтобы перейти порог в
  // первом раунде, и протокол ложился на ещё пустых врагов — а ступень I,
  // оценённая скромнее, дожидалась четвёртого раунда и била по живому.
  // Это была неспособность бота играть, а не свойство умения (§E.6).
  // Прямой запрет на первый раунд (ручка §D.6) замерен и отвергнут: он
  // выключал заряд и у тех умений, которым первый раунд как раз годится.
  const need = strikeValue * (state.round >= 4 ? 0.6 : state.round >= 2 ? 1.15 : 2.2);
  return best.score >= need ? best.action : undefined;
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
  // Очередь указывает в пустоту (юнит пал вне очереди хода, состояние пришло
  // из сейва или было поправлено эффектом) — раньше autoAct возвращал ТО ЖЕ
  // состояние, и runAuto молча крутил холостые итерации до maxSteps, отдавая
  // симулятору «ongoing». Передаём ход дальше — этим занимается act.
  if (!actor) return act(idx, state, { ability: '__pass__' });
  const plan = actor.side === 'enemy' && actor.intent
    ? { ability: actor.intent.ability, targetUid: actor.intent.targetUid }
    : planAction(idx, state, actor);
  if (!plan) {
    return act(idx, state, { ability: '__pass__' });
  }
  // Цель могла умереть до хода — переприцеливаемся. Способность берём
  // разобранной: у умения игрока `piercing` может быть добавлен усилением,
  // и запись из общего реестра дала бы неверный список законных целей.
  const ab = resolveAction(idx, state, actor, plan.ability)?.ability;
  const target = state.units.find((u) => u.uid === plan.targetUid);
  if (ab && (!target || !target.alive)) {
    const alt = legalTargets(state, actor.uid, ab).sort((a, b) => a.hp - b.hp)[0];
    return act(idx, state, { ability: plan.ability, targetUid: alt?.uid });
  }
  return act(idx, state, plan);
}

// ─────────────────────────────────────────────────────────────────────────────
// Панель умений игрока: что отдать клиенту
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Почему умение нельзя нажать прямо сейчас.
 * `revoked` тут нет намеренно: отнятое в бой не попадает вовсе, и его место —
 * на экране памяти (`derivePlayerPowers(...).revoked`), а не в панели боя.
 */
export type PlayerAbilityState =
  | { kind: 'ready' }
  | { kind: 'cooldown'; turns: number }
  | { kind: 'unavailable'; reason: 'battleOver' | 'notYourTurn' | 'noTargets' };

export interface PlayerAbilitySlot {
  power: PlayerAbility;
  state: PlayerAbilityState;
  /** Кто произнесёт умение, если нажать сейчас. */
  actorUid?: string;
  /** Законные цели — клиенту не надо звать legalTargets отдельно. */
  targets: string[];
}

/**
 * Состояние умений игрока для нижней панели. Чистая функция от состояния боя:
 * ничего не решает и ничего не меняет — клиент рисует ровно то, что здесь.
 *
 * Порядок стабилен (умения отсортированы ещё в `derivePlayerPowers`), поэтому
 * кнопки не прыгают между ходами.
 */
export function playerAbilityBar(state: BattleState): PlayerAbilitySlot[] {
  const loadout = state.player ?? EMPTY_LOADOUT;
  const actor = currentActor(state);
  const over = state.outcome !== 'ongoing';
  const mine = !over && actor?.side === 'player';
  // Пассив в панели не рисуется вовсе — у него нет кнопки (§B.3).
  return loadout.abilities.filter((p) => !p.ability.passive).map((power) => {
    const cd = loadout.cooldowns[power.id] ?? 0;
    if (over) return { power, state: { kind: 'unavailable', reason: 'battleOver' }, targets: [] };
    // Перезарядка называется раньше «не твой ход»: игрок и так видит, чей ход,
    // а вот сколько ждать умение — только здесь.
    if (cd > 0) return { power, state: { kind: 'cooldown', turns: cd }, targets: [] };
    if (!mine || !actor) return { power, state: { kind: 'unavailable', reason: 'notYourTurn' }, targets: [] };
    const targets = legalTargets(state, actor.uid, power.ability).map((u) => u.uid);
    if (targets.length === 0) {
      return { power, state: { kind: 'unavailable', reason: 'noTargets' }, actorUid: actor.uid, targets };
    }
    return { power, state: { kind: 'ready' }, actorUid: actor.uid, targets };
  });
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
