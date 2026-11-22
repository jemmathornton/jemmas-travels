"""Check data/ for mistakes before building: python -X utf8 tools/check_data.py  (prints problems; exit 1 if any).

Checks trips (ids, dates, countries, places), countries (names, continents, map codes) and posts (header, days or
dates, photos, photo markers pointing at photos that exist) and that no photo in site/photos/ has location data. Used by the tests too (problems() returns the list).
"""
import datetime
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_file import read_post_file  # noqa: E402  (the one post parser, shared with build.py)

ROOT = Path(os.environ.get("TRAVELS_ROOT", Path(__file__).resolve().parent.parent))
CONTINENTS = {"Europe", "Asia", "Africa", "North America", "South America", "Oceania"}
WHEN = re.compile(r"^\d{4}(-(0[1-9]|1[0-2]))?$")
DAYS = re.compile(r"^\d+(\s*-\s*\d+)?$")
DATE = r"\d{4}-\d{2}-\d{2}"
DATES = re.compile(rf"^{DATE}(\s+to\s+{DATE})?$")
MARK = re.compile(r"^\[(photos?) (\d+)(?:\s*-\s*(\d+))?((?:\s+(?:left|right|wide|tall|mosaic))*)\s*(?::\s*(.+))?\]$", re.I)
LOOKS_LIKE_MARK = re.compile(r"^\[photos?\b", re.I)


read_post = read_post_file


def days_problem(days):
    """None if days is like 3 or 2-4 (first day 1 or more, the range not backwards), else what's wrong (round 5 review)."""
    if not DAYS.match(days):
        return "should be like 3 or 2-4"
    a, _, b = days.partition("-")
    a, b = int(a), int(b or a)
    if a < 1:
        return "should start at day 1 or later"
    if b < a:
        return f"ends before it starts ({a}–{b})"
    return None


def dates_problem(dates):
    """None if dates are real calendar dates (no 31 September, no month 13) and the end isn't before the start, else what's wrong."""
    if not DATES.match(dates):
        return "should be like 2024-09-05 or 2024-09-05 to 2024-09-07"
    parts = re.split(r"\s+to\s+", dates)
    try:
        days = [datetime.date.fromisoformat(p) for p in parts]
    except ValueError:
        bad = next(p for p in parts if not _real(p))
        return f"{bad} isn’t a real date"
    if len(days) == 2 and days[1] < days[0]:
        return "the end is before the start"
    return None


def _real(s):
    try:
        datetime.date.fromisoformat(s)
        return True
    except ValueError:
        return False


PHOTO_TYPES = (".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic", ".heif", ".gif")
XMP_GPS = re.compile(rb"exif:GPS|GPS(Latitude|Longitude|Altitude|Coordinates)", re.I)


def photo_location_problems(root=ROOT):
    """Photos in site/photos/ must not say where they were taken (the repo is public): no EXIF GPS, no GPS in XMP.

    The Write page's server strips this already; this catches a photo copied in any other way."""
    photos = Path(root) / "site" / "photos"
    files = sorted(p for p in photos.rglob("*") if p.is_file() and p.suffix.lower() in PHOTO_TYPES) if photos.is_dir() else []
    if not files:
        return []
    try:
        from PIL import Image
    except ImportError:
        return ["site/photos: can’t check photos for location data (Pillow isn’t installed)"]
    out = []
    for f in files:
        where = f"site/photos/{f.relative_to(photos).as_posix()}"
        raw = f.read_bytes()
        if XMP_GPS.search(raw):
            out.append(f"{where}: has location data (GPS in its XMP); save it again without it (the Write page does this)")
            continue
        try:
            with Image.open(f) as im:
                exif = im.getexif()
                gps = 0x8825 in exif and (exif.get_ifd(0x8825) or exif.get(0x8825))
                xmp = im.info.get("xmp") or im.info.get("XML:com.adobe.xmp") or b""
        except Exception as e:  # noqa: BLE001 - an unreadable photo is a problem too
            out.append(f"{where}: can’t be read as a picture ({e})")
            continue
        if isinstance(xmp, str):
            xmp = xmp.encode("utf-8", "replace")
        if gps or XMP_GPS.search(xmp):
            out.append(f"{where}: has location data (EXIF GPS); save it again without it (the Write page does this)")
    return out


def problems(root=ROOT):
    root = Path(root)
    out = []
    try:
        trips = json.loads((root / "data" / "trips.json").read_text(encoding="utf-8"))["trips"]
        cdata = json.loads((root / "data" / "countries.json").read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001 - report anything unreadable as a problem
        return [f"data files can’t be read: {e}"]
    countries = cdata.get("countries", {})
    for code, c in countries.items():
        if not re.fullmatch(r"[A-Z]{2}", code):
            out.append(f"countries.json: {code!r} isn’t a two-letter code")
        if not c.get("name"):
            out.append(f"countries.json: {code} has no name")
        if c.get("continent") not in CONTINENTS:
            out.append(f"countries.json: {code} continent {c.get('continent')!r} isn’t one of {sorted(CONTINENTS)}")
        at = c.get("at")
        if not (isinstance(at, list) and len(at) == 2 and -90 <= at[0] <= 90 and -180 <= at[1] <= 180):
            out.append(f"countries.json: {code} map point {at!r} isn’t [lat, lon]")
        if not re.fullmatch(r"\d{3}", str(c.get("iso", ""))):
            out.append(f"countries.json: {code} needs its 3-digit ISO number (iso) for the map")
    if cdata.get("home") not in countries:
        out.append(f"countries.json: home {cdata.get('home')!r} isn’t in the list")
    if sum(cdata.get("continentTotals", {}).values()) <= 0:
        out.append("countries.json: continentTotals missing")
    ids = [t.get("id") for t in trips]
    for dup in {i for i in ids if ids.count(i) > 1}:
        out.append(f"trips.json: id {dup!r} used twice")
    for t in trips:
        tid = t.get("id", "?")
        if not re.fullmatch(r"[a-z0-9-]+", str(tid)):
            out.append(f"trips.json: id {tid!r} should be lower case letters, numbers and dashes")
        if not t.get("title"):
            out.append(f"trips.json: {tid} has no title")
        f, to = str(t.get("from", "")), str(t.get("to", ""))
        if not WHEN.match(f) or not WHEN.match(to):
            out.append(f"trips.json: {tid} from/to must be YYYY or YYYY-MM (got {f!r}, {to!r})")
        elif len(f) != len(to):
            out.append(f"trips.json: {tid} from and to should both have a month, or neither")
        elif to < f:
            out.append(f"trips.json: {tid} ends before it starts")
        if not t.get("countries"):
            out.append(f"trips.json: {tid} has no countries")
        for c in t.get("countries", []):
            if c not in countries:
                out.append(f"trips.json: {tid} country {c} isn’t in countries.json")
        if t.get("cover") and not (root / "site" / "photos" / str(tid) / t["cover"]).exists():
            out.append(f"trips.json: {tid} cover {t['cover']} isn’t in site/photos/{tid}/")
        for p in t.get("places", []) or []:
            if not (isinstance(p, list) and len(p) == 3 and isinstance(p[0], str) and -90 <= p[1] <= 90 and -180 <= p[2] <= 180):
                out.append(f"trips.json: {tid} place {p!r} should be [name, lat, lon]")
    posts = root / "data" / "posts"
    if posts.exists():
        for d in sorted(posts.iterdir()):
            if not d.is_dir():
                continue
            if d.name not in ids:
                out.append(f"posts/{d.name}: no trip with that id")
            for f in sorted(d.glob("*.md")):
                where = f"posts/{d.name}/{f.name}"
                meta, paras = read_post(f)
                if meta is None:
                    out.append(f"{where}: needs a header between --- lines")
                    continue
                if not meta.get("title"):
                    out.append(f"{where}: no title")
                why = meta.get("days") and days_problem(meta["days"])
                if why:
                    out.append(f"{where}: days {meta['days']!r} {why}")
                why = meta.get("dates") and dates_problem(meta["dates"])
                if why:
                    out.append(f"{where}: dates {meta['dates']!r} {why}")
                photos = meta.get("photos", "").strip()
                if photos.isdigit():
                    count = int(photos)
                else:
                    names = [p.strip() for p in photos.split(",") if p.strip()]
                    count = len(names)
                    for n in names:
                        if not (root / "site" / "photos" / d.name / n).exists():
                            out.append(f"{where}: photo {n} isn’t in site/photos/{d.name}/")
                if meta.get("placeholder", "").lower() in ("yes", "true"):
                    # a placeholder post: everything shown must be marked, so no made-up words pass as hers
                    for key in ("title", "place"):
                        if meta.get(key) and not meta[key].startswith("[placeholder]"):
                            out.append(f"{where}: placeholder post, but its {key} isn’t marked [placeholder]")
                    for para in paras:
                        if not LOOKS_LIKE_MARK.match(para) and not para.startswith("[placeholder]"):
                            out.append(f"{where}: placeholder post, but {para[:40]!r} isn’t marked [placeholder]")
                        m = MARK.match(para) if LOOKS_LIKE_MARK.match(para) else None
                        if m and m.group(5) and not m.group(5).startswith("[placeholder]"):
                            out.append(f"{where}: placeholder post, but the caption {m.group(5)[:30]!r} isn’t marked [placeholder]")
                for para in paras:
                    if LOOKS_LIKE_MARK.match(para):
                        m = MARK.match(para)
                        if not m:
                            out.append(f"{where}: {para[:40]!r} looks like a photo marker but isn’t one (see for-jemma/post-templates.md)")
                            continue
                        a = int(m.group(2)); b = int(m.group(3) or a)
                        if b < a or a < 1 or b > count:
                            out.append(f"{where}: {para[:40]!r} asks for photo {a}{'–' + str(b) if b != a else ''} but the post has {count}")
    out += photo_location_problems(root)
    return out


def main():
    found = problems()
    for p in found:
        print(p)
    print("data looks fine" if not found else f"{len(found)} problem(s)")
    sys.exit(1 if found else 0)


if __name__ == "__main__":
    main()
