"""Mux picture + soundtrack into the deliverable and write subtitles.
usage: python3 engine/finish.py <video> [--crf 20]  -> out/<v>/<v>.mp4 (H.264 re-encode from the crf-16 master, AAC 192k, -14 LUFS / -1 dBTP), out/<v>/<v>.srt
The master out/<v>/video.mp4 carries per-frame film grain at crf 16 (~40 Mbit/s); the deliverable is re-encoded with
preset slow at crf 20 (~5–8 Mbit/s), which YouTube ingests without visible loss."""
import sys, json, re, subprocess
from browser import vdir, outdir

def srt_time(t):
    ms = int(round(t * 1000)); return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'

def main():
    v = sys.argv[1]; O = outdir(v)
    crf = sys.argv[sys.argv.index('--crf') + 1] if '--crf' in sys.argv else '20'
    frames = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', str(O / 'video.mp4')], capture_output=True, text=True).stdout.strip())
    secs = frames / 60
    # two-pass loudness normalisation (static gain, no pumping)
    m = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(O / 'mix.wav'), '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
    ln = f"loudnorm=I=-14:TP=-1.0:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true"
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(O / 'video.mp4'), '-i', str(O / 'mix.wav'), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-r', '60',
                    '-af', ln, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', f'{secs:.4f}', '-movflags', '+faststart', str(O / f'{v}.mp4')], check=True)
    tj = vdir(v) / 'timings.js'
    if tj.exists():
        tm = json.loads(re.search(r'=\s*(\{.*\});', tj.read_text(encoding='utf-8'), re.S).group(1))
        ch = tm.get('chunks') or []
        with open(O / f'{v}.srt', 'w', encoding='utf-8') as f:
            for i, c in enumerate(ch):
                t1 = max(c['t1'] + 0.3, c['t0'] + 1.0)
                if i + 1 < len(ch): t1 = min(t1, ch[i + 1]['t0'] - 0.02)
                f.write(f"{i + 1}\n{srt_time(c['t0'])} --> {srt_time(t1)}\n{c['text']}\n\n")
    print(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_frames,sample_rate,channels:format=duration', '-of', 'compact', str(O / f'{v}.mp4')], capture_output=True, text=True).stdout)

if __name__ == '__main__': main()
