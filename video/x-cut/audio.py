"""Score + sound design for the X cut, mixed under the voice-over.

Reuses the synth primitives and most SFX from ../audio/build_audio.py and adds the cut-specific ones.
    python3 x-cut/audio.py   ->  x-cut/out/mix.wav
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'audio'))
import build_audio as B  # noqa: E402
from build_audio import (SR, add, bell, bp, clap, env_exp, hat, hp, hz, kick, lp, noise, ov, pad, pluck, saw,  # noqa: E402
                         sine, snare, soft_clip, sweep_filter, sweep_sine, t_axis)

TL = json.loads((HERE / 'data/timeline.json').read_text())
WORDS = {w['k']: w for w in json.loads((HERE / 'data/words.json').read_text())}
S = lambda k: WORDS[k]['s']
DUR = TL['duration']
N = int(DUR * SR)
rng = np.random.default_rng(23)
REP0 = TL['reprise'][0]


def chaos_bar(buf, t0, t1, beat, intensity, bass_fc, with_drums=True, stride=1.0):
    """128 BPM chaos loop between t0 and t1 (16th grid anchored on t0)"""
    k = 0
    while t0 + k * beat / 4 < t1:
        t = t0 + k * beat / 4
        I = intensity(t)
        f = hz('D2') if (k % 16) not in (14, 15) else hz('Eb2')
        note = saw(f, beat / 4 * 0.95) * env_exp(beat / 4 * 0.95, 9)
        add(buf, lp(note, bass_fc(t)), t, 0.55 + 0.25 * I)
        if with_drums(t) if callable(with_drums) else with_drums:
            if k % 4 == 0:
                add(buf, kick(), t, 0.95)
            add(buf, hat(0.04 if k % 2 else 0.07), t, (0.16 if k % 2 else 0.26) * (1 + I), pan=0.3 if k % 2 else -0.3)
            if k % 8 == 4:
                add(buf, clap(), t, 0.5 + 0.3 * I)
            if I > 0.5 and k % 2 == 1:
                add(buf, snare(0.12), t, 0.25 * I)
        k += 1


def tom(f0=110, d=0.6):
    x = sweep_sine(f0, f0 * 0.55, d) * env_exp(d, 6)
    x = ov(x, lp(noise(0.08), 900) * env_exp(0.08, 40), 0.5)
    return soft_clip(x * 1.3, 1.4)


def build_music():
    m = np.zeros((N, 2))
    beat = 60 / 128
    # ---- hook + chaos (0 → tape stop)
    chaos = np.zeros((N, 2))
    tape0, freeze = S('enough') - 0.32, S('enough')
    quiet = (0.55, S('gpt') - 0.12)  # rewind + question: bass only, filtered
    ramp = lambda t: float(np.clip((t - TL['swarm'][0]['t']) / (tape0 - TL['swarm'][0]['t']), 0, 1))
    chaos_bar(chaos, 0.0, tape0, beat, ramp,
              lambda t: 380 if quiet[0] <= t < quiet[1] else 500 + 2600 * min(1, max(0, (t - 3) / 10)) ** 1.4,
              with_drums=lambda t: not (quiet[0] <= t < quiet[1]))
    for t, g in [(0.0, 0.8), (0.18, 0.5)] + [(mm['slam'], 1.0) for mm in TL['main']]:
        cl = sum(saw(hz(n), 0.6) for n in ['D3', 'Eb3', 'A3', 'Bb3', 'D4'])
        add(chaos, soft_clip(lp(cl, 2500) * env_exp(0.6, 6), 2.5), t, 0.3 * g)
    d = tape0 - 3.0
    drone = np.stack([saw(hz('D2') * 1.003, d), saw(hz('D2') * 0.997, d)], 1)
    drone = np.stack([sweep_filter(drone[:, c], lambda tt: 200 + 1800 * (tt / d) ** 2) for c in range(2)], 1) * np.linspace(0, 1, int(d * SR))[:, None] ** 1.5
    add(chaos, drone, 3.0, 0.22)
    # tape stop
    a, b = int(tape0 * SR), int(freeze * SR)
    p = np.arange(b - a) / (b - a)
    src = (tape0 + (freeze - tape0) * (p - p * p / 2)) * SR
    for c in range(2):
        chaos[a:b, c] = np.interp(src, np.arange(N), chaos[:, c]) * (1 - p) ** 0.6
    chaos[b:] = 0
    m += chaos * 0.75

    # ---- arena (war drums) @100 BPM from "So"
    q = 0.6
    t0 = S('so')
    arena = np.zeros((N, 2))
    add(arena, pad([hz('D2'), hz('A2'), hz('D3'), hz('F3')], S('twenty') - t0 + 0.4, fc=700, a=0.6, r=0.6), t0, 0.5)
    i = 0
    while t0 + i * q / 2 < S('twenty') - 0.05:
        t = t0 + i * q / 2
        e8 = i % 8
        if e8 in (0, 3, 4, 6):
            add(arena, tom(95 if e8 in (0, 4) else 140, 0.55), t, 0.8 if e8 in (0, 4) else 0.5, pan=-0.2 if e8 == 3 else 0.2)
        if e8 in (2, 6):
            add(arena, bp(noise(0.03), 1500, 4000) * env_exp(0.03, 90), t, 0.3)
        if t >= S('only') - 0.1:
            chord = ['D4', 'F4', 'A4', 'D5', 'A4', 'F4', 'E4', 'A4']
            add(arena, pluck(hz(chord[e8]), 0.6), t, 0.15, pan=-0.35 if e8 % 2 else 0.35)
        i += 1
    m += arena

    # ---- verdict + Certamen (triumphant, D major) from "$29"
    v0 = S('twenty')
    verdict = np.zeros((N, 2))
    add(verdict, pad([hz('D3'), hz('A3'), hz('D4'), hz('F#4'), hz('A4'), hz('E5')], S('what2') - v0, fc=2200, a=0.02, r=0.4), v0, 0.6)
    for n_, dt in [('D5', 0), ('F#5', 0.05), ('A5', 0.1), ('D6', 0.18)]:
        add(verdict, bell(hz(n_), 2.5), v0 + dt, 0.18)
    prog = [['D4', 'F#4', 'A4', 'D5', 'A4', 'F#4', 'E4', 'A4'], ['B3', 'D4', 'F#4', 'B4', 'F#4', 'D4', 'C#4', 'F#4'],
            ['G3', 'B3', 'D4', 'G4', 'D4', 'B3', 'A3', 'D4'], ['A3', 'C#4', 'E4', 'A4', 'E4', 'C#4', 'B3', 'E4']]
    bass = ['D2', 'B1', 'G1', 'A1']
    i = 0
    while v0 + i * q / 2 < S('what2') - 0.05:
        t = v0 + i * q / 2
        e8, bar = i % 8, (i // 8) % 4
        add(verdict, pluck(hz(prog[bar][e8]), 0.7), t, 0.2, pan=-0.35 if e8 % 2 else 0.35)
        if e8 in (0, 3, 4):
            add(verdict, kick(0.35, 120, 42, 10), t, 0.7)
        if e8 in (2, 6):
            add(verdict, clap(0.25), t, 0.4)
        add(verdict, hat(), t, 0.18 if e8 % 2 else 0.1, pan=0.25)
        if e8 % 2 == 0:
            add(verdict, lp(saw(hz(bass[bar]), q * 0.95), 600) * env_exp(q * 0.95, 4), t, 0.5)
        i += 1
    add(verdict, pad([hz('D2'), hz('D3'), hz('A3'), hz('F#4')], 2.5, fc=1800, a=0.01, r=1.5), S('this') + 0.12, 0.6)
    m += verdict

    # ---- "What would you charge?": tension, near silence
    add(m, sine(hz('D1') * 2, S('let') - S('what2')) * np.sin(np.pi * np.linspace(0, 1, int((S('let') - S('what2')) * SR))) ** 0.5, S('what2'), 0.25)

    # ---- reprise: chaos loop again, grid set so the next downbeat lands on the loop point (t = DUR ≡ 0)
    rep = np.zeros((N, 2))
    r0 = DUR - 3 * beat
    chaos_bar(rep, r0, DUR, beat, lambda t: 0.3, lambda t: 1600)
    for t in TL['reprise']:
        cl = sum(saw(hz(n), 0.5) for n in ['D3', 'Eb3', 'A3', 'Bb3'])
        add(rep, soft_clip(lp(cl, 2500) * env_exp(0.5, 7), 2.5), t, 0.25)
    m += rep * 0.75
    return m


def fx_x(kind, cue):
    if kind == 'impact':
        x = sweep_sine(110, 38, 1.0) * env_exp(1.0, 4)
        x = ov(x, soft_clip(lp(noise(0.3), 2500) * env_exp(0.3, 14) * 2, 2), 0.6)
        return x
    if kind == 'kaching':
        t = t_axis(0.9)
        x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, a, k in [(2637, 0.5, 6), (3520, 0.4, 7), (5274, 0.25, 9)])
        rattle = np.zeros_like(t)
        for o in np.linspace(0, 0.12, 7):
            j = int(o * SR)
            c = bp(noise(0.015), 3000, 9000) * env_exp(0.015, 200)
            rattle[j:j + len(c)] += c
        return x * 0.6 + rattle * 0.5
    if kind == 'rewind':
        d = 0.42
        x = sweep_filter(noise(d), lambda tt: 600 + 5000 * (tt / d), 'band', q_bw=0.4)
        warble = sweep_sine(300, 2400, d) * 0.3 * np.sin(2 * np.pi * 18 * t_axis(d))
        return (x + warble) * np.linspace(0.3, 1, int(d * SR))
    if kind == 'sigh':
        d = 0.5
        return lp(noise(d), 1200) * np.sin(np.pi * t_axis(d) / d) ** 2 * 0.5
    if kind == 'crowd':
        d = cue.get('dur', 3.0)
        x = np.stack([bp(noise(d), 300, 2500), bp(noise(d), 300, 2500)], 1)
        mod = 0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t_axis(d) + rng.uniform(0, 3))
        envl = np.minimum(1, t_axis(d) / 0.4) * np.minimum(1, (d - t_axis(d)) / 0.8)
        return x * (mod * envl)[:, None] * 0.5
    if kind == 'rip':
        d = 0.3
        x = hp(noise(d), 1500) * (0.5 + 0.5 * (rng.random(int(d * SR)) > 0.6)) * env_exp(d, 9)
        return x * 0.8
    if kind == 'stonethud':
        x = sweep_sine(80, 35, 1.2) * env_exp(1.2, 4) * 1.2
        x = ov(x, lp(noise(0.25), 900) * env_exp(0.25, 12), 0.7)
        return soft_clip(x, 1.4)
    if kind == 'scratch':
        d = 0.32
        f = 900 * (1 + 0.8 * np.sin(2 * np.pi * 7 * t_axis(d)))
        x = bp(noise(d), 500, 4000) * np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, 4)
        return x
    if kind == 'click':
        x = bp(noise(0.02), 2000, 8000) * env_exp(0.02, 160)
        return ov(x, sine(1800, 0.05) * env_exp(0.05, 70), 0.5)
    return B.fx(kind, cue)


REVERB = {'slam': 0.3, 'impact': 0.4, 'boom': 0.5, 'slice': 0.5, 'chisel': 0.3, 'gavel': 0.4, 'stamp': 0.25, 'clash': 0.4, 'stonethud': 0.5, 'chime': 0.5, 'kaching': 0.3}


def main():
    vo, sr = sf.read(HERE / 'work/vo48_cta.wav', dtype='float64')  # VO with the CTA gap (see timeline.mjs)
    assert sr == SR
    vo = vo[:N] if len(vo) >= N else np.pad(vo, (0, N - len(vo)))
    music = build_music()
    dry, wet = np.zeros((N, 2)), np.zeros((N, 2))
    for c in TL['sfx']:
        x = fx_x(c['type'], c)
        x = x / (np.max(np.abs(x)) + 1e-9)
        add(dry, x, c['t'], 0.55 * c['gain'])
        if c['type'] in REVERB:
            add(wet, x, c['t'], 0.55 * c['gain'] * REVERB[c['type']])
    rev_in = wet + music * 0.15
    rev = np.stack([signal.fftconvolve(rev_in[:, c], B.IR[:, c])[:N] for c in range(2)], 1)

    def rms_db(x, mask=None):
        x = x if mask is None else x[mask]
        return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)

    env = np.abs(vo)
    a_att, a_rel = np.exp(-1 / (0.01 * SR)), np.exp(-1 / (0.25 * SR))
    sm = np.maximum(signal.lfilter([1 - a_rel], [1, -a_rel], env), signal.lfilter([1 - a_att], [1, -a_att], env))
    sm /= np.percentile(sm, 99) + 1e-9
    vo = hp(vo, 80)
    vo = vo * 10 ** ((-19 - rms_db(vo, sm > 0.08)) / 20)
    playing = np.abs(music).max(1) > 1e-4
    music = music * 10 ** ((-28 - rms_db(music, playing)) / 20)
    music_bus = music * (1 - 0.5 * np.clip(sm, 0, 1))[:, None]
    sfx = dry + rev * 0.5
    sfx = sfx / (np.max(np.abs(sfx)) + 1e-9) * 10 ** (-7 / 20)
    sfx_bus = sfx * (1 - 0.3 * np.clip(sm, 0, 1))[:, None]
    vo_st = np.stack([vo, vo], 1)
    for a_, b_ in [(0, 3.2), (3.2, 10.5), (10.5, 14.0), (15.1, 22.4), (22.4, 28.9), (28.9, 30.1), (30.1, DUR)]:
        sl = slice(int(a_ * SR), int(b_ * SR))
        print(f'{a_:5.1f}-{b_:5.1f}  vo {rms_db(vo_st[sl]):6.1f}  music {rms_db(music_bus[sl]):6.1f}  sfx {rms_db(sfx_bus[sl]):6.1f}')
    mix = soft_clip(vo_st + music_bus + sfx_bus, 1.2) * 0.95
    (HERE / 'out').mkdir(exist_ok=True)
    sf.write(HERE / 'out/mix.wav', mix.astype(np.float32), SR, subtype='FLOAT')
    print('mix written', DUR, 's')


if __name__ == '__main__':
    main()
