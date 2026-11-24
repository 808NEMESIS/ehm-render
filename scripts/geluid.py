"""Maakt de geluidsband van een scène (escalatie) uit dezelfde scènedata als het beeld.

Alles is eigen synthese, dus geen licenties: een muziekbed (marimba, pizzicato-bas, drums) op een vast ritme van 120 BPM,
een brabbelstem per lettergreep (dezelfde lettergreepregels als remotion/src/anim/anim.ts, zodat mond en geluid
samenvallen), effecten met variatie in toonhoogte, stilte op de piek, en bij het terugspoelen de echte geluidsband
achterstevoren en versneld. Daarna genormaliseerd naar -14 LUFS, pieken onder -1 dBTP.

Gebruik: python3 scripts/geluid.py remotion/src/scenes/heb-je-even.json remotion/public/audio/heb-je-even.wav [seed]
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48_000
FPS = 30
BEAT = 15  # frames per tel bij 120 BPM
BAR = 4 * BEAT

# lettergreepregels: gelijk aan anim.ts
SYL, WORD_GAP, PAUSE = 4, 2, 7


def syllables(word: str) -> int:
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    groups = re.findall(r"[aeiouy]+", re.sub(r"e$", "", w))
    return max(1, len(groups) if groups else 1)


def speech(text: str, at: int) -> list[dict]:
    out, t = [], at
    for raw in [x for x in text.split() if x]:
        n = max(1, syllables(raw))
        out.append({"text": raw, "s": t, "syl": [(t + i * SYL, t + (i + 1) * SYL - 1) for i in range(n)]})
        t += n * SYL + WORD_GAP + (PAUSE if re.search(r"[.,?!…]$", raw) else 0)
    return out


# ------------------------------------------------------------------ basis
def sec(frames: float) -> float:
    return frames / FPS


def idx(frames: float) -> int:
    return int(round(sec(frames) * SR))


def tone_t(dur: float) -> np.ndarray:
    return np.arange(int(dur * SR)) / SR


def env_exp(n: int, decay: float, attack: float = 0.002) -> np.ndarray:
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1)
    return a * np.exp(-t / decay)


def place(buf: np.ndarray, snd: np.ndarray, at_frames: float, gain: float = 1.0) -> None:
    i = idx(at_frames)
    if i < 0:  # begint vóór frame 0 (bv. een schrik vlak na de start): het begin valt weg
        snd, i = snd[-i:], 0
    if i >= len(buf) or not len(snd):
        return
    j = min(len(buf), i + len(snd))
    buf[i:j] += gain * snd[: j - i]


def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def bp(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x: np.ndarray, f: float, order: int = 2) -> np.ndarray:
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x: np.ndarray, f: float, order: int = 2) -> np.ndarray:
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x)


def reverb(x: np.ndarray, mix: float = 0.25, room: float = 0.82) -> np.ndarray:
    """Schroeder-galm: vier kamfilters en twee allpasfilters."""
    out = np.zeros_like(x)
    for d in (1557, 1617, 1491, 1422):
        b = np.zeros(d + 1)
        b[0] = 1
        a = np.zeros(d + 1)
        a[0], a[d] = 1, -room
        out += signal.lfilter(b, a, x)
    out /= 4
    for d, g in ((225, 0.7), (556, 0.7)):
        b = np.zeros(d + 1)
        b[0], b[d] = -g, 1
        a = np.zeros(d + 1)
        a[0], a[d] = 1, -g
        out = signal.lfilter(b, a, out)
    return x * (1 - mix) + lp(out, 6000) * mix


# ------------------------------------------------------------------ instrumenten
def marimba(note: float, vel: float = 1.0, dur: float = 0.9) -> np.ndarray:
    f = midi(note)
    t = tone_t(dur)
    n = len(t)
    x = np.sin(2 * np.pi * f * t) * env_exp(n, 0.32)
    x += 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * env_exp(n, 0.06)
    x += 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * env_exp(n, 0.02)
    click = bp(np.random.randn(n), 2000, 6000) * env_exp(n, 0.003) * 0.05
    return vel * (x + click) * 0.5


def pizz(note: float, vel: float = 1.0) -> np.ndarray:
    f = midi(note)
    t = tone_t(0.5)
    n = len(t)
    x = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(4 * np.pi * f * t) + 0.2 * np.sin(6 * np.pi * f * t)
    return vel * lp(x * env_exp(n, 0.16, 0.004), 900) * 0.55


def kick(vel: float = 1.0) -> np.ndarray:
    t = tone_t(0.35)
    f = 45 + 95 * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return vel * np.sin(ph) * env_exp(len(t), 0.12) * 0.9


def snare(vel: float = 1.0, rng=np.random) -> np.ndarray:
    t = tone_t(0.2)
    n = len(t)
    noise = bp(rng.randn(n), 1200, 6000) * env_exp(n, 0.06)
    body = np.sin(2 * np.pi * 190 * t) * env_exp(n, 0.04)
    return vel * (noise * 0.7 + body * 0.4) * 0.6


def hat(vel: float = 1.0, rng=np.random) -> np.ndarray:
    n = int(0.05 * SR)
    return vel * bp(rng.randn(n), 6000, 11000, 4) * env_exp(n, 0.01) * 0.22


def shaker(vel: float = 1.0, rng=np.random) -> np.ndarray:
    n = int(0.08 * SR)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    return vel * bp(rng.randn(n), 4000, 11000) * e * 0.18


# ------------------------------------------------------------------ effecten (elk aanroep een variant)
def pop(rng, pitch=0.0) -> np.ndarray:
    t = tone_t(0.07)
    f0 = 520 * 2 ** ((pitch + rng.uniform(-1.5, 1.5)) / 12)
    f = f0 * (1 + 1.2 * t / t[-1])
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env_exp(len(t), 0.025, 0.001) * 0.5


def thump(rng, pitch=0.0, size=1.0) -> np.ndarray:
    t = tone_t(0.3)
    n = len(t)
    f = (85 * 2 ** (pitch / 12)) * (1 + 0.6 * np.exp(-t / 0.02))
    ph = 2 * np.pi * np.cumsum(f) / SR
    low = np.sin(ph) * env_exp(n, 0.07)
    slap = lp(rng.randn(n), rng.uniform(1800, 3200)) * env_exp(n, 0.025)
    return size * (low * 0.7 + slap * 0.6) * 0.8


def flutter(rng, dur=0.28) -> np.ndarray:
    """Papier dat valt: kort fladderen."""
    n = int(dur * SR)
    am = 0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(18, 26) * np.arange(n) / SR)
    e = np.linspace(0, 1, n) ** 2
    return bp(rng.randn(n), 1500, 5000) * am * e * 0.12


def whoosh(rng, dur=0.35, up=True, gain=0.5) -> np.ndarray:
    n = int(dur * SR)
    x = rng.randn(n)
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    out = np.zeros(n)
    steps = 12
    for k in range(steps):
        a, b = k * n // steps, (k + 1) * n // steps
        p = k / steps if up else 1 - k / steps
        c = 600 + 4000 * p
        out[a:b] = bp(x, c * 0.7, c * 1.3)[a:b]
    return out * e * gain


def boing(rng) -> np.ndarray:
    t = tone_t(0.45)
    f = 220 * (1 + 0.9 * (1 - np.exp(-t / 0.08))) * (1 + 0.04 * np.sin(2 * np.pi * 14 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env_exp(len(t), 0.18) * 0.35


def tick(rng) -> np.ndarray:
    n = int(0.03 * SR)
    return bp(rng.randn(n), 2500, 5000) * env_exp(n, 0.004) * 0.5


def clack(rng) -> np.ndarray:
    """Typen: korte klik."""
    n = int(0.025 * SR)
    return bp(rng.randn(n), rng.uniform(1800, 3200), 7000) * env_exp(n, 0.005) * rng.uniform(0.12, 0.2)


def clapper(rng) -> np.ndarray:
    n = int(0.25 * SR)
    x = hp(rng.randn(n), 900) * env_exp(n, 0.02, 0.0005)
    body = np.sin(2 * np.pi * 420 * np.arange(n) / SR) * env_exp(n, 0.03)
    return (x * 0.9 + body * 0.4) * 0.8


def sparkle(rng) -> np.ndarray:
    out = np.zeros(int(0.8 * SR))
    for k, note in enumerate([88, 91, 95, 100]):
        t = tone_t(0.5)
        x = (np.sin(2 * np.pi * midi(note) * t) + 0.3 * np.sin(2 * np.pi * midi(note) * 2.76 * t)) * env_exp(len(t), 0.12)
        i = int(k * 0.06 * SR)
        out[i:i + len(x)] += x * 0.18
    return out


def tink(rng) -> np.ndarray:
    t = tone_t(0.6)
    f = 2600 * 2 ** (rng.uniform(-1, 1) / 12)
    x = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.4 * t)
    return x * env_exp(len(t), 0.15) * 0.08


# ------------------------------------------------------------------ brabbelstem
VOWELS = {  # formanten (F1, F2, F3) in Hz
    "a": (800, 1250, 2600), "e": (500, 1900, 2600), "i": (330, 2300, 3000),
    "o": (500, 900, 2500), "u": (350, 800, 2400), "æ": (690, 1650, 2500),
}
VOICE = {"baas": {"f0": 135.0, "formant": 0.92}, "ehm": {"f0": 285.0, "formant": 1.18},
         "kennis": {"f0": 215.0, "formant": 1.08}, "collega": {"f0": 165.0, "formant": 1.0}}


def vowel_of(word: str, k: int) -> str:
    vs = re.findall(r"[aeiou]", word.lower()) or ["a"]
    v = vs[k % len(vs)]
    return {"a": "a", "e": "e", "i": "i", "o": "o", "u": "u"}.get(v, "æ")


def babble(text: str, at: int, who: str, rng, nervous=False) -> tuple[np.ndarray, int]:
    """Brabbelstem voor één regel. Geeft (geluid, startframe)."""
    words = speech(text, at)
    end = words[-1]["syl"][-1][1] + 6
    total = int(sec(end - at) * SR) + SR // 4
    buf = np.zeros(total)
    v = VOICE[who]
    question = text.strip().endswith("?")
    nsyl = sum(len(w["syl"]) for w in words)
    k = 0
    for w in words:
        for j, (s, e) in enumerate(w["syl"]):
            dur = sec(e - s + 1) * 0.92
            t = tone_t(dur)
            n = len(t)
            # toonhoogte: zinsmelodie (vraag omhoog, mededeling omlaag) plus willekeurige variatie per lettergreep
            prog = k / max(1, nsyl - 1)
            contour = (4 * prog if question else -3 * prog) + rng.uniform(-2.0, 2.0) + (2 if j == 0 else 0)
            f0 = v["f0"] * 2 ** (contour / 12)
            wob = 1 + (0.03 * np.sin(2 * np.pi * 9 * t) if nervous else 0.008 * np.sin(2 * np.pi * 5 * t))
            f = f0 * wob * (1 + 0.04 * (1 - t / t[-1]))
            ph = 2 * np.pi * np.cumsum(f) / SR
            src = signal.sawtooth(ph) * 0.6 + np.sin(ph) * 0.4
            F = [x * v["formant"] for x in VOWELS[vowel_of(w["text"], j)]]
            y = bp(src, F[0] * 0.8, F[0] * 1.2) * 1.0 + bp(src, F[1] * 0.85, F[1] * 1.15) * 0.6 + bp(src, F[2] * 0.9, F[2] * 1.1) * 0.25
            a = np.clip(t / 0.012, 0, 1) * np.clip((t[-1] - t) / 0.035, 0, 1)
            y *= a
            # medeklinker aan het begin van sommige lettergrepen
            if rng.random() < 0.6:
                c = int(0.018 * SR)
                y[:c] += bp(rng.randn(c), 2500, 7000) * env_exp(c, 0.006) * 0.25
            i = int(sec(s - at) * SR)
            buf[i:i + n] += y
            k += 1
    buf /= max(1e-9, np.max(np.abs(buf)))
    return buf * 0.55, at


# ------------------------------------------------------------------ Ehm's geluidjes
# Dezelfde stem als zijn brabbel (formanten, f0 rond 285 Hz), zodat het één personage blijft. Elk geluidje is een
# reeks stukjes: (duur s, toonhoogte begin, toonhoogte eind als factor van f0, klinker, luidheid, vibrato).
def voiced(parts, rng, who="ehm", breath=0.0) -> np.ndarray:
    v = VOICE[who]
    out = []
    for dur, a, b, vowel, amp, vib in parts:
        t = tone_t(dur)
        n = len(t)
        jitter = 2 ** (rng.uniform(-0.7, 0.7) / 12)
        f = v["f0"] * jitter * (a + (b - a) * (t / t[-1])) * (1 + vib * np.sin(2 * np.pi * 11 * t))
        ph = 2 * np.pi * np.cumsum(f) / SR
        src = signal.sawtooth(ph) * 0.5 + np.sin(ph) * 0.5
        F = [x * v["formant"] for x in VOWELS[vowel]]
        y = bp(src, F[0] * 0.8, F[0] * 1.2) + bp(src, F[1] * 0.85, F[1] * 1.15) * 0.6 + bp(src, F[2] * 0.9, F[2] * 1.1) * 0.2
        if breath:
            y += bp(rng.randn(n), 900, 4000) * breath
        e = np.clip(t / 0.01, 0, 1) * np.clip((t[-1] - t) / 0.03, 0, 1)
        out.append(y * e * amp)
    x = np.concatenate(out)
    return x / max(1e-9, np.max(np.abs(x))) * 0.5


def ehm_voc(kind: str, rng) -> np.ndarray:
    if kind == "eep":      # schrik
        return voiced([(0.13, 1.5, 2.2, "i", 1.0, 0.0)], rng)
    if kind == "gulp":     # slikken
        x = voiced([(0.07, 0.9, 0.55, "u", 0.8, 0.0)], rng)
        n = int(0.02 * SR)
        click = np.zeros(int(0.09 * SR))
        click[: n] = bp(rng.randn(n), 400, 1500) * env_exp(n, 0.006) * 0.6
        return np.concatenate([click, x])
    if kind == "mmf":      # gesmoord, papier op zijn hoofd
        return lp(voiced([(0.09, 1.1, 0.8, "u", 1.0, 0.0)], rng), 1400) * 1.2
    if kind == "whimper":  # het wordt te veel
        return voiced([(0.16, 1.35, 1.25, "i", 0.9, 0.04), (0.22, 1.2, 0.85, "u", 0.8, 0.05)], rng)
    if kind == "hm":       # klaar om te praten
        return voiced([(0.12, 1.0, 1.15, "u", 0.7, 0.0)], rng)
    if kind == "sigh":     # opgelucht uitademen
        return voiced([(0.7, 1.05, 0.7, "a", 0.6, 0.0)], rng, breath=0.9)
    if kind == "giggle":
        return voiced([(0.07, 1.6, 1.7, "i", 1.0, 0.0), (0.03, 1.0, 1.0, "i", 0.0, 0.0)] * 2 +
                      [(0.07, 1.85, 1.95, "i", 1.0, 0.0), (0.03, 1.0, 1.0, "i", 0.0, 0.0), (0.1, 2.0, 2.3, "i", 1.0, 0.0)], rng)
    if kind == "yay":
        return voiced([(0.12, 1.4, 1.5, "a", 0.9, 0.0), (0.24, 1.8, 2.2, "e", 1.0, 0.02)], rng)
    if kind == "hum":      # tevreden "mm-hm"
        return voiced([(0.12, 1.0, 1.0, "u", 0.7, 0.0), (0.04, 1.0, 1.0, "u", 0.0, 0.0), (0.16, 1.2, 1.4, "u", 0.8, 0.0)], rng)
    raise ValueError(kind)


def squish(rng) -> np.ndarray:
    """Rubberachtig indeuken van Ehm."""
    t = tone_t(0.16)
    f = 210 * 2 ** (rng.uniform(-2, 2) / 12) * (1 - 0.5 * t / t[-1])
    ph = 2 * np.pi * np.cumsum(f) / SR
    return lp(np.sin(ph) + 0.3 * signal.sawtooth(ph), 1500) * env_exp(len(t), 0.06) * 0.35


def levelup(rng) -> np.ndarray:
    """Spelachtig: een snel stijgend akkoord voor "+1 courage"."""
    out = np.zeros(int(1.0 * SR))
    for k, note in enumerate([72, 76, 79, 84, 88]):
        t = tone_t(0.6)
        x = (np.sin(2 * np.pi * midi(note) * t) + 0.25 * np.sin(4 * np.pi * midi(note) * t)) * env_exp(len(t), 0.18)
        i = int(k * 0.055 * SR)
        out[i:i + len(x)] += x * 0.16
    return reverb(out, 0.3)


def soft_boing(rng, up=1.0) -> np.ndarray:
    t = tone_t(0.3)
    f = 330 * up * (1 + 0.7 * (1 - np.exp(-t / 0.06))) * (1 + 0.03 * np.sin(2 * np.pi * 16 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env_exp(len(t), 0.1) * 0.22


# ------------------------------------------------------------------ muziek
PROG = [(60, [60, 64, 67]), (57, [57, 60, 64]), (53, [53, 57, 60]), (55, [55, 59, 62])]  # C Am F G


def music(d: dict, rng) -> np.ndarray:
    total = d["total"]
    mel = np.zeros(idx(total) + SR)
    bass = np.zeros_like(mel)
    drums = np.zeros_like(mel)

    def section(f):
        if f < d["freeze"]:
            return "bad"
        if f >= d["goodStart"] + 20:
            return "good"
        return None

    for beat in range(total // BEAT):
        f = beat * BEAT
        sec_ = section(f)
        if sec_ is None:
            continue
        bar = f // BAR
        b = beat % 4
        root, chord = PROG[bar % 4]
        shift = 0
        if sec_ == "bad":
            shift = 1 if f >= 150 else 0
            shift = 2 if f >= 205 else shift
            shift = 3 if f >= 235 else shift
        intensity = 0.0 if sec_ == "good" else min(1.0, max(0.0, (f - 88) / 170))
        notes = [n + shift for n in chord]
        # marimba: arpeggio op achtsten, in de escalatie dichter (zestienden) en hoger
        steps = 4 if (sec_ == "bad" and f >= 200) else 2
        for s in range(steps):
            n = notes[(b * steps + s) % 3] + 12 + (12 if (s % 2 and intensity > 0.6) else 0)
            vel = 0.55 + 0.15 * (s == 0) + rng.uniform(-0.08, 0.08)
            place(mel, marimba(n, vel), f + s * BEAT / steps)
        # bas: grondtoon op 1 en 3, kwint op "3-en"
        if b in (0, 2):
            place(bass, pizz(root + shift - 12, 0.9), f)
        if b == 2:
            place(bass, pizz(root + shift - 5, 0.6), f + BEAT / 2)
        # drums
        if sec_ == "good" or f < 88:
            place(drums, shaker(0.8, rng), f + BEAT / 2)
            if b in (1, 3):
                place(drums, snare(0.35, rng), f)
            if b == 0 and sec_ == "good":
                place(drums, kick(0.55), f)
        else:
            place(drums, kick(0.7 + 0.2 * intensity), f) if (b in (0, 2) or f >= 176) else None
            if b in (1, 3):
                place(drums, snare(0.55 + 0.3 * intensity, rng), f)
            hats = 4 if f >= 210 else 2
            for h in range(hats):
                place(drums, hat(0.6 + 0.3 * intensity, rng), f + h * BEAT / hats)
    mel = reverb(mel, 0.28)
    mix = lp(mel * 0.8 + bass * 0.9 + drums * 0.8, 9000, 4)
    # stijgende ruis naar de piek
    r0 = max(0, d["freeze"] - 62)
    n = idx(d["freeze"]) - idx(r0)
    riser = whoosh(rng, (n + 1) / SR, up=True, gain=0.35)[:n]
    riser = riser * np.linspace(0, 1, len(riser)) ** 2
    place(mix, riser, r0)
    # harde stilte vanaf de piek tot het goede deel
    mix[idx(d["freeze"]):idx(d["goodStart"] + 20)] = 0
    return mix[: idx(total)]


# ------------------------------------------------------------------ alles samen
def soundtrack(d: dict, seed: int = 7) -> np.ndarray:
    rng = np.random.RandomState(seed)
    np.random.seed(seed)
    total = d["total"]
    buf = music(d, rng) * 0.42
    fx = np.zeros_like(buf)
    voice = np.zeros_like(buf)

    # typen aan het begin, bij take two en aan het eind (zodat de lus doorloopt)
    typing = [] if d.get("setting", "kantoor") != "kantoor" else ((0, 22), (d["goodStart"], d["goodStart"] + 14), (d.get("celebrate", d["bossExit"]) + 66, total))
    for a, b in typing:
        f = a
        while f < b:
            place(fx, clack(rng), f)
            f += rng.choice([2, 3, 3, 4])

    for k, l in enumerate(d["lines"]):
        place(fx, pop(rng, pitch=(2 if l["who"] == "ehm" else -2)), l["at"] - 1, 0.7)
        snd, at = babble(l["text"], l["at"], l["who"], rng, nervous=(l.get("tone") == "not"))
        place(voice, snd, at)

    C0 = d.get("celebrate", d["bossExit"] + 12)
    bad = [l for l in d["lines"] if l["at"] < d["freeze"]]
    wrong_at = next(l["at"] for l in bad if l["who"] == "ehm")
    other = [l for l in bad if l["who"] != "ehm"]
    place(fx, boing(rng), wrong_at - 28, 0.5)  # Ehm schrikt
    place(voice, ehm_voc("eep", rng), wrong_at - 29, 0.9)
    place(voice, ehm_voc("gulp", rng), wrong_at - 8, 0.8)
    place(voice, ehm_voc("whimper", rng), (other[-2]["at"] + other[-1]["at"]) // 2, 0.7)
    place(voice, ehm_voc("hm", rng), d["goodStart"] + 40, 0.6)
    # Ehm's eigen moment: zucht, giecheltje en sprongen, level-up, "yay", tevreden "mm-hm"
    place(voice, ehm_voc("sigh", rng), C0, 0.8)
    place(voice, ehm_voc("giggle", rng), C0 + 20, 0.8)
    place(fx, soft_boing(rng, 1.0), C0 + 26)
    place(fx, levelup(rng), C0 + 28, 0.9)
    place(fx, soft_boing(rng, 1.26), C0 + 44)
    place(voice, ehm_voc("yay", rng), C0 + 46, 0.9)
    place(voice, ehm_voc("hum", rng), C0 + 70, 0.6)
    # papier: fladderen tijdens de val, plof bij het landen, elke plof een halve toon hoger
    gag = d.get("gag", "stapel")
    for i, p in enumerate(d["papers"]):
        if gag == "krimp":  # krimpen: rubberen indeuk en een piepje dat steeds hoger wordt
            place(fx, squish(rng), p + 9)
            place(fx, soft_boing(rng, 1.5 + 0.12 * i), p + 10, 0.6)
            continue
        if gag == "wolk":  # wolk: een rommeltje en druppels, steeds voller
            place(fx, thump(rng, pitch=-14 + i, size=0.35), p + 9)
            for k in range(2 + i // 2):
                place(fx, pop(rng, pitch=10 + rng.uniform(-3, 3)), p + 9 + rng.uniform(0, 12), 0.25)
            continue
        if gag == "zakken":  # zakken: een dalend boing en een rubberen indeuk
            place(fx, soft_boing(rng, max(0.45, 0.9 - 0.06 * i)), p + 9)
            place(fx, squish(rng), p + 10, 0.8)
            continue
        if gag == "zweet":  # zweet: druppels die op het blad spatten
            place(fx, pop(rng, pitch=-8 + i), p + 9, 0.5)
            place(fx, thump(rng, pitch=12 + i, size=0.25), p + 10)
            continue
        place(fx, flutter(rng), p)
        place(fx, thump(rng, pitch=i * 0.5, size=0.7 + 0.02 * i), p + 9)
        if i >= d["frontStack"]:  # op zijn hoofd: indeuken en een gesmoord "mmf"
            place(fx, squish(rng), p + 9)
            if i % 2 == 0:
                place(voice, ehm_voc("mmf", rng), p + 10, 0.7)
    # piek: stilte, één glasachtig tikje en de klok
    place(fx, tink(rng), d["freeze"] + 1)
    for f in range(d["freeze"] + 4, d["rewindStart"], 10):
        place(fx, tick(rng), f, 0.6)

    # muziek wijkt voor de stem: 7 dB zachter tijdens spraak, met zachte overgangen
    mask = np.zeros_like(buf)
    for l in d["lines"]:  # de escalatie heeft alleen brabbelstem, geen echte stem (zie duel_soundtrack)
        w = speech(l["text"], l["at"])
        mask[idx(l["at"] - 2):idx(w[-1]["syl"][-1][1] + 4)] = 1
    k = int(0.12 * SR)
    mask = np.convolve(mask, np.ones(k) / k, mode="same")
    buf = buf * (1 - 0.55 * mask)
    mix = buf + voice * 0.9 + lp(fx, 14000)

    # terugspoelen: de geluidsband van 0 tot de piek achterstevoren en versneld, met bandruis
    seg = mix[: idx(d["freeze"])].copy()
    n_out = idx(d["rewindEnd"]) - idx(d["rewindStart"])
    rev = signal.resample(seg[::-1], n_out)
    rev = lp(rev, 7000) * 0.9
    whir = bp(rng.randn(n_out), 2000, 8000) * 0.06
    mix[idx(d["rewindStart"]):idx(d["rewindStart"]) + n_out] += rev + whir
    place(mix, clapper(rng), d["rewindEnd"])
    place(mix, whoosh(rng, 0.3, up=False, gain=0.4), d["rewindEnd"] - 4)

    place(mix, pop(rng, pitch=5), d["sticker"]["at"], 0.8)
    place(mix, whoosh(rng, 0.3, up=True, gain=0.6), d["bossExit"])
    place(mix, whoosh(rng, 0.28, up=False, gain=0.35), d["bossReturn"])
    return mix


# ------------------------------------------------------------------ spelvorm (scripts/quiz.py, Quiz.tsx)
def wahwah(rng) -> np.ndarray:
    """Fout antwoord: drie dalende "wah"-tonen, zacht en grappig (geen harde zoemer)."""
    out = []
    base = 62 + rng.uniform(-0.5, 0.5)
    for k, (st, dur) in enumerate([(0, 0.22), (-1, 0.22), (-2, 0.5)]):
        t = tone_t(dur)
        f = midi(base + st) * (1 + (0.02 * np.sin(2 * np.pi * 6 * t) if k == 2 else 0)) * (1 - (0.06 * t / t[-1] if k == 2 else 0))
        ph = 2 * np.pi * np.cumsum(f) / SR
        x = signal.sawtooth(ph) * 0.6 + np.sin(ph) * 0.4
        # "wah": het filter gaat open en dicht
        cut = 500 + 1600 * np.sin(np.pi * np.clip(t / t[-1], 0, 1))
        y = np.zeros_like(x)
        for a in range(0, len(x), 960):
            y[a:a + 960] = lp(x, float(cut[min(a, len(cut) - 1)]))[a:a + 960]
        out.append(y * np.clip(t / 0.02, 0, 1) * np.clip((t[-1] - t) / 0.05, 0, 1))
    return reverb(np.concatenate(out), 0.15) * 0.4


def ding(rng, note=84) -> np.ndarray:
    t = tone_t(1.2)
    f = midi(note)
    x = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.0 * t) * env_exp(len(t), 0.3) + 0.2 * np.sin(2 * np.pi * f * 3.01 * t)
    return x * env_exp(len(t), 0.45) * 0.22


def select(rng) -> np.ndarray:
    """Kaart gekozen: kort spelachtig blipje omhoog."""
    t = tone_t(0.09)
    f = midi(79 + rng.uniform(-0.3, 0.3)) * (1 + 0.5 * (t / t[-1] > 0.45))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return signal.square(ph) * 0.25 * env_exp(len(t), 0.05) * 0.5


def applause(rng, dur=2.2) -> np.ndarray:
    """Klein publiek: losse handklappen die aanzwellen en wegsterven."""
    n = int(dur * SR)
    out = np.zeros(n)
    k = int(0.012 * SR)
    for _ in range(int(dur * 70)):
        i = int(rng.beta(1.4, 3.0) * (n - k))
        out[i:i + k] += bp(rng.randn(k), rng.uniform(900, 1500), 5000) * env_exp(k, 0.003) * rng.uniform(0.3, 1.0)
    return lp(out, 7000) * 0.35


def timer_tick(rng, high=False) -> np.ndarray:
    t = tone_t(0.08)
    f = 1900 if high else 1250
    x = np.sin(2 * np.pi * f * t) * env_exp(len(t), 0.012) * 0.35
    c = tick(rng)
    x[: len(c)] += c * 0.3
    return x


def quiz_music(d: dict, rng) -> np.ndarray:
    """Spelshow: vrolijk tot de timer, dan spanning (bas stijgt per tel, alleen tikken), daarna een kaal bed onder de
    antwoorden, stil tijdens de reacties, en een vol feestje na het goede antwoord."""
    total = d["total"]
    mel = np.zeros(idx(total) + SR)
    bass = np.zeros_like(mel)
    drums = np.zeros_like(mel)
    rv = d["reveals"]
    closeups = [(r["cutIn"], r["cutOut"]) for r in rv]
    for beat in range(total // BEAT):
        f = beat * BEAT
        bar, b = f // BAR, beat % 4
        root, chord = PROG[bar % 4]
        if any(a - 2 <= f < z for a, z in closeups):
            continue
        if f < d["timerAt"]:  # vraag en kaarten: vrolijk
            for s in range(2):
                place(mel, marimba(chord[(b * 2 + s) % 3] + 12, 0.55 + rng.uniform(-0.06, 0.06)), f + s * BEAT / 2)
            if b in (0, 2):
                place(bass, pizz(root - 12, 0.8), f)
            place(drums, shaker(0.7, rng), f + BEAT / 2)
            if b in (1, 3):
                place(drums, snare(0.3, rng), f)
        elif f < d["timerEnd"]:  # timer: spanning
            k = (f - d["timerAt"]) // 30
            place(bass, pizz(48 + 2 * k, 0.9), f) if (f - d["timerAt"]) % 30 == 0 else None
            place(bass, pizz(48 + 2 * k, 0.5), f + BEAT / 2)
            place(drums, hat(0.5 + 0.15 * k, rng), f)
        elif f < d["celebrate"]:  # de antwoorden: kaal en luchtig
            if b == 0:
                place(mel, marimba(chord[0] + 12, 0.35), f)
            if b in (0, 2):
                place(bass, pizz(root - 12, 0.5), f)
            place(drums, shaker(0.4, rng), f + BEAT / 2)
        else:  # feest
            for s in range(4):
                place(mel, marimba(chord[(b * 4 + s) % 3] + 12 + 12 * (s % 2), 0.6 + rng.uniform(-0.06, 0.06)), f + s * BEAT / 4)
            if b in (0, 2):
                place(bass, pizz(root - 12, 0.9), f)
            if b == 2:
                place(bass, pizz(root - 5, 0.6), f + BEAT / 2)
            place(drums, kick(0.6), f) if b in (0, 2) else place(drums, snare(0.45, rng), f)
            for h in range(2):
                place(drums, hat(0.55, rng), f + h * BEAT / 2)
    mel = reverb(mel, 0.28)
    return lp(mel * 0.8 + bass * 0.9 + drums * 0.8, 9000, 4)[: idx(total)]


def quiz_soundtrack(d: dict, seed: int = 7) -> np.ndarray:
    rng = np.random.RandomState(seed)
    np.random.seed(seed)
    total = d["total"]
    buf = quiz_music(d, rng) * 0.42
    fx = np.zeros_like(buf)
    voice = np.zeros_like(buf)
    cast = d["cast"]
    speak = []  # (at, text) om de muziek te laten wijken

    def say(text, at, who, nervous=False, gain=1.0):
        snd, a = babble(text, at, who, rng, nervous=nervous)
        place(voice, snd, a, gain)
        speak.append((at, text))

    place(fx, pop(rng, -2), d["prompt"]["at"] - 1, 0.7)
    say(d["prompt"]["text"], d["prompt"]["at"], cast)
    place(voice, ehm_voc("hm", rng), d["prompt"]["end"] + 2, 0.5)
    # titel klapt erin, kaarten schuiven op hun plek
    place(fx, thump(rng, 4, 0.8), d["titleAt"] + 2)
    place(fx, boing(rng), d["titleAt"] + 3, 0.4)
    for k, a in enumerate(d["cardsAt"]):
        place(fx, whoosh(rng, 0.2, up=True, gain=0.35), a - 3)
        place(fx, pop(rng, 3 + 2 * k), a + 5, 0.7)
    # timer: tik op elke halve tel, hoog op de hele, en "tijd!"
    for f in range(d["timerAt"], d["timerEnd"], 15):
        place(fx, timer_tick(rng, high=(f - d["timerAt"]) % 30 == 0), f, 0.9 if f >= d["timerEnd"] - 30 else 0.7)
    place(voice, ehm_voc("gulp", rng), d["timerAt"] + 40, 0.7)
    place(fx, ding(rng, 79), d["timerEnd"], 0.9)
    place(fx, ding(rng, 86), d["timerEnd"] + 3, 0.6)

    for r in d["reveals"]:
        o = d["options"][r["option"]]
        place(fx, select(rng), r["pick"])
        say(o["text"], r["sayAt"], "ehm", nervous=not o["correct"])
        place(fx, whoosh(rng, 0.18, up=not o["correct"], gain=0.5), r["cutIn"] - 3)
        place(fx, clapper(rng), r["cutIn"], 0.35)
        say(o["reaction"], r["reactAt"], cast)
        if o.get("exit"):  # weglopen: zoef en snelle stapjes
            place(fx, whoosh(rng, 0.3, up=True, gain=0.6), r["reactEnd"] + 6)
            for s in range(4):
                place(fx, pop(rng, -10 + s), r["reactEnd"] + 4 + s * 3, 0.4)
        if o["correct"]:
            place(fx, ding(rng, 84), r["stamp"])
            place(fx, ding(rng, 88), r["stamp"] + 4, 0.8)
            place(fx, sparkle(rng), r["stamp"] + 6)
            place(fx, applause(rng), r["stamp"] + 2, 0.9)
            place(voice, ehm_voc("sigh", rng), r["stamp"] + 4, 0.6)
        else:
            place(fx, thump(rng, -2, 0.7), r["stamp"])
            place(fx, wahwah(rng), r["stamp"] + 2)
            place(voice, ehm_voc("eep" if r is d["reveals"][0] else "whimper", rng), r["stamp"] + 3, 0.7)
    c = d["celebrate"]
    place(fx, levelup(rng), c + 6, 0.9)
    place(fx, whoosh(rng, 0.4, up=True, gain=0.5), c + 6)
    place(voice, ehm_voc("giggle", rng), c + 22, 0.8)
    place(fx, soft_boing(rng, 1.0), c + 34)
    place(voice, ehm_voc("yay", rng), c + 36, 0.9)
    place(fx, soft_boing(rng, 1.26), c + 52)
    place(fx, pop(rng, 5), d["cta"], 0.8)
    place(fx, pop(rng, 8), d["cta"] + 12, 0.8)
    place(voice, ehm_voc("hum", rng), d["cta"] + 30, 0.6)

    mask = np.zeros_like(buf)
    for at, text in speak:
        w = speech(text, at)
        mask[idx(at - 2):idx(w[-1]["syl"][-1][1] + 4)] = 1
    k = int(0.12 * SR)
    mask = np.convolve(mask, np.ones(k) / k, mode="same")
    buf = buf * (1 - 0.55 * mask)
    return buf + voice * 0.9 + lp(fx, 14000)


# ------------------------------------------------------------------ Ehm tegen Ehm (scripts/duel.py, Duel.tsx)
def crumple(rng, dur=0.45) -> np.ndarray:
    """Papier verfrommelen: korte knisperende tikjes."""
    n = int(dur * SR)
    out = np.zeros(n)
    k = int(0.006 * SR)
    for _ in range(int(dur * 120)):
        i = int(rng.uniform(0, n - k))
        out[i:i + k] += bp(rng.randn(k), rng.uniform(1500, 3000), 9000) * env_exp(k, 0.0015) * rng.uniform(0.2, 1.0)
    return out * np.linspace(1, 0.3, n) * 0.5


def duel_music(d: dict, rng) -> np.ndarray:
    """Licht bed dat per beurt van kleur wisselt: boven mineur en gedempt, onder helder; na de NOPE een vrolijk feestje."""
    total = d["total"]
    mel = np.zeros(idx(total) + SR)
    bass = np.zeros_like(mel)
    drums = np.zeros_like(mel)
    turns = sorted((l["at"], l["panel"]) for l in d["lines"])

    def panel(f):
        cur = "both"
        for a, pnl in turns:
            if f >= a - 4:
                cur = pnl
        return "bottom" if f >= d["expand"] else cur

    for beat in range(total // BEAT):
        f = beat * BEAT
        if d["nope"] <= f < d["expand"] + 10:
            continue  # stilte rond de NOPE en het weggooien
        bar, b = f // BAR, beat % 4
        root, chord = PROG[bar % 4]
        pnl = panel(f)
        party = f >= d["celebrate"]
        if pnl == "top":  # mineur, laag en traag
            chord = [chord[0] - 1, chord[1] - 1, chord[2] - 1]
            root -= 1
        steps = 4 if party else (1 if pnl == "top" else 2)
        for s in range(steps):
            place(mel, marimba(chord[(b * steps + s) % 3] + (0 if pnl == "top" else 12), 0.5 + rng.uniform(-0.06, 0.06)), f + s * BEAT / steps)
        if b in (0, 2):
            place(bass, pizz(root - 12, 0.85), f)
        if party:
            place(drums, kick(0.6), f) if b in (0, 2) else place(drums, snare(0.45, rng), f)
            place(drums, hat(0.5, rng), f + BEAT / 2)
        elif pnl != "top":
            place(drums, shaker(0.6, rng), f + BEAT / 2)
    mel = reverb(mel, 0.28)
    return lp(mel * 0.8 + bass * 0.9 + drums * 0.8, 9000, 4)[: idx(total)]


def duel_soundtrack(d: dict, seed: int = 7) -> np.ndarray:
    rng = np.random.RandomState(seed)
    np.random.seed(seed)
    buf = duel_music(d, rng) * 0.42
    fx = np.zeros_like(buf)
    voice = np.zeros_like(buf)
    spoken = {}  # regel -> eindframe van de echte stem (proef "stem-en": d["voice"] == "kokoro")
    for l in d["lines"]:
        place(fx, pop(rng, pitch=(2 if l["who"] == "ehm" else -2)), l["at"] - 1, 0.6)
        if d.get("voice") == "kokoro":
            import stem
            snd = stem.line(l["text"], l["who"], _room(d, l), SR)
            place(voice, snd, l["at"])
            spoken[id(l)] = l["at"] + len(snd) / SR * 30
        else:
            snd, at = babble(l["text"], l["at"], l["who"], rng, nervous=(l.get("tone") == "not"))
            place(voice, snd, at)
    prev = None
    for l in sorted(d["lines"], key=lambda x: x["at"]):  # wisselen van vak: een bladzijde-tikje
        if prev and l["panel"] != prev:
            place(fx, flutter(rng, 0.12), l["at"] - 6, 1.4)
        prev = l["panel"]
    for s in d["sfx"]:
        a = s["at"]
        place(fx, thump(rng, 3, 0.5), a)
        if s["text"].startswith("GULP"):
            place(voice, ehm_voc("gulp", rng), a, 0.9)
            place(fx, boing(rng), a + 2, 0.35)
        elif s["text"].startswith("AWK"):
            place(voice, ehm_voc("whimper", rng), a, 0.8)
        elif s["text"].startswith("UH"):
            place(voice, voiced([(0.14, 1.3, 1.3, "u", 0.9, 0.0), (0.05, 1, 1, "u", 0.0, 0.0), (0.3, 1.0, 0.85, "o", 0.9, 0.03)], rng), a, 0.9)
        elif s["text"].startswith("NICE"):
            place(fx, ding(rng, 84), a, 0.8)
            place(fx, sparkle(rng), a + 3)
        elif s["text"].startswith("YAY"):
            place(voice, ehm_voc("yay", rng), a, 0.9)
            place(fx, levelup(rng), a + 2, 0.9)
    if d.get("layout") == "sequence" and d.get("rewind"):  # terugspoelen tussen de foute en de goede versie
        r = d["rewind"]
        place(fx, whoosh(rng, 0.5, up=False, gain=0.7), r)
        for f in range(r + 2, d["expand"] - 2, 3):
            place(fx, tick(rng), f, 0.5)
        place(fx, pop(rng, 6), d["expand"], 0.9)
    place(fx, thump(rng, -3, 1.0), d["nope"])
    place(fx, wahwah(rng), d["nope"] + 3)
    place(fx, crumple(rng), d["crumble"])
    place(fx, whoosh(rng, 0.35, up=True, gain=0.6), d["crumble"] + 8)
    place(fx, whoosh(rng, 0.4, up=True, gain=0.4), d["expand"])
    place(fx, sparkle(rng), d["expand"] + 8)
    c = d["celebrate"]
    place(voice, ehm_voc("sigh", rng), c, 0.7)
    place(fx, soft_boing(rng, 1.0), c + 24)
    place(fx, soft_boing(rng, 1.26), c + 42)
    place(fx, applause(rng, 1.8), c + 26, 0.6)
    place(fx, pop(rng, 5), d["cta"], 0.8)
    place(fx, pop(rng, 8), d["cta"] + 12, 0.8)
    place(voice, ehm_voc("hum", rng), d["cta"] + 30, 0.6)
    mask = np.zeros_like(buf)
    for l in d["lines"]:
        w = speech(l["text"], l["at"])
        mask[idx(l["at"] - 2):idx(max(w[-1]["syl"][-1][1], spoken.get(id(l), 0)) + 4)] = 1
    k = int(0.12 * SR)
    mask = np.convolve(mask, np.ones(k) / k, mode="same")
    return buf * (1 - 0.55 * mask) + voice * 0.9 + lp(fx, 14000)


def _room(d: dict, l: dict) -> int:
    """Hoeveel frames een ingesproken regel mag duren: tot de volgende regel of mijlpaal, min 4 frames adem.
    Een geluidje (GULP, NICE) mag er wel overheen vallen."""
    moments = [x["at"] for x in d["lines"]] + [d[k] for k in ("nope", "crumble", "expand", "celebrate", "cta", "total") if k in d]
    later = [m for m in moments if m > l["at"] + 2]
    return max(10, min(later, default=d["total"]) - l["at"] - 4)


def cold_open(d: dict, mix: np.ndarray, rng) -> np.ndarray:
    """Koude opening: stilte rond de bevroren piek, een tikkende klok, een plaatkras en de scène kort achterstevoren."""
    co = d["coldOpen"]
    n = idx(co)
    out = np.zeros(n)
    place(out, tink(rng), 2)
    for f in range(6, co - 16, 10):
        place(out, tick(rng), f, 0.6)
    place(out, pop(rng, 4), 4, 0.6)
    seg = mix[: idx(d["freeze"])][::-1]
    rw = signal.resample(seg, idx(co) - idx(co - 16))
    out[idx(co - 16):] += lp(rw, 7000) * 0.8
    scratch = whoosh(rng, 0.25, up=False, gain=0.5)
    place(out, scratch, co - 17)
    return out


# ------------------------------------------------------------------ de verteller (scripts/verteller.py, Verteller.tsx)
def heartbeat(rng) -> np.ndarray:
    """Dubbele doffe slag: lub-dub."""
    out = np.zeros(int(0.5 * SR))
    for at, v in ((0.0, 1.0), (0.16, 0.7)):
        n = int(0.14 * SR)
        x = tone_t(0.14)
        s = np.sin(2 * np.pi * (55 - 20 * x / 0.14) * x) * env_exp(n, 0.05, 0.004) * v
        i = int(at * SR)
        out[i:i + n] += s[: len(out) - i]
    return lp(out, 400) * 0.9


def verteller_music(d: dict, rng) -> np.ndarray:
    """Bed: rustig bij de vraag, gespannen bij het moment, stil bij de pauze, helder vanaf de goede zinnen."""
    total = d["total"]
    mel = np.zeros(idx(total) + SR)
    bass = np.zeros_like(mel)
    drums = np.zeros_like(mel)
    for beat in range(total // BEAT):
        f = beat * BEAT
        if d["panic"] <= f < d["good"]:
            continue  # stilte: je hoofd loopt leeg (het hart klopt wel)
        bar, b = f // BAR, beat % 4
        root, chord = PROG[bar % 4]
        tense = d["scene"] <= f < d["panic"]
        party = f >= d["celebrate"]
        if f < d["scene"] or tense:  # mineur en laag
            chord = [chord[0] - 1, chord[1] - 1, chord[2] - 1]
            root -= 1
        steps = 4 if party else (1 if f < d["scene"] else 2)
        for s in range(steps):
            place(mel, marimba(chord[(b * steps + s) % 3] + (0 if tense or f < d["scene"] else 12), 0.45 + rng.uniform(-0.05, 0.05)), f + s * BEAT / steps)
        if b in (0, 2):
            place(bass, pizz(root - 12, 0.8), f)
        if party:
            place(drums, kick(0.6), f) if b in (0, 2) else place(drums, snare(0.45, rng), f)
            place(drums, hat(0.5, rng), f + BEAT / 2)
        elif tense:
            place(drums, hat(0.35, rng), f + BEAT / 2)
        elif f >= d["good"]:
            place(drums, shaker(0.6, rng), f + BEAT / 2)
    mel = reverb(mel, 0.28)
    return lp(mel * 0.8 + bass * 0.9 + drums * 0.8, 9000, 4)[: idx(total)]


def verteller_soundtrack(d: dict, seed: int = 7) -> np.ndarray:
    import stem
    rng = np.random.RandomState(seed)
    np.random.seed(seed)
    buf = verteller_music(d, rng) * 0.4
    fx = np.zeros_like(buf)
    voice = np.zeros_like(buf)
    mask = np.zeros_like(buf)
    for n in d["narration"]:
        snd = stem.line(n["text"], "verteller", max(10, n["until"] - n["at"]), SR)
        place(voice, snd, n["at"], 1.0)
        mask[idx(n["at"] - 2):idx(n["at"] + len(snd) / SR * 30 + 4)] = 1
    for l in d["lines"]:
        place(fx, pop(rng, pitch=(2 if l["who"] == "ehm" else -2)), l["at"] - 1, 0.6)
        snd = stem.line(l["text"], l["who"], max(10, l["until"] - l["at"] + 2), SR)
        place(voice, snd, l["at"], 0.95)
        mask[idx(l["at"] - 2):idx(l["at"] + len(snd) / SR * 30 + 4)] = 1
        if l["who"] == "ehm":
            place(fx, ding(rng, 84), l["end"] + 2, 0.7)
            place(fx, sparkle(rng), l["end"] + 5)
    place(fx, whoosh(rng, 0.4, up=True, gain=0.5), d["scene"])
    for f in range(d["panic"], d["turn"], 22):  # het hart klopt in je keel
        place(fx, heartbeat(rng), f, 1.0)
    place(voice, ehm_voc("gulp", rng), d["panic"] + 2, 0.8)
    place(fx, whoosh(rng, 0.3, up=False, gain=0.6), d["turn"] - 2)
    place(fx, thump(rng, -2, 0.8), d["turn"])
    place(fx, pop(rng, 6), d["good"] - 4, 0.8)
    c = d["celebrate"]
    place(voice, ehm_voc("yay", rng), c + 6, 0.8)
    place(fx, levelup(rng), c + 8, 0.8)
    place(fx, soft_boing(rng, 1.0), c + 6)
    place(fx, soft_boing(rng, 1.26), c + 24)
    place(fx, pop(rng, 8), d["cta"], 0.8)
    k = int(0.12 * SR)
    mask = np.convolve(mask, np.ones(k) / k, mode="same")
    return buf * (1 - 0.6 * mask) + voice * 0.95 + lp(fx, 14000)


# ------------------------------------------------------------------ de korte vormen (23 nov): POV, decoder, ranglijst
def bed(total: int, rng, party_from: int | None = None, quiet: list[tuple[int, int]] = (), tense_until: int = 0,
        loop: bool = False) -> np.ndarray:
    """Licht bed op 120 BPM: mineur en dun tot tense_until, dan helder; vanaf party_from met drums. Stil in `quiet`.
    loop=True: het laatste stuk zwakt af naar het begin, zodat de knip naar frame 0 niet opvalt."""
    mel = np.zeros(idx(total) + SR)
    bass = np.zeros_like(mel)
    drums = np.zeros_like(mel)
    for beat in range(total // BEAT):
        f = beat * BEAT
        if any(a <= f < b for a, b in quiet):
            continue
        bar, b = f // BAR, beat % 4
        root, chord = PROG[bar % 4]
        tense = f < tense_until
        if tense:
            chord = [chord[0] - 1, chord[1] - 1, chord[2] - 1]
            root -= 1
        party = party_from is not None and f >= party_from
        steps = 4 if party else 2
        for s in range(steps):
            place(mel, marimba(chord[(b * steps + s) % 3] + (0 if tense else 12), 0.45 + rng.uniform(-0.05, 0.05)), f + s * BEAT / steps)
        if b in (0, 2):
            place(bass, pizz(root - 12, 0.8), f)
        if party:
            place(drums, kick(0.6), f) if b in (0, 2) else place(drums, snare(0.45, rng), f)
            place(drums, hat(0.5, rng), f + BEAT / 2)
        else:
            place(drums, shaker(0.55, rng), f + BEAT / 2)
    mel = reverb(mel, 0.28)
    out = lp(mel * 0.8 + bass * 0.9 + drums * 0.8, 9000, 4)[: idx(total)]
    if loop:  # de staart van de galm hoort bij het begin: optellen, dan klinkt de knip als één doorlopend bed
        n = idx(12)
        out[:n] += lp(mel * 0.8, 9000, 4)[idx(total): idx(total) + n] * np.linspace(1, 0, n)
    return out


def _ducked(buf: np.ndarray, voice: np.ndarray, fx: np.ndarray, spans: list[tuple[float, float]]) -> np.ndarray:
    mask = np.zeros_like(buf)
    for a, b in spans:
        mask[idx(max(0, a - 2)):idx(b + 4)] = 1
    k = int(0.12 * SR)
    mask = np.convolve(mask, np.ones(k) / k, mode="same")
    return buf * (1 - 0.55 * mask) + voice * 0.9 + lp(fx, 14000)


def pov_soundtrack(d: dict, seed: int = 7) -> np.ndarray:
    """POV-loop: de ander brabbelt de aanleiding, dan de grap met Ehm's geluidjes; het bed valt weg bij de reactie
    (ongemakkelijke stilte) en komt aan het eind terug voor de lus."""
    rng = np.random.RandomState(seed)
    np.random.seed(seed)
    total, r, line = d["total"], d["react"], d["line"]
    buf = bed(total, rng, quiet=[(r, total - 30)], tense_until=total, loop=True) * 0.4
    fx = np.zeros_like(buf)
    voice = np.zeros_like(buf)
    place(fx, pop(rng, -2), line["at"] - 1, 0.6)
    snd, at = babble(line["text"], line["at"], line["who"], rng)
    place(voice, snd, at)
    place(fx, thump(rng, -3, 0.9), r)
    gag = d["gag"]
    if gag == "bevriezen":
        place(voice, ehm_voc("eep", rng), r + 1, 0.8)
        place(fx, whoosh(rng, 0.3, up=False, gain=0.5), r + 4)
        for k in range(6):          # ijs dat aangroeit: korte heldere tikjes
            place(fx, tink(rng), r + 6 + k * 3, 0.5)
        for f in range(r + 30, total - 20, 22):
            place(fx, heartbeat(rng), f, 0.9)
    elif gag == "krimpen":
        place(voice, ehm_voc("gulp", rng), r + 1, 0.9)
        for k in range(8):          # steeds hoger piepje bij het krimpen
            place(fx, soft_boing(rng, 1.0 + k * 0.12), r + 6 + k * 12, 0.5)
        place(voice, ehm_voc("whimper", rng), r + 100, 0.6)
    else:  # zweten
        place(voice, ehm_voc("gulp", rng), r + 1, 0.9)
        for f in range(r + 8, total - 6, 5):
            place(fx, pop(rng, 10 + rng.uniform(-2, 2)), f, 0.25)   # druppels
        place(voice, ehm_voc("whimper", rng), r + 70, 0.6)
    place(fx, pop(rng, 8), r + 28, 0.7)                              # de roep
    return _ducked(buf, voice, fx, [(line["at"], line["end"])])


def decoder_soundtrack(d: dict, seed: int = 7) -> np.ndarray:
    """Decoder: per zin brabbelt de ander, dan een stempelklap met een dalend 'wah' of een boing, en Ehm reageert."""
    rng = np.random.RandomState(seed)
    np.random.seed(seed)
    buf = bed(d["total"], rng, party_from=d["outro"]) * 0.42
    fx = np.zeros_like(buf)
    voice = np.zeros_like(buf)
    spans = []
    reacts = ["eep", "gulp", "hm"]
    for i, p in enumerate(d["pairs"]):
        place(fx, pop(rng, -2), p["at"] - 1, 0.6)
        snd, at = babble(p["say"], p["at"], d["cast"], rng)
        place(voice, snd, at)
        spans.append((p["at"], p["end"]))
        place(fx, whoosh(rng, 0.25, up=False, gain=0.5), p["stamp"] - 6)
        place(fx, thump(rng, -2, 1.0), p["stamp"])
        place(fx, wahwah(rng) if i % 2 == 0 else boing(rng), p["stamp"] + 3, 0.6)
        place(voice, ehm_voc(reacts[i % 3], rng), p["stamp"] + 6, 0.7)
    place(fx, pop(rng, 6), d["outro"], 0.8)
    place(fx, sparkle(rng), d["outro"] + 4)
    place(voice, ehm_voc("giggle", rng), d["outro"] + 10, 0.7)
    place(fx, pop(rng, 8), d["outro"] + 12, 0.8)
    return _ducked(buf, voice, fx, spans)


def ranglijst_soundtrack(d: dict, seed: int = 7) -> np.ndarray:
    """Ranglijst: een kaartje komt omhoog (select), zoeft naar zijn rij en klapt neer; F krijgt wah-wah, S een fanfare."""
    rng = np.random.RandomState(seed)
    np.random.seed(seed)
    s_item = next(i for i in d["items"] if i["tier"] == "S")
    buf = bed(d["total"], rng, party_from=s_item["land"], quiet=[(s_item["at"] + 20, s_item["land"])]) * 0.4
    fx = np.zeros_like(buf)
    voice = np.zeros_like(buf)
    for it in d["items"]:
        place(fx, select(rng), it["at"], 0.7)
        place(fx, whoosh(rng, 0.3, up=True, gain=0.5), it["land"] - 9)
        place(fx, thump(rng, 2 if it["tier"] in "SA" else -2, 1.0), it["land"])
        tier = it["tier"]
        if tier == "F":
            place(fx, wahwah(rng), it["land"] + 3, 0.8)
            place(voice, ehm_voc("eep", rng), it["land"] + 2, 0.7)
        elif tier == "C":
            place(voice, ehm_voc("hm", rng), it["land"] + 3, 0.7)
        elif tier == "A":
            place(fx, ding(rng, 79), it["land"] + 2, 0.7)
        elif tier == "S":
            for f in range(s_item["at"] + 20, s_item["land"], 6):   # tromgeroffel naar de beste
                place(fx, snare(0.3 + 0.5 * (f - s_item["at"]) / max(1, s_item["land"] - s_item["at"]), rng), f)
            place(fx, levelup(rng), it["land"] + 2, 0.9)
            place(fx, sparkle(rng), it["land"] + 5)
            place(voice, ehm_voc("yay", rng), it["land"] + 6, 0.8)
            place(fx, applause(rng, 1.6), it["land"] + 10, 0.5)
    place(fx, pop(rng, 6), d["outro"], 0.8)
    place(voice, ehm_voc("giggle", rng), d["outro"] + 8, 0.6)
    place(fx, pop(rng, 8), d["outro"] + 14, 0.8)
    return _ducked(buf, voice, fx, [])


def vsl_soundtrack(d: dict, seed: int = 7) -> np.ndarray:
    """VSL (scripts/vsl.py): bij elk moment brabbelt de ander en hapert Ehm; stil bij "the next line"; bij het voorbeeld
    een kruis voor de foute zin en een ding voor de goede; feestelijk bed vanaf het aanbod."""
    rng = np.random.RandomState(seed)
    np.random.seed(seed)
    total, D, o = d["total"], d["demo"], d["offer"]
    buf = bed(total, rng, party_from=o["at"], quiet=[(d["turn"], D["start"])], tense_until=D["good"]["at"]) * 0.4
    fx = np.zeros_like(buf)
    voice = np.zeros_like(buf)
    spans = []
    for i, m in enumerate(d["moments"]):
        if i:
            place(fx, whoosh(rng, 0.25, up=True, gain=0.4), m["start"] - 4)
        place(fx, pop(rng, -2), m["ask"]["at"] - 1, 0.6)
        snd, at = babble(m["ask"]["text"], m["ask"]["at"], m["cast"], rng)
        place(voice, snd, at)
        snd, at = babble(m["ehm"]["text"], m["ehm"]["at"], "ehm", rng, nervous=True)
        place(voice, snd, at)
        place(voice, ehm_voc("gulp", rng), m["ehm"]["end"] + 3, 0.8)
        spans += [(m["ask"]["at"], m["ask"]["end"]), (m["ehm"]["at"], m["ehm"]["end"])]
    place(fx, thump(rng, -3, 0.9), d["turn"])
    place(fx, pop(rng, 6), d["turn2"], 0.8)
    place(voice, ehm_voc("hm", rng), d["turn2"] + 6, 0.7)
    place(fx, whoosh(rng, 0.3, up=True, gain=0.4), D["start"] - 4)
    snd, at = babble(D["ask"]["text"], D["ask"]["at"], D["cast"], rng)
    place(voice, snd, at)
    place(fx, thump(rng, -2, 0.8), D["nope"])
    place(fx, wahwah(rng), D["nope"] + 10, 0.6)
    place(fx, ding(rng), D["good"]["at"] - 2, 0.7)
    snd, at = babble(D["good"]["text"], D["good"]["at"], "ehm", rng)
    place(voice, snd, at)
    snd, at = babble(D["twist"]["text"], D["twist"]["at"], D["cast"], rng)
    place(voice, snd, at)
    place(fx, levelup(rng), D["twist"]["end"] + 2, 0.8)
    spans += [(D["ask"]["at"], D["ask"]["end"]), (D["good"]["at"], D["good"]["end"]), (D["twist"]["at"], D["twist"]["end"])]
    place(fx, sparkle(rng), o["at"] + 6)
    for f in o["chipsAt"]:
        place(fx, pop(rng, 4), f, 0.7)
    place(fx, pop(rng, 8), d["cta"], 0.8)
    place(voice, ehm_voc("giggle", rng), d["cta"] + 6, 0.6)
    return _ducked(buf, voice, fx, spans)


def uitleg_soundtrack(d: dict, seed: int = 7) -> np.ndarray:
    """Waarom het vastloopt (scripts/uitleg.py): de opgenomen stem (d["vo"], in remotion/public) met een zacht bed dat
    wegduikt zolang er gesproken wordt, een plop bij elk kaartje en een level-up na de laatste goede zin."""
    rng = np.random.RandomState(seed)
    np.random.seed(seed)
    total = d["total"]
    sr, vo = wavfile.read(Path(__file__).resolve().parent.parent / "remotion" / "public" / d["vo"])
    vo = vo.astype(np.float64) / (32768.0 if vo.dtype == np.int16 else 1.0)
    if vo.ndim > 1:
        vo = vo.mean(axis=1)
    if sr != SR:
        from scipy import signal
        vo = signal.resample_poly(vo, SR, sr)
    vo = vo / max(1e-9, np.max(np.abs(vo))) * 0.9
    buf = bed(total, rng) * 0.22
    voice = np.zeros_like(buf)
    voice[: min(len(voice), len(vo))] = vo[: len(voice)]
    fx = np.zeros_like(buf)
    goods = [s for s in d["segments"] if s["kind"] == "good"]
    for s in d["segments"]:
        if s["kind"] == "not":
            place(fx, thump(rng, -3, 0.8), s["at"], 0.6)
        elif s["kind"] == "good":
            place(fx, ding(rng), s["at"] - 3, 0.5)
    place(fx, levelup(rng), goods[-1]["end"] + 4, 0.6)
    spans = [(s["at"], s["end"]) for s in d["segments"]]
    return _ducked(buf, voice, fx * 0.7, spans)


def soundtrack_for(d: dict, seed: int) -> np.ndarray:
    """De juiste geluidsband bij de soort scène."""
    kind = d.get("kind")
    if kind == "pov":
        return pov_soundtrack(d, seed)
    if kind == "decoder":
        return decoder_soundtrack(d, seed)
    if kind == "ranglijst":
        return ranglijst_soundtrack(d, seed)
    if kind == "vsl":
        return vsl_soundtrack(d, seed)
    if kind == "uitleg":
        return uitleg_soundtrack(d, seed)
    if d.get("coldOpen"):
        rng = np.random.RandomState(seed + 1)
        base = soundtrack(d, seed)
        return np.concatenate([cold_open(d, base, rng), base])[: idx(d["total"])]
    kind = d.get("kind")
    if kind == "verteller":
        return verteller_soundtrack(d, seed)
    return quiz_soundtrack(d, seed) if kind == "quiz" else duel_soundtrack(d, seed) if kind == "duel" else soundtrack(d, seed)


def write(mix: np.ndarray, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    # stereo: een klein beetje breedte via vertraging op één kanaal
    right = np.concatenate([np.zeros(12), mix[:-12]])
    st = np.stack([mix, mix * 0.6 + right * 0.4], axis=1)
    st /= max(1e-9, np.max(np.abs(st))) / 0.8
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wavfile.write(tmp.name, SR, (st * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-af", "loudnorm=I=-14:TP=-1:LRA=11",
                        "-ar", str(SR), str(dest)], check=True)


if __name__ == "__main__":
    data = json.loads(Path(sys.argv[1]).read_text())
    import zlib
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else zlib.crc32(data["slug"].encode()) % 100000  # elke scène klinkt anders
    write(soundtrack_for(data, seed), Path(sys.argv[2]))
    print(sys.argv[2])
