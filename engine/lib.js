// Shared motion engine: deterministic timeline, camera spline, parallax, DOF layers, motion blur, subtitles.
'use strict';
const W = 1920, H = 1080, FPS = 60;
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  lin: t => t,
  in2: t => t * t,
  out2: t => 1 - (1 - t) * (1 - t),
  in3: t => t * t * t,
  out3: t => 1 - Math.pow(1 - t, 3),
  inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inOut2: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  outElastic: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1,
};
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Hermite spline through keyframes [{t, v:[..]}] with time-scaled tangents (continuous velocity, no stop at keys)
function spline(keys, t) {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].v.slice();
  if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
  let i = 0; while (i < n - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const dt = k1.t - k0.t, s = (t - k0.t) / dt;
  const tan = (j) => {
    const a = keys[Math.max(0, j - 1)], b = keys[Math.min(n - 1, j + 1)];
    if (keys[j].hold) return keys[j].v.map(() => 0);
    return keys[j].v.map((_, d) => (b.v[d] - a.v[d]) / (b.t - a.t));
  };
  const m0 = tan(i), m1 = tan(i + 1);
  const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s, h01 = -2 * s * s * s + 3 * s * s, h11 = s * s * s - s * s;
  return k0.v.map((p0, d) => h00 * p0 + h10 * dt * m0[d] + h01 * k1.v[d] + h11 * dt * m1[d]);
}

// Camera: c = {x, y, z, r}. p = parallax factor (1 = main plane, <1 far, >1 near)
function applyCam(ctx, c, p = 1) {
  const z = Math.pow(c.z, p);
  ctx.translate(W / 2, H / 2);
  ctx.rotate(c.r || 0);
  ctx.scale(z, z);
  ctx.translate(-(W / 2 + (c.x - W / 2) * p), -(H / 2 + (c.y - H / 2) * p));
}
function camKeys(keys, t) { const v = spline(keys, t); return { x: v[0], y: v[1], z: v[2], r: v[3] || 0 }; }

// Offscreen pools for blurred (DOF) layers rendered at half resolution
const pool = {};
function off(name, w, h) {
  if (!pool[name]) { const c = document.createElement('canvas'); c.width = w; c.height = h; pool[name] = { c, g: c.getContext('2d') }; }
  return pool[name];
}
// Draw a layer with depth-of-field blur. fn(ctx) draws in screen space (apply camera inside).
function layer(ctx, blur, fn) {
  if (blur < 0.6) { ctx.save(); fn(ctx); ctx.restore(); return; }
  const a = off('la', W / 2, H / 2), b = off('lb', W / 2, H / 2);
  a.g.setTransform(1, 0, 0, 1, 0, 0); a.g.clearRect(0, 0, W / 2, H / 2);
  a.g.save(); a.g.scale(.5, .5); fn(a.g); a.g.restore();
  b.g.setTransform(1, 0, 0, 1, 0, 0); b.g.clearRect(0, 0, W / 2, H / 2);
  b.g.filter = `blur(${(blur / 2).toFixed(2)}px)`; b.g.drawImage(a.c, 0, 0); b.g.filter = 'none';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(b.c, 0, 0, W, H); ctx.restore();
}

// Shapes
function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } }
function rrect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function glow(ctx, x, y, r, color, a = 1) {
  if (r <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
}
// Flat-vector ball: base fill + shadow crescent + rim light
function ball(ctx, x, y, r, base, shadow, light, ang = -0.8) {
  ctx.save(); circle(ctx, x, y, r, base); ctx.clip();
  if (shadow) { ctx.beginPath(); ctx.rect(x - r - 2, y - r - 2, 2 * r + 4, 2 * r + 4); ctx.arc(x + Math.cos(ang) * r * 0.32, y + Math.sin(ang) * r * 0.32, r * 1.02, 0, TAU, true); ctx.fillStyle = shadow; ctx.fill('evenodd'); }
  if (light) { circle(ctx, x + Math.cos(ang) * r * 0.45, y + Math.sin(ang) * r * 0.45, r * 0.28, light); }
  ctx.restore();
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; }
function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }

// Stars: layers with parallax; built once
function makeStars(seed, count, spreadX, spreadY, rMin, rMax) {
  const R = rng(seed); const s = [];
  for (let i = 0; i < count; i++) s.push({ x: (R() - .5) * spreadX + W / 2, y: (R() - .5) * spreadY + H / 2, r: lerp(rMin, rMax, Math.pow(R(), 2)), ph: R() * TAU, f: 0.6 + R() * 2.2, a: 0.35 + R() * 0.65 });
  return s;
}
function drawStars(ctx, stars, t, color = '#ffffff', tw = 0.5) {
  ctx.fillStyle = color;
  for (const s of stars) {
    ctx.globalAlpha = s.a * (1 - tw + tw * (0.5 + 0.5 * Math.sin(t * s.f + s.ph)));
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Subtitles: lines [{t0,t1,text}], each text may be split with '|' into chunks (time split by char count)
function subChunks(lines) {
  const out = [];
  for (const L of lines) {
    const parts = L.text.split('|').map(s => s.trim());
    const total = parts.reduce((a, p) => a + p.length, 0);
    let acc = 0;
    parts.forEach(p => { const a = L.t0 + (L.t1 - L.t0) * acc / total; acc += p.length; const b = L.t0 + (L.t1 - L.t0) * acc / total; out.push({ t0: a, t1: b, text: p }); });
  }
  // keep each chunk on screen until the next starts (if gap is short)
  for (let i = 0; i < out.length - 1; i++) if (out[i + 1].t0 - out[i].t1 < 0.6) out[i].t1 = out[i + 1].t0;
  return out;
}
function drawSubs(ctx, chunks, t, opt) {
  const c = chunks.find(k => t >= k.t0 - 0.05 && t < k.t1 + 0.25);
  if (!c) return;
  const a = clamp(Math.min((t - c.t0 + 0.05) / 0.12, (c.t1 + 0.25 - t) / 0.18));
  const rise = (1 - E.out3(clamp((t - c.t0 + 0.05) / 0.25))) * 14;
  ctx.save();
  ctx.font = opt.font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = a;
  const y = H - opt.bottom + rise;
  ctx.lineJoin = 'round'; ctx.lineWidth = opt.stroke; ctx.strokeStyle = opt.strokeColor; ctx.strokeText(c.text, W / 2, y);
  ctx.fillStyle = opt.color; ctx.fillText(c.text, W / 2, y);
  ctx.restore();
}

// Frame renderer with motion blur by sub-frame accumulation (shutter in seconds)
function makeRenderer(canvas, drawScene, drawOverlay, mbFn) {
  const main = canvas.getContext('2d');
  const scratch = off('scratch', W, H);
  return function renderAt(t) {
    const { n, shutter } = mbFn ? mbFn(t) : { n: 3, shutter: 0.6 / FPS };
    main.setTransform(1, 0, 0, 1, 0, 0); main.globalAlpha = 1; main.globalCompositeOperation = 'source-over';
    if (n <= 1) { main.clearRect(0, 0, W, H); drawScene(main, t); }
    else {
      for (let k = 0; k < n; k++) {
        const tk = t + ((k + 0.5) / n - 0.5) * shutter;
        const g = scratch.g; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
        g.clearRect(0, 0, W, H); drawScene(g, tk);
        main.globalAlpha = 1 / (k + 1); main.drawImage(scratch.c, 0, 0);
      }
      main.globalAlpha = 1;
    }
    if (drawOverlay) { main.setTransform(1, 0, 0, 1, 0, 0); drawOverlay(main, t); }
  };
}

// ---------- added for the factory ----------
// Film grain: pre-baked noise tiles chosen by frame index (deterministic for any seek order)
const GRAIN = (() => {
  const tiles = []; const R = rng(4242);
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const im = g.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (R() - 0.5) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); tiles.push(c);
  }
  return tiles;
})();
function grain(ctx, t, a = 0.05) {
  const f = Math.floor(t * FPS); const tile = GRAIN[f % GRAIN.length];
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'overlay';
  const pat = ctx.createPattern(tile, 'repeat'); ctx.translate((f * 37) % 256, (f * 91) % 256); ctx.fillStyle = pat; ctx.fillRect(-256, -256, W + 512, H + 512);
  ctx.restore();
}

// Narration clock from window.TIMINGS (engine/align.py): line/word times for syncing animation to the voice.
// at(id, 'слово', n) -> start time of the n-th word in line `id` that starts with 'слово' (case/punctuation-insensitive).
function narration() {
  const T = window.TIMINGS; if (!T) throw new Error('timings.js missing: run engine/align.py');
  const norm = s => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
  const idx = {}; T.lines.forEach((l, i) => idx[l.id] = i);
  const line = id => { const i = idx[id]; if (i === undefined) throw new Error('no line ' + id); return T.lines[i]; };
  const at = (id, word, n = 0) => {
    const i = idx[id]; const w = norm(word); const hits = T.words.filter(x => x[3] === i && norm(x[0]).startsWith(w));
    if (!hits[n]) throw new Error(`no word "${word}"#${n} in ${id}`); return hits[n][1];
  };
  const end = (id, word, n = 0) => { const i = idx[id]; const w = norm(word); return T.words.filter(x => x[3] === i && norm(x[0]).startsWith(w))[n][2]; };
  return { T, line, at, end, chunks: T.chunks, END: T.end, lines: T.lines };
}

// Flat shading without outlines: fill a path, then darken the part not covered by a copy shifted toward the light (dx,dy = shadow offset)
function shaded(ctx, pathFn, base, dark, dx = 10, dy = 10) {
  ctx.save(); pathFn(ctx); ctx.fillStyle = base; ctx.fill(); ctx.clip();
  if (dark) { ctx.beginPath(); ctx.rect(-4000, -4000, 8000, 8000); ctx.translate(-dx, -dy); pathFn(ctx, true); ctx.translate(dx, dy); ctx.fillStyle = dark; ctx.fill('evenodd'); }
  ctx.restore();
}
