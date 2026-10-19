// «Солнечная система» — 30s kids video. One thread: a little rocket tour; every planet is a friendly character.
'use strict';
const C = { sp0: '#191657', sp1: '#3d2f93', star: '#fff6d6', sun: '#ffcf3a', sun2: '#ff9d1f', ink: '#2a1d4f', cheek: '#ff7aa8', white: '#ffffff', rocket: '#f5f7ff', red: '#ff5a5f', glass: '#9fe3ff', skin: '#ffd3b0', suit: '#ff8a3d' };
const LINES = [
  'Привет! Полетели в космос —|знакомиться с Солнечной системой!',
  'В центре — Солнце.|Это огромная звезда, и она нас греет.',
  'Вокруг него кружат восемь планет.',
  'Меркурий, Венера, Земля — наш дом —|и красный Марс.',
  'Дальше — великаны!|В Юпитер поместилось бы больше тысячи Земель!',
  'Сатурн с кольцами, Уран и Нептун.',
  'Вот она, наша космическая семья!|Пока-пока!',
];
const TIM = (() => {
  if (window.TIMINGS) return window.TIMINGS;
  const total = 28.6, lead = 0.4, gap = 0.4;
  const lens = LINES.map(s => s.replace(/\|/g, '').length); const sum = lens.reduce((a, b) => a + b, 0);
  const speak = total - gap * 6; let t = lead; const lines = [];
  lens.forEach(n => { const d = speak * n / sum; lines.push({ t0: t, t1: t + d }); t += d + gap; });
  return { lines, end: lines[6].t1 + 1.8 };
})();
const L = TIM.lines.map((l, i) => ({ ...l, text: LINES[i] }));
const CH = subChunks(L);
const chunkT = (line, k) => { let n = 0; for (let i = 0; i < line; i++) n += LINES[i].split('|').length; return CH[n + k].t0; };
// time when a word is spoken (proportional position inside its line); TIM.words can override
const wordT = (line, word) => { if (TIM.words && TIM.words[word] != null) return TIM.words[word]; const s = LINES[line].replace(/\|/g, ' '); const i = s.indexOf(word); return L[line].t0 + (L[line].t1 - L[line].t0) * (i / s.length); };
const END = TIM.end;
const Bd = [0, L[1].t0 - 0.2, L[2].t0 - 0.15, L[3].t0 - 0.25, L[4].t0 - 0.2, L[5].t0 - 0.2, L[6].t0 - 0.2, END];

const SKY_STARS = [makeStars(101, 600, 6000, 2600, 0.6, 1.6), makeStars(102, 200, 6000, 2600, 1.2, 2.6), makeStars(103, 60, 6000, 2600, 2.2, 4.0)];
function space(ctx, cam, t, a = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.sp0); g.addColorStop(1, C.sp1); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); applyCam(ctx, cam, 0.12); glow(ctx, 300, 300, 800, 'rgba(255,90,200,0.35)', 0.6 * a); glow(ctx, 1600, 800, 900, 'rgba(60,200,255,0.3)', 0.6 * a); ctx.restore();
  [0.12, 0.3, 0.55].forEach((p, i) => { ctx.save(); applyCam(ctx, cam, p); ctx.globalAlpha = a; drawStars(ctx, SKY_STARS[i], t, C.star, 0.6); ctx.restore(); });
  ctx.globalAlpha = 1;
}
function twinkleStar(ctx, x, y, r, a) { ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a; ctx.fillStyle = C.star; ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.3 : r; const an = i / 8 * TAU; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.fill(); ctx.restore(); }

// ---------- faces ----------
function face(ctx, x, y, r, opt = {}) {
  const bl = opt.blink || 0, lx = (opt.lx || 0) * r * 0.06, ly = (opt.ly || 0) * r * 0.05;
  const ex = r * 0.3, ey = -r * 0.08, er = r * 0.14;
  ctx.save(); ctx.translate(x, y); if (opt.rot) ctx.rotate(opt.rot);
  [-1, 1].forEach(s => {
    ctx.save(); ctx.translate(s * ex, ey); ctx.scale(1, Math.max(0.08, 1 - bl));
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, er * 0.85, er, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(lx, ly + er * 0.15, er * 0.5, er * 0.6, 0, 0, TAU); ctx.fill();
    circle(ctx, lx - er * 0.18, ly - er * 0.12, er * 0.2, '#fff');
    ctx.restore();
  });
  if (opt.shades) { const k = opt.shades; ctx.save(); ctx.translate(0, ey - (1 - k) * r * 0.9); ctx.globalAlpha = clamp(k * 3); ctx.fillStyle = '#1b1530'; [-1, 1].forEach(s => { rrect(ctx, s * ex - er * 1.25, -er * 0.8, er * 2.5, er * 1.6, er * 0.6); ctx.fill(); }); ctx.fillRect(-ex + er, -er * 0.35, 2 * ex - 2 * er, er * 0.3); ctx.fillStyle = 'rgba(255,255,255,0.5)'; [-1, 1].forEach(s => { ctx.fillRect(s * ex - er * 0.7, -er * 0.45, er * 0.5, er * 0.18); }); ctx.restore(); }
  ctx.globalAlpha = 0.55; circle(ctx, -r * 0.5, r * 0.16, r * 0.11, C.cheek); circle(ctx, r * 0.5, r * 0.16, r * 0.11, C.cheek); ctx.globalAlpha = 1;
  ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, r * 0.055); ctx.lineCap = 'round';
  const m = opt.mouth || 0; // 0 smile, >0 open (talking/excited)
  if (m > 0.05) { ctx.fillStyle = '#7a2340'; ctx.beginPath(); ctx.ellipse(0, r * 0.2, r * 0.17, r * 0.06 + r * 0.12 * m, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff8fa8'; ctx.beginPath(); ctx.ellipse(0, r * 0.2 + r * 0.08 * m, r * 0.09, r * 0.04 * m + 1, 0, 0, TAU); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(0, r * 0.06, r * 0.22, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke(); }
  ctx.restore();
}
const blinkAt = (t, seed) => { const per = 2.6 + (seed % 5) * 0.37; const k = ((t + seed * 0.71) % per) / per; return k > 0.94 ? Math.sin((k - 0.94) / 0.06 * Math.PI) : 0; };

// ---------- planets ----------
function planetBody(ctx, x, y, r, base, shade, extra, t) {
  ctx.save(); circle(ctx, x, y, r, base); ctx.clip();
  if (extra) extra(ctx, x, y, r, t);
  ctx.beginPath(); ctx.rect(x - r - 2, y - r - 2, 2 * r + 4, 2 * r + 4); ctx.arc(x - r * 0.28, y - r * 0.3, r * 1.05, 0, TAU, true); ctx.fillStyle = shade; ctx.fill('evenodd');
  circle(ctx, x - r * 0.45, y - r * 0.5, r * 0.18, 'rgba(255,255,255,0.35)');
  ctx.restore();
}
const PL = {
  mercury: { r: 70, base: '#b9b2c9', shade: 'rgba(60,40,90,0.35)', ex: (g, x, y, r) => { [[-0.3, 0.35, 0.2], [0.35, -0.1, 0.15], [0.1, 0.5, 0.1], [-0.45, -0.25, 0.12]].forEach(([a, b, c]) => circle(g, x + a * r, y + b * r, c * r, 'rgba(110,95,140,0.45)')); } },
  venus: { r: 105, base: '#ffd27a', shade: 'rgba(170,80,20,0.35)', ex: (g, x, y, r, t) => { g.strokeStyle = 'rgba(255,240,200,0.7)'; g.lineWidth = r * 0.12; g.lineCap = 'round'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x - r, y + i * r * 0.36); g.bezierCurveTo(x - r * 0.3, y + i * r * 0.36 - r * 0.2 + Math.sin(t + i) * 8, x + r * 0.3, y + i * r * 0.36 + r * 0.2, x + r, y + i * r * 0.36); g.stroke(); } } },
  earth: { r: 118, base: '#3d9cff', shade: 'rgba(20,30,120,0.35)', ex: (g, x, y, r, t) => { g.fillStyle = '#4fd27a'; const o = (t * 18) % (r * 2); [[-0.5, -0.4, 0.38, 0.28], [0.35, 0.1, 0.42, 0.34], [-0.2, 0.55, 0.3, 0.2], [0.6, -0.55, 0.22, 0.16]].forEach(([a, b, c, d]) => { for (const dx of [0, -2 * r]) { g.beginPath(); g.ellipse(x + a * r + ((o + dx + r * 3) % (r * 2)) - r, y + b * r, c * r, d * r, 0.3, 0, TAU); g.fill(); } }); g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(x, y - r * 0.95, r * 0.5, r * 0.18, 0, 0, TAU); g.fill(); } },
  mars: { r: 88, base: '#ff6b4a', shade: 'rgba(120,20,30,0.35)', ex: (g, x, y, r) => { [[-0.35, 0.3, 0.18], [0.3, -0.2, 0.13], [0.45, 0.45, 0.1]].forEach(([a, b, c]) => circle(g, x + a * r, y + b * r, c * r, 'rgba(170,40,30,0.5)')); g.fillStyle = '#fff3ee'; g.beginPath(); g.ellipse(x, y - r * 0.93, r * 0.36, r * 0.14, 0, 0, TAU); g.fill(); } },
  jupiter: { r: 330, base: '#f2c38a', shade: 'rgba(140,70,30,0.3)', ex: (g, x, y, r, t) => { const bands = ['#e3a565', '#f7dcb4', '#d98c4f', '#f2c38a', '#c9773f', '#f7dcb4']; bands.forEach((c, i) => { g.fillStyle = c; const yy = y - r + (i + 0.6) * r * 0.32; g.beginPath(); g.moveTo(x - r, yy); for (let k = 0; k <= 20; k++) { const xx = x - r + k * r / 10; g.lineTo(xx, yy + Math.sin(k * 0.9 + t * 0.8 + i) * r * 0.025); } g.lineTo(x + r, yy + r * 0.12); g.lineTo(x - r, yy + r * 0.12); g.fill(); }); g.fillStyle = '#d4553a'; g.beginPath(); g.ellipse(x + r * 0.38, y + r * 0.42, r * 0.2, r * 0.11, 0, 0, TAU); g.fill(); } },
  saturn: { r: 150, base: '#f4d48c', shade: 'rgba(150,90,30,0.3)', ex: (g, x, y, r) => { ['#e8bf6e', '#f9e3ae', '#e2b062'].forEach((c, i) => { g.fillStyle = c; g.fillRect(x - r, y - r * 0.6 + i * r * 0.45, 2 * r, r * 0.16); }); } },
  uranus: { r: 110, base: '#8ef0e6', shade: 'rgba(20,90,110,0.3)', ex: (g, x, y, r) => { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - r, y - r * 0.15, 2 * r, r * 0.2); } },
  neptune: { r: 108, base: '#3d6bff', shade: 'rgba(20,20,110,0.35)', ex: (g, x, y, r, t) => { g.strokeStyle = 'rgba(200,225,255,0.8)'; g.lineWidth = r * 0.07; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { const k = ((t * 0.9 + i * 0.27) % 1); g.globalAlpha = Math.sin(k * Math.PI); g.beginPath(); g.moveTo(x + r - k * r * 2.4, y - r * 0.5 + i * r * 0.3); g.lineTo(x + r - k * r * 2.4 + r * 0.6, y - r * 0.5 + i * r * 0.3); g.stroke(); } g.globalAlpha = 1; } },
};
function ring(ctx, x, y, r, tilt, rot, half, color = '#e9c98a') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = color; ctx.lineCap = 'round';
  [[1.7, 0.16, 1], [1.45, 0.1, 0.7]].forEach(([k, w, a]) => { ctx.globalAlpha = a; ctx.lineWidth = r * w; ctx.beginPath(); ctx.ellipse(0, 0, r * k, r * k * tilt, 0, half ? Math.PI : 0, half ? TAU : Math.PI); ctx.stroke(); });
  ctx.restore();
}
function planet(ctx, name, x, y, s, t, opt = {}) {
  const P = PL[name], r = P.r * s;
  if (name === 'saturn') ring(ctx, x, y, r, 0.28, opt.ringRot || -0.25, true);
  if (name === 'uranus') ring(ctx, x, y, r * 0.85, 0.22, Math.PI / 2 + (opt.ringRot || 0), true, 'rgba(200,250,255,0.8)');
  ctx.save(); if (opt.rot) { ctx.translate(x, y); ctx.rotate(opt.rot); ctx.translate(-x, -y); }
  planetBody(ctx, x, y, r, P.base, P.shade, P.ex, t);
  if (opt.face !== false) face(ctx, x, y + r * 0.1, r * 0.78, { blink: blinkAt(t, opt.seed || 1), mouth: opt.mouth || 0, lx: opt.lx, rot: opt.faceRot });
  ctx.restore();
  if (name === 'saturn') ring(ctx, x, y, r, 0.28, opt.ringRot || -0.25, false);
  if (name === 'uranus') ring(ctx, x, y, r * 0.85, 0.22, Math.PI / 2 + (opt.ringRot || 0), false, 'rgba(200,250,255,0.8)');
}
function sun(ctx, x, y, r, t, opt = {}) {
  glow(ctx, x, y, r * 2.6, 'rgba(255,180,40,0.75)', 0.9);
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.25);
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; const len = r * (0.32 + 0.08 * Math.sin(t * 3 + i * 1.3)); ctx.save(); ctx.rotate(a); ctx.fillStyle = i % 2 ? C.sun2 : '#ffb52e'; ctx.beginPath(); ctx.moveTo(r * 0.92, -r * 0.13); ctx.quadraticCurveTo(r + len, 0, r * 0.92, r * 0.13); ctx.fill(); ctx.restore(); }
  ctx.restore();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.6, C.sun); g.addColorStop(1, '#ffab1f');
  circle(ctx, x, y, r, g);
  face(ctx, x, y + r * 0.08, r * 0.8, { blink: blinkAt(t, 7), mouth: opt.mouth || 0, lx: opt.lx || 0 });
}

// ---------- rocket with the little astronaut ----------
function rocket(ctx, x, y, s, ang, t, opt = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  // flame (points down = -y is nose)
  const fl = opt.flame ?? 1;
  if (fl > 0) {
    const f = 1 + 0.18 * Math.sin(t * 40) + 0.1 * Math.sin(t * 23);
    glow(ctx, 0, 190, 170 * fl, 'rgba(255,160,40,0.8)', 0.8);
    ctx.fillStyle = '#ff7a1f'; ctx.beginPath(); ctx.moveTo(-42, 140); ctx.quadraticCurveTo(0, 140 + 230 * fl * f, 42, 140); ctx.fill();
    ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.moveTo(-24, 140); ctx.quadraticCurveTo(0, 140 + 140 * fl * f, 24, 140); ctx.fill();
  }
  // fins
  ctx.fillStyle = C.red;
  [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(sd * 58, 30); ctx.quadraticCurveTo(sd * 120, 90, sd * 112, 165); ctx.lineTo(sd * 50, 120); ctx.closePath(); ctx.fill(); });
  // body
  ctx.beginPath(); ctx.moveTo(0, -210); ctx.bezierCurveTo(95, -150, 85, 60, 58, 140); ctx.lineTo(-58, 140); ctx.bezierCurveTo(-85, 60, -95, -150, 0, -210); ctx.closePath(); ctx.fillStyle = C.rocket; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(80,70,160,0.16)'; ctx.fillRect(18, -220, 120, 380);
  ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(0, -212); ctx.bezierCurveTo(60, -170, 70, -130, 74, -112); ctx.lineTo(-74, -112); ctx.bezierCurveTo(-70, -130, -60, -170, 0, -212); ctx.fill();
  ctx.fillStyle = '#d9dcf5'; ctx.fillRect(-90, 96, 180, 14); ctx.restore();
  ctx.fillStyle = '#c9cde8'; rrect(ctx, -46, 136, 92, 22, 8); ctx.fill();
  // window with astronaut
  circle(ctx, 0, -40, 56, '#d9dcf5'); circle(ctx, 0, -40, 46, '#20305f');
  ctx.save(); circle(ctx, 0, -40, 46); ctx.clip();
  ctx.save(); ctx.translate(0, -32); ctx.rotate(-ang * 0.6); // keep the kid upright-ish
  circle(ctx, 0, 6, 40, C.suit);
  circle(ctx, 0, -6, 30, C.skin);
  ctx.fillStyle = '#6b3a1f'; ctx.beginPath(); ctx.arc(0, -12, 31, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  face(ctx, 0, -2, 26, { blink: blinkAt(t, 3), mouth: opt.mouth || 0, shades: opt.shades || 0 });
  if (opt.wave) { const wv = Math.sin(t * 12) * 0.5; ctx.save(); ctx.translate(28, 18); ctx.rotate(-0.6 + wv); ctx.fillStyle = '#ffffff'; rrect(ctx, -7, -34, 14, 34, 7); ctx.fill(); circle(ctx, 0, -36, 10, '#ffffff'); ctx.restore(); }
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, -40, 34, -2.6, -1.9); ctx.stroke();
  ctx.restore();
}
function cloud(ctx, x, y, s, a = 1) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; [[0, 0, 70], [60, -20, 80], [130, 5, 60], [-60, 10, 55]].forEach(([dx, dy, r]) => circle(ctx, x + dx * s, y + dy * s, r * s, '#ffffff')); ctx.fillRect(x - 60 * s, y, 190 * s, 55 * s); ctx.restore(); }
function bubbleText(ctx, text, x, y, size, k, color = '#ffffff', stroke = '#3a2a8a') {
  if (k <= 0) return;
  const e = E.outBack(clamp(k), 2.2);
  ctx.save(); ctx.translate(x, y); ctx.scale(e, e); ctx.rotate((1 - clamp(k * 1.5)) * -0.2);
  ctx.font = `900 ${size}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.22; ctx.strokeStyle = stroke; ctx.strokeText(text, 0, 0); ctx.fillStyle = color; ctx.fillText(text, 0, 0);
  ctx.restore();
}
function vign(ctx, a = 0.35) { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(10,5,40,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }

// ================= SCENES =================
// K1 — launch from a green hill up through the clouds into space
function k1(ctx, u, d, t) {
  const lift = 1.25;
  const ry = u < lift ? 0 : -700 * Math.pow(u - lift, 2) - 250 * (u - lift);
  const shake = u > 0.75 && u < lift + 0.6 ? Math.sin(u * 90) * 4 * (u < lift ? seg(u, 0.75, lift) : 1 - seg(u, lift, lift + 0.6)) : 0;
  const turn = E.inOut(seg(u, d - 0.8, d - 0.1));
  const rx = 960 + E.in3(seg(u, d - 0.65, d)) * 1500;
  const rY = 740 + ry;
  const cam = { x: 960 + turn * 120, y: Math.min(540, rY - 10), z: lerp(1.0, 0.9, seg(u, 0, lift + 0.8)), r: Math.sin(u * 1.3) * 0.01 };
  const alt = Math.max(0, 540 - cam.y);
  const sp = clamp(alt / 2600);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix('#6ccfff', C.sp0, sp)); g.addColorStop(1, mix('#c9f0ff', C.sp1, sp)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (sp > 0.2) [0.12, 0.3, 0.55].forEach((p, i) => { const oy = (((540 - cam.y) * p) % 2600 + 2600) % 2600; ctx.save(); applyCam(ctx, { x: cam.x, y: 540, z: 1, r: cam.r }, p); ctx.globalAlpha = seg(sp, 0.2, 0.8); ctx.translate(0, oy); drawStars(ctx, SKY_STARS[i], t, C.star, 0.6); ctx.translate(0, -2600); drawStars(ctx, SKY_STARS[i], t, C.star, 0.6); ctx.restore(); });
  ctx.globalAlpha = 1;
  // far clouds
  ctx.save(); applyCam(ctx, cam, 0.6);
  [[300, 380], [1500, 300], [900, -400], [200, -900], [1700, -1300], [600, -1900]].forEach(([x, y], i) => cloud(ctx, x, y, 0.9, 0.85));
  ctx.restore();
  // ground
  ctx.save(); applyCam(ctx, cam, 1);
  ctx.fillStyle = '#7fe08a'; ctx.beginPath(); ctx.moveTo(-800, 1400); ctx.lineTo(-800, 930); ctx.quadraticCurveTo(960, 770, 2700, 930); ctx.lineTo(2700, 1400); ctx.fill();
  ctx.fillStyle = '#5cc56f'; ctx.beginPath(); ctx.moveTo(-800, 1400); ctx.lineTo(-800, 1000); ctx.quadraticCurveTo(700, 900, 2700, 1040); ctx.lineTo(2700, 1400); ctx.fill();
  // launch pad
  ctx.fillStyle = '#8b86c9'; rrect(ctx, 840, 878, 240, 26, 10); ctx.fill(); ctx.fillStyle = '#6c66b3'; ctx.fillRect(770, 600, 22, 290); ctx.fillRect(770, 640, 120, 14);
  // smoke puffs at liftoff
  if (u > lift - 0.2) { const R = rng(4); for (let i = 0; i < 14; i++) { const k = clamp((u - lift + 0.2 - i * 0.03) / 1.2); if (k <= 0) continue; const sd = R() < 0.5 ? -1 : 1; cloud(ctx, 960 + sd * (40 + k * (180 + R() * 220)), 880 - k * 30 * R(), 0.35 + k * 0.5, (1 - k) * 0.9); } }
  rocket(ctx, rx + shake, rY, 1.0, turn * Math.PI / 2, t, { flame: u < 0.75 ? 0 : clamp((u - 0.75) * 3) * (1 + 0.5 * seg(u, lift, lift + 1)), wave: u < 1.6, mouth: u > lift ? 0.6 : 0 });
  ctx.restore();
  // near clouds stream past (out of focus)
  layer(ctx, 7, gg => { applyCam(gg, cam, 1.45); [[100, 200], [1450, -300], [400, -800], [1600, -1500], [700, -2200], [1300, -2900]].forEach(([x, y]) => cloud(gg, x, y, 2.2, 0.95)); });
  vign(ctx, 0.25);
}

// K2 — the big friendly Sun; sunglasses on
const SUN2 = { x: 1270, y: 520, r: 330 };
function k2cam(u, d) {
  const c = camKeys([{ t: 0, v: [960, 540, 1.0, 0.0] }, { t: d - 0.7, v: [1010, 530, 1.08, 0.015] }], u);
  const out = E.inOut(seg(u, d - 0.75, d));
  return { x: lerp(c.x, SUN2.x, out), y: lerp(c.y, SUN2.y, out), z: c.z * Math.pow(92 / SUN2.r / 1.08, out), r: c.r * (1 - out) };
}
function k2(ctx, u, d, t) {
  const cam = k2cam(u, d);
  space(ctx, cam, t);
  const shT = (chunkT(1, 1) - Bd[1]) + (L[1].t1 - chunkT(1, 1)) * 0.55;
  const shades = E.outBack(seg(u, shT, shT + 0.4), 1.8);
  ctx.save(); applyCam(ctx, cam, 1);
  sun(ctx, SUN2.x, SUN2.y, SUN2.r * E.outBack(seg(u, 0, 0.6), 1.3), t, { mouth: u > 0.4 && u < 1.4 ? 0.4 + 0.3 * Math.sin(u * 14) : 0, lx: -0.8 });
  // heat waves
  if (shades > 0) { ctx.strokeStyle = 'rgba(255,220,120,0.7)'; ctx.lineWidth = 7; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const y0 = 450 + i * 70; ctx.beginPath(); for (let x = 760; x < 900; x += 6) ctx.lineTo(x, y0 + Math.sin(x * 0.08 - t * 10) * 8); ctx.globalAlpha = clamp(shades); ctx.stroke(); } ctx.globalAlpha = 1; }
  const rin = E.out3(seg(u, 0, 1.1));
  const rx = lerp(-300, 520, rin) - E.in3(seg(u, d - 0.7, d)) * 300, ry = 560 + Math.sin(t * 2.2) * 14;
  rocket(ctx, rx, ry, 0.85, Math.PI / 2 + Math.sin(t * 2.2) * 0.04, t, { flame: 0.5 + 0.5 * (1 - rin), shades, mouth: shades > 0.5 ? 0 : 0 });
  ctx.restore();
  vign(ctx, 0.3);
}

// K3 — eight orbits around the Sun
const ORB = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const ORB_R = [0.13, 0.19, 0.2, 0.15, 0.37, 0.32, 0.25, 0.25];
function k3(ctx, u, d, t) {
  const cam = camKeys([{ t: 0, v: [960, 540, 1.0, 0.0] }, { t: d, v: [960, 540, 0.96, -0.03] }], u);
  space(ctx, cam, t);
  const tilt = lerp(0.24, 0.4, E.inOut(seg(u, 0, d)));
  const cx = 960, cy = 560;
  ctx.save(); applyCam(ctx, cam, 1); ctx.translate(cx, cy); ctx.rotate(-0.06); ctx.translate(-cx, -cy);
  const pos = [];
  ORB.forEach((n, i) => {
    const rx = 165 + i * 96, ry = rx * tilt;
    const dp = E.inOut(seg(u, 0.05 + i * 0.12, 0.6 + i * 0.12));
    ctx.strokeStyle = 'rgba(200,190,255,0.45)'; ctx.lineWidth = 3; ctx.setLineDash([10, 12]);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + dp * TAU); ctx.stroke(); ctx.setLineDash([]);
    const a = -Math.PI / 2 + dp * TAU + (t - Bd[2]) * (0.9 - i * 0.08);
    pos.push({ n, i, x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, pop: E.outBack(seg(u, 0.5 + i * 0.12, 0.8 + i * 0.12), 2.4) });
  });
  // sun drawn between back and front planets
  pos.filter(p => p.y < cy).forEach(p => p.pop > 0 && planet(ctx, p.n, p.x, p.y, ORB_R[p.i] * p.pop, t, { seed: p.i + 2, face: true }));
  sun(ctx, cx, cy, 92, t);
  pos.filter(p => p.y >= cy).forEach(p => p.pop > 0 && planet(ctx, p.n, p.x, p.y, ORB_R[p.i] * p.pop, t, { seed: p.i + 2 }));
  ctx.restore();
  // "8" counter
  const n8 = seg(u, 0.5, 0.5 + 0.12 * 8);
  const cnt = Math.min(8, Math.floor(n8 * 8.99));
  if (cnt > 0) { const kick = ((n8 * 8.99) % 1); bubbleText(ctx, String(cnt), 960, 130, 120 + 20 * (1 - E.out3(clamp(kick * 2))), 1, '#ffe14d'); }
  if (cnt >= 8) bubbleText(ctx, 'ПЛАНЕТ', 960, 230, 54, seg(u, 0.5 + 0.12 * 8, 0.5 + 0.12 * 8 + 0.3));
  vign(ctx, 0.3);
}

// K4–K6 — the tour: one world track, rocket flies right; planets pass and say hi
const TRACK = (() => {
  const names = [['mercury', 'Меркурий', 3, 'Меркурий'], ['venus', 'Венера', 3, 'Венера'], ['earth', 'Земля', 3, 'Земля'], ['mars', 'Марс', 3, 'Марс'], ['jupiter', 'Юпитер', 4, 'великаны'], ['saturn', 'Сатурн', 5, 'Сатурн'], ['uranus', 'Уран', 5, 'Уран'], ['neptune', 'Нептун', 5, 'Нептун']];
  const ys = { mercury: 400, venus: 470, earth: 440, mars: 420, jupiter: 520, saturn: 470, uranus: 450, neptune: 450 };
  let x = 1400; const out = [];
  names.forEach(([n, label, line, word], i) => {
    const tn = wordT(line, word);
    if (i > 0) { const prev = out[i - 1]; const gap = n === 'jupiter' ? 1500 : prev.n === 'jupiter' ? 1500 : 1150; x = prev.x + gap; }
    out.push({ n, label, tn, x, y: ys[n] });
  });
  return out;
})();
const SCREEN_X = { jupiter: 1260 };
function trackCam(t) {
  const keys = [{ t: Bd[3], v: [TRACK[0].x - 190 - 1300, 540, 1.0] }];
  TRACK.forEach(p => { keys.push({ t: p.tn, v: [p.x - ((SCREEN_X[p.n] || 1150) - 960), 540, p.n === 'jupiter' ? 0.92 : 1.0] }); });
  // hold on Jupiter while the Earths pour in
  const jt = TRACK[4]; keys.splice(6, 0, { t: Math.min(TRACK[5].tn - 0.9, L[4].t1 + 0.1), v: [jt.x - 300 + 60, 540, 0.9] });
  keys.push({ t: Bd[6], v: [TRACK[7].x - 190 + 900, 540, 1.0] });
  keys.sort((a, b) => a.t - b.t);
  const v = spline(keys, t); return { x: v[0], y: v[1] + Math.sin(t * 0.9) * 10, z: v[2], r: Math.sin(t * 0.5) * 0.012 };
}
function tour(ctx, t) {
  const cam = trackCam(t);
  space(ctx, cam, t);
  // speed lines
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; const R = rng(55);
  for (let i = 0; i < 18; i++) { const y = R() * H, sp = 0.6 + R(); const x = ((-(cam.x * sp) % 2400) + 2400 + R() * 2400) % 2400 - 240; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 120 + R() * 140, y); ctx.stroke(); }
  ctx.restore();
  ctx.save(); applyCam(ctx, cam, 1);
  for (const p of TRACK) {
    if (Math.abs(p.x - cam.x) > 1900) continue;
    const near = clamp(1 - Math.abs(p.x - (cam.x + 190)) / 900);
    const named = t - p.tn;
    let s = 1, y = p.y, opt = { seed: TRACK.indexOf(p) + 1, mouth: named > 0 && named < 0.6 ? 0.6 : 0, lx: -0.6 };
    if (p.n === 'jupiter') {
      const rise = E.outBack(seg(t, Bd[4] - 0.1, Bd[4] + 0.6), 1.4); y = lerp(1500, p.y, rise); s = 1;
      opt.mouth = named > 0 && named < 0.9 ? 0.8 : 0;
      planet(ctx, 'jupiter', p.x, y, s, t, { ...opt, face: false });
      // Earths pour in
      const f0 = chunkT(4, 1) + 0.25, fill = seg(t, f0, f0 + 2.0);
      const r = PL.jupiter.r;
      if (fill > 0) {
        ctx.save(); circle(ctx, p.x, y, r - 4); ctx.clip();
        const level = y + r - fill * 2 * r; const sp2 = 17;
        for (let yy = y + r - sp2 / 2; yy > y - r; yy -= sp2) { if (yy < level) break; for (let xx = p.x - r; xx < p.x + r; xx += sp2) { const ox = (Math.floor((yy - y) / sp2) % 2) * sp2 / 2; circle(ctx, xx + ox, yy, 7, '#4aa8ff'); circle(ctx, xx + ox - 1.5, yy - 1.5, 3, '#5ee08a'); } }
        ctx.restore();
        if (fill < 1) { const R2 = rng(8); for (let i = 0; i < 40; i++) { const k = ((t * 1.6 + R2()) % 1); const sx = p.x - 260 + R2() * 520; circle(ctx, sx + (1 - k) * -80, y - r - 260 + k * (260 + r * 2 * (1 - fill)), 7, '#3d9cff'); } }
      }
      face(ctx, p.x, y + r * 0.1, r * 0.78, { blink: blinkAt(t, 9), mouth: fill > 0.98 ? 0.3 + 0.5 * Math.sin(seg(t, f0 + 2.0, f0 + 2.4) * Math.PI) : opt.mouth, lx: -0.5 });
      // counter
      if (fill > 0) { const n = Math.floor(E.out2(fill) * 1000); const k = seg(t, f0, f0 + 0.3); bubbleText(ctx, (fill >= 1 ? '1000+' : String(n)), p.x - r - 330, y - r + 80, 92, k, '#ffe14d'); }
      bubbleText(ctx, 'ЮПИТЕР', p.x, y + r + 58, 60, seg(t, p.tn + 0.05, p.tn + 0.45));
      continue;
    }
    if (p.n === 'saturn') opt.ringRot = -0.25 + 0.25 * Math.sin(t * 5);
    if (p.n === 'uranus') { opt.rot = t * 0.8; opt.faceRot = 0; }
    const bounce = named > 0 ? 1 + 0.12 * Math.sin(clamp(named / 0.4) * Math.PI) : 1;
    planet(ctx, p.n, p.x, y, s * bounce, t, opt);
    if (p.n === 'earth') { const ma = t * 1.8; const mx = p.x + Math.cos(ma) * 190, my = y + Math.sin(ma) * 60; planetBody(ctx, mx, my, 26, '#e7e3f2', 'rgba(60,40,90,0.3)', null, t); const heart = E.outBack(seg(t, wordT(3, 'наш дом'), wordT(3, 'наш дом') + 0.4), 2.2); if (heart > 0) { ctx.save(); ctx.translate(p.x + 175, y - 60); ctx.scale(heart * 1.3, heart * 1.3); ctx.fillStyle = '#ff5a8a'; ctx.beginPath(); ctx.moveTo(0, 18); ctx.bezierCurveTo(-40, -10, -20, -40, 0, -20); ctx.bezierCurveTo(20, -40, 40, -10, 0, 18); ctx.fill(); ctx.restore(); } }
    if (p.n === 'mars') { ctx.strokeStyle = 'rgba(255,180,140,0.6)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a0 = t * 2 + i * 2.1; ctx.beginPath(); ctx.arc(p.x, y, PL.mars.r + 26 + i * 10, a0, a0 + 0.9); ctx.stroke(); } }
    const lab = PL[p.n].r * s + (p.n === 'saturn' || p.n === 'uranus' ? 70 : 50);
    bubbleText(ctx, p.label.toUpperCase(), p.x, y - lab, 56, seg(t, p.tn + 0.02, p.tn + 0.4));
  }
  ctx.restore();
  // the rocket stays with us on screen
  const rb = Math.sin(t * 2.4) * 14;
  rocket(ctx, 400, 600 + rb, 0.62, Math.PI / 2 + Math.sin(t * 2.4) * 0.05, t, { flame: 0.9, mouth: 0 });
  vign(ctx, 0.3);
}

// K7 — family photo, wave goodbye
const FAM = [['mercury', 520, 0.55], ['venus', 650, 0.62], ['earth', 790, 0.6], ['mars', 915, 0.55], ['jupiter', 1110, 0.42], ['saturn', 1390, 0.62], ['uranus', 1610, 0.62], ['neptune', 1790, 0.62]];
function k7(ctx, u, d, t) {
  const fl = chunkT(6, 1) - Bd[6] - 0.25;
  const photo = E.inOut(seg(u, fl + 0.1, fl + 0.7));
  const cam = camKeys([{ t: 0, v: [1060, 520, 1.12, 0.0] }, { t: fl, v: [1020, 540, 1.0, 0.0] }, { t: d, v: [1020, 540, 0.98, 0] }], u);
  // photo frame transform
  ctx.save();
  if (photo > 0) { ctx.fillStyle = '#2b2470'; ctx.fillRect(0, 0, W, H); ctx.save(); ctx.globalAlpha = photo; space(ctx, cam, t * 0.3, 0.6); ctx.restore(); ctx.translate(W / 2, H / 2 - 80 * photo); ctx.rotate(-0.04 * photo); const s = lerp(1, 0.72, photo); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-40 + 20, -40 + 30, W + 80, H + 220); ctx.fillStyle = '#fffaf0'; ctx.fillRect(-40, -40, W + 80, H + 220);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); }
  space(ctx, cam, t);
  ctx.save(); applyCam(ctx, cam, 1);
  sun(ctx, 150, 540, 300, t, { mouth: u > fl + 0.8 ? 0.5 + 0.3 * Math.sin(u * 12) : 0 });
  FAM.forEach(([n, x, s], i) => {
    const k = E.outBack(seg(u, 0.05 + i * 0.07, 0.45 + i * 0.07), 1.8);
    const wave = u > fl + 0.8 ? Math.sin(u * 9 + i) * 18 : 0;
    const y = 560 + Math.sin(t * 2 + i) * 8 - wave * 0.6 + (1 - k) * 700;
    planet(ctx, n, x, y, s * (0.9 + 0.1 * k), t, { seed: i + 4, mouth: u > fl + 0.8 ? 0.6 : 0, lx: 0, ringRot: n === 'saturn' ? -0.2 + Math.sin(u * 5) * 0.15 : 0, rot: n === 'uranus' ? 0.4 : 0 });
  });
  const rin = E.out3(seg(u, 0.3, 1.2));
  rocket(ctx, lerp(-200, 980, rin), 880 + Math.sin(t * 2.4) * 10, 0.5, Math.PI / 2, t, { flame: 0.6, wave: u > fl + 0.8, mouth: u > fl + 0.8 ? 0.6 : 0 });
  ctx.restore();
  ctx.restore();
  if (photo > 0) {
    ctx.save(); ctx.translate(W / 2, H / 2 - 80 * photo); ctx.rotate(-0.04 * photo); const s = lerp(1, 0.72, photo); ctx.scale(s, s);
    ctx.globalAlpha = seg(u, fl + 0.5, fl + 0.9); ctx.font = '900 80px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#3a2a8a'; ctx.fillText('Наша космическая семья', 0, H / 2 + 105); ctx.restore();
  }
  // camera flash
  const fk = seg(u, fl, fl + 0.35); if (fk > 0 && fk < 1) { ctx.fillStyle = `rgba(255,255,255,${(1 - fk) * 0.85})`; ctx.fillRect(0, 0, W, H); }
  vign(ctx, 0.3);
  const fo = seg(u, d - 0.45, d); if (fo > 0) { ctx.fillStyle = `rgba(20,10,50,${fo})`; ctx.fillRect(0, 0, W, H); }
}

function drawScene(ctx, t) {
  let i = 0; while (i < 6 && t >= Bd[i + 1]) i++;
  if (i === 0) k1(ctx, t, Bd[1], t);
  else if (i === 1) k2(ctx, t - Bd[1], Bd[2] - Bd[1], t);
  else if (i === 2) k3(ctx, t - Bd[2], Bd[3] - Bd[2], t);
  else if (i <= 5) {
    tour(ctx, t);
    // K3 → K4: orbit view zooms toward the camera and opens onto the tour
    const k = 1 - seg(t, Bd[3], Bd[3] + 0.45);
    if (k > 0) { ctx.save(); ctx.globalAlpha = k; ctx.translate(W / 2, H / 2); const z = 1 + (1 - k) * 1.6; ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); k3(ctx, Bd[3] - Bd[2], Bd[3] - Bd[2], t); ctx.restore(); }
  }
  else k7(ctx, t - Bd[6], END - Bd[6], t);
  // K6 → K7: soft white swipe
  const sw = seg(t, Bd[6] - 0.2, Bd[6] + 0.2);
  if (sw > 0 && sw < 1) { ctx.fillStyle = `rgba(255,250,235,${Math.sin(sw * Math.PI) * 0.8})`; ctx.fillRect(0, 0, W, H); }
}
const SUBOPT = { font: '900 52px Nunito, sans-serif', bottom: 64, stroke: 12, strokeColor: 'rgba(42,26,110,0.92)', color: '#ffffff' };
function drawOverlay(ctx, t) { drawSubs(ctx, CH, t, SUBOPT); }
function mbFn(t) {
  if (t > 1.2 && t < Bd[1] + 0.3) return { n: 5, shutter: 0.9 / FPS };
  if (Math.abs(t - Bd[2]) < 0.4 || Math.abs(t - Bd[3]) < 0.4) return { n: 5, shutter: 0.8 / FPS };
  return { n: 3, shutter: 0.6 / FPS };
}
function events() {
  const ev = []; const A = (n, t, extra = {}) => ev.push({ n, t, ...extra });
  A('rumble', 0.75, { d: 1.6 }); A('launch', 1.25); A('whoosh', 1.9); A('whoosh', 2.6); A('whoosh', Bd[1] - 0.6);
  A('sparkle', Bd[1] + 0.1); A('swoosh_in', Bd[1] + 0.05);
  const shT = chunkT(1, 1) + (L[1].t1 - chunkT(1, 1)) * 0.55; A('shades', shT + 0.15);
  A('zoom_out', Bd[2] - 0.75);
  for (let i = 0; i < 8; i++) A('pop_note', Bd[2] + 0.5 + i * 0.12 + 0.12, { i });
  A('zoom_in', Bd[3]);
  TRACK.forEach((p, i) => A(p.n === 'jupiter' ? 'big_boing' : 'name_chime', p.n === 'jupiter' ? Bd[4] + 0.1 : p.tn, { i }));
  A('heart', wordT(3, 'наш дом'));
  const f0 = chunkT(4, 1) + 0.25; A('pour', f0, { d: 2.0 }); A('ding', f0 + 2.0); A('burp', f0 + 2.05);
  A('hula', wordT(5, 'Сатурн') + 0.1);
  A('swipe', Bd[6] - 0.2);
  for (let i = 0; i < 8; i++) A('plop', Bd[6] + 0.3 + i * 0.07, { i });
  const fl = chunkT(6, 1) - 0.25; A('shutter', fl); A('final_chord', fl + 0.05);
  return { events: ev, Bd, L: L.map(l => ({ t0: l.t0, t1: l.t1 })), END };
}
window.VIDEO = { drawScene, drawOverlay, mbFn, END, Bd, L, CH, TRACK, events };
