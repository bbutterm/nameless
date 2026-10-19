"""One-shot pipeline for a video:  python3 engine/build.py <video> [--skip-render] [--pages N]
align (if narration present) → events → music/SFX mix → render frames → mux + subtitles."""
import sys, subprocess, pathlib
E = pathlib.Path(__file__).resolve().parent; ROOT = E.parent
v = sys.argv[1]; rest = sys.argv[2:]
def run(*a): print('▶', ' '.join(a), flush=True); subprocess.run([sys.executable, *a], check=True, cwd=ROOT)
if (ROOT / 'videos' / v / 'voice' / 'narration.mp3').exists(): run(str(E / 'align.py'), v)
run(str(E / 'dump_events.py'), v)
run(str(E / 'mix.py'), v)
if '--skip-render' not in rest: run(str(E / 'render.py'), v, *[x for x in rest if x != '--skip-render'])
run(str(E / 'finish.py'), v)
