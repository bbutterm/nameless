"""Narration through the ElevenLabs REST API (for agents without the ElevenLabs MCP connector).
needs: env ELEVENLABS_API_KEY, ffmpeg, `pip install requests`

  python3 engine/tts_elevenlabs.py <video> --takes 4            # N takes → videos/<v>/voice/takes/take<i>/{narration.mp3, words.json}
  python3 engine/tts_elevenlabs.py <video> --pick 3             # copy take 3 to videos/<v>/voice/{narration.mp3, words.json}
  python3 engine/tts_elevenlabs.py <video> --transcribe FILE    # word timings for an existing recording (Scribe) → voice/words.json

Text comes from videos/<v>/script.json: lines[].say joined with blank lines (paragraph breaks give natural pauses).
Voice/model from script.json → voice.voice_id / voice.model. Word timings come from the /with-timestamps endpoint
(character alignment → words), so no separate transcription is needed. Long scripts are split by lines into chunks."""
import os, sys, json, base64, argparse, subprocess, shutil, pathlib, tempfile
ROOT = pathlib.Path(__file__).resolve().parent.parent
API = 'https://api.elevenlabs.io/v1'

def chars_to_words(al, offset=0.0):
    """ElevenLabs character alignment → [{text, start, end}] split on whitespace."""
    words, cur, t0, t1 = [], '', None, None
    for ch, a, b in zip(al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']):
        if ch.isspace():
            if cur: words.append({'text': cur, 'start': round(t0 + offset, 3), 'end': round(t1 + offset, 3)}); cur = ''
            continue
        if not cur: t0 = a
        cur += ch; t1 = b
    if cur: words.append({'text': cur, 'start': round(t0 + offset, 3), 'end': round(t1 + offset, 3)})
    return words

def dur(path):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)], capture_output=True, text=True).stdout)

def tts(text, voice_id, model, seed, key):
    import requests
    r = requests.post(f'{API}/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128',
                      headers={'xi-api-key': key, 'Content-Type': 'application/json'},
                      json={'text': text, 'model_id': model, 'seed': seed}, timeout=600)
    if r.status_code != 200: raise SystemExit(f'ElevenLabs {r.status_code}: {r.text[:400]}')
    j = r.json()
    return base64.b64decode(j['audio_base64']), j.get('alignment') or j.get('normalized_alignment')

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('v'); ap.add_argument('--takes', type=int); ap.add_argument('--pick', type=int)
    ap.add_argument('--transcribe'); ap.add_argument('--max-chars', type=int, default=2800); ap.add_argument('--seed', type=int, default=11)
    a = ap.parse_args()
    V = ROOT / 'videos' / a.v; voice_dir = V / 'voice'; voice_dir.mkdir(parents=True, exist_ok=True)
    script = json.load(open(V / 'script.json', encoding='utf-8'))
    if a.pick:
        src = voice_dir / 'takes' / f'take{a.pick}'
        for f in ('narration.mp3', 'words.json'): shutil.copy(src / f, voice_dir / f)
        script.setdefault('voice', {})['take'] = f'take{a.pick}'
        open(V / 'script.json', 'w', encoding='utf-8').write(json.dumps(script, ensure_ascii=False, indent=1)); print('picked', src); return
    key = os.environ.get('ELEVENLABS_API_KEY') or sys.exit('set ELEVENLABS_API_KEY')
    if a.transcribe:
        import requests
        with open(a.transcribe, 'rb') as f:
            r = requests.post(f'{API}/speech-to-text', headers={'xi-api-key': key}, data={'model_id': 'scribe_v1'}, files={'file': f}, timeout=600)
        if r.status_code != 200: raise SystemExit(f'Scribe {r.status_code}: {r.text[:400]}')
        words = [w for w in r.json()['words'] if w.get('type', 'word') == 'word']
        json.dump({'words': words}, open(voice_dir / 'words.json', 'w', encoding='utf-8'), ensure_ascii=False); print(len(words), 'words'); return
    vo = script.get('voice', {}); voice_id = vo.get('voice_id', 'dWNEQ4rqRY6thcusuDyq'); model = vo.get('model', 'eleven_v4')
    # chunk by lines so every request stays under the model's character limit
    chunks, cur = [], ''
    for L in script['lines']:
        piece = L['say'].strip()
        if cur and len(cur) + len(piece) + 2 > a.max_chars: chunks.append(cur); cur = ''
        cur = (cur + '\n\n' + piece) if cur else piece
    if cur: chunks.append(cur)
    for k in range(1, (a.takes or 1) + 1):
        out = voice_dir / 'takes' / f'take{k}'; out.mkdir(parents=True, exist_ok=True)
        words, parts, t = [], [], 0.0
        with tempfile.TemporaryDirectory() as td:
            for ci, text in enumerate(chunks):
                audio, al = tts(text, voice_id, model, a.seed + k * 97 + ci, key)
                p = pathlib.Path(td) / f'c{ci}.mp3'; p.write_bytes(audio); parts.append(p)
                words += chars_to_words(al, t); t += dur(p)
            lst = pathlib.Path(td) / 'list.txt'; lst.write_text(''.join(f"file '{p}'\n" for p in parts))
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c:a', 'libmp3lame', '-b:a', '160k', str(out / 'narration.mp3')], check=True)
        json.dump({'words': words}, open(out / 'words.json', 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'take{k}: {dur(out / "narration.mp3"):.1f}s, {len(words)} words → {out}')
    print('listen to the takes (or ask the human), then: --pick N')

if __name__ == '__main__': main()
