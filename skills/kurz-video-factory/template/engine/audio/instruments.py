"""Procedural instrument + SFX library (numpy/scipy, 48 kHz). Video scores import this as `from instruments import *`."""
import sys, json, numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
R = np.random.default_rng(7)

def T(sec): return int(round(sec * SR))
def t_axis(d): return np.arange(T(d)) / SR
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
def note(name):
    names = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
    p, o = (name[:-1], int(name[-1]))
    return midi(12 * (o + 1) + names[p])

class Bus:
    def __init__(self, dur): self.L = np.zeros(T(dur) + SR * 4); self.R = np.zeros_like(self.L)
    def add(self, x, at, gain=1.0, pan=0.0):
        i = T(at)
        if i < 0: x = x[-i:]; i = 0
        n = min(len(x), len(self.L) - i)
        if n <= 0: return
        gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        if x.ndim == 2:
            self.L[i:i + n] += x[0, :n] * gain; self.R[i:i + n] += x[1, :n] * gain
        else:
            self.L[i:i + n] += x[:n] * gain * gl * 1.414; self.R[i:i + n] += x[:n] * gain * gr * 1.414
    def st(self): return np.vstack([self.L, self.R])

# ---------- primitives ----------
def sine(f, d, ph=0):
    t = t_axis(d)
    if callable(f): return np.sin(2 * np.pi * np.cumsum(f(t)) / SR + ph)
    return np.sin(2 * np.pi * f * t + ph)
def saw(f, d):
    t = t_axis(d); ph = (f * t) % 1.0 if not callable(f) else (np.cumsum(f(t)) / SR) % 1.0
    return 2 * ph - 1
def tri(f, d): return 2 * np.abs(saw(f, d)) - 1
def noise(d): return R.standard_normal(T(d))
def lp(x, fc, order=2): sos = signal.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos'); return signal.sosfilt(sos, x)
def hp(x, fc, order=2): sos = signal.butter(order, fc, 'high', fs=SR, output='sos'); return signal.sosfilt(sos, x)
def bp(x, lo, hi, order=2): sos = signal.butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'); return signal.sosfilt(sos, x)
def sweep_bp(x, f0, f1, q=4, blocks=64):
    """band-pass whose centre glides f0->f1 (block-wise)."""
    out = np.zeros_like(x); n = len(x); bs = max(1, n // blocks)
    for b in range(0, n, bs):
        k = b / max(1, n - 1); fc = f0 * (f1 / f0) ** k
        lo, hi = fc / (1 + 1 / q), fc * (1 + 1 / q)
        seg_ = x[max(0, b - 2048):b + bs]
        y = bp(seg_, max(20, lo), hi)
        out[b:b + bs] = y[-len(x[b:b + bs]):]
    return out
def env_exp(d, tau, attack=0.003):
    t = t_axis(d); e = np.exp(-t / tau); a = np.clip(t / max(attack, 1e-4), 0, 1); return e * a
def env_adsr(d, a, r, curve=1.0):
    t = t_axis(d); e = np.clip(t / max(a, 1e-4), 0, 1) * np.clip((d - t) / max(r, 1e-4), 0, 1); return e ** curve
def fade(x, fi=0.005, fo=0.01):
    n = len(x); a = min(n, T(fi)); b = min(n, T(fo)); y = x.copy()
    if a: y[:a] *= np.linspace(0, 1, a)
    if b: y[-b:] *= np.linspace(1, 0, b)
    return y
def reverb_ir(d=2.4, decay=0.6, seed=3, damp=6000):
    g = np.random.default_rng(seed); n = T(d); t = np.arange(n) / SR
    L = g.standard_normal(n) * np.exp(-t / decay); Rr = g.standard_normal(n) * np.exp(-t / decay)
    L, Rr = lp(L, damp), lp(Rr, damp); L[:T(0.01)] *= np.linspace(0, 1, T(0.01)); Rr[:T(0.01)] *= np.linspace(0, 1, T(0.01))
    s = np.sqrt(np.sum(L ** 2)); return L / s, Rr / s
def reverb(st, mix=0.25, d=2.4, decay=0.6, damp=6000):
    irL, irR = reverb_ir(d, decay, damp=damp)
    wl = signal.fftconvolve(st[0], irL)[:st.shape[1]]; wr = signal.fftconvolve(st[1], irR)[:st.shape[1]]
    return np.vstack([st[0] + mix * wl, st[1] + mix * wr])
def delay(st, dt, fb=0.35, n=4, pan_swap=True):
    out = st.copy(); d = T(dt)
    for k in range(1, n + 1):
        g = fb ** k; src = st[::-1] if (pan_swap and k % 2) else st
        out[:, d * k:] += g * src[:, :st.shape[1] - d * k]
    return out
def softclip(x, drive=1.0): return np.tanh(x * drive) / np.tanh(drive)

# ---------- instruments ----------
def pad_note(f, d, cutoff=900, det=0.006):
    x = sum(saw(f * (1 + det * k), d) for k in (-1, 0, 1)) / 3
    x = lp(x, cutoff, 2) + 0.4 * sine(f / 2, d)
    return x * env_adsr(d, min(1.2, d * 0.4), min(1.5, d * 0.5))
def pluck(f, d=0.5, bright=3000, tau=0.18):
    x = saw(f, d) * 0.6 + 0.4 * sine(f * 2, d)
    return fade(lp(x, bright) * env_exp(d, tau, 0.002))
def marimba(f, d=0.6):
    t = t_axis(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.28) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / 0.05) + 0.15 * np.sin(2 * np.pi * f * 10 * t) * np.exp(-t / 0.015)
    return fade(x * np.clip(t / 0.002, 0, 1))
def bell(f, d=1.6, tau=0.6):
    t = t_axis(d); parts = [(1, 1, 1), (2.76, 0.5, 0.5), (5.4, 0.25, 0.3), (8.93, 0.12, 0.2)]
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (tau * td)) for m, a, td in parts)
    return fade(x * np.clip(t / 0.002, 0, 1))
def glock(f, d=1.0): return bell(f, d, 0.35)
def kick(d=0.4, f0=120, f1=42, drive=1.5):
    t = t_axis(d); f = f1 + (f0 - f1) * np.exp(-t / 0.04)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    return fade(softclip(x, drive))
def snap(d=0.18, lo=900, hi=5000, tau=0.05): return fade(bp(noise(d), lo, hi) * env_exp(d, tau, 0.001))
def hat(d=0.06): return fade(hp(noise(d), 7000) * env_exp(d, 0.018, 0.001))
def whoosh(d, f0=300, f1=3000, peak=0.6):
    t = t_axis(d); e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    e = np.where(t / d < peak, (t / (d * peak)) ** 2, 1) * np.where(t / d >= peak, np.clip(1 - (t / d - peak) / (1 - peak), 0, 1) ** 1.2, 1)
    return fade(sweep_bp(noise(d), f0, f1, q=2) * e, 0.01, 0.05)
def zap(d=0.28, f0=1900, f1=260):
    t = t_axis(d); f = f1 + (f0 - f1) * np.exp(-t / 0.06)
    return fade(softclip(np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.8 + 0.3 * saw(lambda tt: f, d), 2) * env_exp(d, 0.12))
def pop(f0=380, f1=1000, d=0.09):
    t = t_axis(d); f = f0 + (f1 - f0) * np.clip(t / 0.04, 0, 1)
    return fade(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, 0.03, 0.001))
def boing(f=220, d=0.7, depth=0.35, rate=11):
    t = t_axis(d); ff = f * (1 + depth * np.exp(-t / 0.25) * np.sin(2 * np.pi * rate * t))
    return fade(np.sin(2 * np.pi * np.cumsum(ff) / SR) * env_exp(d, 0.25, 0.003))
def click(f=3000, d=0.02): return fade(bp(noise(d), f * 0.6, f * 1.6) * env_exp(d, 0.004, 0.0005))
def thud(d=0.6, f0=90, f1=38):
    x = kick(d, f0 * 1.6, f1, 2.5) + 0.5 * lp(noise(d), 400) * env_exp(d, 0.08)
    return x
def shatter(d=0.7, seed=1):
    g = np.random.default_rng(seed); out = np.zeros(T(d))
    for k in range(38):
        at = g.uniform(0, d * 0.7) ** 1.4 / (d * 0.7) ** 0.4; f = g.uniform(2500, 9000)
        s = bell(f, 0.12, 0.03) * g.uniform(0.2, 0.7); i = T(at); n = min(len(s), len(out) - i); out[i:i + n] += s[:n]
    out += 0.4 * hp(noise(d), 3000) * env_exp(d, 0.05)
    return out
def riser(d, f0=200, f1=4000):
    t = t_axis(d); e = (t / d) ** 2.2
    return fade(sweep_bp(noise(d), f0, f1, q=6) * e + 0.15 * saw(lambda tt: 80 + 300 * (tt / d) ** 2, d) * e, 0.05, 0.02)
def hiss(d=0.7): return fade(hp(noise(d), 4500) * env_adsr(d, 0.08, 0.4, 1.4) * 0.6)
def shutter_sfx():
    out = np.zeros(T(0.3)); a = click(2500, 0.03); b = click(1800, 0.04); out[:len(a)] += a; i = T(0.09); out[i:i + len(b)] += b
    out += 0.15 * bp(noise(0.3), 800, 4000) * env_exp(0.3, 0.04)
    return out
def rumble(d): t = t_axis(d); return lp(noise(d), 180, 4) * (t / d) ** 1.3 * 3 + 0.3 * sine(42, d) * (t / d)

# ---------- voice + ducking ----------
def load_voice(path):
    sr, x = wavfile.read(path)
    x = x.astype(np.float64); x = x / (np.abs(x).max() + 1e-9)
    if x.ndim == 2: x = x.mean(1)
    if sr != SR: x = signal.resample_poly(x, SR, sr)
    return x
def envelope(x, att=0.02, rel=0.3):
    a = np.abs(x); w = T(0.03); a = np.convolve(a, np.ones(w) / w, 'same')
    out = np.zeros_like(a); ka, kr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR)); v = 0.0
    # vectorised-ish: process in chunks of 64 for speed
    step = 64
    for i in range(0, len(a), step):
        m = a[i:i + step].max(); k = ka if m > v else kr; v = m + (v - m) * (k ** step); out[i:i + step] = v
    return out / (out.max() + 1e-9)


def master(music, sfx, voice, END, v_at, duck=0.55, mgain=1.0, sgain=1.0):
    n = T(END)
    music, sfx = music[:, :n], sfx[:, :n]
    mix = np.zeros((2, n))
    if voice is not None:
        vv = np.zeros(n); i = T(v_at); k = min(len(voice), n - i); vv[i:i + k] = voice[:k]
        e = envelope(vv); g = 1 - duck * np.clip(e * 1.6, 0, 1)
        vv = hp(vv, 80)
        mix += np.vstack([vv, vv]) * 0.55
        music = music * g
    mix += music * 0.32 * mgain + sfx * 0.42 * sgain
    # gentle tail fade
    fo = T(0.6); mix[:, -fo:] *= np.linspace(1, 0, fo)
    pk = np.abs(mix).max(); mix = mix / pk * 0.89
    return mix



# ---------- shared arranger ----------
def section(bus, t0, t1, chords, roots, beat=0.6, gain=1.0, cutoff=800, bass=0.22, arp=0.0, arp_cut=3000, kick_=0.0, hats=0.0, snare=0.0, marim=0.0, seed=1, bars_per_chord=2):
    """Lay a chord progression between t0 and t1: pads + sub bass (+ optional arpeggio, kick, hats, snare, marimba melody).
    chords: list of note-name triads, roots: bass note names; one chord lasts bars_per_chord * 2 beats."""
    g = np.random.default_rng(seed)
    clen = beat * 2 * bars_per_chord
    t = t0; k = 0
    while t < t1 - 0.05:
        ch, rt = chords[k % len(chords)], roots[k % len(roots)]
        d = min(clen, t1 - t) + 1.2
        for n in ch: bus.add(pad_note(note(n), d, cutoff), t, 0.15 * gain, pan=g.uniform(-0.4, 0.4))
        bus.add(sine(note(rt), d) * env_adsr(d, 0.6, 1.0), t, bass * gain)
        end = min(t + clen, t1) - 0.02
        if arp > 0:
            tones = [note(n) * 2 for n in ch] + [note(ch[0]) * 4]; tt, i = t, 0
            while tt < end: bus.add(pluck(tones[[0, 1, 2, 3, 2, 1][i % 6]], 0.45, arp_cut, 0.16), tt, 0.085 * arp * gain, pan=0.3 * np.sin(i)); tt += beat / 2; i += 1
        if marim > 0:
            scale = [note(n) * 4 for n in ch] + [note(ch[1]) * 8]; tt = t
            while tt < end:
                if g.random() < 0.6: bus.add(marimba(scale[g.integers(len(scale))], 0.5), tt, 0.1 * marim * gain, pan=0.25)
                tt += beat / 2
        tt, b = t, 0
        while tt < end:
            if kick_ > 0 and b % 2 == 0: bus.add(kick(0.42, 110, 40, 1.4), tt, 0.45 * kick_ * gain)
            if snare > 0 and b % 4 == 2: bus.add(snap(0.18, 900, 5000, 0.05), tt, 0.16 * snare * gain, pan=0.1)
            if hats > 0: bus.add(hat(0.05), tt + beat / 2, 0.05 * hats * gain, pan=0.35)
            tt += beat; b += 1
        t += clen; k += 1
