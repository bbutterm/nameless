"""Render lossless stills (channel art: avatar, banner, thumbnails) from a video's drawScene.
usage: python3 engine/still.py <video> t1 t2 ... [--square 800] [--name avatar] [--hires K]
  --thumbs: YouTube thumbnails from videos/<v>/thumbs.json → [{name, t, text: ["LINE", …], side: left|right|center,
             accent: "#hex" (colours the last line), dim?: 0..1, y?: 0..1, size?, crown?: [x, y, width],
             draw?: name of a composition in the video's window.THUMBS}] — clean scene (no HUD/grain) + big title, 1280×720 JPG.
  --hires K: draw VIDEO.drawScene straight onto a K× canvas (true vector detail, e.g. K=2 → 3840×2160 / 2160 square);
             only for stills whose drawing never resets the transform (no fadeBlack/grain/layer) — channel art is fine.
  -> out/<video>/stills/<name>_<t>.png (1920×1080, or the centre square resized to N×N with --square N)
     + preview.png: each still in a circle at 800 / 98 / 40 px, the sizes YouTube shows an avatar at."""
import asyncio, base64, argparse, io, json
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
from browser import launch, open_video, outdir, vdir

THUMB_JS = """([t, T]) => {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  // the clean scene (no HUD, no grain, no motion blur) — or a composition from the video's own window.THUMBS[draw]
  if (T.draw) window.THUMBS[T.draw](g, t); else VIDEO.drawScene(g, t);
  const side = T.side || 'left', lines = T.text || [], n = lines.length;
  // a soft dark wash behind the text side for contrast
  const gr = side === 'center' ? g.createLinearGradient(0, H, 0, 0) : g.createLinearGradient(side === 'left' ? 0 : W, 0, side === 'left' ? W * 0.75 : W * 0.25, 0);
  gr.addColorStop(0, `rgba(5,5,25,${T.dim ?? 0.6})`); gr.addColorStop(1, 'rgba(5,5,25,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const size = T.size || (n > 2 ? 132 : 158); g.font = `900 ${size}px Unbounded, Montserrat, sans-serif`; g.textBaseline = 'middle';
  g.textAlign = side === 'center' ? 'center' : side; const x = side === 'left' ? 90 : side === 'right' ? W - 90 : W / 2;
  const y0 = (T.y ?? (side === 'center' ? 0.78 : 0.5)) * H - (n - 1) * size * 0.56;
  lines.forEach((l, i) => { const y = y0 + i * size * 1.12;
    g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = 'rgba(5,5,25,0.9)'; g.strokeText(l, x, y);
    g.fillStyle = i === n - 1 && T.accent ? T.accent : '#ffffff'; g.fillText(l, x, y); });
  if (T.crown) crown(g, T.crown[0], T.crown[1], T.crown[2], t, { glint: 0.6 });   // optional big crown for the series
  return c.toDataURL('image/png');
}"""

def circle(im, size):
    im = im.resize((size, size), Image.LANCZOS); m = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255); im.putalpha(m.resize((size, size), Image.LANCZOS)); return im

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('v'); ap.add_argument('ts', nargs='*', type=float)
    ap.add_argument('--square', type=int); ap.add_argument('--name', default='still'); ap.add_argument('--hires', type=float, default=1); ap.add_argument('--thumbs', action='store_true'); a = ap.parse_args()
    d = outdir(a.v) / 'stills'; d.mkdir(exist_ok=True); ims = []
    async with async_playwright() as p:
        b = await launch(p); errs = []
        pg, _ = await open_video(b, a.v, errs)
        if a.thumbs:
            for T in json.load(open(vdir(a.v) / 'thumbs.json', encoding='utf-8')):
                data = await pg.evaluate(THUMB_JS, [T['t'], T])
                im = Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGB').resize((1280, 720), Image.LANCZOS)
                f = d / f"thumb_{T['name']}.jpg"; im.save(f, quality=92); ims.append(im); print(f)
            S = Image.new('RGB', (1280, 360 * ((len(ims) + 1) // 2)))
            for i, im in enumerate(ims): S.paste(im.resize((640, 360)), ((i % 2) * 640, (i // 2) * 360))
            S.save(d / 'thumbs_sheet.jpg'); print(d / 'thumbs_sheet.jpg'); await b.close(); return
        for t in a.ts:
            if a.hires > 1:
                data = await pg.evaluate("([t,k])=>{const c=document.createElement('canvas');c.width=W*k;c.height=H*k;const g=c.getContext('2d');g.scale(k,k);VIDEO.drawScene(g,t);return c.toDataURL('image/png')}", [t, a.hires])
            else:
                data = await pg.evaluate("t=>{renderAt(t);return document.getElementById('c').toDataURL('image/png')}", t)
            im = Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGB')
            if a.square: w, h = im.size; s = min(w, h); im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2)).resize((a.square, a.square), Image.LANCZOS)
            f = d / f'{a.name}_{t:g}.png'; im.save(f); ims.append(im); print(f)
        print('errors', errs[:5]); await b.close()
    if a.square:  # how it reads as a YouTube avatar: big, channel page (98 px) and comments (40 px), on dark and light UI
        P = Image.new('RGB', (len(ims) * 420, 640), '#0f0f0f'); L = Image.new('RGB', (len(ims) * 420, 140), '#ffffff')
        for i, im in enumerate(ims):
            P.paste(circle(im, 380), (i * 420 + 20, 20), circle(im, 380))
            for j, (sz, y) in enumerate([(98, 430), (40, 560)]): c = circle(im, sz); P.paste(c, (i * 420 + 160 - sz // 2 + 50, y), c); c2 = circle(im, sz); L.paste(c2, (i * 420 + 100 + j * 160, 20 + (98 - sz) // 2), c2)
        S = Image.new('RGB', (P.width, P.height + L.height)); S.paste(P, (0, 0)); S.paste(L, (0, P.height)); S.save(d / 'preview.png'); print(d / 'preview.png')

asyncio.run(main())
