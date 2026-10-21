"""Vertical shorts / reels (1080×1920, 30 fps) cut from a finished video.
usage: python3 engine/shorts.py <video> [name ...] [--pages N] [--preview]
Config: videos/<v>/shorts.json → [{name, from, to, title, tag?, cx?: [[t, x], ...], cy?, z?, zoom?, endCard?, endText?, endSub?}]
  from/to are video times (pick natural pauses); cx keys move the square window (x of its centre in the 1920 frame);
  z/zoom > 1 zooms in (window smaller than 1080). Audio comes from the finished out/<v>/<v>.mp4 (already loudness-normalised).
tail (default 2.4 s): after `to` the frame freezes under an end card while the sound fades.
Output: out/<v>/shorts/<name>.mp4 (for upload) + <name>_light.mp4 (~4–6 MB, for chat) + <name>.jpg cover frame. --preview renders 6 stills per short instead (contact sheet)."""
import asyncio, base64, json, subprocess, argparse, os, time
from playwright.async_api import async_playwright
from PIL import Image
from browser import ROOT, launch, open_video, outdir, vdir, out_name
FPS = 30

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('v'); ap.add_argument('names', nargs='*')
    ap.add_argument('--pages', type=int, default=max(1, min(6, (os.cpu_count() or 2) - 1))); ap.add_argument('--preview', action='store_true')
    a = ap.parse_args()
    cfgs = [c for c in json.load(open(vdir(a.v) / 'shorts.json', encoding='utf-8')) if not a.names or c['name'] in a.names]
    d = outdir(a.v) / 'shorts'; d.mkdir(exist_ok=True)
    js = (ROOT / 'engine' / 'shorts.js').read_text(encoding='utf-8')
    async with async_playwright() as p:
        b = await launch(p); pages = []
        for _ in range(1 if a.preview else a.pages):
            pg, _ = await open_video(b, a.v); await pg.add_script_tag(content=js); pages.append(pg)
        for S in cfgs:
            S.setdefault('endCard', True)
            for pg in pages: await pg.evaluate('s => { window.SHORT = s; }', S)
            if a.preview:
                files = []
                for k in range(6):
                    t = S['from'] + (S['to'] - S['from']) * (k + 0.5) / 6
                    data = await pages[0].evaluate('t => composeShort(t)', t); f = d / f"{S['name']}_{k}.jpg"; f.write_bytes(base64.b64decode(data.split(',', 1)[1])); files.append(f)
                sheet = Image.new('RGB', (6 * 360, 640))
                for k, f in enumerate(files): sheet.paste(Image.open(f).resize((360, 640)), (k * 360, 0))
                sheet.save(d / f"{S['name']}_sheet.jpg"); print(d / f"{S['name']}_sheet.jpg"); continue
            silent = d / f"{S['name']}_v.mp4"; t0 = time.time()
            ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', str(FPS), '-i', '-',
                                   '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', str(FPS), str(silent)], stdin=subprocess.PIPE)
            tail = S.get('tail', 2.4) if S['endCard'] else 0
            f0, f1 = 0, int(round((S['to'] - S['from'] + tail) * FPS)); n = len(pages)
            for i in range(f0, f1, n):
                res = await asyncio.gather(*[pages[k].evaluate('t => composeShort(t)', S['from'] + (i + k) / FPS) for k in range(n) if i + k < f1])
                for r in res: ff.stdin.write(base64.b64decode(r.split(',', 1)[1]))
            ff.stdin.close(); ff.wait()
            dur = S['to'] - S['from']; src = outdir(a.v) / f'{out_name(a.v)}.mp4'
            out = d / f"{S['name']}.mp4"
            # audio: the finished mix for [from, to], then it rings out under the end card
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(silent), '-ss', f"{S['from']:.3f}", '-t', f'{dur + min(tail, 1.0):.3f}', '-i', str(src), '-map', '0:v', '-map', '1:a',
                            '-af', f'afade=t=in:d=0.15,afade=t=out:st={dur:.3f}:d={min(tail, 1.0) or 0.5:.3f},apad', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', str(out)], check=True)
            silent.unlink()
            # light copy for chat (~4–6 MB): same 1080×1920, softened grain, capped bitrate
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(out), '-vf', 'hqdn3d=1.5:1.5:4:4', '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-maxrate', '3M', '-bufsize', '6M',
                            '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(d / f"{S['name']}_light.mp4")], check=True)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '1.2', '-i', str(out), '-frames:v', '1', str(d / f"{S['name']}.jpg")], check=True)
            print(out, f'{dur:.1f}s', f'{os.path.getsize(out) / 1e6:.1f} MB', f'{time.time() - t0:.0f}s')
        await b.close()

asyncio.run(main())
