"""Music + sound design for "Who Ruled the 1200s? The Mongols". Driven by out/mongols/events.json (VIDEO.events()).
Character (different from Basilisk's dark synths and Paperclips' music box): D minor pentatonic steppe music —
overtone drone, a bowed horse-head-fiddle melody, frame drums in a 6/8 gallop. Arc: lone drone + fiddle → bright
pentatonic plucks for China → gallop on the steppe → cold and sparse for the orphan boy → drums build to "Genghis Khan"
→ driving gallop through the five reasons → dark drone for fear → march west → warm Pax Mongolica → majestic 1279 →
storm and split → recap → night drone for the plague → the fiddle theme returns at sunset."""
from instruments import *

BEAT = 0.42                     # dotted-quarter of the gallop (≈143 bpm)
MASTER = {'duck': 0.6, 'mgain': 0.5, 'sgain': 0.6}

DM = [['D3', 'A3', 'D4'], ['C3', 'G3', 'C4'], ['A#2', 'F3', 'A#3'], ['C3', 'G3', 'C4']]
DM_R = ['D2', 'C2', 'A#1', 'C2']
FMAJ = [['F3', 'A3', 'C4'], ['C3', 'G3', 'C4'], ['D3', 'F3', 'A3'], ['A#2', 'F3', 'A#3']]
FMAJ_R = ['F2', 'C2', 'D2', 'A#1']
COLD = [['D3', 'F3', 'A3'], ['A#2', 'D3', 'F3'], ['G2', 'A#2', 'D3'], ['A2', 'C3', 'E3']]
COLD_R = ['D2', 'A#1', 'G1', 'A1']
WAR = [['D3', 'F3', 'A3'], ['A#2', 'D3', 'F3'], ['G2', 'A#2', 'D3'], ['A2', 'C#3', 'E3']]
WAR_R = ['D2', 'A#1', 'G1', 'A1']
MAJ = [['D3', 'F#3', 'A3'], ['G2', 'B2', 'D3'], ['A2', 'C#3', 'E3'], ['D3', 'F#3', 'A3']]
MAJ_R = ['D2', 'G1', 'A1', 'D2']
FALL = [['D3', 'F3', 'A3'], ['C3', 'E3', 'G3'], ['A#2', 'D3', 'F3'], ['A2', 'C#3', 'E3']]
FALL_R = ['D2', 'C2', 'A#1', 'A1']

# the fiddle theme (D minor pentatonic), (note, beats)
THEME = [('D4', 2), ('F4', 1), ('G4', 1), ('A4', 3), ('C5', 1), ('A4', 2), ('G4', 1), ('F4', 1), ('D4', 4),
         ('A3', 1), ('C4', 1), ('D4', 2), ('F4', 2), ('G4', 3), ('F4', 1), ('D4', 4)]


def melody(bus, t0, t1, notes, beat=0.5, gain=0.1, octave=0, pan=-0.15):
    t = t0
    for n, b in notes:
        d = b * beat
        if t + 0.2 > t1: break
        f = note(n) * 2 ** octave
        bus.add(bowed(f, min(d + 0.25, t1 - t + 0.3)), t, gain, pan=pan)
        t += d
    return t


def first(ev, name):
    return next(e for e in ev['events'] if e['n'] == name)


def score(ev, END):
    bm, bs = Bus(END), Bus(END)
    Bd = ev['Bd']
    g = np.random.default_rng(11)

    # ---------- music ----------
    # S1 hook: overtone drone + lone fiddle; title hit at the end
    bm.add(throat_drone(note('D2'), Bd[1] + 1.0), 0.0, 0.10)
    melody(bm, 1.2, Bd[1] - 0.6, THEME[:9], beat=0.42, gain=0.07)
    # S2 China: bright pentatonic plucks (guzheng-like) over F major
    section(bm, Bd[1] + 0.6, Bd[2], FMAJ, FMAJ_R, beat=0.5, gain=0.7, cutoff=1100, arp=0.9, arp_cut=4200, seed=2)
    # S3 steppe: gallop drums + fiddle
    section(bm, Bd[2], Bd[3], DM, DM_R, beat=BEAT * 2, gain=0.7, cutoff=900, seed=3)
    bm.add(throat_drone(note('D2'), Bd[3] - Bd[2] + 0.5, overtones=(8, 10, 12, 10)), Bd[2], 0.07)
    gallop_drums(bm, Bd[2] + 3.0, Bd[3] - 0.4, BEAT, 0.8)
    melody(bm, Bd[2] + 4.0, Bd[3] - 0.3, THEME, beat=0.42, gain=0.06, pan=0.2)
    # S4 boy: cold, sparse
    section(bm, Bd[3], Bd[4], COLD, COLD_R, beat=1.0, gain=0.6, cutoff=650, bars_per_chord=1, seed=4)
    melody(bm, Bd[3] + 2.0, Bd[4] - 0.5, [('A4', 3), ('G4', 1), ('F4', 2), ('D4', 4), ('F4', 2), ('C4', 2), ('D4', 6)], beat=0.6, gain=0.05)
    # S5 khan: drums build to the title
    khan_t = [e['t'] for e in ev['events'] if e['n'] == 'title_hit'][1]  # the second title hit is «Genghis Khan»
    section(bm, Bd[4], Bd[5], DM, DM_R, beat=BEAT * 2, gain=0.75, cutoff=1000, seed=5)
    gallop_drums(bm, Bd[4] + 2.5, khan_t, BEAT, 0.6)
    gallop_drums(bm, khan_t, Bd[5] - 0.2, BEAT, 1.0)
    for f in ('D3', 'A3', 'D4', 'F#4'): bm.add(pad_note(note(f), 4.0, 1600), khan_t, 0.08)
    # S6 question: suspense
    section(bm, Bd[5], Bd[6], [['D3', 'G3', 'A3'], ['C3', 'F3', 'G3']], ['D2', 'C2'], beat=1.0, gain=0.55, cutoff=700, seed=6)
    # S7–S10 reasons: driving gallop, varied per reason
    section(bm, Bd[6], Bd[7], DM, DM_R, beat=BEAT * 2, gain=0.8, cutoff=1300, seed=7)
    gallop_drums(bm, Bd[6] + 0.3, Bd[7] - 0.2, BEAT, 1.1)
    melody(bm, Bd[6] + 2.0, Bd[7] - 0.2, THEME, beat=0.42, gain=0.055, octave=0, pan=0.25)
    section(bm, Bd[7], Bd[8], DM, DM_R, beat=BEAT * 2, gain=0.75, cutoff=1100, snare=0.8, kick_=0.5, seed=8)
    section(bm, Bd[8], Bd[9], FMAJ, FMAJ_R, beat=BEAT * 2, gain=0.75, cutoff=1300, arp=0.8, arp_cut=4000, seed=9)
    gallop_drums(bm, Bd[8] + 6.0, Bd[8] + 10.0, BEAT, 0.7)
    section(bm, Bd[9], Bd[10], DM, DM_R, beat=BEAT * 2, gain=0.75, cutoff=1200, marim=0.8, kick_=0.4, hats=0.6, seed=10)
    # S11 fear: dark drone, slow low drums, no melody
    bm.add(throat_drone(note('D1') * 2, Bd[11] - Bd[10] + 1.0, overtones=(6, 7, 6, 5)), Bd[10], 0.09)
    section(bm, Bd[10], Bd[11], [['D2', 'G#2', 'A2'], ['D2', 'F2', 'A#2']], ['D1', 'D1'], beat=1.4, gain=0.6, cutoff=500, seed=11)
    tt = Bd[10] + 1.0
    while tt < Bd[11] - 0.5: bm.add(frame_drum(0.9, 58, 0.15), tt, 0.35); tt += 1.4
    # S12 west: march + tension; stops when the Mongols turn back
    turn = first(ev, 'reverse')['t']
    section(bm, Bd[11], turn, WAR, WAR_R, beat=BEAT * 2, gain=0.8, cutoff=1200, snare=1.0, kick_=0.7, seed=12)
    section(bm, turn + 0.3, Bd[12], [['D3', 'F3', 'A3'], ['G2', 'A#2', 'D3']], ['D2', 'G1'], beat=1.0, gain=0.55, cutoff=700, seed=13)
    # S13 peace: warm
    section(bm, Bd[12], Bd[13], FMAJ, FMAJ_R, beat=0.55, gain=0.7, cutoff=1300, arp=0.6, arp_cut=3200, seed=14)
    melody(bm, Bd[12] + 3.0, Bd[13] - 0.3, THEME, beat=0.5, gain=0.05, octave=0, pan=0.2)
    # S14 kublai: majestic, peak on the crown
    crown_t = first(ev, 'crown_jump')['t']
    section(bm, Bd[13], crown_t, DM, DM_R, beat=BEAT * 2, gain=0.7, cutoff=1200, seed=15)
    gallop_drums(bm, crown_t - 4.0, crown_t, BEAT, 0.7)
    section(bm, crown_t, Bd[14], MAJ, MAJ_R, beat=BEAT * 2, gain=0.85, cutoff=1700, arp=0.6, kick_=0.6, seed=16)
    melody(bm, crown_t + 0.3, Bd[14] - 0.3, THEME[:9], beat=0.45, gain=0.06, octave=0)
    # S15 limits: tension under the storm
    section(bm, Bd[14], Bd[15], WAR, WAR_R, beat=1.0, gain=0.6, cutoff=800, kick_=0.4, seed=17)
    # S16 split: falling
    section(bm, Bd[15], Bd[16], FALL, FALL_R, beat=0.9, gain=0.6, cutoff=800, seed=18)
    # S17 why: light recap groove
    section(bm, Bd[16], Bd[17], DM, DM_R, beat=BEAT * 2, gain=0.65, cutoff=1100, arp=0.5, seed=19)
    gallop_drums(bm, Bd[16] + 5.5, Bd[17] - 0.4, BEAT, 0.6)
    # S18 plague: night drone, high eerie fiddle
    bm.add(throat_drone(note('D2'), Bd[18] - Bd[17] + 0.8, overtones=(9, 8, 9, 7)), Bd[17], 0.08)
    section(bm, Bd[17], Bd[18], [['D3', 'F3', 'G#3'], ['C#3', 'E3', 'G3']], ['D2', 'C#2'], beat=1.2, gain=0.5, cutoff=600, seed=20)
    melody(bm, Bd[17] + 2.0, Bd[18] - 0.5, [('A5', 3), ('G#5', 2), ('F5', 3), ('D5', 5)], beat=0.6, gain=0.035, pan=0.3)
    # S19 ending: sunset, the theme returns and resolves
    section(bm, Bd[18], END - 0.6, FMAJ, FMAJ_R, beat=0.6, gain=0.65, cutoff=1100, seed=21)
    melody(bm, Bd[18] + 0.4, END - 1.0, THEME[:9], beat=0.42, gain=0.06)

    # ---------- sound design ----------
    for e in ev['events']:
        n, t, d, i = e['n'], e['t'], e.get('d', 1.0), e.get('i', 0)
        if n == 'wind': bs.add(wind(d), t, 0.12)
        elif n == 'neigh': bs.add(neigh(1.2), t, 0.12, pan=0.2)
        elif n == 'title_soft': bs.add(thud(1.0, 80, 36), t, 0.25); bs.add(bell(note('D5'), 1.6, 0.6), t, 0.05)
        elif n in ('title_hit', 'title_hit_soft'):
            k = 1.0 if n == 'title_hit' else 0.6
            bs.add(thud(1.6, 70, 30), t, 0.5 * k); bs.add(frame_drum(0.8, 70, 0.6), t, 0.35 * k); bs.add(hp(noise(1.4), 6000) * env_exp(1.4, 0.4), t, 0.05 * k)
            for f in ('D3', 'A3', 'D4'): bs.add(bowed(note(f), 1.6), t, 0.04 * k)
        elif n == 'whoosh_up': bs.add(whoosh(1.1, 300, 5000, 0.6), t, 0.3)
        elif n == 'whoosh_down': bs.add(whoosh(1.0, 4000, 300, 0.5), t, 0.28)
        elif n == 'whoosh': bs.add(whoosh(0.5, 400, 4000, 0.5), t, 0.2)
        elif n == 'pop': bs.add(pop(380, 1000, 0.09), t, 0.22, pan=0.2 * np.sin(i + 1))
        elif n == 'pop_soft': bs.add(pop(300, 700, 0.08), t, 0.14, pan=0.3 * np.sin(i * 1.7))
        elif n == 'flood': bs.add(riser(d, 150, 1800), t, 0.08); bs.add(wind(d, 100, 400), t, 0.08)
        elif n == 'rewind': x = saw(lambda tt: 900 - 700 * (tt / 0.9), 0.9); bs.add(bp(x, 300, 3000) * env_adsr(0.9, 0.05, 0.3) * 0.4, t, 0.12)
        elif n == 'crown_land': bs.add(clang(1240, 1.4), t, 0.12); bs.add(bell(note('A5'), 1.8, 0.6), t + 0.03, 0.08); bs.add(bell(note('D6'), 1.8, 0.6), t + 0.09, 0.06)
        elif n == 'crown_jump': bs.add(whoosh(0.7, 500, 4000, 0.5), t, 0.2); bs.add(glock(note('D6')), t, 0.06)
        elif n == 'crown_chime':
            for m, f in enumerate(['D5', 'F5', 'A5', 'D6']): bs.add(glock(note(f)), t + m * 0.12, 0.07)
        elif n == 'shimmer':
            for m, f in enumerate(['D5', 'F5', 'G5', 'A5', 'C6', 'D6']): bs.add(glock(note(f)), t + m * 0.06, 0.05, pan=-0.5 + m * 0.2)
        elif n == 'fizz': bs.add(hiss(0.9), t, 0.12, pan=0.4)
        elif n == 'tick_up':
            k = 0
            while k * 0.06 < d: bs.add(click(1800 + k * 60, 0.02), t + k * 0.06, 0.12); k += 1
        elif n == 'grass': bs.add(hp(noise(d), 2500) * env_adsr(d, 0.6, 0.8) * (0.6 + 0.4 * np.sin(2 * np.pi * t_axis(d) / 1.1)), t, 0.06)
        elif n == 'crowd':
            x = sum(bp(noise(d), 300 + 120 * k, 800 + 200 * k) * (0.5 + 0.5 * np.sin(2 * np.pi * (2 + k) * t_axis(d) + k)) for k in range(4)) / 4
            bs.add(x * env_adsr(d, 0.2, 0.4), t, 0.08)
        elif n == 'crowd_cheer':
            x = sum(bp(noise(1.8), 400 + 150 * k, 1200 + 300 * k) for k in range(4)) / 4; bs.add(x * env_adsr(1.8, 0.15, 1.0), t, 0.12)
        elif n == 'poof': bs.add(lp(noise(0.4), 1500) * env_exp(0.4, 0.08), t, 0.15)
        elif n == 'bleat': bs.add(bleat(330), t, 0.1, pan=-0.3); bs.add(bleat(380), t + 0.35, 0.07, pan=0.2)
        elif n in ('hooves', 'charge'): bs.add(hooves(d, 7.0, int(t * 10)), t, 0.16, pan=0.1); (bs.add(whoosh(d, 300, 2500, 0.7), t, 0.12) if n == 'charge' else None)
        elif n == 'hooves_away': bs.add(hooves(d, 7.0, 5, fade_out=True), t, 0.16, pan=0.5)
        elif n == 'clash': bs.add(clang(700 + 80 * g.random(), 0.9), t, 0.14); bs.add(thud(0.4, 120, 60), t, 0.25)
        elif n == 'cup': bs.add(bell(2200, 0.5, 0.15), t, 0.08); bs.add(bell(1500, 0.4, 0.1), t + 0.25, 0.06)
        elif n == 'ghost': bs.add(whoosh(1.2, 2000, 300, 0.3), t, 0.12)
        elif n == 'cold_wind': bs.add(wind(d, 600, 2200), t, 0.1)
        elif n == 'pluck_down':
            for m, f in enumerate(['A4', 'G4', 'F4', 'D4']): bs.add(pluck(note(f), 0.6, 2200, 0.2), t + m * 0.18, 0.06)
        elif n == 'pluck_up':
            f = ['D4', 'F4', 'A4', 'D5'][i]; bs.add(pluck(note(f), 0.8, 3000, 0.25), t, 0.09); bs.add(frame_drum(0.4, 90), t, 0.15)
        elif n == 'wood_slam': bs.add(thud(0.6, 110, 50), t, 0.5); bs.add(bp(noise(0.25), 300, 1500) * env_exp(0.25, 0.05), t, 0.3)
        elif n == 'crack': bs.add(snap(0.25, 600, 4000, 0.04), t, 0.4); bs.add(thud(0.3, 140, 70), t, 0.2)
        elif n == 'merge': bs.add(frame_drum(0.5, 90 + 8 * i, 0.3), t, 0.25); bs.add(pop(300, 800, 0.08), t, 0.12)
        elif n == 'banner': bs.add(bp(noise(1.0), 400, 2000) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t_axis(1.0))) * env_adsr(1.0, 0.1, 0.5), t, 0.1)
        elif n == 'swell': bs.add(riser(d, 150, 1500), t, 0.1)
        elif n == 'quiver': bs.add(thud(0.5, 140, 60), t, 0.35); [bs.add(click(2000 + 300 * k, 0.03), t + 0.05 + k * 0.04, 0.12) for k in range(5)]
        elif n == 'arrow_sting': bs.add(twang(150 + 20 * i), t, 0.25); bs.add(frame_drum(0.5, 80), t + 0.05, 0.25)
        elif n == 'gallop': bs.add(hooves(d, 7.2, 9), t, 0.08)
        elif n == 'riser': bs.add(riser(d, 200, 3000), t, 0.1)
        elif n == 'twang': bs.add(twang(190), t, 0.3, pan=0.2)
        elif n == 'scatter':
            for k in range(12): bs.add(pop(g.uniform(300, 600), g.uniform(800, 1400), 0.06), t + k * 0.04, 0.08, pan=g.uniform(-0.6, 0.6))
        elif n == 'stack': bs.add(frame_drum(0.4, 110 - 10 * i, 0.5), t, 0.3); bs.add(click(1500 + 400 * i, 0.03), t, 0.15)
        elif n == 'march':
            k = 0
            while k * 0.3 < d: bs.add(frame_drum(0.3, 75, 0.2), t + k * 0.3, 0.18 * (1 - 0.3 * (k % 2))); k += 1
        elif n == 'cross': bs.add(zap(0.18, 900, 300), t, 0.06)
        elif n == 'anvil': bs.add(clang(1750, 0.8), t, 0.12); bs.add(click(4000, 0.02), t, 0.2)
        elif n == 'relay': bs.add(bell(note('A5') + 30 * i, 0.6, 0.2), t, 0.06, pan=-0.4 + 0.1 * i)
        elif n == 'paper': bs.add(hp(noise(0.25), 3000) * env_exp(0.25, 0.06), t, 0.08, pan=0.3 * np.sin(i))
        elif n == 'boing': bs.add(boing(160, 0.6), t, 0.2); bs.add(thud(0.4, 120, 60), t, 0.3)
        elif n == 'steps':
            k = 0
            while k * 0.28 < d: bs.add(thud(0.15, 160, 100), t + k * 0.28, 0.1); k += 1
        elif n == 'hammer':
            for k in range(4): bs.add(click(1800, 0.03), t + k * 0.17, 0.25); bs.add(thud(0.15, 200, 120), t + k * 0.17, 0.12)
        elif n == 'throw': bs.add(whoosh(0.6, 200, 2500, 0.4), t, 0.3); bs.add(saw(lambda tt: 90 + 40 * tt, 0.4) * env_adsr(0.4, 0.02, 0.2) * 0.2, t, 0.1)
        elif n == 'thud': bs.add(thud(0.5, 110, 50), t, 0.35)
        elif n == 'fuse': bs.add(hiss(d), t, 0.1, pan=0.4)
        elif n == 'boom': bs.add(thud(1.6, 70, 26), t, 0.7); bs.add(rumble(1.8), t, 0.3); bs.add(lp(noise(1.2), 2500) * env_exp(1.2, 0.25), t, 0.35)
        elif n == 'dark_hit': bs.add(frame_drum(1.4, 52, 0.15), t, 0.5); bs.add(thud(1.2, 60, 28), t, 0.3)
        elif n == 'gate':
            x = saw(lambda tt: 110 + 25 * np.sin(2 * np.pi * 3 * tt) + 60 * tt, 1.2); bs.add(bp(x, 300, 1800) * env_adsr(1.2, 0.1, 0.4) * 0.3, t, 0.12, pan=-0.4)
        elif n == 'smoke': bs.add(rumble(d), t, 0.12, pan=0.4); bs.add(lp(noise(d), 700) * env_adsr(d, 0.3, 0.8), t, 0.1, pan=0.4)
        elif n == 'drone_low': bs.add(sine(note('D2'), d) * env_adsr(d, 0.5, 1.0) + 0.5 * sine(note('A2'), d) * env_adsr(d, 0.8, 1.0), t, 0.1)
        elif n == 'rush': bs.add(whoosh(d, 300, 3000, 0.6), t, 0.18)
        elif n == 'flag': bs.add(pop(400 + 30 * i, 900 + 40 * i, 0.07), t, 0.1, pan=-0.6 + 0.15 * i)
        elif n == 'drop': bs.add(thud(1.2, 60, 30), t, 0.4); bs.add(sine(note('D2'), 1.5) * env_exp(1.5, 0.5), t, 0.15)
        elif n == 'shield_crack': bs.add(clang(520, 1.0), t, 0.14); bs.add(shatter(0.6, int(t)), t, 0.1); bs.add(thud(0.6, 100, 45), t, 0.35)
        elif n == 'bells':
            for k in range(5): bs.add(bell(note(['A3', 'C4', 'E4', 'A3', 'D4'][k]), 2.0, 0.8), t + k * 0.32, 0.05, pan=-0.6 + 0.3 * k)
        elif n == 'reverse': x = whoosh(0.9, 3000, 300, 0.8)[::-1].copy(); bs.add(x, t - 0.4, 0.25)
        elif n == 'warm':
            for m, f in enumerate(['F3', 'A3', 'C4', 'F4']): bs.add(pad_note(note(f), 3.0, 1400), t + m * 0.05, 0.05)
        elif n == 'chime': bs.add(bell(note(['A5', 'C6', 'D6'][i]), 1.6, 0.5), t, 0.07, pan=-0.4 + 0.4 * i)
        elif n == 'paiza': bs.add(clang(1980, 1.6), t, 0.08); bs.add(glock(note('A6')), t + 0.05, 0.06)
        elif n == 'camel':
            k = 0
            while k * 0.55 < d: bs.add(bell(note('E4') * (1 + 0.02 * (k % 3)), 0.8, 0.25), t + k * 0.55, 0.06, pan=0.3); k += 1
        elif n == 'travel': bs.add(whoosh(d, 300, 1800, 0.5), t, 0.1)
        elif n == 'waves':
            tt2 = t_axis(d); bs.add(lp(noise(d), 900) * (0.5 + 0.5 * np.sin(2 * np.pi * tt2 / 2.2)) * env_adsr(d, 0.6, 0.8), t, 0.12)
        elif n == 'storm': bs.add(wind(d, 300, 2500), t, 0.25); bs.add(rumble(1.6), t + d * 0.4, 0.25); bs.add(thud(1.4, 50, 25), t + d * 0.45, 0.25)
        elif n == 'splinter': bs.add(shatter(0.8, 3), t, 0.08); bs.add(snap(0.3, 400, 3000, 0.06), t, 0.3)
        elif n == 'creak':
            x = saw(lambda tt: 80 + 20 * np.sin(2 * np.pi * 1.3 * tt), d); bs.add(bp(x, 200, 1200) * env_adsr(d, 0.2, 0.4) * 0.3, t, 0.08)
        elif n == 'crack_big': bs.add(snap(0.4, 300, 3500, 0.08), t, 0.5); bs.add(thud(1.2, 70, 30), t, 0.45); bs.add(shatter(0.9, 5), t, 0.06)
        elif n == 'drift': bs.add(whoosh(d, 200, 900, 0.5), t, 0.1)
        elif n == 'night': bs.add(wind(d, 150, 600), t, 0.05)
        elif n == 'swell_dark': bs.add(riser(d, 100, 900), t, 0.1); bs.add(sine(note('D2'), d) * env_adsr(d, 1.0, 0.6), t, 0.12)
        elif n == 'end_hit':
            bs.add(thud(2.4, 60, 28), t, 0.45)
            for f in ('F2', 'C3', 'F3', 'A3', 'C4'): bs.add(bowed(note(f), 3.0), t, 0.035)

    music = reverb(bm.st(), 0.3, 3.0, 0.9)
    sfx = reverb(bs.st(), 0.2, 2.0, 0.5)
    return music, sfx
