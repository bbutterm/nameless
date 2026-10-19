"""Music + sound design for «Василиск Роко» (long). Driven by out/basilisk/events.json (VIDEO.events()).
Arc: dark D-minor ambient → build → threat pulse → hard stop on «Теперь — слышал» → driving ban section →
bright F-major «good news» → dark-to-dawn swell → lullaby and the final low hit on the eye blink."""
from instruments import *

BEAT = 60 / 90
BAR = BEAT * 4
MASTER = {'duck': 0.6, 'mgain': 0.45, 'sgain': 0.6}

DM = [['D3', 'F3', 'A3'], ['A#2', 'D3', 'F3'], ['G2', 'A#2', 'D3'], ['A2', 'C#3', 'E3']]
DM_ROOT = ['D2', 'A#1', 'G1', 'A1']
FM = [['F3', 'A3', 'C4'], ['C3', 'E3', 'G3'], ['D3', 'F3', 'A3'], ['A#2', 'D3', 'F3']]
FM_ROOT = ['F2', 'C2', 'D2', 'A#1']
HOPE = [['A#2', 'D3', 'F3'], ['F3', 'A3', 'C4'], ['C3', 'E3', 'G3'], ['D3', 'F3', 'A3']]
HOPE_ROOT = ['A#1', 'F2', 'C2', 'D2']


def first(ev, name, default=None):
    xs = [e for e in ev['events'] if e['n'] == name]
    return xs[0] if xs else default


def section(bus, t0, t1, chords, roots, gain=1.0, cutoff=800, bass=0.22, arp=0.0, arp_cut=3000, kick=0.0, hats=0.0, snap_=0.0, marim=0.0, rng_seed=1, bars_per_chord=2):
    """Lay a chord progression between t0 and t1: pads + sub bass (+ optional arp, kick, hats, snare, marimba melody)."""
    g = np.random.default_rng(rng_seed)
    clen = BAR * bars_per_chord / 2
    t = t0; k = 0
    while t < t1 - 0.05:
        ch, rt = chords[k % len(chords)], roots[k % len(roots)]
        d = min(clen, t1 - t) + 1.2
        for n in ch: bus.add(pad_note(note(n), d, cutoff), t, 0.15 * gain, pan=g.uniform(-0.4, 0.4))
        bus.add(sine(note(rt), d) * env_adsr(d, 0.6, 1.0), t, bass * gain)
        if arp > 0:
            tones = [note(n) * 2 for n in ch] + [note(ch[0]) * 4]
            tt, i = t, 0
            while tt < min(t + clen, t1) - 0.02:
                bus.add(pluck(tones[[0, 1, 2, 3, 2, 1][i % 6]], 0.45, arp_cut, 0.16), tt, 0.085 * arp * gain, pan=0.3 * np.sin(i))
                tt += BEAT / 2; i += 1
        if marim > 0:
            scale = [note(n) * 4 for n in ch] + [note(ch[1]) * 8]
            tt = t
            while tt < min(t + clen, t1) - 0.02:
                if g.random() < 0.6: bus.add(marimba(scale[g.integers(len(scale))], 0.5), tt, 0.1 * marim * gain, pan=0.25)
                tt += BEAT / 2
        tt = t; b = 0
        while tt < min(t + clen, t1) - 0.02:
            if kick > 0 and b % 2 == 0: bus.add(kick_(), tt, 0.45 * kick * gain)
            if snap_ > 0 and b % 4 == 2: bus.add(snap(0.18, 900, 5000, 0.05), tt, 0.16 * snap_ * gain, pan=0.1)
            if hats > 0: bus.add(hat(0.05), tt + BEAT / 2, 0.05 * hats * gain, pan=0.35)
            tt += BEAT; b += 1
        t += clen; k += 1


def kick_(): return kick(0.42, 110, 40, 1.4)


def score(ev, END):
    bus_m, bus_s = Bus(END), Bus(END)
    Bd = ev['Bd']
    big = first(ev, 'big_sting')['t']
    dawn_rise = first(ev, 'dawn_rise')['t']
    warm = first(ev, 'warm')['t']
    eye_end = first(ev, 'eye_sting')['t']

    # ---------- music ----------
    # A: dark ambient (hook, welcome, forum) + low drone
    section(bus_m, 0, Bd[3], DM, DM_ROOT, gain=0.75, cutoff=650, arp=0.0, rng_seed=1)
    d0 = Bd[3]
    bus_m.add(lp(saw(55, d0) + saw(55.4, d0), 300) * env_adsr(d0, 2.5, 2.0) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.25 * t_axis(d0))), 0, 0.10)
    # sparse plucks in the forum room
    tt = Bd[2] + 0.3; i = 0
    while tt < Bd[3] - 0.3:
        bus_m.add(pluck(note(['D5', 'F5', 'A5', 'E5'][i % 4]), 0.5, 2200, 0.2), tt, 0.05, pan=0.3 * np.sin(i)); tt += BEAT; i += 1
    # B: build into the superintelligence, warming to a hopeful progression on «делать мир лучше»
    section(bus_m, Bd[3], warm, DM, DM_ROOT, gain=0.9, cutoff=1000, arp=0.8, arp_cut=3200, rng_seed=2)
    section(bus_m, warm, Bd[4], HOPE, HOPE_ROOT, gain=1.0, cutoff=1600, arp=1.0, arp_cut=4800, rng_seed=3)
    # B2: every day — gentle pulse, minor again
    section(bus_m, Bd[4], Bd[5], DM, DM_ROOT, gain=0.85, cutoff=900, arp=0.6, kick=0.35, rng_seed=4)
    # C: threat → copy → basilisk; darker, steady heartbeat kick, stops dead on «Теперь — слышал»
    section(bus_m, Bd[5], Bd[6], DM, DM_ROOT, gain=1.0, cutoff=1300, arp=1.0, arp_cut=3600, kick=0.8, rng_seed=5)
    section(bus_m, Bd[6], Bd[7], [['D3', 'F3', 'G#3']], ['D2'], gain=0.7, cutoff=700, rng_seed=6, bars_per_chord=4)
    section(bus_m, Bd[7], big - 0.05, DM, DM_ROOT, gain=1.0, cutoff=1500, arp=1.1, arp_cut=4200, kick=0.9, rng_seed=7)
    # D: the ban — driving, with snare, picks up after a beat of silence
    section(bus_m, Bd[8] + 0.1, Bd[9], DM, DM_ROOT, gain=0.9, cutoff=1300, arp=0.9, kick=0.8, snap_=0.9, hats=0.8, rng_seed=8)
    # E: good news — F major, marimba, light groove
    section(bus_m, Bd[9], Bd[12], FM, FM_ROOT, gain=0.85, cutoff=1800, marim=1.0, kick=0.45, hats=0.9, rng_seed=9)
    # F: the lesson — dark pad, then dawn swell into a bright chord
    section(bus_m, Bd[12], dawn_rise + 0.7, [['D3', 'F3', 'A3'], ['A#2', 'D3', 'F3']], ['D2', 'A#1'], gain=0.7, cutoff=600, rng_seed=10)
    section(bus_m, dawn_rise + 0.7, Bd[13], HOPE, HOPE_ROOT, gain=1.0, cutoff=2200, arp=0.9, arp_cut=5200, rng_seed=11)
    # G: lullaby + soft pad
    section(bus_m, Bd[13], END, [['D3', 'F3', 'A3']], ['D2'], gain=0.5, cutoff=500, rng_seed=12, bars_per_chord=8)
    for j, n in enumerate(['A4', 'D5', 'F5', 'E5', 'D5', 'A4']):
        bus_m.add(bell(note(n), 2.0, 0.7), Bd[13] + 0.3 + j * BEAT, 0.07, pan=-0.2 + j * 0.08)

    # ---------- SFX ----------
    for e in ev['events']:
        n, t = e['n'], e['t']; d = e.get('d', 1.0)
        if n == 'drone': bus_s.add(lp(noise(4.0), 180) * env_adsr(4.0, 2.0, 1.5) * 2, t, 0.35)
        elif n == 'sparkle':
            for j, f in enumerate(['A5', 'D6', 'F6', 'A6']): bus_s.add(glock(note(f), 0.9), t + j * 0.07, 0.05, pan=0.4)
        elif n == 'warn': bus_s.add(sum(sine(note(f), 1.2) for f in ('D4', 'D#4')) * env_adsr(1.2, 0.02, 0.9) * 0.5, t, 0.2)
        elif n == 'tink': bus_s.add(glock(note(['E6', 'G6', 'B6', 'D7', 'A6'][e.get('i', 0) % 5]), 0.6), t, 0.07, pan=0.5)
        elif n == 'pop': bus_s.add(pop(), t, 0.3, pan=R.uniform(-0.3, 0.3))
        elif n == 'soft_pop': bus_s.add(pop(300 + 30 * (e.get('i', 0) % 8), 800 + 60 * (e.get('i', 0) % 8), 0.08), t, 0.18, pan=R.uniform(-0.6, 0.6))
        elif n == 'pop_big': bus_s.add(pop(300, 900, 0.12), t, 0.45); bus_s.add(glock(note('A6'), 0.8), t + 0.05, 0.1)
        elif n == 'swish': bus_s.add(whoosh(0.6, 400, 3000, 0.5), t, 0.3)
        elif n == 'absorb': bus_s.add(fade(sine(lambda q: 300 * (4 ** (q / 0.6)), 0.6) * env_adsr(0.6, 0.05, 0.2)), t - 0.3, 0.1); bus_s.add(bell(note('D5'), 2.0, 0.8), t, 0.1)
        elif n == 'board': bus_s.add(thud(1.6, 70, 30), t, 0.9); bus_s.add(riser(0.6, 300, 3000)[::-1], t, 0.25); bus_s.add(bell(note('D3'), 3.0, 1.2), t, 0.12)
        elif n == 'eye_open': bus_s.add(whoosh(1.0, 150, 1200, 0.7) * 0.7 + lp(noise(1.0), 200) * env_adsr(1.0, 0.6, 0.4), t, 0.5)
        elif n == 'lock': bus_s.add(kick(0.35, 90, 38, 2), t, 0.9); bus_s.add(kick(0.35, 80, 36, 2), t + 0.2, 0.6)
        elif n == 'title_hit': bus_s.add(thud(1.2, 80, 34), t, 0.6); bus_s.add(snap(0.3, 300, 3000, 0.08), t, 0.25)
        elif n == 'title_hit_soft': bus_s.add(glock(note('C6'), 1.0), t, 0.1); bus_s.add(glock(note('F6'), 1.0), t + 0.06, 0.08); bus_s.add(thud(0.6, 120, 60), t, 0.25)
        elif n == 'dive': bus_s.add(whoosh(0.75, 200, 5000, 0.85), t, 0.8)
        elif n == 'hit_low': bus_s.add(thud(1.4, 70, 30), t, 0.9); bus_s.add(bell(note('D3'), 2.5, 0.9), t, 0.1)
        elif n == 'flip': bus_s.add(whoosh(0.3, 1500, 5000, 0.4), t, 0.25); bus_s.add(click(2000, 0.03), t + 0.25, 0.3)
        elif n == 'chat': bus_s.add(pop(500 + 120 * e.get('i', 0), 1100 + 150 * e.get('i', 0), 0.08), t, 0.3, pan=0.5)
        elif n == 'key': bus_s.add(click(R.uniform(2200, 3600), 0.025), t, 0.22, pan=-0.2)
        elif n == 'glyph_whoosh': bus_s.add(whoosh(0.9, 600, 7000, 0.5), t, 0.45)
        elif n == 'rise': bus_s.add(riser(d, 200, 5000), t, 0.3)
        elif n == 'core':
            for m, f in enumerate(['D4', 'A4', 'D5', 'F5']): bus_s.add(bell(note(f), 2.6, 0.9), t + m * 0.03, 0.1)
            bus_s.add(thud(1.0, 60, 30), t, 0.5)
        elif n == 'pullback': bus_s.add(whoosh(d, 150, 900, 0.3), t, 0.35)
        elif n == 'warm':
            for m, f in enumerate(['A#3', 'D4', 'F4', 'A4', 'C5']): bus_s.add(bell(note(f), 3.0, 1.0), t + m * 0.05, 0.05)
        elif n == 'burst': bus_s.add(shatter(0.6, 3), t, 0.3, pan=-0.5); bus_s.add(glock(note('A6'), 0.8), t + 0.05, 0.08, pan=-0.5)
        elif n == 'freeze': bus_s.add(bell(3200, 1.2, 0.3), t, 0.15, pan=0.5); bus_s.add(hiss(0.5), t, 0.15, pan=0.5)
        elif n == 'tick': bus_s.add(click(1800, 0.03), t, 0.35); bus_s.add(click(900, 0.04), t + 0.02, 0.2)
        elif n == 'tile': bus_s.add(pop(260 + 25 * e['i'], 600 + 50 * e['i'], 0.08), t, 0.22, pan=-0.6 + e['i'] * 0.1)
        elif n == 'thud_soft': bus_s.add(thud(0.5, 90, 45), t, 0.2)
        elif n == 'slide': bus_s.add(whoosh(d, 300, 1500, 0.5), t, 0.3, pan=-0.3)
        elif n == 'chime': bus_s.add(glock(note(['F5', 'A5', 'C6', 'D6', 'F6', 'A6', 'C7', 'D7'][e['i']]), 0.8), t, 0.06, pan=0.6 - e['i'] * 0.15)
        elif n == 'sting':
            x = sum(sine(note(f), 2.2) for f in ('D3', 'D#3', 'A3', 'G#4')) / 4 * env_adsr(2.2, 0.03, 1.8)
            bus_s.add(x, t, 0.35); bus_s.add(thud(1.6, 60, 28), t, 0.8)
        elif n == 'scan':
            tt2 = t_axis(d); x = bp(saw(110, d), 300, 3000) * (0.5 + 0.5 * np.sin(2 * np.pi * 14 * tt2)) * env_adsr(d, 0.1, 0.3)
            bus_s.add(np.vstack([x * np.cos(np.linspace(0, np.pi / 2, len(x))), x * np.sin(np.linspace(0, np.pi / 2, len(x)))])[::-1], t, 0.25)
        elif n == 'ping': bus_s.add(bell(1240, 0.4, 0.1), t, 0.1, pan=R.uniform(-0.7, 0.2))
        elif n == 'target': bus_s.add(zap(0.25, 2400, 800), t, 0.2, pan=-0.3)
        elif n == 'calm_bell': bus_s.add(bell(note('A4'), 2.0, 0.8), t, 0.08)
        elif n == 'signal': bus_s.add(whoosh(d, 2500, 300, 0.4), t, 0.35, pan=0.2)
        elif n == 'alarm':
            for k in range(3): bus_s.add(fade(sine(lambda q: 880 + 220 * np.sign(np.sin(2 * np.pi * 6 * q)), 0.25) * env_adsr(0.25, 0.01, 0.05)), t + k * 0.3, 0.06)
        elif n == 'gears':
            for k in range(int(d / 0.09)): bus_s.add(click(R.uniform(1200, 2500), 0.02), t + k * 0.09 * (1 - 0.3 * k / max(1, d / 0.09)), 0.12, pan=-0.4)
        elif n == 'ghost': bus_s.add(whoosh(1.4, 200, 900, 0.5), t, 0.3); bus_s.add(bell(note('F4'), 2.5, 1.0), t + 0.3, 0.05)
        elif n == 'stone': bus_s.add(thud(0.8, 70, 40), t, 0.6); bus_s.add(lp(noise(0.3), 800) * env_exp(0.3, 0.08), t, 0.3)
        elif n == 'hum':
            tt2 = t_axis(d); x = (sine(60, d) + 0.5 * sine(120, d) + 0.2 * saw(180, d)) * env_adsr(d, 0.4, 0.6) * (0.8 + 0.2 * np.sin(2 * np.pi * 3 * tt2))
            bus_s.add(lp(x, 600), t, 0.12, pan=0.3)
        elif n == 'scanner':
            tt2 = t_axis(d); x = bp(noise(d), 2000, 6000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 2 * tt2))) * env_adsr(d, 0.1, 0.2)
            bus_s.add(x, t, 0.12, pan=0.3)
            for k in range(int(d / 0.06)): bus_s.add(click(R.uniform(3000, 6000), 0.015), t + k * 0.06, 0.06, pan=0.3)
        elif n == 'heart': bus_s.add(glock(note('E6'), 0.6), t, 0.1); bus_s.add(glock(note('A6'), 0.6), t + 0.09, 0.1)
        elif n == 'void': bus_s.add(sine(36.7, d) * env_adsr(d, 0.6, 0.6), t, 0.3)
        elif n == 'blink': bus_s.add(click(1200, 0.03), t, 0.2)
        elif n == 'morph':
            x = sum(sine(lambda q, f=f: f * (1 + 0.5 * q), 1.4) for f in (440, 660, 880)) / 3 * env_adsr(1.4, 0.3, 0.8)
            bus_s.add(x, t, 0.08); bus_s.add(whoosh(1.3, 300, 2500, 0.5), t, 0.3)
        elif n == 'hiss': bus_s.add(hiss(0.8), t, 0.4, pan=0.3)
        elif n == 'zap': bus_s.add(zap(0.35), t, 0.45, pan=-0.2)
        elif n == 'crack': bus_s.add(shatter(0.4, 2), t, 0.35, pan=-0.5)
        elif n == 'shield': bus_s.add(fade(sine(lambda q: 300 + 600 * q, 0.5) * env_adsr(0.5, 0.05, 0.3)), t, 0.08); bus_s.add(bell(note('E5'), 1.2, 0.4), t + 0.1, 0.06)
        elif n == 'bulb': bus_s.add(click(4000, 0.02), t, 0.4); bus_s.add(bell(note('A5'), 0.8, 0.2), t, 0.08)
        elif n == 'big_sting':
            bus_s.add(thud(2.4, 55, 25), t, 1.0); bus_s.add(kick(0.4, 90, 36, 2), t + 0.45, 0.7); bus_s.add(kick(0.4, 80, 34, 2), t + 0.7, 0.5)
            x = sum(sine(note(f), 2.6) for f in ('D3', 'G#3', 'D4', 'D#5')) / 4 * env_adsr(2.6, 0.01, 2.0)
            bus_s.add(x, t, 0.4); bus_s.add(whoosh(0.5, 300, 4000, 0.9), t - 0.45, 0.4)
        elif n == 'whoosh': bus_s.add(whoosh(0.5, 250, 4500, 0.6), t, 0.6)
        elif n == 'stamp': bus_s.add(thud(0.9, 85, 35), t, 1.0); bus_s.add(snap(0.25, 300, 3000, 0.07), t, 0.6)
        elif n == 'lock_drop': bus_s.add(whoosh(0.4, 400, 2000, 0.8), t - 0.4, 0.25); bus_s.add(thud(0.3, 140, 70), t - 0.02, 0.4); bus_s.add(click(4200, 0.02), t + 0.15, 0.6); bus_s.add(click(2600, 0.03), t + 0.2, 0.5)
        elif n == 'shatter': bus_s.add(shatter(0.8, 5), t, 0.55, pan=-0.2)
        elif n == 'swarm':
            for k in range(26): bus_s.add(whoosh(0.35, 800, 6000, 0.5), t + d * (k / 26) ** 1.3, 0.06, pan=R.uniform(-0.9, 0.9))
            for k in range(30): bus_s.add(pop(R.uniform(400, 900), R.uniform(1000, 1800), 0.05), t + 0.3 + d * (k / 30), 0.08, pan=R.uniform(-0.8, 0.8))
        elif n == 'whip': bus_s.add(whoosh(0.5, 300, 6000, 0.7), t, 0.6, pan=0.4)
        elif n == 'dawn':
            for m, f in enumerate(['F3', 'C4', 'F4', 'A4', 'C5', 'F5']): bus_s.add(bell(note(f), 3.5, 1.2), t + m * 0.08, 0.05)
        elif n == 'badge': bus_s.add(pop(400, 1000, 0.1), t, 0.35); bus_s.add(glock(note('C6'), 0.7), t + 0.05, 0.08)
        elif n == 'zip': bus_s.add(fade(lp(saw(lambda q: 120 + 500 * (q / d) ** 2, d), 2500) * env_adsr(d, 0.2, 0.05)), t, 0.15, pan=-0.3)
        elif n == 'boing': bus_s.add(boing(300, 0.7), t, 0.3, pan=0.4)
        elif n == 'grind': bus_s.add(lp(noise(d), 500) * env_adsr(d, 0.1, 0.3), t, 0.25, pan=-0.5)
        elif n == 'lock_click': bus_s.add(click(4200, 0.02), t, 0.5); bus_s.add(click(2600, 0.03), t + 0.05, 0.4)
        elif n == 'drain': bus_s.add(fade(sine(lambda q: 900 * (0.25 ** (q / d)), d) * env_adsr(d, 0.05, 0.2)), t, 0.07, pan=0.4)
        elif n == 'bounce': bus_s.add(boing(180, 0.6, 0.4, 9), t, 0.4); bus_s.add(thud(0.4, 130, 70), t, 0.3)
        elif n == 'deflate': bus_s.add(fade(saw(lambda q: 500 * (0.3 ** (q / 0.9)), 0.9) * env_adsr(0.9, 0.05, 0.3)) * 0.4 + hiss(0.9) * 0.5, t, 0.12, pan=0.4)
        elif n == 'coin':
            tt2 = t_axis(d); rate = 6 + 18 * (tt2 / d); am = 0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(rate) / SR)
            bus_s.add((sine(2600, d) + 0.6 * sine(3900, d) + 0.4 * sine(5300, d)) * am * env_adsr(d, 0.05, 0.1) * 0.3, t, 0.22)
        elif n == 'ting': bus_s.add(bell(2400, 1.6, 0.5), t, 0.25); bus_s.add(bell(3600, 1.2, 0.3), t, 0.12)
        elif n == 'boom': bus_s.add(thud(1.6, 80, 30), t, 0.8); bus_s.add(shatter(0.9, 9), t, 0.3)
        elif n == 'creep': bus_s.add(lp(noise(d), 300) * env_adsr(d, 0.6, 0.6) * 2 + sine(note('D#2'), d) * env_adsr(d, 0.8, 0.8) * 0.5, t, 0.3)
        elif n == 'dawn_rise': bus_s.add(riser(d, 200, 6000), t, 0.3)
        elif n == 'scribble':
            for k in range(int(d / 0.11)): bus_s.add(bp(noise(0.09), 1500, 5000) * env_adsr(0.09, 0.01, 0.06), t + k * 0.11 + R.uniform(0, 0.03), 0.12, pan=-0.2)
        elif n == 'ding': bus_s.add(bell(note('C6'), 1.5, 0.5), t, 0.18); bus_s.add(bell(note('G6'), 1.5, 0.5), t + 0.08, 0.12)
        elif n == 'eye_sting':
            x = sum(sine(note(f), 1.8) for f in ('D4', 'D#4', 'A4')) / 3 * env_adsr(1.8, 0.2, 1.3) * 0.8
            bus_s.add(x, t - 0.05, 0.25); bus_s.add(whoosh(0.5, 300, 1500, 0.8), t - 0.4, 0.3)
        elif n == 'end_hit': bus_s.add(thud(2.4, 60, 28), t + 0.9, 0.9); bus_s.add(bell(note('D2'), 3.5, 1.4), t + 0.9, 0.14)

    # silence the music right after the «Теперь — слышал» sting (one breath before the ban section)
    a, b = T(big + 0.05), T(Bd[8] + 0.1)
    fade_n = T(0.06)
    for ch in (bus_m.L, bus_m.R):
        ch[a:a + fade_n] *= np.linspace(1, 0, fade_n)[:len(ch[a:a + fade_n])]
        ch[a + fade_n:b] = 0
    music = reverb(bus_m.st(), 0.32, 3.0, 0.9)
    sfx = reverb(bus_s.st(), 0.2, 2.0, 0.5)
    return music, sfx
