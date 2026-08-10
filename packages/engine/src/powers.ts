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
  MemoryId,
  PlayerAbility,
  PlayerPowerSet,
  RevokedPlayerAbility,
} from './types.js';

/** Нейтральное усиление: применение к умению ничего не меняет. */
export const NO_AMPLIFY: Required<AbilityAmplify> = {
  power: 0,
  cooldown: 0,
  effectScale: 1,
  turns: 0,
  piercing: false,
};

/**
 * Складывает два усиления. Операция коммутативна и ассоциативна по каждому
 * полю — на этом держится независимость итога от порядка закрепления.
 */
export function mergeAmplify(a: AbilityAmplify, b: AbilityAmplify): Required<AbilityAmplify> {
  return {
    power: (a.power ?? 0) + (b.power ?? 0),
    cooldown: (a.cooldown ?? 0) + (b.cooldown ?? 0),
    effectScale: (a.effectScale ?? 1) * (b.effectScale ?? 1),
    turns: (a.turns ?? 0) + (b.turns ?? 0),
    piercing: (a.piercing ?? false) || (b.piercing ?? false),
  };
}

function scaleEffect(eff: BattleEffect, scale: number, turns: number): BattleEffect {
  // Длительность правится только там, где она есть; `cleanse` не имеет ни
  // чисел, ни срока — усиливать в нём нечего, и это не ошибка контента.
  const t = (v: number): number => Math.max(1, Math.round(v + turns));
  switch (eff.kind) {
    case 'damage':
    case 'heal':
      return { ...eff, power: eff.power * scale };
    case 'shield':
      return { ...eff, amount: Math.max(0, Math.round(eff.amount * scale)), turns: t(eff.turns) };
    case 'buff':
    case 'debuff':
      return { ...eff, amount: Math.max(0, Math.round(eff.amount * scale)), turns: t(eff.turns) };
    case 'dot':
      return { ...eff, amount: Math.max(0, Math.round(eff.amount * scale)), turns: t(eff.turns) };
    case 'stun':
      return { ...eff, turns: t(eff.turns) };
    case 'revive':
      return { ...eff, hpPercent: Math.min(1, Math.max(0, eff.hpPercent * scale)) };
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
    a.power === 0 && a.cooldown === 0 && a.effectScale === 1 && a.turns === 0 && !a.piercing;
  if (untouched) return base;
  const next: Ability = {
    ...base,
    power: Math.max(0, base.power + a.power),
    cooldown: Math.max(0, Math.round(base.cooldown + a.cooldown)),
  };
  if (a.piercing) next.piercing = true;
  if (base.effects && (a.effectScale !== 1 || a.turns !== 0)) {
    next.effects = base.effects.map((e) => scaleEffect(e, a.effectScale, a.turns));
  }
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

  const grants = new Map<AbilityId, { by: MemoryId[]; costsTurn: boolean }>();
  const amps = new Map<AbilityId, { by: MemoryId[]; amp: Required<AbilityAmplify> }>();
  const revokes = new Map<AbilityId, { by: MemoryId[]; note?: RevokedPlayerAbility['note'] }>();

  for (const mid of ids) {
    const memory = memoryById.get(mid);
    if (!memory?.powers) continue;
    for (const p of memory.powers) {
      switch (p.kind) {
        case 'grant': {
          const cur = grants.get(p.ability) ?? { by: [], costsTurn: false };
          cur.by.push(mid);
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
    abilities.push({
      id,
      ability: amplifyAbility(base, amp?.amp ?? NO_AMPLIFY),
      grantedBy: [...grant.by].sort(),
      amplifiedBy: [...(amp?.by ?? [])].sort(),
      amplify: amp?.amp ?? { ...NO_AMPLIFY },
      costsTurn: grant.costsTurn,
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
