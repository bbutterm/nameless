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

export function cardImage(unitId: string): string | undefined {
  return cardArt.get(unitId);
}

export function portraitImage(speakerId: string): string | undefined {
  return portraitArt.get(speakerId) ?? cardArt.get(speakerId);
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
