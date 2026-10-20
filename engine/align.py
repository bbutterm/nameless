"""Turn the narration + ElevenLabs word timestamps into videos/<v>/timings.js for the animation.
usage: python3 engine/align.py <video>[:lang] [--lead 0.6] [--tail 4.0] [--tempo 1.0]   (defaults from script.json "timing")
inputs : videos/<v>/script.json (lines: id, say, text), videos/<v>/voice/narration.mp3, videos/<v>/voice/words.json
         (words.json = Scribe output: {"words":[{"text","start","end"}]}; without it we fall back to silence detection)
outputs: videos/<v>/timings.js  (window.TIMINGS = {voice_at, end, lines[{id,t0,t1}], words[[text,t0,t1,line]], chunks[{t0,t1,text}]})
         out/<v>/voice.wav      (48k mono, optionally tempo-stretched, with "pause_before" silences inserted between lines)
A line may set "pause_before": seconds — the narration is cut in the gap before that line and silence is inserted,
so the picture gets room to breathe without regenerating the voice.
Times in timings.js are video times (voice offset by --lead).
Scribe word times can be ~0.8 s late around long pauses (it smears the word before a pause across the silence), so by
default word boundaries are snapped to the real silences in the audio (snap_to_silence; "timing": {"snap": false} turns it off)."""
import sys, re, json, subprocess, argparse
import numpy as np
from scipy.io import wavfile
from browser import vdir, outdir, suffix, voice_dir, timings_path

def norm(w): return re.sub(r'[^\wё]', '', w.lower().replace('ё', 'е'))

STRONG = re.compile(r'[.?!…—:;]$')

def silences(x, sr, min_len=0.15, merge=0.06):
    """Silent intervals inside the narration: 10 ms frames ~28 dB below the speech level; blips shorter than `merge` are bridged."""
    hop = int(0.01 * sr); n = len(x) // hop
    f = x[:n * hop].astype(np.float64).reshape(n, hop) / 32768
    db = 20 * np.log10(np.sqrt((f ** 2).mean(1)) + 1e-9)
    sil = db < np.percentile(db[db > -60], 70) - 28
    runs, i = [], 0
    while i < n:
        j = i
        while j < n and sil[j] == sil[i]: j += 1
        if sil[i] and i > 0 and j < n:
            if runs and i * 0.01 - runs[-1][1] < merge: runs[-1][1] = j * 0.01
            else: runs.append([i * 0.01, j * 0.01])
        i = j
    return [r for r in runs if r[1] - r[0] >= min_len], db

def snap_to_silence(tw, strong, x, sr, tempo=1.0, skip=0.5, lam=0.15):
    """Match each silence to one gap between words (monotonic DP): cost = distance from the silence to the gap's span (a
    sentence-final word may be smeared across the pause, so its span counts as gap), minus a bonus for punctuation/tags,
    plus a small penalty for changes in the shift. Matched gaps become anchors of a piecewise-linear time map."""
    S = [[a * tempo, b * tempo] for a, b in silences(x, sr)[0]]  # x may be tempo-stretched; word times are not
    span = [((tw[k]['start'] if strong[k] == 2 else tw[k]['end']), tw[k + 1]['start']) for k in range(len(tw) - 1)]
    bonus = {2: 0.45, 1: 0.25, 0: 0.0}
    dist = lambda s, j: max(0.0, span[j][0] - s[1], s[0] - span[j][1])
    best = []
    for i, s in enumerate(S):
        row = {}
        for j in range(len(span)):
            if dist(s, j) > 1.6: continue
            off = s[1] - tw[j + 1]['start']; base = dist(s, j) - bonus[strong[j]]
            bc = (i * skip + base + lam * abs(off), None)
            for i2 in range(max(0, i - 6), i):
                for j2, (c2, _) in best[i2].items():
                    if j2 >= j: continue
                    c = c2 + (i - i2 - 1) * skip + base + lam * abs(off - (S[i2][1] - tw[j2 + 1]['start']))
                    if c < bc[0]: bc = (c, (i2, j2))
            row[j] = bc
        best.append(row)
    ends = [(c + (len(S) - 1 - i) * skip, (i, j)) for i in range(len(S)) for j, (c, _) in best[i].items()]
    if not ends: return tw, 0
    cur, M = min(ends, key=lambda e: e[0])[1], []
    while cur: M.append(cur); cur = best[cur[0]][cur[1]][1]
    src, dst = [0.0], [0.0]
    for i, j in reversed(M):
        for a, b in ((tw[j]['end'], S[i][0]), (tw[j + 1]['start'], S[i][1])):
            if a > src[-1] and b > dst[-1]: src.append(a); dst.append(b)
    src.append(max(tw[-1]['end'], src[-1] + 0.01)); dst.append(max(min(tw[-1]['end'] + dst[-2] - src[-2], len(x) / sr * tempo), dst[-1] + 0.01))
    m = lambda t: round(float(np.interp(t, src, dst)), 3)
    out = [{**w, 'start': m(w['start']), 'end': m(w['end'])} for w in tw]
    moved = max(abs(o['start'] - w['start']) for o, w in zip(out, tw))
    print(f'snap: {len(M)}/{len(S)} silences matched to word gaps, max shift {moved:.2f} s')
    return out, moved

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('v'); ap.add_argument('--lead', type=float); ap.add_argument('--tail', type=float); ap.add_argument('--tempo', type=float)
    a = ap.parse_args(); V = vdir(a.v)
    script = json.load(open(V / f'script{suffix(a.v)}.json', encoding='utf-8'))
    # defaults can live in script.json → "timing": {"lead": .., "tail": .., "tempo": ..}; CLI flags override
    tm = {'lead': 0.6, 'tail': 4.0, 'tempo': 1.0, **script.get('timing', {})}
    for k in ('lead', 'tail', 'tempo'):
        if getattr(a, k) is None: setattr(a, k, tm[k])
    wav = outdir(a.v) / 'voice.wav'
    af = [] if abs(a.tempo - 1) < 1e-3 else [f'atempo={a.tempo}']
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(voice_dir(a.v) / 'narration.mp3')] + (['-af', ','.join(af)] if af else []) + ['-ar', '48000', '-ac', '1', str(wav)], check=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(wav)], capture_output=True, text=True).stdout)

    sr, x = wavfile.read(wav)
    # transcript words without audio tags like [pause]
    tw, strong = [], []
    for w in json.load(open(voice_dir(a.v) / 'words.json', encoding='utf-8'))['words']:
        if w['text'].startswith('[') or w['text'].endswith(']') or not norm(w['text']):
            if strong: strong[-1] = 2  # an audio tag or a dash after a word = a likely pause
            continue
        tw.append(w); strong.append(2 if STRONG.search(w['text']) else 1 if w['text'].endswith(',') else 0)
    if tm.get('snap', True): tw, _ = snap_to_silence(tw, strong, x, sr, a.tempo)
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
    _, db = silences(x, sr)
    for li, L in enumerate(script['lines']):
        p = float(L.get('pause_before', 0)) if li else 0.0
        if p > 0:
            # cut at the quietest 10 ms frame between the two lines (never inside a word, even if timings are a bit off)
            e0, s1 = segs[li - 1][-1]['end'] / a.tempo, segs[li][0]['start'] / a.tempo
            lo, hi = int(max(0, e0 - 0.08) * 100), int((s1 + 0.08) * 100) + 1
            c = (lo + int(np.argmin(db[lo:hi]))) * 0.01 + 0.005 if hi > lo else (e0 + s1) / 2
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
            chunks.append({'t0': T(sw[0]['start']), 't1': T(sw[-1]['end']), 'text': p, 'line': li}); i += n
    res = {'voice_at': a.lead, 'tempo': a.tempo, 'voice_dur': round(dur, 3), 'end': round(a.lead + dur + a.tail, 3), 'pauses': [[round(c + a.lead, 3), p] for c, p in cuts], 'lang': script.get('lang'), 'anchors': script.get('anchors', {}), 'lines': lines, 'words': words, 'chunks': chunks}
    timings_path(a.v).write_text('window.TIMINGS = ' + json.dumps(res, ensure_ascii=False) + ';\n', encoding='utf-8')
    for L in lines: print(f"{L['id']:>18} {L['t0']:7.2f} → {L['t1']:7.2f}")
    print('voice', round(dur, 2), 's  END', res['end'])

if __name__ == '__main__': main()
