/**
 * Арт-слоты. Пользователь кладёт свои картинки в packages/content/assets/cards/
 * с именем файла = id юнита — и они молча вытесняют процедурную заглушку.
 * Ничего перекомпилировать не нужно: Vite подхватывает папку при сборке.
 */

const cardFiles = import.meta.glob('../../../content/assets/cards/*.{webp,png,jpg,jpeg,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const backgroundFiles = import.meta.glob('../../../content/assets/backgrounds/*.{webp,png,jpg,jpeg,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const portraitFiles = import.meta.glob('../../../content/assets/portraits/*.{webp,png,jpg,jpeg,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function indexByBasename(files: Record<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [path, url] of Object.entries(files)) {
    const base = path.split('/').pop() ?? '';
    const id = base.replace(/\.[^.]+$/, '');
    out.set(id, url);
  }
  return out;
}

const cardArt = indexByBasename(cardFiles);
const portraitArt = indexByBasename(portraitFiles);
const backgroundArt = indexByBasename(backgroundFiles);

/**
 * Фон арены или сцены. Имя файла — id боя (`battle_wall_crew`), id сцены
 * (`pier_dust`) или ключ места (`vault`, `gate`): ищем от частного к общему,
 * чтобы одной картинкой можно было закрыть все подвалы разом, а потом при
 * желании переопределить конкретный бой.
 */
export function backgroundImage(...keys: string[]): string | undefined {
  for (const k of keys) {
    const hit = backgroundArt.get(k);
    if (hit) return hit;
  }
  return undefined;
}

export function cardImage(unitId: string): string | undefined {
  return cardArt.get(unitId);
}

/**
 * Говорящие, которые ЕСТЬ в ростере под другим id: рисовать им отдельный
 * портрет незачем — на карте юнита нарисован тот же человек. Список короткий
 * и ведётся руками нарочно: совпадение имён проверяет человек, а не regexp,
 * иначе «Оценщик» однажды приклеится не к тому оценщику.
 */
const PORTRAIT_FROM_CARD: Record<string, string> = {
  otsenshchik: 'pawn_appraiser_dusk',
  yamshchik_gonby: 'relay_driver',
  bagorshchik_sluzy: 'hook_man',
};

export function portraitImage(speakerId: string): string | undefined {
  const alias = PORTRAIT_FROM_CARD[speakerId];
  return portraitArt.get(speakerId) ?? cardArt.get(speakerId) ?? (alias ? cardArt.get(alias) : undefined);
}

/**
 * Процедурные заглушки живут в пакете контента (`assets/procedural/procedural.ts`) —
 * там же, где палитра и образцы. Клиент только подставляет их, когда пользователь
 * ещё не положил свой арт в assets/cards/.
 */
export { PALETTE, hashString as hash, iconSvg, frameSvg } from '@nameless/content/procedural';
import {
  backgroundSvg as genBackground,
  portraitSvg as genPortrait,
  unitCardSvg as genUnitCard,
} from '@nameless/content/procedural';

export function portraitSvg(id: string): string {
  return genPortrait(id);
}

export function unitCardSvg(id: string, tier: 1 | 2 | 3, faction = 'street'): string {
  return genUnitCard(id, tier, faction);
}

export function backgroundSvg(seed: string, tone?: string): string {
  return genBackground(seed, tone);
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
