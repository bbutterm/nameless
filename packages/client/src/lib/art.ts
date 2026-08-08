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

/** Детерминированный хэш строки — сид процедурной графики. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rand(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const TIER_COLORS = ['#6b6470', '#a8935c', '#8fd6d1'];

/**
 * Портрет-силуэт: капюшон, плечи, пустота вместо лица.
 * Лиц здесь нет намеренно — в Закладе не помнят лиц.
 */
export function portraitSvg(id: string, accent = '#9a90a0'): string {
  const r = rand(hash(id));
  const hoodW = 46 + r() * 16;
  const shoulder = 74 + r() * 20;
  const tilt = (r() - 0.5) * 8;
  const headY = 44 + r() * 6;
  const bg1 = `hsl(${(hash(id) % 40) + 260}, 12%, 12%)`;
  const bg2 = `hsl(${(hash(id) % 40) + 250}, 14%, 7%)`;
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <linearGradient id="g${hash(id)}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" fill="url(#g${hash(id)})"/>
  <g transform="rotate(${tilt.toFixed(2)} 60 70)" fill="${accent}" opacity="0.75">
    <path d="M60 ${headY - 22} C ${60 - hoodW / 2} ${headY - 20}, ${60 - hoodW / 2} ${headY + 18}, 60 ${headY + 22}
             C ${60 + hoodW / 2} ${headY + 18}, ${60 + hoodW / 2} ${headY - 20}, 60 ${headY - 22} Z"/>
    <path d="M${60 - shoulder / 2} 120 C ${60 - shoulder / 2} ${86 + r() * 8}, ${60 + shoulder / 2} ${86 + r() * 8}, ${60 + shoulder / 2} 120 Z"/>
  </g>
  <ellipse cx="60" cy="${headY + 2}" rx="${(hoodW / 2 - 8).toFixed(1)}" ry="14" fill="#0d0b0e" opacity="0.85"/>
</svg>`;
}

/** Арт карточки юнита 3:4 — фигура и рамка тира. */
export function unitCardSvg(id: string, tier: 1 | 2 | 3): string {
  const r = rand(hash(`card:${id}`));
  const frame = TIER_COLORS[tier - 1] ?? TIER_COLORS[0];
  const hue = (hash(id) % 60) + 240;
  const w = 90;
  const h = 120;
  const bodyW = 30 + r() * 14;
  const headR = 9 + r() * 3;
  const armY = 62 + r() * 8;
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <linearGradient id="b${hash(id)}" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="hsl(${hue},14%,15%)"/>
      <stop offset="1" stop-color="hsl(${hue},16%,8%)"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" rx="6" fill="url(#b${hash(id)})"/>
  <g fill="${frame}" opacity="0.7">
    <circle cx="${w / 2}" cy="${38 + r() * 4}" r="${headR.toFixed(1)}"/>
    <path d="M${w / 2 - bodyW / 2} ${h - 8} L${w / 2 - bodyW / 2 + 4} ${armY} Q${w / 2} ${armY - 14} ${w / 2 + bodyW / 2 - 4} ${armY} L${w / 2 + bodyW / 2} ${h - 8} Z"/>
  </g>
  <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="5" fill="none" stroke="${frame}" stroke-width="${tier}" opacity="0.9"/>
</svg>`;
}

/** Абстрактный фон сцены: сваи, вода, вечерний свет. */
export function backgroundSvg(seed: string): string {
  const r = rand(hash(seed));
  const hue = (hash(seed) % 50) + 245;
  const piles = Array.from({ length: 7 }, (_, i) => {
    const x = 10 + i * 58 + r() * 24;
    const top = 120 + r() * 90;
    return `<rect x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${(6 + r() * 6).toFixed(0)}" height="${(400 - top).toFixed(0)}" fill="hsl(${hue},10%,6%)" opacity="0.7"/>`;
  }).join('');
  return `<svg viewBox="0 0 390 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="s${hash(seed)}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue},18%,13%)"/>
      <stop offset="0.6" stop-color="hsl(${hue},14%,8%)"/>
      <stop offset="1" stop-color="#0d0b0e"/>
    </linearGradient>
  </defs>
  <rect width="390" height="400" fill="url(#s${hash(seed)})"/>
  ${piles}
</svg>`;
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
