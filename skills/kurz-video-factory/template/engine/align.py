"""Turn the narration + ElevenLabs word timestamps into videos/<v>/timings.js for the animation.
usage: python3 engine/align.py <video> [--lead 0.6] [--tail 4.0] [--tempo 1.0]   (defaults from script.json "timing")
inputs : videos/<v>/script.json (lines: id, say, text), videos/<v>/voice/narration.mp3, videos/<v>/voice/words.json
         (words.json = Scribe output: {"words":[{"text","start","end"}]}; without it we fall back to silence detection)
outputs: videos/<v>/timings.js  (window.TIMINGS = {voice_at, end, lines[{id,t0,t1}], words[[text,t0,t1,line]], chunks[{t0,t1,text}]})
         out/<v>/voice.wav      (48k mono, optionally tempo-stretched, with "pause_before" silences inserted between lines)
A line may set "pause_before": seconds — the narration is cut in the gap before that line and silence is inserted,
so the picture gets room to breathe without regenerating the voice.
Times in timings.js are video times (voice offset by --lead)."""
import sys, re, json, subprocess, argparse
import numpy as np
from scipy.io import wavfile
from browser import vdir, outdir

def norm(w): return re.sub(r'[^\wё]', '', w.lower().replace('ё', 'е'))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('v'); ap.add_argument('--lead', type=float); ap.add_argument('--tail', type=float); ap.add_argument('--tempo', type=float)
    a = ap.parse_args(); V = vdir(a.v)
    script = json.load(open(V / 'script.json', encoding='utf-8'))
    # defaults can live in script.json → "timing": {"lead": .., "tail": .., "tempo": ..}; CLI flags override
    tm = {'lead': 0.6, 'tail': 4.0, 'tempo': 1.0, **script.get('timing', {})}
    for k in tm:
        if getattr(a, k) is None: setattr(a, k, tm[k])
    wav = outdir(a.v) / 'voice.wav'
    af = [] if abs(a.tempo - 1) < 1e-3 else [f'atempo={a.tempo}']
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(V / 'voice' / 'narration.mp3')] + (['-af', ','.join(af)] if af else []) + ['-ar', '48000', '-ac', '1', str(wav)], check=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(wav)], capture_output=True, text=True).stdout)

    sr, x = wavfile.read(wav)
    # transcript words without audio tags like [pause]
    tw = [w for w in json.load(open(V / 'voice' / 'words.json', encoding='utf-8'))['words'] if not w['text'].startswith('[') and not w['text'].endswith(']') and norm(w['text'])]
    k = 0; segs = []
    for li, L in enumerate(script['lines']):
        say = [w for w in re.sub(r'\[[^\]]*\]', ' ', L['say']).split() if norm(w)]
        seg = []
        for w in say:
            # tolerant match: skip transcript words until a match within a small window
            j = next((j for j in range(k, min(k + 4, len(tw))) if norm(tw[j]['text']) == norm(w)), None)
            if j is None: raise SystemExit(f'line {li} ({L["id"]}): cannot align word "{w}" near transcript word {k} "{tw[k]["text"] if k < len(tw) else "END"}"')
            seg.append(tw[j]); k = j + 1
        segs.append(seg)
    # cut points (seconds in the stretched voice) and inserted pauses
    cuts, shift, shifts = [], 0.0, []
    for li, L in enumerate(script['lines']):
        p = float(L.get('pause_before', 0)) if li else 0.0
        if p > 0:
            c = (segs[li - 1][-1]['end'] + segs[li][0]['start']) / 2 / a.tempo
            cuts.append((c, p)); shift += p
        shifts.append(shift)
    if cuts:
        parts, prev = [], 0
        for c, p in cuts:
            i = int(c * sr); fade = int(0.012 * sr)
            piece = x[prev:i].astype(np.float64); piece[-fade:] *= np.linspace(1, 0, fade)
            if prev: piece[:fade] *= np.linspace(0, 1, fade)
            parts += [piece, np.zeros(int(p * sr))]; prev = i
        last = x[prev:].astype(np.float64); last[:int(0.012 * sr)] *= np.linspace(0, 1, int(0.012 * sr)); parts.append(last)
        x = np.concatenate(parts).astype(np.int16); wavfile.write(wav, sr, x); dur = len(x) / sr
    lines, words, chunks = [], [], []
    for li, (L, seg) in enumerate(zip(script['lines'], segs)):
        T = lambda s, sh=shifts[li]: round(s / a.tempo + sh + a.lead, 3)
        for w in seg: words.append([w['text'], T(w['start']), T(w['end']), li])
        lines.append({'id': L['id'], 't0': T(seg[0]['start']), 't1': T(seg[-1]['end'])})
        # subtitle chunks: '|' splits the display text; map by word count
        parts = [p.strip() for p in L['text'].split('|')]; i = 0
        for p in parts:
            n = len([w for w in p.split() if norm(w)])
            sw = seg[i:i + n] or seg[-1:]
            chunks.append({'t0': T(sw[0]['start']), 't1': T(sw[-1]['end']), 'text': p}); i += n
    res = {'voice_at': a.lead, 'tempo': a.tempo, 'voice_dur': round(dur, 3), 'end': round(a.lead + dur + a.tail, 3), 'pauses': [[round(c + a.lead, 3), p] for c, p in cuts], 'lines': lines, 'words': words, 'chunks': chunks}
    (V / 'timings.js').write_text('window.TIMINGS = ' + json.dumps(res, ensure_ascii=False) + ';\n', encoding='utf-8')
    for L in lines: print(f"{L['id']:>18} {L['t0']:7.2f} → {L['t1']:7.2f}")
    print('voice', round(dur, 2), 's  END', res['end'])

if __name__ == '__main__': main()
