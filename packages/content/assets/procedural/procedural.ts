/**
 * procedural.ts — детерминированная процедурная графика-заглушка для «Безымянного».
 *
 * Никаких зависимостей, никакого Math.random(). Один и тот же id/seed всегда
 * даёт один и тот же SVG (важно для кеширования на клиенте и для тестов).
 *
 * Экспорты:
 *   - PALETTE          — единая палитра проекта (дублирует palette.css)
 *   - hashString        — детерминированный 32-битный хэш строки
 *   - portraitSvg        — портрет-силуэт NPC, 1:1
 *   - unitCardSvg        — арт карточки юнита, 3:4
 *   - iconSvg            — 24 базовые иконки способностей, 24×24
 *   - frameSvg            — декоративная рамка карты по тиру
 *   - backgroundSvg        — абстрактный фон сцены (диалог/бой)
 *
 * Все функции — чистые (pure): не читают и не пишут внешнее состояние.
 */

// ---------------------------------------------------------------------------
// Палитра
// ---------------------------------------------------------------------------

export interface Palette {
  bg0: string;
  bg1: string;
  bg2: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  danger: string;
  memory: string;
  lie: string;
  gold: string;
  hpAlly: string;
  hpEnemy: string;
  tier1: string;
  tier2: string;
  tier3: string;
}

/**
 * Единая палитра проекта. Значения совпадают с /assets/palette.css
 * (переменные --bg-0..2, --surface, --text, --text-dim, --accent, --danger,
 * --memory, --lie, --gold, --hp-ally, --hp-enemy, --tier-1..3), которая в свою
 * очередь согласована по именам и цвету с `packages/client/src/theme.css`.
 */
export const PALETTE: Palette = {
  bg0: "#0d0b0e",
  bg1: "#151219",
  bg2: "#1e1a22",
  surface: "#241f29",
  text: "#e8e2ea",
  textMuted: "#9a90a0",
  accent: "#c9a227",
  danger: "#c1483f",
  memory: "#7fd3d0",
  lie: "#b06fd0",
  gold: "#d8b34a",
  hpAlly: "#6fbf73",
  hpEnemy: "#b8574e",
  tier1: "#6b6470",
  tier2: "#a8935c",
  tier3: "#8fd6d1",
};

// ---------------------------------------------------------------------------
// Детерминированный хэш и псевдослучайность
// ---------------------------------------------------------------------------

/**
 * 32-битный хэш строки (вариант FNV-1a). Детерминированный, без Math.random.
 * Одинаковая строка → одинаковое число всегда, в любой среде.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619 (FNV prime), через сдвиги — без переполнения в 32 бита
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Простой детерминированный генератор [0,1) на базе seed (mulberry32). */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Rng {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  bool(chance?: number): boolean;
}

function rngFromSeed(seedStr: string): Rng {
  const next = makeRng(hashString(seedStr));
  return {
    next,
    range(min: number, max: number): number {
      return min + next() * (max - min);
    },
    int(min: number, max: number): number {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick<T>(arr: readonly T[]): T {
      const idx = Math.floor(next() * arr.length) % arr.length;
      // noUncheckedIndexedAccess: arr гарантированно непустой на всех вызовах ниже
      return arr[idx] as T;
    },
    bool(chance = 0.5): boolean {
      return next() < chance;
    },
  };
}

// ---------------------------------------------------------------------------
// Общие утилиты SVG
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/** Затемнить/осветлить hex-цвет на amount ∈ [-1,1] (детерминированно, без внешних либ). */
function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1] as string, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const adjust = (c: number): number => {
    const v = amount >= 0 ? c + (255 - c) * amount : c + c * amount;
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  r = adjust(r);
  g = adjust(g);
  b = adjust(b);
  const hx = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

/** Хэш строки → hue [0,360) для мягкой цветовой вариации силуэтов. */
function hueFromSeed(rng: Rng): number {
  return Math.floor(rng.next() * 360);
}

function hsl(h: number, s: number, l: number, a = 1): string {
  return a >= 1 ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${a})`;
}

// ---------------------------------------------------------------------------
// portraitSvg — портрет-силуэт NPC, 1:1
// ---------------------------------------------------------------------------

/**
 * Портрет NPC 1:1: капюшон/голова/плечи, без лица — стилизованная тень.
 * Очертания варьируются по id (детерминированно).
 */
export function portraitSvg(id: string, palette: Palette = PALETTE): string {
  const rng = rngFromSeed(`portrait:${id}`);
  const size = 256;
  const hue = hueFromSeed(rng);
  const bgTint = hsl(hue, 18, 12);
  const bgTint2 = hsl(hue, 22, 7);
  const silhouette = shade(palette.bg2, -0.55);

  const hoodPeak = rng.range(0.28, 0.5) * size; // насколько капюшон возвышается над плечами
  const hoodWidth = rng.range(0.34, 0.44) * size;
  const shoulderWidth = rng.range(0.62, 0.86) * size;
  const asym = rng.range(-0.06, 0.06) * size; // асимметрия наклона капюшона
  const cx = size / 2;
  const shoulderY = size * 0.78;
  const hoodTipY = size * 0.5 - hoodPeak * 0.55;

  const hasGlow = rng.bool(0.55);
  const glowColor = rng.pick([palette.memory, palette.accent, palette.lie, palette.danger] as const);
  const eyeCount = rng.bool(0.2) ? 1 : 2;
  const eyeY = size * 0.6 + rng.range(-6, 10);
  const eyeGap = rng.range(10, 18);

  const hasTrinket = rng.bool(0.4);
  const trinketColor = rng.pick([palette.gold, palette.memory, palette.lie] as const);

  const cloakPath = `
    M ${cx - shoulderWidth / 2} ${shoulderY}
    C ${cx - shoulderWidth / 2 - 6} ${shoulderY - size * 0.1}, ${cx - hoodWidth / 2 + asym} ${hoodTipY + size * 0.18}, ${cx - hoodWidth / 2 + asym} ${hoodTipY + size * 0.06}
    Q ${cx + asym * 0.4} ${hoodTipY} ${cx + hoodWidth / 2 + asym} ${hoodTipY + size * 0.06}
    C ${cx + hoodWidth / 2 + asym} ${hoodTipY + size * 0.18}, ${cx + shoulderWidth / 2 + 6} ${shoulderY - size * 0.1}, ${cx + shoulderWidth / 2} ${shoulderY}
    L ${cx + shoulderWidth / 2} ${size}
    L ${cx - shoulderWidth / 2} ${size}
    Z
  `;

  const innerHoodPath = `
    M ${cx - hoodWidth * 0.32 + asym} ${hoodTipY + size * 0.22}
    Q ${cx + asym * 0.3} ${hoodTipY + size * 0.1} ${cx + hoodWidth * 0.32 + asym} ${hoodTipY + size * 0.22}
    Q ${cx + asym * 0.2} ${hoodTipY + size * 0.42} ${cx} ${hoodTipY + size * 0.5}
    Q ${cx - asym * 0.2} ${hoodTipY + size * 0.42} ${cx - hoodWidth * 0.32 + asym} ${hoodTipY + size * 0.22}
    Z
  `;

  const eyes: string[] = [];
  if (hasGlow) {
    if (eyeCount === 2) {
      eyes.push(
        `<circle cx="${cx - eyeGap / 2}" cy="${eyeY}" r="2.6" fill="${glowColor}" opacity="0.9"/>`,
        `<circle cx="${cx + eyeGap / 2}" cy="${eyeY}" r="2.6" fill="${glowColor}" opacity="0.9"/>`,
      );
    } else {
      eyes.push(`<circle cx="${cx}" cy="${eyeY}" r="3.2" fill="${glowColor}" opacity="0.9"/>`);
    }
  }

  const trinket = hasTrinket
    ? `<circle cx="${cx}" cy="${shoulderY - 6}" r="4" fill="${trinketColor}" opacity="0.85"/>
       <line x1="${cx}" y1="${hoodTipY + size * 0.5}" x2="${cx}" y2="${shoulderY - 10}" stroke="${trinketColor}" stroke-width="1" opacity="0.5"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="portrait ${escapeXml(id)}">
  <defs>
    <radialGradient id="pg-${escapeXml(id)}" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="${bgTint}"/>
      <stop offset="100%" stop-color="${bgTint2}"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#pg-${escapeXml(id)})"/>
  <path d="${cloakPath}" fill="${silhouette}"/>
  <path d="${innerHoodPath}" fill="${palette.bg0}" opacity="0.55"/>
  ${trinket}
  ${eyes.join("\n  ")}
</svg>`;
}

// ---------------------------------------------------------------------------
// iconSvg — 24 базовые иконки способностей, 24×24
// ---------------------------------------------------------------------------

const ICON_NAMES = [
  "sword",
  "bow",
  "staff",
  "shield",
  "poison",
  "stun",
  "heal",
  "fire",
  "ice",
  "blood",
  "eye",
  "chain",
  "bone",
  "coin",
  "candle",
  "key",
  "lock",
  "skull",
  "wing",
  "hammer",
  "dagger",
  "book",
  "hourglass",
  "heart",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** Список поддерживаемых имён иконок (для UI-подсказок/тестов). */
export const ICON_NAMES_LIST: readonly IconName[] = ICON_NAMES;

const ICON_PATHS: Record<IconName, string> = {
  sword: `<path d="M5.5 18.5 16 8"/><path d="M13.2 5.2 18.8 10.8"/><path d="M11 7.4 16.6 13"/><path d="M4 20l1.8-1.8"/><path d="M17.5 4.5l2 2"/>`,
  bow: `<path d="M7 3.5c-2.5 3-2.5 14 0 17"/><path d="M7 3.5 19 12 7 20.5"/><path d="M7 12h12"/>`,
  staff: `<path d="M12 21V7"/><circle cx="12" cy="4.5" r="2.5"/><path d="M8 15l4-2 4 2"/>`,
  shield: `<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>`,
  poison: `<path d="M12 3v3"/><path d="M9 6h6l1.5 4.5a5.5 5.5 0 1 1-9 0z"/><path d="M10 15h4"/>`,
  stun: `<path d="M9 3l-1 8h3l-1 10 6-11h-4l3-7z" transform="translate(1 1) scale(0.9)"/><circle cx="6" cy="6" r="1"/><circle cx="19" cy="7" r="1"/><circle cx="18" cy="17" r="1"/>`,
  heal: `<path d="M12 4v16"/><path d="M4 12h16"/><rect x="4" y="4" width="16" height="16" rx="3"/>`,
  fire: `<path d="M12 2c1 3-3 4-3 7a3 3 0 0 0 6 0c0-1-1-2-1-2 1.5 1 2.5 3 2.5 5a5 5 0 0 1-10 0c0-4 3-5 3-7 0-1.5.5-2.5 2.5-3z"/>`,
  ice: `<path d="M12 2v20"/><path d="M4 7l16 10"/><path d="M20 7 4 17"/><path d="M8 4l4 3 4-3"/><path d="M8 20l4-3 4 3"/>`,
  blood: `<path d="M12 3s6 7 6 11.5A6 6 0 0 1 6 14.5C6 10 12 3 12 3z"/><path d="M10.5 15a1.8 1.8 0 0 0 2.6 1.6"/>`,
  eye: `<path d="M2 12s4-6.5 10-6.5S22 12 22 12s-4 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  chain: `<rect x="4" y="4" width="7" height="9" rx="3.2"/><rect x="13" y="11" width="7" height="9" rx="3.2"/>`,
  bone: `<path d="M6 6a2.2 2.2 0 1 1 3.2 2L15 14.2A2.2 2.2 0 1 1 18 17.4L17 18.4a2.2 2.2 0 1 1-3.2-2L8 10.2A2.2 2.2 0 1 1 5 7z"/>`,
  coin: `<circle cx="12" cy="12" r="8.5"/><path d="M9 12h6"/><path d="M12 8.5c-2 0-2.5 1-2.5 1.8 0 2 5 1 5 3.4 0 .9-.7 1.8-2.5 1.8s-2.5-1-2.5-1"/>`,
  candle: `<path d="M9 22V10a3 3 0 0 1 6 0v12"/><path d="M9 15h6"/><path d="M12 6c1-1.2.6-2.4 0-3-1 1-1.6 2.3-.6 3.4"/>`,
  key: `<circle cx="7" cy="7" r="4"/><path d="M10 10l10 10"/><path d="M16 16l2.5-2.5"/><path d="M18.5 18.5 21 16"/>`,
  lock: `<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
  skull: `<path d="M12 3a7 7 0 0 0-7 7c0 3 1.6 4.6 2.5 5.6V19h9v-3.4c.9-1 2.5-2.6 2.5-5.6a7 7 0 0 0-7-7z"/><circle cx="9.2" cy="10.5" r="1.3"/><circle cx="14.8" cy="10.5" r="1.3"/><path d="M10 19v2M14 19v2"/>`,
  wing: `<path d="M3 14c4-1 6-5 6-10 3 2 4 6 3 9-1 3-4 5-9 6z"/><path d="M6 11c2 0 3.5-1 4.5-2.5"/><path d="M5 14.5c2 .2 3.7-.6 5-2"/>`,
  hammer: `<path d="M14 3l7 7-3 3-7-7z"/><path d="M13.5 9.5 4 19l-1-1 9.5-9.5z"/>`,
  dagger: `<path d="M12 2v13"/><path d="M9 5h6"/><path d="M12 15l-3 4 3 3 3-3z"/>`,
  book: `<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16"/><path d="M8 7h9"/><path d="M8 10.5h9"/>`,
  hourglass: `<path d="M6 3h12"/><path d="M6 21h12"/><path d="M7 3c0 5 4 6.5 5 7.5-1 1-5 2.5-5 7.5"/><path d="M17 3c0 5-4 6.5-5 7.5 1 1 5 2.5 5 7.5"/>`,
  heart: `<path d="M12 20S3.5 14.5 3.5 8.6A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8.5 2.6C20.5 14.5 12 20 12 20z"/>`,
};

/**
 * Иконка способности 24×24, viewBox "0 0 24 24". Одна толщина линии,
 * без заливки (кроме мелких акцентных точек), stroke="currentColor" —
 * цвет задаётся снаружи через CSS/атрибут color на обёртке.
 */
export function iconSvg(name: IconName): string {
  const body = ICON_PATHS[name];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="icon ${escapeXml(name)}">
  ${body}
</svg>`;
}

// ---------------------------------------------------------------------------
// frameSvg — декоративная рамка карты по тиру
// ---------------------------------------------------------------------------

const CARD_W = 300;
const CARD_H = 400;

/**
 * Рамка карты юнита по тиру (1/2/3), 300×400 (соотношение 3:4).
 * Середина прозрачна — накладывается поверх арта карточки.
 */
export function frameSvg(tier: 1 | 2 | 3): string {
  const color = tier === 1 ? PALETTE.tier1 : tier === 2 ? PALETTE.tier2 : PALETTE.tier3;
  const inset = 6;
  const corner = tier === 1 ? 10 : tier === 2 ? 14 : 18;
  const strokeW = tier === 1 ? 2 : tier === 2 ? 2.5 : 3;

  const cornerMark = (x: number, y: number, rot: number): string =>
    `<g transform="translate(${x} ${y}) rotate(${rot})">
      <path d="M0 ${corner} V0 H${corner}" fill="none" stroke="${color}" stroke-width="${strokeW}"/>
      ${tier >= 2 ? `<circle cx="4" cy="4" r="2.2" fill="${color}"/>` : ""}
    </g>`;

  const gems =
    tier === 3
      ? [
          [CARD_W / 2, inset + 3],
          [CARD_W / 2, CARD_H - inset - 3],
        ]
          .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="3.4" fill="${color}"/>`)
          .join("")
      : "";

  const innerLine =
    tier >= 2
      ? `<rect x="${inset + 6}" y="${inset + 6}" width="${CARD_W - (inset + 6) * 2}" height="${CARD_H - (inset + 6) * 2}" fill="none" stroke="${color}" stroke-width="1" opacity="0.5"/>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}" role="img" aria-label="frame tier ${tier}">
  <rect x="${inset}" y="${inset}" width="${CARD_W - inset * 2}" height="${CARD_H - inset * 2}" rx="6" fill="none" stroke="${color}" stroke-width="${strokeW}"/>
  ${innerLine}
  ${cornerMark(inset, inset, 0)}
  ${cornerMark(CARD_W - inset, inset, 90)}
  ${cornerMark(CARD_W - inset, CARD_H - inset, 180)}
  ${cornerMark(inset, CARD_H - inset, 270)}
  ${gems}
</svg>`;
}

// ---------------------------------------------------------------------------
// unitCardSvg — арт карточки юнита, 3:4
// ---------------------------------------------------------------------------

/** Известные фракции канона → базовый оттенок арта карточки. */
const FACTION_HUES: Record<string, number> = {
  great_pawnshop: 42, // тёплое золото Учёта
  clear_head_brotherhood: 48, // блёклый пергамент Братства
  greedy_memory_guild: 265, // ворованный фиолет ностальгии Цеха
};

function factionHue(faction: string, rng: Rng): number {
  const known = FACTION_HUES[faction];
  return known !== undefined ? known : hueFromSeed(rng);
}

/**
 * Арт карточки юнита 3:4 (300×400): силуэт фигуры на фоне,
 * тонированном по фракции, плюс рамка тира.
 */
export function unitCardSvg(id: string, tier: 1 | 2 | 3, faction: string): string {
  const rng = rngFromSeed(`unit:${id}:${faction}`);
  const hue = factionHue(faction, rng);

  const bgTop = hsl(hue, 24, 14);
  const bgBottom = hsl(hue, 30, 6);
  const silhouette = shade(PALETTE.bg0, 0.02);

  const cx = CARD_W / 2;
  const headR = rng.range(26, 34);
  const headY = 120 + rng.range(-10, 10);
  const shoulderW = rng.range(120, 170);
  const shoulderY = headY + headR + rng.range(14, 22);
  const hipW = shoulderW * rng.range(0.55, 0.75);
  const hemY = CARD_H - 60 - rng.range(-10, 20);
  const lean = rng.range(-10, 10);

  const weaponSeed = rng.bool(0.7);
  const weaponIcon = rng.pick(["sword", "staff", "bow", "dagger", "hammer"] as const);
  const weaponX = cx + shoulderW / 2 - 6 + lean * 0.4;
  const weaponTopY = headY - headR * 0.4;
  const weaponBotY = hemY + 10;

  const auraColor = rng.pick([PALETTE.memory, PALETTE.accent, PALETTE.lie, PALETTE.gold] as const);
  const hasAura = tier === 3 || rng.bool(0.3);

  const bodyPath = `
    M ${cx - hipW / 2 + lean} ${hemY}
    C ${cx - hipW / 2 + lean} ${shoulderY + 30}, ${cx - shoulderW / 2 + lean * 0.5} ${shoulderY + 10}, ${cx - shoulderW / 2 + lean * 0.5} ${shoulderY}
    C ${cx - shoulderW / 2 + lean * 0.5} ${headY} , ${cx - headR} ${headY}, ${cx - headR + lean * 0.2} ${headY - headR * 0.3}
    A ${headR} ${headR} 0 0 1 ${cx + headR + lean * 0.2} ${headY - headR * 0.3}
    C ${cx + headR} ${headY}, ${cx + shoulderW / 2 + lean * 0.5} ${headY}, ${cx + shoulderW / 2 + lean * 0.5} ${shoulderY}
    C ${cx + shoulderW / 2 + lean * 0.5} ${shoulderY + 10}, ${cx + hipW / 2 + lean} ${shoulderY + 30}, ${cx + hipW / 2 + lean} ${hemY}
    Z
  `;

  // Оружие — деталь силуэта, а не самый яркий объект карты: почти белая линия
  // во всю высоту читалась на 110px как случайная царапина поверх фигуры.
  const weaponTone = [PALETTE.tier1, PALETTE.tier2, PALETTE.tier3][tier - 1] ?? PALETTE.tier1;
  const weaponLine = weaponSeed
    ? `<line x1="${weaponX}" y1="${weaponTopY + headR * 0.9}" x2="${weaponX}" y2="${weaponBotY - 12}" stroke="${weaponTone}" stroke-width="2.5" stroke-linecap="round" opacity="0.42"/>
       <g transform="translate(${weaponX - 9} ${weaponTopY + headR * 0.9 - 16}) scale(0.8)" color="${weaponTone}" opacity="0.5">${ICON_PATHS[weaponIcon]}</g>`
    : "";

  const aura = hasAura
    ? `<circle cx="${cx}" cy="${headY - headR * 0.2}" r="${headR * 2.4}" fill="${auraColor}" opacity="0.12"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}" role="img" aria-label="unit card ${escapeXml(id)}">
  <defs>
    <linearGradient id="ug-${escapeXml(id)}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bgTop}"/>
      <stop offset="100%" stop-color="${bgBottom}"/>
    </linearGradient>
  </defs>
  <rect width="${CARD_W}" height="${CARD_H}" fill="url(#ug-${escapeXml(id)})"/>
  ${aura}
  <path d="${bodyPath}" fill="${silhouette}" stroke="${shade(silhouette, -0.3)}" stroke-width="1"/>
  ${weaponLine}
  ${frameInner(tier)}
</svg>`;
}

/** Внутренняя часть рамки для встраивания в unitCardSvg (без второго <svg>). */
function frameInner(tier: 1 | 2 | 3): string {
  // Извлекаем содержимое frameSvg без внешнего <svg>-тега, чтобы не вкладывать
  // SVG в SVG — так разметка остаётся плоской и предсказуемой при инлайне.
  const full = frameSvg(tier);
  const start = full.indexOf(">") + 1;
  const end = full.lastIndexOf("</svg>");
  return full.slice(start, end);
}

// ---------------------------------------------------------------------------
// backgroundSvg — абстрактный фон сцены (диалог/бой)
// ---------------------------------------------------------------------------

const SCENE_W = 390;
const SCENE_H = 844;

/**
 * Абстрактный фон сцены: градиент + силуэты (руины/арки/шпили) для экранов
 * диалога и боя. seed определяет расстановку и оттенок.
 */
export function backgroundSvg(seed: string): string {
  const rng = rngFromSeed(`bg:${seed}`);
  const hue = hueFromSeed(rng);

  const top = hsl(hue, 22, 9);
  const mid = hsl(hue, 20, 6);
  const bottom = PALETTE.bg0;

  const layers: string[] = [];
  const layerCount = 3;
  for (let l = 0; l < layerCount; l++) {
    const baseY = SCENE_H * (0.55 + l * 0.14);
    const opacity = 0.5 - l * 0.12;
    const fill = shade(PALETTE.bg0, 0.02 * (l + 1));
    const shapeCount = rng.int(3, 5);
    let d = `M 0 ${SCENE_H} L 0 ${baseY} `;
    const step = SCENE_W / (shapeCount - 1);
    for (let i = 0; i < shapeCount; i++) {
      const x = i * step;
      const h = rng.range(20, 90) * (1 - l * 0.2);
      const peaked = rng.bool(0.5);
      if (peaked) {
        d += `L ${x} ${baseY - h} `;
      } else {
        const w = step * rng.range(0.3, 0.6);
        d += `L ${x - w / 2} ${baseY} L ${x} ${baseY - h} L ${x + w / 2} ${baseY} `;
      }
    }
    d += `L ${SCENE_W} ${baseY} L ${SCENE_W} ${SCENE_H} Z`;
    layers.push(`<path d="${d}" fill="${fill}" opacity="${opacity}"/>`);
  }

  const emberCount = rng.int(4, 9);
  const embers: string[] = [];
  for (let i = 0; i < emberCount; i++) {
    const ex = rng.range(0, SCENE_W);
    const ey = rng.range(0, SCENE_H * 0.6);
    const er = rng.range(0.6, 1.8);
    const ec = rng.pick([PALETTE.memory, PALETTE.gold, PALETTE.accent] as const);
    embers.push(`<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="${er.toFixed(1)}" fill="${ec}" opacity="${rng.range(0.15, 0.45).toFixed(2)}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_W} ${SCENE_H}" width="${SCENE_W}" height="${SCENE_H}" role="img" aria-label="background ${escapeXml(seed)}">
  <defs>
    <linearGradient id="sg-${escapeXml(seed)}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${top}"/>
      <stop offset="55%" stop-color="${mid}"/>
      <stop offset="100%" stop-color="${bottom}"/>
    </linearGradient>
  </defs>
  <rect width="${SCENE_W}" height="${SCENE_H}" fill="url(#sg-${escapeXml(seed)})"/>
  ${embers.join("\n  ")}
  ${layers.join("\n  ")}
</svg>`;
}
