/**
 * Генератор иконок PWA без внешних зависимостей.
 * Рисуем башню Ломбарда пикселями и упаковываем в PNG средствами node:zlib.
 * Запуск: node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // фильтр «none»
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // бит на канал
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [13, 11, 14];
const SILVER = [110, 102, 118];
const GOLD = [201, 162, 39];

function icon(u, v) {
  // Виньетка
  const dx = u - 0.5;
  const dy = v - 0.42;
  const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2.4);
  const bg = BG.map((c) => Math.round(c + glow * 26));

  // Башня: сужается кверху, семь этажей окон.
  const towerTop = 0.2;
  const towerBottom = 0.9;
  if (v > towerTop && v < towerBottom) {
    const k = (v - towerTop) / (towerBottom - towerTop);
    const halfW = 0.1 + k * 0.075;
    if (Math.abs(u - 0.5) < halfW) {
      const floor = Math.floor(((v - towerTop) / (towerBottom - towerTop)) * 7);
      const inFloor = (((v - towerTop) / (towerBottom - towerTop)) * 7) % 1;
      const windowRow = inFloor > 0.26 && inFloor < 0.62;
      const windowCol = Math.abs(((u - 0.5) / halfW) % 0.62) < 0.3;
      if (windowRow && windowCol && floor < 7) {
        const lit = (floor * 3 + Math.round(u * 10)) % 4 !== 0;
        return lit ? [...GOLD, 255] : [30, 26, 32, 255];
      }
      const shade = 1 - Math.abs(u - 0.5) / halfW * 0.35;
      return [...SILVER.map((c) => Math.round(c * shade)), 255];
    }
  }
  return [...bg, 255];
}

for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), png(size, icon));
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0d0b0e"/>
  <radialGradient id="g" cx="0.5" cy="0.42" r="0.6">
    <stop offset="0" stop-color="#241f29"/><stop offset="1" stop-color="#0d0b0e"/>
  </radialGradient>
  <rect width="512" height="512" fill="url(#g)"/>
  <path d="M205 461 L218 102 L294 102 L307 461 Z" fill="#6e6676"/>
  <g fill="#c9a227">
    ${Array.from({ length: 7 }, (_, i) => {
      const y = 118 + i * 47;
      return `<rect x="${232 + i * 0.4}" y="${y}" width="14" height="20" opacity="${i % 4 === 0 ? 0.25 : 0.9}"/>
      <rect x="${262 - i * 0.4}" y="${y}" width="14" height="20" opacity="${i % 3 === 0 ? 0.3 : 0.85}"/>`;
    }).join('')}
  </g>
</svg>`;
writeFileSync(join(outDir, 'icon.svg'), svg, 'utf8');

console.log('иконки: icon.svg, icon-192.png, icon-512.png');
