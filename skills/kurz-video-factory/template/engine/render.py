"""Render every frame i/60 deterministically through Chromium and pipe to FFmpeg (H.264 yuv420p, 60 fps).
usage: python3 engine/render.py <video> [start_s end_s] [--size 720|1080] [--pages N] [--crf 16]  -> out/<video>/video.mp4 (or video_<a>-<b>.mp4)
Scenes are always drawn on the 1920×1080 canvas; --size 720 (default) downsamples each frame in the browser before JPEG
encoding, which roughly halves capture/transfer cost and gives a 1280×720 master. Use --size 1080 for a full-HD master."""
import asyncio, sys, base64, subprocess, time, os, argparse
from playwright.async_api import async_playwright
from browser import launch, open_video, outdir
FPS = 60
JS = """([t, w, h]) => {
  renderAt(t); const c = document.getElementById('c');
  if (w === c.width) return c.toDataURL('image/jpeg', 0.95);
  if (!window.__small) { window.__small = document.createElement('canvas'); window.__small.width = w; window.__small.height = h; }
  const g = window.__small.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, w, h);
  return window.__small.toDataURL('image/jpeg', 0.95);
}"""

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('v'); ap.add_argument('range', nargs='*', type=float)
    ap.add_argument('--pages', type=int, default=max(1, min(6, (os.cpu_count() or 2) - 1))); ap.add_argument('--crf', type=int, default=16)
    ap.add_argument('--out'); ap.add_argument('--size', type=int, default=720, choices=(720, 1080))
    a = ap.parse_args()
    async with async_playwright() as p:
        b = await launch(p)
        pages = []
        for _ in range(a.pages):
            pg, end = await open_video(b, a.v); pages.append(pg)
        s0, s1 = (a.range + [0.0, end])[:2] if len(a.range) >= 2 else (0.0, end)
        f0, f1 = int(round(s0 * FPS)), int(round(s1 * FPS))
        out = a.out or str(outdir(a.v) / ('video.mp4' if (s0, s1) == (0.0, end) else f'video_{s0:g}-{s1:g}.mp4'))
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', str(FPS), '-i', '-',
                               '-c:v', 'libx264', '-preset', 'medium', '-crf', str(a.crf), '-pix_fmt', 'yuv420p', '-r', str(FPS), '-movflags', '+faststart', out], stdin=subprocess.PIPE)
        t0 = time.time(); n = len(pages); w, h = (1280, 720) if a.size == 720 else (1920, 1080)
        for i in range(f0, f1, n):
            res = await asyncio.gather(*[pages[k].evaluate(JS, [(i + k) / FPS, w, h]) for k in range(n) if i + k < f1])
            for d in res: ff.stdin.write(base64.b64decode(d.split(',', 1)[1]))
            if (i - f0) % 600 < n: print(f'{a.v} frame {i}/{f1} {time.time() - t0:.0f}s', flush=True)
        ff.stdin.close(); ff.wait(); await b.close()
        print('done', out, f1 - f0, 'frames', f'{time.time() - t0:.0f}s')

asyncio.run(main())
