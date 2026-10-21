// Vertical shorts / reels composer (1080×1920), injected by engine/shorts.py after the video page is ready.
// Layout: blurred frame as background · hook title on top · a square window into the 16:9 scene (1:1 pixels, follows
// the action via cx keys) · big captions with the spoken word highlighted · end card pointing to the full video.
'use strict';
const VW = 1080, VH = 1920, SQ = 1080, SQY = 470;
const vc = document.createElement('canvas'); vc.width = VW; vc.height = VH; const vg = vc.getContext('2d');
function keysAt(keys, t, def) { if (!keys || !keys.length) return def; if (t <= keys[0][0]) return keys[0][1]; for (let i = 0; i < keys.length - 1; i++) { const [a, va] = keys[i], [b, vb] = keys[i + 1]; if (t < b) return lerp(va, vb, E.inOut((t - a) / (b - a))); } return keys[keys.length - 1][1]; }
function wrap(g, text, maxW) { const out = []; let line = ''; for (const w of text.split(/\s+/)) { const tst = line ? line + ' ' + w : w; if (g.measureText(tst).width > maxW && line) { out.push(line); line = w; } else line = tst; } if (line) out.push(line); return out; }
function composeShort(t) {
  // t runs to S.to + tail; during the tail the scene freezes on its last frame under the end card
  const S = window.SHORT, c = document.getElementById('c'), u = t - S.from, d = S.to - S.from, tail = S.endCard ? (S.tail ?? 2.4) : 0;
  t = Math.min(t, S.to - 1 / 60);
  renderAt(t);
  const cx = clamp(keysAt(S.cx, t, 960), SQ / 2 / (S.zoom || 1), W - SQ / 2 / (S.zoom || 1)), cy = keysAt(S.cy, t, 540), z = keysAt(S.z, t, S.zoom || 1);
  const sw = SQ / z, sx = clamp(cx - sw / 2, 0, W - sw), sy = clamp(cy - sw / 2, 0, H - sw);
  // background: the same frame, blurred and darkened
  vg.setTransform(1, 0, 0, 1, 0, 0); vg.filter = 'blur(28px) brightness(0.45) saturate(1.2)';
  vg.drawImage(c, 960 - 304, 0, 608, 1080, -60, -60, VW + 120, VH + 120); vg.filter = 'none';
  // the square window
  vg.save(); vg.shadowColor = 'rgba(0,0,0,0.45)'; vg.shadowBlur = 40; vg.shadowOffsetY = 14; rrect(vg, 0, SQY, VW, SQ, 0); vg.fillStyle = '#000'; vg.fill(); vg.restore();
  vg.imageSmoothingQuality = 'high'; vg.drawImage(c, sx, sy, sw, sw, 0, SQY, VW, SQ);
  // hook title (pops in, stays)
  const tp = E.outBack(clamp(u / 0.45), 1.4);
  vg.save(); vg.translate(VW / 2, 250); vg.scale(tp, tp); vg.textAlign = 'center'; vg.textBaseline = 'middle';
  if (S.tag) { vg.font = '800 30px Unbounded, Montserrat, sans-serif'; vg.fillStyle = S.tagColor || '#ffc53d'; vg.fillText(S.tag, 0, -150); }
  vg.font = '900 66px Unbounded, Montserrat, sans-serif'; const tl = wrap(vg, S.title, VW - 120);
  tl.forEach((l, i) => { const y = (i - (tl.length - 1) / 2) * 82; vg.fillStyle = 'rgba(0,0,20,0.45)'; vg.fillText(l, 4, y + 6); vg.fillStyle = '#ffffff'; vg.fillText(l, 0, y); });
  vg.restore();
  // captions: the current subtitle chunk, the word being spoken in gold
  const T = window.TIMINGS, ch = T.chunks.find(k => t >= k.t0 - 0.05 && t < k.t1 + 0.35);
  if (ch && u < d) {
    const ws = T.words.filter(w => w[1] >= ch.t0 - 0.01 && w[1] <= ch.t1 + 0.01);
    const words = ch.text.split(/\s+/);
    vg.font = '800 58px Montserrat, sans-serif'; vg.textBaseline = 'middle';
    const lines = []; let line = [], lw = 0; const sp = vg.measureText(' ').width;
    words.forEach((w, i) => { const ww = vg.measureText(w).width; if (lw + ww > VW - 140 && line.length) { lines.push(line); line = []; lw = 0; } line.push([w, i, ww]); lw += ww + sp; });
    if (line.length) lines.push(line);
    const y0 = SQY + SQ + 150 - (lines.length - 1) * 38, a = clamp((t - ch.t0 + 0.05) / 0.12);
    vg.save(); vg.globalAlpha = a;
    lines.forEach((ln, li) => {
      const tw = ln.reduce((s, [, , ww]) => s + ww + sp, -sp); let x = VW / 2 - tw / 2; const y = y0 + li * 76;
      vg.fillStyle = 'rgba(8,10,30,0.72)'; rrect(vg, x - 26, y - 40, tw + 52, 80, 22); vg.fill();
      for (const [w, i, ww] of ln) { const wt = ws[i]; const on = wt && t >= wt[1] - 0.03 && t < (ws[i + 1] ? ws[i + 1][1] : ch.t1 + 0.3); vg.fillStyle = on ? '#ffc53d' : '#ffffff'; vg.fillText(w, x, y + 2); x += ww + sp; }
    });
    vg.restore();
  }
  // end card
  if (S.endCard) {
    const e = clamp((u - d + 0.15) / 0.35); if (e > 0) {
      vg.fillStyle = `rgba(8,8,30,${0.78 * e})`; vg.fillRect(0, 0, VW, VH);
      vg.save(); vg.globalAlpha = e; vg.translate(VW / 2, VH / 2 - 120); crown(vg, 0, 0, 240, t, { glint: 0.5, p: E.outBack(e, 1.6) }); vg.restore();
      vg.save(); vg.globalAlpha = e; vg.textAlign = 'center'; vg.textBaseline = 'middle'; vg.font = '900 64px Unbounded, Montserrat, sans-serif'; vg.fillStyle = '#ffffff';
      wrap(vg, S.endText || 'Full video on YouTube', VW - 140).forEach((l, i) => vg.fillText(l, VW / 2, VH / 2 + 60 + i * 80));
      vg.font = '700 40px Montserrat, sans-serif'; vg.fillStyle = '#ffc53d'; vg.fillText(S.endSub || 'Link in the description', VW / 2, VH / 2 + 260); vg.restore();
    }
  }
  return vc.toDataURL('image/jpeg', 0.92);
}
window.composeShort = composeShort;
