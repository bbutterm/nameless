"""Render lossless stills (channel art: avatar, banner, thumbnails) from a video's drawScene.
usage: python3 engine/still.py <video> t1 t2 ... [--square 800] [--name avatar]
  -> out/<video>/stills/<name>_<t>.png (1920×1080, or the centre square resized to N×N with --square N)
     + preview.png: each still in a circle at 800 / 98 / 40 px, the sizes YouTube shows an avatar at."""
import asyncio, base64, argparse, io
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
from browser import launch, open_video, outdir

def circle(im, size):
    im = im.resize((size, size), Image.LANCZOS); m = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255); im.putalpha(m.resize((size, size), Image.LANCZOS)); return im

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('v'); ap.add_argument('ts', nargs='+', type=float)
    ap.add_argument('--square', type=int); ap.add_argument('--name', default='still'); a = ap.parse_args()
    d = outdir(a.v) / 'stills'; d.mkdir(exist_ok=True); ims = []
    async with async_playwright() as p:
        b = await launch(p); errs = []
        pg, _ = await open_video(b, a.v, errs)
        for t in a.ts:
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
