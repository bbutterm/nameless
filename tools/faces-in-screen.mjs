/**
 * Примерка портретов на живом экране диалога: подменяет знак-глиф лицом из
 * `faces-proto.mjs` прямо в работающей сборке и снимает экран. Нужна ровно
 * для того, чтобы судить портрет там, где он живёт, — в ленте на 44px, а не
 * на контактном листе, где любое лицо выглядит лучше, чем есть.
 *
 * Запуск: node tools/faces-in-screen.mjs <файл.png>   (превью на :4173)
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./faces-proto.mjs', import.meta.url), 'utf8');
// Берём саму функцию face из прототипа, чтобы не держать две копии рисунка.
const body = src.slice(src.indexOf('const P = {'), src.indexOf('const CAST'));
const mk = new Function(`${body}; return face;`)();

const CAST = {
  'ОСОКА':      { hue:'#c9a227', jaw:.2,  cheek:.5, brow:.35, long:.55, hair:'bun',  mouth:1 },
  'ТМИННЫЙ':    { hue:'#c9a227', jaw:.55, cheek:.8, brow:.6,  long:.7,  hair:'crop', extra:'pince', mouth:0 },
  'ОЦЕНЩИК':    { hue:'#c9a227', jaw:.45, cheek:.6, brow:.5,  long:.45, hair:'crop', mouth:0 },
  'РЕВИЗОР':    { hue:'#c1483f', jaw:.95, cheek:.35,brow:.95, long:.35, hair:'bald', mouth:-2 },
  'КЛЁСТ':      { hue:'#c9a227', jaw:.05, cheek:.75,brow:.3,  long:.3,  hair:'crop', mouth:3 },
  'ДРАТВА':     { hue:'#9a90a0', jaw:1,   cheek:.2, brow:.8,  long:.25, hair:'visor',mouth:-1 },
  'СТРАЖНИК':   { hue:'#9a90a0', jaw:.8,  cheek:.3, brow:.7,  long:.3,  hair:'cap',  mouth:-1 },
  'ПОПРОШАЙКА': { hue:'#6d6472', jaw:.4,  cheek:1,  brow:.45, long:.75, hair:'long', mouth:-3 },
  'ОЧЕРЕДЬ':    { hue:'#6d6472', jaw:.5,  cheek:.9, brow:.4,  long:.6,  hair:'hood', mouth:-2 },
  'ТЫ':         { hue:'#6d6472', jaw:.5,  cheek:.7, brow:.5,  long:.5,  hair:'hood', mouth:0 },
  'МАРОДЁР':    { hue:'#8b6fc4', jaw:.7,  cheek:.5, brow:.6,  long:.4,  hair:'kerchief', mouth:-1 },
};
const faces = Object.fromEntries(Object.entries(CAST).map(([k, v]) => [k, mk(v)]));

const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2, locale:'ru-RU' });
const p = await ctx.newPage();
await p.goto('http://localhost:4173', { waitUntil: 'networkidle' });
await p.locator('.big-button').first().click();
for (let i = 0; i < 260; i++) {
  if (await p.locator('.screen.battle').count()) break;
  if ((await p.locator('.portrait-mark').count()) >= 3) break;
  const ch = p.locator('.choice');
  if (await ch.count()) { await ch.nth(0).click(); await p.waitForTimeout(110); continue; }
  const h = p.locator('.tap-hint');
  if (await h.count()) { await h.click(); await p.waitForTimeout(60); continue; }
  break;
}
await p.addStyleTag({ content: '.portrait-mark::before{display:none!important} .portrait-mark{overflow:hidden}' });
await p.evaluate((data) => {
  document.querySelectorAll('.portrait-mark').forEach((el) => {
    const name = (el.parentElement?.parentElement?.querySelector('.bubble-name')?.textContent ?? '').trim().toUpperCase();
    const svg = data[name] ?? data['ТЫ'];
    el.style.background = 'none'; el.style.webkitMask = 'none'; el.style.mask = 'none';
    el.innerHTML = svg;
    const s = el.querySelector('svg');
    if (s) { s.style.width='100%'; s.style.height='100%'; s.style.display='block'; }
  });
}, faces);
await p.waitForTimeout(250);
await p.screenshot({ path: process.argv[2] });
await b.close();
console.log('ok');
