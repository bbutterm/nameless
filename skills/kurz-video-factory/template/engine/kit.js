// Shared drawing kit for all videos: palette, sky, characters, the eye, the AI core, typography.
// Loaded after lib.js and before the video. Videos may extend PAL (Object.assign) and override any function.
'use strict';
const PAL = {
  bg0: '#0b0828', bg1: '#241a5e', ind: '#1a1450', ind2: '#2b2275', ind3: '#3d33a0',
  cyan: '#5ce1ff', cyanD: '#1f7fd6', ice: '#bff3ff', mag: '#ff3b6b', magD: '#b81d4a', amber: '#ffb547', amberD: '#d9831f',
  white: '#f2f5ff', skin: '#f6c7a1', skinD: '#d99c76', hair: '#2a1d3f', teal: '#2fd6b0', pink: '#ff8fb8', lilac: '#a68cff',
};

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
  return { x: cx + ex * c - ey * s, y: cy + ex * s + ey * c, front: Math.sin(ang) > 0, a: ang + RING_ROT[b.k] };
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
  const clipsK = o.clips || 0; // 0 = round beads, 1 = the beads are paperclips
  const drawBeads = (front) => {
    for (const b of BEADS) {
      const p = beadPos(b, t, cx, cy, sc * grow); if (p.front !== front) continue;
      const a0 = ringA * (front ? 1 : 0.55);
      if (clipsK < 1) { ctx.globalAlpha = a0 * (1 - clipsK); circle(ctx, p.x, p.y, 7 * sc, front ? '#e9fbff' : lc); }
      if (clipsK > 0) { ctx.globalAlpha = a0 * clipsK; paperclip(ctx, p.x, p.y, 30 * sc, p.a, front ? '#e3ebf7' : '#8fa0bd'); }
    }
    ctx.globalAlpha = 1;
  };
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

function heart(ctx, x, y, r, c) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, r * 0.9);
  ctx.bezierCurveTo(-r * 1.6, -r * 0.2, -r * 0.8, -r * 1.3, 0, -r * 0.45); ctx.bezierCurveTo(r * 0.8, -r * 1.3, r * 1.6, -r * 0.2, 0, r * 0.9); ctx.fill(); ctx.restore();
}
function gear(ctx, x, y, r, rot, c) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = c;
  ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; ctx.rect(Math.cos(a) * r - 0, Math.sin(a) * r - 0, 0, 0); }
  for (let k = 0; k < 10; k++) { ctx.save(); ctx.rotate(k / 10 * TAU); ctx.fillRect(-r * 0.16, -r * 1.25, r * 0.32, r * 0.4); ctx.restore(); }
  circle(ctx, 0, 0, r, c); circle(ctx, 0, 0, r * 0.4, '#1a1450'); ctx.restore();
}
function envelope(ctx, x, y, s, rot, c = PAL.mag) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,20,0.3)'; rrect(ctx, -56, -34, 120, 80, 10); ctx.fill();
  rrect(ctx, -60, -40, 120, 80, 10); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = '#ffd2dc'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-60, -38); ctx.lineTo(0, 8); ctx.lineTo(60, -38); ctx.stroke();
  label(ctx, '!', 0, 10, 40, { color: '#fff', weight: 900 }); ctx.restore();
}
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

// A paperclip (Gem shape) drawn as one wire: s = length in px, rot = rotation, lying along its long axis
function paperclip(ctx, x, y, s, rot, color = '#d6deec', o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const path = () => {
    ctx.beginPath(); ctx.moveTo(0.05, 0.12); ctx.lineTo(0.05, -0.31); ctx.arc(-0.02, -0.31, 0.07, 0, Math.PI, true);
    ctx.lineTo(-0.09, 0.29); ctx.arc(0.015, 0.29, 0.105, Math.PI, 0, true); ctx.lineTo(0.12, -0.37);
    ctx.arc(0, -0.37, 0.12, 0, Math.PI, true); ctx.lineTo(-0.12, 0.18);
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (o.shadow) { ctx.save(); ctx.translate(0.03, 0.03); path(); ctx.strokeStyle = 'rgba(0,0,20,0.35)'; ctx.lineWidth = o.w || 0.04; ctx.stroke(); ctx.restore(); }
  path(); ctx.strokeStyle = color; ctx.lineWidth = o.w || 0.04; ctx.stroke();
  if (!o.flat) { path(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = (o.w || 0.04) * 0.35; ctx.translate(-0.008, -0.008); ctx.stroke(); }
  ctx.restore();
}

// Scene boundaries from narration lines: midway in the gap before each line, never later than 0.25 s before its first word.
// returns { Bd, S, lw } — lw(lineId, 'word', n) is the word time local to that line's scene
function sceneTimeline(N, ids) {
  const Bd = [0];
  for (let i = 1; i < ids.length; i++) { const p = N.line(ids[i - 1]), c = N.line(ids[i]); Bd.push(Math.min(c.t0 - 0.25, (p.t1 + c.t0) / 2 + 0.1)); }
  Bd.push(N.END);
  const S = {}; ids.forEach((id, i) => S[id] = i);
  return { Bd, S, lw: (id, word, n = 0) => N.at(id, word, n) - Bd[S[id]] };
}
