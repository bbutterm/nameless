"""Render single frames for review + a contact sheet.
usage: python3 engine/preview.py <video> t1 t2 ...   (or --every 2.5) -> out/<video>/preview/*.jpg + sheet.jpg"""
import asyncio, sys, base64, argparse
from playwright.async_api import async_playwright
from PIL import Image
from browser import launch, open_video, outdir

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('v'); ap.add_argument('ts', nargs='*', type=float)
    ap.add_argument('--every', type=float); ap.add_argument('--from', dest='frm', type=float, default=0); ap.add_argument('--to', type=float)
    a = ap.parse_args()
    d = outdir(a.v) / 'preview'; d.mkdir(exist_ok=True)
    for f in d.glob('*.jpg'): f.unlink()
    async with async_playwright() as p:
        b = await launch(p); errs = []
        pg, end = await open_video(b, a.v, errs)
        ts = list(a.ts)
        if a.every:
            t = a.frm; to = a.to or end
            while t < to: ts.append(round(t, 2)); t += a.every
        print('END', end)
        files = []
        for t in ts:
            data = await pg.evaluate("t=>{renderAt(t);return document.getElementById('c').toDataURL('image/jpeg',0.85)}", t)
            f = d / f'{t:07.2f}.jpg'; f.write_bytes(base64.b64decode(data.split(',')[1])); files.append(f)
        print('errors', errs[:5]); await b.close()
    if files:
        cols = 4; rows = (len(files) + cols - 1) // cols
        S = Image.new('RGB', (480 * cols, 270 * rows))
        for i, f in enumerate(files): S.paste(Image.open(f).resize((480, 270)), ((i % cols) * 480, (i // cols) * 270))
        S.save(d / 'sheet.jpg'); print('sheet', d / 'sheet.jpg')

asyncio.run(main())
