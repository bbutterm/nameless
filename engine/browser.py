"""Shared Chromium launcher + page loader for the video renderer.
Playwright's bundled browser may not match the installed Python package; fall back to any Chromium we can find."""
import glob, os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
ARGS = ['--allow-file-access-from-files']

def _candidates():
    if os.environ.get('CHROMIUM_PATH'): yield os.environ['CHROMIUM_PATH']
    for pat in ('/opt/pw-browsers/chromium-*/chrome-linux/chrome', os.path.expanduser('~/.cache/ms-playwright/chromium-*/chrome-linux/chrome')):
        yield from sorted(glob.glob(pat), reverse=True)

async def launch(p):
    try:
        return await p.chromium.launch(args=ARGS)
    except Exception as first:
        for exe in _candidates():
            if os.path.exists(exe): return await p.chromium.launch(args=ARGS, executable_path=exe)
        raise first

async def open_video(browser, v, errors=None):
    """Open engine/index.html?v=<v>; returns (page, END seconds)."""
    pg = await browser.new_page(viewport={'width': 1920, 'height': 1080})
    if errors is not None:
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') else None)
    await pg.goto((ROOT / 'engine' / 'index.html').as_uri() + f'?v={v}')
    end = await pg.evaluate('window.READY')
    return pg, end

def vdir(v): return ROOT / 'videos' / v
def outdir(v):
    d = ROOT / 'out' / v; d.mkdir(parents=True, exist_ok=True); return d
