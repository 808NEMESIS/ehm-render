"""Engelse stem voor de regels van een scène (proef "stem-en", Sami 13 nov): Kokoro-82M via kokoro-onnx.

Waarom deze: gratis, draait op de CPU (GitHub Actions), en de licenties staan commercieel gebruik toe:
  model en stemmen  Kokoro-82M, Apache-2.0 (huggingface.co/hexgrad/Kokoro-82M, gelezen 13 nov 2026; getraind op
                    rechtenvrije en vrij gelicentieerde audio, geen stemklonen)
  bibliotheek       kokoro-onnx, MIT (github.com/thewh1teagle/kokoro-onnx)
  uitspraak         espeak-ng (GPL-3) als los programma; de licentie raakt alleen de software, niet de audio
De modelbestanden (kokoro-v1.0.onnx, voices-v1.0.bin) staan in KOKORO_DIR (standaard ~/.cache/kokoro); ze komen van de
releases van kokoro-onnx (model-files-v1.0). Ze staan niet in de repo.

Elke regel moet passen in de tijd die de scène ervoor heeft (tot de volgende regel of mijlpaal). Is de stem te lang,
dan spreekt hij iets sneller, tot MAX_SPEED. Past het dan nog niet, dan faalt de render: liever geen video dan een
stem die over de volgende regel heen praat.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import numpy as np
from scipy import signal

FPS = 30
BASE_SPEED = 1.05
MAX_SPEED = 1.35

# Per personage één vaste stem, zodat de kijker ze herkent. Ehm (de mascotte) warm en licht; de anderen duidelijk anders.
VOICES = {"ehm": "af_heart", "baas": "am_michael", "collega": "af_sarah", "kennis": "am_echo",
          "verteller": "bm_george"}  # de verteller (vorm video_verteller): rustig, Brits, anders dan iedereen in de scène


class StemFout(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _model():
    from kokoro_onnx import Kokoro  # pas laden als er echt een stem nodig is

    d = Path(os.environ.get("KOKORO_DIR", Path.home() / ".cache" / "kokoro"))
    onnx, voices = d / "kokoro-v1.0.onnx", d / "voices-v1.0.bin"
    if not onnx.exists() or not voices.exists():
        raise StemFout(f"Kokoro-modelbestanden ontbreken in {d}")
    return Kokoro(str(onnx), str(voices))


def line(text: str, who: str, max_frames: int, sr: int) -> np.ndarray:
    """De regel ingesproken, op sample rate sr, hooguit max_frames lang. Piek 0,55 (zoals de brabbelstem)."""
    voice = VOICES.get(who, VOICES["kennis"])
    k = _model()
    speed = BASE_SPEED
    while True:
        audio, src_sr = k.create(text, voice=voice, speed=speed, lang="en-us")
        audio = _trim(np.asarray(audio, dtype=np.float64), src_sr)
        frames = len(audio) / src_sr * FPS
        if frames <= max_frames or speed >= MAX_SPEED:
            break
        speed = min(MAX_SPEED, speed * frames / max_frames * 1.02)
    if frames > max_frames:
        raise StemFout(f"stem past niet: “{text}” duurt {frames:.0f} frames, ruimte {max_frames}")
    out = signal.resample_poly(audio, sr, src_sr)
    return out / max(1e-9, np.max(np.abs(out))) * 0.55


@lru_cache(maxsize=512)
def frames(text: str, who: str) -> int:
    """Hoe lang de regel duurt op de gewone snelheid, in frames (voor de tijdlijn van de scène)."""
    audio, src_sr = _model().create(text, voice=VOICES.get(who, VOICES["kennis"]), speed=BASE_SPEED, lang="en-us")
    return int(np.ceil(len(_trim(np.asarray(audio, dtype=np.float64), src_sr)) / src_sr * FPS))


def _trim(x: np.ndarray, sr: int, thr: float = 0.01) -> np.ndarray:
    """Stilte voor en na weghalen (Kokoro laat wat ruimte), met 30 ms marge."""
    idx = np.where(np.abs(x) > thr * np.max(np.abs(x)))[0]
    if not len(idx):
        return x
    pad = int(0.03 * sr)
    return x[max(0, idx[0] - pad): idx[-1] + pad]
