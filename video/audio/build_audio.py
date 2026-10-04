"""Synthesises the Certamen promo score + sound design and mixes it under the voice-over.

Everything is generated from code (no samples). Cue times come from data/timeline.json and
data/words.json, the same files that drive the visuals.

    python3 audio/build_audio.py   ->  out/mix.wav (48 kHz stereo, pre-master)
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
TL = json.loads((ROOT / 'data/timeline.json').read_text())
WORDS = {w['k']: w for w in json.loads((ROOT / 'data/words.json').read_text())}
S = lambda k: WORDS[k]['s']
DUR = TL['duration']
N = int(DUR * SR)
rng = np.random.default_rng(11)


# ------------------------------------------------------------------ primitives
def t_axis(d):
    return np.arange(int(d * SR)) / SR


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'Bb': 10, 'B': 11}


def hz(name):
    """'D3' -> frequency"""
    letter, octave = name[:-1], int(name[-1])
    return midi(12 * (octave + 1) + NOTE[letter])


def env_exp(d, k):
    return np.exp(-t_axis(d) * k)


def adsr(d, a=0.01, r=0.1):
    n = int(d * SR)
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def saw(f, d, phase=0.0):
    t = t_axis(d)
    # band-limited-ish saw via additive harmonics (cheap enough for our note counts)
    out = np.zeros_like(t)
    kmax = int(min(40, (SR / 2 - 200) // max(f, 1)))
    for k in range(1, kmax + 1):
        out += np.sin(2 * np.pi * f * k * t + phase * k) / k
    return out * 0.6


def sine(f, d, phase=0.0):
    return np.sin(2 * np.pi * f * t_axis(d) + phase)


def sweep_sine(f0, f1, d, curve='exp'):
    t = t_axis(d)
    if curve == 'exp':
        f = f0 * (f1 / f0) ** (t / d)
    else:
        f = f0 + (f1 - f0) * (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def noise(d):
    return rng.standard_normal(int(d * SR))


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def lp(x, fc, order=2):
    sos = signal.butter(order, fc, btype='low', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc, btype='high', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def sweep_filter(x, f_of_t, kind='low', block=256, q_bw=0.6):
    """time-varying filter, processed in blocks with carried state"""
    out = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        fc = float(np.clip(f_of_t((i + block / 2) / SR), 40, SR / 2 - 500))
        if kind == 'band':
            lo, hi = fc * (1 - q_bw / 2), fc * (1 + q_bw / 2)
            sos = signal.butter(2, [lo, hi], btype='band', fs=SR, output='sos')
        else:
            sos = signal.butter(2, fc, btype=kind, fs=SR, output='sos')
        if zi is None or zi.shape != (sos.shape[0], 2):
            zi = np.zeros((sos.shape[0], 2))
        out[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return out


def reverb_ir(d=2.4, k=2.6, seed=3):
    r = np.random.default_rng(seed)
    t = t_axis(d)
    ir = np.stack([r.standard_normal(len(t)), r.standard_normal(len(t))], 1) * np.exp(-t * k)[:, None]
    ir = lp(ir.T, 7000).T
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum(0))


IR = reverb_ir()


def add(buf, x, t0, gain=1.0, pan=0.0):
    """mix mono/stereo x into stereo buf at time t0"""
    i = int(round(t0 * SR))
    if i >= len(buf):
        return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], 1)
    if i < 0:
        x = x[-i:]
        i = 0
    n = min(len(x), len(buf) - i)
    buf[i:i + n] += x[:n] * gain


def ov(a, b, gain=1.0):
    """overlay b onto the start of a (a is extended if shorter)"""
    if len(b) > len(a):
        a = np.pad(a, (0, len(b) - len(a)))
    a = a.copy()
    a[: len(b)] += b * gain
    return a


def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


# ------------------------------------------------------------------ instruments
def pluck(f, d=0.9, bright=1.0):
    """marimba / soft piano-ish tone"""
    t = t_axis(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 5)
    x += 0.35 * bright * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t * 18)
    x += 0.2 * bright * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 9)
    x[: int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    return x


def bell(f, d=2.5):
    t = t_axis(d)
    parts = [(1, 1, 1.6), (2.0, 0.5, 2.5), (2.76, 0.35, 3.5), (5.4, 0.15, 6), (8.93, 0.08, 9)]
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * k) for m, a, k in parts)
    x[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return x * 0.5


def piano(f, d=3.0):
    t = t_axis(d)
    x = sum((0.6 ** (h - 1)) * np.sin(2 * np.pi * f * h * (1 + 0.0004 * h * h) * t) * np.exp(-t * (1.1 + 0.9 * h)) for h in range(1, 7))
    x[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return x * 0.45


def pad(freqs, d, fc=1200, a=1.2, r=1.5, detune=0.006):
    """stereo detuned saw pad"""
    L = sum(saw(f * (1 - detune), d, 0.3) + saw(f * (1 + detune * 0.7), d, 1.1) for f in freqs)
    R = sum(saw(f * (1 + detune), d, 0.7) + saw(f * (1 - detune * 0.6), d, 2.0) for f in freqs)
    e = adsr(d, a, r)
    st = np.stack([lp(L, fc), lp(R, fc)], 1) * e[:, None]
    return st / max(1, len(freqs)) * 0.5


def kick(d=0.45, f0=150, f1=45, k=9):
    x = sweep_sine(f0, f1, d) * env_exp(d, k)
    click = hp(noise(0.006), 2000) * 0.3
    x[: len(click)] += click
    return soft_clip(x, 1.5)


def snare(d=0.25):
    n = bp(noise(d), 1200, 7000) * env_exp(d, 18)
    b = sine(190, d) * env_exp(d, 25)
    return n * 0.7 + b * 0.5


def hat(d=0.05, k=60):
    return hp(noise(d), 7000) * env_exp(d, k) * 0.5


def clap(d=0.3):
    x = np.zeros(int(d * SR))
    for o in (0, 0.011, 0.022):
        j = int(o * SR)
        b = bp(noise(d), 900, 3500) * env_exp(d, 30 if o < 0.02 else 12)
        x[j:] += b[: len(x) - j]
    return x * 0.5


# ------------------------------------------------------------------ music
def build_music():
    m = np.zeros((N, 2))

    # A — intro (0 → 7.25): low pad + piano motif on each example
    m_a = pad([hz('D3'), hz('F3'), hz('A3'), hz('C4'), hz('E4')], 9.3, fc=850, a=1.6, r=1.6)
    add(m, m_a, 0.0, 0.5)
    for t0, n in [(0.02, 'D4'), (S('matters'), 'A4'), (S('a2'), 'F4'), (S('a3'), 'A4'), (S('code'), 'C5'), (S('work'), 'D5')]:
        add(m, piano(hz(n), 3.0), t0, 0.38, pan=-0.15)
        add(m, piano(hz(n) * 2, 2.0), t0 + 0.01, 0.07, pan=0.2)
    sub = sine(hz('D2'), 2.0) * np.linspace(0, 1, int(2.0 * SR)) ** 2
    add(m, sub, S('so') - 2.0, 0.22)

    # B/C — ask + chaos (7.25 → 16.1) @120 BPM, grid anchored on "So"
    chaos = np.zeros((N, 2))
    beat = 0.5
    t0 = S('so')
    end = 16.1
    k = 0
    while t0 + k * beat / 4 < end:
        t = t0 + k * beat / 4
        ramp = np.clip((t - 13.6) / 2.5, 0, 1)
        # bass 16ths
        if t >= S('so') + 0.25:
            f = hz('D2') if (k % 16) not in (14, 15) else hz('Eb2')
            note = saw(f, beat / 4 * 0.95) * env_exp(beat / 4 * 0.95, 9)
            fc = 300 + 2800 * (np.clip((t - 9.1) / 7, 0, 1) ** 1.5)
            add(chaos, lp(note, fc), t, 0.55 + 0.25 * ramp)
        if t >= S('gpt') - 0.01:
            if k % 4 == 0:
                add(chaos, kick(), t, 0.9)
            add(chaos, hat(0.04 if k % 2 else 0.07), t, (0.18 if k % 2 else 0.28) * (1 + ramp), pan=0.3 if k % 2 else -0.3)
            if k % 8 == 4 and t >= S('gemini') - 0.1:
                add(chaos, clap(), t, 0.55 + 0.3 * ramp)
            if ramp > 0.5 and k % 2 == 1:
                add(chaos, snare(0.12), t, 0.25 * ramp)
        k += 1
    # dissonant stabs on the slams
    for t, g in [(S('yes'), 1.0), (S('no'), 1.0), (S('depends'), 0.8)]:
        cl = sum(saw(hz(n), 0.6) for n in ['D3', 'Eb3', 'A3', 'Bb3', 'D4'])
        cl = soft_clip(lp(cl, 2500) * env_exp(0.6, 6), 2.5)
        add(chaos, cl, t, 0.32 * g)
    # tension drone
    drone = np.stack([saw(hz('D2') * 1.003, 16.1 - 9.0), saw(hz('D2') * 0.997, 16.1 - 9.0)], 1)
    drone = np.stack([sweep_filter(drone[:, c], lambda tt: 200 + 1800 * (tt / 7.1) ** 2) for c in range(2)], 1)
    drone *= np.linspace(0, 1, len(drone))[:, None] ** 1.5
    add(chaos, drone, 9.0, 0.22)
    # tape stop: re-read the chaos bus slower and slower until it stops
    a, b = int(16.1 * SR), int(S('enough') * SR)
    p = np.arange(b - a) / (b - a)
    src = (16.1 + (S('enough') - 16.1) * (p - p * p / 2)) * SR
    for c in range(2):
        chaos[a:b, c] = np.interp(src, np.arange(N), chaos[:, c]) * (1 - p) ** 0.6
    chaos[b:] = 0
    m += chaos * 0.7

    # E/F/G/H/I — order (from "Let's") @100 BPM anchored on "Let's"
    bpm_t0 = S('lets')
    q = 0.6
    order = np.zeros((N, 2))
    prog = [  # (bar start beat, chord tones for pluck arp, bass)
        ('D', ['D4', 'F#4', 'A4', 'D5', 'A4', 'F#4', 'E4', 'A4'], 'D2'),
        ('Bm', ['B3', 'D4', 'F#4', 'B4', 'F#4', 'D4', 'C#4', 'F#4'], 'B1'),
        ('G', ['G3', 'B3', 'D4', 'G4', 'D4', 'B3', 'A3', 'D4'], 'G1'),
        ('A', ['A3', 'C#4', 'E4', 'A4', 'E4', 'C#4', 'B3', 'E4'], 'A1'),
    ]
    beat_i = 0
    while True:
        t = bpm_t0 + beat_i * q / 2  # eighth notes
        if t >= 46.2:
            break
        bar = int(beat_i // 8)
        chord = prog[bar % 4] if t >= 26.6 else prog[0]
        e8 = beat_i % 8
        privacy = S('no3') - 0.6 <= t < S('open') - 0.05
        build = S('open') - 0.05 <= t < S('verdict')
        tail = t >= S('verdict')
        # pluck arp all through (quieter at the start)
        if not tail:
            g = 0.16 if t < S('this') else 0.22
            add(order, pluck(hz(chord[1][e8]), 0.7), t, g * (0.75 if privacy else 1), pan=-0.35 if e8 % 2 else 0.35)
        # percussion from "Honestly"
        if S('honestly') - 0.05 <= t and not tail:
            if t >= S('every') - 0.1 and not privacy:
                if e8 in (0, 3, 4) or (e8 == 6 and bar % 2):
                    add(order, kick(0.35, 120, 42, 10), t, 0.75)
                if e8 in (2, 6):
                    add(order, clap(0.25), t, 0.45)
                add(order, hat(), t, 0.2 if e8 % 2 else 0.12, pan=0.25)
            else:
                if e8 in (0, 4):
                    add(order, kick(0.3, 100, 45, 12), t, 0.45)
                if e8 in (2, 6):
                    rim = bp(noise(0.03), 1500, 4000) * env_exp(0.03, 90)
                    add(order, rim, t, 0.35, pan=-0.2)
        # bass from "This is Certamen"
        if t >= S('this') and not tail and e8 % 2 == 0:
            bn = hz(chord[2]) * (2 if e8 in (4,) else 1)
            note = lp(saw(bn, q * 0.95), 600) * env_exp(q * 0.95, 4)
            add(order, note, t, 0.5 * (0.7 if privacy else 1))
        beat_i += 1
    # big pad when the logo assembles, and through the protocol
    add(order, pad([hz('D3'), hz('A3'), hz('C#4'), hz('E4'), hz('F#4')], 26.7 - S('this') + 0.5, fc=1600, a=0.4, r=0.8), S('this'), 0.55)
    for i, (ch, notes) in enumerate([('D', ['D3', 'A3', 'F#4']), ('Bm', ['B2', 'F#3', 'D4']), ('G', ['G2', 'D3', 'B3']), ('A', ['A2', 'E3', 'C#4'])] * 4):
        ts = bpm_t0 + (int((26.6 - bpm_t0) / (q * 4)) + i) * q * 4  # whole bars on the 100 BPM grid
        if ts >= S('verdict') - 0.05:
            break
        if ts + q * 4 < 26.6:
            continue
        add(order, pad([hz(n) for n in notes], q * 4 + 0.6, fc=1300, a=0.2, r=0.6), ts, 0.32 * (0.6 if S('no3') - 0.6 <= ts < S('open') else 1))
    # bell on "Certamen"
    add(order, bell(hz('A5'), 3.0), S('certamen'), 0.22, pan=0.2)
    add(order, bell(hz('D6'), 3.0), S('certamen') + 0.3, 0.12, pan=-0.2)
    # build: snare roll accelerating into the verdict
    t = S('let')
    while t < S('verdict') - 0.03:
        prog_ = (t - S('let')) / (S('verdict') - S('let'))
        add(order, snare(0.12), t, 0.15 + 0.45 * prog_, pan=0.1)
        t += 0.15 * (1 - 0.7 * prog_)
    # final hit: big D major chord + sustained tail
    final = pad([hz('D2'), hz('D3'), hz('A3'), hz('D4'), hz('F#4'), hz('A4'), hz('E5')], DUR - S('verdict'), fc=2400, a=0.01, r=2.5)
    add(order, final, S('verdict'), 0.9)
    add(order, piano(hz('D4'), 4.0), S('verdict'), 0.5)
    add(order, piano(hz('A4'), 4.0), S('verdict'), 0.35)
    add(order, piano(hz('F#5'), 4.0), S('verdict') + 0.02, 0.25)
    add(order, bell(hz('D6'), 3.5), S('verdict') + 0.05, 0.18)
    # privacy section: darker filter on the order bus
    a, b = int((S('no3') - 0.6) * SR), int((S('open') - 0.05) * SR)
    for c in range(2):
        seg = order[a - SR // 4:b + SR // 4, c]
        order[a - SR // 4:b + SR // 4, c] = sweep_filter(seg, lambda tt: 1400 + 6000 * (np.clip(abs(tt - (len(seg) / SR) / 2) / ((len(seg) / SR) / 2), 0, 1)) ** 6)
    m += order
    # fade the very end
    fade = np.ones(N)
    fa = int(45.6 * SR)
    fade[fa:] = np.linspace(1, 0, N - fa) ** 1.5
    m *= fade[:, None]
    return m


# ------------------------------------------------------------------ sound effects
def fx(kind, cue):
    d = cue.get('dur', 0.5)
    if kind == 'drawline':
        x = sweep_filter(noise(0.45), lambda t: 1500 + 6000 * t / 0.45, 'band', q_bw=0.5) * adsr(0.45, 0.25, 0.15)
        return x * 0.25
    if kind == 'pulse':
        return ov(sine(55, 1.2) * env_exp(1.2, 3.5) * 0.9, bp(noise(0.6), 200, 900) * env_exp(0.6, 6), 0.1)
    if kind == 'roll':
        x = np.zeros(int(0.3 * SR))
        for i, o in enumerate((0, 0.045, 0.09)):
            c = bp(noise(0.02), 2500, 6000) * env_exp(0.02, 200)
            x[int(o * SR):int(o * SR) + len(c)] += c * (1 - i * 0.2)
        return x * 0.8
    if kind == 'enter':
        c = bp(noise(0.05), 1500, 6000) * env_exp(0.05, 120)
        th = sine(240, 0.12) * env_exp(0.12, 35)
        return np.concatenate([c * 0.9, np.zeros(int(0.07 * SR))])[: int(0.12 * SR)] + th * 0.6
    if kind in ('whoosh', 'whip', 'focus'):
        dd = {'whoosh': 0.55, 'whip': 0.6, 'focus': 0.3}[kind]
        top = {'whoosh': 4000, 'whip': 7000, 'focus': 3000}[kind]
        x = sweep_filter(noise(dd), lambda t: 250 + top * np.sin(np.pi * t / dd) ** 2, 'band', q_bw=0.9)
        return x * np.sin(np.pi * t_axis(dd) / dd) ** 1.5 * (1.4 if kind == 'whip' else 0.9)
    if kind == 'pop':
        x = sweep_sine(900, 260, 0.09) * env_exp(0.09, 30) * 0.7
        x[: int(0.01 * SR)] += bp(noise(0.01), 3000, 8000) * 0.5
        return x
    if kind == 'slam':
        sub = sweep_sine(90, 40, 0.8) * env_exp(0.8, 4)
        body = soft_clip(lp(noise(0.4), 1800) * env_exp(0.4, 12) * 2, 2)
        crack = hp(noise(0.08), 2500) * env_exp(0.08, 40)
        out = np.zeros(int(0.8 * SR))
        out += sub * 1.0
        out[: len(body)] += body * 0.5
        out[: len(crack)] += crack * 0.4
        return out
    if kind == 'glitch':
        dd = 0.12
        x = np.sign(np.sin(2 * np.pi * rng.uniform(300, 1400) * t_axis(dd))) * 0.4
        x += noise(dd) * 0.3
        step = int(rng.integers(6, 20))
        x = np.repeat(x[::step], step)[: int(dd * SR)]
        return x * adsr(dd, 0.002, 0.03) * 0.5
    if kind == 'riser':
        x = sweep_filter(noise(d), lambda t: 400 * (12) ** (t / d), 'band', q_bw=0.5)
        x += 0.25 * sweep_sine(200, 1600, d)
        return x * (t_axis(d) / d) ** 2 * 0.8
    if kind == 'boom':
        x = sweep_sine(48, 26, 2.6) * env_exp(2.6, 1.6)
        x = ov(x, lp(noise(1.2), 200) * env_exp(1.2, 4), 0.4)
        return soft_clip(x * 1.2, 1.3)
    if kind == 'slice':
        t = t_axis(1.4)
        x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, a, k in [(3150, 0.5, 5), (4720, 0.35, 7), (6110, 0.25, 9), (2230, 0.3, 4)])
        x[: int(0.12 * SR)] += hp(noise(0.12), 4000) * np.linspace(1, 0, int(0.12 * SR)) * 0.4
        return x * 0.4
    if kind == 'open':
        dd = 0.7
        x = sweep_filter(noise(dd), lambda t: 300 + 5000 * (t / dd) ** 2, 'band', q_bw=0.8)
        return x * (t_axis(dd) / dd) ** 1.5 * np.linspace(1, 0.2, int(dd * SR)) * 0.9
    if kind == 'thud':
        return sweep_sine(140, 70, 0.18) * env_exp(0.18, 22) + np.pad(bp(noise(0.01), 1500, 5000) * 0.3, (0, int(0.17 * SR)))[: int(0.18 * SR)]
    if kind == 'tick':
        return sine(2600, 0.05) * env_exp(0.05, 80) * 0.6 + sine(5200, 0.05) * env_exp(0.05, 120) * 0.2
    if kind == 'flip':
        x = np.zeros(int(0.08 * SR))
        for o in (0, 0.035):
            c = bp(noise(0.03), 1800, 5000) * env_exp(0.03, 110)
            x[int(o * SR):int(o * SR) + len(c)] += c
        return x * 0.8
    if kind == 'shuffle':
        dd = 0.45
        x = bp(noise(dd), 800, 4000) * (0.5 + 0.5 * np.sin(2 * np.pi * 26 * t_axis(dd))) * np.sin(np.pi * t_axis(dd) / dd)
        return x * 0.6
    if kind == 'type3':
        x = np.zeros(int(0.35 * SR))
        for o in (0, 0.07, 0.15, 0.22):
            c = key_click()
            x[int(o * SR):int(o * SR) + len(c)] += c
        return x
    if kind == 'lock':
        x = np.zeros(int(0.25 * SR))
        for o, g in ((0, 1), (0.06, 0.7)):
            c = bp(noise(0.02), 2000, 7000) * env_exp(0.02, 150) * g
            x[int(o * SR):int(o * SR) + len(c)] += c
        th = sweep_sine(160, 90, 0.2) * env_exp(0.2, 20) * 0.7
        x[int(0.05 * SR):int(0.05 * SR) + len(th)] += th[: len(x) - int(0.05 * SR)]
        return x
    if kind == 'chisel':
        t = t_axis(0.35)
        f0 = rng.uniform(0.9, 1.15)
        x = sum(a * np.sin(2 * np.pi * f * f0 * t) * np.exp(-t * k) for f, a, k in [(2210, 0.4, 28), (3530, 0.3, 35), (5170, 0.2, 45)])
        x += bp(noise(0.35), 2000, 8000) * np.exp(-t * 60) * 0.8
        x += np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
        return x * 0.7
    if kind == 'stream':
        x = np.zeros(int(d * SR))
        n = int(d * 26)
        for i in range(n):
            o = i / 26 + rng.uniform(0, 0.02)
            b = sine(rng.choice([1320, 1760, 1980, 2640]), 0.018) * env_exp(0.018, 120)
            j = int(o * SR)
            if j + len(b) < len(x):
                x[j:j + len(b)] += b * rng.uniform(0.3, 1)
        return x * 0.35
    if kind == 'ping':
        f = hz(['A5', 'D6', 'F#5', 'E6'][cue.get('note', 0) % 4])
        return bell(f, 1.2) * 0.8
    if kind == 'gavel':
        x = sweep_sine(220, 110, 0.35) * env_exp(0.35, 14)
        x[: int(0.015 * SR)] += bp(noise(0.015), 800, 5000) * 1.2
        x += sine(70, 0.35) * env_exp(0.35, 9) * 0.8
        return soft_clip(x, 1.6)
    if kind == 'chime':
        f = hz(['D5', 'F#5', 'A5'][cue.get('note', 0) % 3])
        return bell(f, 1.6) * 0.8
    if kind == 'slash':
        dd = 0.22
        x = sweep_filter(noise(dd), lambda t: 1500 + 9000 * (t / dd), 'band', q_bw=0.6) * np.sin(np.pi * t_axis(dd) / dd) ** 0.7
        return x * 1.2
    if kind == 'crumble':
        x = np.zeros(int(0.8 * SR))
        for i in range(40):
            o = rng.uniform(0, 0.6) ** 1.3
            g = bp(noise(0.02), rng.uniform(300, 900), rng.uniform(1500, 4000)) * env_exp(0.02, 120)
            j = int(o * SR)
            x[j:j + len(g)] += g * rng.uniform(0.2, 1) * (1 - o)
        return lp(x, 4000) * 0.9
    if kind == 'stamp':
        x = sweep_sine(120, 55, 0.4) * env_exp(0.4, 12) * 1.0
        x[: int(0.06 * SR)] += bp(noise(0.06), 400, 3000) * env_exp(0.06, 50) * 0.9
        return soft_clip(x, 1.5)
    if kind == 'clash':
        t = t_axis(0.6)
        x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, a, k in [(523, 0.4, 9), (1210, 0.3, 12), (1870, 0.2, 14), (2950, 0.15, 18)])
        x += sweep_sine(150, 60, 0.6) * np.exp(-t * 14) * 0.8
        x[: int(0.02 * SR)] += bp(noise(0.02), 1500, 7000) * 0.8
        return x
    if kind == 'hit':
        x = sweep_sine(70, 30, 3.0) * env_exp(3.0, 1.8) * 1.1
        crash = hp(noise(3.0), 5000) * env_exp(3.0, 1.9) * 0.35
        return soft_clip(x + crash, 1.2)
    if kind == 'tapestop':
        return sweep_sine(400, 40, 0.31) * np.linspace(1, 0, int(0.31 * SR)) * 0.15
    raise ValueError(kind)


def key_click():
    c = bp(noise(0.012), 2500, 9000) * env_exp(0.012, 300) * rng.uniform(0.5, 1)
    th = sine(rng.uniform(260, 360), 0.03) * env_exp(0.03, 90) * 0.4
    out = np.zeros(int(0.03 * SR))
    out[: len(c)] += c
    out += th
    return out * 0.5


REVERB_SEND = {'slam': 0.35, 'boom': 0.5, 'slice': 0.5, 'chisel': 0.3, 'gavel': 0.4, 'stamp': 0.25, 'clash': 0.4, 'hit': 0.6, 'ping': 0.5, 'chime': 0.5, 'thud': 0.2, 'lock': 0.15, 'pulse': 0.3}
FX_GAIN = 0.55


def build_sfx():
    dry = np.zeros((N, 2))
    wet = np.zeros((N, 2))
    for c in TL['sfx']:
        x = fx(c['type'], c)
        x = x / (np.max(np.abs(x)) + 1e-9)
        pan = float(rng.uniform(-0.25, 0.25)) if c['type'] in ('pop', 'glitch', 'ping', 'flip', 'thud', 'chisel') else 0.0
        add(dry, x, c['t'], FX_GAIN * c['gain'], pan)
        if c['type'] in REVERB_SEND:
            add(wet, x, c['t'], FX_GAIN * c['gain'] * REVERB_SEND[c['type']], pan)
    for t in TL['typeTimes']:
        add(dry, key_click(), t, 0.3, float(rng.uniform(-0.15, 0.15)))
    return dry, wet


def main():
    vo, sr = sf.read(ROOT / 'work/vo48.wav', dtype='float64')
    assert sr == SR
    vo = vo[:N] if len(vo) >= N else np.pad(vo, (0, N - len(vo)))

    music = build_music()
    dry, wet = build_sfx()
    # shared reverb bus
    rev_in = wet + music * 0.18
    rev = np.stack([signal.fftconvolve(rev_in[:, c], IR[:, c])[:N] for c in range(2)], 1)

    # duck music under the voice
    env = np.abs(vo)
    a_att, a_rel = np.exp(-1 / (0.01 * SR)), np.exp(-1 / (0.25 * SR))
    sm = signal.lfilter([1 - a_rel], [1, -a_rel], env)
    sm = np.maximum(sm, signal.lfilter([1 - a_att], [1, -a_att], env))
    sm /= np.percentile(sm, 99) + 1e-9
    duck = 1 - 0.5 * np.clip(sm, 0, 1)

    def rms_db(x, mask=None):
        x = x if mask is None else x[mask]
        return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)

    def gain_to(x, cur_db, target_db):
        return x * 10 ** ((target_db - cur_db) / 20)

    # voice: high-pass rumble, normalise active speech to -19 dBFS RMS
    vo = hp(vo, 80)
    speech = sm > 0.08
    vo = gain_to(vo, rms_db(vo, speech), -19.0)
    # music bed: -29 dBFS RMS where it plays, ducked ~7 dB under the voice
    playing = np.abs(music).max(1) > 1e-4
    music = gain_to(music, rms_db(music, playing), -29.0)
    music_bus = music * duck[:, None]
    # sfx: loudest transient at -7 dBFS, lightly ducked under speech
    sfx = dry + rev * 0.5
    sfx = sfx / (np.max(np.abs(sfx)) + 1e-9) * 10 ** (-7 / 20)
    sfx_bus = sfx * (1 - 0.3 * np.clip(sm, 0, 1))[:, None]

    vo_st = np.stack([vo, vo], 1)
    for a_, b_ in [(0, 7.2), (9.1, 16.1), (16.4, 17.6), (17.6, 22.6), (26.7, 34.3), (39.4, 42.8), (42.8, 46)]:
        sl = slice(int(a_ * SR), int(b_ * SR))
        print(f'{a_:5.1f}-{b_:5.1f}  vo {rms_db(vo_st[sl]):6.1f}  music {rms_db(music_bus[sl]):6.1f}  sfx {rms_db(sfx_bus[sl]):6.1f}')
    mix = vo_st + music_bus + sfx_bus
    peak = np.max(np.abs(mix))
    mix = soft_clip(mix * 1.0, 1.2) * 0.95
    out = ROOT / 'out/mix.wav'
    out.parent.mkdir(exist_ok=True)
    sf.write(out, mix.astype(np.float32), SR, subtype='FLOAT')
    sf.write(ROOT / 'out/music_only.wav', (music_bus / (np.max(np.abs(music_bus)) + 1e-9) * 0.8).astype(np.float32), SR, subtype='FLOAT')
    print(f'mix written: {DUR}s, pre-norm peak {peak:.2f}')


if __name__ == '__main__':
    main()
