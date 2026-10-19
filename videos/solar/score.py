"""Score for the kids solar-system video (moved from the original synth.py)."""
from instruments import *

def score(ev, END):
    bus_m, bus_s = Bus(END), Bus(END)
    Bd = ev['Bd']; beat = 0.5
    prog = [('C', ['C4', 'E4', 'G4'], 'C2'), ('G', ['B3', 'D4', 'G4'], 'G1'), ('Am', ['C4', 'E4', 'A4'], 'A1'), ('F', ['C4', 'F4', 'A4'], 'F1')]
    scale = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6']
    start = 1.25  # groove starts on liftoff
    shutter_t = [e['t'] for e in ev['events'] if e['n'] == 'shutter'][0]
    endg = shutter_t
    # intro: soft glock
    for j, n in enumerate(['C5', 'E5', 'G5', 'C6']): bus_m.add(glock(note(n), 1.2), 0.15 + j * 0.25, 0.08)
    g = np.random.default_rng(12)
    tt = start; i = 0; mel_prev = 2
    while tt < endg - 0.01:
        bar = int((tt - start) // (beat * 4)); ch = prog[bar % 4]; b_in_bar = round(((tt - start) % (beat * 4)) / (beat / 2))
        # bass on beats 1 and 3 + pickup
        if b_in_bar in (0, 4): bus_m.add(fade(lp(tri(note(ch[2]) * 2, 0.45), 900) * env_exp(0.45, 0.25)), tt, 0.35)
        if b_in_bar == 7: bus_m.add(fade(lp(tri(note(ch[2]) * 3, 0.25), 900) * env_exp(0.25, 0.12)), tt, 0.2)
        # chords (soft marimba stabs on off-beats)
        if b_in_bar in (1, 3, 5, 7): [bus_m.add(marimba(note(n), 0.4), tt, 0.05, pan=-0.3) for n in ch[1]]
        # drums
        if b_in_bar in (0, 4): bus_m.add(kick(0.3, 140, 50, 1.2), tt, 0.38)
        if b_in_bar in (2, 6): bus_m.add(snap(0.15, 1200, 6000, 0.04), tt, 0.16, pan=0.1)
        bus_m.add(hat(0.05), tt + beat / 4 * 0, 0.06 if b_in_bar % 2 else 0.035, pan=0.35)
        # melody: playful random walk on the pentatonic scale, rests sometimes
        if g.random() < 0.72:
            mel_prev = int(np.clip(mel_prev + g.choice([-2, -1, 1, 1, 2]), 0, len(scale) - 1))
            bus_m.add(marimba(note(scale[mel_prev]), 0.5), tt, 0.13, pan=0.25)
        tt += beat / 2; i += 1
    # final chord on the photo
    for j, n in enumerate(['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6']):
        bus_m.add(marimba(note(n), 1.2), shutter_t + 0.05 + j * 0.03, 0.12); bus_m.add(glock(note(n) * 2, 2.5), shutter_t + 0.08 + j * 0.05, 0.05)
    bus_m.add(pad_note(note('C3'), 3.5, 1500) + pad_note(note('G3'), 3.5, 1500) + pad_note(note('E4'), 3.5, 1500), shutter_t, 0.12)
    for e in ev['events']:
        n, t = e['n'], e['t']
        if n == 'rumble': bus_s.add(rumble(e['d']), t, 0.5)
        elif n == 'launch': bus_s.add(thud(1.2, 70, 35), t, 0.7); bus_s.add(whoosh(1.4, 200, 2500, 0.4), t, 0.6)
        elif n == 'whoosh': bus_s.add(whoosh(0.6, 400, 4000, 0.5), t, 0.4, pan=R.uniform(-0.5, 0.5))
        elif n == 'swoosh_in': bus_s.add(whoosh(1.0, 300, 2500, 0.3), t, 0.4, pan=-0.6)
        elif n == 'sparkle':
            for j, f in enumerate(['G5', 'C6', 'E6', 'G6', 'C7']): bus_s.add(glock(note(f), 0.8), t + j * 0.06, 0.08, pan=0.4)
        elif n == 'shades': bus_s.add(bell(3200, 0.6, 0.15), t, 0.2); bus_s.add(glock(note('E6'), 0.8), t + 0.08, 0.12); bus_s.add(pop(500, 1200, 0.08), t - 0.1, 0.25)
        elif n == 'zoom_out': bus_s.add(fade(sine(lambda q: 1400 * (0.3 ** (q / 0.7)), 0.7) * env_adsr(0.7, 0.05, 0.2)), t, 0.12)
        elif n == 'zoom_in': bus_s.add(fade(sine(lambda q: 400 * (3 ** (q / 0.45)), 0.45) * env_adsr(0.45, 0.05, 0.15)), t, 0.1)
        elif n == 'pop_note': bus_s.add(pop(300, 700, 0.08), t, 0.3); bus_s.add(marimba(note(scale[e['i'] % len(scale)]), 0.4), t, 0.12)
        elif n == 'name_chime':
            i = e['i']; sc = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6']
            bus_s.add(glock(note(sc[i]), 1.0), t, 0.1, pan=0.4); bus_s.add(pop(400, 900, 0.07), t, 0.2, pan=0.4)
        elif n == 'big_boing': bus_s.add(boing(110, 1.0, 0.4, 7), t, 0.6); bus_s.add(thud(0.6, 90, 45), t, 0.4)
        elif n == 'heart': bus_s.add(glock(note('E6'), 0.6), t, 0.1); bus_s.add(glock(note('G6'), 0.6), t + 0.09, 0.1)
        elif n == 'pour':
            d = e['d']; m = 70
            for k in range(m):
                at = t + d * (k / m) ** 0.9 + R.uniform(-0.02, 0.02)
                bus_s.add(pop(R.uniform(500, 900), R.uniform(1000, 1800), 0.05), at, 0.12 * (0.5 + 0.5 * k / m), pan=R.uniform(-0.4, 0.4))
        elif n == 'ding': bus_s.add(bell(note('C6'), 1.5, 0.5), t, 0.2); bus_s.add(bell(note('G6'), 1.5, 0.5), t + 0.08, 0.15)
        elif n == 'burp': bus_s.add(boing(160, 0.5, 0.2, 9), t + 0.05, 0.3)
        elif n == 'hula':
            d = 1.4; tt2 = t_axis(d); x = bp(noise(d), 600, 3000) * (0.5 + 0.5 * np.sin(2 * np.pi * 5 * tt2)) * env_adsr(d, 0.1, 0.4)
            bus_s.add(x, t, 0.16, pan=0.3)
        elif n == 'swipe': bus_s.add(whoosh(0.5, 500, 5000, 0.5), t, 0.35)
        elif n == 'plop': bus_s.add(pop(250 + 40 * e['i'], 700 + 60 * e['i'], 0.09), t, 0.25, pan=-0.6 + e['i'] * 0.17)
        elif n == 'shutter': bus_s.add(shutter_sfx(), t, 0.6)
    music = reverb(bus_m.st(), 0.22, 1.8, 0.5)
    sfx = reverb(bus_s.st(), 0.15, 1.4, 0.35)
    return music, sfx

