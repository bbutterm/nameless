// «Василиск Роко» — long version (~2:48). One thread: the eye that looks back at you. See storyboard.md.
'use strict';
const N = narration();
const at = N.at, ln = N.line;
const PAL = {
  bg0: '#0b0828', bg1: '#241a5e', ind: '#1a1450', ind2: '#2b2275', ind3: '#3d33a0',
  cyan: '#5ce1ff', cyanD: '#1f7fd6', ice: '#bff3ff', mag: '#ff3b6b', magD: '#b81d4a', amber: '#ffb547', amberD: '#d9831f',
  white: '#f2f5ff', skin: '#f6c7a1', skinD: '#d99c76', hair: '#2a1d3f', teal: '#2fd6b0', pink: '#ff8fb8', lilac: '#a68cff',
};
// scene boundaries: midway in the gap before each line, never later than 0.25 s before its first word
const IDS = ['hook', 'welcome', 'forum', 'superintelligence', 'every_day', 'threat', 'copy', 'basilisk', 'ban', 'no_effect', 'blackmail', 'pascal', 'lesson', 'ending'];
const Bd = [0];
for (let i = 1; i < IDS.length; i++) { const p = ln(IDS[i - 1]), c = ln(IDS[i]); Bd.push(Math.min(c.t0 - 0.25, (p.t1 + c.t0) / 2 + 0.1)); }
Bd.push(N.END);
const END = N.END;
// scene-local time of a word: w('basilisk','Теперь') - Bd[k]
const S = {}; IDS.forEach((id, i) => S[id] = i);
const lw = (id, word, n = 0) => at(id, word, n) - Bd[S[id]];

// ---------------- shared world ----------------
const STARS = [makeStars(11, 900, 4600, 3000, 0.5, 1.3), makeStars(12, 300, 4600, 3000, 0.9, 2.1), makeStars(13, 90, 4600, 3000, 1.5, 3.2)];
const NEB = [{ x: 300, y: 260, r: 760, c: '#4a2a9a' }, { x: 1600, y: 220, r: 700, c: '#1d4ea0' }, { x: 1150, y: 950, r: 860, c: '#3a1f7e' }, { x: -200, y: 900, r: 600, c: '#7a2a8a' }];
function sky(ctx, cam, t, o = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, o.top || PAL.bg0); g.addColorStop(1, o.bot || PAL.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); applyCam(ctx, cam, 0.12);
  for (const n of NEB) glow(ctx, n.x, n.y, n.r, rgba(o.neb || n.c, 0.55), 0.65 * (o.dim ?? 1));
  drawStars(ctx, STARS[0], t, '#c9d6ff', 0.3); ctx.restore();
  ctx.save(); applyCam(ctx, cam, 0.3); drawStars(ctx, STARS[1], t, '#e3ebff', 0.5); ctx.restore();
  ctx.save(); applyCam(ctx, cam, 0.55); drawStars(ctx, STARS[2], t, '#ffffff', 0.7); ctx.restore();
}
function vignette(ctx, a = 0.55) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(3,2,16,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
const DUST = (() => { const R = rng(77); const a = []; for (let i = 0; i < 30; i++) a.push({ x: R() * W * 1.6 - W * 0.3, y: R() * H * 1.4 - H * 0.2, r: 3 + R() * 10, sp: 6 + R() * 18, ph: R() * TAU }); return a; })();
function dust(ctx, cam, t, color = '#9fdcff', a = 0.3) {
  layer(ctx, 7, g => {
    applyCam(g, cam, 1.6);
    for (const d of DUST) { g.globalAlpha = a * (0.5 + 0.5 * Math.sin(t * 0.8 + d.ph)); circle(g, d.x + Math.sin(t * 0.3 + d.ph) * 30, d.y - (t * d.sp) % 200, d.r, color); }
  });
}
function fadeBlack(ctx, a, c = '3,2,16') { if (a > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(${c},${a})`; ctx.fillRect(0, 0, W, H); ctx.restore(); } }
function flash(ctx, a, c = '255,255,255') { if (a > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${c},${a})`; ctx.fillRect(0, 0, W, H); ctx.restore(); } }
const pop = (u, t0, d = 0.35, s = 1.8) => E.outBack(seg(u, t0, t0 + d), s);
const shake = (u, t0, amp = 14, k = 8) => u > t0 ? amp * Math.exp(-(u - t0) * k) * Math.sin((u - t0) * 70) : 0;

// ---------------- the eye ----------------
function eye(ctx, x, y, w, open, lx, ly, slit, opt = {}) {
  ctx.save(); ctx.translate(x, y);
  const h = w * 0.34 * Math.max(0, open);
  if (open < 0.03) {
    ctx.strokeStyle = rgba(opt.lid || PAL.cyan, 0.9); ctx.lineWidth = w * 0.012; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(0, w * 0.06, w / 2, 0); ctx.stroke();
    ctx.restore(); return;
  }
  glow(ctx, 0, 0, w * 0.95, rgba(opt.glow || PAL.cyanD, 0.6), 0.7 * Math.min(1, open));
  const path = () => { ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.bezierCurveTo(-w * 0.22, -h * 1.3, w * 0.22, -h * 1.3, w / 2, 0); ctx.bezierCurveTo(w * 0.22, h * 1.3, -w * 0.22, h * 1.3, -w / 2, 0); ctx.closePath(); };
  path(); ctx.fillStyle = '#0a0a2c'; ctx.fill();
  ctx.save(); path(); ctx.clip();
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2); sg.addColorStop(0, '#2a2a7e'); sg.addColorStop(1, '#09092a');
  ctx.fillStyle = sg; ctx.fillRect(-w / 2, -w / 2, w, w);
  const ir = w * 0.21, ix = lx * w * 0.17, iy = ly * h * 0.35;
  const ig = ctx.createRadialGradient(ix, iy, 0, ix, iy, ir);
  ig.addColorStop(0, '#f2fdff'); ig.addColorStop(0.32, opt.iris || PAL.cyan); ig.addColorStop(0.82, opt.iris2 || '#2a5fd4'); ig.addColorStop(1, '#13207a');
  circle(ctx, ix, iy, ir, ig);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = Math.max(1, w * 0.004);
  for (let k = 0; k < 44; k++) { const a = k / 44 * TAU; ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * ir * 0.42, iy + Math.sin(a) * ir * 0.42); ctx.lineTo(ix + Math.cos(a + 0.05) * ir * 0.93, iy + Math.sin(a + 0.05) * ir * 0.93); ctx.stroke(); }
  ctx.fillStyle = '#03021a'; ctx.beginPath(); ctx.ellipse(ix, iy, ir * lerp(0.1, 0.42, slit), ir * 0.86, 0, 0, TAU); ctx.fill();
  circle(ctx, ix - ir * 0.36, iy - ir * 0.4, ir * 0.13, 'rgba(255,255,255,0.9)');
  circle(ctx, ix + ir * 0.3, iy + ir * 0.36, ir * 0.05, 'rgba(255,255,255,0.55)');
  ctx.fillStyle = 'rgba(3,2,20,0.5)'; ctx.beginPath(); ctx.ellipse(0, -h * 1.12, w * 0.6, h * 0.62, 0, 0, TAU); ctx.fill();
  ctx.restore();
  path(); ctx.lineWidth = w * 0.013; ctx.strokeStyle = opt.lid || PAL.cyan; ctx.stroke();
  ctx.restore();
}

// ---------------- characters ----------------
// "Ты": round head, bean body, dot eyes. o: {body, skin, look:[x,y], blink, mood:'calm'|'scared'|'happy'|'sleep', arms, lean, squash, ghost}
function dude(ctx, x, y, h, t, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.lean || 0);
  const s = o.squash || 1; ctx.scale(1 / Math.sqrt(s), s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const hr = h * 0.22, bw = h * 0.46, bh = h - hr * 1.7;
  const body = o.body || '#4f7cff', bodyD = o.bodyD || 'rgba(0,0,20,0.22)';
  // shadow on ground
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,20,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.7, bw * 0.12, 0, 0, TAU); ctx.fill(); }
  // body
  shaded(ctx, (g, c) => { if (!c) g.beginPath(); g.moveTo(-bw / 2, 0); g.lineTo(-bw / 2, -bh + bw * 0.45); g.arc(0, -bh + bw * 0.45, bw / 2, Math.PI, 0); g.lineTo(bw / 2, 0); g.closePath(); }, body, bodyD, -bw * 0.18, 0);
  // arms
  const arms = o.arms || 'down';
  ctx.strokeStyle = body; ctx.lineWidth = bw * 0.2; ctx.lineCap = 'round';
  const shY = -bh + bw * 0.55;
  const armPose = {
    down: [[-0.5, 0.25, -0.62, 0.62], [0.5, 0.25, 0.62, 0.62]],
    up: [[-0.5, 0, -0.9, -0.55], [0.5, 0, 0.9, -0.55]],
    cross: [[-0.5, 0.2, 0.25, 0.42], [0.5, 0.2, -0.25, 0.36]],
    work: [[-0.5, 0.2, -0.75, 0.2 + 0.15 * Math.sin(t * 18)], [0.5, 0.2, 0.8, 0.15 + 0.15 * Math.sin(t * 18 + 2)]],
    wave: [[-0.5, 0.25, -0.62, 0.62], [0.5, 0, 0.85 + 0.12 * Math.sin(t * 9), -0.6]],
    shrug: [[-0.5, 0.15, -0.9, -0.05], [0.5, 0.15, 0.9, -0.05]],
  }[arms] || [];
  for (const [ax, ay, bx, by] of armPose) { ctx.beginPath(); ctx.moveTo(ax * bw, shY + ay * bh * 0.4); ctx.lineTo(bx * bw, shY + by * bh * 0.5); ctx.stroke(); circle(ctx, bx * bw, shY + by * bh * 0.5, bw * 0.12, o.skin || PAL.skin); }
  // head
  const hy = -bh - hr * 0.55;
  shaded(ctx, (g, c) => { if (!c) g.beginPath(); g.arc(0, hy, hr, 0, TAU); }, o.skin || PAL.skin, 'rgba(120,40,40,0.18)', -hr * 0.25, -hr * 0.1);
  // hair cap
  ctx.save(); ctx.beginPath(); ctx.arc(0, hy, hr, 0, TAU); ctx.clip(); ctx.fillStyle = o.hair || PAL.hair; ctx.beginPath(); ctx.ellipse(-hr * 0.15, hy - hr * 0.95, hr * 1.2, hr * 0.62, -0.15, 0, TAU); ctx.fill(); ctx.restore();
  // face
  const [lx, ly] = o.look || [0, 0];
  const mood = o.mood || 'calm';
  const blink = o.blink ?? (((t * 0.37 + (o.seed || 0)) % 1) < 0.035 ? 1 : 0);
  const ex = hr * 0.36, ey = hy + hr * 0.08, er = hr * (mood === 'scared' ? 0.17 : 0.13);
  for (const sx of [-1, 1]) {
    const cx = sx * ex + lx * hr * 0.18, cy = ey + ly * hr * 0.12;
    if (mood === 'sleep' || blink) { ctx.strokeStyle = '#2a1a2a'; ctx.lineWidth = hr * 0.07; ctx.beginPath(); ctx.arc(cx, cy - er * 0.2, er, 0.15, Math.PI - 0.15); ctx.stroke(); }
    else {
      if (mood === 'scared') { circle(ctx, cx, cy, er * 1.25, '#ffffff'); circle(ctx, cx + lx * er * 0.4, cy + ly * er * 0.3, er * 0.6, '#1a1030'); }
      else { circle(ctx, cx, cy, er, '#1a1030'); circle(ctx, cx - er * 0.3, cy - er * 0.35, er * 0.33, '#ffffff'); }
    }
  }
  ctx.strokeStyle = '#2a1a2a'; ctx.lineWidth = hr * 0.07; ctx.lineCap = 'round';
  const my = hy + hr * 0.5, mx = lx * hr * 0.12;
  if (mood === 'happy') { ctx.beginPath(); ctx.arc(mx, my - hr * 0.12, hr * 0.2, 0.2, Math.PI - 0.2); ctx.stroke(); }
  else if (mood === 'scared') { ctx.fillStyle = '#2a1a2a'; ctx.beginPath(); ctx.ellipse(mx, my, hr * 0.1, hr * 0.13, 0, 0, TAU); ctx.fill(); }
  else if (mood !== 'sleep') { ctx.beginPath(); ctx.moveTo(mx - hr * 0.12, my); ctx.lineTo(mx + hr * 0.12, my); ctx.stroke(); }
  // cheeks
  ctx.globalAlpha *= 0.35; circle(ctx, -ex * 1.25, ey + hr * 0.3, hr * 0.12, '#ff7a9a'); circle(ctx, ex * 1.25, ey + hr * 0.3, hr * 0.12, '#ff7a9a');
  ctx.restore();
  return { headX: x, headY: y + hy * s, hr };
}
// tiny crowd person (no face) for far shots
function mini(ctx, x, y, h, body, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.lean || 0); const s = o.squash || 1; ctx.scale(1 / Math.sqrt(s), s);
  const hr = h * 0.18, bw = h * 0.42;
  rrect(ctx, -bw / 2, -h + hr * 1.75, bw, h - hr * 1.75, bw * 0.45); ctx.fillStyle = body; ctx.fill();
  ctx.fillStyle = 'rgba(0,0,20,0.2)'; rrect(ctx, 0, -h + hr * 1.75, bw / 2, h - hr * 1.75, bw * 0.3); ctx.fill();
  circle(ctx, 0, -h + hr, hr, o.skin || PAL.skin);
  ctx.save(); circle(ctx, 0, -h + hr, hr); ctx.clip(); circle(ctx, -hr * 0.2, -h + hr * 0.25, hr * 1.05, o.hair || PAL.hair); ctx.restore();
  ctx.restore();
}
// the idea: a warm glowing orb with a sparkle
function ideaOrb(ctx, x, y, r, t, o = {}) {
  const c = o.color || PAL.amber;
  glow(ctx, x, y, r * 5, rgba(c, 0.55), o.glow ?? 0.9);
  circle(ctx, x, y, r, c); circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.45, '#fff3d6');
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.8); ctx.fillStyle = 'rgba(255,240,200,0.8)';
  for (let k = 0; k < 4; k++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.moveTo(r * 1.3, 0); ctx.lineTo(r * 2.1 + r * 0.4 * Math.sin(t * 5 + k), -r * 0.12); ctx.lineTo(r * 2.1 + r * 0.4 * Math.sin(t * 5 + k), r * 0.12); ctx.fill(); }
  ctx.restore();
}
function bulb(ctx, x, y, r, color, a = 1) {
  ctx.save(); ctx.globalAlpha *= a;
  glow(ctx, x, y, r * 4.2, rgba(color, 0.7), 0.8);
  circle(ctx, x, y, r, color); circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.3, 'rgba(255,255,255,0.7)');
  ctx.fillStyle = '#7d86b5'; rrect(ctx, x - r * 0.42, y + r * 0.85, r * 0.84, r * 0.55, r * 0.12); ctx.fill();
  ctx.restore();
}

// ---------------- AI core with bead rings (beads become the serpent) ----------------
const RING_N = [20, 23, 27], RING_R = [190, 245, 300], RING_TILT = [1.12, 1.24, 1.02], RING_ROT = [0.35, -0.5, 0.1];
const BEADS = (() => { const a = []; RING_N.forEach((n, k) => { for (let i = 0; i < n; i++) a.push({ k, i, n }); }); return a; })();
function beadPos(b, t, cx, cy, sc) {
  const ang = b.i / b.n * TAU + t * (0.5 + 0.18 * b.k) * (b.k % 2 ? -1 : 1);
  const R = RING_R[b.k] * sc;
  const ex = Math.cos(ang) * R, ey = Math.sin(ang) * R * Math.cos(RING_TILT[b.k]);
  const c = Math.cos(RING_ROT[b.k]), s = Math.sin(RING_ROT[b.k]);
  return { x: cx + ex * c - ey * s, y: cy + ex * s + ey * c, front: Math.sin(ang) > 0 };
}
// o: {grow, eye, rings, tint (0 cyan → 1 magenta), warm (0..1 amber), look:[x,y], slit}
function aiCore(ctx, cx, cy, sc, t, o = {}) {
  const grow = o.grow ?? 1; if (grow <= 0) return;
  const tint = o.tint || 0, warm = o.warm || 0;
  const lc = tint > 0 ? mix(PAL.cyan, PAL.mag, tint) : (warm > 0 ? mix(PAL.cyan, PAL.amber, warm) : PAL.cyan);
  const gc = tint > 0 ? mix(PAL.cyanD, PAL.magD, tint) : (warm > 0 ? mix(PAL.cyanD, PAL.amberD, warm) : mix(PAL.cyanD, PAL.cyanD, 0));
  const ringA = o.rings ?? 1;
  glow(ctx, cx, cy, 440 * sc * grow, gc.replace('rgb(', 'rgba(').replace(')', ',0.6)'), 0.8);
  ctx.save(); ctx.globalAlpha *= ringA * 0.35;
  for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(RING_ROT[k]); ctx.strokeStyle = lc; ctx.lineWidth = 2 * Math.max(1, sc); ctx.beginPath(); ctx.ellipse(0, 0, RING_R[k] * sc * grow, RING_R[k] * sc * grow * Math.cos(RING_TILT[k]), 0, Math.PI, TAU); ctx.stroke(); ctx.restore(); }
  ctx.restore();
  const drawBeads = (front) => { for (const b of BEADS) { const p = beadPos(b, t, cx, cy, sc * grow); if (p.front !== front) continue; ctx.globalAlpha = ringA * (front ? 1 : 0.55); circle(ctx, p.x, p.y, 7 * sc, front ? '#e9fbff' : lc); } ctx.globalAlpha = 1; };
  if (ringA > 0) drawBeads(false);
  const r = 110 * sc * grow;
  ball(ctx, cx, cy, r, mix('#1d2f7e', '#5a1838', tint), 'rgba(3,4,30,0.55)', null, -0.9);
  ctx.save(); circle(ctx, cx, cy, r); ctx.clip(); ctx.strokeStyle = lc; ctx.globalAlpha = 0.3; ctx.lineWidth = 2 * Math.max(1, sc);
  for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(cx, cy, r, Math.abs(r * k / 3.5), 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  const eo = o.eye ?? 1;
  if (eo > 0) eye(ctx, cx, cy, r * 1.55, eo, (o.look || [0, 0])[0], (o.look || [0, 0])[1], o.slit ?? 0.35, { glow: lc, lid: lc, iris: tint > 0.5 ? '#ff9ab3' : (warm > 0.5 ? '#ffe2a8' : PAL.cyan), iris2: tint > 0.5 ? PAL.magD : (warm > 0.5 ? PAL.amberD : '#2a5fd4') });
  ctx.save(); ctx.globalAlpha *= ringA * 0.9;
  for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(RING_ROT[k]); ctx.strokeStyle = lc; ctx.lineWidth = 2.5 * Math.max(1, sc); ctx.beginPath(); ctx.ellipse(0, 0, RING_R[k] * sc * grow, RING_R[k] * sc * grow * Math.cos(RING_TILT[k]), 0, 0, Math.PI); ctx.stroke(); ctx.restore(); }
  ctx.restore();
  if (ringA > 0) drawBeads(true);
}

// ---------------- typography ----------------
function kineticWord(ctx, text, x, y, size, prog, opt = {}) {
  ctx.save(); ctx.font = `${opt.weight || 800} ${size}px Unbounded, Montserrat, sans-serif`; ctx.textBaseline = 'alphabetic';
  const chars = [...text]; const ws = chars.map(c => ctx.measureText(c).width); const sp = size * (opt.track || 0.04);
  const tw = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
  let cx = x - tw / 2;
  chars.forEach((c, i) => {
    const k = clamp(prog * (chars.length + 4) - i);
    const e = E.outBack(clamp(k));
    if (k > 0) {
      ctx.save(); ctx.translate(cx + ws[i] / 2, y + (1 - E.out3(k)) * size * 0.6); ctx.scale(lerp(0.4, 1, e), lerp(1.6, 1, e));
      ctx.globalAlpha *= clamp(k * 2) * (opt.alpha ?? 1);
      if (opt.glitch && k < 1) { ctx.fillStyle = rgba(PAL.mag, 0.8); ctx.fillText(c, -ws[i] / 2 + 6 * (1 - k), 0); ctx.fillStyle = rgba(PAL.cyan, 0.8); ctx.fillText(c, -ws[i] / 2 - 6 * (1 - k), 0); }
      if (opt.shadow) { ctx.fillStyle = opt.shadow; ctx.fillText(c, -ws[i] / 2 + size * 0.05, size * 0.06); }
      ctx.fillStyle = opt.color || PAL.white; ctx.fillText(c, -ws[i] / 2, 0); ctx.restore();
    }
    cx += ws[i] + sp;
  });
  ctx.restore();
}
function label(ctx, text, x, y, size, o = {}) {
  ctx.save(); ctx.font = `${o.weight || 800} ${size}px ${o.font || 'Unbounded'}, Montserrat, sans-serif`; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.bg) { const w = ctx.measureText(text).width + size * 1.1; rrect(ctx, x - (o.align === 'left' ? size * 0.55 : w / 2), y - size * 0.85, w, size * 1.7, size * 0.85); ctx.fillStyle = o.bg; ctx.fill(); }
  if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(text, x + size * 0.05, y + size * 0.07); }
  ctx.fillStyle = o.color || PAL.white; ctx.fillText(text, x, y); ctx.restore();
}
// numbered chapter badge for the three counter-arguments
function badge(ctx, n, x, y, r, p, color) {
  if (p <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(p, p); ctx.rotate((1 - p) * -0.6);
  circle(ctx, 0, 6, r, 'rgba(0,0,20,0.3)'); circle(ctx, 0, 0, r, color);
  label(ctx, String(n), 0, 4, r * 1.15, { color: '#1a1440', weight: 900 });
  ctx.restore();
}

// ================= SCENES =================
// S1+S2 share one world: a tiny planet in space, a light-grid "game board", and the giant eye above the horizon.
const PLANET = { x: 960, y: 800, r: 190 };
const BIGEYE = { x: 960, y: 40, w: 1250 };
const SYMS = [
  { s: 'E=mc²', x: 1420, y: 300, size: 56, tw: 0.0 }, { s: '∑', x: 1640, y: 470, size: 96, tw: 0.12 }, { s: '∫dx', x: 1330, y: 560, size: 58, tw: 0.2 },
  { s: 'π', x: 1600, y: 250, size: 80, tw: 0.3 }, { s: 'a²+b²', x: 1200, y: 240, size: 46, tw: 0.08 },
];
function boardGrid(ctx, cam, reveal, t, tint = 0) {
  if (reveal <= 0) return;
  // a perspective floor of light lines spreading out from under the planet
  const hz = PLANET.y - 40, vx = PLANET.x;
  ctx.save(); applyCam(ctx, cam, 1);
  ctx.beginPath(); ctx.ellipse(PLANET.x, PLANET.y + 120, 3200 * reveal, 1000 * reveal, 0, 0, TAU); ctx.clip();
  const col = mix(PAL.cyan, PAL.mag, tint);
  for (let i = -14; i <= 14; i++) {
    ctx.strokeStyle = col.replace('rgb(', 'rgba(').replace(')', `,${0.5 - Math.abs(i) * 0.025})`); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(vx + i * 40, hz); ctx.lineTo(vx + i * 420, hz + 1600); ctx.stroke();
  }
  for (let j = 1; j < 14; j++) {
    const yy = hz + Math.pow(j / 14, 2.2) * 1600 + ((t * 30) % 40) * (j / 14);
    ctx.strokeStyle = col.replace('rgb(', 'rgba(').replace(')', `,${0.12 + 0.3 * j / 14})`); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-3000, yy); ctx.lineTo(5000, yy); ctx.stroke();
  }
  // board squares glowing faintly
  ctx.globalCompositeOperation = 'lighter';
  for (let i = -6; i < 6; i++) for (let j = 2; j < 9; j++) {
    if ((i + j) % 2) continue;
    const y0 = hz + Math.pow(j / 14, 2.2) * 1600, y1 = hz + Math.pow((j + 1) / 14, 2.2) * 1600;
    const x00 = vx + i * 40 + (i * 420 - i * 40) * (y0 - hz) / 1600, x01 = vx + (i + 1) * 40 + ((i + 1) * 420 - (i + 1) * 40) * (y0 - hz) / 1600;
    const x10 = vx + i * 40 + (i * 420 - i * 40) * (y1 - hz) / 1600, x11 = vx + (i + 1) * 40 + ((i + 1) * 420 - (i + 1) * 40) * (y1 - hz) / 1600;
    ctx.fillStyle = col.replace('rgb(', 'rgba(').replace(')', ',0.06)');
    ctx.beginPath(); ctx.moveTo(x00, y0); ctx.lineTo(x01, y0); ctx.lineTo(x11, y1); ctx.lineTo(x10, y1); ctx.fill();
  }
  ctx.restore();
}
function planet(ctx, cam, t) {
  ctx.save(); applyCam(ctx, cam, 1);
  const { x, y, r } = PLANET;
  glow(ctx, x, y, r * 2.2, rgba('#6b4cff', 0.4), 0.7);
  ball(ctx, x, y, r, '#6d5ad6', 'rgba(20,10,60,0.45)', null, -1.0);
  // craters
  [[-70, 40, 34], [60, 90, 22], [90, -10, 16], [-20, 120, 14], [-110, -40, 12]].forEach(([dx, dy, rr]) => { circle(ctx, x + dx, y + dy, rr, 'rgba(40,25,110,0.45)'); circle(ctx, x + dx - rr * 0.2, y + dy - rr * 0.2, rr * 0.75, 'rgba(120,100,230,0.35)'); });
  // a little flag of grass-like spikes on top
  ctx.fillStyle = '#8a74ff'; for (let k = -5; k <= 5; k++) { const a = -Math.PI / 2 + k * 0.09; const bx = x + Math.cos(a) * r, by = y + Math.sin(a) * r; ctx.beginPath(); ctx.moveTo(bx - 6, by + 3); ctx.lineTo(bx + Math.cos(a) * 14, by + Math.sin(a) * 14); ctx.lineTo(bx + 6, by + 3); ctx.fill(); }
  ctx.restore();
}
// distant scenery for space shots: a ringed giant, a small moon, a comet
function farPlanets(ctx, cam, t) {
  ctx.save(); applyCam(ctx, cam, 0.25);
  ball(ctx, 260, 260, 120, '#e0658f', 'rgba(60,10,60,0.45)', null, -0.9);
  ctx.save(); ctx.translate(260, 260); ctx.rotate(-0.35); ctx.strokeStyle = 'rgba(255,190,210,0.55)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(0, 0, 220, 46, 0, 0.15, Math.PI - 0.15, true); ctx.stroke(); ctx.restore();
  ball(ctx, 1720, 860, 46, '#3fc9c0', 'rgba(10,30,60,0.5)', null, -0.9);
  ball(ctx, 1550, 150, 22, '#ffb547', 'rgba(80,30,10,0.45)', null, -0.9);
  ctx.restore();
  ctx.save(); applyCam(ctx, cam, 0.4);
  const k = ((t * 0.09) % 1); const cx = lerp(-300, 2400, k), cy = lerp(80, 520, k);
  const g = ctx.createLinearGradient(cx, cy, cx - 260, cy - 44); g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 260, cy - 44); ctx.stroke();
  ctx.restore();
}
function hookWorld(ctx, t, cam, st) {
  sky(ctx, cam, t);
  farPlanets(ctx, cam, t);
  // the giant eye over the horizon (opens in S2)
  if (st.eyeOpen > 0 || st.eyeLine > 0) {
    ctx.save(); applyCam(ctx, cam, 0.8);
    if (st.eyeOpen > 0.03) eye(ctx, BIGEYE.x, BIGEYE.y, BIGEYE.w, st.eyeOpen, st.lx, st.ly, st.slit, { glow: PAL.cyanD });
    else { ctx.globalAlpha = st.eyeLine; eye(ctx, BIGEYE.x, BIGEYE.y, BIGEYE.w, 0, 0, 0, 0); }
    ctx.restore();
  }
  boardGrid(ctx, cam, st.grid, t);
  planet(ctx, cam, t);
  ctx.save(); applyCam(ctx, cam, 1);
  const d = dude(ctx, PLANET.x - 10, PLANET.y - PLANET.r + 6, 170, t, { look: st.look, mood: st.mood, arms: st.arms, body: '#4f7cff', seed: 0.3 });
  ctx.restore();
  return d;
}
function s1(ctx, u, d, t) {
  const cam = s1cam(u);
  // the idea's path: drifts in, hovers, then dives into the head
  const tIn = lw('hook', 'идея') - 0.6, tWarn = lw('hook', 'опасной'), tGo = lw('hook', 'стоит'), tHit = lw('hook', 'узнать') + 0.15;
  const head = { x: PLANET.x - 10, y: PLANET.y - PLANET.r + 6 - 150 };
  let ox, oy;
  const k1 = E.out3(seg(u, tIn, tIn + 1.6));
  const hx = 1180 + Math.sin(u * 1.3) * 18, hy = 400 + Math.sin(u * 1.9) * 14;
  ox = lerp(-200, hx, k1); oy = lerp(120, hy, k1) - Math.sin(k1 * Math.PI) * 120;
  const k2 = E.inOut(seg(u, tGo, tHit));
  ox = lerp(ox, head.x, k2); oy = lerp(oy, head.y, k2) - Math.sin(k2 * Math.PI) * 140;
  const st = { grid: E.out3(seg(u, lw('hook', 'игре') - 0.25, d + 0.6)), look: [clamp((ox - head.x) / 250, -1, 1), clamp((oy - head.y) / 250, -1, 1)], mood: u > tHit ? 'scared' : 'calm', eyeOpen: 0, eyeLine: 0 };
  if (k2 >= 1) st.look = [0, -0.6];
  const dd = hookWorld(ctx, t, cam, st);
  ctx.save(); applyCam(ctx, cam, 1);
  // "not because of formulas or secrets": symbols pop around the idea, then get brushed away
  const sIn = lw('hook', 'формул') - 0.25, sOut = lw('hook', 'А') - 0.1;
  SYMS.forEach((m, i) => {
    const p = pop(u, sIn + m.tw, 0.35, 2), q = E.in2(seg(u, sOut + i * 0.05, sOut + 0.7 + i * 0.05));
    if (p <= 0 || q >= 1) return;
    ctx.save(); ctx.translate(m.x + q * 300, m.y - q * 120); ctx.rotate(q * 0.8 * (i % 2 ? 1 : -1)); ctx.scale(p, p); ctx.globalAlpha *= 1 - q;
    label(ctx, m.s, 0, 0, m.size, { color: '#d9e4ff', weight: 800, font: 'Montserrat' });
    ctx.restore();
  });
  // secret folder
  const fp = pop(u, lw('hook', 'секретов') - 0.15, 0.4, 2), fq = E.in2(seg(u, sOut + 0.2, sOut + 0.9));
  if (fp > 0 && fq < 1) {
    ctx.save(); ctx.translate(1560 + fq * 320, 690 - fq * 60); ctx.rotate(-0.08 + fq * 0.7); ctx.scale(fp, fp); ctx.globalAlpha *= 1 - fq;
    rrect(ctx, -110, -70, 90, 30, 10); ctx.fillStyle = '#c9902a'; ctx.fill(); rrect(ctx, -110, -55, 220, 150, 14); ctx.fillStyle = PAL.amber; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; rrect(ctx, 0, -55, 110, 150, 12); ctx.fill();
    label(ctx, 'СЕКРЕТНО', 0, 22, 26, { color: PAL.magD, weight: 900 });
    ctx.restore();
  }
  // the idea
  if (k2 < 1) {
    const warn = seg(u, tWarn - 0.05, tWarn + 0.9);
    if (warn > 0 && warn < 1) { ctx.strokeStyle = rgba(PAL.mag, 0.7 * (1 - warn)); ctx.lineWidth = 8 * (1 - warn) + 1; circle(ctx, ox, oy, 30 + warn * 160); ctx.stroke(); }
    ideaOrb(ctx, ox, oy, 22 * (1 - 0.4 * k2), t, { color: warn > 0 && warn < 0.6 ? mix(PAL.amber, PAL.mag, Math.sin(warn / 0.6 * Math.PI)) : PAL.amber });
  } else {
    // absorbed: the head glows, rings spread
    const a = seg(u, tHit, tHit + 1.2);
    glow(ctx, dd.headX, dd.headY, 260, rgba(PAL.amber, 0.6), 0.9 * (1 - a * 0.6));
    if (a < 1) { ctx.strokeStyle = rgba(PAL.amber, 0.6 * (1 - a)); ctx.lineWidth = 5; circle(ctx, dd.headX, dd.headY, 40 + a * 260); ctx.stroke(); }
  }
  ctx.restore();
  dust(ctx, cam, t, '#b6a8ff', 0.25);
  vignette(ctx, 0.6);
  fadeBlack(ctx, 1 - seg(u, 0, 0.8));
}
function s2(ctx, u, d, t) {
  // continuous from S1: tilt up to the eye over the horizon, the pupil finds you, then we dive into it
  const tOpen = lw('welcome', 'что') - 0.1, tLock = lw('welcome', 'добро'), tTitle = lw('welcome', 'пожаловать');
  const dive = E.in3(seg(u, d - 0.75, d + 0.02));
  const prev = s1cam(Bd[1] - Bd[0]);
  const base = camKeys([{ t: 0, v: [prev.x, prev.y, prev.z, prev.r] }, { t: 1.4, v: [960, 300, 0.7, -0.01] }, { t: d - 0.75, v: [960, 170, 0.78, 0.0] }], u);
  // eye centre in screen space (layer parallax 0.8) so the dive can target the pupil
  const z8 = Math.pow(base.z, 0.8);
  const ex = W / 2 + (BIGEYE.x - (W / 2 + (base.x - W / 2) * 0.8)) * z8, ey = H / 2 + (BIGEYE.y - (H / 2 + (base.y - H / 2) * 0.8)) * z8;
  const cam = { ...base };
  const st = {
    grid: 1, look: [0, -1], mood: 'scared', arms: u > tLock ? 'up' : 'down',
    eyeLine: seg(u, 0, 0.4), eyeOpen: u < tOpen ? 0 : E.outBack(seg(u, tOpen, tOpen + 0.9), 1.2),
    lx: (1 - E.inOut(seg(u, tLock - 0.3, tLock + 0.05))) * 0.5 * Math.sin(u * 1.7), ly: 0.2 + (1 - E.inOut(seg(u, tLock - 0.3, tLock + 0.05))) * 0.3 * Math.sin(u * 1.2), slit: lerp(0.15, 0.55, E.outBack(seg(u, tLock, tLock + 0.4))),
  };
  ctx.save();
  if (dive > 0) { ctx.translate(ex, ey); ctx.scale(Math.pow(14, dive), Math.pow(14, dive)); ctx.translate(-ex, -ey); }
  hookWorld(ctx, t, cam, st);
  ctx.restore();
  const hb = seg(u, tLock, tLock + 0.9);
  if (hb > 0 && hb < 1) { ctx.strokeStyle = rgba(PAL.cyan, 0.45 * (1 - hb)); ctx.lineWidth = 6 * (1 - hb) + 1; ctx.beginPath(); ctx.ellipse(ex, ey, 300 + hb * 420, 110 + hb * 300, 0, 0, TAU); ctx.stroke(); }
  dust(ctx, cam, t, '#9fdcff', 0.25);
  const tp = seg(u, tTitle, tTitle + 1.1), tout = seg(u, d - 0.9, d - 0.55);
  if (tp > 0 && tout < 1) { ctx.save(); ctx.globalAlpha = 1 - tout; kineticWord(ctx, 'ВАСИЛИСК РОКО', 960, 690 + tout * 30, 96, tp, { glitch: true, track: 0.06, shadow: 'rgba(5,3,30,0.6)' }); ctx.restore(); }
  vignette(ctx, 0.6);
  fadeBlack(ctx, seg(u, d - 0.12, d), '2,2,14');
}
function s1cam(u) {
  const d = Bd[1] - Bd[0];
  const back = E.inOut(seg(u, lw('hook', 'ты') - 0.45, d + 0.8));
  const cam = camKeys([{ t: 0, v: [930, 700, 0.95, -0.04] }, { t: 4.0, v: [990, 620, 1.12, -0.012] }, { t: 7.6, v: [1000, 600, 1.25, 0.0] }, { t: d, v: [980, 640, 1.18, 0.006] }], u);
  cam.z *= lerp(1, 0.62, back); cam.y = lerp(cam.y, 560, back); return cam;
}

// S3 — the pupil is a monitor: July 2010, LessWrong, Roko posts a thought experiment
const SCR = { x: 980, y: 505, w: 620, h: 380 };
const GLYPHS = 'ИИРОКОLESSWRONG2010ЭКСПЕРИМЕНТ01ΣΔ#?'.split('');
const PARTS = (() => { const R = rng(5); const a = []; for (let i = 0; i < 120; i++) a.push({ g: GLYPHS[Math.floor(R() * GLYPHS.length)], sx: (R() - .5), sy: (R() - .5), vx: (R() - .5) * 2.2, vy: -0.6 - R() * 1.4, del: R() * 0.45, sz: 22 + R() * 30, rot: (R() - .5) * 3, cx1: (R() - .5) * 900, cy1: -R() * 500, sp: 0.8 + R() * 0.5 }); return a; })();
function forumCard(ctx, x, y, w, h, o = {}) {
  ctx.save(); ctx.translate(x, y);
  rrect(ctx, -w / 2, -h / 2, w, h, w * 0.025); ctx.fillStyle = '#eef0ff'; ctx.fill();
  ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, w * 0.025); ctx.clip();
  ctx.fillStyle = '#2b2275'; ctx.fillRect(-w / 2, -h / 2, w, h * 0.17);
  ctx.fillStyle = '#ffffff'; ctx.font = `700 ${h * 0.075}px Montserrat, sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.globalAlpha = o.brand ?? 1; ctx.fillText('LessWrong', -w / 2 + w * 0.05, -h / 2 + h * 0.085); ctx.globalAlpha = 1;
  ctx.textAlign = 'right'; ctx.fillStyle = PAL.amber; ctx.fillText('2010', w / 2 - w * 0.05, -h / 2 + h * 0.085);
  ctx.textAlign = 'left';
  const post = o.post ?? 1;
  if (post > 0) {
    ctx.globalAlpha = post;
    circle(ctx, -w / 2 + w * 0.085, -h / 2 + h * 0.31, h * 0.065, PAL.amber);
    ctx.fillStyle = '#2b2275'; ctx.font = `700 ${h * 0.065}px Montserrat, sans-serif`; ctx.fillText('Roko', -w / 2 + w * 0.15, -h / 2 + h * 0.31);
    ctx.fillStyle = '#7d7fb3'; ctx.font = `500 ${h * 0.045}px Montserrat, sans-serif`; ctx.fillText('новый пост', -w / 2 + w * 0.15 + h * 0.2, -h / 2 + h * 0.315);
    if (o.nameHi > 0) { ctx.save(); ctx.globalAlpha = post * o.nameHi * 0.35; rrect(ctx, -w / 2 + w * 0.14, -h / 2 + h * 0.265, h * 0.19, h * 0.09, h * 0.02); ctx.fillStyle = PAL.amber; ctx.fill(); ctx.restore(); }
    const title = 'Мысленный эксперимент'; const n = Math.floor((o.typed || 0) * title.length);
    ctx.fillStyle = '#120d40'; ctx.font = `800 ${h * 0.085}px Montserrat, sans-serif`;
    const shown = title.slice(0, n); ctx.fillText(shown, -w / 2 + w * 0.05, -h / 2 + h * 0.5);
    if ((o.typed || 0) < 1 || o.cursor) { const cw = ctx.measureText(shown).width; if (Math.floor((o.t || 0) * 3) % 2 === 0) { ctx.fillStyle = PAL.cyanD; ctx.fillRect(-w / 2 + w * 0.05 + cw + 4, -h / 2 + h * 0.45, h * 0.02, h * 0.1); } }
    [0.86, 0.78, 0.82, 0.55].forEach((b, i) => { const p = clamp((o.bars || 0) * 4 - i); if (p <= 0) return; rrect(ctx, -w / 2 + w * 0.05, -h / 2 + h * (0.62 + i * 0.085), w * b * E.out3(p), h * 0.035, h * 0.02); ctx.fillStyle = '#c9cbea'; ctx.fill(); });
    ctx.globalAlpha = 1;
  }
  if (post < 1) {
    // the feed before the post: rows of discussion threads
    ctx.globalAlpha = 1 - post;
    for (let i = 0; i < 4; i++) { const yy = -h / 2 + h * (0.27 + i * 0.18); circle(ctx, -w / 2 + w * 0.07, yy, h * 0.045, ['#5ce1ff', '#ff8fb8', '#a68cff', '#2fd6b0'][i]); rrect(ctx, -w / 2 + w * 0.13, yy - h * 0.03, w * (0.7 - i * 0.08), h * 0.035, h * 0.02); ctx.fillStyle = '#b9bce3'; ctx.fill(); rrect(ctx, -w / 2 + w * 0.13, yy + h * 0.025, w * (0.45 + i * 0.05), h * 0.025, h * 0.02); ctx.fillStyle = '#d9dbf3'; ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  if (o.dark) { ctx.fillStyle = `rgba(10,8,35,${o.dark})`; ctx.fillRect(-w / 2, -h / 2, w, h); }
  ctx.restore(); ctx.restore();
}
function wallCalendar(ctx, x, y, flip, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,20,0.3)'; rrect(ctx, -110 + 8, -130 + 10, 220, 270, 14); ctx.fill();
  rrect(ctx, -110, -130, 220, 270, 14); ctx.fillStyle = '#e9ebff'; ctx.fill();
  ctx.fillStyle = PAL.mag; rrect(ctx, -110, -130, 220, 70, 14); ctx.fill(); ctx.fillRect(-110, -90, 220, 30);
  [-60, 60].forEach(rx => { circle(ctx, rx, -130, 12, '#1a1450'); });
  const pages = [['ИЮНЬ', '2010'], ['ИЮЛЬ', '2010']];
  const cur = flip >= 1 ? 1 : 0;
  label(ctx, pages[cur][0], 0, -95, 34, { color: '#fff', weight: 900 });
  label(ctx, pages[cur][1], 0, 10, 64, { color: '#1a1450', weight: 900 });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 7; c++) { rrect(ctx, -92 + c * 26, 62 + r * 26, 18, 16, 4); ctx.fillStyle = (r * 7 + c === 9 && cur) ? PAL.amber : '#c4c7ea'; ctx.fill(); }
  if (flip > 0 && flip < 1) {
    // the old page lifts and flips over the top
    const a = flip * Math.PI; ctx.save(); ctx.translate(0, -60); ctx.scale(1, Math.cos(a)); ctx.translate(0, 60);
    rrect(ctx, -110, -60, 220, 200, 10); ctx.fillStyle = flip < 0.5 ? '#e9ebff' : '#c9cbe8'; ctx.fill();
    if (flip < 0.5) { label(ctx, pages[0][1], 0, 10, 64, { color: '#1a1450', weight: 900 }); }
    ctx.restore();
  }
  ctx.restore();
}
function room(ctx, cam, u, t, o) {
  ctx.fillStyle = '#0d0a30'; ctx.fillRect(0, 0, W, H);
  layer(ctx, 3.5, g => {
    applyCam(g, cam, 0.7);
    g.fillStyle = '#15104a'; g.fillRect(-400, -400, 2800, 1900);
    for (let s = 0; s < 3; s++) { const y = 260 + s * 150; g.fillStyle = '#21196a'; g.fillRect(1380, y, 480, 14); const R = rng(40 + s); let x = 1395; while (x < 1840) { const bw = 18 + R() * 26, bh = 60 + R() * 60; g.fillStyle = ['#2b2f8a', '#3a2272', '#1f3f80', '#4a2a7e', '#7a2a6a'][Math.floor(R() * 5)]; g.fillRect(x, y - bh, bw, bh); x += bw + 4; } }
    // window with city lights
    rrect(g, -260, 150, 300, 420, 12); g.fillStyle = '#0a0828'; g.fill();
    const R = rng(8); for (let i = 0; i < 26; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,190,100,0.6)' : 'rgba(120,140,255,0.35)'; g.fillRect(-240 + R() * 260, 330 + R() * 220, 10, 14); }
    g.fillStyle = '#15104a'; g.fillRect(-115, 150, 10, 420); g.fillRect(-260, 355, 300, 10);
  });
  ctx.save(); applyCam(ctx, cam, 0.85);
  wallCalendar(ctx, 250, 300, o.flip, t);
  ctx.restore();
  ctx.save(); applyCam(ctx, cam, 1);
  ctx.fillStyle = '#2b2275'; ctx.fillRect(220, 760, 1560, 26); ctx.fillStyle = '#1a1450'; ctx.fillRect(220, 786, 1560, 400);
  ctx.fillStyle = '#08061c'; ctx.fillRect(SCR.x - 20, SCR.y + SCR.h / 2, 40, 70); rrect(ctx, SCR.x - 120, SCR.y + SCR.h / 2 + 60, 240, 18, 9); ctx.fill();
  rrect(ctx, SCR.x - SCR.w / 2 - 18, SCR.y - SCR.h / 2 - 18, SCR.w + 36, SCR.h + 36, 18); ctx.fillStyle = '#08061c'; ctx.fill();
  ctx.fillStyle = '#0e0b36'; ctx.fillRect(SCR.x - SCR.w / 2, SCR.y - SCR.h / 2, SCR.w, SCR.h);
  ctx.save(); ctx.globalAlpha = o.cardIn; forumCard(ctx, SCR.x, SCR.y, SCR.w * 0.9, SCR.h * 0.86, { brand: o.brand, post: o.post, typed: o.typed, bars: o.bars, nameHi: o.nameHi, t: u }); ctx.restore();
  glow(ctx, SCR.x, SCR.y, 720, rgba(PAL.cyanD, 0.55), 0.55 * o.cardIn);
  // mug + keyboard
  rrect(ctx, 1300, 700, 60, 64, 10); ctx.fillStyle = PAL.mag; ctx.fill(); ctx.strokeStyle = PAL.mag; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(1362, 730, 18, -1.2, 1.2); ctx.stroke();
  for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(255,255,255,${0.25 * Math.sin(t * 2 + k) + 0.25})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(1315 + k * 15, 690); ctx.quadraticCurveTo(1305 + k * 15 + 10 * Math.sin(t * 3 + k), 660, 1320 + k * 15, 630); ctx.stroke(); }
  rrect(ctx, 790, 744, 300, 18, 6); ctx.fillStyle = '#3d33a0'; ctx.fill();
  // Roko from behind: hoodie, typing
  const typing = o.typing; const bob = Math.sin(u * 16) * 2 * typing;
  ctx.save(); ctx.translate(560, 760);
  rrect(ctx, -110, -330, 70, 330, 20); ctx.fillStyle = '#1f1858'; ctx.fill();
  rrect(ctx, -60, -300 + bob, 190, 300, 80); ctx.fillStyle = '#3d5ab8'; ctx.fill();
  ctx.fillStyle = 'rgba(0,0,20,0.22)'; rrect(ctx, -60, -300 + bob, 80, 300, 60); ctx.fill();
  ctx.strokeStyle = '#3d5ab8'; ctx.lineWidth = 44; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(90, -210 + bob); ctx.quadraticCurveTo(220, -120, 300, -18 + Math.sin(u * 22) * 3 * typing); ctx.stroke();
  circle(ctx, 300, -18 + Math.sin(u * 22) * 3 * typing, 22, PAL.skin);
  circle(ctx, 40, -360 + bob, 78, PAL.skin);
  ctx.save(); circle(ctx, 40, -360 + bob, 78); ctx.clip(); circle(ctx, 10, -400 + bob, 92, '#3d5ab8'); ctx.restore(); // hood up
  circle(ctx, 96, -350 + bob, 14, PAL.skinD);
  ctx.restore();
  glow(ctx, 760, 520, 260, rgba(PAL.cyan, 0.35), 0.5 * o.cardIn);
  // the idea appears in a thought bubble over Roko
  if (o.idea > 0) {
    const p = o.idea; const bx = 640, by = 190;
    ctx.save(); ctx.globalAlpha *= clamp(p * 2);
    [[575, 330, 10], [600, 290, 16]].forEach(([x, y, r], i) => circle(ctx, x, y, r * clamp(p * 3 - i), '#e9ebff'));
    ctx.translate(bx, by); ctx.scale(E.outBack(clamp(p * 1.4)), E.outBack(clamp(p * 1.4)));
    ctx.beginPath(); [[-60, 0, 60], [0, -30, 70], [60, 0, 60], [0, 30, 60]].forEach(([x, y, r]) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }); ctx.fillStyle = '#e9ebff'; ctx.fill();
    ctx.restore();
    ideaOrb(ctx, bx, by - 4, 26 * E.outBack(clamp((p - 0.3) * 2)), t);
  }
  ctx.restore();
  // chat bubbles of the debate around the screen
  if (o.chat > 0) {
    const B = [['ИИ опасен?', 1500, 250, '#5ce1ff'], ['Когда появится сверхразум?', 1450, 390, '#ff8fb8'], ['А если он решит…', 1530, 640, '#a68cff']];
    ctx.save(); applyCam(ctx, cam, 1.08);
    B.forEach(([txt, x, y, c], i) => {
      const p = pop(o.chat, i * 0.18, 0.3, 2) * (1 - seg(o.chatOut, i * 0.1, i * 0.1 + 0.3));
      if (p <= 0) return;
      ctx.save(); ctx.translate(x, y + Math.sin(t * 1.5 + i) * 5); ctx.scale(p, p);
      ctx.font = '700 30px Montserrat, sans-serif'; const w = ctx.measureText(txt).width + 50;
      ctx.fillStyle = 'rgba(0,0,20,0.3)'; rrect(ctx, -w / 2 + 5, -32 + 7, w, 64, 32); ctx.fill();
      rrect(ctx, -w / 2, -32, w, 64, 32); ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-w / 2 + 30, 26); ctx.lineTo(-w / 2 + 10, 50); ctx.lineTo(-w / 2 + 55, 28); ctx.fill();
      label(ctx, txt, 0, 2, 30, { color: '#120d40', weight: 700, font: 'Montserrat' });
      ctx.restore();
    });
    ctx.restore();
  }
  layer(ctx, 9, g => {
    applyCam(g, cam, 1.4);
    g.strokeStyle = '#08061c'; g.lineWidth = 34; g.lineCap = 'round'; g.beginPath(); g.moveTo(1880, 1100); g.lineTo(1760, 640); g.lineTo(1600, 470); g.stroke();
    g.save(); g.translate(1600, 470); g.rotate(-0.5); rrect(g, -110, -40, 220, 90, 40); g.fillStyle = '#0d0a2a'; g.fill(); g.restore();
    glow(g, 1560, 560, 380, rgba(PAL.amber, 0.5), 0.7);
    circle(g, 120, 1060, 160, '#08061c');
  });
}
function glyphFly(ctx, u0, sizeMul, alpha) {
  for (const p of PARTS) {
    const k = clamp((u0 - p.del) * p.sp); if (k <= 0) continue;
    const e = E.in2(k);
    const x = W / 2 + p.sx * 300 + p.vx * 700 * e, y = H * 0.47 + p.sy * 180 + p.vy * 900 * e;
    const s = p.sz * sizeMul * (1 + e * 2.6);
    ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot * e); ctx.globalAlpha = alpha * clamp(k * 4) * (1 - seg(k, 0.85, 1));
    ctx.font = `800 ${s}px Montserrat, sans-serif`; ctx.fillStyle = PAL.ice; ctx.textAlign = 'center'; ctx.fillText(p.g, 0, 0); ctx.restore();
  }
}
function s3(ctx, u, d, t) {
  const L = (id, n = 0) => lw('forum', id, n);
  const cam = camKeys([{ t: 0, v: [SCR.x, SCR.y, 3.25, 0] }, { t: 1.0, v: [900, 520, 1.45, -0.012] }, { t: L('спорили'), v: [1050, 500, 1.2, 0.006] }, { t: L('Пользователь'), v: [880, 540, 1.18, -0.01] }, { t: d - 0.7, v: [840, 470, 1.32, -0.016] }, { t: d, v: [930, 470, 1.4, -0.01] }], u);
  room(ctx, cam, u, t, {
    flip: seg(u, L('Июль') - 0.1, L('Июль') + 0.45), cardIn: E.out3(seg(u, L('Форум') - 0.4, L('Форум') + 0.2)), brand: seg(u, L('LessWrong') - 0.2, L('LessWrong') + 0.2),
    post: E.inOut(seg(u, L('Пользователь') - 0.2, L('Пользователь') + 0.4)), nameHi: Math.sin(clamp((u - L('Роко') + 0.1) / 0.9) * Math.PI),
    typed: seg(u, L('публикует'), L('эксперимент') + 0.5), bars: seg(u, L('эксперимент') + 0.3, L('эксперимент') + 1.0),
    typing: u > L('Пользователь') && u < L('эксперимент') + 0.6 ? 1 : 0.2,
    chat: u - L('спорили') + 0.2, chatOut: u - L('Пользователь') + 0.4, idea: seg(u, L('мысленный'), L('эксперимент') + 0.6),
  });
  const fly = u - (d - 0.75);
  if (fly > 0) { glyphFly(ctx, fly * 1.4, 1, 1); fadeBlack(ctx, E.in2(seg(u, d - 0.3, d)) * 0.85, '5,4,25'); }
  vignette(ctx, 0.5);
  fadeBlack(ctx, 1 - seg(u, 0, 0.18), '2,2,14');
}

// S4 — the idea builds a superintelligence over the city; it wants to make the world better
const CITY = (() => {
  const far = [], mid = [], R = rng(21);
  let x = -1400; while (x < 3400) { const w = 70 + R() * 140, h = 160 + R() * 360; far.push({ x, w, h }); x += w + 6; }
  x = -1300; while (x < 3300) { const w = 110 + R() * 170, h = 120 + R() * 300; const wins = []; for (let yy = 30; yy < h - 30; yy += 38) for (let xx = 18; xx < w - 24; xx += 32) if (R() < 0.42) wins.push({ x: xx, y: yy, lit: R() < 0.55, ph: R() * TAU }); mid.push({ x, w, h, wins }); x += w + 14; }
  const crowd = []; for (let i = 0; i < 34; i++) crowd.push({ x: 120 + i * 50 + (R() - .5) * 20, h: 62 + R() * 26, knew: R() < 0.42, c: ['#7aa2ff', '#ffb547', '#ff8fb8', '#2fd6b0', '#a68cff'][Math.floor(R() * 5)], ph: R() * TAU });
  return { far, mid, crowd };
})();
const WIN = { x: 705, y: 760 };
const CORE = { x: 960, y: 330 };
function city(ctx, cam, t, o = {}) {
  layer(ctx, 2.5, g => {
    applyCam(g, cam, 0.55); g.translate(0, (o.drop || 0) * 0.6);
    g.fillStyle = '#1d1660'; for (const b of CITY.far) g.fillRect(b.x, 1010 - b.h, b.w, b.h + 400);
  });
  ctx.save(); applyCam(ctx, cam, 0.8); ctx.translate(0, (o.drop || 0) * 0.8);
  const warm = o.warm || 0;
  for (const b of CITY.mid) {
    ctx.fillStyle = '#140f45'; ctx.fillRect(b.x, 1000 - b.h, b.w, b.h + 400);
    ctx.fillStyle = 'rgba(0,0,20,0.25)'; ctx.fillRect(b.x + b.w * 0.6, 1000 - b.h, b.w * 0.4, b.h + 400);
    for (const w of b.wins) { const lit = w.lit || (warm > 0 && Math.sin(w.ph) < warm * 2 - 1); ctx.fillStyle = lit ? 'rgba(255,190,100,0.8)' : 'rgba(100,110,200,0.25)'; ctx.fillRect(b.x + w.x, 1000 - b.h + w.y, 14, 18); }
  }
  if (o.window) { ctx.fillStyle = PAL.ice; ctx.fillRect(WIN.x - 10, WIN.y - 12, 20, 24); glow(ctx, WIN.x, WIN.y, 90, rgba(PAL.cyan, 0.8), 0.9 * o.window); }
  ctx.restore();
  ctx.save(); applyCam(ctx, cam, 1); ctx.translate(0, o.drop || 0);
  ctx.fillStyle = '#0c0930'; ctx.fillRect(-1600, 985, 5200, 900);
  ctx.fillStyle = '#2b2275'; ctx.fillRect(-1600, 985, 5200, 6);
  for (const p of CITY.crowd) {
    let col = p.c, sq = 1 + 0.03 * Math.sin(t * 5 + p.ph), mark = 0;
    if (o.sweep && p.knew) { const hit = o.sweep(p.x); if (hit > 0) { col = mix(p.c, PAL.mag, clamp(hit * 3)); sq = 1 + 0.25 * Math.sin(clamp(hit * 2) * Math.PI) * (1 - clamp(hit)); mark = E.outBack(clamp(hit * 2.5)); } }
    mini(ctx, p.x, 985, p.h, col, { squash: sq });
    if (o.hearts > 0) { const k = ((t * 0.5 + p.ph) % 1) * clamp(o.hearts * 2); if (k > 0) { ctx.save(); ctx.globalAlpha = Math.sin(k * Math.PI) * clamp(o.hearts * 2); heart(ctx, p.x + Math.sin(k * 6 + p.ph) * 10, 985 - p.h - 30 - k * 160, 12 + 6 * Math.sin(p.ph), PAL.pink); ctx.restore(); } }
    if (mark > 0) { ctx.save(); ctx.translate(p.x, 985 - p.h - 30); ctx.scale(mark, mark); label(ctx, '!', 0, 0, 38, { color: PAL.mag, weight: 900 }); ctx.restore(); }
  }
  ctx.restore();
}
function heart(ctx, x, y, r, c) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, r * 0.9);
  ctx.bezierCurveTo(-r * 1.6, -r * 0.2, -r * 0.8, -r * 1.3, 0, -r * 0.45); ctx.bezierCurveTo(r * 0.8, -r * 1.3, r * 1.6, -r * 0.2, 0, r * 0.9); ctx.fill(); ctx.restore();
}
function virus(ctx, x, y, r, t, burst) {
  if (burst >= 1) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.6);
  if (burst > 0) { const R = rng(3); for (let i = 0; i < 18; i++) { const a = R() * TAU, s = r * (1 + burst * (2 + R() * 3)); ctx.globalAlpha = 1 - burst; circle(ctx, Math.cos(a) * s, Math.sin(a) * s, 6 * (1 - burst) + 2, i % 2 ? PAL.ice : '#9dff9a'); } ctx.restore(); return; }
  ctx.strokeStyle = '#6ed36a'; ctx.lineWidth = r * 0.14; for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45); ctx.stroke(); circle(ctx, Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5, r * 0.14, '#9dff9a'); }
  ball(ctx, 0, 0, r, '#4fb84a', 'rgba(0,40,10,0.4)', null, -0.9);
  circle(ctx, -r * 0.3, r * 0.2, r * 0.18, '#2f8a2c'); circle(ctx, r * 0.3, -r * 0.25, r * 0.14, '#2f8a2c');
  ctx.restore();
}
function hourglass(ctx, x, y, s, t, frozen) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#c99a5a'; rrect(ctx, -70, -110, 140, 18, 6); ctx.fill(); rrect(ctx, -70, 92, 140, 18, 6); ctx.fill();
  ctx.fillStyle = 'rgba(200,230,255,0.25)'; ctx.beginPath(); ctx.moveTo(-55, -92); ctx.lineTo(55, -92); ctx.lineTo(8, 0); ctx.lineTo(55, 92); ctx.lineTo(-55, 92); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
  const lvl = frozen > 0 ? 0.45 : 0.45 + 0.1 * Math.sin(t);
  ctx.fillStyle = PAL.amber; ctx.beginPath(); ctx.moveTo(-55 * lvl, -92 * lvl + 0); ctx.lineTo(55 * lvl, -92 * lvl); ctx.lineTo(4, -4); ctx.lineTo(-4, -4); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-50, 92); ctx.lineTo(50, 92); ctx.lineTo(0, 40); ctx.fill();
  if (frozen < 1) { ctx.fillStyle = PAL.amber; ctx.globalAlpha = 1 - frozen; ctx.fillRect(-2, -4, 4, 90); ctx.globalAlpha = 1; }
  if (frozen > 0) { ctx.globalAlpha = frozen; ctx.fillStyle = 'rgba(190,240,255,0.8)'; for (let k = 0; k < 6; k++) { ctx.save(); ctx.rotate(k * TAU / 6); ctx.fillRect(-2, -26, 4, 52); ctx.restore(); } ctx.globalAlpha = 1; }
  ctx.restore();
}
function s4cam(u, d) {
  const L = (id, n = 0) => lw('superintelligence', id, n);
  return camKeys([{ t: 0, v: [960, 760, 1.32, 0.02] }, { t: 1.9, v: [960, 560, 1.0, 0.0] }, { t: L('Машину'), v: [960, 520, 0.92, -0.008] }, { t: L('взятого') + 0.4, v: [960, 470, 0.6, 0.004] }, { t: L('лучше'), v: [980, 470, 0.66, 0.0] }, { t: d, v: [960, 480, 0.72, -0.01] }], u);
}
function s4(ctx, u, d, t) {
  const L = (id, n = 0) => lw('superintelligence', id, n);
  const cam = s4cam(u, d);
  const warm = E.inOut(seg(u, L('делать') - 0.2, L('лучше') + 0.4));
  sky(ctx, cam, t, { top: mix(PAL.bg0, '#1c1460', warm), bot: mix(PAL.bg1, '#5a2a7e', warm) });
  city(ctx, cam, t, { window: 1 - seg(u, 2, 3), warm: seg(u, L('миллиарды') - 0.3, L('жизней') + 0.3), hearts: seg(u, L('миллиарды'), L('жизней') + 0.4) });
  ctx.save(); applyCam(ctx, cam, 1);
  for (let i = 0; i < PARTS.length; i++) {
    const p = PARTS[i]; const k = clamp((u - p.del * 1.6) / 1.05); if (k <= 0 || k >= 1) continue;
    const e = E.inOut2(k);
    const ax = WIN.x, ay = WIN.y, bx = CORE.x, by = CORE.y, cx = (ax + bx) / 2 + p.cx1, cy = (ay + by) / 2 + p.cy1;
    const x = (1 - e) * (1 - e) * ax + 2 * (1 - e) * e * cx + e * e * bx, y = (1 - e) * (1 - e) * ay + 2 * (1 - e) * e * cy + e * e * by;
    ctx.globalAlpha = Math.sin(k * Math.PI); ctx.font = `800 ${p.sz * 0.7}px Montserrat, sans-serif`; ctx.fillStyle = PAL.ice; ctx.textAlign = 'center'; ctx.fillText(p.g, x, y);
  }
  ctx.globalAlpha = 1;
  const grow = E.outBack(seg(u, L('сверхразум') - 0.9, L('сверхразум') + 0.3)) * lerp(1, 1.9, E.inOut(seg(u, L('умнее'), L('взятого') + 0.4)));
  // warm rays when its goal is "to make the world better"
  if (warm > 0) { ctx.save(); ctx.translate(CORE.x, CORE.y); ctx.rotate(t * 0.05); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 14; k++) { ctx.rotate(TAU / 14); ctx.fillStyle = rgba(PAL.amber, 0.06 * warm); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1800, -90); ctx.lineTo(1800, 90); ctx.fill(); } ctx.restore(); }
  aiCore(ctx, CORE.x, CORE.y, grow, t, { grow: 1, eye: E.out3(seg(u, L('сверхразум') - 0.2, L('сверхразум') + 0.4)), rings: seg(u, L('сверхразум') - 0.6, L('сверхразум') + 0.4), warm, look: [0, 0.5] });
  ctx.restore();
  // scale labels: humanity vs superintelligence
  const lab = seg(u, L('человечества') - 0.2, L('человечества') + 0.3) * (1 - seg(u, L('цель'), L('цель') + 0.4));
  if (lab > 0) {
    const sx = x => W / 2 + (x - cam.x) * cam.z, sy = y => H / 2 + (y - cam.y) * cam.z;
    ctx.save(); ctx.globalAlpha = lab;
    ctx.strokeStyle = PAL.white; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx(80), sy(1050)); ctx.lineTo(sx(80), sy(1070)); ctx.lineTo(sx(1840), sy(1070)); ctx.lineTo(sx(1840), sy(1050)); ctx.stroke();
    label(ctx, 'ВСЁ ЧЕЛОВЕЧЕСТВО', sx(960), sy(1070) + 40, 30, { color: PAL.white });
    label(ctx, 'СВЕРХРАЗУМ', sx(CORE.x), sy(CORE.y) + 240 * cam.z * 1.9, 40, { color: '#120d40', bg: PAL.cyan });
    ctx.restore();
  }
  // goal icons: disease defeated, ageing stopped
  ctx.save(); applyCam(ctx, cam, 1.05);
  const vp = pop(u, L('побеждать') - 0.8, 0.45), vb = seg(u, L('болезни') + 0.35, L('болезни') + 1.1);
  if (vp > 0) { ctx.save(); ctx.translate(460, 300); ctx.scale(vp, vp); virus(ctx, 0, 0, 120, t, vb); ctx.restore(); if (vb > 0 && vb < 0.5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(PAL.amber, 0.8 * (1 - vb * 2)); ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(CORE.x, CORE.y); ctx.lineTo(460, 300); ctx.stroke(); ctx.restore(); } }
  const hp = pop(u, L('остановить') - 0.5, 0.45);
  if (hp > 0) { ctx.save(); ctx.translate(1500, 300); ctx.scale(hp * 1.7, hp * 1.7); ctx.rotate(Math.sin(t) * 0.05); hourglass(ctx, 0, 0, 1, t, seg(u, L('старение'), L('старение') + 0.4)); ctx.restore(); }
  ctx.restore();
  dust(ctx, cam, t, warm > 0.5 ? '#ffd9a0' : '#9fdcff', 0.22);
  vignette(ctx, 0.55);
  fadeBlack(ctx, (1 - seg(u, 0, 0.22)) * 0.85, '5,4,25');
}

// S5 — 170 000 people die every day; for such a mind every day of delay costs lives → it wants to exist sooner
function earth(ctx, x, y, r, t, o = {}) {
  glow(ctx, x, y, r * 1.6, rgba('#3a8bff', 0.5), 0.8);
  ctx.save(); circle(ctx, x, y, r); ctx.clip();
  ctx.fillStyle = '#2a6ee0'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  const rot = t * 18 + (o.rot || 0);
  const LAND = [[-0.5, -0.35, 0.42, 0.22], [0.1, -0.1, 0.3, 0.38], [-0.2, 0.45, 0.35, 0.16], [0.55, 0.3, 0.2, 0.25], [-0.9, 0.1, 0.25, 0.3]];
  for (let rep = -1; rep <= 1; rep++) for (const [lx, ly, lw2, lh] of LAND) {
    const cx = x + ((lx * r + rot + rep * 2.6 * r) % (2.6 * r)) , cy = y + ly * r;
    ctx.fillStyle = '#3fcf7a'; ctx.beginPath(); ctx.ellipse(cx, cy, lw2 * r, lh * r, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2fae66'; ctx.beginPath(); ctx.ellipse(cx + lw2 * r * 0.25, cy + lh * r * 0.2, lw2 * r * 0.6, lh * r * 0.55, 0.3, 0, TAU); ctx.fill();
  }
  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let k = 0; k < 7; k++) { const cx = x - r + ((k * 0.37 * r * 2 + t * 30) % (2.4 * r)), cy = y + Math.sin(k * 2.1) * r * 0.7; rrect(ctx, cx, cy, r * 0.35, r * 0.06, r * 0.03); ctx.fill(); }
  // night side
  ctx.fillStyle = 'rgba(8,6,40,0.55)'; ctx.beginPath(); ctx.arc(x + r * 0.55, y + r * 0.2, r * 1.15, 0, TAU); ctx.fill();
  // city lights on the night side; some go out
  const R = rng(55);
  for (let i = 0; i < 60; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * r * 0.95; const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    if (px < x + r * 0.05) continue;
    const off = (o.out || 0) > R(); if (off) continue;
    circle(ctx, px, py, 2.5 + R() * 2, rgba(PAL.amber, 0.9));
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(140,200,255,0.5)'; ctx.lineWidth = r * 0.03; circle(ctx, x, y, r * 1.01); ctx.stroke();
}
const DAYX0 = 1100, DAYW = 150, DAYS = 13, TL_Y = 860;
function s5cam(u, d) {
  const L = (id, n = 0) => lw('every_day', id, n);
  return camKeys([{ t: 0, v: [900, 560, 1.15, -0.01] }, { t: L('человек'), v: [1000, 560, 1.0, 0.0] }, { t: L('каждый', 1), v: [1500, 700, 0.85, 0.008] }, { t: L('предотвратить') + 0.4, v: [1900, 720, 0.72, 0.0] }, { t: d, v: [1700, 660, 0.66, -0.006] }], u);
}
function s5(ctx, u, d, t) {
  const L = (id, n = 0) => lw('every_day', id, n);
  const cam = s5cam(u, d);
  sky(ctx, cam, t, { dim: 0.8 });
  ctx.save(); applyCam(ctx, cam, 0.9);
  earth(ctx, 620, 520, 300, t, { out: 0.45 * seg(u, L('умирают'), L('человек') + 1.5) });
  ctx.restore();
  // big counter
  const cnt = Math.round(170000 * E.out3(seg(u, L('около') - 0.1, L('тысяч') + 0.35)) / 10) * 10;
  const ca = seg(u, L('около') - 0.3, L('около')) * (1 - seg(u, L('каждый', 1) + 0.6, L('каждый', 1) + 1.2));
  if (ca > 0) {
    ctx.save(); applyCam(ctx, cam, 1); ctx.globalAlpha = ca;
    label(ctx, cnt.toLocaleString('ru-RU'), 1350, 470, 150, { color: PAL.white, weight: 900, shadow: 'rgba(5,3,30,0.6)' });
    label(ctx, 'ЧЕЛОВЕК В ДЕНЬ', 1350, 590, 42, { color: PAL.amber, weight: 800 });
    ctx.restore();
  }
  // the timeline of days until the AI arrives
  const tlA = seg(u, L('Для') - 0.3, L('Для') + 0.3);
  ctx.save(); applyCam(ctx, cam, 1);
  const move = E.inOut(seg(u, L('выгодно') - 0.2, L('раньше') + 0.3));
  const coreX = lerp(DAYX0 + DAYS * DAYW + 160, DAYX0 + 4.5 * DAYW, move);
  if (tlA > 0) {
    ctx.globalAlpha = tlA;
    ctx.strokeStyle = '#8f8ad8'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(DAYX0 - 160, TL_Y + 90); ctx.lineTo(DAYX0 + DAYS * DAYW + 420, TL_Y + 90); ctx.stroke();
    label(ctx, 'СЕЙЧАС', DAYX0 - 60, TL_Y + 150, 30, { color: '#c9c6ff' });
    for (let i = 0; i < DAYS; i++) {
      const x = DAYX0 + i * DAYW; const ap = pop(u, L('каждый', 1) + i * 0.09, 0.3, 2);
      if (ap <= 0) continue;
      const lost = seg(u, L('смерти') - 0.2 + i * 0.07, L('смерти') + 0.3 + i * 0.07), saved = x + DAYW / 2 > coreX ? E.out3(seg(u, L('выгодно') + (x - DAYX0) / 1800, L('выгодно') + 0.4 + (x - DAYX0) / 1800)) : 0;
      ctx.save(); ctx.translate(x + DAYW / 2, TL_Y); ctx.scale(ap, ap);
      const base = saved > 0 ? mix('#5b567e', PAL.amber, saved) : mix('#e9ebff', '#5b567e', lost);
      ctx.fillStyle = 'rgba(0,0,20,0.3)'; rrect(ctx, -58, -62, 124, 132, 14); ctx.fill();
      rrect(ctx, -62, -70, 124, 132, 14); ctx.fillStyle = base; ctx.fill();
      ctx.fillStyle = saved > 0.5 ? PAL.amberD : PAL.mag; rrect(ctx, -62, -70, 124, 30, 14); ctx.fill(); ctx.fillRect(-62, -52, 124, 12);
      label(ctx, 'ДЕНЬ', 0, -55, 16, { color: '#fff', weight: 800 });
      label(ctx, String(i + 1), 0, 0, 46, { color: saved > 0.5 ? '#3a1f00' : (lost > 0.5 ? '#c9c6ff' : '#1a1450'), weight: 900 });
      if (lost > 0) label(ctx, saved > 0.5 ? 'спасены' : '−170 тыс.', 0, 42, 17, { color: saved > 0.5 ? '#3a1f00' : '#e9e6ff', weight: 700, font: 'Montserrat', alpha: lost });
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // the AI waits at the end of the line, then slides toward "now"
  if (tlA > 0) {
    aiCore(ctx, coreX, TL_Y - 40, 0.42 * tlA, t, { eye: 1, rings: 1, look: [-0.8, 0.2] });
    const ar = seg(u, L('как') - 0.2, L('раньше') + 0.2);
    if (ar > 0) { kineticWord(ctx, '← РАНЬШЕ', coreX, TL_Y - 280, 76, ar, { color: PAL.amber, shadow: 'rgba(5,3,30,0.6)' }); }
    ctx.globalAlpha = 1; label(ctx, 'ПОЯВЛЕНИЕ СВЕРХРАЗУМА', coreX, TL_Y + 150, 26, { color: PAL.cyan, alpha: tlA });
  }
  ctx.restore();
  dust(ctx, cam, t, '#9fdcff', 0.2);
  vignette(ctx, 0.5);
}

// S6 — the twist: it punishes those who knew but did not help; the threat itself makes the past work faster
const PAST = [
  { x: 240, knew: 0, idle: 0, c: '#7aa2ff' }, { x: 380, knew: 1, idle: 1, c: '#ff8fb8' }, { x: 520, knew: 1, idle: 0, c: '#2fd6b0' }, { x: 660, knew: 0, idle: 1, c: '#ffb547' },
  { x: 800, knew: 1, idle: 1, c: '#a68cff' }, { x: 940, knew: 1, idle: 1, c: '#5ce1ff' }, { x: 1080, knew: 0, idle: 0, c: '#ff9a6b' },
];
const FUT = { x: 1560, y: 400 };
function gear(ctx, x, y, r, rot, c) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = c;
  ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; ctx.rect(Math.cos(a) * r - 0, Math.sin(a) * r - 0, 0, 0); }
  for (let k = 0; k < 10; k++) { ctx.save(); ctx.rotate(k / 10 * TAU); ctx.fillRect(-r * 0.16, -r * 1.25, r * 0.32, r * 0.4); ctx.restore(); }
  circle(ctx, 0, 0, r, c); circle(ctx, 0, 0, r * 0.4, '#1a1450'); ctx.restore();
}
function s6(ctx, u, d, t) {
  const L = (id, n = 0) => lw('threat', id, n);
  const turn = E.inOut(seg(u, L('жуткий') - 0.2, L('поворот') + 0.3));
  const cam0 = camKeys([{ t: 0, v: [1100, 560, 0.85, 0.0] }, { t: L('поворот') + 0.3, v: [1080, 560, 0.95, 0.03] }, { t: L('знал'), v: [800, 600, 1.0, 0.01] }, { t: L('злобы'), v: [1300, 500, 1.05, -0.01] }, { t: L('угроза'), v: [1050, 560, 0.92, 0.0] }, { t: d, v: [800, 620, 1.0, 0.01] }], u);
  const cam = { ...cam0, x: cam0.x + shake(u, L('поворот'), 10, 6) };
  sky(ctx, cam, t, { top: mix(PAL.bg0, '#1a0620', turn), bot: mix(PAL.bg1, '#4a0f3a', turn), neb: turn > 0.5 ? '#7a1040' : undefined, dim: 0.8 });
  ctx.save(); applyCam(ctx, cam, 1);
  // time axis
  ctx.strokeStyle = 'rgba(200,190,255,0.5)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(120, 1010); ctx.lineTo(1900, 1010); ctx.stroke();
  ctx.fillStyle = 'rgba(200,190,255,0.5)'; ctx.beginPath(); ctx.moveTo(1930, 1010); ctx.lineTo(1890, 988); ctx.lineTo(1890, 1032); ctx.fill();
  label(ctx, 'ПРОШЛОЕ', 300, 1060, 28, { color: '#c9c6ff' }); label(ctx, 'БУДУЩЕЕ', 1700, 1060, 28, { color: '#c9c6ff' });
  // ground for the past
  rrect(ctx, 150, 880, 1020, 40, 20); ctx.fillStyle = '#2b2275'; ctx.fill();
  const scan0 = L('всех'), scanD = 1.6, mark0 = L('помог'), work0 = L('работать') - 0.5;
  const sig = seg(u, L('угроза') - 0.1, L('заставила') + 0.4);
  PAST.forEach((p, i) => {
    const hit = p.knew ? seg(u, scan0 + (p.x - 200) / 1000 * scanD, scan0 + (p.x - 200) / 1000 * scanD + 0.3) : 0;
    const marked = p.knew && p.idle ? E.outBack(seg(u, mark0 - 0.1 + i * 0.05, mark0 + 0.25 + i * 0.05), 2) : 0;
    const working = seg(u, work0 + (1100 - p.x) / 2000, work0 + 0.25 + (1100 - p.x) / 2000);
    const jump = working > 0 && working < 1 ? Math.sin(working * Math.PI) * 40 : 0;
    const idle = p.idle && working <= 0;
    dude(ctx, p.x, 880 - jump, 150, t, { body: p.c, mood: idle ? 'sleep' : (marked > 0 && working <= 0 ? 'scared' : (working > 0 ? 'happy' : 'calm')), arms: working > 0 || (!p.idle) ? 'work' : 'down', lean: idle ? -0.12 : 0, seed: i * 0.13, look: [0.6, -0.2] });
    if (idle && u > 0.5) for (let z = 0; z < 2; z++) { const k = ((u * 0.5 + z / 2 + i * 0.3) % 1); ctx.save(); ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8; label(ctx, 'z', p.x + 30 + k * 40, 690 - k * 70, 26 + z * 8, { color: '#c9c6ff' }); ctx.restore(); }
    if (p.knew) bulb(ctx, p.x, 660 - jump, 20, mix(PAL.amber, PAL.mag, marked * (1 - working)), seg(u, L('знал') - 0.2, L('знал') + 0.2) * 0.9 + hit * 0.1);
    if (marked > 0 && working < 1) {
      ctx.save(); ctx.translate(p.x, 790 - jump); ctx.scale(marked, marked); ctx.globalAlpha = 1 - working;
      ctx.strokeStyle = PAL.mag; ctx.lineWidth = 6; circle(ctx, 0, 0, 70); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-95, 0); ctx.lineTo(-45, 0); ctx.moveTo(95, 0); ctx.lineTo(45, 0); ctx.moveTo(0, -95); ctx.lineTo(0, -45); ctx.moveTo(0, 95); ctx.lineTo(0, 45); ctx.stroke(); ctx.restore();
    }
    if (working > 0) { gear(ctx, p.x - 40, 600 - jump, 22, t * 9 * working, '#8f8ad8'); gear(ctx, p.x + 4, 585 - jump, 14, -t * 14 * working, '#c9c6ff'); }
  });
  // scan beam from the future
  const sp = (u - scan0) / scanD;
  if (sp > -0.05 && sp < 1.2) {
    const bx = lerp(200, 1100, clamp(sp)); const a = Math.min(seg(sp, -0.05, 0.08), 1 - seg(sp, 1, 1.2));
    const g = ctx.createLinearGradient(FUT.x, FUT.y, bx, 880); g.addColorStop(0, rgba(PAL.mag, 0)); g.addColorStop(0.3, rgba(PAL.mag, 0.35)); g.addColorStop(1, rgba(PAL.mag, 0.2));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(FUT.x, FUT.y + 30); ctx.lineTo(bx - 80, 880); ctx.lineTo(bx + 80, 880); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // "not out of malice": the eye calms, a pill says it's arithmetic
  const calm = Math.sin(clamp((u - L('злобы') + 0.5) / 1.3) * Math.PI);
  aiCore(ctx, FUT.x, FUT.y, 0.9, t, { tint: turn * (1 - 0.7 * calm), slit: lerp(0.15, 0.5, calm), look: [-0.6, 0.4] });
  if (calm > 0.01) { ctx.save(); ctx.globalAlpha = calm; label(ctx, 'не злость — расчёт', FUT.x, FUT.y - 360, 34, { color: '#120d40', bg: PAL.ice, weight: 700, font: 'Montserrat' }); ctx.restore(); }
  // the threat travels back in time
  if (sig > 0 && sig < 1) {
    const x = lerp(FUT.x - 100, 700, E.inOut(sig)), y = lerp(FUT.y + 100, 560, E.inOut(sig)) - Math.sin(sig * Math.PI) * 140;
    for (let k = 1; k < 6; k++) { const s2_ = clamp(sig - k * 0.03); circle(ctx, lerp(FUT.x - 100, 700, E.inOut(s2_)), lerp(FUT.y + 100, 560, E.inOut(s2_)) - Math.sin(s2_ * Math.PI) * 140, 18 - k * 2.5, rgba(PAL.mag, 0.5 - k * 0.08)); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.2 + sig * 0.3);
    rrect(ctx, -60, -40, 120, 80, 10); ctx.fillStyle = PAL.mag; ctx.fill(); ctx.strokeStyle = '#ffd2dc'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-60, -38); ctx.lineTo(0, 8); ctx.lineTo(60, -38); ctx.stroke();
    label(ctx, '!', 0, 8, 40, { color: '#fff', weight: 900 }); ctx.restore();
  }
  // progress toward the AI speeds up
  const pb = seg(u, L('работать') - 0.6, d);
  if (pb > 0) {
    ctx.save(); ctx.globalAlpha = seg(pb, 0, 0.15);
    rrect(ctx, 260, 470, 760, 36, 18); ctx.fillStyle = '#1a1450'; ctx.fill();
    rrect(ctx, 260, 470, 760 * E.in2(pb) * 0.95 + 20, 36, 18); ctx.fillStyle = PAL.cyan; ctx.fill();
    label(ctx, 'ПРОГРЕСС К СВЕРХРАЗУМУ', 640, 430, 26, { color: PAL.ice });
    ctx.restore();
  }
  ctx.restore();
  dust(ctx, cam, t, turn > 0.5 ? '#ff9ab3' : '#9fdcff', 0.2);
  vignette(ctx, 0.6);
}

// S7 — the dead can be "punished" through a perfect digital copy. Who says it isn't you?
const POD = { x: 1280, y: 560 };
function s7(ctx, u, d, t) {
  const L = (id, n = 0) => lw('copy', id, n);
  const cam = camKeys([{ t: 0, v: [880, 600, 0.95, 0.0] }, { t: L('умер') + 0.4, v: [820, 640, 1.08, -0.01] }, { t: L('воссоздать'), v: [1040, 560, 1.0, 0.0] }, { t: L('копию') + 0.3, v: [1200, 560, 1.12, 0.01] }, { t: L('кто', 1), v: [1270, 600, 1.75, 0.0] }, { t: d, v: [1280, 612, 2.3, 0.0] }], u);
  sky(ctx, cam, t, { top: '#0a0620', bot: '#24164a', dim: 0.6 * (1 - 0.6 * seg(u, L('кто', 1) - 0.6, L('кто', 1) + 0.4)) });
  ctx.save(); applyCam(ctx, cam, 1);
  ctx.fillStyle = '#140f40'; ctx.fillRect(-800, 820, 3600, 800);
  // the original fades away → gravestone
  const fade = seg(u, L('давно') - 0.2, L('умер') + 0.5);
  const stone = E.outBack(seg(u, L('умер') + 0.1, L('умер') + 0.6), 1.6);
  if (stone > 0) {
    ctx.save(); ctx.translate(620, 820); ctx.scale(stone, stone);
    ctx.fillStyle = 'rgba(0,0,20,0.3)'; ctx.beginPath(); ctx.ellipse(10, 0, 110, 14, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(-80, -150); ctx.arc(0, -150, 80, Math.PI, 0); ctx.lineTo(80, 0); ctx.closePath(); ctx.fillStyle = '#6b6894'; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,20,0.2)'; ctx.fillRect(30, -200, 50, 200);
    label(ctx, 'ТЫ', 0, -140, 46, { color: '#2a2650', weight: 900 }); label(ctx, '20XX', 0, -80, 24, { color: '#2a2650', weight: 800 });
    ctx.restore();
  }
  if (fade < 1) dude(ctx, 620, 820 - fade * 40, 200, t, { alpha: 1 - fade, look: [0.2, -0.3], seed: 0.5 });
  if (fade > 0 && fade < 1) { ctx.save(); ctx.globalAlpha = Math.sin(fade * Math.PI) * 0.6; dude(ctx, 620, 700 - fade * 260, 200, t, { body: '#c9d8ff', skin: '#e3ecff', hair: '#c9d8ff', noShadow: true, mood: 'sleep' }); ctx.restore(); }
  // glass pod with the copy being rebuilt from voxels
  const podIn = E.out3(seg(u, L('Сверхразум') - 0.4, L('Сверхразум') + 0.3));
  if (podIn > 0) {
    ctx.save(); ctx.globalAlpha = podIn;
    rrect(ctx, POD.x - 190, POD.y + 250, 380, 30, 10); ctx.fillStyle = '#2b2275'; ctx.fill();
    rrect(ctx, POD.x - 160, POD.y - 330, 320, 28, 10); ctx.fill();
    for (let k = 0; k < 5; k++) circle(ctx, POD.x - 100 + k * 50, POD.y + 265, 5, k % 2 ? PAL.cyan : PAL.mag);
    // the rebuilt copy
    const build = seg(u, L('воссоздать'), L('копию') + 0.2);
    if (build > 0) {
      const cx = POD.x, cy = POD.y + 250, hh = 260;
      const yCut = cy - hh * 1.1 * E.inOut(build);
      ctx.save(); ctx.beginPath(); ctx.rect(cx - 200, yCut, 400, 600); ctx.clip();
      const look = E.inOut(seg(u, L('кто', 1) - 0.2, L('сказал'))) ;
      const blink = Math.abs(u - (L('ты', 1) + 0.6)) < 0.08 ? 1 : 0;
      dude(ctx, cx, cy, hh, t, { body: '#3fd0e8', skin: '#bdf3ff', hair: '#2a8ab0', look: [lerp(-0.7, 0, look), lerp(0, 0.1, look)], blink, seed: 0.5, mood: look > 0.5 ? 'calm' : 'calm' });
      // digital scanlines on the copy
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(92,225,255,0.10)'; for (let yy = cy - hh * 1.2; yy < cy; yy += 8) ctx.fillRect(cx - 120, yy, 240, 3);
      ctx.restore();
      // voxels still arriving above the build line
      if (build < 1) {
        const R = rng(17);
        for (let i = 0; i < 90; i++) { const vx = cx + (R() - 0.5) * 200, vy = yCut - R() * 60, sz = 10 + R() * 10; ctx.globalAlpha = podIn * (0.4 + 0.6 * R()); ctx.fillStyle = R() < 0.5 ? PAL.cyan : PAL.ice; ctx.fillRect(vx, vy - (1 - build) * 40 * R(), sz, sz); }
        ctx.globalAlpha = podIn;
        const g = ctx.createLinearGradient(0, yCut - 20, 0, yCut + 20); g.addColorStop(0, 'rgba(92,225,255,0)'); g.addColorStop(0.5, 'rgba(92,225,255,0.9)'); g.addColorStop(1, 'rgba(92,225,255,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - 170, yCut - 20, 340, 40);
      }
    }
    // glass
    rrect(ctx, POD.x - 150, POD.y - 300, 300, 550, 30); ctx.fillStyle = 'rgba(160,220,255,0.10)'; ctx.fill(); ctx.strokeStyle = 'rgba(190,240,255,0.5)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(POD.x - 120, POD.y - 270); ctx.lineTo(POD.x - 80, POD.y - 270); ctx.lineTo(POD.x - 130, POD.y + 200); ctx.lineTo(POD.x - 140, POD.y + 120); ctx.fill();
    ctx.restore();
    const cp = pop(u, L('точную') - 0.1, 0.4) * (1 - seg(u, L('кто', 1) - 0.6, L('кто', 1) - 0.1));
    if (cp > 0) { ctx.save(); ctx.translate(POD.x + 300, POD.y - 200); ctx.scale(cp, cp); label(ctx, 'КОПИЯ 1:1', 0, 0, 34, { color: '#120d40', bg: PAL.cyan }); ctx.restore(); }
    const th = pop(u, L('думает') - 0.1, 0.4) * (1 - seg(u, L('кто', 1) - 0.6, L('кто', 1) - 0.1)), hp = pop(u, L('чувствует'), 0.4, 2.4) * (1 - seg(u, L('кто', 1) - 0.6, L('кто', 1) - 0.1));
    if (th > 0) { ctx.save(); ctx.translate(POD.x - 270, POD.y - 330); ctx.scale(th, th); circle(ctx, 0, 0, 62, '#e9ebff'); circle(ctx, 60, 60, 14, '#e9ebff'); gear(ctx, -12, -6, 22, t * 2, '#8f8ad8'); gear(ctx, 24, 18, 13, -t * 3, '#a68cff'); ctx.restore(); }
    if (hp > 0) { ctx.save(); ctx.translate(POD.x + 250, POD.y - 40); ctx.scale(hp * (1 + 0.08 * Math.sin(t * 8)), hp * (1 + 0.08 * Math.sin(t * 8))); heart(ctx, 0, 0, 44, PAL.pink); ctx.restore(); }
  }
  ctx.restore();
  vignette(ctx, 0.5 + 0.35 * seg(u, L('кто', 1) - 0.5, L('кто', 1) + 0.5));
}

// S8 — the basilisk: a myth that kills with a look. Here knowledge is the danger. Now you know.
const SN = BEADS.length;
const HEAD = { x: 1240, y: 330 };
const S8CORE = { x: 1300, y: 320 };
function bodyPos(s, t) {
  const x = HEAD.x - 40 - s * 1180 + 60 * Math.sin(s * 5.2 + 0.6);
  const y = 470 + s * 110 + 110 * Math.sin(s * TAU * 1.5 - t * 2.3) * (0.25 + 0.75 * s) - 180 * Math.pow(1 - clamp(s / 0.24), 2);
  return { x, y };
}
function serpent(ctx, u, t, o) {
  const sc = 0.62;
  const hm = E.inOut(seg(u, o.m0 + 0.05, o.m0 + 1.2));
  const hx = lerp(S8CORE.x, HEAD.x, hm) + Math.sin(t * 1.3) * 10 * hm, hy = lerp(S8CORE.y, HEAD.y, hm) + Math.sin(t * 1.7) * 8 * hm;
  const coreA = 1 - seg(u, o.m0 + 0.3, o.m0 + 1.0);
  if (coreA > 0) aiCore(ctx, lerp(S8CORE.x, hx, hm * 0.6), lerp(S8CORE.y, hy, hm * 0.6), sc * (0.6 + 0.4 * coreA), t, { grow: coreA, eye: coreA, rings: 0, tint: 0.6 });
  const pts = [];
  for (let j = 0; j < SN; j++) {
    const b = BEADS[j]; const s = (j + 1) / SN;
    const rp = beadPos(b, t, S8CORE.x, S8CORE.y, sc);
    const m = E.inOut(seg(u, o.m0 + 0.55 * s, o.m0 + 0.75 + 0.55 * s));
    let bp = bodyPos(s, t); bp = { x: bp.x + (hx - HEAD.x) * (1 - s), y: bp.y + (hy - HEAD.y) * (1 - s) };
    pts.push({ x: lerp(rp.x, bp.x, m), y: lerp(rp.y, bp.y, m), r: lerp(7 * sc, lerp(54, 14, s), m), m, s });
  }
  if (o.m0 > -1) {
    const ringA = 1 - seg(u, o.m0 + 0.2, o.m0 + 0.6);
    if (ringA > 0) { ctx.save(); ctx.globalAlpha = ringA * 0.6; for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(S8CORE.x, S8CORE.y); ctx.rotate(RING_ROT[k]); ctx.strokeStyle = PAL.cyan; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, RING_R[k] * sc, RING_R[k] * sc * Math.cos(RING_TILT[k]), 0, 0, TAU); ctx.stroke(); ctx.restore(); } ctx.restore(); }
  }
  for (let j = SN - 1; j >= 0; j--) { const p = pts[j]; if (p.m < 0.85) { ctx.globalAlpha = 1 - seg(p.m, 0.6, 0.85); circle(ctx, p.x, p.y, Math.max(7 * sc, p.r * 0.5), PAL.ice); } }
  ctx.globalAlpha = 1;
  const tube = (extra, color) => {
    ctx.lineCap = 'round'; ctx.strokeStyle = color;
    for (let j = SN - 2; j >= 0; j--) { const a = pts[j + 1], b = pts[j]; if (a.m < 0.6 || b.m < 0.6) continue; ctx.globalAlpha = seg(Math.min(a.m, b.m), 0.6, 0.9); ctx.lineWidth = 2 * Math.min(a.r, b.r) + extra; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  };
  tube(0, '#3b2a9a'); tube(-14, '#5240c4');
  ctx.save(); ctx.lineCap = 'round';
  for (let j = SN - 2; j >= 0; j--) { const a = pts[j + 1], b = pts[j]; if (a.m < 0.6 || b.m < 0.6) continue; const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1; const off2 = b.r * 0.5; ctx.globalAlpha = seg(Math.min(a.m, b.m), 0.6, 0.9); ctx.strokeStyle = '#ffcf7a'; ctx.lineWidth = b.r * 0.42; ctx.beginPath(); ctx.moveTo(a.x + nx / nl * off2, a.y + ny / nl * off2); ctx.lineTo(b.x + nx / nl * off2, b.y + ny / nl * off2); ctx.stroke(); }
  for (let j = SN - 1; j >= 1; j -= 2) {
    const p = pts[j], q = pts[j - 1]; if (p.m < 0.85) continue; const ang = Math.atan2(q.y - p.y, q.x - p.x);
    ctx.globalAlpha = seg(p.m, 0.85, 1); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(30,20,90,0.35)'; ctx.beginPath(); ctx.ellipse(0, -p.r * 0.2, p.r * 0.35, p.r * 0.55, 0, 0, TAU); ctx.fill();
    if (j % 4 === 1 && p.r > 15) { ctx.fillStyle = PAL.mag; ctx.beginPath(); ctx.moveTo(-p.r * 0.3, -p.r + 2); ctx.lineTo(0, -p.r - p.r * 0.55); ctx.lineTo(p.r * 0.3, -p.r + 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
  const ha = E.outBack(seg(u, o.m0 + 0.4, o.m0 + 1.05));
  if (ha > 0) {
    ctx.save(); ctx.translate(hx, hy); ctx.scale(ha, ha); ctx.rotate(-0.12 + Math.sin(t * 1.1) * 0.04 + (o.headRot || 0));
    ctx.fillStyle = PAL.amber; [[-46, -54], [-6, -80], [34, -60]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x - 16, -30); ctx.lineTo(x, y); ctx.lineTo(x + 16, -30); ctx.closePath(); ctx.fill(); });
    shaded(ctx, (g, c) => { if (!c) g.beginPath(); g.moveTo(-95, 10); g.quadraticCurveTo(-90, -62, 0, -58); g.quadraticCurveTo(110, -52, 150, 18); g.quadraticCurveTo(80, 70, -10, 62); g.quadraticCurveTo(-88, 58, -95, 10); g.closePath(); }, '#5240c4', 'rgba(20,10,60,0.35)', 0, -16);
    const tf = Math.max(0, Math.sin(clamp((u - o.m0 - 1.25) / 0.45) * Math.PI));
    if (tf > 0) { ctx.strokeStyle = PAL.mag; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(146, 22); ctx.lineTo(146 + 60 * tf, 26); ctx.lineTo(146 + 80 * tf, 12); ctx.moveTo(146 + 60 * tf, 26); ctx.lineTo(146 + 80 * tf, 38); ctx.stroke(); }
    eye(ctx, 40, -6, 110, 0.9 + 0.1 * o.gaze, o.look || 0.6, 0, 0.15 + 0.3 * o.gaze, { glow: o.gaze > 0 ? PAL.mag : PAL.cyanD, lid: o.gaze > 0.3 ? PAL.mag : PAL.amber, iris: '#ffe08a', iris2: '#d98a1f' });
    ctx.restore();
  }
  return { ex: hx + 40 * ha, ey: hy - 6 * ha };
}
function flower(ctx, x, y, s, stone, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 1.5) * 0.04 * (1 - stone));
  ctx.strokeStyle = mix('#3fcf7a', '#8a88a8', stone); ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -60, 0, -120); ctx.stroke();
  ctx.fillStyle = mix('#3fcf7a', '#8a88a8', stone); ctx.beginPath(); ctx.ellipse(18, -60, 22, 10, -0.6, 0, TAU); ctx.fill();
  for (let k = 0; k < 6; k++) { ctx.save(); ctx.translate(0, -125); ctx.rotate(k * TAU / 6); ctx.fillStyle = mix('#ff8fb8', '#a3a1bd', stone); ctx.beginPath(); ctx.ellipse(0, -26, 14, 24, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  circle(ctx, 0, -125, 16, mix(PAL.amber, '#7c7a99', stone));
  if (stone > 0.6) { ctx.strokeStyle = 'rgba(40,30,60,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -140); ctx.lineTo(4, -120); ctx.lineTo(-6, -104); ctx.lineTo(8, -80); ctx.stroke(); }
  ctx.restore();
}
function s8(ctx, u, d, t) {
  const L = (id, n = 0) => lw('basilisk', id, n);
  const tNow = L('Теперь'), tHeard = L('слышал', 1);
  const cu = E.inOut(seg(u, tNow - 0.1, tHeard + 0.1));
  const cam0 = camKeys([{ t: 0, v: [1100, 520, 0.9, 0.0] }, { t: L('змей'), v: [1000, 540, 0.85, 0.012] }, { t: L('знание'), v: [900, 560, 0.92, 0.0] }, { t: L('безопасности'), v: [760, 600, 1.0, -0.01] }, { t: d, v: [800, 580, 1.02, -0.012] }], u);
  const cam = { ...cam0 };
  sky(ctx, cam, t, { top: '#0a0620', bot: '#2a1450', dim: 0.8 });
  layer(ctx, 3, g => { applyCam(g, cam, 0.7); g.fillStyle = '#1d1660'; g.beginPath(); g.moveTo(-800, 1300); g.lineTo(-800, 860); g.quadraticCurveTo(300, 760, 900, 880); g.quadraticCurveTo(1500, 980, 2800, 800); g.lineTo(2800, 1300); g.fill(); });
  ctx.save(); applyCam(ctx, cam, 1);
  ctx.fillStyle = '#140f40'; ctx.beginPath(); ctx.moveTo(-600, 1400); ctx.lineTo(-600, 930); ctx.quadraticCurveTo(600, 880, 1400, 940); ctx.quadraticCurveTo(2000, 980, 2600, 920); ctx.lineTo(2600, 1400); ctx.fill();
  const g0 = L('взглядом') - 0.2, k0 = L('знание') - 0.3;
  // victim 1: a flower turned to stone by the gaze
  const stone = seg(u, g0 + 0.3, g0 + 0.9);
  const fl = 1 - seg(u, k0 - 0.4, k0);
  if (fl > 0) flower(ctx, 260, 940, 1.2 * fl + 0.0001, stone, t);
  // victim 2: someone who KNOWS (bulb) — the bulb is the target
  const kn = E.outBack(seg(u, k0 - 0.3, k0 + 0.2));
  const kHit = seg(u, k0 + 0.25, k0 + 0.6);
  if (kn > 0) { ctx.save(); ctx.globalAlpha = 1 - seg(u, L('Пока') - 0.3, L('Пока')); dude(ctx, 300, 935, 170 * kn, t, { body: '#ff8fb8', mood: kHit > 0 ? 'scared' : 'calm', look: [0.8, -0.4], seed: 0.2 }); bulb(ctx, 300, 690, 28 * kn, mix(PAL.amber, PAL.mag, kHit)); if (kn > 0.5) label(ctx, 'ЗНАНИЕ', 300, 620, 26, { color: '#120d40', bg: PAL.amber, alpha: clamp((kn - 0.5) * 2) }); ctx.restore(); }
  // you: no bulb yet, protected by ignorance
  const youA = seg(u, L('Пока') - 0.4, L('Пока') + 0.1);
  const heard = E.outBack(seg(u, tNow - 0.05, tNow + 0.35), 2.2);
  if (youA > 0) {
    ctx.save(); ctx.globalAlpha = youA;
    const shieldA = 1 - seg(u, tNow, tNow + 0.25);
    dude(ctx, 520, 935, 190, t, { body: '#4f7cff', mood: heard > 0 ? 'scared' : 'calm', look: heard > 0 ? [0, 0] : [0.7, -0.3], seed: 0.3 });
    if (shieldA > 0) { ctx.save(); ctx.globalAlpha *= shieldA; ctx.fillStyle = rgba(PAL.cyan, 0.12); ctx.strokeStyle = rgba(PAL.cyan, 0.6); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(520, 860, 170, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (heard > 0) bulb(ctx, 520, 670, 30 * heard, PAL.amber);
    if (shieldA < 1 && shieldA > 0) { const R = rng(4); for (let i = 0; i < 14; i++) { const a = Math.PI + R() * Math.PI, rr = 170 + (1 - shieldA) * 120; circle(ctx, 520 + Math.cos(a) * rr, 860 + Math.sin(a) * rr, 5 * shieldA, PAL.cyan); } }
    ctx.restore();
  }
  // the serpent
  const gaze = Math.max(seg(u, g0, g0 + 0.25) * (1 - seg(u, g0 + 1.0, g0 + 1.3)), seg(u, k0, k0 + 0.25) * (1 - seg(u, k0 + 1.0, k0 + 1.3)));
  const ep = serpent(ctx, u, t, { m0: 0.1, gaze: Math.max(gaze, heard), look: lerp(0.6, -0.4, seg(u, L('Пока'), L('Пока') + 0.5)) });
  const tgt = u < k0 ? { x: 260, y: 820 } : { x: 300, y: 690 };
  if (gaze > 0) {
    const g = ctx.createLinearGradient(ep.ex, ep.ey, tgt.x, tgt.y); g.addColorStop(0, rgba(PAL.mag, 0.9)); g.addColorStop(1, rgba(PAL.mag, 0.35));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = gaze; ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(ep.ex, ep.ey); ctx.lineTo(tgt.x, tgt.y); ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd2dc'; ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  // title
  const tp = seg(u, L('Василиск') - 0.1, L('Василиск') + 0.6), to = seg(u, L('убивающий') + 0.2, L('одним'));
  if (tp > 0 && to < 1) { ctx.save(); ctx.globalAlpha = 1 - to; kineticWord(ctx, 'ВАСИЛИСК', 960, 200, 120, tp, { color: PAL.amber, shadow: 'rgba(5,3,30,0.6)', track: 0.08 }); ctx.restore(); }
  dust(ctx, cam, t, '#b6a8ff', 0.2);
  vignette(ctx, 0.55);
  // "Теперь — слышал": hard cut to the serpent's eye staring into the lens
  if (u > tHeard - 0.12) {
    const k = seg(u, tHeard - 0.12, tHeard + 0.5);
    ctx.save(); ctx.fillStyle = '#07041a'; ctx.fillRect(0, 0, W, H);
    const z = lerp(1.25, 1.0, E.out3(k));
    ctx.translate(W / 2, H / 2); ctx.scale(z, z);
    glow(ctx, 0, 0, 1100, rgba(PAL.mag, 0.6), 0.8);
    eye(ctx, 0, 0, 1700, lerp(0.35, 1, E.outBack(seg(u, tHeard - 0.12, tHeard + 0.2), 1.6)), 0, 0, lerp(0.5, 0.08, E.out3(seg(u, tHeard + 0.1, tHeard + 0.6))), { glow: PAL.mag, lid: PAL.mag, iris: '#ffe08a', iris2: PAL.magD });
    ctx.restore();
    flash(ctx, (1 - seg(u, tHeard - 0.12, tHeard + 0.15)) * 0.5, '255,59,107');
    vignette(ctx, 0.7);
    fadeBlack(ctx, seg(u, d - 0.25, d), '3,2,16');
  }
}

// small standalone serpent (head + a few coils) for the counter-argument scenes
function serpentHead(ctx, x, y, s, t, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.flip ? -1 : 1), s);
  // coils behind
  for (let k = 3; k >= 0; k--) { const cx = 60 + k * 70, cy = 150 + Math.sin(t * 2 + k) * 10; circle(ctx, cx, cy, 70 - k * 8, k % 2 ? '#3b2a9a' : '#5240c4'); ctx.fillStyle = '#ffcf7a'; ctx.beginPath(); ctx.ellipse(cx - 10, cy + 30 - k * 3, 40 - k * 6, 18, 0, 0, TAU); ctx.fill(); }
  ctx.lineCap = 'round'; ctx.strokeStyle = '#5240c4'; ctx.lineWidth = 70; ctx.beginPath(); ctx.moveTo(60, 150); ctx.quadraticCurveTo(0, 80, 10, 10); ctx.stroke();
  ctx.rotate(-0.12 + Math.sin(t * 1.1) * 0.04 + (o.rot || 0));
  const sq = o.deflate || 0; ctx.scale(1 - 0.25 * sq, 1 - 0.35 * sq);
  ctx.fillStyle = PAL.amber; [[-46, -54], [-6, -80], [34, -60]].forEach(([x2, y2]) => { ctx.beginPath(); ctx.moveTo(x2 - 16, -30); ctx.lineTo(x2, y2 + sq * 30); ctx.lineTo(x2 + 16, -30); ctx.closePath(); ctx.fill(); });
  shaded(ctx, (g, c) => { if (!c) g.beginPath(); g.moveTo(-95, 10); g.quadraticCurveTo(-90, -62, 0, -58); g.quadraticCurveTo(110, -52, 150, 18); g.quadraticCurveTo(80, 70, -10, 62); g.quadraticCurveTo(-88, 58, -95, 10); g.closePath(); }, o.color || '#5240c4', 'rgba(20,10,60,0.35)', 0, -16);
  eye(ctx, 40, -6, 110, o.open ?? 1, o.look ?? 0.6, o.lookY || 0, o.slit ?? 0.2, { glow: o.angry ? PAL.mag : PAL.cyanD, lid: o.angry ? PAL.mag : PAL.amber, iris: '#ffe08a', iris2: '#d98a1f' });
  if (o.sweat > 0) { ctx.save(); ctx.globalAlpha = o.sweat; ctx.fillStyle = PAL.ice; ctx.beginPath(); ctx.moveTo(-60, -60); ctx.quadraticCurveTo(-78, -30, -60, -24); ctx.quadraticCurveTo(-42, -30, -60, -60); ctx.fill(); ctx.restore(); }
  ctx.restore();
}
function envelope(ctx, x, y, s, rot, c = PAL.mag) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,20,0.3)'; rrect(ctx, -56, -34, 120, 80, 10); ctx.fill();
  rrect(ctx, -60, -40, 120, 80, 10); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = '#ffd2dc'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-60, -38); ctx.lineTo(0, 8); ctx.lineTo(60, -38); ctx.stroke();
  label(ctx, '!', 0, 10, 40, { color: '#fff', weight: 900 }); ctx.restore();
}

// S9 — the post is deleted and the topic banned for five years; the ban spreads it everywhere; 2018
const NET = (() => { const R = rng(91); const a = []; for (let i = 0; i < 46; i++) { const ang = R() * TAU, r = 380 + R() * 900; a.push({ x: 960 + Math.cos(ang) * r * 1.5, y: 520 + Math.sin(ang) * r * 0.8, d: r, ph: R() }); } return a; })();
function s9(ctx, u, d, t) {
  const L = (id, n = 0) => lw('ban', id, n);
  const st = L('удалил') - 0.15, imp = L('удалил') + 0.05;
  const crack = L('предсказуем') + 0.1, spread = L('разлетелась') - 0.3, y18 = L('2018') - 0.4;
  const pull = E.inOut(seg(u, crack + 0.2, spread + 0.9));
  const whip = E.inOut(seg(u, y18 - 0.2, y18 + 0.4));
  const cam0 = camKeys([{ t: 0, v: [960, 520, 1.0, 0.012] }, { t: imp, v: [960, 500, 1.12, 0.0] }, { t: crack, v: [965, 510, 1.05, -0.01] }, { t: d, v: [970, 520, 1.0, 0.0] }], u);
  const cam = { ...cam0, z: cam0.z * lerp(1, 0.45, pull), x: cam0.x + shake(u, imp, 16) + whip * 2600, y: cam0.y + shake(u, imp, 10) * 0.6 };
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d0a33'); g.addColorStop(1, '#22195e'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); applyCam(ctx, cam, 0.5); ctx.fillStyle = rgba(PAL.cyan, 0.1);
  for (let x = -2400; x < 6400; x += 60) for (let y = -1400; y < 2500; y += 60) ctx.fillRect(x, y, 3, 3);
  ctx.restore();
  ctx.save(); applyCam(ctx, cam, 1);
  // the network the forbidden idea spreads through
  const sp = seg(u, spread, spread + 2.2);
  if (sp > 0) {
    ctx.lineWidth = 3;
    NET.forEach((n, i) => { const k = seg(sp, n.d / 1400 * 0.7, n.d / 1400 * 0.7 + 0.25); if (k <= 0) return; ctx.strokeStyle = rgba(PAL.amber, 0.25 * k); ctx.beginPath(); ctx.moveTo(960, 440); ctx.lineTo(n.x, n.y); ctx.stroke(); });
    NET.forEach((n, i) => {
      const k = seg(sp, n.d / 1400 * 0.7, n.d / 1400 * 0.7 + 0.25); if (k <= 0) return;
      const fx = lerp(960, n.x, E.out3(k)), fy = lerp(440, n.y, E.out3(k));
      ctx.save(); ctx.translate(fx, fy); ctx.rotate((n.ph - 0.5) * 0.6); const s = 0.16 + 0.06 * n.ph;
      forumCard(ctx, 0, 0, 980 * s, 520 * s, { typed: 1, bars: 1, nameHi: 0 });
      if (k >= 1) { glow(ctx, 0, 0, 120, rgba(PAL.amber, 0.5), 0.5 + 0.3 * Math.sin(t * 4 + i)); }
      ctx.restore();
    });
  }
  const bobY = Math.sin(t * 1.4) * 6;
  ctx.save(); ctx.translate(960, 440 + bobY); ctx.rotate(-0.035);
  ctx.fillStyle = 'rgba(0,0,20,0.35)'; rrect(ctx, -490 + 18, -260 + 26, 980, 520, 24); ctx.fill();
  forumCard(ctx, 0, 0, 980, 520, { typed: 1, bars: 1, dark: 0.35 * seg(u, imp, imp + 0.3) });
  const sp2 = seg(u, st, imp);
  if (sp2 > 0) {
    const s = lerp(2.8, 1, E.out3(sp2)) * (u > imp ? 1 + 0.06 * Math.exp(-(u - imp) * 10) : 1);
    ctx.save(); ctx.translate(40, 40); ctx.rotate(-0.2); ctx.scale(s, s); ctx.globalAlpha = clamp(sp2 * 3);
    ctx.strokeStyle = PAL.mag; ctx.lineWidth = 10; rrect(ctx, -300, -78, 600, 156, 16); ctx.stroke(); ctx.lineWidth = 4; rrect(ctx, -284, -62, 568, 124, 10); ctx.stroke();
    label(ctx, 'УДАЛЕНО', 0, 6, 96, { color: PAL.mag, weight: 900 });
    ctx.restore();
  }
  // padlock: drops, closes, then cracks open
  const lp = E.outBack(seg(u, L('пять') - 0.4, L('пять')), 1.6), close = E.outBack(seg(u, L('пять'), L('пять') + 0.2), 2);
  const cr = seg(u, crack, crack + 0.6);
  if (lp > 0) {
    ctx.save(); ctx.translate(420 - cr * 80, lerp(-700, -250, lp) + cr * cr * 900); ctx.rotate(0.15 * (1 - lp) - cr * 1.2);
    const open = cr > 0 ? 1 : 1 - close;
    ctx.strokeStyle = '#c9d4f2'; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(0, -52 - 26 * open, 52, Math.PI, 0); ctx.lineTo(52, -26 * open - 10); ctx.moveTo(-52, -52 - 26 * open); ctx.lineTo(-52, -10); ctx.stroke();
    rrect(ctx, -85, -20, 170, 140, 22); ctx.fillStyle = PAL.amber; ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.2)'; rrect(ctx, 0, -20, 85, 140, 18); ctx.fill();
    circle(ctx, 0, 40, 16, '#5a3a10'); ctx.fillStyle = '#5a3a10'; ctx.fillRect(-6, 40, 12, 36);
    if (cr > 0) { ctx.strokeStyle = '#3a2408'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-40, -20); ctx.lineTo(-10, 30); ctx.lineTo(-30, 60); ctx.lineTo(10, 120); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
  // who deleted it
  const who = seg(u, L('Основатель') - 0.2, L('Основатель') + 0.3) * (1 - seg(u, L('удалил') - 0.2, L('удалил') + 0.1));
  if (who > 0) { ctx.save(); ctx.globalAlpha = who; label(ctx, 'Элиезер Юдковский · основатель LessWrong', 960, 110, 32, { color: '#120d40', bg: PAL.ice, weight: 700, font: 'Montserrat' }); ctx.restore(); }
  // dust burst on the stamp
  if (u > imp && u < imp + 0.8) { const R = rng(9); const k = (u - imp) / 0.8; for (let i = 0; i < 26; i++) { const a = R() * TAU, s3 = 200 + R() * 380; ctx.globalAlpha = (1 - k) * 0.8; circle(ctx, 1000 + Math.cos(a) * (300 + s3 * E.out3(k)), 480 + Math.sin(a) * (100 + s3 * 0.5 * E.out3(k)), 6 * (1 - k) + 2, PAL.mag); } ctx.globalAlpha = 1; }
  // 2010 → 2015 counter under the card
  const c0 = L('лет') - 0.1, cp = seg(u, c0, L('обсуждение') + 0.6);
  const ca = seg(u, c0 - 0.3, c0) * (1 - seg(u, crack, crack + 0.4));
  if (ca > 0) {
    const yv = Math.min(5, Math.floor(cp * 5.999)); const fl = (cp * 5.999) % 1;
    ctx.save(); ctx.globalAlpha = ca; ctx.translate(960, 860);
    label(ctx, 'ОБСУЖДЕНИЕ ПОД ЗАПРЕТОМ', 0, -78, 30, { color: PAL.mag });
    ctx.font = '900 96px Unbounded, sans-serif'; ctx.fillStyle = PAL.white; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText('201', -34, 0);
    const flipping = yv < 5 && cp > 0 && fl > 0.7; const k = flipping ? (fl - 0.7) / 0.3 : 0;
    ctx.save(); ctx.translate(118, 0); ctx.scale(1, flipping ? Math.abs(Math.cos(k * Math.PI)) : 1); ctx.fillStyle = yv >= 5 ? PAL.amber : PAL.white; ctx.fillText(String(flipping && k > 0.5 ? yv + 1 : yv), 0, 0); ctx.restore();
    ctx.restore();
  }
  ctx.restore();
  const rt = seg(u, L('запретная') - 0.2, L('запретная') + 0.4) * (1 - seg(u, y18 - 0.4, y18));
  if (rt > 0) { ctx.save(); ctx.globalAlpha = rt; kineticWord(ctx, 'ЭФФЕКТ СТРЕЙЗАНД', 960, 960, 64, rt, { color: PAL.amber, shadow: 'rgba(5,3,30,0.6)' }); ctx.restore(); }
  // 2018: two people meet over a basilisk joke
  if (whip > 0) {
    ctx.save(); ctx.globalAlpha = whip;
    const ox = (1 - whip) * 900;
    const g2 = ctx.createLinearGradient(0, 0, 0, H); g2.addColorStop(0, '#1d1240'); g2.addColorStop(1, '#4a1f6e'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    ctx.translate(ox, 0);
    label(ctx, '2018', 960, 170, 110, { color: PAL.amber, weight: 900, shadow: 'rgba(5,3,30,0.6)' });
    const av = (x, init, name, c, p) => { if (p <= 0) return; ctx.save(); ctx.translate(x, 560); ctx.scale(p, p); circle(ctx, 0, 8, 120, 'rgba(0,0,20,0.3)'); circle(ctx, 0, 0, 120, c); label(ctx, init, 0, 6, 84, { color: '#120d40', weight: 900 }); label(ctx, name, 0, 190, 34, { color: PAL.white, weight: 800 }); ctx.restore(); };
    av(560, 'И', 'Илон Маск', '#7aa2ff', pop(u, L('Илона') - 0.2, 0.4));
    av(1360, 'Г', 'Граймс', '#ff8fb8', pop(u, L('певицу') - 0.1, 0.4));
    const bp = pop(u, L('шутка') - 0.1, 0.4);
    if (bp > 0) { ctx.save(); ctx.translate(960, 360); ctx.scale(bp, bp); ctx.font = '700 36px Montserrat, sans-serif'; const tx = 'шутка про «Рококо-василиска»'; const w = ctx.measureText(tx).width + 70; rrect(ctx, -w / 2, -40, w, 80, 40); ctx.fillStyle = PAL.ice; ctx.fill(); label(ctx, tx, 0, 2, 36, { color: '#120d40', weight: 700, font: 'Montserrat' }); ctx.restore(); }
    const hp = pop(u, L('познакомила'), 0.5, 2.4);
    if (hp > 0) { ctx.save(); ctx.translate(960, 560); ctx.scale(hp * (1 + 0.06 * Math.sin(t * 7)), hp * (1 + 0.06 * Math.sin(t * 7))); heart(ctx, 0, 0, 80, PAL.mag); ctx.restore(); ctx.strokeStyle = rgba(PAL.pink, 0.6 * hp); ctx.setLineDash([14, 12]); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(700, 560); ctx.lineTo(860, 560); ctx.moveTo(1060, 560); ctx.lineTo(1220, 560); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  }
  vignette(ctx, 0.5);
  fadeBlack(ctx, 1 - seg(u, 0, 0.3), '3,2,16');
}

// S10 — good news #1: once it exists, revenge changes nothing; wasting resources on it is irrational
const DAWN = { top: '#123a5e', bot: '#e98a7a' };
function dawnSky(ctx, cam, t, k = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, mix('#0d0a33', DAWN.top, k)); g.addColorStop(1, mix('#22195e', DAWN.bot, k)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); applyCam(ctx, cam, 0.2); ctx.globalAlpha = 1 - 0.6 * k; drawStars(ctx, STARS[0], t, '#ffffff', 0.3); ctx.restore();
  glow(ctx, W * 0.5, H * 1.05, 900, rgba('#ffcf8a', 0.5), 0.8 * k);
}
function s10(ctx, u, d, t) {
  const L = (id, n = 0) => lw('no_effect', id, n);
  const k = E.inOut(seg(u, 0, L('новости') + 0.3));
  const cam = camKeys([{ t: 0, v: [960, 470, 1.08, 0.0] }, { t: L('Первое'), v: [960, 440, 1.0, 0.0] }, { t: L('Прошлое'), v: [880, 460, 1.06, -0.008] }, { t: d, v: [1020, 430, 1.1, 0.01] }], u);
  dawnSky(ctx, cam, t, k);
  const hn = seg(u, L('хорошие') - 0.1, L('новости') + 0.3), hno = seg(u, L('Первое') - 0.2, L('Первое') + 0.2);
  if (hn > 0 && hno < 1) { ctx.save(); ctx.globalAlpha = 1 - hno; kineticWord(ctx, 'ХОРОШИЕ НОВОСТИ', 960, 560 - hno * 40, 100, hn, { color: '#fff7e6', shadow: 'rgba(60,20,40,0.35)' }); ctx.restore(); }
  const sc = seg(u, L('Первое') - 0.1, L('Первое') + 0.3);
  badge(ctx, 1, 130, 120, 62, E.outBack(sc, 2), PAL.amber);
  if (sc <= 0) return void vignette(ctx, 0.35);
  ctx.save(); applyCam(ctx, cam, 1); ctx.globalAlpha = sc;
  const lp = E.inOut(seg(u, L('Первое'), L('Первое') + 0.6));
  // the past turns to stone
  const stone = E.out3(seg(u, L('Прошлое') - 0.1, L('перепишешь') + 0.3));
  if (stone > 0) { rrect(ctx, 170, 600, 640 * stone, 80, 18); ctx.fillStyle = '#8a86a8'; ctx.fill(); ctx.fillStyle = 'rgba(0,0,20,0.18)'; ctx.fillRect(170, 650, 640 * stone, 30); for (let i = 0; i < 5; i++) { ctx.strokeStyle = 'rgba(40,30,60,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(220 + i * 120, 610); ctx.lineTo(240 + i * 120, 640); ctx.lineTo(225 + i * 120, 670); ctx.stroke(); } }
  ctx.strokeStyle = '#fff1e0'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(180, 640); ctx.lineTo(lerp(180, 1740, lp), 640); ctx.stroke();
  if (lp > 0.95) { ctx.fillStyle = '#fff1e0'; ctx.beginPath(); ctx.moveTo(1762, 640); ctx.lineTo(1726, 618); ctx.lineTo(1726, 662); ctx.fill(); }
  label(ctx, 'ПРОШЛОЕ', 330, 730, 30, { color: '#fff1e0', alpha: seg(u, L('Первое') + 0.3, L('Первое') + 0.6) });
  label(ctx, 'БУДУЩЕЕ', 1590, 730, 30, { color: '#fff1e0', alpha: seg(u, L('Первое') + 0.5, L('Первое') + 0.8) });
  const pin = E.outBack(seg(u, L('когда') - 0.2, L('когда') + 0.2));
  if (pin > 0) dude(ctx, 450, 640, 170 * pin, t, { body: '#4f7cff', look: [0.8, -0.3], mood: 'calm', seed: 0.4, noShadow: true });
  const ain = E.outBack(seg(u, L('сверхразум') - 0.2, L('сверхразум') + 0.3));
  if (ain > 0) aiCore(ctx, 1460, 420, 0.46 * ain, t, { look: [-0.8, 0.2] });
  label(ctx, 'УЖЕ СУЩЕСТВУЕТ', 1460, 575, 28, { color: '#1d1240', bg: PAL.cyan, alpha: seg(u, L('существует') - 0.1, L('существует') + 0.2) });
  // revenge arrow back to the past: shatters before arriving
  const ap = seg(u, L('месть') - 0.1, L('изменит') + 0.2), brk = seg(u, L('изменит') + 0.2, L('изменит') + 1.0);
  const P0 = { x: 1400, y: 410 }, P1 = { x: 960, y: 170 }, P2 = { x: 520, y: 420 };
  const qb = (q) => ({ x: (1 - q) * (1 - q) * P0.x + 2 * (1 - q) * q * P1.x + q * q * P2.x, y: (1 - q) * (1 - q) * P0.y + 2 * (1 - q) * q * P1.y + q * q * P2.y });
  if (ap > 0 && brk < 1) {
    const reach = 0.62 * E.out2(ap);
    if (brk <= 0) {
      ctx.setLineDash([22, 16]); ctx.lineDashOffset = -t * 120; ctx.strokeStyle = PAL.mag; ctx.lineWidth = 9; ctx.beginPath();
      for (let q = 0; q <= reach; q += 0.01) { const p = qb(q); q === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]);
      const hp = qb(reach), hp2 = qb(Math.max(0, reach - 0.02)); const ang = Math.atan2(hp.y - hp2.y, hp.x - hp2.x);
      ctx.save(); ctx.translate(hp.x, hp.y); ctx.rotate(ang); ctx.fillStyle = PAL.mag; ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-16, -20); ctx.lineTo(-16, 20); ctx.fill(); ctx.restore();
      label(ctx, 'МЕСТЬ', 1130, 200, 32, { color: PAL.mag, alpha: seg(ap, 0.2, 0.4) });
    } else {
      const R = rng(31);
      for (let q = 0; q < 0.62; q += 0.035) { const p = qb(q); const vx = (R() - 0.5) * 300, vy = -100 - R() * 200; const tt = brk * 1.1; ctx.save(); ctx.globalAlpha = sc * (1 - brk); ctx.translate(p.x + vx * tt, p.y + vy * tt + 900 * tt * tt); ctx.rotate(R() * 6 * tt); ctx.fillStyle = PAL.mag; ctx.fillRect(-11, -4.5, 22, 9); ctx.restore(); }
    }
  }
  // lock on the stone past
  const lk = E.outBack(seg(u, L('перепишешь') - 0.1, L('перепишешь') + 0.3), 2);
  if (lk > 0) { ctx.save(); ctx.translate(260, 560); ctx.scale(lk * 0.6, lk * 0.6); ctx.strokeStyle = '#5b577a'; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(0, -52, 52, Math.PI, 0); ctx.lineTo(52, -10); ctx.moveTo(-52, -52); ctx.lineTo(-52, -10); ctx.stroke(); rrect(ctx, -85, -20, 170, 140, 22); ctx.fillStyle = '#8a86a8'; ctx.fill(); circle(ctx, 0, 40, 16, '#3a3650'); ctx.restore(); }
  // battery of resources drains
  const bp = seg(u, L('ресурсы') - 0.2, L('нерационально') + 0.2);
  const ba = seg(u, L('тратить') - 0.3, L('тратить'));
  if (ba > 0) {
    ctx.save(); ctx.globalAlpha = ba * sc; ctx.translate(1460, 200);
    rrect(ctx, -110, -40, 220, 80, 14); ctx.fillStyle = '#1d1240'; ctx.fill(); ctx.fillRect(110, -16, 16, 32);
    const lvl = 1 - 0.88 * E.inOut(bp); rrect(ctx, -100, -30, 200 * lvl, 60, 10); ctx.fillStyle = lvl < 0.35 ? PAL.mag : PAL.teal; ctx.fill();
    label(ctx, 'РЕСУРСЫ', 0, -70, 26, { color: '#fff1e0' });
    ctx.restore();
  }
  const nr = seg(u, L('нерационально') - 0.1, L('нерационально') + 0.5);
  if (nr > 0) { ctx.save(); ctx.translate(1460, 860); ctx.rotate(-0.06); kineticWord(ctx, 'НЕРАЦИОНАЛЬНО', 0, 0, 58, nr, { color: '#fff7e6', shadow: 'rgba(60,20,40,0.4)' }); ctx.restore(); }
  const qm = E.outBack(seg(u, L('изменит') + 0.3, L('изменит') + 0.7), 2.2);
  if (qm > 0) { ctx.save(); ctx.translate(1600, 300); ctx.scale(qm, qm); ctx.rotate(Math.sin(t * 3) * 0.08); label(ctx, '?', 0, 0, 120, { color: PAL.amber, weight: 900 }); ctx.restore(); }
  ctx.restore();
  vignette(ctx, 0.35);
}

// S11 — good news #2: blackmail only works on those who give in
function s11(ctx, u, d, t) {
  const L = (id, n = 0) => lw('blackmail', id, n);
  const cam = camKeys([{ t: 0, v: [960, 540, 1.0, 0.0] }, { t: L('твёрдо'), v: [900, 560, 1.06, -0.006] }, { t: L('бессмысленно'), v: [1000, 540, 1.0, 0.006] }, { t: d, v: [820, 560, 1.12, -0.01] }], u);
  dawnSky(ctx, cam, t, 1);
  badge(ctx, 2, 130, 120, 62, E.outBack(seg(u, L('Второе') - 0.1, L('Второе') + 0.3), 2), PAL.amber);
  ctx.save(); applyCam(ctx, cam, 1);
  ctx.fillStyle = '#5a2f6e'; ctx.beginPath(); ctx.moveTo(-600, 1400); ctx.lineTo(-600, 880); ctx.quadraticCurveTo(900, 820, 2600, 900); ctx.lineTo(2600, 1400); ctx.fill();
  const yields = Math.sin(clamp((u - L('жертва') + 0.1) / 1.4) * Math.PI);
  const firm = seg(u, L('твёрдо') - 0.1, L('твёрдо') + 0.3);
  const leave = E.in2(seg(u, L('тронет'), d - 0.4));
  const defl = E.inOut(seg(u, L('бессмысленно') - 0.1, L('бессмысленно') + 0.6));
  // the viewer
  dude(ctx, 560, 880, 220, t, { body: '#4f7cff', mood: firm > 0 ? (leave > 0.3 ? 'happy' : 'calm') : (yields > 0.2 ? 'scared' : 'calm'), arms: firm > 0 ? 'cross' : (yields > 0.3 ? 'up' : 'down'), look: [0.8, -0.1], seed: 0.3, squash: 1 - 0.08 * yields * (1 - firm) });
  // shield "НЕТ"
  const sh = E.outBack(seg(u, L('решил') - 0.1, L('решил') + 0.35), 1.6);
  if (sh > 0) { ctx.save(); ctx.translate(780, 700); ctx.scale(sh, sh); ctx.fillStyle = rgba(PAL.cyan, 0.18); ctx.strokeStyle = rgba(PAL.cyan, 0.9); ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, -150); ctx.quadraticCurveTo(110, -130, 120, -100); ctx.quadraticCurveTo(120, 60, 0, 170); ctx.quadraticCurveTo(-120, 60, -120, -100); ctx.quadraticCurveTo(-110, -130, 0, -150); ctx.fill(); ctx.stroke(); label(ctx, 'НЕТ', 0, 0, 64, { color: PAL.white, weight: 900 }); ctx.restore(); }
  // the serpent
  const sx = 1450 + leave * 1100, sy = 520;
  serpentHead(ctx, sx, sy, 1.15 * (1 - 0.3 * defl), t, { flip: true, look: 0.8, angry: defl < 0.5 && leave <= 0, deflate: defl, sweat: defl, rot: leave * 0.3 });
  // envelope 1 (no shield yet): reaches the viewer, who flinches
  const e1 = seg(u, L('шантаж') - 0.1, L('работает') + 0.4);
  if (e1 > 0 && e1 < 1) envelope(ctx, lerp(1300, 640, E.inOut(e1)), lerp(470, 640, E.inOut(e1)) - Math.sin(e1 * Math.PI) * 160, 1, e1 * 0.6);
  // envelope 2: bounces off the shield
  const e2 = seg(u, L('правилам') - 0.5, L('угроз') + 0.2), e2b = seg(u, L('угроз') + 0.2, L('угроз') + 1.2);
  if (e2 > 0 && e2b < 1) {
    if (e2b <= 0) envelope(ctx, lerp(1300, 900, E.in2(e2)), lerp(470, 640, E.in2(e2)) - Math.sin(e2 * Math.PI) * 120, 1, e2 * 0.4);
    else envelope(ctx, 900 + e2b * 380, 640 - 260 * e2b + 900 * e2b * e2b, 1 - 0.3 * e2b, e2b * 7);
  }
  if (e2b > 0 && e2b < 0.3) { ctx.strokeStyle = rgba(PAL.ice, 1 - e2b / 0.3); ctx.lineWidth = 6; circle(ctx, 890, 640, 40 + e2b * 300); ctx.stroke(); }
  ctx.restore();
  vignette(ctx, 0.35);
}

// S12 — good news #3: Pascal's wager in a digital wrapper; infinitely many imaginary machines cancel out
const MACH = (() => { const R = rng(123); const a = []; for (let i = 0; i < 70; i++) { const ring = 1 + Math.floor(i / 10); const ang = (i % 10) / 10 * TAU + ring * 0.7 + R() * 0.3; a.push({ ang, ring, c: [PAL.mag, PAL.cyan, PAL.teal, PAL.lilac, PAL.amber][Math.floor(R() * 5)], ph: R() * TAU, pair: i % 2 }); } return a; })();
function s12(ctx, u, d, t) {
  const L = (id, n = 0) => lw('pascal', id, n);
  const many = seg(u, L('Можно') - 0.1, L('машин') + 0.4);
  const cam0 = camKeys([{ t: 0, v: [960, 520, 1.0, 0.0] }, { t: L('Можно'), v: [960, 500, 1.05, 0.004] }, { t: L('машин') + 0.4, v: [960, 540, 0.62, 0.0] }, { t: L('Одна'), v: [960, 560, 0.95, 0.0] }, { t: d, v: [960, 560, 0.9, 0.0] }], u);
  const cam = cam0;
  dawnSky(ctx, cam, t, 0.85);
  badge(ctx, 3, 130, 120, 62, E.outBack(seg(u, L('Третье') - 0.1, L('Третье') + 0.3), 2), PAL.amber);
  ctx.save(); applyCam(ctx, cam, 1);
  // coin + bow
  const cinA = 1 - seg(u, L('Можно') + 0.2, L('бесконечно') + 0.2);
  if (cinA > 0) {
    const cin = seg(u, L('пари') - 0.3, L('пари') + 1.2); const spin = E.out3(cin) * 5 * Math.PI; const cy = 430 - 200 * Math.sin(clamp(cin) * Math.PI) * (1 - cin * 0.4);
    const sx = Math.cos(spin); const face = sx >= 0;
    ctx.save(); ctx.translate(960, cy); ctx.globalAlpha = cinA * seg(u, L('Третье') + 0.4, L('Третье') + 0.8);
    ctx.save(); ctx.scale(Math.max(0.06, Math.abs(sx)), 1);
    circle(ctx, 0, 8, 150, '#b07617'); circle(ctx, 0, 0, 150, face ? '#ffc94a' : '#f0b437'); ctx.lineWidth = 10; ctx.strokeStyle = '#d9971f'; circle(ctx, 0, 0, 120); ctx.stroke();
    label(ctx, face ? '∞' : '0', 0, 8, 140, { color: '#9a5f0c', weight: 900 });
    ctx.restore();
    const bow = E.outBack(seg(u, L('обёртке') - 0.2, L('обёртке') + 0.2), 2.4);
    if (bow > 0) {
      ctx.save(); ctx.scale(bow, bow); ctx.fillStyle = PAL.cyan;
      ctx.fillRect(-160, -18, 320, 36); ctx.fillRect(-18, -160, 36, 320);
      ctx.fillStyle = '#1d1240'; for (let i = -140; i < 150; i += 28) { ctx.fillRect(i, -4, 12, 8); ctx.fillRect(-4, i, 8, 12); }
      ctx.translate(0, -160); ctx.fillStyle = PAL.cyan;
      [-1, 1].forEach(s => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(s * 30, -90, s * 120, -70, s * 90, -10); ctx.bezierCurveTo(s * 70, 20, s * 20, 10, 0, 0); ctx.fill(); });
      circle(ctx, 0, 0, 22, '#1fa8d0'); ctx.restore();
    }
    ctx.restore();
    const lt = seg(u, L('Паскаля') - 0.1, L('Паскаля') + 0.6);
    if (lt > 0) { ctx.save(); ctx.globalAlpha = cinA; kineticWord(ctx, 'ПАРИ ПАСКАЛЯ', 960, 760, 76, lt, { color: '#fff7e6', shadow: 'rgba(60,20,40,0.4)' }); ctx.restore(); }
  }
  // infinitely many imaginary machines
  const anni = seg(u, L('гасят') - 0.3, L('друга') + 0.5);
  if (many > 0) {
    MACH.forEach((m, i) => {
      const p = pop(many, (m.ring - 1) * 0.1 + (i % 10) * 0.01, 0.25, 2);
      const gone = seg(anni, 0.25 + (m.ring - 1) * 0.06, 0.4 + (m.ring - 1) * 0.06);
      if (p <= 0 || gone >= 1) return;
      const r = 300 + m.ring * 190, x = 960 + Math.cos(m.ang + t * 0.03 * (m.pair ? 1 : -1)) * r * 1.5, y = 560 + Math.sin(m.ang + t * 0.03) * r * 0.8;
      const sc = 0.32 / Math.sqrt(m.ring) * p * (1 - gone);
      aiCore(ctx, x, y, sc, t + m.ph, { rings: 0.6, look: [Math.cos(m.ph), Math.sin(m.ph)], tint: m.c === PAL.mag ? 0.8 : 0 });
      if (gone > 0) { ctx.strokeStyle = rgba('#ffffff', 1 - gone); ctx.lineWidth = 4; circle(ctx, x, y, 30 + gone * 120); ctx.stroke(); }
    });
  }
  // the two that contradict each other, with you between them
  const one = E.outBack(seg(u, L('Одна') - 0.2, L('Одна') + 0.3)), two = E.outBack(seg(u, L('Другая') - 0.2, L('Другая') + 0.3));
  const clash = E.in3(seg(u, L('Угрозы') - 0.1, L('гасят') + 0.15)), boom = seg(u, L('гасят') + 0.15, L('гасят') + 0.9);
  const you = seg(u, L('Одна') - 0.4, L('Одна'));
  if (you > 0) dude(ctx, 960, 900, 220, t, { body: '#4f7cff', alpha: you, look: [two > 0.5 ? 0.9 : -0.9, -0.4], mood: boom > 0 ? 'happy' : 'scared', arms: boom > 0.3 ? 'shrug' : 'down', seed: 0.3 });
  if (boom < 1) {
    if (one > 0) { const x = lerp(480, 960, clash), y = lerp(430, 420, clash); aiCore(ctx, x, y, 0.55 * one * (1 - boom), t, { tint: 1, look: [0.6, 0.6], slit: 0.15 }); if (clash < 0.2) label(ctx, 'накажу, если НЕ помог', 480, 640, 32, { color: '#fff', bg: PAL.magD, weight: 700, font: 'Montserrat', alpha: one * (1 - clash * 5) }); }
    if (two > 0) { const x = lerp(1440, 960, clash), y = lerp(430, 420, clash); aiCore(ctx, x, y, 0.55 * two * (1 - boom), t, { look: [-0.6, 0.6], slit: 0.15 }); if (clash < 0.2) label(ctx, 'накажу, если помог', 1440, 640, 32, { color: '#120d40', bg: PAL.cyan, weight: 700, font: 'Montserrat', alpha: two * (1 - clash * 5) }); }
  }
  if (boom > 0 && boom < 1) { const R = rng(12); for (let i = 0; i < 40; i++) { const a = R() * TAU, s = 100 + R() * 600; circle(ctx, 960 + Math.cos(a) * s * E.out3(boom), 420 + Math.sin(a) * s * E.out3(boom), 10 * (1 - boom) + 2, R() < 0.5 ? PAL.mag : PAL.cyan); } }
  ctx.restore();
  flash(ctx, (1 - seg(u, L('гасят') + 0.15, L('гасят') + 0.5)) * (u > L('гасят') + 0.15 ? 0.3 : 0));
  vignette(ctx, 0.35);
}

// S13 — the real lesson: fear clings to ideas; safe AI comes from people who think ahead
function tendril(ctx, x0, y0, x1, y1, w, k, t, seed) {
  if (k <= 0) return;
  const R = rng(seed); const n = 24; ctx.strokeStyle = '#2a0f3a'; ctx.lineCap = 'round';
  let px = x0, py = y0;
  for (let i = 1; i <= n * k; i++) { const q = i / n; const x = lerp(x0, x1, q) + Math.sin(q * 9 + t * 2 + seed) * 30 * (1 - q), y = lerp(y0, y1, q) + Math.cos(q * 7 + t * 1.7 + seed) * 30 * (1 - q); ctx.lineWidth = w * (1 - q * 0.8); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke(); px = x; py = y; }
}
function s13(ctx, u, d, t) {
  const L = (id, n = 0) => lw('lesson', id, n);
  const dawn = E.inOut(seg(u, L('Безопасный') - 0.6, L('Безопасный') + 0.8));
  const cam0 = camKeys([{ t: 0, v: [1000, 430, 1.25, 0.01] }, { t: L('страх'), v: [800, 450, 1.1, -0.01] }, { t: L('идеи') + 0.4, v: [960, 560, 0.9, 0.0] }, { t: L('Безопасный') + 0.6, v: [960, 560, 0.95, 0.0] }, { t: d, v: [960, 540, 1.02, 0.0] }], u);
  const cam = { ...cam0, y: cam0.y - dawn * 0 };
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, mix('#0b0828', '#3a7bd5', dawn)); g.addColorStop(1, mix('#241a5e', '#ffc58a', dawn)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); applyCam(ctx, cam, 0.2); ctx.globalAlpha = 1 - dawn; drawStars(ctx, STARS[0], t, '#ffffff', 0.4); ctx.restore();
  glow(ctx, W * 0.5, H * 1.1, 1100, rgba('#ffe0a0', 0.6), dawn);
  ctx.save(); applyCam(ctx, cam, 1);
  const dark = 1 - dawn;
  if (dark > 0) {
    ctx.save(); ctx.globalAlpha = dark;
    // "not about vengeful machines": a small serpent fades under a strike
    const sn = seg(u, L('мстительных') - 0.4, L('мстительных')) * (1 - seg(u, L('А') - 0.2, L('А') + 0.2));
    if (sn > 0) { ctx.save(); ctx.globalAlpha *= sn; serpentHead(ctx, 1260, 330, 0.8, t, { flip: true, angry: true }); ctx.strokeStyle = PAL.amber; ctx.lineWidth = 16; ctx.lineCap = 'round'; const k = seg(u, L('машинах') - 0.2, L('машинах') + 0.2); ctx.beginPath(); ctx.moveTo(1060, 200); ctx.lineTo(lerp(1060, 1480, k), lerp(200, 570, k)); ctx.stroke(); ctx.restore(); }
    // the idea and fear clinging to it, then jumping from head to head
    const ia = seg(u, 0, 0.5);
    ideaOrb(ctx, 760, 380, 46 * ia, t, { color: mix(PAL.amber, '#a58a9a', seg(u, L('цепляется'), L('идеи') + 0.5)) });
    const ur = seg(u, L('урок') - 0.2, L('урок') + 0.5) * (1 - seg(u, L('А') - 0.3, L('А') + 0.1));
    if (ur > 0) kineticWord(ctx, 'НАСТОЯЩИЙ УРОК', 960, 640, 72, ur, { color: PAL.amber, shadow: 'rgba(5,3,30,0.6)' });
    const cl = seg(u, L('страх') - 0.2, L('цепляется') + 0.6);
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.3; tendril(ctx, 760 + Math.cos(a) * 500, 380 + Math.sin(a) * 420, 760 + Math.cos(a) * 50, 380 + Math.sin(a) * 50, 26, cl, t, k * 7); }
    const crowd = seg(u, L('за') - 0.2, L('идеи') + 0.8);
    if (crowd > 0) for (let i = 0; i < 8; i++) {
      const x = 260 + i * 200, k = seg(crowd, i * 0.08, i * 0.08 + 0.3);
      mini(ctx, x, 980, 150, ['#7aa2ff', '#ff8fb8', '#2fd6b0', '#ffb547', '#a68cff'][i % 5], { squash: 1 - 0.05 * k });
      if (k > 0) { ideaOrb(ctx, x, 770, 16 * k, t + i, { color: '#a58a9a', glow: 0.4 }); for (let j = 0; j < 3; j++) tendril(ctx, x + (j - 1) * 50, 860, x, 780, 8, k, t, i * 5 + j); }
    }
    label(ctx, 'СТРАХ', 760, 120, 64, { color: '#d9b8ff', weight: 900, alpha: seg(u, L('страх') - 0.1, L('страх') + 0.3) });
    ctx.restore();
  }
  if (dawn > 0) {
    ctx.save(); ctx.globalAlpha = dawn;
    // a blueprint table: people design a safe AI together
    rrect(ctx, 300, 640, 1320, 60, 20); ctx.fillStyle = '#7a4a2f'; ctx.fill();
    ctx.save(); ctx.translate(960, 520); ctx.transform(1, 0, -0.25, 0.45, 0, 0);
    rrect(ctx, -500, -260, 1000, 520, 18); ctx.fillStyle = '#2a5fd4'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; for (let x = -480; x < 500; x += 40) { ctx.beginPath(); ctx.moveTo(x, -250); ctx.lineTo(x, 250); ctx.stroke(); } for (let y = -240; y < 260; y += 40) { ctx.beginPath(); ctx.moveTo(-490, y); ctx.lineTo(490, y); ctx.stroke(); }
    ctx.strokeStyle = '#e9f6ff'; ctx.lineWidth = 6; const dr = seg(u, L('Безопасный'), L('создают') + 0.5);
    ctx.beginPath(); ctx.arc(0, 0, 170, -Math.PI / 2, -Math.PI / 2 + TAU * dr); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 300, 90, 0.2, 0, TAU * dr); ctx.stroke();
    ctx.restore();
    // the safe core hovering over the plan
    const cp = E.outBack(seg(u, L('интеллект') - 0.3, L('интеллект') + 0.4));
    if (cp > 0) aiCore(ctx, 960, 280, 0.75 * cp, t, { warm: 0.25, look: [0, 0.6], slit: 0.45 });
    // shield with a check
    const sh = E.outBack(seg(u, L('хорошо') - 0.2, L('хорошо') + 0.3), 2);
    if (sh > 0) { ctx.save(); ctx.translate(1180, 200); ctx.scale(sh, sh); ctx.fillStyle = PAL.teal; ctx.beginPath(); ctx.moveTo(0, -80); ctx.quadraticCurveTo(70, -70, 75, -50); ctx.quadraticCurveTo(75, 40, 0, 95); ctx.quadraticCurveTo(-75, 40, -75, -50); ctx.quadraticCurveTo(-70, -70, 0, -80); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-30, 5); ctx.lineTo(-5, 32); ctx.lineTo(38, -22); ctx.stroke(); ctx.restore(); }
    // "not threats": a crossed-out threat letter
    const nt = pop(u, L('не', 1) - 0.2, 0.35) * (1 - seg(u, L('люди') - 0.2, L('люди') + 0.2));
    if (nt > 0) { ctx.save(); ctx.translate(1550, 380); ctx.scale(nt, nt); envelope(ctx, 0, 0, 1.2, -0.1); ctx.strokeStyle = PAL.white; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-90, -70); ctx.lineTo(90, 70); ctx.stroke(); ctx.restore(); }
    // the people
    const pp = seg(u, L('люди') - 0.3, L('люди') + 0.6);
    [[420, '#ff8fb8', 'work'], [640, '#2fd6b0', 'wave'], [1300, '#ffb547', 'work'], [1520, '#7aa2ff', 'up']].forEach(([x, c, arms], i) => {
      const p = E.outBack(seg(pp, i * 0.15, i * 0.15 + 0.4)); if (p <= 0) return;
      dude(ctx, x, 980, 230 * p, t, { body: c, arms, mood: 'happy', look: [x < 960 ? 0.6 : -0.6, -0.4], seed: i * 0.2 });
    });
    ctx.restore();
  }
  ctx.restore();
  vignette(ctx, 0.45 - 0.15 * dawn);
}

// S14 — sleep well. Probably.
function s14(ctx, u, d, t) {
  const L = (id, n = 0) => lw('ending', id, n);
  const cam = camKeys([{ t: 0, v: [1000, 560, 1.14, 0.012] }, { t: d, v: [930, 530, 0.96, -0.006] }], u);
  ctx.fillStyle = '#0c0a30'; ctx.fillRect(0, 0, W, H);
  const eu = L('Наверное') + 0.35;
  const eo = Math.min(E.out3(seg(u, eu, eu + 0.3)), 1 - E.in2(seg(u, eu + 0.95, eu + 1.25)));
  layer(ctx, 2.5, g => {
    applyCam(g, cam, 0.85);
    g.fillStyle = '#151150'; g.fillRect(-300, -300, 2600, 1700);
    rrect(g, 310, 200, 460, 380, 14); g.fillStyle = '#060418'; g.fill();
    g.save(); rrect(g, 330, 220, 420, 340, 8); g.clip();
    const sg = g.createLinearGradient(0, 220, 0, 560); sg.addColorStop(0, '#08062c'); sg.addColorStop(1, '#2a1c66'); g.fillStyle = sg; g.fillRect(330, 220, 420, 340);
    const R = rng(3); for (let i = 0; i < 40; i++) { g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + R()) + i)); circle(g, 330 + R() * 420, 220 + R() * 340, 1 + R() * 2, '#ffffff'); } g.globalAlpha = 1;
    circle(g, 680, 290, 34, '#f4e7c4'); circle(g, 696, 280, 32, '#151150');
    if (eo > 0.01) eye(g, 540, 400, 250, eo, -0.5, 0.1, 0.25); else if (u > eu) eye(g, 540, 400, 250, 0.02, 0, 0, 0.2);
    g.restore();
    g.fillStyle = '#060418'; g.fillRect(536, 200, 8, 380); g.fillRect(310, 386, 460, 8);
    g.fillStyle = '#2b2275'; g.beginPath(); g.moveTo(250, 170); g.quadraticCurveTo(330, 420, 270, 640); g.lineTo(220, 640); g.lineTo(220, 170); g.fill();
    // a small shelf with the idea-lamp, now a night-light
    g.fillStyle = '#2b2275'; g.fillRect(1450, 360, 300, 14); ideaOrb(g, 1600, 330, 16, t, { glow: 0.5 });
  });
  ctx.save(); applyCam(ctx, cam, 1);
  ctx.fillStyle = '#3d33a0'; rrect(ctx, 820, 470, 60, 400, 18); ctx.fill();
  ctx.fillStyle = '#2b2275'; ctx.fillRect(820, 740, 1000, 140);
  rrect(ctx, 880, 600, 260, 110, 50); ctx.fillStyle = '#e3e6ff'; ctx.fill();
  circle(ctx, 1010, 610, 62, PAL.skin);
  ctx.save(); circle(ctx, 1010, 610, 62); ctx.clip(); circle(ctx, 960, 570, 70, PAL.hair); ctx.restore();
  const peek = seg(u, eu + 0.1, eu + 0.3) * (1 - seg(u, eu + 1.3, eu + 1.6));
  if (peek > 0.5) { circle(ctx, 1030, 612, 9, '#1a1030'); circle(ctx, 1000, 616, 9, '#1a1030'); }
  else { ctx.strokeStyle = '#7a4f35'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(1030, 612, 10, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.beginPath(); ctx.arc(1000, 616, 10, 0.2, Math.PI - 0.2); ctx.stroke(); }
  const br = 1 + 0.035 * Math.sin(u * 2.4);
  ctx.save(); ctx.translate(1040, 760); ctx.scale(1, br);
  ctx.beginPath(); ctx.moveTo(30, 0); ctx.quadraticCurveTo(60, -120, 300, -110); ctx.quadraticCurveTo(620, -100, 760, -40); ctx.lineTo(780, 0); ctx.closePath(); ctx.fillStyle = '#4f7cff'; ctx.fill();
  ctx.fillStyle = 'rgba(0,0,20,0.18)'; ctx.beginPath(); ctx.moveTo(30, 0); ctx.quadraticCurveTo(300, -50, 780, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (peek <= 0.5) for (let i = 0; i < 3; i++) { const k = ((u * 0.6 + i / 3) % 1); ctx.save(); ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9; label(ctx, 'z', 1110 + k * 90 + i * 20, 520 - k * 170, 34 + i * 12, { color: '#c9c6ff' }); ctx.restore(); }
  ctx.restore();
  if (eo > 0) glow(ctx, W / 2 + (540 - cam.x) * cam.z, H / 2 + (400 - cam.y) * cam.z, 420, rgba(PAL.cyanD, 0.5), eo * 0.6);
  vignette(ctx, 0.6);
  const fo = seg(u, d - 1.6, d - 0.6); fadeBlack(ctx, fo, '0,0,0');
  fadeBlack(ctx, 1 - seg(u, 0, 0.5), '3,2,16');
}

// ================= timeline =================
const SCENES = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14];
function drawScene(ctx, t) {
  let i = 0; while (i < SCENES.length - 1 && t >= Bd[i + 1]) i++;
  SCENES[i](ctx, t - Bd[i], Bd[i + 1] - Bd[i], t);
}
function drawOverlay(ctx, t) { grain(ctx, t, 0.07); }
// motion blur: heavier around the fast transitions, light elsewhere
const FAST = [Bd[2], Bd[3], Bd[4], at('basilisk', 'слышал', 1), Bd[9], at('ban', '2018') - 0.4];
function mbFn(t) {
  for (const b of FAST) if (Math.abs(t - b) < 0.5) return { n: 6, shutter: 1.0 / FPS };
  return { n: 2, shutter: 0.5 / FPS };
}

// ================= sound events (engine/dump_events.py → score.py) =================
function events() {
  const ev = []; const A = (n, t, x = {}) => ev.push({ n, t, ...x });
  const w = (id, word, n = 0) => at(id, word, n);
  // S1
  A('drone', 0); A('sparkle', w('hook', 'идея') - 0.5); A('warn', w('hook', 'опасной'));
  SYMS.forEach((m, i) => A('tink', w('hook', 'формул') - 0.25 + m.tw, { i })); A('pop', w('hook', 'секретов') - 0.15);
  A('swish', w('hook', 'А') - 0.05); A('absorb', w('hook', 'узнать') + 0.15); A('board', w('hook', 'игре') - 0.25);
  // S2
  A('eye_open', w('welcome', 'что') - 0.1); A('lock', w('welcome', 'добро')); A('title_hit', w('welcome', 'пожаловать'));
  A('dive', Bd[2] - 0.75); A('hit_low', Bd[2]);
  // S3
  A('flip', w('forum', 'Июль')); A('pop', w('forum', 'Форум') - 0.2);
  for (let i = 0; i < 3; i++) A('chat', w('forum', 'спорили') - 0.2 + i * 0.18, { i });
  { const a = w('forum', 'Пользователь'), b = w('forum', 'эксперимент') + 0.5; for (let k = 0, tt = a; tt < b; k++, tt += 0.07 + ((k * 7) % 5) * 0.012) A('key', tt); }
  A('sparkle', w('forum', 'мысленный')); A('glyph_whoosh', Bd[3] - 0.75);
  // S4
  A('rise', Bd[3] + 0.2, { d: 1.8 }); A('core', w('superintelligence', 'сверхразум') - 0.3); A('pullback', w('superintelligence', 'умнее'), { d: 1.6 });
  A('warm', w('superintelligence', 'делать') - 0.2); A('burst', w('superintelligence', 'болезни') + 0.35); A('freeze', w('superintelligence', 'старение'));
  for (let i = 0; i < 9; i++) A('soft_pop', w('superintelligence', 'миллиарды') + i * 0.13, { i });
  // S5
  { const a = w('every_day', 'около') - 0.1, b = w('every_day', 'тысяч') + 0.35; for (let k = 0; k < 22; k++) A('tick', a + (b - a) * E.out3(k / 22) * 0.98); }
  for (let i = 0; i < 13; i++) A('tile', w('every_day', 'каждый', 1) + i * 0.09, { i });
  for (let i = 0; i < 13; i += 2) A('thud_soft', w('every_day', 'смерти') - 0.2 + i * 0.07);
  A('slide', w('every_day', 'выгодно') - 0.2, { d: w('every_day', 'раньше') - w('every_day', 'выгодно') + 0.5 });
  for (let i = 0; i < 8; i++) A('chime', w('every_day', 'выгодно') + 0.3 + i * 0.22, { i });
  A('title_hit', w('every_day', 'раньше'));
  // S6
  A('sting', w('threat', 'жуткий') - 0.2); A('scan', w('threat', 'всех'), { d: 1.6 });
  PAST.forEach(p => { if (p.knew) A('ping', w('threat', 'всех') + (p.x - 200) / 1000 * 1.6); });
  PAST.forEach((p, i) => { if (p.knew && p.idle) A('target', w('threat', 'помог') - 0.1 + i * 0.05); });
  A('calm_bell', w('threat', 'злобы') - 0.3); A('signal', w('threat', 'угроза') - 0.1, { d: w('threat', 'заставила') - w('threat', 'угроза') + 0.5 });
  A('alarm', w('threat', 'заставила') + 0.4); A('gears', w('threat', 'работать') - 0.5, { d: Bd[6] - w('threat', 'работать') + 0.5 });
  // S7
  A('ghost', w('copy', 'давно') - 0.2); A('stone', w('copy', 'умер') + 0.1); A('hum', w('copy', 'Сверхразум') - 0.4, { d: w('copy', 'кто', 1) - w('copy', 'Сверхразум') + 0.4 });
  A('scanner', w('copy', 'воссоздать'), { d: w('copy', 'копию') + 0.2 - w('copy', 'воссоздать') });
  A('pop', w('copy', 'точную') - 0.1); A('pop', w('copy', 'думает') - 0.1); A('heart', w('copy', 'чувствует'));
  A('void', w('copy', 'кто', 1) - 0.3, { d: Bd[7] - w('copy', 'кто', 1) + 0.3 }); A('blink', w('copy', 'ты', 1) + 0.6);
  // S8
  A('morph', Bd[7] + 0.1); A('hiss', Bd[7] + 1.35); A('title_hit', w('basilisk', 'Василиск'));
  A('zap', w('basilisk', 'взглядом') - 0.2); A('crack', w('basilisk', 'взглядом') + 0.4);
  A('zap', w('basilisk', 'знание') - 0.3); A('crack', w('basilisk', 'знание') + 0.3); A('shield', w('basilisk', 'Пока') - 0.3);
  A('bulb', w('basilisk', 'Теперь')); A('big_sting', w('basilisk', 'слышал', 1) - 0.12);
  // S9
  A('whoosh', Bd[8] + 0.05); A('stamp', w('ban', 'удалил') + 0.05); A('lock_drop', w('ban', 'пять'));
  { const c0 = w('ban', 'лет') - 0.1, c1 = w('ban', 'обсуждение') + 0.6; for (let k = 1; k <= 5; k++) A('tick', c0 + (c1 - c0) * (k - 0.3) / 5.999); }
  A('shatter', w('ban', 'предсказуем') + 0.1); A('swarm', w('ban', 'разлетелась') - 0.3, { d: 2.2 }); A('title_hit', w('ban', 'запретная') - 0.1);
  A('whip', w('ban', '2018') - 0.6); A('pop', w('ban', 'шутка') - 0.1); A('pop', w('ban', 'Илона') - 0.2); A('pop', w('ban', 'певицу') - 0.1); A('heart', w('ban', 'познакомила'));
  // S10
  A('dawn', Bd[9] + 0.1); A('title_hit_soft', w('no_effect', 'хорошие')); A('badge', w('no_effect', 'Первое') - 0.05);
  A('pop', w('no_effect', 'когда') - 0.1); A('pop', w('no_effect', 'сверхразум') - 0.1); A('zip', w('no_effect', 'месть') - 0.1, { d: 1.2 });
  A('shatter', w('no_effect', 'изменит') + 0.2); A('boing', w('no_effect', 'изменит') + 0.35); A('grind', w('no_effect', 'Прошлое') - 0.1, { d: 1.0 });
  A('lock_click', w('no_effect', 'перепишешь')); A('drain', w('no_effect', 'ресурсы') - 0.2, { d: 1.5 }); A('title_hit_soft', w('no_effect', 'нерационально'));
  // S11
  A('badge', w('blackmail', 'Второе') - 0.05); A('whoosh', w('blackmail', 'шантаж') - 0.1); A('boing', w('blackmail', 'жертва'));
  A('shield', w('blackmail', 'решил') - 0.1); A('whoosh', w('blackmail', 'правилам') - 0.5); A('bounce', w('blackmail', 'угроз') + 0.2);
  A('deflate', w('blackmail', 'бессмысленно') - 0.1); A('hiss', w('blackmail', 'тронет') + 0.1);
  // S12
  A('badge', w('pascal', 'Третье') - 0.05); A('coin', w('pascal', 'пари') - 0.3, { d: 1.5 }); A('ting', w('pascal', 'пари') + 1.2); A('pop_big', w('pascal', 'обёртке') - 0.15);
  for (let i = 0; i < 24; i++) A('soft_pop', w('pascal', 'бесконечно') - 0.3 + i * 0.07, { i });
  A('pop', w('pascal', 'Одна') - 0.1); A('pop', w('pascal', 'Другая') - 0.1); A('rise', w('pascal', 'Угрозы') - 0.4, { d: 0.9 }); A('boom', w('pascal', 'гасят') + 0.15);
  for (let i = 0; i < 16; i++) A('soft_pop', w('pascal', 'гасят') + 0.4 + i * 0.05, { i: i + 3 });
  // S13
  A('swish', w('lesson', 'машинах') - 0.2); A('creep', w('lesson', 'страх') - 0.3, { d: 2.2 }); A('dawn_rise', w('lesson', 'Безопасный') - 0.7, { d: 1.4 });
  A('scribble', w('lesson', 'Безопасный'), { d: 1.6 }); A('core', w('lesson', 'интеллект') - 0.2); A('pop', w('lesson', 'не', 1) - 0.2);
  for (let i = 0; i < 4; i++) A('soft_pop', w('lesson', 'люди') - 0.3 + i * 0.15, { i: i + 2 }); A('ding', w('lesson', 'хорошо') - 0.1);
  // S14
  const eu = w('ending', 'Наверное') + 0.35; A('eye_sting', eu); A('end_hit', eu + 0.02);
  return { events: ev.sort((a, b) => a.t - b.t), Bd, END, lines: N.lines };
}
window.VIDEO = { drawScene, drawOverlay, mbFn, END, Bd, events };
