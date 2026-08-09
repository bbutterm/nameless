/**
 * Портреты «Безымянного»: гравюра, а не аватарка.
 *
 * Правила рисунка, принятые владельцем:
 *  - череп с провалами глазниц, штриховка по теневой половине, впалые щёки,
 *    ни одной улыбки;
 *  - кожа нейтрально-костяная; цвет дома НЕ красит лицо — он уходит в воротник
 *    и предмет роли. Первый заход красил кожу цветом дома, и все выходили
 *    желтушными; откачено;
 *  - различие держится на форме черепа, возрасте и том, что с лицом сделала
 *    работа, а не на цвете.
 *
 * Судить портрет надо там, где он живёт, — в ленте на 44px:
 * `node tools/faces-in-screen.mjs out.png`.
 *
 * Запуск контактного листа: node tools/faces-proto.mjs out.png
 */
import { chromium } from 'playwright';

const P = { bg0: '#0d0b0e', bg1: '#151219', ink: '#0a090b', bone: '#cdc4bb', hairTone: '#1c1820' };

let UID = 0;

/**
 * @param {object} o параметры лица; все в 0..1, кроме перечислений.
 *   jaw     тяжесть челюсти: 0 узкий клин … 1 квадрат
 *   cheek   впалость щёк: 0 сыт … 1 голоден
 *   brow    надбровье: 0 гладкий лоб … 1 навес
 *   long    длина лица
 *   age     возраст: складки, жилы шеи, мешки — 0 молодой … 1 старый
 *   asym    перекос: лицо, которое смотрело в одну сторону двадцать лет
 *   fade    незавершённость контура: 0 человек … 1 отголосок
 *   nose    'straight' | 'hook' | 'broad' | 'sharp' | 'flat' | 'broken'
 *   lips    'thin' | 'wide' | 'pursed' | 'gap'
 *   eyes    'deep' | 'narrow' | 'wide' | 'squint' | 'shut'
 *   hair    'crop' | 'bun' | 'long' | 'bald' | 'kerchief' | 'hood' | 'cap' | 'visor' | 'tonsure' | 'wisps'
 *   beard   'none' | 'stubble' | 'chin' | 'full' | 'mutton'
 *   ears    0..1 — насколько торчат
 *   object  'none' | 'pince' | 'pen' | 'tag' | 'bandage' | 'monocle'
 *   hue     цвет дома (воротник и предмет)
 */
export function face(o) {
  const uid = ++UID;
  const {
    hue = '#9a90a0',
    jaw = 0.5, cheek = 0.5, brow = 0.5, long = 0.5,
    age = 0.4, asym = 0, fade = 0, ears = 0.3,
    nose = 'straight', lips = 'thin', eyes = 'deep',
    hair = 'crop', beard = 'none', object = 'none',
    mouth = 0,
  } = o;

  const W = 160, H = 160;
  const cx = 80;
  const top = 34 - long * 14;
  const chin = 112 + long * 18;
  const halfW = 23 + jaw * 15;
  const cheekIn = 4 + cheek * 8;
  const eyeY = top + (chin - top) * 0.42;
  const noseY = top + (chin - top) * 0.66;
  const mouthY = top + (chin - top) * 0.82;
  // Перекос: одна половина черепа шире другой. Величина маленькая нарочно —
  // заметная асимметрия читается как уродство, а нужен характер.
  const wL = halfW * (1 - asym * 0.11);
  const wR = halfW * (1 + asym * 0.11);

  const head = `
    M ${cx - wL} ${eyeY - 6}
    C ${cx - wL} ${top + 4}, ${cx - wL * 0.55} ${top - 6}, ${cx} ${top - 6}
    C ${cx + wR * 0.55} ${top - 6}, ${cx + wR} ${top + 4}, ${cx + wR} ${eyeY - 6}
    C ${cx + wR} ${eyeY + 10}, ${cx + wR - cheekIn} ${noseY + 4}, ${cx + wR * 0.62} ${mouthY + 4}
    C ${cx + wR * 0.44} ${chin - 2}, ${cx + 10} ${chin + 4}, ${cx} ${chin + 4}
    C ${cx - 10} ${chin + 4}, ${cx - wL * 0.44} ${chin - 2}, ${cx - wL * 0.62} ${mouthY + 4}
    C ${cx - wL + cheekIn} ${noseY + 4}, ${cx - wL} ${eyeY + 10}, ${cx - wL} ${eyeY - 6} Z`;

  // ── Глаз ────────────────────────────────────────────────────────────────
  const eye = (s) => {
    const w = s < 0 ? wL : wR;
    const ex = cx + s * (w * 0.46);
    const socket = `<ellipse cx="${ex}" cy="${eyeY - 1}" rx="${11 + cheek * 2}" ry="${7 + brow * 3}" fill="${P.ink}" opacity="${0.4 + cheek * 0.3}"/>`;
    const lid = {
      deep:   `<path d="M ${ex - 8} ${eyeY - 1} q 8 ${-4 - brow * 2} 16 0 q -8 6 -16 0 Z" fill="${P.ink}" opacity="0.95"/>`,
      narrow: `<path d="M ${ex - 9} ${eyeY - 1} q 9 -2 18 0 q -9 3 -18 0 Z" fill="${P.ink}" opacity="0.95"/>`,
      wide:   `<path d="M ${ex - 8} ${eyeY - 1} q 8 -7 16 0 q -8 8 -16 0 Z" fill="${P.ink}" opacity="0.95"/>`,
      squint: `<path d="M ${ex - 9} ${eyeY - 1} q 9 ${-1 - s} 18 ${1 + s} q -9 2 -18 -1 Z" fill="${P.ink}" opacity="0.95"/>`,
      shut:   `<path d="M ${ex - 9} ${eyeY - 1} q 9 4 18 0" stroke="${P.ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    }[eyes];
    // Блик тусклый: светящийся зрачок делает из человека нежить.
    const glint = eyes === 'shut' ? '' :
      `<circle cx="${ex + s * 1.2}" cy="${eyeY}" r="1.7" fill="${P.bone}" opacity="0.42"/>`;
    // Мешок под глазом — недосып, а не возраст: у молодого писаря он тоже есть.
    const bag = age > 0.25
      ? `<path d="M ${ex - 8} ${eyeY + 6} q 8 ${2 + age * 3} 16 0" stroke="${P.ink}" stroke-width="1.4" fill="none" opacity="${0.25 + age * 0.35}"/>`
      : '';
    const browLine = `<path d="M ${ex - 11} ${eyeY - 8 - brow * 4} q 11 ${-4 - brow * 4} 22 ${1 + brow}"
      stroke="${P.ink}" stroke-width="${2.2 + brow * 2}" fill="none" stroke-linecap="round" opacity="0.95"/>`;
    return socket + lid + glint + bag + browLine;
  };

  // ── Нос ─────────────────────────────────────────────────────────────────
  const bridge = eyeY + 6;
  const nosePath = {
    straight: `M ${cx - 1} ${bridge} L ${cx - 4} ${noseY} q 4 3 8 0`,
    hook:     `M ${cx - 1} ${bridge} C ${cx - 3} ${noseY - 8}, ${cx + 3} ${noseY - 4}, ${cx + 2} ${noseY + 2} q -5 2 -7 -2`,
    broad:    `M ${cx - 2} ${bridge} L ${cx - 7} ${noseY} q 7 4 14 0`,
    sharp:    `M ${cx} ${bridge} L ${cx - 2} ${noseY + 2} q 2 1 4 -1`,
    flat:     `M ${cx - 2} ${bridge + 4} L ${cx - 6} ${noseY} q 6 3 12 0`,
    broken:   `M ${cx - 1} ${bridge} L ${cx + 3} ${noseY - 8} L ${cx - 4} ${noseY} q 5 3 9 -1`,
  }[nose];

  // ── Рот ─────────────────────────────────────────────────────────────────
  const lipPath = {
    thin:   `<path d="M ${cx - 9} ${mouthY} q 9 ${mouth} 18 0" stroke="${P.ink}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.85"/>`,
    wide:   `<path d="M ${cx - 13} ${mouthY} q 13 ${mouth} 26 0" stroke="${P.ink}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.85"/>`,
    pursed: `<path d="M ${cx - 6} ${mouthY} q 6 ${mouth} 12 0" stroke="${P.ink}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.9"/>
             <path d="M ${cx - 5} ${mouthY - 4} q 5 -1 10 0" stroke="${P.ink}" stroke-width="1" fill="none" opacity="0.4"/>`,
    // Щербина: рот приоткрыт, и в нём темно. Дешёвый способ показать, что
    // человеку доставалось, без крови и ран — они каноном запрещены.
    gap:    `<path d="M ${cx - 11} ${mouthY - 2} q 11 ${2 + mouth} 22 0 q -11 7 -22 0 Z" fill="${P.ink}" opacity="0.95"/>
             <path d="M ${cx - 11} ${mouthY - 2} q 11 ${2 + mouth} 22 0" stroke="${P.bone}" stroke-width="1.1" fill="none" opacity="0.3"/>
             <rect x="${cx - 5}" y="${mouthY - 1}" width="4" height="3.4" fill="${P.bone}" opacity="0.34"/>`,
  }[lips];

  // ── Волосы и головное ───────────────────────────────────────────────────
  const hairPath = {
    crop: `<path d="M ${cx-wL-2} ${eyeY-4} C ${cx-wL-3} ${top-6}, ${cx+wR+3} ${top-6}, ${cx+wR+2} ${eyeY-4}
           C ${cx+wR*0.8} ${eyeY-16}, ${cx+wR*0.2} ${eyeY-9}, ${cx-wL*0.1} ${eyeY-14}
           C ${cx-wL*0.5} ${eyeY-18}, ${cx-wL*0.8} ${eyeY-10}, ${cx-wL-2} ${eyeY-4} Z" fill="${P.hairTone}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.16"/>`,
    bald: '',
    // Тонзура: выбритая макушка с венчиком — Братство Ясной Головы.
    tonsure: `<path d="M ${cx-wL-1} ${eyeY-3} C ${cx-wL-2} ${top+16}, ${cx-wL*0.55} ${top+9}, ${cx} ${top+9}
              C ${cx+wR*0.55} ${top+9}, ${cx+wR+2} ${top+16}, ${cx+wR+1} ${eyeY-3}
              C ${cx+wR*0.92} ${eyeY-11}, ${cx+wR*0.62} ${eyeY-13}, ${cx+wR*0.5} ${eyeY-12}
              C ${cx+wR*0.3} ${eyeY-3}, ${cx-wL*0.3} ${eyeY-3}, ${cx-wL*0.5} ${eyeY-12}
              C ${cx-wL*0.62} ${eyeY-13}, ${cx-wL*0.92} ${eyeY-11}, ${cx-wL-1} ${eyeY-3} Z"
              fill="${P.hairTone}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.18"/>`,
    // Пряди: волос почти нет, торчит несколько. Голод и выцветание.
    wisps: `<g stroke="${P.ink}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.9">
            ${[-0.7, -0.3, 0.1, 0.5, 0.85].map((k, i) =>
              `<path d="M ${cx + k * halfW} ${eyeY - 9} q ${k * 4} ${-9 - i} ${k * 7} ${-13 - i * 2}"/>`).join('')}
            </g>`,
    bun: `<path d="M ${cx-wL-1} ${eyeY-12} C ${cx-wL} ${top-5}, ${cx+wR} ${top-5}, ${cx+wR+1} ${eyeY-12}
          C ${cx+wR*0.5} ${top+7}, ${cx-wL*0.5} ${top+7}, ${cx-wL-1} ${eyeY-12} Z" fill="${P.hairTone}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.16"/>
         <circle cx="${cx}" cy="${top-9}" r="11" fill="${P.hairTone}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.16"/>`,
    long: `<path d="M ${cx-wL-3} ${chin-14} C ${cx-wL-6} ${top+6}, ${cx-wL*0.5} ${top-9}, ${cx} ${top-9}
          C ${cx+wR*0.5} ${top-9}, ${cx+wR+6} ${top+6}, ${cx+wR+3} ${chin-14}
          C ${cx+wR-2} ${noseY}, ${cx+wR-3} ${eyeY-10}, ${cx+wR*0.55} ${top+8}
          C ${cx} ${top+16}, ${cx-wL*0.55} ${top+8}, ${cx-wL+3} ${eyeY-10}
          C ${cx-wL+2} ${noseY}, ${cx-wL+2} ${noseY+8}, ${cx-wL-3} ${chin-14} Z" fill="${P.hairTone}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.14"/>`,
    kerchief: `<path d="M ${cx-wL-3} ${eyeY-6} C ${cx-wL-3} ${top-8}, ${cx+wR+3} ${top-8}, ${cx+wR+3} ${eyeY-6}
          C ${cx+wR} ${eyeY-13}, ${cx-wL} ${eyeY-13}, ${cx-wL-3} ${eyeY-6} Z" fill="${hue}" opacity="0.38"/>
          <path d="M ${cx+wR} ${eyeY-8} l 12 16 l -10 -3 Z" fill="${hue}" opacity="0.38"/>`,
    hood: `<path d="M ${cx-wL-9} ${chin+6} C ${cx-wL-11} ${top-2}, ${cx+wR+11} ${top-2}, ${cx+wR+9} ${chin+6}
          C ${cx+wR} ${eyeY-16}, ${cx-wL} ${eyeY-16}, ${cx-wL-9} ${chin+6} Z" fill="${P.ink}"/>`,
    cap: `<path d="M ${cx-wL-4} ${eyeY-11} h ${(wL+wR+8)} l -3 -7 C ${cx+wR*0.6} ${top-6}, ${cx-wL*0.6} ${top-6}, ${cx-wL+1} ${eyeY-18} Z" fill="${P.ink}"/>
         <rect x="${cx-wL-8}" y="${eyeY-12}" width="${wL+wR+16}" height="4" rx="2" fill="${hue}" opacity="0.55"/>`,
    visor: `<path d="M ${cx-wL-2} ${eyeY-10} C ${cx-wL-2} ${top-6}, ${cx+wR+2} ${top-6}, ${cx+wR+2} ${eyeY-10} Z" fill="${P.ink}"/>
          <rect x="${cx-wL-2}" y="${eyeY-9}" width="${wL+wR+4}" height="9" fill="${P.ink}"/>
          <rect x="${cx-wL+3}" y="${eyeY-5}" width="${wL+wR-6}" height="2.4" fill="${hue}" opacity="0.75"/>`,
  }[hair] ?? '';

  // ── Борода ──────────────────────────────────────────────────────────────
  const beardPath = {
    none: '',
    stubble: `<g fill="${P.bone}" opacity="0.30">
      ${Array.from({ length: 42 }, (_, i) => {
        const a = (i * 137.5 * Math.PI) / 180;
        const rx = Math.cos(a) * halfW * 0.62;
        const ry = mouthY + 3 + Math.abs(Math.sin(a)) * (chin - mouthY) * 0.75;
        return `<circle cx="${(cx + rx).toFixed(1)}" cy="${ry.toFixed(1)}" r="1.1"/>`;
      }).join('')}</g>`,
    chin: `<path d="M ${cx-8} ${mouthY+6} q 8 ${11 + age * 4} 16 0 q -8 ${7 + age * 6} -16 0 Z"
             fill="${P.hairTone}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.16"/>`,
    full: `<path d="M ${cx-wL*0.7} ${mouthY-4} C ${cx-wL*0.75} ${chin+4}, ${cx-10} ${chin+16}, ${cx} ${chin+17}
           C ${cx+10} ${chin+16}, ${cx+wR*0.75} ${chin+4}, ${cx+wR*0.7} ${mouthY-4}
           C ${cx+wR*0.4} ${mouthY+3}, ${cx-wL*0.4} ${mouthY+3}, ${cx-wL*0.7} ${mouthY-4} Z"
           fill="${P.hairTone}" stroke="${P.bone}" stroke-width="0.9" stroke-opacity="0.2"/>`,
    mutton: `<path d="M ${cx-wL*0.85} ${eyeY+4} q ${-2} ${(chin-eyeY)*0.6} ${5} ${(chin-eyeY)*0.62} q 4 -6 2 -${(chin-eyeY)*0.6} Z" fill="${P.hairTone}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.18"/>
             <path d="M ${cx+wR*0.85} ${eyeY+4} q ${2} ${(chin-eyeY)*0.6} ${-5} ${(chin-eyeY)*0.62} q -4 -6 -2 -${(chin-eyeY)*0.6} Z" fill="${P.hairTone}" stroke="${P.bone}" stroke-width="0.8" stroke-opacity="0.18"/>`,
  }[beard] ?? '';

  // ── Предмет роли ────────────────────────────────────────────────────────
  const objectPath = {
    none: '',
    pince: `<g stroke="${hue}" stroke-width="1.6" fill="none" opacity="0.85">
        <circle cx="${cx - wL*0.46}" cy="${eyeY}" r="9"/><circle cx="${cx + wR*0.46}" cy="${eyeY}" r="9"/>
        <path d="M ${cx-wL*0.46+9} ${eyeY} h ${(wL+wR)*0.46-18}"/></g>`,
    monocle: `<g stroke="${hue}" stroke-width="1.8" fill="none" opacity="0.9">
        <circle cx="${cx + wR*0.46}" cy="${eyeY}" r="10"/>
        <path d="M ${cx + wR*0.46 + 9} ${eyeY + 5} q 6 10 2 ${chin - eyeY - 8}"/></g>`,
    // Перо за ухом: приказчик, писарь, счетовод — рука занята бумагой.
    pen: `<g opacity="0.9"><path d="M ${cx + wR - 1} ${eyeY - 4} l 13 -16" stroke="${hue}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M ${cx + wR + 11} ${eyeY - 19} l 5 -6 l 1 6 Z" fill="${hue}"/></g>`,
    // Бирка на вороте: вещь из описи, а не человек.
    tag: `<g opacity="0.95"><path d="M ${cx + 16} ${chin + 8} l 11 3 l -3 11 l -11 -3 Z" fill="${P.bg1}" stroke="${hue}" stroke-width="1.4"/>
        <path d="M ${cx + 19} ${chin + 12} l 6 2 M ${cx + 18} ${chin + 16} l 6 2" stroke="${hue}" stroke-width="1" opacity="0.8"/></g>`,
    bandage: `<path d="M ${cx - wL - 2} ${eyeY - 3} h ${wL + wR + 4} v 8 h -${wL + wR + 4} Z" fill="${P.bone}" opacity="0.22"/>
        <path d="M ${cx - wL - 2} ${eyeY + 1} h ${wL + wR + 4}" stroke="${P.bone}" stroke-width="1" opacity="0.35"/>`,
  }[object] ?? '';

  // ── Возраст: складки от крыльев носа и жилы шеи ──────────────────────────
  const ageLines = age < 0.3 ? '' : `
    <g stroke="${P.ink}" fill="none" stroke-linecap="round" opacity="${0.25 + age * 0.4}">
      <path d="M ${cx - 6} ${noseY + 2} q ${-5 - age * 4} ${(mouthY - noseY) * 1.5} ${-2} ${(mouthY - noseY) * 2.1}" stroke-width="${1.4 + age}"/>
      <path d="M ${cx + 6} ${noseY + 2} q ${5 + age * 4} ${(mouthY - noseY) * 1.5} ${2} ${(mouthY - noseY) * 2.1}" stroke-width="${1.4 + age}"/>
      ${age > 0.6 ? `<path d="M ${cx - 14} ${top + 12} q 14 ${-3 - age * 2} 28 0" stroke-width="1.2"/>
                     <path d="M ${cx - 12} ${top + 18} q 12 ${-2 - age * 2} 24 0" stroke-width="1"/>` : ''}
    </g>`;

  const earPath = ears < 0.15 ? '' : `
    <g fill="url(#sk-${uid})" stroke="${P.ink}" stroke-width="1" opacity="0.85">
      <ellipse cx="${cx - wL - ears * 3}" cy="${eyeY + 6}" rx="${3 + ears * 4}" ry="${7 + ears * 4}"/>
      <ellipse cx="${cx + wR + ears * 3}" cy="${eyeY + 6}" rx="${3 + ears * 4}" ry="${7 + ears * 4}"/>
    </g>`;

  // Незавершённость: у отголоска контур не замыкается и низ лица уходит в ничто.
  const fadeDefs = fade > 0 ? `
    <linearGradient id="fd-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
      <stop offset="${72 - fade * 18}%" stop-color="#fff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="${(0.25 - fade * 0.25).toFixed(2)}"/>
    </linearGradient>
    <mask id="fm-${uid}"><rect width="${W}" height="${H}" fill="url(#fd-${uid})"/></mask>` : '';
  const maskAttr = fade > 0 ? ` mask="url(#fm-${uid})"` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="sk-${uid}" x1="0" y1="0" x2="1" y2="0.15">
      <stop offset="0%" stop-color="${P.bone}" stop-opacity="0.62"/>
      <stop offset="46%" stop-color="${P.bone}" stop-opacity="0.40"/>
      <stop offset="47%" stop-color="${P.bone}" stop-opacity="0.17"/>
      <stop offset="100%" stop-color="${P.bone}" stop-opacity="0.07"/>
    </linearGradient>
    <clipPath id="c-${uid}"><path d="${head}"/></clipPath>
    ${fadeDefs}
  </defs>
  <g${maskAttr}>
    <path d="M ${cx-58} ${H} C ${cx-52} ${chin+14}, ${cx-20} ${chin+2}, ${cx} ${chin+2}
             C ${cx+20} ${chin+2}, ${cx+52} ${chin+14}, ${cx+58} ${H} Z" fill="${P.ink}"/>
    ${age > 0.55 ? `<g stroke="${P.ink}" stroke-width="1.6" opacity="0.5" fill="none">
       <path d="M ${cx-7} ${chin+4} q -2 8 -4 12"/><path d="M ${cx+7} ${chin+4} q 2 8 4 12"/></g>` : ''}
    <path d="M ${cx-13} ${chin+3} L ${cx} ${chin+17} L ${cx+13} ${chin+3}"
          stroke="${hue}" stroke-width="2.4" fill="none" opacity="0.8"/>
    ${earPath}
    <path d="${head}" fill="url(#sk-${uid})"/>
    <g clip-path="url(#c-${uid})">
      ${Array.from({ length: 13 }, (_, i) =>
        `<line x1="${cx + 2 + i * 3.4}" y1="${top - 10}" x2="${cx - 12 + i * 3.4}" y2="${chin + 12}"
               stroke="${P.ink}" stroke-width="2" opacity="${(0.06 + i * 0.055).toFixed(3)}"/>`).join('')}
      <path d="M ${cx-wL*0.72} ${eyeY+8} q ${wL*0.3} ${(chin-eyeY)*0.32} ${wL*0.16} ${(chin-eyeY)*0.55}"
            stroke="${P.ink}" stroke-width="${1.5 + cheek}" fill="none" opacity="${0.3 + cheek * 0.35}"/>
      <path d="M ${cx+wR*0.72} ${eyeY+8} q ${-wR*0.3} ${(chin-eyeY)*0.32} ${-wR*0.16} ${(chin-eyeY)*0.55}"
            stroke="${P.ink}" stroke-width="${1.5 + cheek}" fill="none" opacity="${0.3 + cheek * 0.35}"/>
    </g>
    <path d="${head}" fill="none" stroke="${P.bone}" stroke-width="${fade > 0 ? 1.4 : 1}" opacity="${fade > 0 ? 0.42 : 0.22}"
          ${fade > 0 ? `stroke-dasharray="${(16 - fade * 11).toFixed(1)} ${(3 + fade * 9).toFixed(1)}"` : ''}/>
    ${eye(-1)}${eye(1)}
    <path d="${nosePath}" stroke="${P.ink}" stroke-width="2" fill="none" opacity="0.75" stroke-linecap="round"/>
    ${ageLines}${lipPath}${beardPath}${hairPath}${objectPath}
  </g>
</svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Контактный лист. Значения — черновые, канон лиц пишется в docs/PORTRAITS.md.
// ─────────────────────────────────────────────────────────────────────────────
const GOLD = '#c9a227', RED = '#c1483f', TEAL = '#5bc8b0', STEEL = '#9a90a0',
      VIOLET = '#8b6fc4', PALE = '#6d6472';

const CAST = [
  ['Осока',      { hue:GOLD,  jaw:.2, cheek:.5, brow:.35, long:.55, age:.25, hair:'bun',  nose:'sharp',    lips:'pursed', eyes:'narrow', object:'pen',  ears:.15 }],
  ['Тминный',    { hue:GOLD,  jaw:.55,cheek:.8, brow:.6,  long:.7,  age:.7,  hair:'crop', nose:'hook',     lips:'thin',   eyes:'deep',   object:'pince', beard:'stubble', asym:.5 }],
  ['Оценщик',    { hue:GOLD,  jaw:.45,cheek:.35,brow:.5,  long:.4,  age:.55, hair:'bald', nose:'broad',    lips:'wide',   eyes:'squint', object:'monocle', ears:.7 }],
  ['Ревизор',    { hue:RED,   jaw:.95,cheek:.35,brow:.95, long:.35, age:.5,  hair:'bald', nose:'flat',     lips:'thin',   eyes:'deep',   mouth:-2, ears:.1 }],
  ['Клёст',      { hue:GOLD,  jaw:.05,cheek:.75,brow:.3,  long:.3,  age:.05, hair:'crop', nose:'straight', lips:'gap',    eyes:'wide',   ears:.9 }],
  ['Дратва',     { hue:STEEL, jaw:1,  cheek:.2, brow:.8,  long:.25, age:.45, hair:'visor',nose:'broken',   lips:'thin',   eyes:'deep',   beard:'mutton', mouth:-1 }],
  ['Стражник',   { hue:STEEL, jaw:.7, cheek:.45,brow:.55, long:.35, age:.2,  hair:'cap',  nose:'straight', lips:'wide',   eyes:'narrow', ears:.5 }],
  ['Брат Прощай',{ hue:TEAL,  jaw:.6, cheek:.4, brow:.25, long:.5,  age:.6,  hair:'tonsure', nose:'broad', lips:'wide',   eyes:'wide',   beard:'full', mouth:2 }],
  ['Огородник',  { hue:TEAL,  jaw:.5, cheek:.3, brow:.4,  long:.45, age:.35, hair:'tonsure', nose:'flat',  lips:'thin',   eyes:'squint', ears:.6 }],
  ['Жичка',      { hue:VIOLET,jaw:.3, cheek:.85,brow:.5,  long:.6,  age:.3,  hair:'kerchief', nose:'sharp',lips:'pursed', eyes:'narrow', asym:.7 }],
  ['Мародёр',    { hue:VIOLET,jaw:.75,cheek:.5, brow:.65, long:.4,  age:.4,  hair:'crop', nose:'broken',   lips:'gap',    eyes:'squint', beard:'chin' }],
  ['Попрошайка', { hue:PALE,  jaw:.4, cheek:1,  brow:.45, long:.75, age:.85, hair:'wisps',nose:'hook',     lips:'gap',    eyes:'deep',   beard:'stubble', mouth:-3, object:'tag' }],
  ['Мертвец',    { hue:PALE,  jaw:.35,cheek:1,  brow:.3,  long:.8,  age:.9,  hair:'wisps',nose:'sharp',    lips:'thin',   eyes:'shut',   fade:.35, object:'tag' }],
  ['Ты',         { hue:PALE,  jaw:.5, cheek:.7, brow:.5,  long:.5,  age:.35, hair:'hood', nose:'straight', lips:'thin',   eyes:'deep',   fade:.2 }],
  ['Гарь',       { hue:TEAL,  jaw:.8, cheek:.6, brow:.7,  long:.45, age:.5,  hair:'bald', nose:'broken',   lips:'thin',   eyes:'shut',   fade:.75 }],
  ['Посул',      { hue:TEAL,  jaw:.5, cheek:.5, brow:.5,  long:.5,  age:.3,  hair:'crop', nose:'straight', lips:'thin',   eyes:'wide',   fade:.85 }],
];

if (process.argv[2]) {
  const html = `<body style="margin:0;background:${P.bg0};padding:18px;font:13px system-ui;color:#9a90a0">
  <div style="display:flex;gap:12px;flex-wrap:wrap;width:600px">
  ${CAST.map(([n, o]) => `<div style="text-align:center">
    <div style="width:120px;height:120px;background:${P.bg1};border-radius:12px;box-shadow:inset 0 2px 10px #000a;overflow:hidden">
      ${face(o).replace('<svg', '<svg style="width:120px;height:120px"')}</div>
    <div style="width:44px;height:44px;background:${P.bg1};border-radius:9px;margin:8px auto 3px;overflow:hidden">
      ${face(o).replace('<svg', '<svg style="width:44px;height:44px"')}</div>
    <div>${n}</div></div>`).join('')}
  </div></body>`;
  const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 640, height: 900 }, deviceScaleFactor: 2 });
  await p.setContent(html);
  await p.screenshot({ path: process.argv[2], fullPage: true });
  await b.close();
  console.log('ok');
}
