"""Renderen met Remotion: carrousels (PNG per slide) en video's (MP4), plus een overzicht en een stilstaand beeld.

Gebruikt door scripts/carrousels.py en scripts/videos.py (lokaal) en scripts/runner.py (GitHub Actions).
De invoer is altijd de PostInput van remotion/src/data/situatie.ts, als dict.
Remotion zoekt zelf een browser; in een omgeving zonder download zet je REMOTION_BROWSER (zie remotion.config.ts).
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REMOTION = ROOT / "remotion"


def _remotion(*args: str) -> None:
    subprocess.run(["npx", "remotion", "render", *args, "--log=error"], cwd=REMOTION, check=True)


def carousel(props: dict, out: Path) -> list[Path]:
    """Rendert de slides naar out/slide-1.png … en geeft de paden terug."""
    out.mkdir(parents=True, exist_ok=True)
    props_file = out / "props.json"
    props_file.write_text(json.dumps({**props, "platform": "instagram"}, ensure_ascii=False, indent=2))
    tmp = out / "frames"
    _remotion("Carrousel", str(tmp), "--sequence", "--image-format=png", f"--props={props_file}")
    slides = []
    for i, f in enumerate(sorted(tmp.glob("*.png")), 1):
        dest = out / f"slide-{i}.png"
        f.replace(dest)
        slides.append(dest)
    tmp.rmdir()
    if len(slides) < 2:
        raise RuntimeError(f"carrousel gaf {len(slides)} slides")
    return slides


def video(props: dict, platform: str, out: Path, composition: str = "EhmVideo") -> Path:
    """Rendert de video met de oproep voor dit platform naar out/<platform>.mp4 (EhmVideo of EhmChat)."""
    out.mkdir(parents=True, exist_ok=True)
    props_file = out / f"props-{platform}.json"
    props_file.write_text(json.dumps({**props, "platform": platform}, ensure_ascii=False, indent=2))
    dest = out / f"{platform}.mp4"
    _remotion(composition, str(dest), f"--props={props_file}")
    if not dest.exists() or dest.stat().st_size < 10_000:
        raise RuntimeError(f"video {dest.name} ontbreekt of is leeg")
    return dest


def still(mp4: Path, dest: Path, seconds: float = 8.0) -> Path:
    """Het beeld op `seconds` (bij EhmVideo: de goede zin in beeld)."""
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(seconds), "-i", str(mp4), "-frames:v", "1", str(dest)],
                   check=True)
    return dest


def duration(mp4: Path) -> float:
    """Lengte van een video in seconden."""
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp4)],
                       check=True, capture_output=True, text=True)
    return float(r.stdout.strip())


def jpeg(png: Path, dest: Path | None = None) -> Path:
    """JPEG-kopie van een slide (Instagram neemt alleen JPEG). Zelfde naam met .jpg, witte achtergrond, kwaliteit 92."""
    dest = dest or png.with_suffix(".jpg")
    subprocess.run(["convert", str(png), "-background", "white", "-flatten", "-quality", "92", str(dest)], check=True)
    return dest


def overview(slides: list[Path], dest: Path) -> Path:
    """Alle slides van één carrousel in één beeld (3 per rij), om in Slack in één keer te beoordelen."""
    subprocess.run(["montage", *map(str, slides), "-tile", "3x", "-geometry", "540x675+8+8", "-background", "#FFFAF3",
                    str(dest)], check=True)
    return dest
