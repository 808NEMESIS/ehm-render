"""De render-runner: draait in GitHub Actions (.github/workflows/render.yml) en rendert posts uit Supabase.

1. Haalt render-taken op bij de Edge Function "runner" (claim), met het OIDC-token van GitHub als bewijs.
2. Rendert per post met Remotion: een carrousel (slides + overzicht) of een video (TikTok/Reels en YouTube + beeld).
3. Zet elk bestand in Storage via een ondertekende upload-URL en meldt de openbare adressen (finish).
   Carrousels krijgen ook JPEG-kopieën van de slides (Instagram neemt alleen JPEG); carrousels die al door de QA
   waren zonder JPEG, worden aan het eind van elke run bijgewerkt (jpeg_todo, jpeg_upload_url, jpeg_done).
   De database controleert de bestanden, zet de post op qa_passed en zet hem in de inbox in Slack.
Mislukt een post, dan meldt de runner dat; de taak komt later vanzelf terug.

Omgeving: RUNNER_URL, MAX_POSTS (standaard 40), RENDER_MINUTES (standaard 70: daarna geen nieuwe post meer, zodat
de timeout van de workflow (90 min) nooit midden in een render valt; sinds de eindkaart per platform rendert een video
twee keer), en in GitHub Actions ACTIONS_ID_TOKEN_REQUEST_URL/_TOKEN
(permissions: id-token: write). Lokaal testen kan met RUNNER_TOKEN in plaats van die twee.
"""
from __future__ import annotations

import json
import mimetypes
import os
import sys
import tempfile
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render  # noqa: E402

AUDIENCE = "nemesis-runner"
CHAT_COVER_BEFORE_END = 3.9  # seconden voor het eind: de oproep (3 s) plus de helft van de rust ervoor (EhmChat)


def oidc_token() -> str:
    if os.environ.get("RUNNER_TOKEN"):
        return os.environ["RUNNER_TOKEN"]
    url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    url += ("&" if "?" in url else "?") + "audience=" + urllib.parse.quote(AUDIENCE)
    req = urllib.request.Request(url, headers={"Authorization": "bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["value"]


class RunnerError(Exception):
    pass


def call(action: str, **fields) -> dict:
    """Eén verzoek aan de Edge Function; elk verzoek met een vers token (ze verlopen snel)."""
    body = json.dumps({"action": action, **fields}).encode()
    req = urllib.request.Request(os.environ["RUNNER_URL"], data=body, method="POST",
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + oidc_token()})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            msg = json.load(e).get("fout")
        except Exception:  # noqa: BLE001
            msg = None
        raise RunnerError(f"{action}: {e.code} {msg or ''}".strip()) from e


def upload(post_id: str, path: Path) -> str:
    """Zet een bestand in Storage en geeft het openbare adres."""
    u = call("upload_url", post_id=post_id, name=path.name)
    ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    req = urllib.request.Request(u["upload_url"], data=path.read_bytes(), method="PUT",
                                 headers={"Content-Type": ctype, "x-upsert": "true"})
    with urllib.request.urlopen(req, timeout=300):
        pass
    return u["public_url"]


def render_post(post: dict, work: Path) -> dict:
    """Rendert één post en zet de bestanden online. Geeft de media zoals finish_render ze verwacht."""
    props = post["content"]["props"]
    if post["format"] == "carousel":
        slides = render.carousel(props, work)
        ov = render.overview(slides, work / "overview.png")
        jpgs = [render.jpeg(s) for s in slides]
        return {"slides": [upload(post["id"], s) for s in slides], "overview": upload(post["id"], ov),
                "slides_jpg": [upload(post["id"], j) for j in jpgs]}
    if post["format"] == "video_sketch":
        tiktok = render.video(props, "tiktok", work)
        youtube = render.video(props, "youtube", work)
        thumb = render.still(tiktok, work / "thumbnail.png")
        return {"video": {"tiktok": upload(post["id"], tiktok), "youtube": upload(post["id"], youtube)},
                "thumbnail": upload(post["id"], thumb)}
    if post["format"] == "video_chat":
        tiktok = render.video(props, "tiktok", work, "EhmChat")
        youtube = render.video(props, "youtube", work, "EhmChat")
        # Omslag: het hele goede gesprek in beeld, net voor de oproep (EhmChat: oproep 3 s, daarvoor 1,8 s rust).
        cover = max(1.0, render.duration(tiktok) - CHAT_COVER_BEFORE_END)
        thumb = render.still(tiktok, work / "thumbnail.png", cover)
        return {"video": {"tiktok": upload(post["id"], tiktok), "youtube": upload(post["id"], youtube)},
                "thumbnail": upload(post["id"], thumb), "cover_ms": round(cover * 1000)}
    if post["format"] in SCENE_VIDEOS:
        # eerst de eigen geluidsband (scripts/geluid.py), dan het beeld; één video voor alle platforms
        import zlib
        import geluid
        scene = props["scene"]
        rel = f"audio/{post['id']}.wav"
        geluid.write(geluid.soundtrack_for(scene, zlib.crc32(scene["slug"].encode()) % 100000), render.REMOTION / "public" / rel)
        mp4 = render.video({"data": scene, "audio": rel}, "tiktok", work, SCENE_VIDEOS[post["format"]])
        cover = scene_cover(post["format"], scene)
        thumb = render.still(mp4, work / "thumbnail.png", cover)
        url = upload(post["id"], mp4)
        videos = {"tiktok": url, "youtube": url}
        # Een eigen eindkaart per platform (scene.sticker_by_platform, bijvoorbeeld "Comment SAY" alleen op Instagram,
        # waar de DM-route werkt): een tweede video met dezelfde geluidsband, als media.video.<platform>.
        for platform in sorted(scene.get("sticker_by_platform") or {}):
            if platform in ("tiktok", "youtube"):
                raise RunnerError(f"eindkaart per platform: {platform} is de standaardvideo, gebruik scene.sticker")
            alt = render.video({"data": scene_for(scene, platform), "audio": rel}, platform, work, SCENE_VIDEOS[post["format"]])
            videos[platform] = upload(post["id"], alt)
        return {"video": videos, "thumbnail": upload(post["id"], thumb), "cover_ms": round(cover * 1000)}
    raise RunnerError(f"vorm {post['format']} wordt niet gerenderd")


def scene_for(scene: dict, platform: str) -> dict:
    """De scène met de eindkaart voor dit platform. Is de sticker een object (escalatie: tekst met tijden), dan
    vervangt de override alleen wat hij noemt; een tekst vervangt de tekst."""
    override = (scene.get("sticker_by_platform") or {})[platform]
    base = scene.get("sticker")
    if isinstance(base, dict):
        sticker = {**base, **(override if isinstance(override, dict) else {"text": override})}
    else:
        sticker = override["text"] if isinstance(override, dict) else override
    out = {k: v for k, v in scene.items() if k != "sticker_by_platform"}
    out["sticker"] = sticker
    return out


# Scènevideo's: de vorm, de compositie in remotion/src/Root.tsx, en de omslag (in seconden) met de meeste spanning.
SCENE_VIDEOS = {"video_escalatie": "Escalatie", "video_quiz": "Quiz", "video_duel": "Duel", "video_verteller": "Verteller",
                "video_pov": "Pov", "video_decoder": "Decoder", "video_ranglijst": "Ranglijst", "video_uitleg": "Uitleg"}


def scene_cover(fmt: str, s: dict) -> float:
    if fmt == "video_quiz":       # de vraag met de drie antwoorden en de timer
        return (s["timerAt"] + 20) / 30
    if fmt == "video_duel":       # beide vakken, met de NOPE-stempel
        return (s["nope"] + 8) / 30
    if fmt == "video_verteller":  # Ehm bevroren, gedachten tollen, de vraag van de ander in beeld
        return (s["panic"] + 24) / 30
    if fmt == "video_pov":        # de grap op zijn hoogtepunt, met de roep in beeld
        return (s["react"] + 60) / 30
    if fmt == "video_decoder":    # de eerste zin met zijn vertaling
        return (s["pairs"][0]["stamp"] + 20) / 30
    if fmt == "video_ranglijst":  # het bord bijna vol, de beste nog in de hand
        return (s["items"][-1]["at"] + 20) / 30
    if fmt == "video_uitleg":     # de eerste goede zin in de groene ballon, met "Say this"
        return (next(x for x in s["segments"] if x["kind"] == "good")["at"] + 15) / 30
    return max(0.5, (s["freeze"] - 4 + s.get("coldOpen", 0)) / 30)  # escalatie: het bevroren moment


def jpeg_backlog(work: Path) -> int:
    """Carrousels die al door de QA zijn maar nog geen JPEG hebben: de PNG's ophalen, omzetten en melden.
    De database controleert dat het echt een kopie van de slides is (add_jpeg_slides)."""
    n = 0
    try:
        todo = call("jpeg_todo")["posts"]
    except RunnerError as e:  # bv. de database kent jpeg_todo nog niet: de renders zelf zijn wel gelukt
        print(f"jpeg overgeslagen: {e}")
        return 0
    for post in todo:
        try:
            urls = []
            for i, png_url in enumerate(post["slides"]):
                png = work / f"{post['id']}-{i}.png"
                with urllib.request.urlopen(png_url, timeout=120) as r:
                    png.write_bytes(r.read())
                name = png_url.rsplit("/", 1)[-1].removesuffix(".png") + ".jpg"
                jpg = render.jpeg(png, work / name)
                u = call("jpeg_upload_url", post_id=post["id"], name=name)
                req = urllib.request.Request(u["upload_url"], data=jpg.read_bytes(), method="PUT",
                                             headers={"Content-Type": "image/jpeg", "x-upsert": "true"})
                with urllib.request.urlopen(req, timeout=300):
                    pass
                urls.append(u["public_url"])
            call("jpeg_done", post_id=post["id"], urls=urls)
            n += 1
            print(f"jpeg: {post['id']}")
        except Exception as e:  # noqa: BLE001 - melden en door met de volgende
            print(f"jpeg mislukt voor {post['id']}: {e}")
    return n


def run(max_posts: int = 40, minutes: float = 70) -> dict:
    """Rendert tot max_posts posts, en begint na `minutes` minuten geen nieuwe meer. Eén taak per claim: een
    geclaimde taak die niet meer aan de beurt komt, blijft anders tot het einde van de lease liggen."""
    done = failed = 0
    deadline = time.monotonic() + minutes * 60
    while done + failed < max_posts and time.monotonic() < deadline:
        jobs = call("claim", max=1)["jobs"]
        if not jobs:
            break
        for job in jobs:
            post = job["post"]
            with tempfile.TemporaryDirectory() as tmp:
                try:
                    media = render_post(post, Path(tmp))
                    res = call("finish", job_id=job["job_id"], lease=job["lease"], post_id=post["id"], ok=True, media=media)
                    if res.get("ok"):
                        done += 1
                        print(f"klaar: {post['format']} {post['id']}")
                    else:
                        failed += 1
                        print(f"geweigerd: {post['id']}: {res.get('fout')}")
                except Exception as e:  # noqa: BLE001 - melden en doorgaan met de volgende post
                    failed += 1
                    traceback.print_exc()
                    try:
                        call("finish", job_id=job["job_id"], lease=job["lease"], post_id=post["id"], ok=False,
                             error=str(e)[:400])
                    except RunnerError as e2:
                        print(f"afronden mislukt: {e2}")
    with tempfile.TemporaryDirectory() as tmp:
        jpeg = jpeg_backlog(Path(tmp))
    print(f"klaar: {done}, mislukt: {failed}, jpeg bijgewerkt: {jpeg}")
    return {"done": done, "failed": failed}


if __name__ == "__main__":
    r = run(int(os.environ.get("MAX_POSTS") or 40), float(os.environ.get("RENDER_MINUTES") or 70))
    sys.exit(1 if r["failed"] and not r["done"] else 0)
