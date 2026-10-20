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

def split(v):
    """'basilisk:en' -> ('basilisk', 'en'); 'basilisk' -> ('basilisk', None). A language variant reuses the video's
    scenes with its own narration (script.<lang>.json, voice/<lang>/, timings.<lang>.js, strings.<lang>.js)."""
    base, _, lang = v.partition(':'); return base, (lang or None)

async def open_video(browser, v, errors=None):
    """Open engine/index.html?v=<video>[&lang=xx]; returns (page, END seconds)."""
    pg = await browser.new_page(viewport={'width': 1920, 'height': 1080})
    if errors is not None:
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') else None)
    base, lang = split(v)
    await pg.goto((ROOT / 'engine' / 'index.html').as_uri() + f'?v={base}' + (f'&lang={lang}' if lang else ''))
    end = await pg.evaluate('window.READY')
    return pg, end

def vdir(v): return ROOT / 'videos' / split(v)[0]
def outdir(v):
    base, lang = split(v)
    d = ROOT / 'out' / (f'{base}-{lang}' if lang else base); d.mkdir(parents=True, exist_ok=True); return d
def suffix(v):
    """'' for the original, '.en' for a language variant (script.en.json, timings.en.js, …)"""
    lang = split(v)[1]; return f'.{lang}' if lang else ''
def voice_dir(v):
    lang = split(v)[1]; return vdir(v) / 'voice' / lang if lang else vdir(v) / 'voice'
def timings_path(v): return vdir(v) / f'timings{suffix(v)}.js'
def out_name(v):
    base, lang = split(v); return f'{base}-{lang}' if lang else base
