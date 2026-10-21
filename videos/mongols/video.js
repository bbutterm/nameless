// "Who Ruled the 1200s? The Mongols" (~4:44). Series thread: globe + golden crown + century ribbon; episode thread: horses.
// See storyboard.md. Globe/crown/ribbon/horse/hat come from engine/kit.js (history series kit).
'use strict';
const N = narration();
const at = N.at;
Object.assign(PAL, {
  gold: '#e2b04a', goldD: '#c38b2c', grass: '#d9a845', grassL: '#ebc469', grassD: '#b9862f', sky0: '#3f8fd0', sky1: '#bfe6f5',
  mblue: '#2f5fd0', mblueD: '#1f3f99', felt: '#f3ead8', feltD: '#d8ccb2', war: '#d94a3a', warD: '#9e2a22', rust: '#8a3b24', soot: '#2a2224',
  jade: '#2fae8a', song: '#e8b23a', hill: '#9fb86a', hillD: '#7f9a55', mount: '#7d95b8', mountD: '#61789c',
});
const IDS = ['hook', 'crown', 'steppe', 'boy', 'khan', 'question', 'horses', 'army', 'news', 'learn', 'fear', 'west', 'peace', 'kublai', 'limits', 'split', 'why', 'plague', 'ending'];
const { Bd, S, lw } = sceneTimeline(N, IDS);
const END = N.END;
const SC = id => Bd[S[id]];

// ================= map data (approximate, [lon, lat]) =================
const geo = r => geoDensify(r, 1.2);
const REG = {
  core: geo([[88, 49], [92, 50.5], [98, 52], [104, 51.5], [108, 52.5], [113, 50.5], [116, 50], [119, 47.5], [116, 45], [114, 44], [109, 42.5], [104, 42], [97, 43], [92, 44.5], [90, 45.5]]),
  yuanN: geo([[88, 49], [92, 50.5], [98, 53], [108, 54], [115, 52], [120, 53.3], [127, 53], [135, 48.5], [140, 48], [137, 45], [131, 42.6], [129.6, 42.3], [129.5, 37], [129.3, 35.2], [127, 34.5], [126.3, 34.6], [126.5, 37.5], [124.6, 39.6], [121.6, 38.9], [121, 40.6], [118.5, 39.1], [117.6, 38.6], [118.8, 37.4], [122.5, 37.2], [120.3, 36], [119.2, 34.8], [120.3, 33.6], [116, 32.6], [111, 33.5], [106, 34.3], [102, 35], [98, 36.6], [94, 38.5], [90, 40], [86, 41.5], [85, 45], [86, 48]]),
  yuanS: geo([[120.3, 33.6], [121.9, 31], [121.5, 28.5], [119.6, 25.5], [117, 23.4], [114, 22.4], [110.5, 21.2], [109.5, 21.6], [107.8, 21.6], [106.5, 22.5], [104, 22.8], [101.5, 21.8], [99, 22.5], [98, 24.6], [98.3, 27.6], [96, 28.5], [92, 27.6], [88.5, 27.8], [85, 28.4], [81, 30.2], [79, 32.6], [79.5, 35], [83, 36], [90, 37.5], [94, 38.5], [98, 36.6], [102, 35], [106, 34.3], [111, 33.5], [116, 32.6]]),
  chagatai: geo([[86, 48], [85, 45], [86, 41.5], [90, 40], [83, 36], [79.5, 35], [75, 35.6], [71, 34.5], [68, 36.5], [66, 37.4], [63, 38.6], [61.2, 40.2], [60.5, 41.8], [62.5, 43.5], [66, 44.5], [70, 46], [76, 46.8], [82, 48.6]]),
  ilkhan: geo([[60.5, 41.8], [61.2, 40.2], [63, 38.6], [66, 37.4], [68, 36.5], [69.5, 34], [66.5, 31], [62.5, 25.3], [57.5, 25.7], [56.3, 27.1], [52.5, 27.6], [50.3, 29.6], [48.3, 30], [46.3, 31.6], [44.2, 33], [41, 34.4], [38.3, 36.6], [36.7, 36.9], [33, 37.2], [30.3, 38.3], [31.2, 40.5], [33.5, 41.9], [37, 41.2], [41.5, 41.5], [44.5, 42.2], [47.6, 41.6], [49.6, 40.5], [49.2, 38.4], [51, 36.8], [54, 37], [54.8, 39.2], [53.2, 40.6], [54.3, 41.5], [56.5, 41.5]]),
  golden: geo([[29.6, 45.2], [28.2, 47.4], [26.8, 49.3], [24.5, 51.6], [26.5, 54.8], [28.3, 57.4], [30.5, 59.6], [36, 61.2], [45, 62], [55, 60.2], [60.5, 57.6], [66, 56.2], [74, 55.6], [80, 54.2], [85.5, 52.6], [86, 48], [82, 48.6], [76, 46.8], [70, 46], [66, 44.5], [62.5, 43.5], [60.5, 41.8], [56.5, 41.5], [54.3, 41.5], [52.6, 42.4], [51, 44.7], [49.2, 45.2], [47.6, 43.2], [47.6, 41.6], [44.5, 42.2], [41.5, 41.5], [38.3, 44.4], [37.4, 45.3], [36.2, 45.4], [35.3, 44.8], [33.6, 44.4], [32.6, 45.5], [31.8, 46.6], [30.5, 46.3]]),
  china: geo([[110, 41.2], [116, 42.2], [118, 44], [121, 47.5], [125.5, 49.8], [131, 48], [135, 47.6], [133, 44], [131, 42.6], [129.6, 42.3], [126, 41.5], [124.6, 39.9], [121.6, 38.9], [121, 40.6], [118.5, 39.1], [117.6, 38.6], [118.8, 37.4], [122.5, 37.2], [120.3, 36], [119.2, 34.8], [120.3, 33.6], [121.9, 31], [121.5, 28.5], [119.6, 25.5], [117, 23.4], [114, 22.4], [110.5, 21.2], [109.5, 21.6], [107.8, 21.6], [106.5, 22.5], [104.5, 23], [103.5, 26], [102, 28], [101.5, 31], [103, 33.2], [105, 35.2], [106, 38], [108, 39.5]]),
  egypt: geo([[25, 31.6], [29, 30.9], [32.3, 31.3], [34.2, 31.3], [35.5, 33.2], [36.2, 35.6], [38.3, 36.6], [41, 34.4], [38.6, 33.2], [36, 29.5], [34.9, 29.4], [34.3, 27.9], [32.6, 29.9], [33.5, 27.2], [35.5, 23.9], [36.9, 22], [31.5, 21.9], [25, 22], [25, 29]]),
};
const KH = ['golden', 'chagatai', 'ilkhan', 'yuanN', 'yuanS'];
// conquest years per region (seed point, start → full); the empire floods outward from the seed
const GROW = {
  core: { seed: [104, 47], y0: 1195, y1: 1206 },
  yuanN: { seed: [102, 46], y0: 1206, y1: 1234 },
  chagatai: { seed: [86, 45], y0: 1218, y1: 1221 },
  ilkhan: { seed: [62, 39], y0: 1219, y1: 1258 },
  golden: { seed: [62, 48], y0: 1223, y1: 1241 },
  yuanS: { seed: [105, 33], y0: 1253, y1: 1279 },
};
const KH_COL = { golden: '#e2a93a', chagatai: '#3fae8a', ilkhan: '#d9604a', yuanN: '#3a6ee0', yuanS: '#3a6ee0' };
const CITY = {
  karakorum: [102.8, 47.2], zhongdu: [116.4, 39.9], hangzhou: [120.2, 30.25], kaifeng: [114.3, 34.8], samarkand: [66.95, 39.65], bukhara: [64.4, 39.77],
  urgench: [60.1, 42.3], merv: [61.8, 37.6], nishapur: [58.8, 36.2], baghdad: [44.4, 33.3], kyiv: [30.5, 50.45], legnica: [16.2, 51.2], mohi: [21.0, 47.95],
  venice: [12.3, 45.4], ainjalut: [35.4, 32.55], hakata: [130.4, 33.6], happo: [128.6, 35.2], caffa: [35.4, 45.0], tabriz: [46.3, 38.1], kashgar: [76, 39.5],
  khanbaliq: [116.4, 39.9], cairo: [31.25, 30.05], acre: [35.07, 32.92], kaesong: [126.55, 37.97], delhi: [77.2, 28.6], constantinople: [28.97, 41.0],
};
const ROAD = geo([[116.4, 39.9], [111, 40.8], [106.5, 41.2], [102.8, 47.2], [96, 44], [89, 43.3], [82, 43.7], [76.9, 43.2], [72.5, 42.5], [69.3, 41.3], [66.95, 39.65], [64.4, 39.77], [61.8, 37.6], [58.8, 36.2], [54, 36.5], [51.4, 35.7], [46.3, 38.1], [41, 39.9], [38, 40.6], [35.4, 45.0]]).slice(0);
const ROAD_OPEN = ROAD.slice(0, ROAD.length - 1);  // geoDensify closes rings; roads are open lines
const KK = ROAD_OPEN.reduce((b, p, i) => Math.hypot(p[0] - 102.8, p[1] - 47.2) < Math.hypot(ROAD_OPEN[b][0] - 102.8, ROAD_OPEN[b][1] - 47.2) ? i : b, 0);  // Karakorum
// North America outline (largest land ring in the western hemisphere) for the size comparison
const NAM = (() => { let best = null, ba = 0; for (const r of WORLD.land) { const lo = r.reduce((a, p) => a + p[0], 0) / r.length, la = r.reduce((a, p) => a + p[1], 0) / r.length; if (lo < -60 && lo > -130 && la > 30) { const a = r.length; if (a > ba) { ba = a; best = r; } } } return best; })();

// ================= shared helpers =================
const ease = E.inOut;
// globe camera keys {t, v:[lon, lat, R, cx?, cy?]}; R is splined in log space (zoom feels even, never overshoots below 0)
function viewKeys(keys, u) { const v = spline(keys.map(k => ({ t: k.t, v: [k.v[0], k.v[1], Math.log(k.v[2]), k.v[3] ?? W / 2, k.v[4] ?? H / 2] })), u); return geoView(v[0], v[1], Math.exp(v[2]), v[3], v[4]); }
function gp(v, c) { return geoProj(v, c[0], c[1]); }
// draw the empire at a given (float) year; o.split = 0..1 separates khanates into their own colours, o.ming = 0..1 for China
function empire(ctx, v, year, o = {}) {
  const regs = o.regs || ['core', ...KH];
  for (const k of regs) {
    const g = GROW[k]; const f = clamp((year - g.y0) / (g.y1 - g.y0)); if (f <= 0) continue;
    const [sx, sy] = gp(v, g.seed);
    let maxd = 0; for (const p of REG[k]) { const q = gp(v, p); maxd = Math.max(maxd, Math.hypot(q[0] - sx, q[1] - sy)); }
    ctx.save();
    if (o.split && k !== 'core') { const c = gp(v, [90, 45]); const dx = sx - c[0], dy = sy - c[1], L = Math.hypot(dx, dy) || 1; ctx.translate(dx / L * o.split * (o.splitPx || 26), dy / L * o.split * (o.splitPx || 26)); }
    if (f < 1) { ctx.beginPath(); ctx.arc(sx, sy, maxd * E.out2(f) * 1.02, 0, TAU); ctx.clip(); }
    let col = o.color || PAL.mblue;
    if (o.split) col = mix(PAL.mblue, KH_COL[k] || PAL.mblue, o.split);
    if (o.ming && (k === 'yuanS' || k === 'yuanN')) col = mix(col, '#d8343a', o.ming);
    ctx.globalAlpha = o.alpha ?? 0.82;
    geoFill(ctx, v, [REG[k]], col);
    if (f < 1 && o.ring !== false) { ctx.globalAlpha = 0.5; ctx.strokeStyle = PAL.ice; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(sx, sy, maxd * E.out2(f) * 1.02, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  if (o.edge) { ctx.save(); ctx.globalAlpha = o.edge; ctx.strokeStyle = o.edgeColor || '#ffffff'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath(); geoRings(ctx, v, regs.filter(k => year >= GROW[k].y1).map(k => REG[k])); ctx.stroke(); ctx.restore(); }
}
function cityDot(ctx, v, c, name, p, o = {}) {
  if (p <= 0) return; const [x, y, vis] = gp(v, c); if (vis < 0) return;
  ctx.save(); ctx.globalAlpha *= clamp(p * 1.5);
  circle(ctx, x, y + 3, 11 * E.outBack(clamp(p)), 'rgba(0,0,20,0.3)'); circle(ctx, x, y, 10 * E.outBack(clamp(p)), o.color || '#ffffff'); circle(ctx, x, y, 4.5 * E.outBack(clamp(p)), o.core || PAL.war);
  if (name) label(ctx, name, x + (o.dx ?? 0), y + (o.dy ?? -34), o.size || 22, { color: o.text || '#ffffff', bg: o.bg || 'rgba(10,18,44,0.78)', alpha: clamp(p * 2 - 0.4) });
  ctx.restore();
}
function mapLabel(ctx, v, c, text, size, p, o = {}) { if (p <= 0) return; const [x, y, vis] = gp(v, c); if (vis < 0) return; label(ctx, text, x, y, size, { color: o.color || '#ffffff', alpha: clamp(p), weight: 900, ...o }); }
// soft flat clouds drifting over maps (near layer, blurred) – gives depth to globe shots
const CLOUDS = (() => { const R = rng(9); const a = []; for (let i = 0; i < 9; i++) a.push({ x: R() * 2600 - 300, y: R() * 1000, s: 0.6 + R() * 1.1, sp: 10 + R() * 18 }); return a; })();
function cloudPuff(ctx, x, y, s, col = '#ffffff') { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, 160 * s, 46 * s, 0, 0, TAU); ctx.ellipse(x - 70 * s, y - 20 * s, 70 * s, 50 * s, 0, 0, TAU); ctx.ellipse(x + 40 * s, y - 34 * s, 90 * s, 62 * s, 0, 0, TAU); ctx.fill(); }
function mapClouds(ctx, t, a = 0.35, dx = 0) {
  if (a <= 0) return;
  layer(ctx, 9, g => { g.globalAlpha = a; for (const c of CLOUDS) cloudPuff(g, ((c.x + t * c.sp + dx * c.s) % 2600 + 2600) % 2600 - 300, c.y, c.s, '#f4f9ff'); });
}
// full-screen cloud wipe used for globe ↔ landscape dives (k: 0..1..0 coverage)
function cloudWipe(ctx, k, t) {
  if (k < 0.01) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const R = rng(31);
  for (let i = 0; i < 26; i++) { const x = R() * 2400 - 240, y = R() * 1300 - 110, s = 1.2 + R() * 1.8; const off = (1 - k) * (R() > 0.5 ? 1 : -1) * 1400; cloudPuff(ctx, x + off, y + Math.sin(t + i) * 10, s * (0.4 + k * 0.8), mix('#ffffff', '#d7ecff', R())); }
  ctx.globalAlpha = 0.7 * clamp((k - 0.7) / 0.3); ctx.fillStyle = '#f2f8ff'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
function mapBg(ctx, top = '#0b1a38', bot = '#183766') { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function title(ctx, text, x, y, size, p, o = {}) { if (p <= 0) return; ctx.save(); ctx.globalAlpha *= clamp(o.alpha ?? 1); kineticWord(ctx, text, x, y, size, p, { color: o.color || '#ffffff', shadow: o.shadow || 'rgba(10,10,40,0.45)', track: o.track ?? 0.05, weight: 900, glitch: o.glitch }); ctx.restore(); }

// ---------------- the steppe world ----------------
const SKIES = { day: ['#3f8fd0', '#bfe6f5'], warm: ['#4a88c8', '#f6d9a0'], cold: ['#2c4f80', '#a9c4dc'], dusk: ['#2b3f7a', '#f2a96b'], sunset: ['#3a2f6b', '#f4a259'], rust: ['#2a1a1a', '#9a4a2a'], night: ['#07122b', '#1c2c5a'] };
const GRASS = { day: [PAL.grass, PAL.grassL, PAL.grassD], cold: ['#a7a47a', '#c3c09a', '#8a875f'], dusk: ['#c08a46', '#d9a55e', '#9a6a35'], sunset: ['#c47a3c', '#dd9a55', '#9b5a2c'], rust: ['#6a3a2a', '#7e4a33', '#4e2a20'] };
const MOUNTS = (() => { const R = rng(5); const a = []; let x = -1600; while (x < 3600) { const w = 300 + R() * 420, h = 140 + R() * 220; a.push([x, w, h, R()]); x += w * 0.55; } return a; })();
const HILLS = (() => { const R = rng(6); const a = []; let x = -1600; while (x < 3600) { const w = 500 + R() * 600; a.push([x, w, 60 + R() * 90]); x += w * 0.6; } return a; })();
const TUFTS = (() => { const R = rng(8); const a = []; for (let i = 0; i < 46; i++) a.push({ x: R() * 5200 - 1600, y: 940 + R() * 260, s: 0.7 + R() * 0.9 }); return a; })();
// visible world-x centre for a parallax plane; landscape layers repeat every SPAN so the camera can travel forever
const SPAN = 5200;
const planeX = (cam, p) => W / 2 + (cam.x - W / 2) * p;
function tiles(cam, p) { const c = planeX(cam, p), k = Math.floor((c + 1600) / SPAN); return [k - 1, k, k + 1]; }
function blendCols(a, b, k) { return a.map((c, i) => mix(c, b[i], k)); }
// o: {sky: name|[top,bot], grass: name, sun: {x,y,c}, waves: amplitude, snow: 0..1, fg: true}
function steppe(ctx, cam, t, o = {}) {
  const sk = Array.isArray(o.sky) ? o.sky : SKIES[o.sky || 'day'], gr = Array.isArray(o.grass) ? o.grass : GRASS[o.grass || 'day'];
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sk[0]); g.addColorStop(0.75, sk[1]); g.addColorStop(1, sk[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); applyCam(ctx, cam, 0.06);
  const sun = o.sun || { x: 1450, y: 330, c: '#fff1c4' }; glow(ctx, sun.x, sun.y, 420, rgba(sun.c, 0.55), 0.8); circle(ctx, sun.x, sun.y, 70, sun.c);
  ctx.restore();
  ctx.save(); applyCam(ctx, cam, 0.15);
  ctx.globalAlpha = o.cloudA ?? 0.85; const cc = planeX(cam, 0.15); for (let i = 0; i < 6; i++) cloudPuff(ctx, cc - 1900 + (((i * 620 + t * 9) % 3800) + 3800) % 3800, 170 + (i % 3) * 90, 0.8 + (i % 2) * 0.5, mix('#ffffff', sk[1], 0.3)); ctx.restore();
  // far mountains (Khentii/Altai haze)
  ctx.save(); applyCam(ctx, cam, 0.3);
  const mc = mix(o.mount || PAL.mount, sk[1], 0.45);
  for (const k of tiles(cam, 0.3)) for (const [x0, w, h, r] of MOUNTS) {
    const x = x0 + k * SPAN, hh = h * 0.8, px = x + w * (0.45 + r * 0.1);
    ctx.fillStyle = mc; ctx.beginPath(); ctx.moveTo(x, 640); ctx.quadraticCurveTo(px - w * 0.18, 640 - hh * 0.95, px, 640 - hh); ctx.quadraticCurveTo(px + w * 0.2, 640 - hh * 0.92, x + w, 640); ctx.fill();
    ctx.fillStyle = mix(mc, '#1a2340', 0.14); ctx.beginPath(); ctx.moveTo(px, 640 - hh); ctx.quadraticCurveTo(px + w * 0.2, 640 - hh * 0.92, x + w, 640); ctx.lineTo(px + w * 0.08, 640); ctx.quadraticCurveTo(px + w * 0.12, 640 - hh * 0.5, px, 640 - hh); ctx.fill();
  }
  ctx.restore();
  // rolling hills
  ctx.save(); applyCam(ctx, cam, 0.6);
  ctx.fillStyle = mix(gr[2], sk[1], 0.35);
  for (const k of tiles(cam, 0.6)) { const o0 = k * SPAN; ctx.beginPath(); ctx.moveTo(o0 - 1600, 690); for (const [x, w, h] of HILLS) ctx.quadraticCurveTo(o0 + x + w / 2, 660 - h, o0 + x + w, 680); ctx.lineTo(o0 + 3700, 690); ctx.lineTo(o0 + 3700, 1300); ctx.lineTo(o0 - 1600, 1300); ctx.fill(); }
  ctx.restore();
  // ground: an ocean of grass with rolling light bands
  ctx.save(); applyCam(ctx, cam, 1);
  const gc = planeX(cam, 1), X0 = Math.floor((gc - 3600) / 80) * 80, X1 = X0 + 7200;
  ctx.fillStyle = gr[0]; ctx.fillRect(X0, 690, X1 - X0, 900);
  const A = o.waves ?? 1;
  for (let k = 0; k < 9; k++) {
    const y0 = 700 + k * 52 + k * k * 4; ctx.fillStyle = k % 2 ? gr[1] : mix(gr[0], gr[2], 0.35); ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(X0, y0);
    for (let x = X0; x <= X1; x += 80) ctx.lineTo(x, y0 + Math.sin(x * 0.0042 - t * 1.6 + k * 0.9) * (6 + k * 1.5) * A);
    ctx.lineTo(X1, y0 + 26 + k * 3); for (let x = X1; x >= X0; x -= 80) ctx.lineTo(x, y0 + 26 + k * 3 + Math.sin(x * 0.0042 - t * 1.6 + k * 0.9 + 0.6) * (6 + k * 1.5) * A); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.restore();
  if (o.snow) snow(ctx, cam, t, o.snow);
}
function steppeFg(ctx, cam, t, o = {}) {
  const gr = GRASS[o.grass || 'day'];
  layer(ctx, 8, g => { applyCam(g, cam, 1.5); for (const k of tiles(cam, 1.5)) for (const f0 of TUFTS) { const f = { ...f0, x: f0.x + k * SPAN }; g.fillStyle = gr[2]; g.beginPath(); const sw = Math.sin(t * 1.4 + f.x * 0.01) * 14 * f.s; for (let k = -3; k <= 3; k++) { g.moveTo(f.x + k * 9 * f.s, f.y); g.quadraticCurveTo(f.x + k * 14 * f.s + sw * 0.5, f.y - 60 * f.s, f.x + k * 18 * f.s + sw, f.y - 110 * f.s); g.lineTo(f.x + k * 9 * f.s + 7, f.y); } g.fill(); } });
}
const FLAKES = (() => { const R = rng(12); const a = []; for (let i = 0; i < 140; i++) a.push({ x: R() * 2400 - 240, y: R() * 1200, r: 2 + R() * 5, sp: 40 + R() * 70, ph: R() * TAU }); return a; })();
function snow(ctx, cam, t, a) { ctx.save(); ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#ffffff'; for (const f of FLAKES) { const y = (f.y + t * f.sp) % 1200 - 60, x = f.x + Math.sin(t * 0.8 + f.ph) * 30 - t * 20 % 2400; circle(ctx, ((x % 2400) + 2400) % 2400 - 240, y, f.r, '#ffffff'); } ctx.restore(); }

// ---------------- props ----------------
function ger(ctx, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.fillStyle = 'rgba(0,0,20,0.2)'; ctx.beginPath(); ctx.ellipse(0, 2, 118, 14, 0, 0, TAU); ctx.fill();
  shaded(ctx, (g, k) => { if (!k) g.beginPath(); g.moveTo(-100, 0); g.lineTo(-100, -62); g.quadraticCurveTo(-60, -120, 0, -128); g.quadraticCurveTo(60, -120, 100, -62); g.lineTo(100, 0); g.closePath(); }, o.color || PAL.felt, 'rgba(90,60,30,0.18)', -26, 0);
  ctx.fillStyle = o.band || '#c0392b'; ctx.fillRect(-100, -70, 200, 9); ctx.fillRect(-100, -30, 200, 7);
  ctx.fillStyle = '#e8892b'; rrect(ctx, -22, -58, 44, 58, 6); ctx.fill(); ctx.fillStyle = '#c0632a'; rrect(ctx, -14, -50, 28, 50, 4); ctx.fill();
  ctx.fillStyle = PAL.feltD; ctx.beginPath(); ctx.ellipse(0, -126, 18, 6, 0, 0, TAU); ctx.fill();
  if (o.smoke) { for (let i = 0; i < 4; i++) { const k = ((o.t || 0) * 0.6 + i / 4) % 1; ctx.globalAlpha = (1 - k) * 0.35; circle(ctx, Math.sin(k * 6 + i) * 10 + k * 30, -140 - k * 120, 12 + k * 24, '#ffffff'); } }
  ctx.restore();
}
function sheep(ctx, x, y, s, t, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale((o.face || 1) * s / 100, s / 100);
  const b = Math.abs(Math.sin(t * (o.hop || 0) * 6)) * 10;
  ctx.fillStyle = 'rgba(0,0,20,0.18)'; ctx.beginPath(); ctx.ellipse(0, 2, 46, 7, 0, 0, TAU); ctx.fill();
  ctx.translate(0, -b);
  ctx.strokeStyle = '#3a2f2a'; ctx.lineWidth = 8; ctx.lineCap = 'round'; for (const lx of [-24, -10, 12, 26]) { ctx.beginPath(); ctx.moveTo(lx, -20); ctx.lineTo(lx, 0); ctx.stroke(); }
  ctx.fillStyle = '#f7f3ea'; for (const [cx, cy, r] of [[-26, -40, 22], [-6, -48, 26], [16, -44, 24], [30, -34, 18], [0, -30, 26]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#3a2f2a'; ctx.beginPath(); ctx.ellipse(44, -42, 14, 18, 0.4, 0, TAU); ctx.fill(); circle(ctx, 48, -46, 3, '#ffffff');
  ctx.restore();
}
// clan / state banner: a pole with a trident tip and a flowing horse-hair tail (tug)
function tug(ctx, x, y, s, t, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100); ctx.rotate(o.tilt || 0); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -260); ctx.stroke();
  ctx.strokeStyle = '#d8b25a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-16, -278); ctx.lineTo(-16, -262); ctx.lineTo(16, -262); ctx.lineTo(16, -278); ctx.moveTo(0, -262); ctx.lineTo(0, -300); ctx.stroke();
  const n = o.tails || 1, col = o.color || '#f4f1ea';
  for (let k = 0; k < n; k++) {
    const a = (k - (n - 1) / 2) * (n > 3 ? 0.07 : 0.2) + 0.15; ctx.fillStyle = k % 2 ? mix(col, '#000000', 0.08) : col; ctx.beginPath(); ctx.moveTo(-10, -258);
    const L = 140 + (o.big ? 40 : 0); for (let i = 0; i <= 10; i++) { const f = i / 10; ctx.lineTo(Math.sin(a) * L * f + Math.sin(t * 5 - f * 4 + k) * 12 * f + 14 * f, -258 + Math.cos(a) * L * f * 0.9 - 6 * f); }
    for (let i = 10; i >= 0; i--) { const f = i / 10; ctx.lineTo(Math.sin(a) * L * f + Math.sin(t * 5 - f * 4 + k) * 12 * f + 14 * f + 20 * (1 - f) + 4, -258 + Math.cos(a) * L * f * 0.9 + 10 * (1 - f)); }
    ctx.fill();
  }
  ctx.restore();
}
// rider on a horse (horse from kit). o.pose: 'ride' | 'bow' | 'back' (shooting backwards)
function rider(ctx, x, y, s, ph, o = {}) {
  const st = horse(ctx, x, y, s, ph, { face: o.face || 1, color: o.horse, run: o.run ?? 1, saddle: '#c0392b' });
  const f = o.face || 1, back = o.pose === 'back';
  const d = dude(ctx, st.seatX, st.seatY + s * 0.18, s * 0.95, o.t || 0, { body: o.body || PAL.mblue, hat: { kind: o.hat || 'mongol', color: o.hatColor || '#c0392b' }, arms: o.pose === 'bow' || back ? 'shrug' : 'down', look: [back ? -f : f, 0], noShadow: true, mood: o.mood });
  if (o.pose === 'bow' || back) { const dir = back ? -f : f; ctx.save(); ctx.translate(st.seatX + dir * s * 0.42, st.seatY - s * 0.38); ctx.strokeStyle = '#6b3d1f'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.arc(0, 0, s * 0.3, -1.1, 1.1); if (dir < 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); } ctx.stroke(); ctx.restore(); }
  return st;
}
function arrow(ctx, x, y, ang, len, col = '#3a2a20') { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke(); ctx.fillStyle = '#9aa3b5'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.fill(); ctx.fillStyle = '#e5e0d0'; ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-len - 12, -9); ctx.lineTo(-len + 10, 0); ctx.lineTo(-len - 12, 9); ctx.fill(); ctx.restore(); }
// the five reasons: a quiver with five arrows. lit[i] 0..1 lights arrow i, pull = which arrow is drawn out (index, amount)
const RC = ['#e2b04a', '#2f5fd0', '#2fae8a', '#9a6cff', '#d94a3a'];
function quiver(ctx, x, y, s, t, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100); ctx.rotate(o.rot ?? -0.12);
  for (let i = 0; i < 5; i++) {
    const lit = (o.lit && o.lit[i]) || 0, pull = o.pull && o.pull[0] === i ? o.pull[1] : 0;
    const ax = -40 + i * 20, ay = -150 - pull * 120 - lit * 12;
    ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, -40); ctx.stroke();
    ctx.fillStyle = lit > 0 ? mix('#e9e3d2', RC[i], lit) : '#e9e3d2'; ctx.beginPath(); ctx.moveTo(ax, ay - 4); ctx.lineTo(ax - 12, ay - 34); ctx.lineTo(ax, ay - 24); ctx.lineTo(ax + 12, ay - 34); ctx.fill();
    if (lit > 0) glow(ctx, ax, ay - 20, 60, rgba(RC[i], 0.9), lit * 0.8);
    if (o.nums) label(ctx, String(i + 1), ax, ay - 56, 22, { color: '#fff', alpha: lit * 0.9 + 0.1 });
  }
  shaded(ctx, (g, k) => { if (!k) g.beginPath(); g.moveTo(-62, -70); g.lineTo(62, -70); g.lineTo(48, 120); g.quadraticCurveTo(0, 140, -48, 120); g.closePath(); }, '#8a4f2c', '#6a3a20', -18, 0);
  ctx.fillStyle = '#c0392b'; ctx.fillRect(-60, -70, 120, 16); ctx.fillStyle = PAL.gold; for (let k = -1; k <= 1; k++) circle(ctx, k * 30, 30, 8, PAL.gold);
  ctx.restore();
}
function quiverHud(ctx, t, idx, a) { if (a <= 0) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; const lit = [0, 0, 0, 0, 0]; for (let i = 0; i <= idx; i++) lit[i] = i === idx ? 1 : 0.35; quiver(ctx, 110, 990, 52, t, { lit, rot: -0.1 }); ctx.restore(); }
function reasonTitle(ctx, n, text, u, t0, o = {}) {
  const p = seg(u, t0 - 0.2, t0 + 0.6), out = 1 - seg(u, (o.out ?? t0 + 2.6), (o.out ?? t0 + 2.6) + 0.4);
  if (p <= 0 || out <= 0) return;
  ctx.save(); ctx.globalAlpha = out; const y = o.y || 190;
  circle(ctx, W / 2 - 4, y - 10 + 4, 46 * E.outBack(p), 'rgba(0,0,20,0.3)'); circle(ctx, W / 2, y - 10, 46 * E.outBack(p), RC[n - 1]);
  label(ctx, String(n), W / 2, y - 8, 46, { color: '#fff', alpha: p });
  title(ctx, text, W / 2, y + 100, 72, p, { color: o.color || '#ffffff' });
  ctx.restore();
}

// ================= scenes =================
// S1 — one horse on the steppe → fly up to the globe → the empire floods Eurasia in 80 years
const YEAR = { v: 1200 };
function s1(ctx, u, d, t) {
  const L = (id, n = 0) => lw('hook', id, n);
  const tUp = L('almost') - 0.1, tGlobe = tUp + 0.75;
  if (u < tGlobe) {
    const k = E.in3(seg(u, tUp - 0.2, tGlobe));
    const cam = { x: 960 + u * 6, y: 560 - k * 900, z: 1.12 - u * 0.012 - k * 0.5, r: -0.01 + k * 0.05 };
    steppe(ctx, cam, t, { sky: 'day', waves: 0.8 });
    ctx.save(); applyCam(ctx, cam, 1); horse(ctx, 980, 830, 190, t * 0.6, { run: 0, graze: Math.sin(clamp(u / 2) * Math.PI) > 0.2 ? 1 : 0, color: '#8a5a3c' }); ctx.restore();
    steppeFg(ctx, cam, t);
    ctx.save(); applyCam(ctx, cam, 0.5); title(ctx, '1200', 960, 380, 170, seg(u, L('1200') - 0.3, L('1200') + 0.5), { color: '#ffffff' }); ctx.restore();
  } else {
    const v = viewKeys([{ t: tGlobe, v: [96, 46, 5200] }, { t: tGlobe + 1.4, v: [92, 44, 470] }, { t: d, v: [70, 46, 480] }], u);
    mapBg(ctx);
    const yr = lerp(1200, 1280, E.inOut(seg(u, L('Eighty') + 0.1, L('largest') + 0.2)));
    YEAR.v = yr;
    drawGlobe(ctx, v, t, { under: g => { empire(g, v, Math.max(1206.01, yr), { edge: seg(u, L('largest'), L('largest') + 0.5) * 0.8 }); } });
    const pm = seg(u, L('Mongols') - 0.3, L('Mongols') + 0.2) * (1 - seg(u, L('Eighty') + 0.2, L('Eighty') + 0.6));
    if (pm > 0) { const [x, y] = gp(v, [104, 47]); circle(ctx, x, y, 7 + 4 * Math.sin(t * 6), '#ffffff'); label(ctx, 'MONGOLS', x, y - 40, 24, { color: '#fff', bg: 'rgba(10,18,44,0.8)', alpha: pm }); }
    const py = seg(u, L('Eighty') - 0.2, L('Eighty') + 0.3);
    if (py > 0) label(ctx, String(Math.floor(yr)), W / 2, 130, 64, { color: '#ffffff', alpha: py * (1 - seg(u, d - 1.6, d - 1.2)), weight: 900 });
    const pl = seg(u, L('largest'), L('largest') + 0.5) * (1 - seg(u, d - 1.5, d - 1.1));
    if (pl > 0) label(ctx, 'LARGEST CONNECTED EMPIRE IN HISTORY', W / 2, 960, 34, { color: '#fff', bg: 'rgba(47,95,208,0.9)', alpha: pl });
    mapClouds(ctx, t, 0.3 * (1 - seg(u, tGlobe, tGlobe + 1.5)) + 0.12);
    const tt = seg(u, d - 1.25, d - 0.45);
    if (tt > 0) { fadeBlack(ctx, tt * 0.45, '8,14,40'); title(ctx, 'WHO RULED THE 1200s?', W / 2, 560, 104, tt, { color: '#ffffff' }); label(ctx, 'ONE CENTURY AT A TIME', W / 2, 660, 28, { color: PAL.gold, alpha: seg(u, d - 0.8, d - 0.4) }); }
  }
  cloudWipe(ctx, Math.sin(Math.PI * seg(u, tUp + 0.2, tGlobe + 0.45)), t);
}
// S2 — the crown of 1200 sits on China: paper money, printing, gunpowder, million-people cities
function s2(ctx, u, d, t) {
  const L = (id, n = 0) => lw('crown', id, n);
  const v = viewKeys([{ t: 0, v: [70, 46, 480] }, { t: L('crown') + 0.4, v: [104, 38, 560] }, { t: L('richest'), v: [110, 33, 900] }, { t: L('paper'), v: [112, 31, 1700, 760, 620] }, { t: d, v: [113, 30.5, 1900, 760, 620] }], u);
  mapBg(ctx);
  const rew = 1280 - 80 * E.inOut(seg(u, 0, 0.9)); YEAR.v = rew;
  const glowC = seg(u, L('richest') - 0.2, L('richest') + 0.6);
  drawGlobe(ctx, v, t, {
    under: g => {
      empire(g, v, rew, { alpha: 0.82 * (1 - seg(u, 0.6, 1.0)) });
      if (glowC > 0) { g.save(); g.globalAlpha = 0.55 * glowC; geoFill(g, v, [REG.china], PAL.song); g.restore(); }
    },
  });
  if (u < 1.0) { const tt = 1 - seg(u, 0.3, 0.9); fadeBlack(ctx, tt * 0.45, '8,14,40'); title(ctx, 'WHO RULED THE 1200s?', W / 2, 560, 104, 1, { alpha: tt }); }
  // the crown drops onto China
  const tc = L('crown') - 0.1, land = L('China') + 0.05;
  if (u > tc) {
    const [cx, cy] = gp(v, [114, 33.5]);
    const fall = E.in2(seg(u, tc, land)); const b = u > land ? Math.abs(Math.sin((u - land) * 9)) * Math.exp(-(u - land) * 5) * 40 : 0;
    const sz = 120 + seg(u, L('paper'), L('paper') + 0.8) * 50;
    crown(ctx, cx, lerp(-200, cy - 12, fall) - b, sz, t, { glint: Math.max(0, 1 - Math.abs(u - land - 0.25) * 3) + 0.3 * Math.sin(t * 2) ** 2 });
    label(ctx, 'CHINA', cx, cy + 46, 30, { color: '#fff', bg: 'rgba(10,18,44,0.8)', alpha: seg(u, land, land + 0.3) });
    // four inventions in an arc to the right
    const items = [['paper', 'PAPER MONEY', banknote], ['printing', 'PRINTING', bookIcon], ['gunpowder', 'GUNPOWDER', rocket], ['cities', 'MILLION-PEOPLE CITIES', skyline]];
    items.forEach(([w, name, fn], i) => {
      const p = pop(u, L(w) - 0.15, 0.45); if (p <= 0) return;
      const x = 1250 + (i % 2) * 330, y = 330 + Math.floor(i / 2) * 360 + Math.sin(t * 1.5 + i) * 6;
      ctx.save(); ctx.translate(x, y); ctx.scale(p, p);
      circle(ctx, 0, 6, 120, 'rgba(0,0,20,0.25)'); circle(ctx, 0, 0, 120, '#fdf3d8'); fn(ctx, t, u - L(w));
      ctx.restore(); label(ctx, name, x, y + 160, 24, { color: '#fff', bg: 'rgba(10,18,44,0.82)', alpha: seg(u, L(w), L(w) + 0.3) });
    });
    const pc = seg(u, L('million') - 0.5, L('people') + 0.2);
    if (pc > 0) label(ctx, Math.round(1e6 * E.out3(pc)).toLocaleString('en-US'), 1580, 650, 40, { color: PAL.warD, weight: 900, alpha: clamp(pc * 3) });
  }
  mapClouds(ctx, t, 0.18);
}
function banknote(ctx, t) { ctx.save(); ctx.rotate(-0.12); ctx.fillStyle = '#e9d9b0'; rrect(ctx, -54, -76, 108, 152, 8); ctx.fill(); ctx.fillStyle = '#2f5a8a'; ctx.fillRect(-42, -62, 84, 10); for (let i = 0; i < 6; i++) ctx.fillRect(-36 + i * 13, -40, 6, 70); ctx.fillStyle = '#d0453a'; rrect(ctx, 6, 26, 32, 32, 4); ctx.fill(); ctx.restore(); }
function bookIcon(ctx, t) { ctx.fillStyle = '#8a4f2c'; rrect(ctx, -82, -50, 164, 104, 10); ctx.fill(); ctx.fillStyle = '#fbf6e6'; rrect(ctx, -74, -58, 72, 104, 6); ctx.fill(); rrect(ctx, 2, -58, 72, 104, 6); ctx.fill(); ctx.fillStyle = '#3a3a4a'; for (let c = 0; c < 4; c++) for (let r = 0; r < 6; r++) { ctx.fillRect(-64 + c * 16, -46 + r * 14, 8, 8); ctx.fillRect(12 + c * 16, -46 + r * 14, 8, 8); } }
function rocket(ctx, t, lu) { const k = clamp(lu / 0.8); ctx.save(); ctx.translate(0, 30 - k * 40); ctx.rotate(-0.5); ctx.fillStyle = '#c0392b'; rrect(ctx, -14, -60, 28, 80, 8); ctx.fill(); ctx.fillStyle = '#e2b04a'; ctx.beginPath(); ctx.moveTo(-14, -60); ctx.lineTo(0, -84); ctx.lineTo(14, -60); ctx.fill(); ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, 96); ctx.stroke(); for (let i = 0; i < 7; i++) { const a = t * 9 + i; circle(ctx, Math.sin(a) * 12, 28 + (i * 9 + t * 60) % 50, 5 - i * 0.5, i % 2 ? '#ffd65c' : '#ff8a3c'); } ctx.restore(); }
function skyline(ctx, t) { ctx.fillStyle = '#2f5a8a'; const B = [[-90, 60, 30], [-60, 110, 34], [-22, 80, 30], [12, 130, 36], [50, 70, 30]]; for (const [x, h, w] of B) { ctx.fillRect(x, 70 - h, w, h); ctx.fillStyle = '#ffd65c'; for (let y = 80 - h; y < 60; y += 18) ctx.fillRect(x + 8, y, 8, 8); ctx.fillStyle = '#2f5a8a'; } ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(4, -64); ctx.lineTo(30, -82); ctx.lineTo(56, -64); ctx.fill(); }

// S3 — north to the steppe: an ocean of grass; gers, people, no cities, no writing; tents, sheep, horses; clans fight
const CAMP = [[620, 760, 150], [880, 730, 120], [1160, 770, 160], [1430, 735, 115], [1700, 765, 140]];
function s3(ctx, u, d, t) {
  const L = (id, n = 0) => lw('steppe', id, n);
  const tDive = L('steppe') + 0.1;
  if (u < tDive + 0.35) {
    const v = viewKeys([{ t: 0, v: [113, 30.5, 1900, 760, 620] }, { t: L('north'), v: [108, 40, 1800] }, { t: tDive + 0.35, v: [104, 47, 7000] }], u);
    mapBg(ctx); drawGlobe(ctx, v, t, { shade: 0.2 });
    const [cx, cy] = gp(v, [114, 33.5]); crown(ctx, cx, cy - 12, 150, t, { glint: 0.2 });
    mapLabel(ctx, v, [100, 46.5], 'THE STEPPE', 40, seg(u, L('north'), L('north') + 0.4));
    mapClouds(ctx, t, 0.25 + seg(u, L('north'), tDive) * 0.4);
  } else {
    const k = u - tDive;
    const cam = camKeys([{ t: 0, v: [900, 300, 0.9, 0.02] }, { t: 1.2, v: [960, 520, 1.0, 0.0] }, { t: L('Mongols') - tDive, v: [1060, 560, 1.06, -0.008] }, { t: L('clans') - tDive, v: [1180, 580, 1.0, 0.0] }, { t: d - tDive, v: [1220, 590, 1.08, 0.012] }], k);
    const waves = 1 + 1.6 * Math.sin(Math.PI * seg(u, L('ocean') - 0.4, L('grass') + 1.2));
    steppe(ctx, cam, t, { sky: 'day', waves });
    ctx.save(); applyCam(ctx, cam, 1);
    // gers
    CAMP.forEach(([x, y, s], i) => { const p = pop(u, L('Here') + i * 0.12, 0.45) * (1 + 0.12 * Math.max(0, Math.sin(clamp((u - L('tents')) / 0.4) * Math.PI))); if (p > 0) ger(ctx, x, y, s * p, { smoke: true, t }); });
    // people
    const R = rng(3);
    for (let i = 0; i < 16; i++) { const x = 520 + R() * 1400, y = 820 + R() * 120; const p = pop(u, L('million') - 0.3 + i * 0.03, 0.35); if (p > 0) mini(ctx, x, y, 54 * p, ['#2f5fd0', '#c0392b', '#2fae8a', '#9a6cff', '#e2892b'][i % 5]); }
    // sheep and horses
    for (let i = 0; i < 6; i++) { const p = pop(u, L('sheep') - 0.2 + i * 0.06, 0.4); if (p > 0) sheep(ctx, 700 + i * 120 + (i % 2) * 30, 960 + (i % 3) * 30, 70 * p, t + i, { hop: 0.4, face: i % 2 ? -1 : 1 }); }
    for (let i = 0; i < 3; i++) { const p = seg(u, L('horses') - 0.2 + i * 0.1, L('horses') + 0.6 + i * 0.1); if (p > 0) horse(ctx, lerp(2300, 1500 + i * 150, E.out3(p)), 900 + i * 22, 120, t * 9 + i * 2, { run: 1 - p * 0.8, face: -1, color: ['#8a5a3c', '#e8e0d0', '#4a3a32'][i] }); }
    ctx.restore();
    // "no cities" / "no writing": ghost icons that pop and vanish
    const nc = Math.sin(Math.PI * seg(u, L('cities') - 0.3, L('cities') + 0.8)), nw = Math.sin(Math.PI * seg(u, L('writing') - 0.3, L('writing') + 0.9));
    if (nc > 0) { ctx.save(); ctx.globalAlpha = nc; ctx.translate(700, 330); ctx.scale(1.4, 1.4); skylineCity(ctx); noSign(ctx, 0, -10, 110, seg(u, L('cities'), L('cities') + 0.3)); ctx.restore(); }
    if (nw > 0) { ctx.save(); ctx.globalAlpha = nw; ctx.translate(1240, 330); scroll(ctx, 1.2, seg(u, L('writing') - 0.3, L('writing') + 0.2)); noSign(ctx, 0, 0, 120, seg(u, L('writing') + 0.1, L('writing') + 0.4)); ctx.restore(); }
    // clans clash: two banner groups charge in and bump
    const pc = seg(u, L('clans') - 0.4, L('clans') + 0.3);
    if (pc > 0) {
      ctx.save(); applyCam(ctx, cam, 1);
      const hit = L('fought'), b = (x, tt) => u > tt ? Math.sin(Math.min(1, (u - tt) * 5) * Math.PI) * 50 : 0;
      for (const side of [-1, 1]) {
        const base = 1210 + side * lerp(900, 240, E.out3(seg(u, L('clans') - 0.4, hit))) + side * (b(hit) + b(L('other'))) ;
        tug(ctx, base + side * 60, 960, 90, t, { color: side < 0 ? '#c0392b' : '#2fae8a', alpha: clamp(pc * 2) });
        for (let i = 0; i < 3; i++) rider(ctx, base + side * (i * 110 + 100), 1000 + i * 26, 105, t * 10 + i, { face: -side, body: side < 0 ? '#c0392b' : '#2fae8a', hatColor: side < 0 ? '#7a1f1f' : '#1f6a52', t });
      }
      for (const tt of [hit, L('other')]) { const q = seg(u, tt, tt + 0.6); if (q > 0 && q < 1) { ctx.globalAlpha = 1 - q; for (let i = 0; i < 7; i++) circle(ctx, 1210 + Math.cos(i) * q * 160, 930 + Math.sin(i * 2) * q * 70 - q * 40, 30 + q * 40, '#e9d6a8'); ctx.globalAlpha = 1; } }
      ctx.restore();
    }
    steppeFg(ctx, cam, t);
    title(ctx, 'AN OCEAN OF GRASS', W / 2, 250, 66, seg(u, L('ocean') - 0.2, L('ocean') + 0.6) * (1 - seg(u, L('Here') - 0.4, L('Here'))), { color: '#ffffff' });
  }
  cloudWipe(ctx, Math.sin(Math.PI * seg(u, tDive - 0.3, tDive + 1.0)), t);
}
function skylineCity(ctx) { ctx.fillStyle = '#7d8aa6'; ctx.fillRect(-110, -20, 220, 70); for (let i = -110; i < 110; i += 30) ctx.fillRect(i, -36, 18, 18); ctx.fillStyle = '#5a6684'; ctx.fillRect(-90, -90, 50, 140); ctx.fillRect(40, -110, 50, 160); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(-96, -90); ctx.lineTo(-65, -124); ctx.lineTo(-34, -90); ctx.moveTo(34, -110); ctx.lineTo(65, -146); ctx.lineTo(96, -110); ctx.fill(); }
function scroll(ctx, s, k) { ctx.save(); ctx.scale(s, s); ctx.fillStyle = '#f4ead2'; ctx.fillRect(-90 * k, -60, 180 * k, 120); ctx.fillStyle = '#c9a66b'; rrect(ctx, -100 * k - 12, -70, 24, 140, 10); ctx.fill(); rrect(ctx, 100 * k - 12, -70, 24, 140, 10); ctx.fill(); ctx.restore(); }
function noSign(ctx, x, y, r, p) { if (p <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(E.outBack(p), E.outBack(p)); ctx.strokeStyle = PAL.war; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.moveTo(-r * 0.7, -r * 0.7); ctx.lineTo(r * 0.7, r * 0.7); ctx.stroke(); ctx.restore(); }

// S4 — Temüjin: father poisoned, abandoned in the cold, eight of nine horses stolen, the wooden collar, escape
function s4(ctx, u, d, t) {
  const L = (id, n = 0) => lw('boy', id, n);
  const cold = seg(u, L('left'), L('cold') + 0.4);
  const cam = camKeys([{ t: 0, v: [960, 560, 1.0, 0.0] }, { t: L('born'), v: [900, 600, 1.12, -0.01] }, { t: L('father'), v: [860, 610, 1.22, 0.0] }, { t: L('Thieves'), v: [1060, 600, 1.0, 0.01] }, { t: L('captured'), v: [880, 640, 1.3, 0.0] }, { t: L('escaped') - 0.1, v: [880, 650, 1.4, 0.0] }, { t: d, v: [1500, 640, 1.2, 0.03] }], u);
  const sh = shake(u, L('collar'), 18) + shake(u, L('escaped') - 0.05, 12);
  cam.x += sh; cam.y += sh * 0.5;
  steppe(ctx, cam, t, { sky: blendCols(SKIES.day, SKIES.cold, cold), grass: blendCols(GRASS.day, GRASS.cold, cold), snow: cold, waves: 0.6 });
  ctx.save(); applyCam(ctx, cam, 1);
  // the clan camp leaves: gers slide away and fade
  const leave = E.in2(seg(u, L('left'), L('cold') + 0.3));
  [[300, 720, 120], [1500, 720, 130], [1750, 750, 110], [200, 760, 140]].forEach(([x, y, s], i) => ger(ctx, x + (x < 900 ? -1 : 1) * leave * 900, y - leave * 60, s, { alpha: 1 - leave }));
  ger(ctx, 650, 790, 170, { smoke: cold < 0.5, t });
  // family: mother and siblings stay
  dude(ctx, 520, 960, 190, t, { body: '#9a6cff', hair: '#2a1d3f', look: [0.4, 0], mood: cold > 0.3 ? 'scared' : 'calm', seed: 0.4 });
  mini(ctx, 450, 990, 80, '#e2892b'); mini(ctx, 600, 1000, 70, '#2fae8a');
  // father fades like a ghost after the poisoned cup tips
  const fp = pop(u, L('When') - 0.2, 0.5), gone = seg(u, L('poisoned') + 0.2, L('poisoned') + 1.2);
  if (fp > 0 && gone < 1) { dude(ctx, 1020, 980 - gone * 80, 240 * fp, t, { body: '#3a5a9a', hat: { kind: 'mongol', color: '#7a1f1f' }, look: [-0.6, 0], alpha: 1 - gone, seed: 0.1 }); }
  if (u > L('poisoned') - 0.4 && u < L('poisoned') + 1.4) { const k = seg(u, L('poisoned') - 0.2, L('poisoned') + 0.2); ctx.save(); ctx.translate(1110, 850); ctx.rotate(k * 1.6); ctx.globalAlpha = 1 - seg(u, L('poisoned') + 0.9, L('poisoned') + 1.4); ctx.fillStyle = '#c9a66b'; ctx.beginPath(); ctx.moveTo(-26, -30); ctx.lineTo(26, -30); ctx.lineTo(18, 20); ctx.lineTo(-18, 20); ctx.fill(); ctx.fillStyle = '#5b2a7a'; ctx.fillRect(-22, -30, 44, 10); ctx.restore(); if (k > 0.6) { ctx.fillStyle = '#5b2a7a'; ctx.globalAlpha = 0.7; circle(ctx, 1150 + k * 20, 880 + k * 20, 10 * k, '#5b2a7a'); ctx.globalAlpha = 1; } }
  // the boy
  const bp = pop(u, L('boy') - 0.2, 0.45);
  const run = seg(u, L('escaped') - 0.1, L('escaped') + 1.2);
  const coll = seg(u, L('collar') - 0.35, L('collar')), crack = seg(u, L('escaped') - 0.25, L('escaped') + 0.4);
  const bx = 820 + E.in2(run) * 1100;
  if (bp > 0) {
    const dd = dude(ctx, bx, 990, 170 * bp, t, { body: '#2f5fd0', hat: { kind: 'mongol', color: '#c0392b' }, look: run > 0 ? [1, 0] : [0.2, 0], mood: u > L('captured') && u < L('escaped') ? 'scared' : (gone > 0.3 && u < L('Thieves') ? 'scared' : 'calm'), lean: run * 0.25, seed: 0.7 });
    if (coll > 0 && crack < 1) {
      const y0 = lerp(-400, dd.headY + dd.hr * 0.95, E.in3(coll));
      for (const side of [-1, 1]) { const off = side * E.out3(crack) * 260, rot = side * crack * 1.4; ctx.save(); ctx.translate(dd.headX + off * 0.3 + side * 0.1, y0 - crack * 120 + crack * crack * 300); ctx.rotate(rot); ctx.globalAlpha = 1 - seg(crack, 0.6, 1); ctx.fillStyle = '#9a6a3c'; ctx.fillRect(side < 0 ? -150 : 0, -26, 150, 52); ctx.fillStyle = '#7a4f2a'; ctx.fillRect(side < 0 ? -150 : 0, 10, 150, 16); ctx.fillStyle = '#4a2f18'; ctx.beginPath(); ctx.arc(0, 0, 20, side < 0 ? Math.PI / 2 : -Math.PI / 2, side < 0 ? Math.PI * 1.5 : Math.PI / 2); ctx.fill(); ctx.restore(); }
    }
  }
  // nine horses; thieves take eight
  const hp = seg(u, L('Thieves') - 1.0, L('Thieves') - 0.4), steal = seg(u, L('stole'), L('horses') + 0.9);
  if (hp > 0) for (let i = 0; i < 9; i++) {
    const keep = i === 4; const go = keep ? 0 : E.in2(clamp(steal * 1.4 - i * 0.04));
    const x = 1180 + i * 75 + go * 1500, y = 930 + (i % 2) * 24;
    if (x < 3000) horse(ctx, lerp(2400, x, E.out3(hp)), y, 92, t * (go > 0 ? 10 : 0.5) + i, { run: go > 0 ? 1 : 0, face: 1, color: ['#8a5a3c', '#e8e0d0', '#4a3a32', '#b07a4a', '#8a5a3c', '#5a4030', '#d0b48a', '#6a4a3a', '#a58a6a'][i], graze: !go && Math.sin(t + i) > 0.7 });
    if (!keep && go > 0 && go < 0.8) { mini(ctx, x - 40, y - 30, 70, '#2a2224'); }
  }
  ctx.restore();
  steppeFg(ctx, cam, t, { grass: cold > 0.5 ? 'cold' : 'day' });
  // labels
  title(ctx, '1162', W / 2, 220, 120, seg(u, L('1162') - 0.4, L('1162') + 0.4) * (1 - seg(u, L('boy') + 0.6, L('boy') + 1.0)));
  label(ctx, 'TEMÜJIN', 820 - (cam.x - 960) * 0.3, 640, 34, { color: '#fff', bg: 'rgba(47,95,208,0.9)', alpha: seg(u, L('Temüjin') - 0.1, L('Temüjin') + 0.3) * (1 - seg(u, L('When') - 0.2, L('When') + 0.2)) });
  const nine = seg(u, L('eight') - 0.2, L('eight') + 0.2) * (1 - seg(u, L('Temüjin', 1) - 0.4, L('Temüjin', 1)));
  if (nine > 0) { label(ctx, '9', 1380, 300, 140, { color: '#ffffff', alpha: nine * (1 - seg(u, L('horses') + 0.3, L('horses') + 0.5)), weight: 900 }); label(ctx, '1', 1380, 300, 140, { color: PAL.gold, alpha: seg(u, L('horses') + 0.3, L('horses') + 0.5) * nine, weight: 900 }); label(ctx, 'HORSES LEFT', 1380, 400, 30, { color: '#fff', bg: 'rgba(20,30,60,0.75)', alpha: nine }); }
}

// S5 — he unites the tribes (friends, deals, battles) → 1206: GENGHIS KHAN
const CLANS = [[-760, '#c0392b'], [-470, '#2fae8a'], [-200, '#9a6cff'], [220, '#e2892b'], [500, '#5ab0e0'], [780, '#d94a8a']];
function s5(ctx, u, d, t) {
  const L = (id, n = 0) => lw('khan', id, n);
  const cam = camKeys([{ t: 0, v: [960, 520, 0.85, 0.0] }, { t: L('united'), v: [960, 540, 0.95, -0.01] }, { t: L('Genghis') - 0.3, v: [960, 520, 1.05, 0.0] }, { t: d, v: [960, 500, 1.12, 0.01] }], u);
  steppe(ctx, cam, t, { sky: 'warm', waves: 0.8 });
  ctx.save(); applyCam(ctx, cam, 1);
  const merges = [L('friends'), L('deals'), L('battles'), L('united'), L('tribes'), L('steppe')];
  CLANS.forEach(([dx, col], i) => {
    const m = E.inOut(seg(u, merges[i] - 0.3, merges[i] + 0.5));
    const x = 960 + dx * (1 - m), y = 930 - Math.sin(m * Math.PI) * 40;
    if (m < 1) { tug(ctx, x, y, 90, t + i, { color: col, alpha: 1 - seg(m, 0.85, 1) }); for (let k = 0; k < 2; k++) mini(ctx, x - 50 + k * 100, y + 50, 60, col, { lean: Math.sin(t * 3 + k) * 0.05 }); }
    if (Math.abs(u - merges[i] - 0.4) < 0.3) glow(ctx, 960, 830, 220, 'rgba(255,240,200,0.9)', 1 - Math.abs(u - merges[i] - 0.4) / 0.3);
  });
  // icons for friends / deals / battles
  [['friends', handshake], ['deals', coinIcon], ['battles', swords]].forEach(([w, fn], i) => { const p = pop(u, L(w) - 0.1, 0.4) * (1 - seg(u, L(w) + 0.9, L(w) + 1.2)); if (p > 0) { ctx.save(); ctx.translate(560 + i * 400, 420); ctx.scale(p, p); circle(ctx, 0, 0, 78, '#fdf3d8'); fn(ctx); ctx.restore(); } });
  const big = seg(u, L('united') - 0.2, L('steppe') + 0.4);
  if (big > 0) { tug(ctx, 960, 930, 150 * E.outBack(big), t, { tails: 9, color: '#f4f1ea', big: true }); }
  const kp = pop(u, L('1206') - 0.6, 0.5);
  if (kp > 0) dude(ctx, 1110, 1000, 280 * kp, t, { body: '#2f5fd0', hat: { kind: 'mongol', color: '#c0392b' }, look: [-0.5, -0.2], mood: 'calm', seed: 0.2 });
  const R = rng(4); for (let i = 0; i < 26; i++) { const p = pop(u, L('Genghis') - 0.4 + i * 0.015, 0.3); if (p > 0) mini(ctx, 300 + R() * 1320, 1060 + R() * 60 - Math.max(0, Math.sin(t * 7 + i)) * 12 * seg(u, L('Genghis'), L('Genghis') + 0.3), 70 * p, CLANS[i % 6][1]); }
  ctx.restore();
  steppeFg(ctx, cam, t);
  title(ctx, '1206', W / 2, 200, 90, seg(u, L('1206') - 0.3, L('1206') + 0.4) * (1 - seg(u, L('Genghis') - 0.5, L('Genghis') - 0.2)), { color: '#ffffff' });
  title(ctx, 'GENGHIS KHAN', W / 2, 250, 120, seg(u, L('Genghis') - 0.1, L('Khan') + 0.4), { color: '#ffffff' });
}
function handshake(ctx) { ctx.fillStyle = PAL.skin; ctx.save(); ctx.rotate(-0.3); rrect(ctx, -60, -18, 70, 36, 18); ctx.fill(); ctx.restore(); ctx.fillStyle = PAL.skinD; ctx.save(); ctx.rotate(0.3); rrect(ctx, -10, -18, 70, 36, 18); ctx.fill(); ctx.restore(); }
function coinIcon(ctx) { for (let i = 0; i < 3; i++) { ctx.fillStyle = PAL.goldD; ctx.beginPath(); ctx.ellipse(0, 24 - i * 16, 40, 14, 0, 0, TAU); ctx.fill(); ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.ellipse(0, 18 - i * 16, 40, 14, 0, 0, TAU); ctx.fill(); } }
function swords(ctx) { for (const s of [-1, 1]) { ctx.save(); ctx.rotate(s * 0.7); ctx.fillStyle = '#c9d4e8'; ctx.beginPath(); ctx.moveTo(-6, 30); ctx.lineTo(-6, -50); ctx.lineTo(0, -62); ctx.lineTo(6, -50); ctx.lineTo(6, 30); ctx.fill(); ctx.fillStyle = '#6b4a2e'; ctx.fillRect(-20, 30, 40, 8); ctx.fillRect(-5, 38, 10, 22); ctx.restore(); } }

// S6 — the rich world around: big neighbours vs a small people → five reasons (the quiver)
const NEIGH = [['JIN', [118, 41], 230], ['SONG', [114, 28], 260], ['XI XIA', [104, 38.5], 120], ['KHWAREZM', [60, 38], 200], ["RUS'", [38, 54], 170], ['ABBASIDS', [44, 33], 140]];
function s6(ctx, u, d, t) {
  const L = (id, n = 0) => lw('question', id, n);
  const v = viewKeys([{ t: 0, v: [102, 44, 1500] }, { t: L('world'), v: [90, 42, 900] }, { t: L('empires'), v: [86, 40, 760] }, { t: d, v: [84, 40, 700] }], u);
  mapBg(ctx);
  const sm = seg(u, L('small') - 0.2, L('small') + 0.3);
  drawGlobe(ctx, v, t, { under: g => { g.save(); g.globalAlpha = 0.9; geoFill(g, v, [REG.core], PAL.mblue); g.restore(); } });
  const [mx, my] = gp(v, [104, 47]);
  NEIGH.forEach(([n, c, r], i) => {
    const p = pop(u, L('rich') - 0.3 + i * 0.12, 0.5); if (p <= 0) return; const [x, y, vis] = gp(v, c); if (vis < 0) return;
    const grow = 1 + 0.35 * seg(u, L('beat') - 0.2, L('empires') + 0.3);
    ctx.save(); ctx.globalAlpha = 0.28 * p; circle(ctx, x, y, r * p * grow * v.R / 900, '#f5d27a'); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.8 * p; ctx.strokeStyle = '#f5d27a'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); circle(ctx, x, y, r * p * grow * v.R / 900, null); ctx.stroke(); ctx.restore();
    label(ctx, n, x, y, 28, { color: '#fff', bg: 'rgba(10,18,44,0.8)', alpha: p });
  });
  label(ctx, 'MONGOLS', mx, my - 44 - sm * 10, 26 + sm * 4, { color: '#fff', bg: 'rgba(47,95,208,0.95)', alpha: seg(u, 0.2, 0.6) });
  mapClouds(ctx, t, 0.15);
  // the quiver of reasons drops in
  const q = seg(u, L('five') - 0.4, L('reasons') + 0.2);
  if (q > 0) { fadeBlack(ctx, q * 0.45, '8,14,40'); const y = lerp(-300, 760, E.outBack(q, 1.2)); quiver(ctx, W / 2, y, 170, t, { nums: true, lit: [0.2, 0.2, 0.2, 0.2, 0.2], rot: 0 }); title(ctx, 'FIVE REASONS', W / 2, 260, 84, seg(u, L('reasons') - 0.3, L('reasons') + 0.4)); }
}

// S7 — reason 1: horses. Spare horses, the hop to a fresh one, the race, shooting at full gallop — even backwards
function s7(ctx, u, d, t) {
  const L = (id, n = 0) => lw('horses', id, n);
  const speed = 520 + 380 * seg(u, L('faster') - 0.6, L('faster'));
  const cx = 960 + u * speed;
  const cam = { x: cx, y: 560 + Math.sin(u * 0.7) * 10, z: 1.0 + 0.06 * Math.sin(u * 0.4), r: 0.012 * Math.sin(u * 0.5) };
  steppe(ctx, cam, t, { sky: 'day', waves: 0.5 });
  const race = Math.sin(Math.PI * seg(u, L('Mongol') - 0.4, L('time') + 0.9));
  ctx.save(); applyCam(ctx, cam, 1);
  const gal = t * 11;
  // the slow army (knights) appears in the race beat, falling behind
  if (race > 0) for (let i = 0; i < 4; i++) { const kx = cx - 500 - i * 150 - (u - L('Mongol')) * 380; ctx.save(); ctx.globalAlpha = race; rider(ctx, kx, 820 + i * 8, 110, t * 4 + i, { body: '#7d8aa6', hat: 'helmet', hatColor: '#9aa4bd', horse: '#6a6a7a', t }); ctx.restore(); }
  // spare horses
  const hopT = L('jumped'), hop = seg(u, hopT - 0.1, hopT + 0.5);
  const spare = [[-230, 40, '#e8e0d0'], [-420, -10, '#4a3a32'], [-600, 30, '#b07a4a']];
  const sp = seg(u, L('several') - 0.6, L('several'));
  const tired = seg(u, hopT + 0.2, hopT + 1.5);
  // draw horses back-to-front; remember the saddles of the brown (first) and the white (fresh) horse
  const herd = spare.map(([dx, dy, c], i) => ({ x: cx + 120 + dx + (1 - E.out3(sp)) * -900 + (i === 0 ? hop * 230 : 0), y: 960 + dy, c, ph: gal + i * 1.7, s: 140, id: i ? 'spare' : 'white' }));
  herd.push({ x: cx + 120 - tired * 700, y: 960, c: '#8a5a3c', ph: gal * (1 - tired * 0.5), s: 150, id: 'brown' });
  herd.sort((p, q) => p.y - q.y);
  const seat = {};
  for (const h of herd) seat[h.id] = horse(ctx, h.x, h.y, h.s, h.ph, { color: h.c, face: 1, saddle: (h.id === 'brown' && hop < 0.5) || (h.id === 'white' && hop >= 0.5) ? '#c0392b' : null });
  if (tired > 0.2) for (let i = 0; i < 3; i++) circle(ctx, cx + 200 - tired * 700 + i * 14, 820 + ((t * 80 + i * 20) % 40), 5, '#9fdcff');
  const shoot1 = L('shoot'), back = L('backwards');
  const pose = u > back - 0.3 ? 'back' : u > shoot1 - 0.3 ? 'bow' : 'ride';
  const k = E.inOut(hop), from = seat.brown, to = seat.white;
  const st = { x: lerp(from.seatX, to.seatX, k), y: lerp(from.seatY, to.seatY, k) - Math.sin(Math.PI * hop) * 150 + 38 };
  dude(ctx, st.x, st.y, 142, t, { body: PAL.mblue, hat: { kind: 'mongol', color: '#c0392b' }, arms: pose === 'ride' ? (hop > 0 && hop < 1 ? 'up' : 'down') : 'shrug', look: [pose === 'back' ? -1 : 1, 0], noShadow: true });
  st.y += 150 * 0.98 - 150 * 0.18 - 38 + 38;
  if (pose !== 'ride') { const dir = pose === 'back' ? -1 : 1; ctx.save(); ctx.translate(st.x + dir * 64, st.y - 190); ctx.scale(dir, 1); ctx.strokeStyle = '#6b3d1f'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 46, -1.1, 1.1); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(Math.cos(-1.1) * 46, Math.sin(-1.1) * 46); ctx.lineTo(Math.cos(1.1) * 46, Math.sin(1.1) * 46); ctx.stroke(); ctx.restore(); }
  for (const [tt, dir] of [[shoot1 + 0.2, 1], [L('gallop') + 0.1, 1], [back + 0.25, -1]]) { const k = seg(u, tt, tt + 0.7); if (k > 0 && k < 1) arrow(ctx, st.x + dir * (80 + k * 1100), st.y - 190 - Math.sin(k * Math.PI) * 60, dir > 0 ? -0.05 + k * 0.1 : Math.PI + 0.05 - k * 0.1, 70); }
  ctx.restore();
  // speed lines in the race
  if (race > 0) { ctx.save(); ctx.globalAlpha = race * 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; for (let i = 0; i < 14; i++) { const y = 300 + (i * 97) % 700, x = (W - ((t * 2400 + i * 330) % (W + 600))); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 200, y); ctx.stroke(); } ctx.restore(); label(ctx, 'FASTER THAN ANY ARMY', W / 2, 250, 40, { color: '#fff', bg: 'rgba(47,95,208,0.9)', alpha: race }); }
  steppeFg(ctx, cam, t);
  reasonTitle(ctx, 1, 'HORSES', u, L('One'), { out: L('Every') });
  label(ctx, 'SEVERAL HORSES PER RIDER', W / 2, 250, 36, { color: '#fff', bg: 'rgba(20,30,60,0.75)', alpha: seg(u, L('several') - 0.2, L('several') + 0.3) * (1 - seg(u, L('Mongol') - 0.6, L('Mongol') - 0.2)) });
  label(ctx, 'EVEN BACKWARDS', W / 2, 250, 44, { color: '#fff', bg: 'rgba(217,74,58,0.92)', alpha: seg(u, back - 0.1, back + 0.3) });
}

// S8 — reason 2: a new army. Clans broken apart, decimal units 10 → 10,000, skill not family, Subutai the blacksmith's son
function s8(ctx, u, d, t) {
  const L = (id, n = 0) => lw('army', id, n);
  const lv = [L('ten'), L('hundred'), L('thousand'), L('ten', 1)];
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f6eedb'); g.addColorStop(1, '#e8d8b4'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // felt pattern
  ctx.save(); ctx.globalAlpha = 0.07; ctx.strokeStyle = '#8a4f2c'; ctx.lineWidth = 6; for (let x = -200; x < W + 200; x += 160) { ctx.beginPath(); for (let y = 0; y <= H; y += 40) ctx.lineTo(x + Math.sin(y * 0.03 + t * 0.2) * 30, y); ctx.stroke(); } ctx.restore();
  const leaders = seg(u, L('Leaders') - 0.4, L('Leaders') + 0.2);
  const cols = ['#c0392b', '#2fae8a', '#9a6cff', '#e2892b', '#2f5fd0'];
  // layout: arban = row of 10, jagun = 10 rows, mingghan = 5×2 jaguns, tumen = 5×2 mingghans
  const pos = i => { const a = i % 10, b = Math.floor(i / 10) % 10, c = Math.floor(i / 100) % 10, e = Math.floor(i / 1000); return [a * 22 + (c % 5) * 250 + (e % 5) * 1300, b * 22 + Math.floor(c / 5) * 250 + Math.floor(e / 5) * 530]; };
  const LV = [{ c: [99, 0], z: 3.0 }, { c: [99, 99], z: 2.3 }, { c: [599, 224], z: 1.2 }, { c: [3199, 489], z: 0.26 }];
  const lk = [seg(u, lv[1] - 0.1, lv[1] + 0.5), seg(u, lv[2] - 0.1, lv[2] + 0.5), seg(u, lv[3] - 0.1, lv[3] + 0.7)].map(E.inOut);
  let cxl = LV[0].c[0], cyl = LV[0].c[1], lz = Math.log(LV[0].z);
  lk.forEach((k, j) => { cxl = lerp(cxl, LV[j + 1].c[0], k); cyl = lerp(cyl, LV[j + 1].c[1], k); lz = lerp(lz, Math.log(LV[j + 1].z), k); });
  const zoom = Math.exp(lz) * (1 + 0.03 * Math.sin(u * 0.6));
  if (leaders < 1) {
    ctx.save(); ctx.globalAlpha = 1 - leaders;
    const mixK = E.inOut(seg(u, L('broke') - 0.2, L('apart') + 0.6)), toRow = E.inOut(seg(u, lv[0] - 0.5, lv[0] + 0.1));
    const R = rng(21);
    // before the units: 50 warriors in 5 clan clusters → broken apart and mixed (screen space)
    if (toRow < 1) for (let i = 0; i < 50; i++) {
      const cl = i % 5, ang = cl / 5 * TAU + 0.5, ox = W / 2 + Math.cos(ang) * 330 + (R() - 0.5) * 120, oy = 600 + Math.sin(ang) * 220 + (R() - 0.5) * 100;
      const mx = W / 2 + (R() - 0.5) * 900, my = 600 + (R() - 0.5) * 420;
      let x = lerp(ox, mx, mixK), y = lerp(oy, my, mixK);
      if (i < 10) { x = lerp(x, W / 2 + (pos(i)[0] - cxl) * zoom, toRow); y = lerp(y, 600 + (pos(i)[1] - cyl) * zoom, toRow); }
      ctx.globalAlpha = (1 - leaders) * (i < 10 ? 1 : 1 - toRow); circle(ctx, x, y, 14, cols[cl]);
    }
    // the units, in world space centred on the current level
    if (toRow > 0) {
      ctx.translate(W / 2, 600); ctx.scale(zoom, zoom); ctx.translate(-cxl, -cyl);
      const n = u < lv[1] - 0.15 ? 10 : u < lv[2] - 0.15 ? 100 : u < lv[3] - 0.15 ? 1000 : 10000;
      const R2 = rng(5);
      for (let i = 0; i < n; i++) {
        const show = i < 10 ? toRow : i < 100 ? seg(u, lv[1] - 0.15, lv[1] + 0.25 + i * 0.002) : i < 1000 ? seg(u, lv[2] - 0.15, lv[2] + 0.3) : seg(u, lv[3] - 0.15, lv[3] + 0.4);
        const c = cols[Math.floor(R2() * 5)]; if (show <= 0) continue;
        const [x, y] = pos(i); ctx.globalAlpha = (1 - leaders) * show; ctx.fillStyle = c;
        if (zoom * 16 > 6) { ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill(); } else ctx.fillRect(x - 8, y - 8, 16, 16);
      }
    }
    ctx.restore();
    const names = [['10', 'ARBAN'], ['100', 'JAGUN'], ['1,000', 'MINGGHAN'], ['10,000', 'TUMEN']];
    names.forEach(([nm, w], i) => { const p = seg(u, lv[i] - 0.15, lv[i] + 0.25) * (1 - (i < 3 ? seg(u, lv[i + 1] - 0.3, lv[i + 1]) : leaders)); if (p > 0) { title(ctx, nm, W / 2, 230, 110, p, { color: PAL.mblueD, shadow: 'rgba(0,0,0,0)' }); label(ctx, w, W / 2, 300, 34, { color: '#fff', bg: PAL.mblue, alpha: p }); } });
  }
  // skill, not family
  if (leaders > 0) {
    const out = seg(u, L('Subutai') - 0.4, L('Subutai'));
    ctx.save(); ctx.globalAlpha = leaders * (1 - out);
    const fp = pop(u, L('not') - 0.2, 0.4), sp = pop(u, L('Leaders') - 0.1, 0.4);
    if (sp > 0) { ctx.save(); ctx.translate(640, 560); ctx.scale(sp, sp); circle(ctx, 0, 0, 170, '#ffffff'); star(ctx, 0, -10, 100, PAL.gold); label(ctx, 'SKILL', 0, 120, 34, { color: '#fff', bg: PAL.jade }); ctx.restore(); }
    if (fp > 0) { ctx.save(); ctx.translate(1280, 560); ctx.scale(fp, fp); circle(ctx, 0, 0, 170, '#ffffff'); familyTree(ctx); noSign(ctx, 0, 0, 150, seg(u, L('family'), L('family') + 0.3)); label(ctx, 'FAMILY', 0, 120, 34, { color: '#fff', bg: PAL.war }); ctx.restore(); }
    ctx.restore();
    // Subutai: a blacksmith's son becomes a general
    const sp2 = seg(u, L('Subutai') - 0.3, L('Subutai') + 0.2);
    if (sp2 > 0) {
      const gen = seg(u, L('became') - 0.2, L('generals') + 0.2);
      ctx.save(); ctx.globalAlpha = sp2;
      const hammer = Math.max(0, Math.sin((u - L('son')) * 7)) * (1 - gen);
      // anvil
      ctx.fillStyle = '#4a4f5c'; ctx.globalAlpha = sp2 * (1 - gen); ctx.beginPath(); ctx.moveTo(760, 780); ctx.lineTo(1000, 780); ctx.lineTo(980, 820); ctx.lineTo(920, 830); ctx.lineTo(920, 900); ctx.lineTo(840, 900); ctx.lineTo(840, 830); ctx.lineTo(720, 800); ctx.closePath(); ctx.fill();
      if (hammer > 0.9) for (let i = 0; i < 8; i++) circle(ctx, 870 + Math.cos(i) * 60 * (hammer - 0.9) * 10, 770 - Math.abs(Math.sin(i * 2)) * 60 * (hammer - 0.9) * 10, 5, '#ffb547');
      ctx.globalAlpha = sp2;
      const dd = dude(ctx, 1080, 960, 300, t, { body: gen > 0.5 ? '#7a2a2a' : '#6b4a2e', hat: gen > 0.5 ? { kind: 'helmet', color: '#8d97ad', crest: '#c0392b' } : null, arms: gen > 0.5 ? 'down' : 'work', look: [-0.4, 0], mood: gen > 0.5 ? 'happy' : 'calm', seed: 0.3 });
      if (gen > 0) tug(ctx, 1290, 990, 130 * E.outBack(gen), t, { color: '#f4f1ea', tails: 3 });
      label(ctx, 'SUBUTAI', 1080, 560, 36, { color: '#fff', bg: PAL.mblue, alpha: seg(u, L('Subutai'), L('Subutai') + 0.3) });
      label(ctx, gen > 0.5 ? 'GENERAL' : "BLACKSMITH'S SON", 1080, 1030, 26, { color: '#fff', bg: 'rgba(20,30,60,0.8)', alpha: seg(u, L('blacksmith') - 0.2, L('blacksmith') + 0.2) });
      ctx.restore();
    }
  }
  reasonTitle(ctx, 2, 'A NEW KIND OF ARMY', u, L('Two'), { out: L('Genghis') + 0.2, color: '#1d2a55' });
}
function star(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); }
function familyTree(ctx) { ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, -20); ctx.moveTo(-60, -20); ctx.lineTo(60, -20); ctx.moveTo(-60, -20); ctx.lineTo(-60, 20); ctx.moveTo(60, -20); ctx.lineTo(60, 20); ctx.stroke(); for (const [x, y] of [[0, -70], [-60, 30], [60, 30]]) circle(ctx, x, y, 22, '#c9a66b'); }

// S9 — reason 3: information. The Yam relay, ~200 km a day, spies and traders feed the khan
function s9(ctx, u, d, t) {
  const L = (id, n = 0) => lw('news', id, n);
  const v = viewKeys([{ t: 0, v: [96, 45, 1900] }, { t: L('Yam'), v: [90, 44, 1500] }, { t: L('horses'), v: [84, 43, 1300] }, { t: L('messenger'), v: [92, 44, 1900] }, { t: L('day'), v: [70, 41, 1900] }, { t: L('spies'), v: [80, 42, 1250] }, { t: d, v: [80, 42, 1200] }], u);
  mapBg(ctx);
  drawGlobe(ctx, v, t, { under: g => { g.save(); g.globalAlpha = 0.75; geoFill(g, v, [REG.core], PAL.mblue); g.restore(); } });
  // road + stations
  const rp = seg(u, L('built') - 0.2, L('horses') + 0.2);
  const pts = ROAD_OPEN.slice(KK, ROAD_OPEN.length - 12).map(c => gp(v, c));
  if (rp > 0) {
    ctx.save(); ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 5; ctx.setLineDash([14, 12]); ctx.lineDashOffset = -t * 30; ctx.beginPath();
    const n = Math.max(2, Math.floor(pts.length * rp)); pts.slice(0, n).forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore();
    pts.forEach((p, i) => { if (i % 6 || i / pts.length > rp) return; const q = pop(u, L('built') - 0.2 + i * 0.035, 0.35); ctx.save(); ctx.translate(p[0], p[1]); ger(ctx, 0, 0, 34 * q); tug(ctx, 26, 0, 22 * q, t + i, { color: PAL.gold }); ctx.restore(); });
  }
  // relay messenger: a glowing token running station to station, flash at each handover
  const mp = seg(u, L('messenger') - 0.2, L('day') + 0.6);
  if (mp > 0 && mp < 1) {
    const f = mp * (pts.length - 1), i = Math.floor(f), k = f - i; const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)];
    const x = lerp(a[0], b[0], k), y = lerp(a[1], b[1], k);
    glow(ctx, x, y, 90, 'rgba(255,220,120,0.9)', 0.9); horse(ctx, x, y + 10, 46, t * 14, { face: b[0] > a[0] ? 1 : -1, color: '#f4e2b8', noShadow: true });
    for (let j = 1; j <= i; j++) { const age = f - j; if (age < 2.0 && j % 6 === 0) glow(ctx, pts[j][0], pts[j][1], 70, 'rgba(255,255,255,0.9)', 1 - age / 0.6); }
  }
  const kp = seg(u, L('two') - 0.2, L('day') + 0.2) * (1 - seg(u, L('spies') - 0.4, L('spies')));
  if (kp > 0) { title(ctx, '≈ 200 KM', W / 2, 220, 100, kp, { color: '#ffffff' }); label(ctx, 'IN A SINGLE DAY', W / 2, 290, 30, { color: '#fff', bg: 'rgba(20,30,60,0.8)', alpha: kp }); }
  // spies & traders: notes fly back to the khan, cities get "intel cards"
  const sp = seg(u, L('spies') - 0.2, L('spies') + 0.4);
  if (sp > 0) {
    const [kx, ky] = gp(v, CITY.karakorum);
    ger(ctx, kx, ky + 10, 70 * E.outBack(sp)); tug(ctx, kx + 50, ky + 10, 50 * sp, t, { tails: 9, color: '#f4f1ea' });
    const cities = [['SAMARKAND', CITY.samarkand, 'WALLS: HIGH'], ['BUKHARA', CITY.bukhara, 'ARMY: SPLIT'], ['URGENCH', CITY.urgench, 'SHAH: AWAY'], ['KASHGAR', CITY.kashgar, 'GATES: 4']];
    cities.forEach(([n, c, info], i) => {
      const p = pop(u, L('spies') + i * 0.18, 0.4); if (p <= 0) return; const [x, y] = gp(v, c);
      cityDot(ctx, v, c, n, p, { color: '#ffffff', core: PAL.war, size: 20 });
      // caravan/spy walking to the city
      const w = seg(u, L('spies') + i * 0.15, L('traders') + 0.6 + i * 0.1); if (w < 1) mini(ctx, lerp(kx, x, w), lerp(ky, y, w) + 8, 34, i % 2 ? '#2a2224' : '#c9a66b');
      // note flies back
      for (let r = 0; r < 2; r++) { const k = seg(u, L('told') + i * 0.2 + r * 0.5, L('told') + i * 0.2 + r * 0.5 + 0.9); if (k > 0 && k < 1) { ctx.save(); ctx.translate(lerp(x, kx, k), lerp(y, ky, k) - Math.sin(k * Math.PI) * 120); ctx.rotate(k * 6); ctx.fillStyle = '#fbf6e6'; ctx.fillRect(-14, -10, 28, 20); ctx.fillStyle = '#9a8a6a'; ctx.fillRect(-9, -4, 18, 3); ctx.fillRect(-9, 2, 12, 3); ctx.restore(); } }
      const ic = seg(u, L('everything') + i * 0.12, L('everything') + i * 0.12 + 0.3);
      if (ic > 0) label(ctx, info, x, y + 40, 18, { color: '#1d2a55', bg: '#fdf3d8', alpha: ic, font: 'Montserrat' });
    });
    const bp = seg(u, L('battle') - 0.4, L('battle') + 0.2);
    if (bp > 0) { ctx.save(); ctx.globalAlpha = bp * 0.8; const [x, y] = gp(v, [66, 41]); ctx.translate(x, y - 60); ctx.scale(0.6, 0.6); swords(ctx); ctx.restore(); label(ctx, 'FIRST BATTLE: LATER', W / 2, 950, 28, { color: '#fff', bg: 'rgba(20,30,60,0.8)', alpha: bp }); }
  }
  mapClouds(ctx, t, 0.18);
  reasonTitle(ctx, 3, 'INFORMATION', u, L('Three'), { out: L('Mongols') + 0.3 });
  label(ctx, 'THE YAM', W / 2, 330, 52, { color: '#fff', bg: 'rgba(47,95,208,0.92)', alpha: seg(u, L('Yam') + 0.1, L('Yam') + 0.4) * (1 - seg(u, L('messenger') - 0.4, L('messenger'))) });
}

// S10 — reason 4: they learned fast. Riders bounce off a wall; Chinese and Persian engineers; trebuchet; gunpowder bomb
function s10(ctx, u, d, t) {
  const L = (id, n = 0) => lw('learn', id, n);
  const boom = L('bombs') + 0.45;
  const cam = camKeys([{ t: 0, v: [900, 560, 0.95, 0.0] }, { t: L('walled'), v: [1060, 560, 1.05, 0.01] }, { t: L('engineers'), v: [820, 580, 1.0, -0.01] }, { t: L('catapults'), v: [960, 560, 0.92, 0.0] }, { t: d, v: [1080, 540, 1.0, 0.012] }], u);
  const sh = shake(u, boom, 26) + shake(u, L('catapults') + 0.9, 10); cam.x += sh; cam.y += sh * 0.6;
  steppe(ctx, cam, t, { sky: 'warm', waves: 0.4 });
  ctx.save(); applyCam(ctx, cam, 1);
  // the wall (right side); a breach after the bomb
  const breach = seg(u, boom, boom + 0.5);
  ctx.fillStyle = '#a89a86'; ctx.fillRect(1380, 520, 900, 480); ctx.fillStyle = '#8f816e'; for (let y = 540; y < 1000; y += 50) for (let x = 1380 + ((y / 50) % 2) * 40; x < 2280; x += 80) ctx.fillRect(x, y, 70, 6);
  for (let x = 1380; x < 2280; x += 70) { ctx.fillStyle = '#a89a86'; ctx.fillRect(x, 480, 44, 44); }
  ctx.fillStyle = '#7a6d5c'; ctx.fillRect(1380, 520, 26, 480);
  if (breach > 0) { ctx.save(); ctx.fillStyle = mix(SKIES.warm[1], '#f6d9a0', 0.2); ctx.beginPath(); ctx.moveTo(1380, 1000); ctx.lineTo(1380, 1000 - 380 * E.out3(breach)); ctx.lineTo(1480, 1000 - 300 * E.out3(breach)); ctx.lineTo(1560, 1000 - 420 * E.out3(breach)); ctx.lineTo(1640, 1000); ctx.fill(); ctx.restore();
    const R = rng(77); for (let i = 0; i < 18; i++) { const k = seg(u, boom, boom + 1.4); const vx = (R() - 0.2) * 900, vy = -R() * 900; ctx.fillStyle = '#a89a86'; ctx.fillRect(1480 + vx * k, 800 + vy * k + 1400 * k * k, 30, 22); } }
  label(ctx, 'WALLED CITY', 1830, 440, 30, { color: '#fff', bg: 'rgba(20,30,60,0.8)', alpha: seg(u, L('walled') - 0.2, L('walled') + 0.2) });
  // riders bounce off
  const charge = seg(u, L('At') - 0.4, L('cities') + 0.6);
  if (charge > 0 && charge < 1) for (let i = 0; i < 3; i++) { const k = E.inOut(clamp(charge * 1.3 - i * 0.12)); const x = k < 0.6 ? lerp(300, 1250, k / 0.6) : lerp(1250, 900, (k - 0.6) / 0.4); rider(ctx, x - i * 120, 980 + i * 14, 120, t * 10 + i, { face: k < 0.6 ? 1 : -1, t, mood: k > 0.6 ? 'scared' : 'calm' }); }
  for (let i = 0; i < 6; i++) { const k = seg(u, L('take') - 0.3 + i * 0.05, L('take') + 0.1 + i * 0.05); if (k > 0) arrow(ctx, lerp(900, 1395, k), 700 + i * 40 - Math.sin(k * Math.PI) * 80, 0.02, 60); }
  // engineers walk in with plans
  const ep = seg(u, L('brought') - 0.3, L('engineers') + 0.5);
  if (ep > 0) { const x = lerp(-200, 520, E.out3(ep)); dude(ctx, x, 1000, 200, t, { body: '#2fae8a', hat: { kind: 'cap', color: '#1a1a2a' }, look: [1, 0], arms: 'cross', seed: 0.4 }); dude(ctx, x + 150, 1010, 210, t, { body: '#9a6cff', hat: { kind: 'cap', color: '#f4f1ea' }, look: [1, 0], arms: 'work', seed: 0.8 });
    label(ctx, 'CHINESE', x, 720, 22, { color: '#fff', bg: 'rgba(20,30,60,0.8)', alpha: seg(u, L('Chinese') - 0.1, L('Chinese') + 0.3) }); label(ctx, 'PERSIAN', x + 150, 710, 22, { color: '#fff', bg: 'rgba(20,30,60,0.8)', alpha: seg(u, L('Persian') - 0.1, L('Persian') + 0.3) });
    const bl = pop(u, L('engineers') - 0.1, 0.4); if (bl > 0) { ctx.save(); ctx.translate(x + 75, 760); ctx.scale(bl, bl); ctx.fillStyle = '#2f5a8a'; rrect(ctx, -70, -46, 140, 92, 8); ctx.fill(); ctx.strokeStyle = '#bfe6f5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-40, 30); ctx.lineTo(30, -24); ctx.lineTo(40, 30); ctx.moveTo(-50, 30); ctx.lineTo(50, 30); ctx.stroke(); ctx.restore(); } }
  // trebuchet assembles and throws
  const tp = seg(u, L('Soon') - 0.2, L('catapults') + 0.1);
  if (tp > 0) {
    const fire = seg(u, L('catapults') + 0.1, L('catapults') + 0.5);
    ctx.save(); ctx.translate(900, 1000);
    const pieces = [[0, -120, 30, 240, 0], [-110, -10, 220, 26, 0.15]];
    ctx.fillStyle = '#7a4f2a'; ctx.fillRect(-110, -30, 220, 30); ctx.globalAlpha = clamp(tp * 3);
    ctx.fillStyle = '#8a5a34'; ctx.beginPath(); ctx.moveTo(-90, -30); ctx.lineTo(-10, -230 * E.outBack(tp)); ctx.lineTo(10, -230 * E.outBack(tp)); ctx.lineTo(90, -30); ctx.lineTo(60, -30); ctx.lineTo(0, -200 * E.outBack(tp)); ctx.lineTo(-60, -30); ctx.fill();
    ctx.save(); ctx.translate(0, -220 * E.outBack(tp)); ctx.rotate(lerp(0.9, -1.4, E.out3(fire))); ctx.fillStyle = '#6b4a2e'; ctx.fillRect(-200, -9, 300, 18); ctx.fillStyle = '#4a4f5c'; rrect(ctx, 60, -6, 70, 80, 8); ctx.fill(); ctx.restore();
    ctx.restore();
    const fl = seg(u, L('catapults') + 0.35, L('catapults') + 0.9); if (fl > 0 && fl < 1) circle(ctx, lerp(820, 1400, fl), 760 - Math.sin(fl * Math.PI) * 420, 22, '#5a5550');
  }
  // gunpowder bomb lands and explodes
  const bb = seg(u, L('gunpowder') - 0.1, boom);
  if (bb > 0 && bb < 1) { const x = lerp(1000, 1390, bb), y = 980 - Math.sin(bb * Math.PI) * 300; circle(ctx, x, y, 34, '#3a3a40'); ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 20, y - 26); ctx.lineTo(x + 34, y - 46); ctx.stroke(); circle(ctx, x + 34, y - 48, 7 + Math.sin(t * 40) * 3, '#ffb547'); }
  const ex = seg(u, boom, boom + 1.0); if (ex > 0 && ex < 1) { glow(ctx, 1400, 860, 500 * ex + 100, 'rgba(255,190,90,1)', 1 - ex); for (let i = 0; i < 10; i++) circle(ctx, 1400 + Math.cos(i) * 260 * ex, 860 + Math.sin(i * 1.3) * 200 * ex - 120 * ex, 70 * (1 - ex) + 20, i % 2 ? '#ffb547' : '#e9d6a8'); }
  ctx.restore();
  steppeFg(ctx, cam, t);
  flash(ctx, (1 - seg(u, boom, boom + 0.35)) * (u > boom ? 0.8 : 0), '255,230,180');
  reasonTitle(ctx, 4, 'THEY LEARNED FAST', u, L('Four'), { out: L('At') + 0.2 });
}

// S11 — reason 5: fear. Open gates spared; resisting cities wiped out; Merv & Nishapur (1221); millions died; rumours ran ahead
function s11(ctx, u, d, t) {
  const L = (id, n = 0) => lw('fear', id, n);
  const mapIn = L('In') - 0.3, mapOut = L('Millions') - 0.3, fieldOut = L('stories') - 0.4;
  if (u < mapIn) {
    const cam = camKeys([{ t: 0, v: [960, 560, 1.1, 0.0] }, { t: L('city'), v: [700, 580, 1.15, -0.01] }, { t: L('city', 1), v: [1240, 580, 1.15, 0.01] }, { t: mapIn, v: [1240, 560, 1.25, 0.0] }], u);
    steppe(ctx, cam, t, { sky: 'rust', grass: 'rust', sun: { x: 1500, y: 380, c: '#ff9a6a' }, waves: 0.3, cloudA: 0.25 });
    ctx.save(); applyCam(ctx, cam, 1);
    const open = seg(u, L('opened') - 0.2, L('gates') + 0.3), dark = seg(u, L('wiped') - 0.2, L('out') + 0.5);
    cityGate(ctx, 640, 990, 1.1, t, { open, lit: 1, flag: open > 0.5 });
    cityGate(ctx, 1300, 990, 1.1, t, { open: 0, lit: 1 - dark, archers: seg(u, L('fought') - 0.3, L('fought')) * (1 - dark), smoke: dark });
    label(ctx, 'OPENED ITS GATES', 640, 560, 26, { color: '#fff', bg: 'rgba(47,140,90,0.9)', alpha: seg(u, L('gates') - 0.2, L('gates') + 0.2) });
    label(ctx, 'SPARED', 640, 615, 30, { color: '#fff', bg: 'rgba(20,30,60,0.8)', alpha: seg(u, L('spared') - 0.2, L('spared') + 0.2) });
    label(ctx, 'FOUGHT BACK', 1300, 560, 26, { color: '#fff', bg: 'rgba(217,74,58,0.9)', alpha: seg(u, L('fought') - 0.2, L('fought') + 0.2) });
    ctx.restore();
    steppeFg(ctx, cam, t, { grass: 'rust' });
  } else if (u < mapOut) {
    const v = viewKeys([{ t: mapIn, v: [62, 38, 2400] }, { t: mapOut, v: [60, 37, 3600] }], u);
    mapBg(ctx, '#1a0f10', '#3a1c16');
    drawGlobe(ctx, v, t, { colors: { ocean: '#2a1c22', ocean2: '#140c10', land: '#7a5a46', lake: '#2a1c22', river: '#5a3a30' }, atmo: 0.2 });
    const go = seg(u, L('destroyed') - 0.3, L('destroyed') + 0.5);
    for (const [n, c, dx] of [['MERV', CITY.merv, 0], ['NISHAPUR', CITY.nishapur, 0]]) {
      const p = pop(u, L(n === 'MERV' ? 'Merv' : 'Nishapur') - 0.2, 0.4);
      cityDot(ctx, v, c, n, p, { color: mix('#ffd38a', '#3a3030', go), core: mix('#ff7a3a', '#1a1414', go), size: 26 });
      if (go > 0) { const [x, y] = gp(v, c); for (let i = 0; i < 6; i++) { const k = ((t * 0.3 + i / 6) % 1); ctx.globalAlpha = go * (1 - k) * 0.5; circle(ctx, x + Math.sin(i * 3 + t) * 20 + k * 40, y - k * 160, 20 + k * 40, '#2a2224'); } ctx.globalAlpha = 1; }
    }
    title(ctx, '1221', W / 2, 230, 110, seg(u, L('1221') - 0.3, L('1221') + 0.4), { color: '#ffd9c0' });
  } else if (u < fieldOut + 0.6) {
    // a field of tiny people fading out — respectful, no gore
    mapBg(ctx, '#1a0f10', '#2e1714');
    const R = rng(5); const fade = seg(u, L('died') - 0.2, L('wars') + 0.6);
    for (let i = 0; i < 520; i++) { const x = (i % 40) * 48 + 30 + R() * 10, y = 300 + Math.floor(i / 40) * 56 + R() * 8; const k = clamp(fade * 1.6 - R() * 0.6); ctx.globalAlpha = (1 - k * 0.85) * seg(u, mapOut, mapOut + 0.5) * (1 - seg(u, fieldOut, fieldOut + 0.6)); mini(ctx, x, y, 40, mix('#c9a66b', '#3a2a2a', k)); }
    ctx.globalAlpha = 1; title(ctx, 'MILLIONS', W / 2, 200, 110, seg(u, L('Millions') - 0.2, L('Millions') + 0.5) * (1 - seg(u, fieldOut, fieldOut + 0.5)), { color: '#ffd9c0' });
  }
  if (u >= fieldOut) {
    // rumours run ahead of the army; gates open like dominoes
    const v = geoView(66, 40, 2000); const a = seg(u, fieldOut, fieldOut + 0.6);
    ctx.save(); ctx.globalAlpha = a;
    mapBg(ctx, '#1a0f10', '#3a1c16'); drawGlobe(ctx, v, t, { colors: { ocean: '#2a1c22', ocean2: '#140c10', land: '#8a6a52', lake: '#2a1c22', river: '#5a3a30' }, atmo: 0.2 });
    const wave = seg(u, L('stories'), L('up') + 0.6);
    const cities = [[76, 42.5], [72, 41], [69.3, 41.3], [66.95, 39.65], [64.4, 39.77], [61.8, 37.6], [58.8, 36.2], [54, 36.5], [51.4, 35.7]];
    cities.forEach((c, i) => { const p = seg(u, L('many') - 0.2 + i * 0.12, L('many') + 0.1 + i * 0.12); cityDot(ctx, v, c, null, 1, { color: '#ffd38a', core: p > 0.5 ? '#ffffff' : PAL.war }); if (p > 0) { const [x, y] = gp(v, c); ctx.save(); ctx.translate(x + 6, y - 14); ctx.scale(E.outBack(p), E.outBack(p)); ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -46); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(30 + Math.sin(t * 6 + i) * 4, -38); ctx.lineTo(0, -28); ctx.fill(); ctx.restore(); } });
    const [ax, ay] = gp(v, [80, 43]); const [bx, by] = gp(v, [50, 35.5]);
    for (let i = 0; i < 12; i++) { const k = clamp(wave * 1.25 - i * 0.02); const x = lerp(ax, bx, k) + Math.sin(i * 7) * 40, y = lerp(ay, by, k) + Math.cos(i * 5) * 40 - Math.sin(k * Math.PI) * 30; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 5 + i) * 0.4); ctx.fillStyle = '#fbf6e6'; ctx.fillRect(-12, -9, 24, 18); ctx.restore(); }
    const [rx, ry] = gp(v, [lerp(82, 66, wave * 0.8), lerp(43.5, 40, wave * 0.8)]); for (let i = 0; i < 5; i++) rider(ctx, rx - i * 30 + 60, ry + (i % 2) * 18, 40, t * 10 + i, { face: -1, t, body: '#2a2224', hatColor: '#5a1f1f' });
    label(ctx, 'THE STORIES RAN AHEAD', W / 2, 220, 40, { color: '#fff', bg: 'rgba(217,74,58,0.9)', alpha: seg(u, L('stories') - 0.1, L('stories') + 0.3) });
    ctx.restore();
  }
  reasonTitle(ctx, 5, 'FEAR', u, L('five'), { out: L('city') - 0.4, color: '#ffd9c0' });
  if (u < L('city') && u > L('dark') - 0.4) label(ctx, 'THE DARK ONE', W / 2, 400, 30, { color: '#ffd9c0', alpha: seg(u, L('dark') - 0.3, L('dark') + 0.2) * (1 - seg(u, L('city') - 0.8, L('city') - 0.4)) });
}
function cityGate(ctx, x, y, s, t, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const wallC = mix('#a89a86', '#3a3030', o.smoke || 0);
  ctx.fillStyle = wallC; ctx.fillRect(-260, -320, 520, 320); for (let i = -260; i < 260; i += 60) ctx.fillRect(i, -360, 36, 40);
  ctx.fillRect(-300, -420, 90, 420); ctx.fillRect(210, -420, 90, 420);
  for (let k = 0; k < 6; k++) { const wx = -200 + (k % 3) * 170, wy = -270 + Math.floor(k / 3) * 80; ctx.fillStyle = o.lit > 0 ? mix('#3a3030', '#ffd38a', o.lit) : '#3a3030'; ctx.fillRect(wx, wy, 26, 34); }
  ctx.fillStyle = '#2a1e1a'; ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(-80, -150); ctx.quadraticCurveTo(0, -220, 80, -150); ctx.lineTo(80, 0); ctx.fill();
  const op = o.open || 0; ctx.fillStyle = '#7a4f2a'; ctx.save(); ctx.translate(-80, 0); ctx.scale(1 - op * 0.85, 1); ctx.fillRect(0, -160, 80, 160); ctx.restore(); ctx.save(); ctx.translate(80, 0); ctx.scale(-(1 - op * 0.85), 1); ctx.fillRect(0, -160, 80, 160); ctx.restore();
  if (o.flag) { ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-255, -420); ctx.lineTo(-255, -520); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-255, -520); ctx.lineTo(-180 + Math.sin(t * 6) * 6, -500); ctx.lineTo(-255, -480); ctx.fill(); }
  if (o.archers > 0) for (let i = 0; i < 5; i++) { ctx.globalAlpha = o.archers; mini(ctx, -220 + i * 110, -330, 50, '#7a2a2a'); ctx.globalAlpha = 1; }
  if (o.smoke > 0) for (let i = 0; i < 10; i++) { const k = ((t * 0.25 + i / 10) % 1); ctx.globalAlpha = o.smoke * (1 - k) * 0.7; circle(ctx, -200 + i * 45 + Math.sin(t + i) * 20, -300 - k * 500, 60 + k * 90, '#2a2224'); }
  ctx.globalAlpha = 1; ctx.restore();
}

// S12 — the west: Genghis dies (1227); 1241 Legnica & Mohi in one week; Europe panics; Ögedei dies, they ride home
function s12(ctx, u, d, t) {
  const L = (id, n = 0) => lw('west', id, n);
  const v = viewKeys([{ t: 0, v: [92, 46, 950] }, { t: L('kept'), v: [70, 48, 900] }, { t: L('1241') + 0.3, v: [35, 50, 1500] }, { t: L('Europe') + 0.6, v: [22, 50, 2200] }, { t: L('turned') - 0.2, v: [24, 50, 2000] }, { t: L('turned') + 1.4, v: [80, 47, 850] }, { t: d, v: [96, 47, 1000] }], u);
  mapBg(ctx);
  const yr = lerp(1227, 1241, E.inOut(seg(u, L('kept') - 0.4, L('1241') + 0.4))); YEAR.v = u < L('1227') - 0.3 ? 1222 + 5 * seg(u, 0, L('1227')) : yr;
  drawGlobe(ctx, v, t, { under: g => empire(g, v, Math.max(1221.5, YEAR.v), {}) });
  // Genghis's banner lowers
  const [kx, ky] = gp(v, CITY.karakorum);
  const low = seg(u, L('died') - 0.2, L('died') + 0.8);
  tug(ctx, kx, ky, 90, t, { tails: 9, tilt: low * 1.2, alpha: 1 - seg(u, L('kept'), L('kept') + 0.6) });
  label(ctx, 'GENGHIS KHAN · 1227', kx, ky + 50, 24, { color: '#fff', bg: 'rgba(20,30,60,0.85)', alpha: seg(u, L('1227') - 0.2, L('1227') + 0.2) * (1 - seg(u, L('kept'), L('kept') + 0.4)) });
  // battles
  const bat = [['LEGNICA · 9 APRIL', CITY.legnica, 'Poland'], ['MOHI · 11 APRIL', CITY.mohi, 'Hungary']];
  bat.forEach(([n, c, w], i) => {
    const hit = L('crushed') + i * 0.7; const p = seg(u, hit - 0.8, hit);
    if (p <= 0) return; const [x, y, vis] = gp(v, c); if (vis < 0) return;
    const back = seg(u, L('turned'), L('left') + 0.4);
    if (back < 1) { ctx.save(); ctx.globalAlpha = 1 - back; const [sx, sy] = gp(v, [32, 49 - i * 2]); ctx.strokeStyle = PAL.war; ctx.lineWidth = 10; ctx.lineCap = 'round'; const ex = lerp(sx, x, E.out3(p)), ey = lerp(sy, y, E.out3(p)); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + ex) / 2, (sy + ey) / 2 - 80, ex, ey); ctx.stroke(); ctx.restore(); }
    const cr = seg(u, hit, hit + 0.25);
    ctx.save(); ctx.translate(x, y - 10); ctx.scale(E.outBack(seg(u, hit - 0.5, hit - 0.1)), E.outBack(seg(u, hit - 0.5, hit - 0.1)));
    shieldIcon(ctx, cr); ctx.restore();
    label(ctx, n, x, y + 70, 22, { color: '#fff', bg: 'rgba(20,30,60,0.85)', alpha: seg(u, L(w) - 0.2, L(w) + 0.2) });
  });
  const wk = seg(u, L('same') - 0.2, L('week') + 0.2) * (1 - seg(u, L('panic') - 0.2, L('panic') + 0.2));
  if (wk > 0) label(ctx, 'IN THE SAME WEEK', W / 2, 230, 44, { color: '#fff', bg: 'rgba(217,74,58,0.92)', alpha: wk });
  // panic: bells shaking over European towns
  const pn = seg(u, L('Europe') - 0.2, L('panic') + 0.3) * (1 - seg(u, L('turned') - 0.4, L('turned')));
  if (pn > 0) for (const c of [[13.4, 52.5], [16.4, 48.2], [21, 52.2], [14.4, 50.1], [19, 47.5], [11.6, 48.1]]) { const [x, y, vis] = gp(v, c); if (vis < 0) continue; ctx.save(); ctx.globalAlpha = pn; ctx.translate(x, y - 30); ctx.rotate(Math.sin(t * 16 + x) * 0.4); bellIcon(ctx); ctx.restore(); label(ctx, '!', x + 30, y - 60, 30, { color: PAL.war, alpha: pn }); }
  // the return home and Ögedei
  const og = seg(u, L('Ögedei') - 0.3, L('Ögedei') + 0.3);
  if (og > 0) { tug(ctx, kx, ky, 80, t, { tails: 9, tilt: og * 1.1, alpha: og }); label(ctx, 'ÖGEDEI, GREAT KHAN †1241', kx, ky + 50, 22, { color: '#fff', bg: 'rgba(20,30,60,0.85)', alpha: og }); }
  const home = seg(u, L('rode') - 0.3, L('one') + 0.8);
  if (home > 0) { for (let i = 0; i < 10; i++) { const k = clamp(home * 1.3 - i * 0.03); const [sx, sy] = gp(v, [40 + i * 3, 50 - (i % 3) * 2]); rider(ctx, lerp(sx, kx, E.inOut(k)), lerp(sy, ky, E.inOut(k)) + (i % 3) * 14, 34, t * 10 + i, { face: 1, t }); } label(ctx, 'CHOOSING A NEW KHAN', kx, ky - 140, 26, { color: '#fff', bg: 'rgba(47,95,208,0.92)', alpha: seg(u, L('choose') - 0.2, L('choose') + 0.3) }); }
  mapClouds(ctx, t, 0.16);
}
function shieldIcon(ctx, cr) {
  for (const side of [-1, 1]) { ctx.save(); ctx.translate(side * cr * 18, cr * 8); ctx.rotate(side * cr * 0.3); ctx.beginPath(); if (side < 0) { ctx.moveTo(0, -44); ctx.lineTo(-36, -34); ctx.lineTo(-34, 10); ctx.quadraticCurveTo(-24, 34, 0, 46); } else { ctx.moveTo(0, -44); ctx.lineTo(36, -34); ctx.lineTo(34, 10); ctx.quadraticCurveTo(24, 34, 0, 46); } ctx.closePath(); ctx.fillStyle = side < 0 ? '#e8e3d6' : '#d6d0c0'; ctx.fill(); ctx.fillStyle = '#c0392b'; ctx.fillRect(side < 0 ? -8 : 0, -40, 8, 80); ctx.restore(); }
}
function bellIcon(ctx) { ctx.fillStyle = '#e2b04a'; ctx.beginPath(); ctx.moveTo(-20, 10); ctx.quadraticCurveTo(-18, -26, 0, -28); ctx.quadraticCurveTo(18, -26, 20, 10); ctx.closePath(); ctx.fill(); circle(ctx, 0, 14, 6, '#c38b2c'); }

// round "zoom bubble" inset (screen space) used for close-ups over the map
function bubble(ctx, x, y, r, p, fn, o = {}) {
  if (p <= 0) return; const s = E.outBack(clamp(p), 1.4);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  circle(ctx, 6, 10, r + 10, 'rgba(0,0,20,0.35)'); circle(ctx, 0, 0, r + 10, o.ring || '#fdf3d8');
  ctx.save(); circle(ctx, 0, 0, r, null); ctx.clip(); fn(ctx); ctx.restore();
  ctx.restore();
}
// S13 — Pax Mongolica: religions side by side, protected trade, the paiza, a caravan across Asia
const SILK = geo([[116.4, 39.9], [111, 40.8], [106.5, 41.2], [101.8, 36.6], [94.7, 40.1], [89.2, 42.9], [82, 43.7], [76.9, 43.2], [72.5, 42.5], [69.3, 41.3], [66.95, 39.65], [64.4, 39.77], [61.8, 37.6], [58.8, 36.2], [54, 36.5], [51.4, 35.7], [46.3, 38.1], [41, 39.9], [38, 40.6], [35.4, 45.0]]);
const SILK_OPEN = SILK.slice(0, SILK.length - 2);
function polyAt(pts, f) { const g = clamp(f) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(g)), k = g - i; return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)]; }
function s13(ctx, u, d, t) {
  const L = (id, n = 0) => lw('peace', id, n);
  const v = viewKeys([{ t: 0, v: [92, 47, 1000] }, { t: L('Trade'), v: [80, 42, 950] }, { t: L('traveler'), v: [74, 41, 1000] }, { t: d, v: [70, 42, 920] }], u);
  mapBg(ctx, '#132a52', '#2a4a7a');
  drawGlobe(ctx, v, t, { under: g => empire(g, v, 1259, { regs: ['core', 'golden', 'chagatai', 'ilkhan', 'yuanN'] }) });
  flash(ctx, 0.12 * seg(u, L('surprising') - 0.3, L('happened')), '255,200,120');
  // the road lights up, a caravan walks it with a glowing paiza
  const rd = seg(u, L('Trade') - 0.3, L('protected') + 0.4);
  const P = SILK_OPEN.map(c => gp(v, c));
  if (rd > 0) { ctx.save(); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.shadowColor = '#ffcf5a'; ctx.shadowBlur = 20; ctx.beginPath(); const n = Math.max(2, Math.floor(P.length * rd)); P.slice(0, n).forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore(); }
  const cv = seg(u, L('traveler') - 0.3, L('Asia') + 1.4);
  if (cv > 0) { const [x, y] = polyAt(P, cv); glow(ctx, x, y - 20, 80, 'rgba(255,215,120,0.9)', 0.7); for (let i = 0; i < 3; i++) { const [cx2, cy2] = polyAt(P, Math.max(0, cv - i * 0.025)); camel(ctx, cx2, cy2, 46, t * 6 + i); } paiza(ctx, x + 10, y - 80, 30, t, 1); }
  // religions around the khan (bubble)
  const rb = seg(u, L('Mongols') - 0.3, L('Mongols') + 0.2) * (1 - seg(u, L('Trade') - 0.5, L('Trade')));
  bubble(ctx, W / 2, 560, 330, rb, g => {
    const sk = g.createLinearGradient(0, -330, 0, 330); sk.addColorStop(0, '#4a88c8'); sk.addColorStop(1, '#f6d9a0'); g.fillStyle = sk; g.fillRect(-340, -340, 680, 680);
    g.fillStyle = PAL.grass; g.fillRect(-340, 120, 680, 300);
    ger(g, 0, 150, 230, { smoke: true, t });
    const sym = [['Buddhists', wheel, '#e2892b'], ['Muslims', crescent, '#2fae8a'], ['Christians', cross, '#5a8ad8']];
    sym.forEach(([w, fn, c], i) => { const p = pop(u, L(w) - 0.2, 0.45); if (p <= 0) return; const a = -Math.PI / 2 + (i - 1) * 0.95 + Math.sin(t * 0.8) * 0.04; const R = 210; g.save(); g.translate(Math.cos(a) * R, Math.sin(a) * R * 0.75 - 20); g.scale(p, p); circle(g, 0, 0, 56, '#fdf3d8'); fn(g, c); g.restore();
      const sv = seg(u, L('served') - 0.2, L('khan') + 0.2); dude(g, -200 + i * 200, 300, 120, t, { body: c, look: [i === 0 ? 0.6 : i === 2 ? -0.6 : 0, -0.3], mood: 'happy', lean: sv * (i === 1 ? 0 : (i === 0 ? 0.15 : -0.15)), seed: i * 0.3, alpha: p }); });
  });
  label(ctx, 'RELIGIOUS FREEDOM', W / 2, 950, 32, { color: '#fff', bg: 'rgba(20,30,60,0.85)', alpha: seg(u, L('religion') - 0.2, L('religion') + 0.2) * rb });
  // the paiza close-up
  const pz = seg(u, L('metal') - 0.2, L('paiza') + 0.2) * (1 - seg(u, L('traveler') + 0.2, L('traveler') + 0.6));
  if (pz > 0) { ctx.save(); ctx.globalAlpha = pz; paiza(ctx, 1500, 520, 150 * E.outBack(pz), t, 1); label(ctx, 'PAIZA — A TRAVEL PASS', 1500, 760, 28, { color: '#fff', bg: 'rgba(20,30,60,0.85)' }); ctx.restore(); }
  mapClouds(ctx, t, 0.16);
  title(ctx, 'PAX MONGOLICA', W / 2, 220, 100, seg(u, L('Pax') - 0.2, L('Mongolica') + 0.3), { color: '#ffe9b0' });
  label(ctx, 'THE MONGOL PEACE', W / 2, 300, 32, { color: '#fff', bg: 'rgba(20,30,60,0.8)', alpha: seg(u, L('peace') - 0.3, L('peace') + 0.1) });
}
function wheel(g, c) { g.strokeStyle = c; g.lineWidth = 7; circle(g, 0, 0, 32, null); g.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 32, Math.sin(a) * 32); g.stroke(); } circle(g, 0, 0, 8, c); }
function crescent(g, c) { g.fillStyle = c; g.beginPath(); g.arc(0, 0, 32, 0, TAU); g.arc(12, -6, 27, 0, TAU, true); g.fill('evenodd'); }
function cross(g, c) { g.fillStyle = c; g.fillRect(-7, -34, 14, 68); g.fillRect(-26, -16, 52, 14); }
function camel(ctx, x, y, s, ph) { ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100); ctx.fillStyle = '#c9a26b'; ctx.strokeStyle = '#a8834f'; ctx.lineWidth = 9; ctx.lineCap = 'round'; for (const [lx, p] of [[-30, 0], [30, 2]]) { ctx.beginPath(); ctx.moveTo(lx, -40); ctx.lineTo(lx + Math.sin(ph + p) * 10, 0); ctx.stroke(); } ctx.beginPath(); ctx.ellipse(0, -55, 50, 22, 0, 0, TAU); ctx.fill(); circle(ctx, -14, -78, 16, '#c9a26b'); circle(ctx, 14, -76, 14, '#c9a26b'); ctx.beginPath(); ctx.moveTo(40, -60); ctx.quadraticCurveTo(70, -80, 64, -110); ctx.lineTo(80, -108); ctx.lineTo(74, -96); ctx.lineWidth = 12; ctx.strokeStyle = '#c9a26b'; ctx.stroke(); ctx.fillStyle = '#c0392b'; ctx.fillRect(-20, -82, 30, 10); ctx.restore(); }
function paiza(ctx, x, y, s, t, gl = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.3) * 0.08); const w = s * 0.62, h = s * 1.6; ctx.fillStyle = '#c38b2c'; rrect(ctx, -w / 2 + 6, -h / 2 + 8, w, h, w * 0.35); ctx.fill(); ctx.fillStyle = '#f2c450'; rrect(ctx, -w / 2, -h / 2, w, h, w * 0.35); ctx.fill(); ctx.fillStyle = '#8a5a1c'; circle(ctx, 0, -h / 2 + w * 0.32, w * 0.13, '#8a5a1c'); ctx.fillRect(-w * 0.08, -h * 0.2, w * 0.16, h * 0.62); for (let i = 0; i < 4; i++) ctx.fillRect(-w * 0.28, -h * 0.15 + i * h * 0.15, w * 0.14, h * 0.06); if (gl) glow(ctx, -w * 0.2, -h * 0.2, s, 'rgba(255,230,150,0.9)', 0.35 + 0.25 * Math.sin(t * 3)); ctx.restore(); }

// S14 — Marco Polo, Kublai Khan, 1279: the crown changes hands; Korea to Eastern Europe; ~24 million km² ≈ North America
const POLO = geo([[12.3, 45.4], [35.07, 32.92], [46.3, 38.1], [56.3, 27.1], [66.9, 36.75], [76, 39.5], [94.7, 40.1], [116.2, 42.35]]);
const POLO_OPEN = POLO.slice(0, POLO.length - Math.ceil(Math.hypot(116.2 - 12.3, 42.35 - 45.4) / 1.2));
function s14(ctx, u, d, t) {
  const L = (id, n = 0) => lw('kublai', id, n);
  const v = viewKeys([{ t: 0, v: [40, 42, 900] }, { t: L('went'), v: [60, 40, 820] }, { t: L('worked'), v: [100, 40, 900] }, { t: L('1279'), v: [110, 34, 1300] }, { t: L('owner') + 0.2, v: [108, 38, 1150] }, { t: L('stretched'), v: [78, 46, 640] }, { t: L('Almost') - 0.3, v: [80, 46, 600] }, { t: d, v: [84, 46, 620] }], u);
  mapBg(ctx);
  const yr = u < L('1279') ? lerp(1271, 1275, seg(u, 0, L('1279'))) : lerp(1275, 1279, seg(u, L('1279') - 0.2, L('China', 1) + 0.2)); YEAR.v = yr;
  drawGlobe(ctx, v, t, { under: g => { empire(g, v, yr, { edge: seg(u, L('stretched'), L('stretched') + 0.6) * 0.9 }); } });
  // Polo's route
  const rp = seg(u, L('went') - 0.3, L('China') + 0.3);
  const P = POLO.map(c => gp(v, c)); const nP = Math.max(2, Math.round(P.length * 0.5));
  const route = P.slice(0, POLO.length - Math.round(POLO.length * 0.5) + 0) ;
  cityDot(ctx, v, CITY.venice, 'VENICE', seg(u, L('Venice') - 0.3, L('Venice') + 0.2) * (1 - seg(u, L('1279') - 0.4, L('1279'))), { core: '#2f5fd0' });
  if (rp > 0 && u < L('1279')) {
    const pts = POLO_OPEN.map(c => gp(v, c)); ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.setLineDash([12, 12]); ctx.beginPath(); const n = Math.max(2, Math.floor(pts.length * rp)); pts.slice(0, n).forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore();
    const [x, y] = polyAt(pts, rp); dude(ctx, x, y + 10, 64, t, { body: '#c0392b', hat: { kind: 'cap', color: '#2a1d3f' }, noShadow: true, look: [1, 0] });
  }
  // the meeting (bubble)
  const mb = seg(u, L('worked') - 0.3, L('worked') + 0.2) * (1 - seg(u, L('1279') - 0.5, L('1279') - 0.1));
  bubble(ctx, 1380, 520, 280, mb, g => {
    g.fillStyle = '#8a2a2a'; g.fillRect(-300, -300, 600, 600); g.fillStyle = '#c38b2c'; for (let i = -300; i < 300; i += 60) g.fillRect(i, -300, 8, 600);
    g.fillStyle = '#5a1f1f'; g.fillRect(-300, 150, 600, 200);
    g.fillStyle = PAL.gold; rrect(g, 30, 20, 180, 150, 16); g.fill();
    dude(g, 120, 170, 250, t, { body: '#e2b04a', bodyD: 'rgba(120,60,0,0.25)', hat: { kind: 'mongol', color: '#2f5fd0', fur: '#3a2a20' }, look: [-0.7, 0], mood: 'calm', seed: 0.5 });
    dude(g, -130, 210, 180, t, { body: '#c0392b', hat: { kind: 'cap', color: '#2a1d3f' }, look: [0.8, -0.2], lean: 0.12 * Math.max(0, Math.sin(t * 1.5)), mood: 'happy', seed: 0.1 });
  });
  label(ctx, 'MARCO POLO', 1250, 860, 22, { color: '#fff', bg: 'rgba(20,30,60,0.85)', alpha: mb });
  label(ctx, "KUBLAI KHAN · GENGHIS'S GRANDSON", 1440, 900, 22, { color: '#fff', bg: 'rgba(47,95,208,0.92)', alpha: mb * seg(u, L('Kublai') - 0.2, L('Kublai') + 0.2) });
  // the crown changes hands
  const jump = seg(u, L('crown') - 0.1, L('crown') + 0.7);
  if (u > L('1279') - 0.6) {
    const a = gp(v, [114, 31]), b = gp(v, [104, 46.5]);
    const x = lerp(a[0], b[0], E.inOut(jump)), y = lerp(a[1], b[1], E.inOut(jump)) - Math.sin(jump * Math.PI) * 220;
    const big = seg(u, L('stretched') - 0.6, L('stretched')); crown(ctx, x, y - 14, 120 - 30 * big, t, { p: seg(u, L('1279') - 0.6, L('1279') - 0.2), glint: Math.max(0, 1 - Math.abs(u - L('owner')) * 2) + 0.2, rot: Math.sin(jump * Math.PI) * 0.3 });
    if (jump > 0.95) label(ctx, 'MONGOLS', x, y + 40, 26, { color: '#fff', bg: 'rgba(47,95,208,0.95)', alpha: seg(u, L('owner') - 0.2, L('owner') + 0.2) * (1 - big) });
  }
  label(ctx, '1279', W / 2, 200, 70, { color: '#fff', weight: 900, alpha: seg(u, L('1279') - 0.2, L('1279') + 0.3) * (1 - seg(u, L('crown') - 0.3, L('crown'))) });
  // Korea ↔ Eastern Europe
  const ke = seg(u, L('Korea') - 0.2, L('Europe') + 0.3) * (1 - seg(u, L('about') - 0.2, L('about') + 0.3));
  if (ke > 0) { cityDot(ctx, v, [127.5, 37.5], 'KOREA', seg(u, L('Korea') - 0.2, L('Korea') + 0.2), { core: PAL.mblue }); cityDot(ctx, v, [30.5, 50.4], 'EASTERN EUROPE', seg(u, L('Eastern') - 0.2, L('Eastern') + 0.2), { core: PAL.mblue }); }
  const km = seg(u, L('about') - 0.2, L('kilometers') + 0.3);
  if (km > 0) { title(ctx, Math.round(24 * E.out3(km)) + ' MILLION KM²', W / 2, 200, 84, clamp(km * 2), { color: '#ffffff' }); }
  // North America slides in for scale
  const na = seg(u, L('Almost') - 0.3, L('America') + 0.4);
  if (na > 0 && NAM) {
    const dl = lerp(260, 192, E.out3(na)); const ring = NAM.map(([lo, la]) => [lo + dl, la - 2]);
    ctx.save(); ctx.globalAlpha = 0.85 * clamp(na * 2); ctx.beginPath(); geoRings(ctx, v, [ring]); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill(); ctx.setLineDash([12, 10]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    const [x, y] = gp(v, [-100 + dl, 46]); label(ctx, 'NORTH AMERICA', x, y, 28, { color: '#1d2a55', bg: '#ffffff', alpha: seg(u, L('North') - 0.2, L('North') + 0.2) });
  }
  mapClouds(ctx, t, 0.15);
}

// S15 — limits: Ain Jalut (1260) and the kamikaze storms off Japan (1274, 1281)
function s15(ctx, u, d, t) {
  const L = (id, n = 0) => lw('limits', id, n);
  const toJ = L('twice') - 0.4;
  const v = viewKeys([{ t: 0, v: [60, 40, 1000] }, { t: L('1260'), v: [42, 34, 1700] }, { t: L('Jalut') + 0.3, v: [40, 34, 1800] }, { t: toJ + 0.9, v: [126, 37, 2300] }, { t: L('wrecked'), v: [129, 35, 2900] }, { t: d, v: [130, 35, 3000] }], u);
  mapBg(ctx);
  const storm = seg(u, L('wrecked') - 0.4, L('storms') + 0.4);
  drawGlobe(ctx, v, t, { under: g => { empire(g, v, 1279, { edge: Math.sin(Math.PI * seg(u, L('limits') - 0.4, L('limits') + 0.8)) * 0.9, edgeColor: PAL.war }); const eg = seg(u, L('Mamluks') - 0.3, L('Egypt') + 0.2); if (eg > 0) { g.save(); g.globalAlpha = 0.75 * eg; geoFill(g, v, [REG.egypt], '#e8b23a'); g.restore(); } } });
  mapLabel(ctx, v, [30.5, 26.5], 'MAMLUKS OF EGYPT', 26, seg(u, L('Mamluks') - 0.2, L('Egypt') + 0.2), { bg: 'rgba(20,30,60,0.8)' });
  // the arrow that breaks at Ain Jalut
  const ap = seg(u, L('1260') - 0.2, L('beat')), br = seg(u, L('beat'), L('beat') + 0.5);
  if (ap > 0 && u < toJ + 0.5) {
    const [sx, sy] = gp(v, [41, 36.5]), [ex, ey] = gp(v, CITY.ainjalut); const k = E.out3(ap);
    ctx.save(); ctx.globalAlpha = 1 - seg(u, toJ, toJ + 0.4); ctx.strokeStyle = PAL.mblue; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); const mx = lerp(sx, ex, k * (1 - br * 0.15)), my = lerp(sy, ey, k * (1 - br * 0.15)); ctx.lineTo(mx, my); ctx.stroke();
    ctx.translate(ex, ey - 6); ctx.scale(1.1 * E.outBack(seg(u, L('beat') - 0.3, L('beat'))), 1.1 * E.outBack(seg(u, L('beat') - 0.3, L('beat')))); ctx.fillStyle = '#e8b23a'; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(38, -30); ctx.lineTo(32, 16); ctx.quadraticCurveTo(18, 40, 0, 50); ctx.quadraticCurveTo(-18, 40, -32, 16); ctx.lineTo(-38, -30); ctx.closePath(); ctx.fill(); crescent(ctx, '#7a3a10'); ctx.restore();
    label(ctx, 'AIN JALUT · 1260', ex, ey + 80, 26, { color: '#fff', bg: 'rgba(217,74,58,0.92)', alpha: seg(u, L('Ain') - 0.2, L('Jalut') + 0.2) * (1 - seg(u, toJ, toJ + 0.4)) });
  }
  // fleets to Japan, wrecked by storms
  if (u > toJ + 0.4) {
    const [ax, ay] = gp(v, CITY.happo), [bx, by] = gp(v, CITY.hakata);
    const sail = seg(u, L('fleets') - 0.4, L('wrecked'));
    for (let i = 0; i < 9; i++) { const k = clamp(sail - (i % 3) * 0.05); const sink = clamp(storm * 1.4 - (i % 4) * 0.1); const x = lerp(ax, bx, k * 0.8) + (i % 3) * 50 - 50 + Math.sin(t * 2 + i) * 6, y = lerp(ay, by, k * 0.8) + Math.floor(i / 3) * 45 - 30 + sink * 40; ship(ctx, x, y, 42, t + i, sink); }
    if (storm > 0) for (let i = 0; i < 4; i++) { const [x, y] = gp(v, [128.8 + i * 0.6, 34.4 + (i % 2) * 0.7]); swirl(ctx, x, y, 90 + i * 20, t * (3 + i * 0.4), storm); }
    if (storm > 0.3 && Math.sin(t * 7) > 0.92) flash(ctx, 0.25 * storm, '220,230,255');
    title(ctx, 'KAMIKAZE', W / 2, 220, 110, seg(u, L('kamikaze') - 0.2, L('kamikaze') + 0.5), { color: '#ffffff' });
    label(ctx, 'THE DIVINE WIND · 1274 & 1281', W / 2, 300, 30, { color: '#fff', bg: 'rgba(20,30,60,0.85)', alpha: seg(u, L('divine') - 0.3, L('divine') + 0.2) });
    if (storm > 0) { ctx.save(); ctx.globalAlpha = storm * 0.4; ctx.strokeStyle = '#e8f3ff'; ctx.lineWidth = 3; for (let i = 0; i < 18; i++) { const y = (i * 61) % H, x = (t * 900 + i * 210) % (W + 400) - 200; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 80, y - 20, x + 180, y); ctx.stroke(); } ctx.restore(); }
  }
  mapClouds(ctx, t, 0.15 + storm * 0.35);
}
function ship(ctx, x, y, s, t, sink) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.6) * 0.06 + sink * 0.8); ctx.globalAlpha *= 1 - seg(sink, 0.6, 1); ctx.scale(s / 100, s / 100); ctx.fillStyle = '#6b4a2e'; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(60, 0); ctx.lineTo(44, 26); ctx.lineTo(-44, 26); ctx.fill(); ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.moveTo(-4, -90); ctx.lineTo(-4, -6); ctx.lineTo(-50, -10); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(4, -80); ctx.lineTo(4, -6); ctx.lineTo(46, -12); ctx.closePath(); ctx.fill(); ctx.restore(); }
function swirl(ctx, x, y, r, ph, a) { ctx.save(); ctx.translate(x, y); ctx.rotate(ph); ctx.globalAlpha = a * 0.8; ctx.strokeStyle = '#e8f3ff'; ctx.lineWidth = 7; ctx.lineCap = 'round'; for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let i = 0; i < 30; i++) { const f = i / 30, ang = f * 4 + k * TAU / 3; ctx.lineTo(Math.cos(ang) * r * f, Math.sin(ang) * r * f * 0.7); } ctx.stroke(); } ctx.restore(); }

// S16 — the split into four khanates; China lost (1368)
const KH_NAME = { golden: ['GOLDEN HORDE', [55, 52]], chagatai: ['CHAGATAI', [74, 42]], ilkhan: ['ILKHANATE', [52, 33]], yuanN: ['YUAN', [108, 40]] };
function s16(ctx, u, d, t) {
  const L = (id, n = 0) => lw('split', id, n);
  const v = viewKeys([{ t: 0, v: [86, 45, 640] }, { t: L('split'), v: [80, 45, 680] }, { t: L('Less'), v: [96, 40, 820] }, { t: d, v: [104, 38, 980] }], u);
  mapBg(ctx);
  const sp = E.outBack(seg(u, L('split') - 0.2, L('four') + 0.3), 1.6) + 0.6 * E.inOut(seg(u, L('Each'), L('way') + 0.6));
  const ming = seg(u, L('pushed') - 0.3, L('China') + 0.5);
  drawGlobe(ctx, v, t, { under: g => {
    empire(g, v, 1279, { split: clamp(sp), splitPx: 18 + 30 * seg(u, L('Each'), L('way') + 0.6), ming });
    // cracks flicker along borders before the split
    const cr = Math.sin(Math.PI * seg(u, L('inside') - 0.3, L('split') + 0.2)); if (cr > 0) { g.save(); g.globalAlpha = cr * (0.6 + 0.4 * Math.sin(t * 20)); g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); geoRings(g, v, KH.map(k => REG[k])); g.stroke(); g.restore(); }
  } });
  // four banners tug a rope at the centre (the throne)
  const tg = seg(u, L('grandsons') - 0.3, L('throne') + 0.3) * (1 - seg(u, L('split') - 0.2, L('split') + 0.3));
  if (tg > 0) { const [cx, cy] = gp(v, CITY.karakorum); ctx.save(); ctx.globalAlpha = tg; ['golden', 'chagatai', 'ilkhan', 'yuanN'].forEach((k, i) => { const [x, y] = gp(v, KH_NAME[k][1]); const pull = Math.sin(t * 5 + i * 1.7) * 10; ctx.strokeStyle = '#e9e3d2'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y - 80); ctx.lineTo(cx + pull, cy - 20); ctx.stroke(); tug(ctx, x + pull * 0.5, y, 70, t + i, { color: KH_COL[k] }); }); ctx.fillStyle = PAL.gold; rrect(ctx, cx - 30, cy - 50, 60, 50, 8); ctx.fill(); ctx.restore(); }
  // labels for the four khanates
  ['golden', 'chagatai', 'ilkhan', 'yuanN'].forEach((k, i) => { const p = seg(u, L('four') - 0.2 + i * 0.15, L('four') + 0.2 + i * 0.15); const [n, c] = KH_NAME[k]; mapLabel(ctx, v, c, k === 'yuanN' && ming > 0.5 ? 'MING' : n, 24, p * (k === 'yuanN' ? 1 : 1 - ming * 0.6), { bg: 'rgba(10,18,44,0.82)' }); });
  title(ctx, '1368', W / 2, 220, 100, seg(u, L('later') - 0.3, L('later') + 0.4), { color: '#ffffff' });
  mapClouds(ctx, t, 0.15);
}

// S17 — why: the quiver returns and the answers light the arrows
function s17(ctx, u, d, t) {
  const L = (id, n = 0) => lw('why', id, n);
  const cam = { x: 960 + u * 8, y: 560, z: 1.05 + u * 0.004, r: 0.004 * Math.sin(u) };
  steppe(ctx, cam, t, { sky: 'dusk', grass: 'dusk', sun: { x: 1400, y: 520, c: '#ffd9a0' }, waves: 0.5 });
  fadeBlack(ctx, 0.35, '10,14,40');
  const lit = [0, 0, 0, 0, 0];
  const fast = seg(u, L('faster') - 0.2, L('faster') + 0.2); lit[0] = fast; lit[2] = fast;
  lit[1] = seg(u, L('organized') - 0.4, L('organized'));
  lit[3] = seg(u, L('learned') - 0.2, L('everyone') + 0.1);
  lit[4] = seg(u, L('fear') - 0.2, L('weapon') + 0.1);
  quiver(ctx, W / 2, 900, 260, t, { lit, rot: 0 });
  title(ctx, 'WHY?', W / 2, 220, 120, seg(u, L('why') - 0.2, L('why') + 0.4) * (1 - seg(u, L('Not') - 0.3, L('Not'))));
  const nr = seg(u, L('Not') - 0.2, L('rich') + 0.2) * (1 - seg(u, L('faster') - 0.4, L('faster') - 0.1));
  if (nr > 0) { ctx.save(); ctx.globalAlpha = nr; ctx.translate(640, 300); coinIcon(ctx); noSign(ctx, 0, 0, 90, seg(u, L('rich'), L('rich') + 0.3)); ctx.restore(); label(ctx, 'RICH', 640, 420, 28, { color: '#fff', alpha: nr }); ctx.save(); ctx.globalAlpha = seg(u, L('many') - 0.3, L('many')) * nr; for (let i = 0; i < 7; i++) mini(ctx, 1220 + (i % 4) * 50, 330 + Math.floor(i / 4) * 50, 50, '#c9a66b'); noSign(ctx, 1290, 300, 90, seg(u, L('many'), L('many') + 0.3)); ctx.restore(); label(ctx, 'MANY', 1290, 420, 28, { color: '#fff', alpha: seg(u, L('many') - 0.3, L('many')) * nr }); }
  const words = [['FASTER', 'faster', RC[0]], ['BETTER ORGANIZED', 'organized', RC[1]], ['LEARNED FROM EVERYONE', 'learned', RC[3]], ['FEAR AS A WEAPON', 'fear', RC[4]]];
  words.forEach(([w, k, c], i) => { const p = seg(u, L(k) - 0.2, L(k) + 0.3); if (p > 0) label(ctx, w, 420 + (i % 2) * 1080, 330 + Math.floor(i / 2) * 150, 40, { color: '#fff', bg: c, alpha: p * (u > L('Not') ? 1 : 0) * (1 - (i === 0 ? 0 : 0)) }); });
}

// S18 — the open roads carry the Black Death west (1340s); the crown lifts off toward the next century
function s18(ctx, u, d, t) {
  const L = (id, n = 0) => lw('plague', id, n);
  const v = viewKeys([{ t: 0, v: [84, 44, 900] }, { t: L('1340s'), v: [70, 44, 880] }, { t: L('Black'), v: [55, 46, 900] }, { t: d, v: [62, 45, 760] }], u);
  const night = { ocean: '#0c1a36', ocean2: '#060d1e', land: '#2c3a62', lake: '#0c1a36', river: '#3a4f86', atmo: '#6a7cff' };
  mapBg(ctx, '#050a1a', '#0e1a3a');
  drawGlobe(ctx, v, t, { colors: night, shade: 0.25, under: g => empire(g, v, 1279, { split: 1, alpha: 0.35, splitPx: 12 }) });
  const P = SILK_OPEN.map(c => gp(v, c));
  const rd = seg(u, L('roads') - 0.3, L('roads') + 0.6);
  ctx.save(); ctx.globalAlpha = rd; ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 6; ctx.shadowColor = '#ffcf5a'; ctx.shadowBlur = 24; ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore();
  // goods travel: silk, spices, ideas
  [['silk', '#b06cff'], ['spices', '#e2892b'], ['ideas', '#ffffff']].forEach(([w, c], i) => { const k = seg(u, L(w) - 0.3, L(w) + 3.5); if (k > 0 && k < 1) { const [x, y] = polyAt(P, 1 - k); glow(ctx, x, y, 50, rgba(c, 0.9), 0.8); circle(ctx, x, y, 12, c); label(ctx, w.toUpperCase(), x, y - 36, 20, { color: '#fff', bg: 'rgba(10,18,44,0.8)', alpha: seg(u, L(w) - 0.2, L(w) + 0.2) * (1 - seg(k, 0.7, 1)) }); } });
  // the disease: a dark violet mist creeping west along the same road
  const dm = seg(u, L('disease') - 0.4, L('Death') + 1.5);
  if (dm > 0) { for (let i = 0; i < 70; i++) { const R = rng(i + 7); const f = 1 - clamp(dm * 1.15 - R() * 0.25); if (f >= 0.999) continue; const [x, y] = polyAt(P, f); ctx.globalAlpha = 0.5 * (1 - f * 0.3); circle(ctx, x + (R() - 0.5) * 120 + Math.sin(t + i) * 10, y + (R() - 0.5) * 90, 18 + R() * 30, R() > 0.5 ? '#3a1450' : '#5a1f6a'); } ctx.globalAlpha = 1; cityDot(ctx, v, CITY.caffa, 'CAFFA · 1346', seg(u, L('Black') - 0.3, L('Black') + 0.2), { core: '#7a2a9a' }); }
  title(ctx, '1340s', W / 2, 200, 80, seg(u, L('1340s') - 0.3, L('1340s') + 0.3) * (1 - seg(u, L('Black') - 0.4, L('Black') - 0.1)), { color: '#d9c8ff' });
  title(ctx, 'THE BLACK DEATH', W / 2, 220, 104, seg(u, L('Black') - 0.1, L('Death') + 0.4), { color: '#e9d9ff', shadow: 'rgba(60,10,80,0.6)' });
  // the crown lifts off toward the 1300s
  const cu = seg(u, L('story') - 0.3, L('century') + 0.6);
  const [kx, ky] = gp(v, [104, 46.5]);
  crown(ctx, lerp(kx, W / 2 + 380, E.inOut(cu)), lerp(ky - 14, 150, E.inOut(cu)), 110 - 40 * cu, t, { p: 1, glint: 0.3 + 0.7 * cu, rot: Math.sin(cu * Math.PI) * 0.2 });
  label(ctx, 'NEXT: THE 1300s', W / 2 + 380, 230, 26, { color: '#fff', bg: 'rgba(10,18,44,0.85)', alpha: seg(u, L('century') - 0.2, L('century') + 0.4) });
  mapClouds(ctx, t, 0.1);
}

// S19 — the joke: "…lost eight of its nine horses" — then a horizon full of horses
function s19(ctx, u, d, t) {
  const L = (id, n = 0) => lw('ending', id, n);
  const rev = seg(u, L('horses') + 0.1, L('horses') + 1.8);
  const cam = camKeys([{ t: 0, v: [980, 600, 1.15, 0.0] }, { t: L('horses'), v: [980, 620, 1.2, 0.0] }, { t: L('horses') + 1.8, v: [960, 420, 0.62, -0.01] }, { t: d, v: [960, 400, 0.58, 0.0] }], u);
  steppe(ctx, cam, t, { sky: 'sunset', grass: 'sunset', sun: { x: 1350, y: 560, c: '#ffd9a0' }, waves: 0.7 });
  ctx.save(); applyCam(ctx, cam, 1);
  horse(ctx, 980, 900, 200, t * 0.6, { run: 0, color: '#8a5a3c', graze: u < L('lost') ? 1 : 0 });
  if (rev > 0) { const R = rng(55); for (let i = 0; i < 90; i++) { const x = -900 + R() * 3800, y = 760 + R() * 260 + i % 3, s = 70 + R() * 50; const p = clamp(rev * 1.4 - R() * 0.4); if (p <= 0) continue; ctx.globalAlpha = p; horse(ctx, x + (1 - p) * 600, y, s, t * 9 + i, { color: ['#8a5a3c', '#e8e0d0', '#4a3a32', '#b07a4a', '#5a4030', '#d0b48a'][i % 6], face: R() > 0.3 ? 1 : -1, run: R() > 0.5 ? 1 : 0 }); } ctx.globalAlpha = 1; }
  ctx.restore();
  steppeFg(ctx, cam, t, { grass: 'sunset' });
  // nine horse icons: eight fade
  const ic = seg(u, L('eight') - 0.6, L('eight') - 0.2) * (1 - seg(u, L('horses') + 0.4, L('horses') + 0.9));
  if (ic > 0) for (let i = 0; i < 9; i++) { const gone = i !== 4 && u > L('nine') - 0.2 + i * 0.02; ctx.save(); ctx.globalAlpha = ic * (gone ? 0.25 : 1); horse(ctx, 640 + i * 80, 260, 60, 0, { run: 0, color: i === 4 ? '#8a5a3c' : '#f4e2c8', noShadow: true }); ctx.restore(); }
  fadeBlack(ctx, seg(u, d - 1.8, d - 0.3), '0,0,0');
  const ec = seg(u, d - 3.2, d - 2.6) * (1 - seg(u, d - 1.2, d - 0.4));
  if (ec > 0) { title(ctx, 'WHO RULED THE 1200s?', W / 2, 240, 70, ec, { color: '#ffffff' }); label(ctx, 'NEXT: THE 1300s', W / 2, 320, 28, { color: '#1d2a55', bg: PAL.gold, alpha: ec }); }
}

// ================= timeline =================
const SCENES = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19];
function drawScene(ctx, t) {
  let i = 0; while (i < SCENES.length - 1 && t >= Bd[i + 1]) i++;
  SCENES[i](ctx, t - Bd[i], Bd[i + 1] - Bd[i], t);
}
// century ribbon: which scenes show it, and the year of the story
function yearAt(t) {
  if (t < SC('crown')) return YEAR.v;
  if (t < SC('crown') + 1) return lerp(1280, 1200, seg(t, SC('crown'), SC('crown') + 0.9));
  if (t < SC('khan')) return 1200;
  if (t < SC('question')) return lerp(1200, 1206, seg(t, SC('khan') + lw('khan', '1206') - 0.6, SC('khan') + lw('khan', '1206') + 0.3));
  if (t < SC('fear')) return lerp(1206, 1220, seg(t, SC('question'), SC('fear')));
  if (t < SC('west')) return 1221;
  if (t < SC('peace')) return lerp(1227, 1242, seg(t, SC('west') + lw('west', '1227'), SC('west') + lw('west', '1241') + 0.4));
  if (t < SC('kublai')) return lerp(1250, 1260, seg(t, SC('peace'), SC('kublai')));
  if (t < SC('limits')) return YEAR.v;
  if (t < SC('split')) return t < SC('limits') + lw('limits', 'twice') ? 1260 : lerp(1274, 1281, seg(t, SC('limits') + lw('limits', 'fleets'), SC('limits') + lw('limits', 'storms')));
  if (t < SC('why')) return lerp(1260, 1294, seg(t, SC('split'), SC('split') + lw('split', 'Less')));
  return lerp(1294, 1300, seg(t, SC('plague') + lw('plague', 'story'), SC('plague') + lw('plague', 'century') + 0.5));
}
function ribbonAlpha(t) {
  const on = (a, b) => seg(t, a, a + 0.5) * (1 - seg(t, b - 0.5, b));
  return Math.max(on(SC('crown') + 1.0, SC('boy')), on(SC('khan') + lw('khan', '1206') - 0.6, SC('horses')), on(SC('west'), SC('split') + lw('split', 'Less')), on(SC('plague'), SC('ending')));
}
function holder(t) { return t < SC('kublai') + lw('kublai', 'owner') ? 'CHINA' : 'MONGOLS'; }
function reasonIdx(t) { for (let i = 4; i >= 0; i--) if (t >= SC(['horses', 'army', 'news', 'learn', 'fear'][i])) return i; return -1; }
function drawOverlay(ctx, t) {
  const ra = ribbonAlpha(t);
  if (ra > 0) { centuryBar(ctx, 1200, 1300, yearAt(t), ra, { color: PAL.gold }); ctx.save(); ctx.globalAlpha = ra; crown(ctx, W / 2 + 470, 74, 40, t, { p: 1 }); label(ctx, holder(t), W / 2 + 560, 66, 20, { color: '#fff', align: 'left' }); ctx.restore(); }
  const ri = reasonIdx(t), qa = t >= SC('horses') && t < SC('west') ? seg(t, SC('horses') + 2.5, SC('horses') + 3.0) * (1 - seg(t, SC('west') - 0.5, SC('west'))) : 0;
  if (qa > 0) quiverHud(ctx, t, ri, qa);
  grain(ctx, t, 0.05);
}
const FAST = [SC('steppe') + lw('steppe', 'steppe') + 0.1, SC('hook') + lw('hook', 'almost'), SC('kublai') + lw('kublai', 'crown'), SC('learn') + lw('learn', 'bombs') + 0.45];
function mbFn(t) {
  for (const b of FAST) if (Math.abs(t - b) < 0.45) return { n: 5, shutter: 1.0 / FPS };
  if (t >= SC('horses') && t < SC('army')) return { n: 3, shutter: 0.8 / FPS };
  return { n: 2, shutter: 0.5 / FPS };
}

// ================= sound events (→ score.py) =================
function events() {
  const ev = []; const A = (n, t, x = {}) => ev.push({ n, t, ...x });
  const w = (id, word, n = 0) => at(id, word, n);
  // S1
  A('wind', 0, { d: SC('crown') + 2 }); A('neigh', 1.6); A('title_soft', w('hook', '1200') - 0.2); A('whoosh_up', w('hook', 'almost') - 0.3);
  A('pop', w('hook', 'Mongols') - 0.2); A('flood', w('hook', 'Eighty'), { d: w('hook', 'largest') - w('hook', 'Eighty') + 0.4 }); A('title_hit', SC('crown') - 1.2);
  // S2
  A('rewind', SC('crown') + 0.05); A('whoosh', w('crown', 'crown') - 0.2); A('crown_land', w('crown', 'China') + 0.05); A('shimmer', w('crown', 'richest') - 0.1);
  ['paper', 'printing', 'gunpowder', 'cities'].forEach((k, i) => A('pop', w('crown', k) - 0.15, { i })); A('fizz', w('crown', 'gunpowder')); A('tick_up', w('crown', 'million') - 0.5, { d: 0.9 });
  // S3
  A('whoosh_down', w('steppe', 'steppe') - 0.2); A('grass', w('steppe', 'ocean') - 0.4, { d: 2.4 });
  for (let i = 0; i < 5; i++) A('pop_soft', w('steppe', 'Here') + i * 0.12, { i }); A('crowd', w('steppe', 'million') - 0.3, { d: 1.2 });
  A('poof', w('steppe', 'cities') + 0.5); A('poof', w('steppe', 'writing') + 0.6); A('bleat', w('steppe', 'sheep')); A('hooves', w('steppe', 'horses') - 0.3, { d: 1.4 }); A('neigh', w('steppe', 'horses') + 0.4);
  A('charge', w('steppe', 'clans') - 0.5, { d: 1.2 }); A('clash', w('steppe', 'fought')); A('clash', w('steppe', 'other'));
  // S4
  A('title_soft', w('boy', '1162') - 0.3); A('pop', w('boy', 'boy') - 0.2); A('pop_soft', w('boy', 'When') - 0.2); A('cup', w('boy', 'poisoned') - 0.1); A('ghost', w('boy', 'poisoned') + 0.2);
  A('cold_wind', w('boy', 'left') - 0.3, { d: 5 }); A('hooves_away', w('boy', 'stole'), { d: 2.0 }); A('pluck_down', w('boy', 'horses') + 0.3);
  A('wood_slam', w('boy', 'collar')); A('crack', w('boy', 'escaped') - 0.2); A('whoosh', w('boy', 'escaped') + 0.1);
  // S5
  ['friends', 'deals', 'battles', 'united', 'tribes', 'steppe'].forEach((k, i) => A('merge', w('khan', k) + 0.15, { i })); A('banner', w('khan', 'united') + 0.2);
  A('title_soft', w('khan', '1206') - 0.2); A('crowd_cheer', w('khan', 'Genghis') - 0.2); A('title_hit', w('khan', 'Genghis') - 0.1);
  // S6
  NEIGH.forEach((_, i) => A('pop_soft', w('question', 'rich') - 0.3 + i * 0.12, { i })); A('swell', w('question', 'beat') - 0.3, { d: 1.6 }); A('quiver', w('question', 'five') + 0.1);
  // S7–S11 reasons: arrow draw sting on each
  [['horses', 'One'], ['army', 'Two'], ['news', 'Three'], ['learn', 'Four'], ['fear', 'five']].forEach(([id, k], i) => A('arrow_sting', w(id, k) - 0.1, { i }));
  A('gallop', SC('horses'), { d: SC('army') - SC('horses') - 0.3 }); A('whoosh', w('horses', 'jumped') - 0.1); A('neigh', w('horses', 'jumped') + 0.6);
  A('riser', w('horses', 'Mongol') - 0.4, { d: 1.2 }); A('twang', w('horses', 'shoot') + 0.15); A('twang', w('horses', 'gallop') + 0.05); A('twang', w('horses', 'backwards') + 0.2);
  A('scatter', w('army', 'broke') + 0.1); ['ten', 'hundred', 'thousand'].forEach((k, i) => A('stack', w('army', k), { i })); A('stack', w('army', 'ten', 1), { i: 3 }); A('march', w('army', 'ten', 1) + 0.3, { d: 1.6 });
  A('pop', w('army', 'skill') - 0.2); A('pop', w('army', 'family') - 0.4); A('cross', w('army', 'family') + 0.1);
  for (let i = 0; i < 3; i++) A('anvil', w('army', 'son') + 0.2 + i * 0.9); A('title_soft', w('army', 'generals') - 0.4);
  { const a = w('news', 'built') - 0.2; for (let i = 0; i < 6; i++) A('pop_soft', a + i * 0.18, { i }); }
  { const a = w('news', 'messenger') - 0.2, b = w('news', 'day') + 0.6; A('hooves', a, { d: b - a }); for (let i = 1; i < 8; i++) A('relay', a + (b - a) * i / 8, { i }); }
  for (let i = 0; i < 6; i++) A('paper', w('news', 'told') + i * 0.25, { i }); A('pop_soft', w('news', 'everything'));
  A('hooves', w('learn', 'At') - 0.4, { d: 1.2 }); A('boing', w('learn', 'cities') + 0.1); A('steps', w('learn', 'brought') - 0.2, { d: 1.2 }); A('pop', w('learn', 'engineers') - 0.1);
  A('hammer', w('learn', 'Soon') - 0.1, { d: 0.7 }); A('throw', w('learn', 'catapults') + 0.15); A('thud', w('learn', 'catapults') + 0.9); A('fuse', w('learn', 'gunpowder') - 0.1, { d: 0.9 }); A('boom', w('learn', 'bombs') + 0.45);
  A('dark_hit', w('fear', 'fear') - 0.1); A('gate', w('fear', 'opened') - 0.1); A('smoke', w('fear', 'wiped') - 0.1, { d: 1.6 }); A('title_soft', w('fear', '1221') - 0.2); A('dark_hit', w('fear', 'destroyed'));
  A('drone_low', w('fear', 'Millions') - 0.4, { d: 2.4 }); A('rush', w('fear', 'stories') - 0.2, { d: 1.6 }); for (let i = 0; i < 9; i++) A('flag', w('fear', 'many') - 0.2 + i * 0.12, { i });
  // S12
  A('drop', w('west', 'died')); A('flood', w('west', 'kept') - 0.4, { d: 1.6 }); A('march', w('west', '1241') - 0.2, { d: 2.2 });
  A('shield_crack', w('west', 'crushed')); A('shield_crack', w('west', 'crushed') + 0.7); A('bells', w('west', 'Europe') - 0.2, { d: 1.6 });
  A('reverse', w('west', 'turned') - 0.1); A('drop', w('west', 'Ögedei')); A('hooves', w('west', 'rode') - 0.3, { d: 1.6 });
  // S13
  A('warm', w('peace', 'surprising') - 0.3); [['Buddhists', 0], ['Muslims', 1], ['Christians', 2]].forEach(([k, i]) => A('chime', w('peace', k) - 0.15, { i }));
  A('shimmer', w('peace', 'Trade') - 0.2); A('paiza', w('peace', 'paiza') - 0.2); A('camel', w('peace', 'traveler') - 0.2, { d: 2.4 }); A('title_hit_soft', w('peace', 'Pax') - 0.15);
  // S14
  A('pop', w('kublai', 'Venice') - 0.2); A('travel', w('kublai', 'went') - 0.3, { d: 1.6 }); A('pop', w('kublai', 'worked') - 0.3); A('flood', w('kublai', 'Kublai', 1) - 0.4, { d: 1.6 });
  A('crown_jump', w('kublai', 'crown') - 0.1); A('crown_land', w('kublai', 'crown') + 0.7); A('swell', w('kublai', 'stretched') - 0.4, { d: 1.6 }); A('tick_up', w('kublai', 'about') - 0.2, { d: 1.6 }); A('whoosh', w('kublai', 'Almost') - 0.2);
  // S15
  A('dark_hit', w('limits', 'limits') - 0.1); A('whoosh', w('limits', '1260') - 0.2); A('shield_crack', w('limits', 'beat')); A('waves', w('limits', 'fleets') - 0.6, { d: 2.4 });
  A('storm', w('limits', 'wrecked') - 0.4, { d: 3.6 }); A('splinter', w('limits', 'storms')); A('title_hit', w('limits', 'kamikaze') - 0.15);
  // S16
  A('creak', w('split', 'grandsons') - 0.2, { d: 1.6 }); A('crack_big', w('split', 'split') - 0.1); A('drift', w('split', 'Each') - 0.1, { d: 1.6 }); A('title_soft', w('split', 'later') - 0.3); A('drop', w('split', 'pushed'));
  // S17
  A('title_soft', w('why', 'why') - 0.2); A('cross', w('why', 'rich') + 0.1); A('cross', w('why', 'many') + 0.1);
  [['faster', 0], ['organized', 1], ['learned', 2], ['fear', 3]].forEach(([k, i]) => A('pluck_up', w('why', k) - 0.1, { i }));
  // S18
  A('night', SC('plague'), { d: SC('ending') - SC('plague') }); A('shimmer', w('plague', 'roads') - 0.2); A('swell_dark', w('plague', 'disease') - 0.4, { d: 2.6 }); A('title_hit', w('plague', 'Black') - 0.1); A('crown_chime', w('plague', 'story') - 0.2);
  // S19
  A('neigh', w('ending', 'horses') + 0.2); A('hooves', w('ending', 'horses') + 0.3, { d: 2.4 }); A('end_hit', END - 3.0);
  return { events: ev.sort((a, b) => a.t - b.t), Bd, END, lines: N.lines };
}
// thumbnail compositions (engine/still.py --thumbs, "draw": name)
window.THUMBS = {
  empire(ctx, t) {
    mapBg(ctx, '#0b1a38', '#1d3f73');
    const v = geoView(86, 40, 500, 1340, 610);
    drawGlobe(ctx, v, t, { shade: 0.3, under: g => empire(g, v, 1279, { edge: 0.95, alpha: 0.92, ring: false }) });
    const [x, y] = gp(v, [103, 47.5]); crown(ctx, x, y - 6, 230, t, { glint: 0.6 });
  },
};
window.VIDEO = { drawScene, drawOverlay, mbFn, END, Bd, events };
