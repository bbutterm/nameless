/**
 * Чтение боя: всё, что движок считает, но игроку не показывал.
 *
 * Здесь нет ни одного нового правила — только пересказ того, что делает
 * `packages/engine/src/combat.ts`, в человеческих словах и числах:
 *   • сколько примерно снимет способность (та же формула, что в computeDamage,
 *     без броска: показываем края разброса ±12%);
 *   • что способность делает (тип цели, перезарядка, эффекты);
 *   • почему по конкретному врагу ударить нельзя (правило строя).
 *
 * Движок ради этого не тронут: всё нужное он уже отдаёт наружу
 * (`effectiveStat`, `ARMOR_K`, `DAMAGE_VARIANCE`, `legalTargets`).
 */
import {
  ARMOR_K,
  DAMAGE_VARIANCE,
  effectiveStat,
  type Ability,
  type BattleEffect,
  type BattleState,
  type BattleUnitState,
  type Lang,
  type TargetKind,
} from '@nameless/engine';
import { t } from '../i18n';

/** Что покажем прямо на карте цели, пока способность выбрана. */
export interface Preview {
  /** «12–16», «+9», «оглушение» — коротко, чтобы влезло в 69px карточки. */
  text: string;
  tone: 'damage' | 'heal' | 'effect';
  /** Нижний край урона уже убивает — цель добивается наверняка. */
  lethal?: boolean;
}

function damageEffects(ability: Ability): BattleEffect[] {
  // Тот же выбор, что в act(): свои эффекты, а без них — «просто урон по power».
  return ability.effects && ability.effects.length > 0
    ? ability.effects
    : [{ kind: 'damage', power: ability.power }];
}

/** Края разброса урона: min/max того же выражения, что считает computeDamage. */
export function damageRange(
  attacker: BattleUnitState,
  target: BattleUnitState,
  power: number,
): { min: number; max: number } {
  const atk = effectiveStat(attacker, 'atk');
  const def = effectiveStat(target, 'def');
  const mitigated = atk * power * (ARMOR_K / (ARMOR_K + def));
  return {
    min: Math.max(1, Math.round(mitigated * (1 - DAMAGE_VARIANCE))),
    max: Math.max(1, Math.round(mitigated * (1 + DAMAGE_VARIANCE))),
  };
}

/** Лечение разброса не имеет — движок считает его ровно. */
function healAmount(attacker: BattleUnitState, power: number): number {
  return Math.max(1, Math.round(effectiveStat(attacker, 'atk') * power));
}

/**
 * Что случится с этой целью. Урон — диапазоном, лечение — точным числом,
 * бездамажные способности — словом эффекта.
 */
export function previewFor(
  attacker: BattleUnitState,
  target: BattleUnitState,
  ability: Ability,
  lang: Lang,
): Preview | undefined {
  const effects = damageEffects(ability);
  const dmg = effects.find((e) => e.kind === 'damage');
  if (dmg && dmg.kind === 'damage' && dmg.power > 0) {
    const { min, max } = damageRange(attacker, target, dmg.power);
    // Щит цели съедает урон первым — иначе предпросмотр врёт на величину щита.
    const shield = target.statuses
      .filter((s) => s.kind === 'shield')
      .reduce((a, s) => a + s.amount, 0);
    const lethal = Math.max(0, min - shield) >= target.hp;
    return { text: min === max ? `${min}` : `${min}–${max}`, tone: 'damage', lethal };
  }
  const heal = effects.find((e) => e.kind === 'heal');
  if (heal && heal.kind === 'heal') {
    return { text: `+${healAmount(attacker, heal.power)}`, tone: 'heal' };
  }
  const first = effects[0];
  if (!first) return undefined;
  return { text: effectWord(first, lang), tone: 'effect' };
}

function statWord(stat: 'atk' | 'def' | 'initiative', lang: Lang): string {
  return stat === 'atk' ? t(lang, 'statAtk') : stat === 'def' ? t(lang, 'statDef') : t(lang, 'statInit');
}

/** Одно короткое слово на эффект — для чипа под панелью и для предпросмотра. */
export function effectWord(eff: BattleEffect, lang: Lang): string {
  switch (eff.kind) {
    case 'damage':
      return t(lang, 'damageWord');
    case 'heal':
      return t(lang, 'healsWord');
    case 'shield':
      return `${t(lang, 'effShield')} ${eff.amount}`;
    case 'buff':
      return `+${statWord(eff.stat, lang)} ${eff.amount}`;
    case 'debuff':
      return `−${statWord(eff.stat, lang)} ${eff.amount}`;
    case 'dot':
      return `${t(lang, 'effDot')} ${eff.amount}×${eff.turns}`;
    case 'stun':
      return `${t(lang, 'effStun')} ${eff.turns}`;
    case 'cleanse':
      return t(lang, 'effCleanse');
    case 'revive':
      return t(lang, 'effRevive');
    default:
      return '';
  }
}

export function targetWord(kind: TargetKind, lang: Lang): string {
  switch (kind) {
    case 'enemy_front':
      return t(lang, 'targetFront');
    case 'enemy_any':
      return t(lang, 'targetAny');
    case 'enemy_row':
      return t(lang, 'targetRow');
    case 'enemy_all':
      return t(lang, 'targetAll');
    case 'ally_one':
      return t(lang, 'targetAlly');
    case 'ally_all':
      return t(lang, 'targetAllies');
    case 'self':
      return t(lang, 'targetSelf');
    default:
      return '';
  }
}

/** Чипы разбора способности: куда бьёт, как часто, что оставляет после себя. */
export function abilityChips(ability: Ability, lang: Lang): string[] {
  const chips = [targetWord(ability.target, lang)];
  if (ability.piercing) chips.push(t(lang, 'piercing'));
  chips.push(ability.cooldown > 0 ? `${t(lang, 'cooldownN')} ${ability.cooldown}` : t(lang, 'everyTurn'));
  for (const eff of ability.effects ?? []) {
    // Урон уже показан диапазоном на самих картах — в чипах он лишний.
    if (eff.kind === 'damage') continue;
    const word = effectWord(eff, lang);
    if (word) chips.push(word);
  }
  return chips;
}

/**
 * Общий разброс урона выбранной способности по всем законным целям —
 * строка вида «урон 12–17» над панелью, до того как цель выбрана.
 */
export function spanOverTargets(
  attacker: BattleUnitState,
  targets: BattleUnitState[],
  ability: Ability,
  lang: Lang,
): string | undefined {
  const dmg = damageEffects(ability).find((e) => e.kind === 'damage');
  if (!dmg || dmg.kind !== 'damage' || dmg.power <= 0 || targets.length === 0) return undefined;
  let min = Infinity;
  let max = 0;
  for (const tg of targets) {
    const r = damageRange(attacker, tg, dmg.power);
    min = Math.min(min, r.min);
    max = Math.max(max, r.max);
  }
  return `${t(lang, 'damageWord')} ${min === max ? min : `${min}–${max}`}`;
}

/**
 * Почему по этому не ударить. Правило строя раньше проявлялось только тем,
 * что карта не реагировала на тап — игрок не понимал, сломалась игра или нет.
 * Формулировка ровно про ту ветку `legalTargets`, которая цель отсеяла.
 */
export function blockReason(
  state: BattleState,
  actor: BattleUnitState,
  ability: Ability,
  target: BattleUnitState,
  lang: Lang,
): string {
  const hitsFoes =
    ability.target === 'enemy_front' ||
    ability.target === 'enemy_any' ||
    ability.target === 'enemy_row' ||
    ability.target === 'enemy_all';
  if (hitsFoes && target.side === actor.side) return t(lang, 'allyReason');
  if (isCovered(state, actor, ability, target)) return t(lang, 'coveredReason');
  return t(lang, 'notATarget');
}

/** Цель закрыта живым передним рядом — та самая ветка `enemy_front`. */
export function isCovered(
  state: BattleState,
  actor: BattleUnitState,
  ability: Ability,
  target: BattleUnitState,
): boolean {
  if (ability.target !== 'enemy_front' || ability.piercing) return false;
  if (target.side === actor.side || target.row !== 'back' || !target.alive) return false;
  return state.units.some((u) => u.alive && u.side === target.side && u.row === 'front');
}
