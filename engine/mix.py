"""Build the soundtrack: videos/<v>/score.py (music + SFX from the event timeline) + narration, ducked and mastered.
usage: python3 engine/mix.py <video>  -> out/<v>/mix.wav, out/<v>/stem_music.wav, out/<v>/stem_sfx.wav
needs out/<v>/events.json (engine/dump_events.py) and, for narration, out/<v>/voice.wav + videos/<v>/timings.js (engine/align.py)"""
import sys, json, importlib.util, re
sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parent / 'audio'))
from instruments import *
from browser import vdir, outdir

def main():
    v = sys.argv[1]; O = outdir(v)
    ev = json.load(open(O / 'events.json')); END = ev['END']
    spec = importlib.util.spec_from_file_location('score', vdir(v) / 'score.py'); mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    music, sfx = mod.score(ev, END)
    voice, v_at = None, 0.0
    tj = vdir(v) / 'timings.js'
    if (O / 'voice.wav').exists() and tj.exists():
        voice = load_voice(str(O / 'voice.wav'))
        v_at = json.loads(re.search(r'=\s*(\{.*\});', tj.read_text(encoding='utf-8'), re.S).group(1))['voice_at']
    opts = getattr(mod, 'MASTER', {})
    mix = master(music, sfx, voice, END, v_at, **opts)
    wavfile.write(O / 'mix.wav', SR, (mix.T * 32767).astype(np.int16))
    for nm, x in (('music', music), ('sfx', sfx)):
        x = x[:, :T(END)]; wavfile.write(O / f'stem_{nm}.wav', SR, (x.T / (np.abs(x).max() + 1e-9) * 0.9 * 32767).astype(np.int16))
    print('mix', O / 'mix.wav', f'{END:.2f}s', 'with voice' if voice is not None else 'NO VOICE')

if __name__ == '__main__': main()
