/**
 * Умения игрока: вывод из закреплённых воспоминаний.
 *
 * Умения — ПРОИЗВОДНАЯ величина. В `GameState` они не лежат и лежать не будут:
 * единственный источник правды — `lockedMemories` плюс контент. Отсюда два
 * следствия, ради которых всё и затевалось:
 * - версия сейва не двигается, и старое прохождение ничего не теряет;
 * - невозможно состояние «в сейве умение есть, а воспоминания под ним нет».
 */
import type {
  Ability,
  AbilityAmplify,
  AbilityId,
  BattleEffect,
  ContentBundle,
  LifeId,
  MemoryId,
  PlayerAbility,
  PlayerPowerSet,
  RevokedPlayerAbility,
  TargetKind,
} from './types.js';

/**
 * Свёрнутое усиление. От `Required<AbilityAmplify>` отличается одним: цель
 * может остаться незаданной — «умение бьёт туда же, куда и раньше» не
 * выражается никаким значением `TargetKind`.
 */
export type MergedAmplify = Omit<Required<AbilityAmplify>, 'target'> & { target?: TargetKind };

/** Нейтральное усиление: применение к умению ничего не меняет. */
export const NO_AMPLIFY: MergedAmplify = {
  power: 0,
  cooldown: 0,
  effectScale: 1,
  effectAmount: 0,
  turns: 0,
  piercing: false,
  addEffects: [],
};

/**
 * Ширина цели. Нужна ровно для одного: свести две поправки цели в одну так,
 * чтобы результат не зависел от порядка. «Шире» — единственное направление,
 * в котором ступени умений двигаются (один → ряд → все), поэтому максимум по
 * ширине и есть коммутативная свёртка.
 */
const TARGET_BREADTH: Record<TargetKind, number> = {
  self: 0,
  ally_one: 1,
  enemy_front: 1,
  enemy_any: 1,
  ally_row: 2,
  enemy_row: 2,
  ally_all: 3,
  enemy_all: 3,
};

function widerTarget(a: TargetKind | undefined, b: TargetKind | undefined): TargetKind | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  const da = TARGET_BREADTH[a];
  const db = TARGET_BREADTH[b];
  if (da !== db) return da > db ? a : b;
  // Одинаковая ширина, разные цели — контент противоречив (это ловит
  // валидатор). Движку остаётся выбрать детерминированно: обычное строковое
  // сравнение, НЕ localeCompare — бой обязан совпадать на телефоне и в симуляторе.
  return a < b ? a : b;
}

/** Стабильный ключ эффекта — только для сортировки добавленных эффектов. */
function effectKey(e: BattleEffect): string {
  return JSON.stringify(e, Object.keys(e).sort());
}

/**
 * Складывает два усиления. Операция коммутативна и ассоциативна по каждому
 * полю — на этом держится независимость итога от порядка закрепления.
 */
export function mergeAmplify(a: AbilityAmplify, b: AbilityAmplify): MergedAmplify {
  const addEffects = [...(a.addEffects ?? []), ...(b.addEffects ?? [])].sort((x, y) => {
    const kx = effectKey(x);
    const ky = effectKey(y);
    return kx < ky ? -1 : kx > ky ? 1 : 0;
  });
  return {
    power: (a.power ?? 0) + (b.power ?? 0),
    cooldown: (a.cooldown ?? 0) + (b.cooldown ?? 0),
    effectScale: (a.effectScale ?? 1) * (b.effectScale ?? 1),
    effectAmount: (a.effectAmount ?? 0) + (b.effectAmount ?? 0),
    turns: (a.turns ?? 0) + (b.turns ?? 0),
    piercing: (a.piercing ?? false) || (b.piercing ?? false),
    target: widerTarget(a.target, b.target),
    addEffects,
  };
}

function scaleEffect(
  eff: BattleEffect,
  scale: number,
  amount: number,
  turns: number,
): BattleEffect {
  // Длительность правится только там, где она есть; `cleanse` не имеет ни
  // чисел, ни срока — усиливать в нём нечего, и это не ошибка контента.
  const t = (v: number): number => Math.max(1, Math.round(v + turns));
  const n = (v: number): number => Math.max(0, Math.round(v * scale + amount));
  switch (eff.kind) {
    case 'damage':
    case 'heal':
      return { ...eff, power: eff.power * scale };
    case 'heal_flat':
      return { ...eff, amount: n(eff.amount) };
    case 'shield':
      return { ...eff, amount: n(eff.amount), turns: t(eff.turns) };
    case 'buff':
    case 'debuff':
      return { ...eff, amount: n(eff.amount), turns: t(eff.turns) };
    case 'dot':
      return { ...eff, amount: n(eff.amount), turns: t(eff.turns) };
    case 'stun':
    case 'recorded':
      return { ...eff, turns: t(eff.turns) };
    // Заслон — общее действие правил боя, а не умение памяти: усиливать его
    // ступенью нельзя в принципе, и «поручительство на два раунда» отменило бы
    // его цену — размен решается заново каждый раунд (DIRECTION_COMBAT §B.C1).
    case 'cover':
      return eff;
    case 'revive':
      return { ...eff, hpPercent: Math.min(1, Math.max(0, eff.hpPercent * scale)) };
    case 'rally':
      return { ...eff, amount: n(eff.amount), turns: t(eff.turns) };
    case 'spare_worst_foe':
      return { ...eff, amount: n(eff.amount) };
    // Цена и режимы усилению не подлежат. `heal_tax` — плата за одержимость
    // учётом, и «усиленная плата» была бы двойным наказанием за одну зарубку;
    // `bare_truth` — цена вершины Чистописца, у неё нет чисел вовсе, как и у
    // `reveal`, `purge`, `cleanse`, `shield_refund`.
    case 'heal_tax':
    case 'bare_truth':
    case 'reveal':
    case 'purge':
    case 'shield_refund':
    case 'cleanse':
      return eff;
    default: {
      const _exhaustive: never = eff;
      void _exhaustive;
      return eff;
    }
  }
}

/** Способность с вложенным усилением. Исходная запись реестра не трогается. */
export function amplifyAbility(base: Ability, amp: AbilityAmplify): Ability {
  const a = mergeAmplify(NO_AMPLIFY, amp);
  const untouched =
    a.power === 0 &&
    a.cooldown === 0 &&
    a.effectScale === 1 &&
    a.effectAmount === 0 &&
    a.turns === 0 &&
    !a.piercing &&
    !a.target &&
    a.addEffects.length === 0;
  if (untouched) return base;
  const next: Ability = {
    ...base,
    power: Math.max(0, base.power + a.power),
    cooldown: Math.max(0, Math.round(base.cooldown + a.cooldown)),
  };
  if (a.piercing) next.piercing = true;
  if (a.target) next.target = a.target;
  const scaled =
    base.effects && (a.effectScale !== 1 || a.effectAmount !== 0 || a.turns !== 0)
      ? base.effects.map((e) => scaleEffect(e, a.effectScale, a.effectAmount, a.turns))
      : base.effects;
  if (a.addEffects.length > 0) next.effects = [...(scaled ?? []), ...a.addEffects];
  else if (scaled) next.effects = scaled;
  return next;
}

/**
 * Умения игрока по списку закреплённых воспоминаний.
 *
 * ПОРЯДОК ЗАКРЕПЛЕНИЯ НЕ ВЛИЯЕТ НА ИТОГ. Это обещание, а не побочный эффект:
 * - «дать» — объединение множеств по id умения;
 * - «усилить» — коммутативная свёртка (`mergeAmplify`);
 * - «отнять» побеждает «дать» ВСЕГДА, а не «побеждает то, что позже»;
 * - выход отсортирован по id умения, а списки-источники — по id воспоминания.
 *
 * Если канон когда-нибудь потребует порядка («второе воспоминание переписывает
 * первое»), менять надо ровно это место и ровно этот комментарий: правило
 * «отнятое не возвращается» придётся заменить на разбор истории закреплений,
 * а `lockedMemories` — начать читать как хронологию, а не как множество.
 * Сегодня он читается как множество, и все тесты на это опираются.
 *
 * Дубликаты во входе игнорируются: закрепить воспоминание дважды нельзя,
 * но сейв, побывавший в чужих руках, такое содержать может.
 */
export function derivePlayerPowers(
  lockedMemories: readonly MemoryId[],
  content: Pick<ContentBundle, 'memories' | 'abilities'>,
): PlayerPowerSet {
  const memoryById = new Map(content.memories.map((m) => [m.id, m]));
  const abilityById = new Map(content.abilities.map((a) => [a.id, a]));

  // Сортировка обычная строковая, НЕ localeCompare: тот зависит от локали
  // среды, а бой обязан воспроизводиться одинаково на телефоне и в симуляторе.
  const ids = [...new Set(lockedMemories)].sort();

  const grants = new Map<AbilityId, { by: MemoryId[]; costsTurn: boolean; life?: LifeId }>();
  const amps = new Map<AbilityId, { by: MemoryId[]; amp: MergedAmplify }>();
  const revokes = new Map<AbilityId, { by: MemoryId[]; note?: RevokedPlayerAbility['note'] }>();

  for (const mid of ids) {
    const memory = memoryById.get(mid);
    if (!memory?.powers) continue;
    for (const p of memory.powers) {
      switch (p.kind) {
        case 'grant': {
          const cur = grants.get(p.ability) ?? { by: [], costsTurn: false, life: memory.life };
          cur.by.push(mid);
          // Жизнь берётся у первого по id воспоминания-донора (`ids` уже
          // отсортирован), поэтому не зависит от порядка закрепления. Если
          // умение дали воспоминания РАЗНЫХ жизней — это ошибка контента, и
          // краснит её валидатор; движок молча берёт первую.
          cur.life = cur.life ?? memory.life;
          // Логическое ИЛИ (коммутативно, как и всё здесь): если хотя бы одно
          // воспоминание объявило умение платным, оно платное. Два разошедшихся
          // воспоминания разрешаются в сторону, где бой точно не зациклится.
          cur.costsTurn = cur.costsTurn || p.costsTurn !== false;
          grants.set(p.ability, cur);
          break;
        }
        case 'amplify': {
          const cur = amps.get(p.ability) ?? { by: [], amp: { ...NO_AMPLIFY } };
          cur.by.push(mid);
          cur.amp = mergeAmplify(cur.amp, p.amplify);
          amps.set(p.ability, cur);
          break;
        }
        case 'revoke': {
          const cur = revokes.get(p.ability) ?? { by: [], note: p.note };
          cur.by.push(mid);
          if (!cur.note && p.note) cur.note = p.note;
          revokes.set(p.ability, cur);
          break;
        }
        default: {
          const _exhaustive: never = p;
          void _exhaustive;
        }
      }
    }
  }

  const abilities: PlayerAbility[] = [];
  for (const [id, grant] of grants) {
    if (revokes.has(id)) continue;
    const base = abilityById.get(id);
    // Умение, которого нет в реестре, молча выпадает: движку его нечем
    // исполнить. Ошибку об этом печатает валидатор контента — здесь падать
    // нельзя, иначе битый контент ронял бы бой на телефоне игрока.
    if (!base) continue;
    const amp = amps.get(id);
    // Ступень — СЧЁТЧИК закреплённых воспоминаний этой жизни, а не конкретный
    // id (MEMORY_POWERS §A.1). Дающее считается вместе с усиливающими: одно
    // воспоминание — ступень I, два — II, три — III. Рассинхрон «ступень II
    // без ступени I» невозможен по устройству: без grant умения нет вовсе.
    const tier = new Set([...grant.by, ...(amp?.by ?? [])]).size;
    abilities.push({
      id,
      ability: amplifyAbility(base, amp?.amp ?? NO_AMPLIFY),
      grantedBy: [...grant.by].sort(),
      amplifiedBy: [...(amp?.by ?? [])].sort(),
      amplify: amp?.amp ?? { ...NO_AMPLIFY },
      costsTurn: grant.costsTurn,
      ...(grant.life ? { life: grant.life } : {}),
      tier,
    });
  }
  abilities.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const revoked: RevokedPlayerAbility[] = [...revokes.entries()]
    .map(([id, r]) => ({
      id,
      by: [...r.by].sort(),
      ...(r.note ? { note: r.note } : {}),
      wasGranted: grants.has(id),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { abilities, revoked };
}
