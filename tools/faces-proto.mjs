/**
 * Прототип портрета: не иконка и не мультяшный аватар, а гравюра.
 * Череп с провалами глазниц, тень по половине лица, штриховка,
 * воротник и предмет роли. Всё в палитре игры, цвет — дом.
 */
import { chromium } from 'playwright';

const P = { bg0:'#0d0b0e', bg1:'#151219', ink:'#0a090b' };

let UID = 0;
function face(o) {
  const uid = ++UID;
  const {
    hue,               // цвет дома
    jaw = 0.5,         // 0 узкий … 1 тяжёлый
    cheek = 0.5,       // впалость щёк
    brow = 0.5,        // тяжесть надбровья
    long = 0.5,        // длина лица
    hair = 'crop',     // crop | bun | long | bald | kerchief | hood | cap | visor
    extra = 'none',    // pince | none
    tilt = 0,
  } = o;
  const W = 160, H = 160;
  const cx = 80 + tilt * 3;
  const top = 34 - long * 14;          // макушка
  const chin = 112 + long * 18;       // подбородок
  const halfW = 23 + jaw * 15;         // половина ширины черепа
  const cheekIn = 4 + cheek * 7;      // насколько щека уходит внутрь
  const eyeY = top + (chin - top) * 0.42;
  const noseY = top + (chin - top) * 0.66;
  const mouthY = top + (chin - top) * 0.82;

  // Силуэт головы: череп сверху, скулы, впалая щека, подбородок.
  const head = `
    M ${cx - halfW} ${eyeY - 6}
    C ${cx - halfW} ${top + 4}, ${cx - halfW * 0.55} ${top - 6}, ${cx} ${top - 6}
    C ${cx + halfW * 0.55} ${top - 6}, ${cx + halfW} ${top + 4}, ${cx + halfW} ${eyeY - 6}
    C ${cx + halfW} ${eyeY + 10}, ${cx + halfW - cheekIn} ${noseY + 4}, ${cx + halfW * 0.62} ${mouthY + 4}
    C ${cx + halfW * 0.44} ${chin - 2}, ${cx + 10} ${chin + 4}, ${cx} ${chin + 4}
    C ${cx - 10} ${chin + 4}, ${cx - halfW * 0.44} ${chin - 2}, ${cx - halfW * 0.62} ${mouthY + 4}
    C ${cx - halfW + cheekIn} ${noseY + 4}, ${cx - halfW} ${eyeY + 10}, ${cx - halfW} ${eyeY - 6} Z`;

  const eye = (s) => {
    const ex = cx + s * (halfW * 0.46);
    return `
      <ellipse cx="${ex}" cy="${eyeY - 1}" rx="11" ry="${7 + brow * 3}" fill="${P.ink}" opacity="0.55"/>
      <path d="M ${ex - 8} ${eyeY - 1} q 8 ${-4 - brow * 2} 16 0 q -8 6 -16 0 Z" fill="${P.ink}" opacity="0.95"/>
      <circle cx="${ex + s * 1.2}" cy="${eyeY}" r="1.7" fill="#cdc4bb" opacity="0.42"/>
      <path d="M ${ex - 11} ${eyeY - 8 - brow * 4} q 11 ${-4 - brow * 4} 22 ${1 + brow}"
            stroke="${P.ink}" stroke-width="${2.2 + brow * 2}" fill="none" stroke-linecap="round" opacity="0.95"/>`;
  };

  const hairPath = {
    crop:`<path d="M ${cx-halfW-2} ${eyeY-4} C ${cx-halfW-3} ${top-6}, ${cx+halfW+3} ${top-6}, ${cx+halfW+2} ${eyeY-4}
           C ${cx+halfW*0.8} ${eyeY-16}, ${cx+halfW*0.2} ${eyeY-9}, ${cx-halfW*0.1} ${eyeY-14}
           C ${cx-halfW*0.5} ${eyeY-18}, ${cx-halfW*0.8} ${eyeY-10}, ${cx-halfW-2} ${eyeY-4} Z" fill="${P.ink}"/>`,
    bald:'',
    bun:`<path d="M ${cx-halfW-1} ${eyeY-12} C ${cx-halfW} ${top-5}, ${cx+halfW} ${top-5}, ${cx+halfW+1} ${eyeY-12}
          C ${cx+halfW*0.5} ${top+7}, ${cx-halfW*0.5} ${top+7}, ${cx-halfW-1} ${eyeY-12} Z" fill="${P.ink}"/>
         <circle cx="${cx}" cy="${top-9}" r="11" fill="${P.ink}"/>`,
    long:`<path d="M ${cx-halfW-3} ${chin-14} C ${cx-halfW-6} ${top+6}, ${cx-halfW*0.5} ${top-9}, ${cx} ${top-9}
          C ${cx+halfW*0.5} ${top-9}, ${cx+halfW+6} ${top+6}, ${cx+halfW+3} ${chin-14}
          C ${cx+halfW-2} ${noseY}, ${cx+halfW-3} ${eyeY-10}, ${cx+halfW*0.55} ${top+8}
          C ${cx} ${top+16}, ${cx-halfW*0.55} ${top+8}, ${cx-halfW+3} ${eyeY-10}
          C ${cx-halfW+2} ${noseY}, ${cx-halfW+2} ${noseY+8}, ${cx-halfW-3} ${chin-14} Z" fill="${P.ink}"/>`,
    kerchief:`<path d="M ${cx-halfW-3} ${eyeY-6} C ${cx-halfW-3} ${top-8}, ${cx+halfW+3} ${top-8}, ${cx+halfW+3} ${eyeY-6}
          C ${cx+halfW} ${eyeY-13}, ${cx-halfW} ${eyeY-13}, ${cx-halfW-3} ${eyeY-6} Z" fill="${hue}" opacity="0.5"/>
          <path d="M ${cx+halfW} ${eyeY-8} l 12 16 l -10 -3 Z" fill="${hue}" opacity="0.5"/>`,
    hood:`<path d="M ${cx-halfW-9} ${chin+6} C ${cx-halfW-11} ${top-2}, ${cx+halfW+11} ${top-2}, ${cx+halfW+9} ${chin+6}
          C ${cx+halfW} ${eyeY-16}, ${cx-halfW} ${eyeY-16}, ${cx-halfW-9} ${chin+6} Z" fill="${P.ink}"/>`,
    cap:`<path d="M ${cx-halfW-4} ${eyeY-11} h ${(halfW+4)*2} l -3 -7 C ${cx+halfW*0.6} ${top-6}, ${cx-halfW*0.6} ${top-6}, ${cx-halfW+1} ${eyeY-18} Z" fill="${P.ink}"/>
         <rect x="${cx-halfW-8}" y="${eyeY-12}" width="${(halfW+8)*2}" height="4" rx="2" fill="${hue}" opacity="0.55"/>`,
    visor:`<path d="M ${cx-halfW-2} ${eyeY-10} C ${cx-halfW-2} ${top-6}, ${cx+halfW+2} ${top-6}, ${cx+halfW+2} ${eyeY-10} Z" fill="${P.ink}"/>
          <rect x="${cx-halfW-2}" y="${eyeY-9}" width="${(halfW+2)*2}" height="9" fill="${P.ink}"/>
          <rect x="${cx-halfW+3}" y="${eyeY-5}" width="${(halfW-3)*2}" height="2.4" fill="${hue}" opacity="0.75"/>`,
  }[hair] ?? '';

  const pince = extra === 'pince'
    ? `<g stroke="${hue}" stroke-width="1.6" fill="none" opacity="0.85">
         <circle cx="${cx - halfW*0.46}" cy="${eyeY}" r="9"/>
         <circle cx="${cx + halfW*0.46}" cy="${eyeY}" r="9"/>
         <path d="M ${cx-halfW*0.46+9} ${eyeY} h ${halfW*0.92-18}"/>
       </g>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs>
      <linearGradient id="sk-${uid}" x1="0" y1="0" x2="1" y2="0.15">
        <stop offset="0%" stop-color="#cdc4bb" stop-opacity="0.62"/>
        <stop offset="46%" stop-color="#cdc4bb" stop-opacity="0.40"/>
        <stop offset="47%" stop-color="#cdc4bb" stop-opacity="0.17"/>
        <stop offset="100%" stop-color="#cdc4bb" stop-opacity="0.07"/>
      </linearGradient>
      <clipPath id="c-${uid}"><path d="${head}"/></clipPath>
    </defs>
    <!-- плечи и воротник -->
    <path d="M ${cx-58} ${H} C ${cx-52} ${chin+14}, ${cx-20} ${chin+2}, ${cx} ${chin+2}
             C ${cx+20} ${chin+2}, ${cx+52} ${chin+14}, ${cx+58} ${H} Z" fill="${P.ink}"/>
    <path d="M ${cx-13} ${chin+3} L ${cx} ${chin+17} L ${cx+13} ${chin+3}"
          stroke="${hue}" stroke-width="2.4" fill="none" opacity="0.8"/>
    <path d="${head}" fill="url(#sk-${uid})"/>
    <g clip-path="url(#c-${uid})">
      <!-- штриховка теневой половины: гравюра, а не градиент -->
      ${Array.from({length: 13}, (_, i) =>
        `<line x1="${cx + 2 + i * 3.4}" y1="${top - 10}" x2="${cx - 12 + i * 3.4}" y2="${chin + 12}"
               stroke="${P.ink}" stroke-width="2" opacity="${0.06 + i * 0.055}"/>`).join('')}
      <!-- впадина щеки -->
      <path d="M ${cx-halfW*0.72} ${eyeY+8} q ${halfW*0.3} ${(chin-eyeY)*0.32} ${halfW*0.16} ${(chin-eyeY)*0.55}"
            stroke="${P.ink}" stroke-width="2" fill="none" opacity="0.5"/>
      <path d="M ${cx+halfW*0.72} ${eyeY+8} q ${-halfW*0.3} ${(chin-eyeY)*0.32} ${-halfW*0.16} ${(chin-eyeY)*0.55}"
            stroke="${P.ink}" stroke-width="2" fill="none" opacity="0.5"/>
    </g>
    <path d="${head}" fill="none" stroke="#cdc4bb" stroke-width="1" opacity="0.22"/>
    ${eye(-1)}${eye(1)}
    <!-- нос: только тень крыла и кончик -->
    <path d="M ${cx-1} ${eyeY+6} L ${cx-4} ${noseY} q 4 3 8 0" stroke="${P.ink}" stroke-width="2"
          fill="none" opacity="0.75" stroke-linecap="round"/>
    <!-- рот: одна линия, без улыбки -->
    <path d="M ${cx-9} ${mouthY} q 9 ${o.mouth ?? 2} 18 0" stroke="${P.ink}" stroke-width="2.2"
          fill="none" opacity="0.85" stroke-linecap="round"/>
    ${hairPath}${pince}
  </svg>`;
}

const CAST = [
  ['Осока',      { hue:'#c9a227', jaw:.2, cheek:.5, brow:.35, long:.55, hair:'bun',  mouth:1 }],
  ['Тминный',    { hue:'#c9a227', jaw:.55, cheek:.8, brow:.6,  long:.7,  hair:'crop', extra:'pince', mouth:0 }],
  ['Ревизор',    { hue:'#c1483f', jaw:.95, cheek:.35,brow:.95, long:.35, hair:'bald', mouth:-2 }],
  ['Клёст',      { hue:'#c9a227', jaw:.05, cheek:.75,brow:.3,  long:.3,  hair:'crop', mouth:3 }],
  ['Прощай',     { hue:'#5bc8b0', jaw:.6,  cheek:.4, brow:.25, long:.5,  hair:'hood', mouth:4 }],
  ['Жичка',      { hue:'#8b6fc4', jaw:.3,  cheek:.85,brow:.5,  long:.6,  hair:'kerchief', mouth:0 }],
  ['Дратва',     { hue:'#9a90a0', jaw:1,   cheek:.2, brow:.8,  long:.25, hair:'visor',mouth:-1 }],
  ['Попрошайка', { hue:'#6d6472', jaw:.4,  cheek:1,  brow:.45, long:.75, hair:'long', mouth:-3 }],
];

const html = `<body style="margin:0;background:${P.bg0};padding:18px;font:13px system-ui;color:#9a90a0">
<div style="display:flex;gap:12px;flex-wrap:wrap">
${CAST.map(([n, o]) => `<div style="text-align:center">
  <div style="width:120px;height:120px;background:${P.bg1};border-radius:12px;box-shadow:inset 0 2px 10px #000a;overflow:hidden">
    ${face(o).replace('<svg','<svg style="width:120px;height:120px"')}</div>
  <div style="width:44px;height:44px;background:${P.bg1};border-radius:9px;margin:8px auto 3px;overflow:hidden">
    ${face(o).replace('<svg','<svg style="width:44px;height:44px"')}</div>
  <div>${n}</div></div>`).join('')}
</div></body>`;

const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 620, height: 700 }, deviceScaleFactor: 2 });
await p.setContent(html);
await p.screenshot({ path: process.argv[2], fullPage: true });
await b.close();
console.log('ok');
