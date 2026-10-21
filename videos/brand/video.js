// Channel art (not a video): each second t = k shows avatar variant k. Render with engine/still.py brand 0.5 1.5 … --square 800.
'use strict';
const END = 8, Bd = [0, END];
const CX = W / 2, CY = H / 2;  // the avatar lives in the centre 1080×1080 square
function bgNight(ctx, t) {
  const g = ctx.createRadialGradient(CX, CY - 80, 60, CX, CY, 760); g.addColorStop(0, '#2b2275'); g.addColorStop(1, '#0b0828'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const R = rng(3); ctx.fillStyle = '#ffffff'; for (let i = 0; i < 140; i++) { const x = CX + (R() - 0.5) * 1080, y = CY + (R() - 0.5) * 1080, r = 0.8 + R() * 2.4; ctx.globalAlpha = 0.25 + R() * 0.6; circle(ctx, x, y, r, '#ffffff'); } ctx.globalAlpha = 1;
}
// A — the crown sitting on the world (the channel: big ideas about the world)
function vA(ctx, t) {
  bgNight(ctx, t);
  const v = geoView(45, 28, 350, CX, CY + 215);
  drawGlobe(ctx, v, t, { shade: 0.32, atmo: 0.7 });
  glow(ctx, CX, CY - 150, 420, 'rgba(255,200,90,0.9)', 0.5);
  crown(ctx, CX, CY - 70, 540, t, { glint: 0.5 });
}
// B — crown alone, big and bold (reads best at 40 px)
function vB(ctx, t) {
  bgNight(ctx, t);
  glow(ctx, CX, CY, 520, 'rgba(255,190,80,0.9)', 0.55);
  crown(ctx, CX, CY + 175, 640, t, { glint: 0.55 });
}
// C — crown with an orbit: science + "ruling" ideas
function vC(ctx, t) {
  bgNight(ctx, t);
  ctx.save(); ctx.translate(CX, CY + 20); ctx.rotate(-0.32);
  ctx.strokeStyle = 'rgba(92,225,255,0.85)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(0, 0, 400, 120, 0, Math.PI, TAU); ctx.stroke(); ctx.restore();
  glow(ctx, CX, CY, 420, 'rgba(255,190,80,0.9)', 0.5);
  crown(ctx, CX, CY + 150, 460, t, { glint: 0.8 });
  ctx.save(); ctx.translate(CX, CY + 20); ctx.rotate(-0.32);
  ctx.strokeStyle = 'rgba(92,225,255,0.95)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(0, 0, 400, 120, 0, 0, Math.PI); ctx.stroke();
  ball(ctx, 400 * Math.cos(0.35), 120 * Math.sin(0.35), 46, '#ff3b6b', 'rgba(60,0,30,0.35)', 'rgba(255,255,255,0.35)');
  ctx.restore();
}
// D — warm: crown on the globe at sunrise (stands out on both dark and light YouTube)
function vD(ctx, t) {
  const g = ctx.createRadialGradient(CX, CY + 300, 80, CX, CY, 800); g.addColorStop(0, '#ffcf8a'); g.addColorStop(0.45, '#e98a7a'); g.addColorStop(1, '#3a2f6b'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const v = geoView(45, 28, 350, CX, CY + 215);
  drawGlobe(ctx, v, t, { shade: 0.22, atmo: 0.5, colors: { atmo: '#ffd9a0', ocean: '#1b4f7a', ocean2: '#12365a' } });
  crown(ctx, CX, CY - 70, 540, t, { glint: 0.5 });
}
const VAR = [vA, vB, vD];
function drawScene(ctx, t) { VAR[Math.min(VAR.length - 1, Math.floor(t))](ctx, t); }
window.VIDEO = { drawScene, drawOverlay: null, mbFn: () => ({ n: 1, shutter: 0 }), END, Bd, events: () => ({ events: [], Bd, END, lines: [] }) };
