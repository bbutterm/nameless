"""Export the animation's sound-event timeline (VIDEO.events()) to out/<video>/events.json for the mixer.
usage: python3 engine/dump_events.py <video>"""
import asyncio, sys, json
from playwright.async_api import async_playwright
from browser import launch, open_video, outdir

async def main():
    v = sys.argv[1]
    async with async_playwright() as p:
        b = await launch(p); pg, _ = await open_video(b, v)
        ev = await pg.evaluate('VIDEO.events()'); await b.close()
    json.dump(ev, open(outdir(v) / 'events.json', 'w'), ensure_ascii=False, indent=0)
    print(v, 'END', ev['END'], len(ev['events']), 'events')

asyncio.run(main())
