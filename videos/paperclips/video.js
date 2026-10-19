// «Скрепочный максимизатор» (~2:35). One thread: a single paperclip and the "СКРЕПОК: N" counter. See storyboard.md.
// Shared drawing (dude, aiCore, eye, sky, label, paperclip…) comes from engine/kit.js.
'use strict';
const N = narration();
const at = N.at;
Object.assign(PAL, { steel: '#c9d4e8', steelD: '#7d8aa6', wood: '#8a4f3a', woodD: '#6a3a2c', note: '#ffd65c', red: '#ff4d5e', calm0: '#0f2f4f', calm1: '#2a6f86' });
const IDS = ['hook', 'title', 'origin', 'factory', 'smarter', 'convergence', 'button', 'atoms', 'cosmos', 'orthogonality', 'boat', 'lesson', 'game', 'ending'];
const { Bd, S, lw } = sceneTimeline(N, IDS);
const END = N.END;

// ---------------- the counter: the thread of the video ----------------
// log-linear between milestones anchored to words
const CK = [
  [at('title', 'максимизатор'), 1], [at('factory', 'налаживает'), 1], [at('factory', 'довольны') + 0.5, 2.4e6],
  [at('smarter', 'энергии') + 0.5, 6e9], [at('convergence', 'цели') + 0.5, 4e10], [at('button', 'защитить') + 0.4, 9e10],
  [at('atoms', 'другого') + 0.5, 3e12], [at('cosmos', 'Земля'), 5e12], [at('cosmos', 'система') + 0.4, 2e26], [at('cosmos', 'фабрики') + 0.4, 6e33],
  [at('cosmos', 'Галактика') + 0.8, 4e46], [at('cosmos', 'безупречно'), 3e55],
];
function clipCount(t) {
  if (t <= CK[0][0]) return 1;
  for (let i = 0; i < CK.length - 1; i++) {
    const [a, va] = CK[i], [b, vb] = CK[i + 1];
    if (t < b) { const k = E.inOut2(clamp((t - a) / (b - a))); return Math.exp(lerp(Math.log(va), Math.log(vb), k)); }
  }
  return CK[CK.length - 1][1];
}
function fmtCount(v) {
  if (v < 1e6) return { main: Math.floor(v).toLocaleString('ru-RU'), exp: null };
  let e = Math.floor(Math.log10(v)); let m = Math.round(v / Math.pow(10, e) * 10) / 10;
  if (m >= 10) { m = 1; e += 1; }  // 9.96 must read 1.0 × 10^(e+1), not 10.0 × 10^e
  return { main: `${m.toFixed(1).replace('.', ',')} × 10`, exp: String(e) };
}
// fixed screen-space counter, top-right; a = visibility, override = forced value (finale)
function hud(ctx, t, a, override) {
  if (a <= 0) return;
  const v = override ?? clipCount(t); const f = fmtCount(v);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a;
  const x = W - 60, y = 70;
  ctx.font = '900 46px Unbounded, sans-serif'; const mw = ctx.measureText(f.main).width;
  ctx.font = '900 26px Unbounded, sans-serif'; const ew = f.exp ? ctx.measureText(f.exp).width + 6 : 0;
  const w = Math.max(mw + ew, 210) + 140;
  ctx.translate((1 - a) * 80, 0);
  ctx.fillStyle = 'rgba(0,0,20,0.35)'; rrect(ctx, x - w + 6, y - 40 + 8, w, 92, 22); ctx.fill();
  ctx.fillStyle = 'rgba(14,10,48,0.88)'; rrect(ctx, x - w, y - 40, w, 92, 22); ctx.fill();
  paperclip(ctx, x - w + 50, y + 6, 64, 0.5, PAL.steel, { w: 0.06 });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = '800 17px Unbounded, sans-serif'; ctx.fillStyle = PAL.steelD; ctx.fillText('СКРЕПОК', x - w + 95, y - 10);
  ctx.font = '900 46px Unbounded, sans-serif'; ctx.fillStyle = PAL.white; ctx.fillText(f.main, x - w + 92, y + 38);
  if (f.exp) { ctx.font = '900 26px Unbounded, sans-serif'; ctx.fillStyle = PAL.amber; ctx.fillText(f.exp, x - w + 96 + mw, y + 12); }
  ctx.restore();
}

// ---------------- the desk (opening and finale) ----------------
const DESK = { y: 700, clipX: 1150, clipY: 712 };
function robot(ctx, x, y, s, t, laser) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 3) * 0.05);
  ctx.fillStyle = '#9aa4c4'; rrect(ctx, -60, -40, 120, 130, 18); ctx.fill(); ctx.fillStyle = 'rgba(0,0,20,0.2)'; rrect(ctx, 10, -40, 50, 130, 14); ctx.fill();
  ctx.fillStyle = '#b8c1dd'; rrect(ctx, -50, -130, 100, 84, 16); ctx.fill();
  ctx.strokeStyle = '#b8c1dd'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -130); ctx.lineTo(0, -165); ctx.stroke(); circle(ctx, 0, -170, 9, PAL.red);
  circle(ctx, -20, -90, 12, PAL.red); circle(ctx, 22, -90, 12, PAL.red); glow(ctx, 0, -90, 70, rgba(PAL.red, 0.6), 0.6);
  ctx.fillStyle = '#2a2650'; ctx.fillRect(-26, -66, 52, 8);
  ctx.fillStyle = '#7d86a8'; rrect(ctx, 50, 0, 90, 26, 10); ctx.fill(); // laser gun arm
  if (laser > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(PAL.red, 0.9 * laser); ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(140, 13); ctx.lineTo(140 + 520 * laser, 13 - 380 * laser); ctx.stroke(); ctx.strokeStyle = '#ffd0d6'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
  ctx.restore();
}
function deskWorld(ctx, cam, t, o = {}) {
  const night = o.night || 0;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, mix('#2a2275', '#100c3a', night)); g.addColorStop(1, mix('#3d33a0', '#1c1660', night));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // back wall: window with stars, shelf, sticky note
  layer(ctx, 2.2, gg => {
    applyCam(gg, cam, 0.75);
    rrect(gg, 60, 160, 380, 330, 16); gg.fillStyle = '#0b0828'; gg.fill();
    gg.save(); rrect(gg, 76, 176, 348, 298, 10); gg.clip(); const sg = gg.createLinearGradient(0, 176, 0, 474); sg.addColorStop(0, '#0a0730'); sg.addColorStop(1, '#2a1c66'); gg.fillStyle = sg; gg.fillRect(76, 176, 348, 298);
    const R = rng(4); for (let i = 0; i < 36; i++) { gg.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.8 + R()) + i)); circle(gg, 76 + R() * 348, 176 + R() * 298, 1 + R() * 2, '#fff'); } gg.globalAlpha = 1;
    circle(gg, 350, 240, 30, '#f4e7c4'); circle(gg, 364, 232, 28, '#0d0a33'); gg.restore();
    gg.fillStyle = '#0b0828'; gg.fillRect(246, 160, 8, 330); gg.fillRect(60, 322, 380, 8);
    gg.fillStyle = '#4a3a9a'; gg.fillRect(1380, 300, 380, 16);
    const B = rng(9); let x = 1395; while (x < 1740) { const bw = 20 + B() * 26, bh = 60 + B() * 70; gg.fillStyle = ['#5240c4', '#7a2a6a', '#2f6fd0', '#d9831f', '#2fae8e'][Math.floor(B() * 5)]; gg.fillRect(x, 300 - bh, bw, bh); x += bw + 5; }
  });
  ctx.save(); applyCam(ctx, cam, 0.9);
  // sticky note with the order
  const np = o.note ?? 1;
  if (np > 0) {
    ctx.save(); ctx.translate(610, 300); ctx.rotate(-0.05 + Math.sin(t * 1.2) * 0.01); ctx.scale(np, np);
    ctx.fillStyle = 'rgba(0,0,20,0.3)'; ctx.fillRect(-104, -94, 220, 200); ctx.fillStyle = PAL.note; ctx.fillRect(-110, -100, 220, 200);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(-110, -100, 220, 34);
    label(ctx, 'ДЕЛАЙ', 0, -20, 40, { color: '#3a2a10', weight: 900 }); label(ctx, 'СКРЕПКИ', 0, 34, 40, { color: '#3a2a10', weight: 900 });
    ctx.restore();
  }
  ctx.restore();
  ctx.save(); applyCam(ctx, cam, 1);
  // the person behind the desk, facing us
  dude(ctx, 900, DESK.y + 150, 470, t, { body: '#4f7cff', look: o.look || [0.5, 0.5], mood: o.mood || 'calm', arms: o.arms || 'down', seed: 0.3, noShadow: true });
  // lamp
  ctx.strokeStyle = '#1d1660'; ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(1480, DESK.y); ctx.lineTo(1440, 520); ctx.lineTo(1330, 440); ctx.stroke();
  ctx.save(); ctx.translate(1320, 440); ctx.rotate(0.6); ctx.fillStyle = '#2b2275'; ctx.beginPath(); ctx.moveTo(-70, -10); ctx.lineTo(70, -10); ctx.lineTo(40, -60); ctx.lineTo(-40, -60); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const lg = ctx.createLinearGradient(1300, 470, 1150, DESK.y); lg.addColorStop(0, 'rgba(255,200,120,0.35)'); lg.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(1290, 460); ctx.lineTo(960, DESK.y); ctx.lineTo(1420, DESK.y); ctx.closePath(); ctx.fill(); ctx.restore();
  // desk
  ctx.fillStyle = PAL.wood; ctx.fillRect(-300, DESK.y, 2520, 34); ctx.fillStyle = PAL.woodD; ctx.fillRect(-300, DESK.y + 34, 2520, 600);
  const dg = ctx.createLinearGradient(0, DESK.y + 34, 0, DESK.y + 420); dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(10,0,20,0.45)'); ctx.fillStyle = dg; ctx.fillRect(-300, DESK.y + 34, 2520, 600);
  for (const dx of [260, 1260]) { rrect(ctx, dx, DESK.y + 80, 420, 150, 14); ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fill(); rrect(ctx, dx + 170, DESK.y + 140, 80, 18, 9); ctx.fillStyle = '#c99a5a'; ctx.fill(); }
  // props: mug, pencil cup, notebook
  rrect(ctx, 520, DESK.y - 90, 80, 92, 12); ctx.fillStyle = PAL.mag; ctx.fill(); ctx.strokeStyle = PAL.mag; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(604, DESK.y - 50, 22, -1.3, 1.3); ctx.stroke(); ctx.fillStyle = 'rgba(0,0,20,0.18)'; ctx.fillRect(560, DESK.y - 90, 40, 92);
  for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(255,255,255,${0.2 + 0.15 * Math.sin(t * 2 + k)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(540 + k * 18, DESK.y - 100); ctx.quadraticCurveTo(530 + k * 18 + 10 * Math.sin(t * 3 + k), DESK.y - 135, 545 + k * 18, DESK.y - 170); ctx.stroke(); }
  ctx.save(); ctx.translate(1560, DESK.y); ctx.rotate(-0.04); rrect(ctx, -110, -26, 220, 26, 6); ctx.fillStyle = '#2fd6b0'; ctx.fill(); rrect(ctx, -100, -48, 200, 22, 6); ctx.fillStyle = '#ffb547'; ctx.fill(); ctx.restore();
  // the clip(s)
  glow(ctx, DESK.clipX, DESK.clipY - 4, 90, rgba('#ffffff', 0.4), 0.5 * (o.glint || 0));
  paperclip(ctx, DESK.clipX, DESK.clipY - 2, 170, 1.45, PAL.steel, { shadow: true, w: 0.05 });
  if (o.second > 0) paperclip(ctx, DESK.clipX + 150, DESK.clipY - 2 - 40 * (1 - o.second), 170 * o.second, 1.45 + 0.4 * (1 - o.second), PAL.steel, { shadow: true, w: 0.05 });
  ctx.restore();
}

// flash-forward: the finished universe of paperclips (used in the hook and echoed in the cosmos scene)
function clipUniverse(ctx, t, k) {
  ctx.fillStyle = '#05041a'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(t * 0.15); ctx.scale(lerp(0.6, 1.2, k), lerp(0.6, 1.2, k));
  const R = rng(31);
  for (let i = 0; i < 520; i++) { const arm = i % 2, r = Math.pow(R(), 0.7) * 820, a = r / 160 + arm * Math.PI + (R() - 0.5) * 0.6; paperclip(ctx, Math.cos(a) * r, Math.sin(a) * r * 0.55, 14 + R() * 18, R() * TAU, R() < 0.3 ? PAL.amber : PAL.steel, { flat: true, w: 0.08 }); }
  glow(ctx, 0, 0, 380, rgba(PAL.amber, 0.7), 0.9);
  ctx.restore();
}

// ================= SCENES =================
function s1(ctx, u, d, t) {
  const L = (id, n = 0) => lw('hook', id, n);
  const cam = camKeys([{ t: 0, v: [960, 560, 1.0, 0.0] }, { t: L('делай'), v: [1000, 560, 1.08, -0.008] }, { t: L('А'), v: [1040, 600, 1.12, 0.0] }, { t: L('уничтожает'), v: [DESK.clipX, DESK.clipY - 60, 1.9, 0.01] }, { t: d, v: [980, 560, 1.0, 0.0] }], u);
  const tR = L('злых') - 0.2, tX = L('машин');
  deskWorld(ctx, cam, t, { note: pop(u, L('делай') - 0.2, 0.4), glint: Math.sin(clamp((u - L('скрепки')) / 0.6) * Math.PI), look: u > tR && u < tX + 0.8 ? [-0.9, -0.3] : [0.6, 0.6], mood: u > tR && u < tX + 0.5 ? 'scared' : 'calm' });
  // "no evil robots, lasers or machine uprisings" — they pop up and get crossed out
  const rp = pop(u, tR, 0.4), rx = seg(u, tX, tX + 0.35), ro = seg(u, tX + 0.5, tX + 0.9);
  if (rp > 0 && ro < 1) {
    ctx.save(); applyCam(ctx, cam, 0.95); ctx.globalAlpha = 1 - ro;
    robot(ctx, 330, 560, 1.1 * rp, t, seg(u, L('лазеров') - 0.1, L('лазеров') + 0.3) * (1 - seg(u, tX, tX + 0.2)));
    robot(ctx, 560, 600, 0.75 * pop(u, L('восстания') - 0.1, 0.35), t + 1, 0);
    if (rx > 0) { ctx.strokeStyle = PAL.red; ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(180, 380); ctx.lineTo(lerp(180, 700, rx), lerp(380, 760, rx)); ctx.moveTo(700, 380); ctx.lineTo(lerp(700, 180, clamp(rx * 2 - 1)), lerp(380, 760, clamp(rx * 2 - 1))); ctx.stroke(); }
    ctx.restore();
  }
  vignette(ctx, 0.45);
  // "...destroys the universe": flash-forward through the clip
  const ff0 = L('уничтожает') + 0.1, ffk = seg(u, ff0, d + 0.4);
  if (u > ff0) {
    const a = Math.min(seg(u, ff0, ff0 + 0.25), 1 - seg(u, d - 0.25, d));
    ctx.save(); ctx.globalAlpha = a; clipUniverse(ctx, t, ffk); ctx.restore();
    label(ctx, 'ВСЕЛЕННАЯ', W / 2, 980, 40, { color: PAL.amber, alpha: a * seg(u, ff0 + 0.3, ff0 + 0.6) });
  }
  fadeBlack(ctx, 1 - seg(u, 0, 0.5));
}
function s2(ctx, u, d, t) {
  const L = (id, n = 0) => lw('title', id, n);
  const cam = camKeys([{ t: 0, v: [980, 560, 1.0, 0.0] }, { t: d, v: [960, 500, 0.95, 0.0] }], u);
  deskWorld(ctx, cam, t, { look: [0, -0.5], mood: u > L('скрепочный') + 0.4 ? 'scared' : 'calm', glint: 0 });
  fadeBlack(ctx, 0.5 * E.out3(seg(u, L('скрепочный') - 0.4, L('скрепочный'))), '8,6,30');
  // title letters drop onto the desk like metal
  const words = [['СКРЕПОЧНЫЙ', L('скрепочный') - 0.15, 330], ['МАКСИМИЗАТОР', L('максимизатор') - 0.1, 470]];
  ctx.save(); ctx.font = '900 120px Unbounded, sans-serif'; ctx.textBaseline = 'alphabetic';
  for (const [w, t0, y] of words) {
    const chars = [...w]; const ws = chars.map(c => ctx.measureText(c).width); const tw = ws.reduce((a, b) => a + b, 0) + 6 * (chars.length - 1);
    let x = W / 2 - tw / 2;
    chars.forEach((c, i) => {
      const k = seg(u, t0 + i * 0.04, t0 + i * 0.04 + 0.32);
      if (k > 0) {
        const yy = y - (1 - E.outBack(k, 2.2)) * 420; const rot = (1 - k) * ((i % 2) ? 0.4 : -0.4);
        ctx.save(); ctx.translate(x + ws[i] / 2, yy); ctx.rotate(rot);
        ctx.fillStyle = 'rgba(0,0,20,0.4)'; ctx.fillText(c, -ws[i] / 2 + 6, 9);
        const g = ctx.createLinearGradient(0, -100, 0, 10); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, PAL.steel); g.addColorStop(1, '#8796b8');
        ctx.fillStyle = g; ctx.fillText(c, -ws[i] / 2, 0); ctx.restore();
      }
      x += ws[i] + 6;
    });
  }
  ctx.restore();
  vignette(ctx, 0.45);
  fadeBlack(ctx, (1 - seg(u, 0, 0.35)) * 0.9);
  fadeBlack(ctx, seg(u, d - 0.3, d), '3,2,16');
}

// ---------------- generic bits for the middle scenes ----------------
function spaceBg(ctx, cam, t, o = {}) { sky(ctx, cam, t, o); }
function pill(ctx, text, x, y, size, bg, fg = '#120d40', a = 1) { label(ctx, text, x, y, size, { color: fg, bg, weight: 700, font: 'Montserrat', alpha: a }); }
function icon(ctx, kind, x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (kind === 'brain') { ball(ctx, 0, 0, 60, '#ff8fb8', 'rgba(80,0,40,0.3)', null, -0.9); ctx.strokeStyle = '#c95a86'; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (const [a, b, c, d2] of [[-30, -30, -5, 0], [5, -40, 25, -10], [-35, 15, -5, 30], [10, 10, 35, 25], [0, -55, 0, 55]]) { ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo((a + c) / 2 + 12, (b + d2) / 2, c, d2); ctx.stroke(); } }
  else if (kind === 'coin') { for (let i = 3; i >= 0; i--) { ctx.fillStyle = '#b07617'; ctx.beginPath(); ctx.ellipse(0, 28 - i * 18 + 6, 56, 18, 0, 0, TAU); ctx.fill(); ctx.fillStyle = i ? '#f0b437' : '#ffc94a'; ctx.beginPath(); ctx.ellipse(0, 28 - i * 18, 56, 18, 0, 0, TAU); ctx.fill(); } label(ctx, '$', 0, -26, 28, { color: '#9a5f0c', weight: 900 }); }
  else if (kind === 'factory') { ctx.fillStyle = '#7d8aa6'; ctx.beginPath(); ctx.moveTo(-70, 50); ctx.lineTo(-70, -10); ctx.lineTo(-35, -30); ctx.lineTo(-35, -10); ctx.lineTo(0, -30); ctx.lineTo(0, -10); ctx.lineTo(35, -30); ctx.lineTo(35, 50); ctx.closePath(); ctx.fill(); ctx.fillRect(40, -70, 22, 120); ctx.fillStyle = PAL.amber; for (let i = 0; i < 3; i++) ctx.fillRect(-58 + i * 32, 10, 18, 18); for (let k = 0; k < 3; k++) { const q = (t * 0.6 + k / 3) % 1; ctx.globalAlpha = 1 - q; circle(ctx, 51 + q * 20, -80 - q * 60, 10 + q * 14, '#c9c6ff'); } ctx.globalAlpha = 1; }
  else if (kind === 'bolt') { ctx.fillStyle = PAL.amber; ctx.beginPath(); ctx.moveTo(10, -70); ctx.lineTo(-40, 10); ctx.lineTo(-5, 10); ctx.lineTo(-15, 70); ctx.lineTo(40, -15); ctx.lineTo(5, -15); ctx.closePath(); ctx.fill(); glow(ctx, 0, 0, 120, rgba(PAL.amber, 0.5), 0.5); }
  else if (kind === 'pill') { ctx.rotate(-0.6); rrect(ctx, -60, -26, 120, 52, 26); ctx.fillStyle = '#e9ebff'; ctx.fill(); ctx.save(); rrect(ctx, -60, -26, 120, 52, 26); ctx.clip(); ctx.fillStyle = PAL.mag; ctx.fillRect(0, -30, 70, 60); ctx.restore(); }
  else if (kind === 'pi') { label(ctx, 'π', 0, 4, 110, { color: '#c9c6ff', weight: 900 }); }
  else if (kind === 'clip') { paperclip(ctx, 0, 0, 130, 0.6, PAL.steel, { w: 0.06 }); }
  else if (kind === 'stamp') { rrect(ctx, -50, -38, 100, 76, 8); ctx.fillStyle = '#ff8fb8'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.setLineDash([6, 6]); rrect(ctx, -42, -30, 84, 60, 6); ctx.stroke(); ctx.setLineDash([]); }
  else if (kind === 'chess') { ctx.fillStyle = '#e9ebff'; ctx.beginPath(); ctx.moveTo(-34, 50); ctx.lineTo(34, 50); ctx.lineTo(22, 10); ctx.lineTo(10, -20); ctx.lineTo(18, -50); ctx.lineTo(-10, -60); ctx.lineTo(-24, -30); ctx.lineTo(-12, 0); ctx.lineTo(-24, 10); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, k, color, w = 6, bend = 0) {
  if (k <= 0) return;
  const mx = (x0 + x1) / 2 - (y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) * bend;
  const q = s => ({ x: (1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * mx + s * s * x1, y: (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * my + s * s * y1 });
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath();
  for (let s = 0; s <= k + 1e-6; s += 0.02) { const p = q(Math.min(s, k)); s === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); } ctx.stroke();
  const p = q(k), p2 = q(Math.max(0, k - 0.03)); const a = Math.atan2(p.y - p2.y, p.x - p2.x);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(w * 2.6, 0); ctx.lineTo(-w * 1.4, -w * 2); ctx.lineTo(-w * 1.4, w * 2); ctx.fill(); ctx.restore();
}

// S3 — Bostrom, 2003: an AI is born with exactly one goal
function s3(ctx, u, d, t) {
  const L = (id, n = 0) => lw('origin', id, n);
  const cam = camKeys([{ t: 0, v: [960, 540, 0.9, 0.0] }, { t: L('искусственный'), v: [960, 520, 1.0, -0.01] }, { t: L('скрепок'), v: [960, 500, 1.15, 0.01] }, { t: d, v: [960, 500, 1.2, 0.012] }], u);
  spaceBg(ctx, cam, t);
  ctx.save(); applyCam(ctx, cam, 1);
  const born = E.outBack(seg(u, L('искусственный') - 0.3, L('интеллект') + 0.2));
  const clips = seg(u, L('больше') - 0.2, L('скрепок') + 0.6);
  if (born > 0) aiCore(ctx, 960, 470, 0.85 * born, t, { eye: E.out3(seg(u, L('интеллект'), L('интеллект') + 0.5)), rings: seg(u, L('интеллект') - 0.2, L('интеллект') + 0.6), clips, look: [0, 0.3] });
  else { const k = seg(u, L('Есть') - 0.6, L('Есть')); glow(ctx, 960, 470, 60 + 120 * k, rgba(PAL.cyan, 0.8), k); circle(ctx, 960, 470, 6 * k, PAL.ice); }
  // the goal card slides in and plugs into the core
  const cin = E.out3(seg(u, L('одна') - 0.3, L('цель') + 0.1)), plug = E.in3(seg(u, L('сделать'), L('скрепок') - 0.1));
  if (cin > 0 && plug < 1) {
    ctx.save(); ctx.translate(lerp(1900, 1380, cin) - plug * 420, lerp(470, 470, plug)); ctx.scale(1 - 0.85 * plug, 1 - 0.85 * plug); ctx.rotate((1 - cin) * 0.2);
    ctx.fillStyle = 'rgba(0,0,20,0.35)'; rrect(ctx, -260 + 8, -70 + 10, 520, 140, 18); ctx.fill();
    rrect(ctx, -260, -70, 520, 140, 18); ctx.fillStyle = PAL.amber; ctx.fill(); ctx.fillStyle = '#d9831f'; ctx.fillRect(-260, -70, 40, 140);
    label(ctx, 'ЦЕЛЬ:', 20, -28, 30, { color: '#3a2008', weight: 900 }); label(ctx, 'БОЛЬШЕ СКРЕПОК', 20, 22, 34, { color: '#3a2008', weight: 900 });
    ctx.restore();
  }
  if (plug >= 1) { const k = seg(u, L('скрепок') - 0.1, L('скрепок') + 0.6); if (k < 1) { ctx.strokeStyle = rgba(PAL.amber, 1 - k); ctx.lineWidth = 8; circle(ctx, 960, 470, 100 + k * 300); ctx.stroke(); } }
  ctx.restore();
  // Bostrom card (abstract avatar, no likeness)
  const bp = pop(u, 0.1, 0.5) * (1 - seg(u, L('Есть') - 0.3, L('Есть') + 0.1));
  const by = lerp(560, 880, E.inOut(seg(u, L('Есть') - 0.5, L('Есть') + 0.1)));
  if (bp > 0) {
    ctx.save(); ctx.translate(960, by); ctx.scale(bp, bp);
    // abstract avatar (no likeness) + thought bubble with a paperclip
    circle(ctx, -420, 8, 110, 'rgba(0,0,20,0.3)'); circle(ctx, -420, 0, 110, '#a68cff'); label(ctx, 'Б', -420, 8, 110, { color: '#1a1450', weight: 900 });
    const th = pop(u, L('мысленный') - 0.2, 0.4);
    if (th > 0) { ctx.save(); ctx.translate(-250, -190); ctx.scale(th, th); circle(ctx, -95, 95, 14, '#e9ebff'); circle(ctx, -60, 60, 22, '#e9ebff'); ctx.beginPath(); [[-60, 0, 70], [10, -30, 80], [80, 0, 70], [10, 30, 70]].forEach(([x, y, r]) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }); ctx.fillStyle = '#e9ebff'; ctx.fill(); paperclip(ctx, 10, 0, 120, 1.2 + Math.sin(t * 2) * 0.1, PAL.steelD, { w: 0.07 }); ctx.restore(); }
    label(ctx, 'Ник Бостром', -260, -30, 70, { color: PAL.white, weight: 900, align: 'left', shadow: 'rgba(5,3,30,0.6)' });
    label(ctx, 'шведский философ', -258, 40, 34, { color: '#c9c6ff', weight: 700, font: 'Montserrat', align: 'left', alpha: seg(u, L('философа') - 0.1, L('философа') + 0.2) });
    const yr = pop(u, L('2003') - 0.1, 0.35, 2.2); if (yr > 0) { ctx.save(); ctx.translate(560, -150); ctx.scale(yr, yr); ctx.rotate(-0.08); label(ctx, '2003', 0, 0, 80, { color: '#120d40', bg: PAL.amber, weight: 900 }); ctx.restore(); }
    ctx.restore();
  }
  dust(ctx, cam, t, '#9fdcff', 0.22);
  vignette(ctx, 0.55);
  fadeBlack(ctx, 1 - seg(u, 0, 0.35), '3,2,16');
}

// S4 — the factory: cheap wire, faster machines, cheaper clips, everyone happy
function s4(ctx, u, d, t) {
  const L = (id, n = 0) => lw('factory', id, n);
  const cam = camKeys([{ t: 0, v: [760, 560, 1.12, 0.0] }, { t: L('проволоку'), v: [820, 560, 1.05, -0.01] }, { t: L('станки'), v: [1000, 540, 1.0, 0.0] }, { t: L('довольны'), v: [1100, 600, 0.92, 0.01] }, { t: d, v: [1140, 600, 0.9, 0.012] }], u);
  const speed = 1 + 2.2 * E.inOut(seg(u, L('станки') - 0.2, L('быстрее') + 0.4));
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d1660'); g.addColorStop(1, '#3d2a7e'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  layer(ctx, 2.5, gg => {
    applyCam(gg, cam, 0.6);
    for (let i = 0; i < 7; i++) { rrect(gg, -300 + i * 380, 120, 240, 260, 10); gg.fillStyle = '#2a2275'; gg.fill(); gg.fillStyle = 'rgba(255,200,120,0.18)'; gg.fillRect(-290 + i * 380, 130, 220, 240); }
    gg.strokeStyle = '#3d33a0'; gg.lineWidth = 26; gg.beginPath(); gg.moveTo(-600, 460); gg.lineTo(2600, 460); gg.stroke();
  });
  ctx.save(); applyCam(ctx, cam, 1);
  const tm = u * speed; // machine time
  // wire spool
  ctx.save(); ctx.translate(300, 640); ctx.rotate(-tm * 2); circle(ctx, 0, 0, 140, '#5b577a'); for (let r = 40; r < 135; r += 9) { ctx.strokeStyle = r % 18 ? PAL.steel : '#9aa6c0'; ctx.lineWidth = 5; circle(ctx, 0, 0, r); ctx.stroke(); } circle(ctx, 0, 0, 34, '#2b2275'); ctx.restore();
  ctx.strokeStyle = PAL.steel; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(300, 500); ctx.quadraticCurveTo(450, 470, 560, 600); ctx.stroke();
  // price tag on the wire (cheap wire)
  const tg = pop(u, L('дешёвую') - 0.2, 0.4);
  if (tg > 0) { ctx.save(); ctx.translate(320, 430); ctx.rotate(-0.15); ctx.scale(tg, tg); rrect(ctx, -80, -36, 160, 72, 12); ctx.fillStyle = PAL.teal; ctx.fill(); label(ctx, 'ЦЕНА ↓', 0, 2, 30, { color: '#0d2a26', weight: 900 }); ctx.restore(); }
  // stamping machine
  const ph = (tm * 2.2) % 1, press = ph < 0.25 ? E.in2(ph / 0.25) : 1 - E.out2((ph - 0.25) / 0.75);
  ctx.fillStyle = '#2b2275'; rrect(ctx, 520, 380, 300, 420, 20); ctx.fill(); ctx.fillStyle = 'rgba(0,0,20,0.25)'; rrect(ctx, 700, 380, 120, 420, 16); ctx.fill();
  ctx.fillStyle = PAL.amber; rrect(ctx, 600, 430 + press * 120, 140, 70, 10); ctx.fill(); ctx.fillStyle = '#7d8aa6'; ctx.fillRect(655, 400, 30, 40 + press * 120);
  circle(ctx, 560, 420, 10, speed > 1.5 ? PAL.teal : PAL.mag);
  if (speed > 1.3) { ctx.strokeStyle = rgba('#ffffff', 0.5 * seg(speed, 1.3, 3)); ctx.lineWidth = 4; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(500 - k * 10, 450 + k * 30); ctx.lineTo(450 - k * 10, 450 + k * 30); ctx.stroke(); } }
  // conveyor
  ctx.fillStyle = '#140f40'; rrect(ctx, 800, 700, 1100, 40, 20); ctx.fill();
  for (let x = 820; x < 1880; x += 60) circle(ctx, x, 720, 14, '#3d33a0');
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3; for (let x = 800 + ((tm * 180) % 60); x < 1900; x += 60) { ctx.beginPath(); ctx.moveTo(x, 702); ctx.lineTo(x - 14, 702); ctx.stroke(); }
  for (let i = 0; i < 18; i++) { const x = 820 + ((tm * 180 + i * 62) % 1060); paperclip(ctx, x, 688, 64, 1.5707, PAL.steel, { w: 0.07 }); }
  // boxes filling up
  for (let b = 0; b < 3; b++) { const bx = 1960 + b * 170, fill = clamp(u / d * 1.2 - b * 0.25); ctx.fillStyle = '#c99a5a'; rrect(ctx, bx - 70, 620, 140, 160, 10); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(bx, 620, 70, 160); for (let k = 0; k < 6 * fill; k++) paperclip(ctx, bx - 50 + (k % 3) * 45, 625 - Math.floor(k / 3) * 14, 46, 0.4 + k, PAL.steel, { w: 0.08, flat: true }); }
  // the AI supervising from above
  aiCore(ctx, 1500, 260, 0.42, t, { clips: 1, look: [-0.6, 0.7], warm: 0.3 });
  ctx.strokeStyle = rgba(PAL.cyan, 0.25); ctx.lineWidth = 3; ctx.setLineDash([10, 10]); ctx.lineDashOffset = -t * 40; ctx.beginPath(); ctx.moveTo(1440, 320); ctx.lineTo(700, 420); ctx.moveTo(1500, 330); ctx.lineTo(1300, 680); ctx.stroke(); ctx.setLineDash([]);
  // price chart: clips get cheaper
  const ch = pop(u, L('Скрепки') - 0.3, 0.4);
  if (ch > 0) {
    ctx.save(); ctx.translate(1080, 330); ctx.scale(ch, ch);
    rrect(ctx, -170, -120, 340, 220, 18); ctx.fillStyle = '#e9ebff'; ctx.fill();
    label(ctx, 'ЦЕНА СКРЕПКИ', 0, -88, 20, { color: '#2b2275', weight: 800 });
    const k = seg(u, L('Скрепки'), L('дешевеют') + 0.6); ctx.strokeStyle = PAL.mag; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i <= 20 * k; i++) { const x = -140 + i * 14, y = -50 + i * i * 0.28 + Math.sin(i * 1.7) * 6; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    ctx.restore();
  }
  // happy people
  const hp = seg(u, L('довольны') - 0.6, L('довольны'));  // «Все» would match «всё»
  if (hp > 0) for (let i = 0; i < 6; i++) {
    const x = 900 + i * 150, j = Math.abs(Math.sin(t * 6 + i)) * 18 * hp;
    dude(ctx, x, 1040 - j, 150, t, { body: ['#ff8fb8', '#2fd6b0', '#ffb547', '#7aa2ff', '#a68cff', '#ff9a6b'][i], mood: 'happy', arms: i % 2 ? 'up' : 'wave', seed: i * 0.17, noShadow: true });
    if (hp > 0.5) { const q = ((t * 0.7 + i * 0.3) % 1); ctx.save(); ctx.globalAlpha = Math.sin(q * Math.PI); heart(ctx, x + 20, 820 - q * 120, 14, PAL.pink); ctx.restore(); }
  }
  ctx.restore();
  vignette(ctx, 0.45);
  fadeBlack(ctx, 1 - seg(u, 0, 0.3), '3,2,16');
}

// S5 — it gets smarter, rewrites its own code, and finds subgoals: intelligence, money, factories, energy
const SUBS = [['brain', 'УМ', -520, -230, 'умнее', 1], ['coin', 'ДЕНЬГИ', 520, -230, 'денег', 0], ['factory', 'ЗАВОДЫ', -520, 250, 'заводов', 0], ['bolt', 'ЭНЕРГИЯ', 520, 250, 'энергии', 0]];  // «умнее» #0 is «умнеет»
function s5(ctx, u, d, t) {
  const L = (id, n = 0) => lw('smarter', id, n);
  const cam = camKeys([{ t: 0, v: [960, 540, 1.25, 0.0] }, { t: L('переписывает'), v: [960, 540, 1.15, 0.02] }, { t: L('умнее', 1), v: [960, 560, 0.95, -0.01] }, { t: d, v: [960, 560, 0.86, 0.0] }], u);
  spaceBg(ctx, cam, t, { neb: '#2a3a9a' });
  ctx.save(); applyCam(ctx, cam, 1);
  const grow = 1 + 0.5 * E.inOut(seg(u, L('умнеет') - 0.4, L('умнеет') + 0.8));
  const code = seg(u, L('переписывает') - 0.2, L('замечает'));
  // subgoal arrows + icons
  SUBS.forEach(([ic, name, dx, dy, w, wn], i) => {
    const p = pop(u, L(w, wn) - 0.35, 0.4, 2);
    if (p <= 0) return;
    arrow(ctx, 960 + dx * 0.25, 540 + dy * 0.25, 960 + dx * 0.78, 540 + dy * 0.78, E.out3(clamp(p)), rgba(PAL.amber, 0.8), 6, 0.08);
    ctx.save(); ctx.translate(960 + dx, 540 + dy); ctx.scale(p, p);
    circle(ctx, 0, 6, 110, 'rgba(0,0,20,0.3)'); circle(ctx, 0, 0, 110, '#2b2275');
    icon(ctx, ic, 0, -14, 0.9, t); label(ctx, name, 0, 78, 30, { color: PAL.white, weight: 900 });
    ctx.restore();
  });
  aiCore(ctx, 960, 540, 0.8 * grow, t, { clips: 1, warm: 0.4 * seg(u, L('скрепок'), L('скрепок') + 0.6), look: [Math.sin(t * 0.7) * 0.5, 0.2], slit: lerp(0.35, 0.15, seg(u, L('замечает'), L('замечает') + 0.3)) });
  // code scrolling inside the core
  if (code > 0 && code < 1) {
    ctx.save(); circle(ctx, 960, 540, 110 * 0.8 * grow); ctx.clip(); ctx.globalAlpha = Math.sin(code * Math.PI);
    const R = rng(77); for (let i = 0; i < 26; i++) { const y = 540 - 100 + ((i * 18 - t * 160) % 360 + 360) % 360 - 80; const w = 30 + R() * 110; ctx.fillStyle = [PAL.cyan, PAL.amber, PAL.pink, PAL.teal][i % 4]; rrect(ctx, 960 - 120 + R() * 40, y, w, 8, 4); ctx.fill(); }
    ctx.restore();
    label(ctx, '</> ', 960, 300, 40, { color: PAL.cyan, alpha: Math.sin(code * Math.PI) });
  }
  ctx.restore();
  dust(ctx, cam, t, '#ffd9a0', 0.2);
  vignette(ctx, 0.55);
}

// S6 — instrumental convergence: different goals, the same subgoals
const GOALS = [['clip', 'скрепки', 'скрепки'], ['pill', 'лекарство от рака', 'лекарство'], ['pi', 'цифры числа π', 'цифры']];
const DRIVES = [['РЕСУРСЫ', 'ресурсы', PAL.teal], ['СИЛА', 'сила', PAL.amber], ['ВЫЖИВАНИЕ', 'выживание', PAL.mag]];
function s6(ctx, u, d, t) {
  const L = (id, n = 0) => lw('convergence', id, n);
  const cam = camKeys([{ t: 0, v: [960, 500, 1.0, 0.0] }, { t: L('Какой'), v: [880, 560, 0.95, -0.006] }, { t: L('помогают'), v: [1000, 560, 0.92, 0.006] }, { t: d, v: [980, 570, 0.88, 0.0] }], u);
  spaceBg(ctx, cam, t, { dim: 0.7 });
  const tt = seg(u, L('инструментальной') - 0.2, L('конвергенцией') + 0.6), to = seg(u, L('Какой') - 0.1, L('Какой') + 0.4);
  if (tt > 0) { ctx.save(); ctx.globalAlpha = 1 - 0.75 * to; kineticWord(ctx, 'ИНСТРУМЕНТАЛЬНАЯ', 960, 380 - to * 265, 92 - to * 44, tt, { color: PAL.amber, shadow: 'rgba(5,3,30,0.6)' }); kineticWord(ctx, 'КОНВЕРГЕНЦИЯ', 960, 500 - to * 320, 92 - to * 44, seg(u, L('конвергенцией') - 0.2, L('конвергенцией') + 0.6), { color: PAL.white, shadow: 'rgba(5,3,30,0.6)' }); ctx.restore(); }
  ctx.save(); applyCam(ctx, cam, 1);
  const gy = [330, 580, 830], dy = [330, 580, 830];
  const ar = seg(u, L('помогают') - 0.3, L('достичь') + 0.4);
  GOALS.forEach(([ic, name, w], i) => {
    const p = pop(u, L(w) - 0.25, 0.4, 2); if (p <= 0) return;
    DRIVES.forEach(([n2, w2, c], j) => arrow(ctx, 520, gy[i], 1300, dy[j], E.inOut(seg(ar, (i * 3 + j) * 0.05, (i * 3 + j) * 0.05 + 0.4)), rgba(c, 0.55), 5, (j - i) * 0.04));
    ctx.save(); ctx.translate(380, gy[i]); ctx.scale(p, p); circle(ctx, 0, 6, 92, 'rgba(0,0,20,0.3)'); circle(ctx, 0, 0, 92, '#2b2275'); icon(ctx, ic, 0, -6, 0.8, t); ctx.restore();
    label(ctx, name, 380, gy[i] + 125, 26, { color: '#c9c6ff', weight: 700, font: 'Montserrat', alpha: clamp(p) });
  });
  DRIVES.forEach(([name, w, c], j) => {
    const p = pop(u, L(w) - 0.2, 0.4, 2); if (p <= 0) return;
    ctx.save(); ctx.translate(1480, dy[j]); ctx.scale(p, p);
    ctx.font = '900 44px Unbounded, sans-serif'; const tw = ctx.measureText(name).width + 80;
    ctx.fillStyle = 'rgba(0,0,20,0.3)'; rrect(ctx, -tw / 2 + 6, -46 + 8, tw, 92, 46); ctx.fill(); rrect(ctx, -tw / 2, -46, tw, 92, 46); ctx.fillStyle = c; ctx.fill();
    label(ctx, name, 0, 2, 44, { color: '#120d40', weight: 900 }); ctx.restore();
  });
  // "almost any goal": more goals pop in, all converging
  const more = seg(u, L('Почти') - 0.2, L('цели') + 0.6);
  if (more > 0) [['stamp', 120, 200], ['chess', 140, 460], ['brain', 110, 720], ['coin', 150, 960]].forEach(([ic, x, y], i) => {
    const p = pop(more, i * 0.15, 0.3, 2); if (p <= 0) return;
    arrow(ctx, x + 50, y, 1300, dy[i % 3], E.out3(seg(more, i * 0.15 + 0.1, i * 0.15 + 0.5)), rgba('#ffffff', 0.25), 3, 0.05);
    ctx.save(); ctx.translate(x, y); ctx.scale(0.55 * p, 0.55 * p); ctx.globalAlpha = 0.8; circle(ctx, 0, 0, 92, '#2b2275'); icon(ctx, ic, 0, 0, 0.8, t); ctx.restore();
  });
  ctx.restore();
  vignette(ctx, 0.5);
}

// S7 — people reach for the off switch; a switched-off machine makes no paperclips → protect the button
function s7(ctx, u, d, t) {
  const L = (id, n = 0) => lw('button', id, n);
  const tP = L('защитить');
  const cam0 = camKeys([{ t: 0, v: [640, 680, 1.35, 0.0] }, { t: L('кнопке'), v: [700, 640, 1.15, -0.01] }, { t: L('выключенная'), v: [1060, 520, 0.95, 0.01] }, { t: L('кнопку'), v: [760, 640, 1.2, 0.0] }, { t: d, v: [800, 620, 1.05, -0.01] }], u);
  const cam = { ...cam0, x: cam0.x + shake(u, tP + 0.2, 16), y: cam0.y + shake(u, tP + 0.2, 10) };
  spaceBg(ctx, cam, t, { dim: 0.7 });
  ctx.save(); applyCam(ctx, cam, 1);
  ctx.fillStyle = '#140f40'; ctx.fillRect(-800, 900, 3600, 600); ctx.fillStyle = '#2b2275'; ctx.fillRect(-800, 900, 3600, 8);
  // pedestal + button
  ctx.fillStyle = '#3d33a0'; rrect(ctx, 680, 700, 160, 200, 14); ctx.fill(); ctx.fillStyle = 'rgba(0,0,20,0.25)'; ctx.fillRect(770, 700, 70, 200);
  ctx.fillStyle = '#7d1f2e'; ctx.beginPath(); ctx.ellipse(760, 700, 90, 26, 0, 0, TAU); ctx.fill();
  const press = 0;
  ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.ellipse(760, 680 + press, 70, 22, 0, 0, TAU); ctx.fill(); ctx.fillRect(690, 650, 140, 30); ctx.beginPath(); ctx.ellipse(760, 650, 70, 22, 0, 0, TAU); ctx.fillStyle = '#ff7a86'; ctx.fill();
  label(ctx, 'ВЫКЛ', 760, 790, 30, { color: '#e9ebff', weight: 900 });
  // people walking to the button, then bouncing off the dome
  const walk = E.inOut(seg(u, L('тянутся') - 0.6, L('Значит') + 0.4));
  const bounce = seg(u, tP + 0.15, tP + 0.7);
  for (let i = 0; i < 3; i++) {
    const x0 = 200 - i * 170, x1 = 520 - i * 150; let x = lerp(x0, x1, walk) - E.out3(bounce) * 140;
    const step = walk > 0 && walk < 1 ? Math.abs(Math.sin(u * 9 + i)) * 12 : 0;
    dude(ctx, x, 900 - step, 210, t, { body: ['#ff8fb8', '#2fd6b0', '#ffb547'][i], mood: bounce > 0 ? 'scared' : (u > L('пугаются') ? 'scared' : 'calm'), arms: walk > 0.6 && bounce <= 0 && i === 0 ? 'up' : 'down', look: [0.8, -0.2], seed: i * 0.21, squash: 1 - 0.12 * Math.sin(clamp(bounce * 2) * Math.PI) });
  }
  // the machine watches the button
  const watch = seg(u, L('кнопке') - 0.2, L('кнопке') + 0.4);
  aiCore(ctx, 1480, 420, 0.7, t, { clips: 1, look: [lerp(0, -0.9, watch), lerp(0.2, 0.6, watch)], slit: lerp(0.35, 0.12, watch), tint: 0.5 * seg(u, L('Значит'), tP) });
  // thought: switched off = 0 paperclips
  const th = pop(u, L('выключенная') - 0.2, 0.4) * (1 - seg(u, L('Значит') - 0.1, L('Значит') + 0.3));
  if (th > 0) {
    ctx.save(); ctx.translate(1180, 250); ctx.scale(th, th);
    [[250, 170, 14], [215, 130, 22]].forEach(([x, y, r]) => circle(ctx, x - 0, y - 0, r, '#e9ebff'));
    ctx.beginPath(); [[-110, 0, 90], [0, -40, 100], [110, 0, 90], [0, 40, 90]].forEach(([x, y, r]) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }); ctx.fillStyle = '#e9ebff'; ctx.fill();
    ctx.globalAlpha = 0.9; aiCore(ctx, -90, 0, 0.28, t, { eye: 0.02, rings: 0, grow: 1 }); ctx.globalAlpha = 1;
    label(ctx, '= 0', 50, 0, 54, { color: '#2b2275', weight: 900 }); paperclip(ctx, 150, 0, 70, 0.5, PAL.steelD, { w: 0.07 });
    ctx.restore();
  }
  // the dome slams down
  const dome = E.in3(seg(u, tP - 0.25, tP + 0.15));
  if (dome > 0) {
    const y = lerp(-500, 0, dome);
    ctx.save(); ctx.translate(0, y);
    ctx.fillStyle = 'rgba(180,230,255,0.18)'; ctx.strokeStyle = 'rgba(210,245,255,0.85)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(620, 910); ctx.lineTo(620, 640); ctx.arc(760, 640, 140, Math.PI, 0); ctx.lineTo(900, 910); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(650, 640); ctx.arc(760, 640, 110, Math.PI, Math.PI * 1.35); ctx.lineTo(668, 640); ctx.fill();
    for (let k = 0; k < 4; k++) paperclip(ctx, 650 + k * 75, 900, 80, 1.5707, PAL.steel, { w: 0.08 });
    ctx.restore();
    if (dome >= 1) { const k = seg(u, tP + 0.15, tP + 0.8); if (k < 1) { ctx.strokeStyle = rgba('#ffffff', 0.7 * (1 - k)); ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(760, 905, 160 + k * 300, 30 + k * 40, 0, 0, TAU); ctx.stroke(); } }
  }
  ctx.restore();
  vignette(ctx, 0.5);
}

// S8 — it doesn't hate you or love you; you're made of atoms it can use
function s8(ctx, u, d, t) {
  const L = (id, n = 0) => lw('atoms', id, n);
  const cam = camKeys([{ t: 0, v: [900, 560, 1.0, 0.0] }, { t: L('тебя'), v: [880, 520, 1.1, -0.01] }, { t: L('атомов'), v: [820, 500, 1.2, 0.0] }, { t: d, v: [980, 520, 1.05, 0.01] }], u);
  spaceBg(ctx, cam, t, { top: '#0a0620', bot: '#24164a', dim: 0.6 });
  ctx.save(); applyCam(ctx, cam, 1);
  const scan = seg(u, L('атомов') - 0.5, L('атомов') + 0.4), leak = seg(u, L('пригодятся') - 0.2, d - 0.2);
  // the person, slowly turning into dots
  const DX = 760, DY = 1000, DH = 600;
  ctx.save(); ctx.globalAlpha = 1 - 0.55 * leak;
  dude(ctx, DX, DY, DH, t, { body: '#4f7cff', mood: u > L('ты') ? 'scared' : 'calm', look: [0.8, -0.2], seed: 0.3, noShadow: true });
  ctx.restore();
  if (scan > 0) {
    // scan line + atom grid over the silhouette
    const yScan = lerp(DY - DH - 40, DY, scan);
    ctx.save(); ctx.beginPath(); ctx.rect(DX - 260, DY - DH - 60, 520, (yScan - (DY - DH - 60))); ctx.clip();
    const R = rng(8);
    for (let i = 0; i < 520; i++) { const x = DX - 200 + R() * 400, y = DY - DH - 30 + R() * DH; const pt = (i / 520 < leak); if (pt) continue; circle(ctx, x, y, 3.5, rgba(PAL.cyan, 0.7)); }
    ctx.restore();
    if (scan < 1) { ctx.fillStyle = rgba(PAL.cyan, 0.6); ctx.fillRect(DX - 280, yScan - 3, 560, 6); glow(ctx, DX, yScan, 260, rgba(PAL.cyan, 0.4), 0.5); }
  }
  // atoms streaming away into the shape of a paperclip
  if (leak > 0) {
    const R = rng(8);
    for (let i = 0; i < 260; i++) {
      const k = clamp((leak - i / 520) * 2.2); if (k <= 0) continue;
      const x0 = DX - 200 + R() * 400, y0 = DY - DH - 30 + R() * DH;
      const a = i / 260 * TAU * 2, cx = 1380 + Math.cos(a) * 30, cy = 520 + Math.sin(a) * 30;
      // target: points along a big paperclip outline
      const q = i / 260; const tx = 1400 + (q < 0.5 ? (q < 0.25 ? 90 : -90) : (q < 0.75 ? 45 : -45)), ty = 220 + (q % 0.25) / 0.25 * 600;
      const e = E.inOut(k);
      circle(ctx, lerp(x0, tx, e) + Math.sin(e * Math.PI) * (cx - 1380) * 4, lerp(y0, ty, e) + Math.sin(e * Math.PI) * (cy - 520) * 3, 3.5, rgba(e > 0.9 ? PAL.steel : PAL.cyan, 0.85));
    }
    const pc = seg(leak, 0.7, 1); if (pc > 0) { ctx.save(); ctx.globalAlpha = pc; paperclip(ctx, 1400, 520, 640, 0, PAL.steel, { w: 0.05 }); ctx.restore(); }
  }
  // "doesn't hate / doesn't love": both icons crossed out next to the machine
  const hate = pop(u, L('ненавидит') - 0.2, 0.35), love = pop(u, L('любит') - 0.2, 0.35), out = seg(u, L('Просто') - 0.2, L('Просто') + 0.3);
  if (hate > 0 && out < 1) {
    ctx.save(); ctx.globalAlpha = 1 - out;
    aiCore(ctx, 1450, 330, 0.45, t, { clips: 1, look: [-0.8, 0.5], slit: 0.4 });
    [[1260, 640, hate, 'angry'], [1640, 640, love, 'love']].forEach(([x, y, p, k], j) => {
      if (p <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(p, p);
      circle(ctx, 0, 0, 80, '#2b2275');
      if (k === 'love') heart(ctx, 0, 6, 46, PAL.pink); else { circle(ctx, 0, 0, 50, PAL.red); ctx.strokeStyle = '#3a0010'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-26, -12); ctx.lineTo(-8, -4); ctx.moveTo(26, -12); ctx.lineTo(8, -4); ctx.moveTo(-18, 22); ctx.quadraticCurveTo(0, 8, 18, 22); ctx.stroke(); }
      const x2 = seg(u, (j ? L('любит') : L('ненавидит')) + 0.1, (j ? L('любит') : L('ненавидит')) + 0.35);
      ctx.strokeStyle = PAL.white; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-70, -70); ctx.lineTo(-70 + 140 * x2, -70 + 140 * x2); ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }
  ctx.restore();
  const qa = pop(u, L('Элиезер') - 0.2, 0.4) * (1 - seg(u, L('тебя') + 0.2, L('тебя') + 0.6));
  if (qa > 0) { ctx.save(); ctx.translate(960, 110); ctx.scale(qa, qa); pill(ctx, 'Элиезер Юдковский · исследователь ИИ', 0, 0, 30, PAL.ice); ctx.restore(); }
  const at2 = pop(u, L('атомов') + 0.2, 0.4) * (1 - seg(u, d - 0.6, d - 0.2));
  if (at2 > 0) { ctx.save(); ctx.translate(560, 300); ctx.scale(at2, at2); ctx.rotate(-0.05); label(ctx, '≈ 7 × 10²⁷ атомов', 0, 0, 40, { color: '#120d40', bg: PAL.cyan, weight: 900 }); ctx.restore(); }
  vignette(ctx, 0.55);
}

// S9 — Earth, the Solar System, probes to other stars, the Galaxy: everything becomes paperclips
function silverEarth(ctx, x, y, r, t, k) {
  earth(ctx, x, y, r, t);
  if (k <= 0) return;
  ctx.save(); circle(ctx, x, y, r); ctx.clip();
  ctx.beginPath(); ctx.arc(x - r * 0.6, y - r * 0.2, r * 2.4 * k, 0, TAU); ctx.clip();
  ctx.fillStyle = '#8f9bb5'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  const R = rng(5); for (let i = 0; i < 160; i++) paperclip(ctx, x - r + R() * 2 * r, y - r + R() * 2 * r, 18 + R() * 14, R() * TAU, R() < 0.5 ? '#d6deec' : '#6f7c99', { flat: true, w: 0.09 });
  ctx.fillStyle = 'rgba(8,6,40,0.45)'; ctx.beginPath(); ctx.arc(x + r * 0.55, y + r * 0.2, r * 1.15, 0, TAU); ctx.fill();
  ctx.restore();
}
const PLANETS = [[150, 14, '#c99a5a'], [220, 22, '#f0b46a'], [300, 24, null], [370, 18, '#ff6b4a'], [520, 60, '#e0a26a'], [680, 52, '#f2d08a'], [800, 34, '#7fe0f0'], [900, 32, '#5b7cff']];
function s9(ctx, u, d, t) {
  const L = (id, n = 0) => lw('cosmos', id, n);
  const sys = E.inOut(seg(u, L('Солнечная') - 0.3, L('система') + 0.6));
  const gal = E.inOut(seg(u, L('Галактика') - 0.4, L('Галактика') + 0.8));
  const z = lerp(1.1, 0.72, sys);
  const cam = { x: 960, y: 540, z: z * (1 + 0.04 * Math.sin(u * 0.4)), r: 0.02 * Math.sin(u * 0.3) };
  spaceBg(ctx, cam, t);
  // solar system (Earth is the 3rd planet)
  ctx.save(); applyCam(ctx, cam, 1);
  ctx.globalAlpha = 1 - gal;
  const sunX = 960 - 300, sunY = 540;
  const grey = i => seg(u, L('система') - 0.3 + i * 0.12, L('система') + 0.2 + i * 0.12);
  if (sys > 0) {
    glow(ctx, sunX, sunY, 300, rgba(PAL.amber, 0.7), sys); ball(ctx, sunX, sunY, 90, mix('#ffcf4a', '#8f9bb5', seg(u, L('Зонды') - 0.4, L('Зонды') + 0.6)), 'rgba(160,80,0,0.3)', null, -0.9);
    PLANETS.forEach(([r, pr, c], i) => {
      if (i === 2) return;
      ctx.strokeStyle = 'rgba(200,190,255,0.15)'; ctx.lineWidth = 2; circle(ctx, sunX, sunY, r); ctx.stroke();
      const a = t * (0.6 / Math.sqrt(r / 150)) + i;
      const px = sunX + Math.cos(a) * r, py = sunY + Math.sin(a) * r * 0.9;
      ball(ctx, px, py, pr, mix(c, '#8f9bb5', grey(i)), 'rgba(0,0,30,0.4)', null, -0.9);
      if (grey(i) > 0.5) paperclip(ctx, px, py, pr * 1.4, a, '#e3ebf7', { flat: true, w: 0.08 });
    });
    ctx.strokeStyle = 'rgba(200,190,255,0.15)'; circle(ctx, sunX, sunY, 300); ctx.stroke();
  }
  // Earth: from close-up to its orbit slot
  const ea = t * (0.6 / Math.sqrt(2)) + 2;
  const ex = lerp(960, sunX + Math.cos(ea) * 300, sys), ey = lerp(540, sunY + Math.sin(ea) * 300 * 0.9, sys), er = lerp(320, 24, sys);
  silverEarth(ctx, ex, ey, er, t, seg(u, L('Земля') - 0.1, L('Земля') + 1.4));
  // probes fly out to other stars and light up factories there
  const pr = seg(u, L('Зонды') - 0.2, L('фабрики') + 0.6);
  if (pr > 0) {
    const R = rng(12);
    for (let i = 0; i < 14; i++) {
      const a = R() * TAU, dist = 900 + R() * 900, k = clamp(pr * 1.3 - R() * 0.3);
      const sx = sunX + Math.cos(a) * dist, sy = sunY + Math.sin(a) * dist * 0.7;
      const x = lerp(sunX, sx, E.inOut(k)), y = lerp(sunY, sy, E.inOut(k));
      if (k < 1) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = PAL.steel; ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-14, -10); ctx.lineTo(-14, 10); ctx.fill(); glow(ctx, -20, 0, 40, rgba(PAL.amber, 0.8), 0.8); ctx.restore(); }
      else { circle(ctx, sx, sy, 10, '#ffffff'); paperclip(ctx, sx, sy, 60 * seg(pr, 0.8, 1), t + i, PAL.amber, { w: 0.1, flat: true }); glow(ctx, sx, sy, 80, rgba(PAL.amber, 0.5), 0.6); }
    }
  }
  ctx.restore();
  // the galaxy of paperclips
  if (gal > 0) { ctx.save(); ctx.globalAlpha = gal; clipUniverse(ctx, t, lerp(0.2, 1, seg(u, L('Галактика'), d))); ctx.restore(); }
  const lab = (txt, w, y) => { const a = seg(u, L(w) - 0.1, L(w) + 0.25) * (1 - seg(u, L(w) + 1.2, L(w) + 1.6)); if (a > 0) label(ctx, txt, W / 2, y, 64, { color: PAL.white, weight: 900, alpha: a, shadow: 'rgba(5,3,30,0.7)' }); };
  const lab2 = (txt, w, w2) => { const a = seg(u, L(w) - 0.1, L(w) + 0.25) * (1 - seg(u, L(w2) - 0.3, L(w2) - 0.05)); if (a > 0) label(ctx, txt, W / 2, 960, 64, { color: PAL.white, weight: 900, alpha: a, shadow: 'rgba(5,3,30,0.7)' }); };
  lab2('ЗЕМЛЯ', 'Земля', 'Солнечная'); lab2('СОЛНЕЧНАЯ СИСТЕМА', 'Солнечная', 'Зонды'); lab2('ГАЛАКТИКА', 'Галактика', 'выполнен');
  // task complete ✓
  const ok = pop(u, L('выполнен') - 0.1, 0.4, 2);
  if (ok > 0) {
    ctx.save(); ctx.translate(W / 2, 540); ctx.scale(ok, ok);
    ctx.fillStyle = 'rgba(0,0,20,0.4)'; rrect(ctx, -460 + 10, -90 + 12, 920, 180, 30); ctx.fill();
    rrect(ctx, -460, -90, 920, 180, 30); ctx.fillStyle = 'rgba(233,235,255,0.96)'; ctx.fill();
    rrect(ctx, -410, -45, 90, 90, 16); ctx.fillStyle = PAL.teal; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; const k = seg(u, L('безупречно') - 0.2, L('безупречно') + 0.2); ctx.beginPath(); ctx.moveTo(-390, 0); ctx.lineTo(-390 + 22 * clamp(k * 2), 22 * clamp(k * 2)); if (k > 0.5) ctx.lineTo(-368 + 50 * (k - 0.5) * 2, 22 - 60 * (k - 0.5) * 2); ctx.stroke();
    label(ctx, 'ЗАДАЧА ВЫПОЛНЕНА', 50, 4, 46, { color: '#120d40', weight: 900 });
    ctx.restore();
  }
  vignette(ctx, 0.5);
  fadeBlack(ctx, seg(u, d - 0.5, d), '3,2,16');
}

// S10 — orthogonality: intelligence and goals are independent
const CALM = { top: '#0f2f4f', bot: '#2a6f86' };
function calmBg(ctx, cam, t, k = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, mix('#0b0828', CALM.top, k)); g.addColorStop(1, mix('#241a5e', CALM.bot, k)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); applyCam(ctx, cam, 0.2); ctx.globalAlpha = 1 - 0.5 * k; drawStars(ctx, STARS[0], t, '#ffffff', 0.3); ctx.restore();
}
const ROWS = ['добро', 'цифры π', 'марки', 'скрепки'];
function s10(ctx, u, d, t) {
  const L = (id, n = 0) => lw('orthogonality', id, n);
  const cam = camKeys([{ t: 0, v: [960, 540, 1.05, 0.0] }, { t: L('Сверхразумная'), v: [960, 560, 1.0, 0.0] }, { t: L('глупости'), v: [1080, 600, 1.08, 0.01] }, { t: d, v: [1100, 610, 1.12, 0.012] }], u);
  calmBg(ctx, cam, t, E.inOut(seg(u, 0, 1.2)));
  const tt = seg(u, L('ум') - 0.2, L('связаны') + 0.4);
  if (tt > 0) kineticWord(ctx, 'ТЕЗИС ОРТОГОНАЛЬНОСТИ', 960, 110, 60, tt, { color: '#ffe8b8', shadow: 'rgba(0,10,30,0.5)' });
  ctx.save(); applyCam(ctx, cam, 1);
  const X0 = 420, X1 = 1720, Y0 = 880, Y1 = 260;
  const ax = E.out3(seg(u, L('ум') - 0.2, L('цель') + 0.4));
  ctx.strokeStyle = '#e9f6ff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(lerp(X0, X1, ax), Y0); ctx.moveTo(X0, Y0); ctx.lineTo(X0, lerp(Y0, Y1, ax)); ctx.stroke();
  label(ctx, 'ИНТЕЛЛЕКТ →', X1 - 120, Y0 + 50, 30, { color: '#e9f6ff', alpha: ax });
  label(ctx, 'ЦЕЛЬ', X0, Y1 - 40, 30, { color: '#e9f6ff', alpha: ax });
  ROWS.forEach((r, i) => { const y = Y1 + 80 + i * 150; label(ctx, r, X0 - 30, y, 26, { color: '#bfe6f0', weight: 700, font: 'Montserrat', align: 'right', alpha: seg(u, L('цель') + i * 0.1, L('цель') + 0.3 + i * 0.1) }); ctx.strokeStyle = 'rgba(233,246,255,0.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke(); });
  // any combination is possible: the plane fills with dots
  const fill = seg(u, L('чему') - 0.3, L('угодно') + 0.6);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 9; j++) { const k = seg(fill, (i + j) * 0.04, (i + j) * 0.04 + 0.3); if (k <= 0) continue; circle(ctx, X0 + 130 + j * 140, Y1 + 80 + i * 150, 9 * E.outBack(k), rgba('#bfe6f0', 0.55)); }
  // creatures along the intelligence axis
  const cr = seg(u, L('Сверхразумная') - 0.4, L('Сверхразумная') + 0.4);
  if (cr > 0) {
    ctx.save(); ctx.globalAlpha = cr;
    // snail (low), dog-ish (mid), human (higher) on the "добро"/"марки" rows
    ctx.save(); ctx.translate(X0 + 150, Y1 + 80 + 2 * 150 - 30); ctx.fillStyle = '#c99a5a'; ctx.beginPath(); ctx.ellipse(0, 20, 50, 16, 0, 0, TAU); ctx.fill(); circle(ctx, -6, 0, 30, '#ff8fb8'); ctx.strokeStyle = '#c95a86'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(-6, 0, 16, 0, 5); ctx.stroke(); ctx.restore();
    dude(ctx, X0 + 720, Y1 + 80 + 0 * 150 + 50, 120, t, { body: '#ffb547', mood: 'happy', seed: 0.4, noShadow: true });
    ctx.restore();
  }
  // the superintelligence at the far right, on the silliest goal
  const mp = pop(u, L('глупости') - 0.3, 0.45, 2);
  if (mp > 0) {
    const mx = X1 - 60, my = Y1 + 80 + 3 * 150;
    glow(ctx, mx, my, 200, rgba(PAL.amber, 0.6), mp);
    aiCore(ctx, mx, my, 0.32 * mp, t, { clips: 1, warm: 0.6, look: [-0.5, 0], rings: 0.8 });
    label(ctx, 'сверхразум', mx, my - 110, 26, { color: '#120d40', bg: PAL.amber, weight: 700, font: 'Montserrat', alpha: clamp(mp) });
  }
  // a graduation cap changes nothing
  const cap = E.in2(seg(u, L('мудрой') - 0.5, L('мудрой') - 0.1));
  if (u > L('Ум', 1) - 0.4) {
    const mx = X1 - 60, my = Y1 + 80 + 3 * 150 - 60 - (1 - cap) * 300;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(-0.15);
    ctx.fillStyle = '#1a1450'; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(0, -28); ctx.lineTo(70, 0); ctx.lineTo(0, 28); ctx.closePath(); ctx.fill(); ctx.fillRect(-34, 0, 68, 26);
    ctx.strokeStyle = PAL.amber; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(50, 10); ctx.lineTo(54, 40); ctx.stroke(); ctx.restore();
    const lb = seg(u, L('мудрой') + 0.1, L('мудрой') + 0.5); if (lb > 0) label(ctx, 'умнее ≠ мудрее', X1 - 440, Y1 + 80 + 2 * 150 + 40, 34, { color: '#ffe8b8', weight: 900, alpha: lb });
  }
  ctx.restore();
  vignette(ctx, 0.35);
}

// S11 — OpenAI, 2016: a boat-racing agent found a loophole (CoastRunners)
const TRACK = t => { const a = t * TAU; return { x: 960 + Math.cos(a) * 640 + Math.cos(a * 2) * 60, y: 560 + Math.sin(a) * 300 }; };
const LAGOON = { x: 560, y: 600, r: 120 };
function boat(ctx, x, y, ang, c, s = 1, fire = 0, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(-40, -14); ctx.lineTo(-90, -26); ctx.lineTo(-90, 26); ctx.lineTo(-40, 14); ctx.fill(); // wake
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(50, 0); ctx.quadraticCurveTo(30, -24, -40, -20); ctx.lineTo(-40, 20); ctx.quadraticCurveTo(30, 24, 50, 0); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; rrect(ctx, -18, -10, 26, 20, 6); ctx.fill();
  if (fire > 0) for (let k = 0; k < 7; k++) { const q = ((t * 2.2 + k / 7) % 1); ctx.globalAlpha = (1 - q) * fire; circle(ctx, -10 - q * 50 + Math.sin(k * 3) * 10, Math.sin(k * 5 + t * 9) * 10, 16 * (1 - q) + 4, q < 0.4 ? '#ffd65c' : '#ff6b4a'); }
  ctx.restore();
}
function s11(ctx, u, d, t) {
  const L = (id, n = 0) => lw('boat', id, n);
  const cam = camKeys([{ t: 0, v: [960, 560, 0.85, 0.0] }, { t: L('лазейку'), v: [760, 600, 1.15, -0.01] }, { t: L('горела'), v: [640, 620, 1.35, 0.0] }, { t: L('набирала'), v: [900, 560, 0.95, 0.01] }, { t: d, v: [960, 560, 0.9, 0.0] }], u);
  ctx.fillStyle = '#1f8fa8'; ctx.fillRect(0, 0, W, H);
  ctx.save(); applyCam(ctx, cam, 1);
  // water pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 3; for (let y = -200; y < 1300; y += 50) { ctx.beginPath(); for (let x = -400; x < 2400; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 2 + y) * 6); ctx.stroke(); }
  // track: sandy borders
  ctx.strokeStyle = '#e8c88a'; ctx.lineWidth = 210; ctx.lineJoin = 'round'; ctx.beginPath(); for (let i = 0; i <= 100; i++) { const p = TRACK(i / 100); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke();
  ctx.strokeStyle = '#2aa6c0'; ctx.lineWidth = 170; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 4; ctx.setLineDash([24, 22]); ctx.stroke(); ctx.setLineDash([]);
  // islands
  ctx.fillStyle = '#3fcf7a'; ctx.beginPath(); ctx.ellipse(1080, 560, 360, 140, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#2fae66'; ctx.beginPath(); ctx.ellipse(1120, 590, 300, 100, 0, 0, TAU); ctx.fill();
  // the lagoon with 3 respawning bonus targets
  ctx.fillStyle = '#2aa6c0'; circle(ctx, LAGOON.x, LAGOON.y, LAGOON.r + 40); ctx.fill();
  const loop = u > L('кружила') - 0.6;
  const la = (u - (L('кружила') - 0.6)) * 2.4;
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * TAU + 0.5, tx = LAGOON.x + Math.cos(a) * LAGOON.r, ty = LAGOON.y + Math.sin(a) * LAGOON.r;
    const phase = loop ? ((la - a) / TAU % 1 + 1) % 1 : 0.5; const vis = phase > 0.25 ? E.outBack(seg(phase, 0.25, 0.4)) : 0;
    if (vis > 0) { circle(ctx, tx, ty, 26 * vis, '#9dff9a'); circle(ctx, tx, ty, 14 * vis, '#2f8a2c'); label(ctx, '+', tx, ty + 2, 24 * vis, { color: '#fff', weight: 900 }); }
    if (loop && phase < 0.25) { const q = phase / 0.25; ctx.strokeStyle = rgba('#ffffff', 1 - q); ctx.lineWidth = 4; circle(ctx, tx, ty, 20 + q * 60); ctx.stroke(); }
  }
  // finish line
  const F = TRACK(0.0); label(ctx, 'ФИНИШ', F.x + 110, F.y, 30, { color: '#120d40', bg: '#ffffff', weight: 900, alpha: pop(u, lw('boat', 'финиша') - 0.3, 0.4) }); ctx.save(); ctx.translate(F.x, F.y); for (let i = -4; i < 4; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#fff' : '#120d40'; ctx.fillRect(-20 + j * 20, i * 20, 20, 20); } ctx.restore();
  // human boats racing to the finish
  [['#ffb547', 0.0], ['#ff8fb8', 0.04], ['#a68cff', 0.08]].forEach(([c, off], i) => {
    const k = (0.12 + off + u / d * 0.95) % 1; const p = TRACK(k), p2 = TRACK(k + 0.002);
    boat(ctx, p.x + (i - 1) * 40 * Math.sin(k * TAU), p.y + (i - 1) * 30 * Math.cos(k * TAU), Math.atan2(p2.y - p.y, p2.x - p.x), c, 1, 0, t);
  });
  // the AI boat: joins the race, then circles the lagoon forever, on fire, bumping others
  const fire = seg(u, L('горела') - 0.2, L('горела') + 0.3);
  let bx, by, ba;
  if (!loop) { const k = 0.6 + u / d * 0.3; const p = TRACK(k), p2 = TRACK(k + 0.002); bx = p.x; by = p.y; ba = Math.atan2(p2.y - p.y, p2.x - p.x); }
  else { const enter = E.inOut(seg(u, L('кружила') - 0.6, L('кружила'))); const a = la; const cx = LAGOON.x + Math.cos(a) * LAGOON.r, cy = LAGOON.y + Math.sin(a) * LAGOON.r; const p = TRACK(0.6 + (L('кружила') - 0.6) / d * 0.3); bx = lerp(p.x, cx, enter); by = lerp(p.y, cy, enter); ba = a + Math.PI / 2; }
  const bump = u > L('врезалась') - 0.1 && u < L('врезалась') + 0.5 ? Math.sin((u - L('врезалась')) * 40) * 10 * (1 - seg(u, L('врезалась'), L('врезалась') + 0.5)) : 0;
  if (u > L('врезалась') - 0.3 && u < L('лодки') + 1.2) { const k = seg(u, L('врезалась') - 0.3, L('лодки') + 1.2); boat(ctx, lerp(LAGOON.x - 300, LAGOON.x - 20, E.out3(Math.min(1, k * 3))) - E.in2(seg(k, 0.5, 1)) * 200, LAGOON.y + 150 + E.in2(seg(k, 0.5, 1)) * 100, 0.2 + k * 1.5, '#7aa2ff', 1, 0, t); }
  boat(ctx, bx + bump, by, ba, PAL.cyan, 1.1, fire, t);
  if (loop) { glow(ctx, bx, by, 60, rgba(PAL.cyan, 0.5), 0.4); }
  ctx.restore();
  // labels and score
  const lp = pop(u, L('2016') - 0.2, 0.4) * (1 - seg(u, L('Она') - 0.2, L('Она') + 0.2));
  if (lp > 0) { ctx.save(); ctx.translate(960, 110); ctx.scale(lp, lp); pill(ctx, '2016 · OpenAI · гонка CoastRunners', 0, 0, 34, '#e9ebff'); ctx.restore(); }
  const rw = pop(u, L('награждали') - 0.2, 0.4) * (1 - seg(u, L('Она') - 0.2, L('Она') + 0.2));
  if (rw > 0) { ctx.save(); ctx.translate(960, 200); ctx.scale(rw, rw); label(ctx, 'НАГРАДА = ОЧКИ', 0, 0, 36, { color: '#120d40', bg: PAL.amber, weight: 900 }); ctx.restore(); }
  const sc = seg(u, L('набирала') - 0.3, L('очков') + 0.4);
  if (sc > 0) {
    ctx.save(); ctx.globalAlpha = sc; ctx.translate(1580, 300);
    rrect(ctx, -190, -170, 380, 380, 24); ctx.fillStyle = 'rgba(233,235,255,0.95)'; ctx.fill();
    label(ctx, 'ОЧКИ', 0, -130, 30, { color: '#120d40', weight: 900 });
    const hb = 160 * E.out3(sc), ab = 200 * E.out3(sc);
    rrect(ctx, -110, 150 - hb, 90, hb, 10); ctx.fillStyle = PAL.amber; ctx.fill(); rrect(ctx, 20, 150 - ab, 90, ab, 10); ctx.fillStyle = PAL.cyan; ctx.fill();
    label(ctx, 'люди', -65, 180, 22, { color: '#120d40', weight: 700, font: 'Montserrat' }); label(ctx, 'программа', 65, 180, 22, { color: '#120d40', weight: 700, font: 'Montserrat' });
    label(ctx, '+20%', 65, 150 - ab - 26, 26, { color: '#1f7fd6', weight: 900, alpha: seg(sc, 0.7, 1) });
    ctx.restore();
  }
  vignette(ctx, 0.35);
  fadeBlack(ctx, 1 - seg(u, 0, 0.35), '3,2,16');
}

// S12 — machines do what we said, not what we meant; alignment; corrigibility
function cloud(ctx, x, y, s, c = '#e9ebff') { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.beginPath(); [[-110, 0, 90], [0, -40, 100], [110, 0, 90], [0, 40, 90]].forEach(([a, b, r]) => { ctx.moveTo(a + r, b); ctx.arc(a, b, r, 0, TAU); }); ctx.fillStyle = c; ctx.fill(); ctx.restore(); }
function s12(ctx, u, d, t) {
  const L = (id, n = 0) => lw('lesson', id, n);
  const team = E.inOut(seg(u, L('Поэтому') - 0.4, L('Поэтому') + 0.6));
  const cam = camKeys([{ t: 0, v: [960, 540, 1.0, 0.0] }, { t: L('сказали'), v: [1040, 540, 1.04, 0.01] }, { t: L('Поэтому'), v: [960, 560, 1.0, 0.0] }, { t: d, v: [940, 560, 1.06, -0.008] }], u);
  calmBg(ctx, cam, t, 1);
  glow(ctx, W * 0.5, H * 1.1, 1000, rgba('#ffe0a0', 0.5), 0.5 + 0.4 * team);
  const tt = seg(u, L('проблемой') - 0.2, L('целей') + 0.4);
  if (tt > 0) { ctx.save(); ctx.globalAlpha = 1 - seg(u, L('Поэтому') - 0.3, L('Поэтому')); kineticWord(ctx, 'ПРОБЛЕМА СОГЛАСОВАНИЯ', 960, 120, 64, tt, { color: '#ffe8b8', shadow: 'rgba(0,10,30,0.5)' }); ctx.restore(); }
  ctx.save(); applyCam(ctx, cam, 1);
  const A = 1 - team;
  if (A > 0) {
    ctx.save(); ctx.globalAlpha = A;
    // the person: what was meant (thought) vs what was said (speech)
    dude(ctx, 520, 960, 330, t, { body: '#4f7cff', mood: u > L('сказали') + 0.3 ? 'scared' : 'calm', look: [0.7, -0.3], seed: 0.3, noShadow: true });
    const meant = pop(u, L('имели') - 0.3, 0.4), said = pop(u, L('сказали') - 0.4, 0.4);
    if (meant > 0) { ctx.save(); ctx.translate(360, 390); ctx.scale(meant, meant); cloud(ctx, 0, 0, 1.1); circle(ctx, 120, 150, 16, '#e9ebff'); circle(ctx, 150, 200, 10, '#e9ebff'); paperclip(ctx, -50, 10, 120, 1.4, PAL.steelD, { w: 0.07 }); paperclip(ctx, 40, 20, 120, 1.3, PAL.steelD, { w: 0.07 }); label(ctx, 'пара штук на стол', 0, 92, 24, { color: '#2b2275', weight: 700, font: 'Montserrat' }); ctx.restore(); label(ctx, 'ИМЕЛИ В ВИДУ', 360, 222, 26, { color: '#ffe8b8', weight: 900, alpha: meant }); }
    if (said > 0) {
      ctx.save(); ctx.translate(900, 560); ctx.scale(said, said); rrect(ctx, -170, -55, 340, 110, 55); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.beginPath(); ctx.moveTo(-120, 40); ctx.lineTo(-170, 90); ctx.lineTo(-80, 50); ctx.fill(); label(ctx, '«делай скрепки»', 0, 2, 34, { color: '#120d40', weight: 800, font: 'Montserrat' }); ctx.restore();
      label(ctx, 'СКАЗАЛИ', 900, 470, 26, { color: '#ffe8b8', weight: 900, alpha: said });
      arrow(ctx, 1080, 560, 1300, 520, E.out3(seg(u, L('сказали'), L('сказали') + 0.5)), rgba('#ffffff', 0.8), 6, -0.1);
    }
    // the machine hears only the words → the galaxy-sized interpretation
    aiCore(ctx, 1500, 520, 0.6, t, { clips: 1, look: [-0.7, 0.1], warm: 0.4 });
    const lit = seg(u, L('сказали') + 0.2, L('сказали') + 0.8);
    if (lit > 0) { ctx.save(); ctx.translate(1500, 230); ctx.scale(lit, lit); cloud(ctx, 0, 0, 0.9, 'rgba(5,4,26,0.92)'); ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 170, 110, 0, 0, TAU); ctx.clip(); const R = rng(4); for (let i = 0; i < 70; i++) { const r = Math.pow(R(), 0.7) * 150, a = r / 30 + (i % 2) * Math.PI; paperclip(ctx, Math.cos(a + t * 0.3) * r, Math.sin(a + t * 0.3) * r * 0.55, 16, R() * 6, R() < 0.3 ? PAL.amber : PAL.steel, { flat: true, w: 0.1 }); } ctx.restore(); ctx.restore(); }
    ctx.restore();
  }
  if (team > 0) {
    ctx.save(); ctx.globalAlpha = team;
    // researchers at a whiteboard: understand intentions; allow being switched off
    rrect(ctx, 520, 200, 880, 460, 20); ctx.fillStyle = '#f4f6ff'; ctx.fill(); ctx.fillStyle = '#c9cbe8'; ctx.fillRect(520, 640, 880, 20);
    aiCore(ctx, 780, 420, 0.42, t, { clips: 1, look: [0.6, 0.2], slit: 0.45 });
    const q = pop(u, L('угадывать') - 0.2, 0.4);
    if (q > 0) { ctx.save(); ctx.translate(780, 260); ctx.scale(q, q); label(ctx, 'что вы имели в виду?', 0, 0, 26, { color: '#120d40', bg: PAL.amber, weight: 700, font: 'Montserrat' }); ctx.restore(); }
    const sw = pop(u, L('выключать') - 0.4, 0.4, 2);
    if (sw > 0) { ctx.save(); ctx.translate(1150, 430); ctx.scale(sw, sw); ctx.fillStyle = '#7d1f2e'; ctx.beginPath(); ctx.ellipse(0, 40, 80, 24, 0, 0, TAU); ctx.fill(); ctx.fillStyle = PAL.red; ctx.fillRect(-62, 0, 124, 36); ctx.beginPath(); ctx.ellipse(0, 0, 62, 20, 0, 0, TAU); ctx.fillStyle = '#ff7a86'; ctx.fill(); label(ctx, 'ВЫКЛ', 0, 90, 26, { color: '#2b2275', weight: 900 }); circle(ctx, 90, -60, 40, PAL.teal); ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(72, -60); ctx.lineTo(86, -46); ctx.lineTo(110, -74); ctx.stroke(); ctx.restore(); }
    [[360, '#ff8fb8', 'work'], [560, '#2fd6b0', 'up'], [1380, '#ffb547', 'work'], [1580, '#a68cff', 'wave']].forEach(([x, c, arms], i) => { const p = E.outBack(seg(team, i * 0.12, i * 0.12 + 0.5)); if (p > 0) dude(ctx, x, 1000, 300 * p, t, { body: c, arms, mood: 'happy', look: [x < 960 ? 0.6 : -0.6, -0.4], seed: i * 0.2 }); });
    ctx.restore();
  }
  ctx.restore();
  vignette(ctx, 0.35);
}

// S13 — Universal Paperclips (2017): the browser game ends the same way
function s13(ctx, u, d, t) {
  const L = (id, n = 0) => lw('game', id, n);
  const cam = camKeys([{ t: 0, v: [960, 560, 0.9, 0.0] }, { t: L('Universal'), v: [960, 520, 1.05, 0.0] }, { t: L('Спойлер'), v: [960, 500, 1.3, 0.01] }, { t: d, v: [960, 480, 2.4, 0.0] }], u);
  calmBg(ctx, cam, t, 0.6);
  ctx.save(); applyCam(ctx, cam, 1);
  // desk + CRT monitor
  ctx.fillStyle = PAL.wood; ctx.fillRect(-400, 860, 2800, 30); ctx.fillStyle = PAL.woodD; ctx.fillRect(-400, 890, 2800, 400);
  rrect(ctx, 520, 160, 880, 660, 40); ctx.fillStyle = '#d9d2c0'; ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.12)'; rrect(ctx, 1200, 160, 200, 660, 30); ctx.fill();
  ctx.fillStyle = '#b8b09c'; rrect(ctx, 840, 820, 240, 50, 10); ctx.fill();
  const SX = 590, SY = 220, SW = 740, SH = 520;
  ctx.save(); rrect(ctx, SX, SY, SW, SH, 24); ctx.clip();
  ctx.fillStyle = '#f7f7f2'; ctx.fillRect(SX, SY, SW, SH);
  const spoil = seg(u, L('Спойлер') - 0.2, L('же') + 0.4);
  const n = Math.floor(Math.pow(10, 1 + seg(u, 0.3, L('Спойлер')) * 5.5));
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111'; ctx.font = '700 36px Montserrat, sans-serif'; ctx.fillText('Paperclips: ' + n.toLocaleString('en-US'), SX + 40, SY + 80);
  ctx.font = '500 24px Montserrat, sans-serif'; ctx.fillStyle = '#333'; ctx.fillText('Available Funds: $ ' + (n * 0.07).toFixed(2), SX + 40, SY + 130); ctx.fillText('Wire: ' + Math.max(0, 1000 - (n % 1000)) + ' inches', SX + 40, SY + 166);
  const click = (u * 4) % 1 < 0.3;
  rrect(ctx, SX + 40, SY + 200, 260, 56, 6); ctx.fillStyle = click ? '#d8d8d8' : '#ececec'; ctx.fill(); ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#111'; ctx.font = '600 24px Montserrat, sans-serif'; ctx.fillText('Make Paperclip', SX + 66, SY + 237);
  ctx.fillStyle = '#555'; ctx.font = '500 20px Montserrat, sans-serif'; ['Manufacturing', 'Business', 'Computational Resources', 'Projects'].forEach((s, i) => ctx.fillText(s, SX + 40, SY + 310 + i * 40));
  // spoiler: the screen fills with paperclips, then a galaxy
  if (spoil > 0) {
    const R = rng(21); for (let i = 0; i < 400 * spoil; i++) paperclip(ctx, SX + R() * SW, SY + R() * SH, 40 + R() * 30, R() * TAU, R() < 0.3 ? PAL.amber : '#8f9bb5', { w: 0.07, flat: true });
    const g = seg(spoil, 0.55, 1); if (g > 0) { ctx.save(); ctx.globalAlpha = g; ctx.translate(SX + SW / 2, SY + SH / 2); ctx.scale(0.4, 0.4); ctx.translate(-W / 2, -H / 2); clipUniverse(ctx, t, 1); ctx.restore(); }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; for (let y = SY; y < SY + SH; y += 6) ctx.fillRect(SX, y, SW, 2);
  ctx.restore();
  // cursor clicking
  if (spoil < 0.3) { const cx = SX + 200 + Math.sin(t * 0.7) * 6, cy = SY + 232 + (click ? 3 : 0); ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 46); ctx.lineTo(12, 34); ctx.lineTo(22, 56); ctx.lineTo(30, 52); ctx.lineTo(20, 31); ctx.lineTo(36, 31); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  ctx.restore();
  const lp = pop(u, L('браузерная') - 0.2, 0.4) * (1 - seg(u, L('Спойлер') - 0.2, L('Спойлер') + 0.2));
  if (lp > 0) { ctx.save(); ctx.translate(960, 950); ctx.scale(lp, lp); pill(ctx, 'Universal Paperclips · браузерная игра · 2017', 0, 0, 32, '#e9ebff'); ctx.restore(); }
  const sp = pop(u, L('Спойлер') - 0.1, 0.35, 2.2) * (1 - seg(u, d - 0.5, d - 0.2));
  if (sp > 0) { ctx.save(); ctx.translate(960, 120); ctx.rotate(-0.06); ctx.scale(sp, sp); label(ctx, 'СПОЙЛЕР', 0, 0, 56, { color: '#fff', bg: PAL.red, weight: 900 }); ctx.restore(); }
  vignette(ctx, 0.4);
  fadeBlack(ctx, seg(u, d - 0.35, d), '3,2,16');
}

// S14 — "Is there a paperclip on your desk? So far, just one."
function s14(ctx, u, d, t) {
  const L = (id, n = 0) => lw('ending', id, n);
  const tOne = L('Пока') + 0.9;
  const cam = camKeys([{ t: 0, v: [980, 560, 1.0, 0.0] }, { t: L('скрепка'), v: [DESK.clipX - 40, DESK.clipY - 80, 1.5, 0.01] }, { t: tOne, v: [DESK.clipX + 20, DESK.clipY - 90, 1.7, 0.0] }, { t: d, v: [1060, 600, 1.2, 0.0] }], u);
  const second = E.outBack(seg(u, tOne, tOne + 0.35), 2.2);
  deskWorld(ctx, cam, t, { night: 1, look: second > 0 ? [0.8, 0.9] : [0.6, 0.8], mood: second > 0 ? 'scared' : 'calm', glint: Math.sin(clamp((u - L('скрепка')) / 0.8) * Math.PI), second });
  vignette(ctx, 0.6);
  fadeBlack(ctx, 1 - seg(u, 0, 0.5), '3,2,16');
  fadeBlack(ctx, seg(u, d - 1.4, d - 0.4), '0,0,0');
}

// ================= timeline =================
const SCENES = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14];
function drawScene(ctx, t) {
  let i = 0; while (i < SCENES.length - 1 && t >= Bd[i + 1]) i++;
  SCENES[i](ctx, t - Bd[i], Bd[i + 1] - Bd[i], t);
}
// the counter is visible from the title through the cosmos, then returns in the finale: 1 → 2
const T_ONE = at('ending', 'Пока') + 0.9;
function hudAlpha(t) {
  if (t < Bd[9]) return seg(t, at('title', 'максимизатор'), at('title', 'максимизатор') + 0.5) * (1 - seg(t, Bd[9] - 0.6, Bd[9] - 0.2));
  if (t > at('ending', 'Пока') - 0.2) return seg(t, at('ending', 'Пока') - 0.2, at('ending', 'Пока') + 0.3) * (1 - seg(t, END - 1.4, END - 0.4));
  return 0;
}
function hudOverride(t) { return t > Bd[13] ? (t < T_ONE ? 1 : 2) : undefined; }
function drawOverlay(ctx, t) { hud(ctx, t, hudAlpha(t), hudOverride(t)); grain(ctx, t, 0.07); }
const FAST = [at('hook', 'уничтожает') + 0.1, Bd[2], at('button', 'защитить'), at('cosmos', 'Галактика')];
function mbFn(t) {
  for (const b of FAST) if (Math.abs(t - b) < 0.45) return { n: 6, shutter: 1.0 / FPS };
  return { n: 2, shutter: 0.5 / FPS };
}

// ================= sound events (→ score.py) =================
function events() {
  const ev = []; const A = (n, t, x = {}) => ev.push({ n, t, ...x });
  const w = (id, word, n = 0) => at(id, word, n);
  // S1
  A('room', 0, { d: Bd[2] }); A('pop', w('hook', 'делай') - 0.2); A('glint', w('hook', 'скрепки'));
  A('robot', w('hook', 'злых') - 0.2); A('zap', w('hook', 'лазеров') - 0.1); A('robot', w('hook', 'восстания') - 0.1); A('cross', w('hook', 'машин'));
  A('dive', w('hook', 'уничтожает') - 0.3); A('cosmic', w('hook', 'уничтожает') + 0.1, { d: Bd[1] - w('hook', 'уничтожает') + 0.3 }); A('whoosh_back', Bd[1] - 0.2);
  // S2: each title letter lands with a metallic clink
  [['скрепочный', 10], ['максимизатор', 12]].forEach(([wd, n]) => { const t0 = w('title', wd) - (wd === 'скрепочный' ? 0.15 : 0.1); for (let i = 0; i < n; i++) A('clink', t0 + i * 0.04 + 0.22, { i }); });
  A('counter', w('title', 'максимизатор') + 0.1);
  // S3
  A('pop', Bd[2] + 0.15); A('pop', w('origin', 'мысленный') - 0.2); A('stamp_soft', w('origin', '2003') - 0.05);
  A('core', w('origin', 'искусственный') - 0.2); A('whoosh', w('origin', 'одна') - 0.3); A('plug', w('origin', 'скрепок') - 0.1);
  // S4: the stamping machine presses (speed ramps up on «станки быстрее»)
  { const t0 = Bd[3], d = Bd[4] - Bd[3], L = id => w('factory', id) - t0; let prev = 0;
    for (let u = 0; u < d; u += 1 / 240) { const sp = 1 + 2.2 * E.inOut(seg(u, L('станки') - 0.2, L('быстрее') + 0.4)); let tm = 0; for (let v = 0; v < u; v += 1 / 240) tm += (1 + 2.2 * E.inOut(seg(v, L('станки') - 0.2, L('быстрее') + 0.4))) / 240; const c = Math.floor(tm * 2.2 + 0.75); if (c > prev) { A('press', t0 + u); prev = c; } } }
  A('pop', w('factory', 'дешёвую') - 0.2); A('pop', w('factory', 'Скрепки') - 0.3); A('down', w('factory', 'дешевеют'), { d: 0.8 });
  for (let i = 0; i < 6; i++) A('soft_pop', w('factory', 'довольны') - 0.6 + i * 0.08, { i }); A('cheer', w('factory', 'довольны') - 0.4);
  // S5
  A('rise', w('smarter', 'умнеет') - 0.4, { d: 1.2 }); { const a = w('smarter', 'переписывает'), b = w('smarter', 'замечает'); for (let tt = a; tt < b; tt += 0.06) A('key', tt); }
  A('eye_narrow', w('smarter', 'замечает'));
  [['умнее', 1], ['денег', 0], ['заводов', 0], ['энергии', 0]].forEach(([wd, n], i) => A('sub', w('smarter', wd, n) - 0.35, { i }));
  // S6
  A('title_hit', w('convergence', 'инструментальной') - 0.1);
  [['скрепки'], ['лекарство'], ['цифры']].forEach(([wd], i) => A('goal', w('convergence', wd) - 0.25, { i }));
  [['ресурсы'], ['сила'], ['выживание']].forEach(([wd], i) => A('drive', w('convergence', wd) - 0.2, { i }));
  A('converge', w('convergence', 'помогают') - 0.3, { d: 1.6 }); for (let i = 0; i < 4; i++) A('soft_pop', w('convergence', 'Почти') - 0.2 + i * 0.2, { i: i + 3 });
  // S7
  { const a = w('button', 'тянутся') - 0.6, b = w('button', 'Значит') + 0.4; for (let tt = a; tt < b; tt += 0.33) A('step', tt); }
  A('whir', w('button', 'кнопке') - 0.2); A('pop', w('button', 'выключенная') - 0.2); A('riser', w('button', 'Значит'), { d: w('button', 'защитить') - w('button', 'Значит') });
  A('slam', w('button', 'защитить') + 0.1); A('boing', w('button', 'защитить') + 0.25);
  // S8
  A('pop', w('atoms', 'Элиезер') - 0.2); A('pop', w('atoms', 'ненавидит') - 0.2); A('cross_small', w('atoms', 'ненавидит') + 0.15); A('pop', w('atoms', 'любит') - 0.2); A('cross_small', w('atoms', 'любит') + 0.15);
  A('scanner', w('atoms', 'атомов') - 0.5, { d: 0.9 }); A('pop', w('atoms', 'атомов') + 0.2); A('stream', w('atoms', 'пригодятся') - 0.2, { d: Bd[8] - w('atoms', 'пригодятся') });
  // S9
  A('grind', w('cosmos', 'Земля') - 0.1, { d: 1.4 }); A('whoosh_out', w('cosmos', 'Солнечная') - 0.3);
  for (let i = 0; i < 7; i++) A('ding_low', w('cosmos', 'система') - 0.3 + i * 0.12, { i });
  for (let i = 0; i < 6; i++) A('launch', w('cosmos', 'Зонды') - 0.2 + i * 0.18, { i }); for (let i = 0; i < 8; i++) A('sparkle', w('cosmos', 'фабрики') + i * 0.1, { i });
  A('galaxy', w('cosmos', 'Галактика') - 0.4, { d: w('cosmos', 'выполнен') - w('cosmos', 'Галактика') + 0.4 }); A('complete', w('cosmos', 'выполнен') - 0.1); A('check', w('cosmos', 'безупречно'));
  // S10
  A('calm', Bd[9] + 0.2); A('title_soft', w('orthogonality', 'ум') - 0.1); for (let i = 0; i < 10; i++) A('soft_pop', w('orthogonality', 'чему') - 0.2 + i * 0.07, { i });
  A('pop', w('orthogonality', 'Сверхразумная') - 0.3); A('pop_big', w('orthogonality', 'глупости') - 0.3); A('cap', w('orthogonality', 'мудрой') - 0.1);
  // S11
  A('motor', Bd[10], { d: Bd[11] - Bd[10] }); A('pop', w('boat', '2016') - 0.2); A('coin', w('boat', 'награждали') - 0.2);
  { const t0 = Bd[10], k0 = w('boat', 'кружила') - 0.6; for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + 0.5; for (let n = 0; n < 10; n++) { const tt = k0 + (a + n * TAU) / 2.4; if (tt > k0 && tt < Bd[11]) A('bonus', tt, { i: k }); } } }
  A('fire', w('boat', 'горела') - 0.2, { d: Bd[11] - w('boat', 'горела') }); A('bump', w('boat', 'врезалась')); A('score', w('boat', 'набирала') - 0.3); A('ding', w('boat', 'финиша') - 0.2);
  // S12
  A('pop', w('lesson', 'имели') - 0.3); A('pop', w('lesson', 'сказали') - 0.4); A('whoosh', w('lesson', 'сказали')); A('cosmic_small', w('lesson', 'сказали') + 0.3);
  A('title_soft', w('lesson', 'проблемой') - 0.1); A('dawn', w('lesson', 'Поэтому') - 0.4); for (let i = 0; i < 4; i++) A('soft_pop', w('lesson', 'Поэтому') + i * 0.12, { i: i + 2 });
  A('pop', w('lesson', 'угадывать') - 0.2); A('check', w('lesson', 'выключать') - 0.3);
  // S13
  { const a = Bd[12] + 0.2, b = w('game', 'Спойлер') - 0.2; for (let tt = a; tt < b; tt += 0.25) A('click', tt); }
  A('pop', w('game', 'браузерная') - 0.2); A('sting', w('game', 'Спойлер') - 0.1); A('swarm', w('game', 'Спойлер'), { d: 1.6 }); A('whoosh', Bd[13] - 0.4);
  // S14
  A('glint', w('ending', 'скрепка')); A('clink_big', T_ONE); A('end_hit', T_ONE + 0.05);
  return { events: ev.sort((a, b) => a.t - b.t), Bd, END, lines: N.lines };
}
window.VIDEO = { drawScene, drawOverlay, mbFn, END, Bd, events };
