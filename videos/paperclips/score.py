"""Music + sound design for «Скрепочный максимизатор». Driven by out/paperclips/events.json (VIDEO.events()).
Arc: music-box curiosity → cheerful factory groove (A minor → C) → growing tension (arp + kick) → huge cosmic swell →
hard stop on «безупречно» → calm F major (orthogonality) → light marimba groove (boat race) → hopeful dawn (alignment) →
retro clicky loop (the game) → lullaby and the final clink."""
from instruments import *

BEAT = 60 / 100
MASTER = {'duck': 0.6, 'mgain': 0.6, 'sgain': 0.6}

AM = [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['C3', 'E3', 'G3'], ['G2', 'B2', 'D3']]
AM_R = ['A1', 'F1', 'C2', 'G1']
TENSE = [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['D3', 'F3', 'A3'], ['E3', 'G#3', 'B3']]
TENSE_R = ['A1', 'F1', 'D2', 'E2']
FM = [['F3', 'A3', 'C4'], ['C3', 'E3', 'G3'], ['D3', 'F3', 'A3'], ['A#2', 'D3', 'F3']]
FM_R = ['F2', 'C2', 'D2', 'A#1']
HOPE = [['A#2', 'D3', 'F3'], ['F3', 'A3', 'C4'], ['C3', 'E3', 'G3'], ['D3', 'F3', 'A3']]
HOPE_R = ['A#1', 'F2', 'C2', 'D2']


def first(ev, name):
    return next(e for e in ev['events'] if e['n'] == name)


def score(ev, END):
    bm, bs = Bus(END), Bus(END)
    Bd = ev['Bd']
    done = first(ev, 'check')['t']           # «безупречно» — the cosmic swell stops here
    galaxy = first(ev, 'galaxy')

    # ---------- music ----------
    # hook + title: a little music-box motif over a soft pad
    section(bm, 0, Bd[2], AM, AM_R, beat=BEAT, gain=0.6, cutoff=700, seed=1)
    for j, n in enumerate(['E5', 'A5', 'C6', 'B5', 'A5', 'E5', 'G5', 'A5'] * 3):
        t = 0.6 + j * BEAT
        if t < Bd[2] - 0.3: bm.add(bell(note(n), 1.2, 0.35), t, 0.05, pan=0.2 * np.sin(j))
    # origin + factory: cheerful mechanical groove
    section(bm, Bd[2], Bd[3], AM, AM_R, beat=BEAT, gain=0.75, cutoff=1000, arp=0.6, seed=2)
    section(bm, Bd[3], Bd[4], [['C3', 'E3', 'G3'], ['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3']], ['C2', 'A1', 'F1', 'G1'],
            beat=BEAT, gain=0.85, cutoff=1600, marim=1.0, kick_=0.5, hats=1.0, seed=3)
    # smarter → convergence → button → atoms: tension builds
    section(bm, Bd[4], Bd[6], TENSE, TENSE_R, beat=BEAT, gain=0.9, cutoff=1200, arp=0.9, arp_cut=3600, kick_=0.6, seed=4)
    section(bm, Bd[6], Bd[8], TENSE, TENSE_R, beat=BEAT, gain=1.0, cutoff=1500, arp=1.1, arp_cut=4400, kick_=0.9, snare=0.6, hats=0.6, seed=5)
    # cosmos: no drums, one huge swelling pad, cut dead on «безупречно»
    d = done - Bd[8]
    for n in ('A1', 'E2', 'A2', 'C3', 'E3', 'A3', 'E4'):
        bm.add(pad_note(note(n), d + 0.2, 1800) * np.linspace(0.4, 1.2, T(d + 0.2)), Bd[8], 0.16)
    bm.add(riser(galaxy['d'], 150, 6000), galaxy['t'], 0.18)
    # orthogonality: calm, sparse
    section(bm, Bd[9] + 0.2, Bd[10], FM, FM_R, beat=BEAT, gain=0.6, cutoff=900, seed=6, bars_per_chord=4)
    for j, n in enumerate(['C5', 'F5', 'A5', 'G5', 'F5', 'C5', 'D5', 'F5', 'A5', 'C6', 'A5', 'F5']):
        bm.add(bell(note(n), 1.6, 0.5), Bd[9] + 0.6 + j * BEAT * 1.5, 0.05, pan=-0.3 + j * 0.05)
    # boat race: playful marimba groove
    section(bm, Bd[10], Bd[11], FM, FM_R, beat=BEAT * 0.9, gain=0.85, cutoff=1800, marim=1.0, kick_=0.5, hats=1.0, snare=0.5, seed=7)
    # alignment: hopeful dawn
    section(bm, Bd[11], Bd[12], HOPE, HOPE_R, beat=BEAT, gain=0.9, cutoff=2200, arp=0.9, arp_cut=5200, seed=8)
    # the game: retro bright plucks
    section(bm, Bd[12], Bd[13], [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['E3', 'G#3', 'B3']], ['A1', 'F1', 'G1', 'E2'],
            beat=BEAT * 0.75, gain=0.7, cutoff=2600, arp=1.2, arp_cut=7000, kick_=0.4, seed=9)
    # finale: lullaby
    section(bm, Bd[13], END, [['A2', 'C3', 'E3']], ['A1'], beat=BEAT, gain=0.45, cutoff=500, seed=10, bars_per_chord=8)
    for j, n in enumerate(['E5', 'A5', 'C6', 'B5', 'A5']):
        bm.add(bell(note(n), 2.0, 0.7), Bd[13] + 0.3 + j * BEAT * 1.2, 0.06)

    # ---------- SFX ----------
    for e in ev['events']:
        n, t = e['n'], e['t']; d = e.get('d', 1.0); i = e.get('i', 0)
        if n == 'room': bs.add(lp(noise(d), 300) * env_adsr(d, 1.0, 1.0) * 0.6, t, 0.12)
        elif n == 'pop': bs.add(pop(), t, 0.3, pan=R.uniform(-0.3, 0.3))
        elif n == 'soft_pop': bs.add(pop(300 + 40 * (i % 8), 800 + 70 * (i % 8), 0.08), t, 0.18, pan=R.uniform(-0.6, 0.6))
        elif n == 'pop_big': bs.add(pop(300, 900, 0.12), t, 0.45); bs.add(glock(note('A6'), 0.8), t + 0.05, 0.1)
        elif n == 'glint':
            for j, f in enumerate(['E6', 'A6', 'E7']): bs.add(glock(note(f), 0.7), t + j * 0.06, 0.05, pan=0.4)
        elif n == 'robot':
            x = fade(sq_wave(lambda q: 300 + 200 * np.sign(np.sin(2 * np.pi * 9 * q)), 0.35)) * env_adsr(0.35, 0.01, 0.1)
            bs.add(lp(x, 2500), t, 0.08, pan=-0.5); bs.add(boing(260, 0.5), t, 0.15, pan=-0.5)
        elif n == 'zap': bs.add(zap(0.4), t, 0.4, pan=-0.3)
        elif n == 'cross': bs.add(whoosh(0.4, 600, 4000, 0.5), t, 0.3, pan=-0.4); bs.add(thud(0.5, 120, 60), t + 0.3, 0.35)
        elif n == 'cross_small': bs.add(whoosh(0.25, 1000, 5000, 0.5), t, 0.15)
        elif n == 'dive': bs.add(whoosh(0.5, 200, 5000, 0.9), t, 0.6)
        elif n == 'cosmic':
            x = sum(sine(note(f), d + 0.6) for f in ('A2', 'E3', 'A3', 'C4', 'E5')) / 5 * env_adsr(d + 0.6, 0.15, 0.5)
            bs.add(x, t, 0.35); bs.add(thud(1.4, 60, 28), t, 0.6)
        elif n == 'whoosh_back': bs.add(whoosh(0.5, 5000, 300, 0.3), t, 0.4)
        elif n == 'clink': bs.add(bell(note(['E6', 'G6', 'A6', 'C7', 'D7'][i % 5]), 0.5, 0.12), t, 0.06, pan=-0.5 + (i % 12) / 12); bs.add(click(5000, 0.015), t, 0.15)
        elif n == 'counter': bs.add(pop(500, 1200, 0.1), t, 0.3, pan=0.7); bs.add(click(3000, 0.02), t + 0.08, 0.3, pan=0.7)
        elif n == 'stamp_soft': bs.add(thud(0.5, 140, 70), t, 0.4); bs.add(snap(0.15, 500, 3000, 0.05), t, 0.2)
        elif n == 'core':
            for m, f in enumerate(['A4', 'E5', 'A5', 'C6']): bs.add(bell(note(f), 2.4, 0.9), t + m * 0.03, 0.09)
            bs.add(thud(1.0, 60, 30), t, 0.45)
        elif n == 'whoosh': bs.add(whoosh(0.5, 250, 4500, 0.6), t, 0.5)
        elif n == 'plug': bs.add(click(2500, 0.03), t, 0.5); bs.add(thud(0.4, 160, 80), t, 0.4); bs.add(glock(note('A6'), 1.0), t + 0.08, 0.08)
        elif n == 'press': bs.add(thud(0.25, 180, 90), t, 0.22, pan=-0.3); bs.add(click(1800, 0.03), t + 0.02, 0.18, pan=-0.3); bs.add(bell(2600, 0.25, 0.06), t + 0.05, 0.03, pan=-0.2)
        elif n == 'down': bs.add(fade(sine(lambda q: 900 * (0.4 ** (q / d)), d) * env_adsr(d, 0.03, 0.2)), t, 0.06, pan=0.3)
        elif n == 'cheer':
            for k in range(8): bs.add(bp(noise(0.5), 800, 3000) * env_adsr(0.5, 0.05, 0.3), t + k * 0.05, 0.03, pan=R.uniform(-0.6, 0.6))
        elif n == 'rise': bs.add(riser(d, 200, 4000), t, 0.25)
        elif n == 'key': bs.add(click(R.uniform(2200, 3600), 0.02), t, 0.15, pan=0.2)
        elif n == 'eye_narrow': bs.add(fade(sine(lambda q: 700 - 300 * q, 0.3) * env_adsr(0.3, 0.02, 0.1)), t, 0.06)
        elif n == 'sub': bs.add(pop(300 + 80 * i, 900 + 120 * i, 0.1), t, 0.35, pan=[-0.6, 0.6, -0.6, 0.6][i]); bs.add(glock(note(['C6', 'E6', 'G6', 'C7'][i]), 0.8), t + 0.05, 0.08, pan=[-0.6, 0.6, -0.6, 0.6][i])
        elif n == 'title_hit': bs.add(thud(1.2, 80, 34), t, 0.5); bs.add(snap(0.3, 300, 3000, 0.08), t, 0.2)
        elif n == 'title_soft': bs.add(glock(note('C6'), 1.0), t, 0.08); bs.add(glock(note('F6'), 1.0), t + 0.06, 0.07)
        elif n == 'goal': bs.add(pop(350, 900, 0.1), t, 0.3, pan=-0.6); bs.add(bell(note(['A4', 'C5', 'E5'][i]), 1.0, 0.4), t, 0.06, pan=-0.6)
        elif n == 'drive': bs.add(pop(300, 800, 0.12), t, 0.35, pan=0.6); bs.add(bell(note(['A3', 'E4', 'A4'][i]), 1.4, 0.5), t, 0.07, pan=0.6)
        elif n == 'converge':
            x = sum(sine(lambda q, f=f: f * (1 + 0.5 * (1 - q / d)), d) for f in (330, 440, 550)) / 3 * env_adsr(d, 0.3, 0.6)
            bs.add(x, t, 0.06); bs.add(whoosh(d, 300, 2000, 0.6), t, 0.2)
        elif n == 'step': bs.add(lp(noise(0.08), 900) * env_exp(0.08, 0.02), t, 0.12, pan=-0.5)
        elif n == 'whir': bs.add(fade(saw(lambda q: 200 + 400 * q, 0.4) * env_adsr(0.4, 0.05, 0.2)) * 0.3, t, 0.08, pan=0.6)
        elif n == 'riser': bs.add(riser(max(0.3, d), 300, 5000), t, 0.3)
        elif n == 'slam': bs.add(thud(1.6, 70, 28), t, 1.0); bs.add(shatter(0.4, 4) * 0.4, t, 0.25); bs.add(bell(1800, 1.4, 0.5), t, 0.1)
        elif n == 'boing': bs.add(boing(240, 0.7), t, 0.3, pan=-0.4)
        elif n == 'scanner':
            tt2 = t_axis(d); x = bp(noise(d), 2000, 6000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 3 * tt2))) * env_adsr(d, 0.1, 0.2); bs.add(x, t, 0.12)
        elif n == 'stream':
            tt2 = t_axis(d); x = bp(noise(d), 3000, 9000) * (0.3 + 0.7 * np.abs(np.sin(2 * np.pi * 7 * tt2))) * env_adsr(d, 0.3, 0.5); bs.add(x, t, 0.08, pan=0.4)
            for k in range(int(d / 0.09)): bs.add(glock(R.uniform(2000, 5000), 0.15), t + k * 0.09, 0.012, pan=R.uniform(0, 0.8))
        elif n == 'grind': bs.add(lp(noise(d), 700) * env_adsr(d, 0.2, 0.4), t, 0.2); bs.add(fade(saw(lambda q: 80 + 40 * q, d) * env_adsr(d, 0.2, 0.4)) * 0.3, t, 0.1)
        elif n == 'whoosh_out': bs.add(whoosh(1.0, 150, 1200, 0.3), t, 0.4)
        elif n == 'ding_low': bs.add(bell(note(['A3', 'C4', 'E4', 'G4', 'A4', 'C5', 'E5'][i]), 1.2, 0.4), t, 0.05)
        elif n == 'launch': bs.add(whoosh(0.6, 400, 6000, 0.3), t, 0.15, pan=R.uniform(-0.8, 0.8))
        elif n == 'sparkle': bs.add(glock(note(['A6', 'C7', 'E7', 'A7'][i % 4]), 0.6), t, 0.04, pan=R.uniform(-0.8, 0.8))
        elif n == 'galaxy': bs.add(lp(noise(d), 200) * env_adsr(d, d * 0.8, 0.1) * 2, t, 0.3)
        elif n == 'complete': bs.add(bell(note('A5'), 1.5, 0.5), t, 0.18); bs.add(bell(note('E6'), 1.5, 0.5), t + 0.1, 0.15)
        elif n == 'check': bs.add(click(3000, 0.02), t, 0.4); bs.add(glock(note('A6'), 1.2), t + 0.02, 0.12)
        elif n == 'calm':
            for m, f in enumerate(['F3', 'C4', 'F4', 'A4', 'C5']): bs.add(bell(note(f), 3.0, 1.0), t + m * 0.07, 0.04)
        elif n == 'cap': bs.add(whoosh(0.4, 2000, 600, 0.6), t - 0.3, 0.15); bs.add(boing(320, 0.6, 0.3, 10), t + 0.05, 0.25)
        elif n == 'motor':
            tt2 = t_axis(d); x = lp(saw(lambda q: 70 + 6 * np.sin(2 * np.pi * 0.7 * q), d), 600) * (0.7 + 0.3 * np.sin(2 * np.pi * 11 * tt2)) * env_adsr(d, 0.5, 0.6)
            bs.add(x, t, 0.05)
        elif n == 'coin': bs.add(bell(2600, 0.8, 0.25), t, 0.12); bs.add(bell(3900, 0.6, 0.2), t + 0.07, 0.08)
        elif n == 'bonus': bs.add(glock(note(['C6', 'E6', 'G6'][i]), 0.5), t, 0.08, pan=-0.5); bs.add(pop(600, 1400, 0.06), t, 0.12, pan=-0.5)
        elif n == 'fire':
            tt2 = t_axis(d); x = bp(noise(d), 300, 2500) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 5 * tt2 + np.sin(tt2 * 13)))) * env_adsr(d, 0.3, 0.8)
            bs.add(x, t, 0.06, pan=-0.5)
        elif n == 'bump': bs.add(thud(0.5, 130, 60), t, 0.45, pan=-0.4); bs.add(boing(180, 0.4), t, 0.15, pan=-0.4)
        elif n == 'score': bs.add(riser(0.8, 400, 4000), t, 0.15); bs.add(bell(note('E6'), 1.0, 0.3), t + 0.8, 0.1)
        elif n == 'ding': bs.add(bell(note('C6'), 1.5, 0.5), t, 0.15); bs.add(bell(note('G6'), 1.5, 0.5), t + 0.08, 0.1)
        elif n == 'cosmic_small': bs.add(sum(sine(note(f), 1.2) for f in ('A3', 'E4', 'C5')) / 3 * env_adsr(1.2, 0.1, 0.8), t, 0.15)
        elif n == 'dawn':
            for m, f in enumerate(['A#3', 'D4', 'F4', 'A4', 'C5', 'F5']): bs.add(bell(note(f), 3.0, 1.0), t + m * 0.07, 0.04)
        elif n == 'click': bs.add(click(2600, 0.02), t, 0.3, pan=0.2); bs.add(click(1400, 0.03), t + 0.03, 0.15, pan=0.2)
        elif n == 'sting':
            x = sum(sine(note(f), 1.4) for f in ('A3', 'C#4', 'E4', 'A4')) / 4 * env_adsr(1.4, 0.02, 1.0); bs.add(x, t, 0.25); bs.add(thud(0.8, 90, 40), t, 0.4)
        elif n == 'swarm':
            for k in range(40): bs.add(pop(R.uniform(400, 900), R.uniform(1000, 1800), 0.05), t + d * (k / 40) ** 0.8, 0.07, pan=R.uniform(-0.8, 0.8))
        elif n == 'clink_big': bs.add(bell(note('E6'), 1.2, 0.3), t, 0.18); bs.add(click(5000, 0.02), t, 0.3); bs.add(glock(note('B6'), 0.8), t + 0.04, 0.08)
        elif n == 'end_hit': bs.add(thud(2.4, 60, 28), t + 0.1, 0.7); bs.add(bell(note('A2'), 3.5, 1.4), t + 0.1, 0.12)

    # silence the music between «безупречно» and the orthogonality section (one breath)
    a, b = T(done + 0.15), T(Bd[9] + 0.2); fn = T(0.08)
    for ch in (bm.L, bm.R):
        ch[a:a + fn] *= np.linspace(1, 0, fn)[:len(ch[a:a + fn])]; ch[a + fn:b] = 0
    music = reverb(bm.st(), 0.3, 3.0, 0.9)
    sfx = reverb(bs.st(), 0.2, 2.0, 0.5)
    return music, sfx


def sq_wave(f, d):
    return np.sign(saw(f, d))
