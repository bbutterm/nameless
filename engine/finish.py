"""Mux picture + soundtrack into the deliverable and write subtitles.
usage: python3 engine/finish.py <video> [--crf N] [--burn]  -> out/<v>/<v>.mp4, out/<v>/<v>.srt (+ <v>_subs.mp4 with --burn)
--burn: a second file with the subtitles drawn into the picture (Montserrat ExtraBold on a soft box; libass), for
viewers who want them always on. The clean file + .srt stays the one for YouTube (captions are selectable there).
Translations: videos/<v>/subs.<lang>.txt (one line per subtitle chunk) → <v>.<lang>.srt with the same timings.
720p master (default render): one light file, crf 23 slow capped at 2.5 Mbit/s (~20–40 MB) — downloads from chat.
1080p master (render --size 1080): <v>.mp4 at crf 20 slow (~9 Mbit/s, for YouTube) + <v>_720p.mp4 (~20 MB) to send.
The master out/<v>/video.mp4 carries per-frame film grain at crf 16, so it is always re-encoded, never copied.
Audio: AAC 192k, two-pass loudnorm to -14 LUFS / -1 dBTP."""
import sys, json, re, shutil, subprocess
from browser import ROOT, vdir, outdir, timings_path, out_name

SUB_STYLE = "FontName=Montserrat ExtraBold,Bold=0,Fontsize=15,PrimaryColour=&H00FFFFFF,BorderStyle=4,BackColour=&H70140C08,Outline=6,Shadow=0,MarginV=24"

def burn(src, srt, dst, height):
    """Draw the .srt into the picture with libass (fonts from node_modules/@fontsource)."""
    fd = ROOT / 'out' / 'fonts'; fd.mkdir(parents=True, exist_ok=True)
    for f in (ROOT / 'node_modules' / '@fontsource' / 'montserrat' / 'files').glob('montserrat-latin-800-normal.woff'): shutil.copy(f, fd / f.name)
    esc = lambda p: str(p).replace('\\', '/').replace(':', '\\:').replace("'", "\\'")
    cap = ['-maxrate', '2.8M', '-bufsize', '5M'] if height <= 720 else []
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(src), '-vf', f"subtitles='{esc(srt)}':fontsdir='{esc(fd)}':force_style='{SUB_STYLE}'",
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23' if height <= 720 else '20', *cap, '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', str(dst)], check=True)

def srt_time(t):
    ms = int(round(t * 1000)); return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'

def main():
    v = sys.argv[1]; O = outdir(v)
    frames = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', str(O / 'video.mp4')], capture_output=True, text=True).stdout.strip())
    secs = frames / 60
    height = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=height', '-of', 'csv=p=0', str(O / 'video.mp4')], capture_output=True, text=True).stdout.strip())
    crf = sys.argv[sys.argv.index('--crf') + 1] if '--crf' in sys.argv else ('23' if height <= 720 else '20')
    cap = ['-maxrate', '2.5M', '-bufsize', '5M'] if height <= 720 else []
    # two-pass loudness normalisation (static gain, no pumping)
    m = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(O / 'mix.wav'), '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
    ln = f"loudnorm=I=-14:TP=-1.0:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true"
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(O / 'video.mp4'), '-i', str(O / 'mix.wav'), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, *cap, '-pix_fmt', 'yuv420p', '-r', '60',
                    '-af', ln, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', f'{secs:.4f}', '-movflags', '+faststart', str(O / f'{out_name(v)}.mp4')], check=True)
    if height > 720:  # light copy for sending in chat (big files don't get a download button there)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(O / f'{out_name(v)}.mp4'), '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24',
                        '-maxrate', '2.2M', '-bufsize', '4M', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(O / f'{out_name(v)}_720p.mp4')], check=True)
    tj = timings_path(v)
    if tj.exists():
        tm = json.loads(re.search(r'=\s*(\{.*\});', tj.read_text(encoding='utf-8'), re.S).group(1))
        ch = tm.get('chunks') or []
        def write_srt(path, texts):
            with open(path, 'w', encoding='utf-8') as f:
                for i, c in enumerate(ch):
                    t1 = max(c['t1'] + 0.3, c['t0'] + 1.0)
                    if i + 1 < len(ch): t1 = min(t1, ch[i + 1]['t0'] - 0.02)
                    f.write(f"{i + 1}\n{srt_time(c['t0'])} --> {srt_time(t1)}\n{texts[i]}\n\n")
        write_srt(O / f'{out_name(v)}.srt', [c['text'] for c in ch])
        # translated subtitles: videos/<v>/subs.<lang>.txt, one line per subtitle chunk, same timings
        for tf in sorted(vdir(v).glob('subs.*.txt')):
            lines = [l.strip() for l in tf.read_text(encoding='utf-8').splitlines() if l.strip()]
            if len(lines) != len(ch): print(f'WARNING {tf.name}: {len(lines)} lines for {len(ch)} subtitle chunks — skipped'); continue
            write_srt(O / f'{out_name(v)}.{tf.name.split(".")[1]}.srt', lines)
        if '--burn' in sys.argv: burn(O / f'{out_name(v)}.mp4', O / f'{out_name(v)}.srt', O / f'{out_name(v)}_subs.mp4', height)
    print(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_frames,sample_rate,channels:format=duration', '-of', 'compact', str(O / f'{out_name(v)}.mp4')], capture_output=True, text=True).stdout)

if __name__ == '__main__': main()
