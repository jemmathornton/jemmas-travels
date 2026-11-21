"""Serve the travel site at http://localhost:8041 and let its Write page save posts (her PC only).

    python -X utf8 tools/serve.py            (the preview "travels" in .claude/launch.json runs this)

Only this computer can reach it (it listens on 127.0.0.1). The site's pages are plain files from site/.

    GET  /api/ping   {"ok": true}: the Write page asks this to know it can save
    POST /api/post   a new post, as JSON:
         {trip: "<id>" | "", newTrip: {title, from, to, countries: [codes]} (when trip is ""),
          title, days | dates, place, text, photos: [{name, data: "<base64>"}], cover: true (photo 1 becomes the trip's cover)}
         Saves data/posts/<trip>/<nn>.md and the photos as site/photos/<trip>/<nn>-<k>.jpg, checks the data and
         rebuilds the site. Replies {ok, url} or {ok: false, problems: [...]} (and then nothing is kept).
POST needs the header "X-Travels: 1", which only the site itself sends, so a page from anywhere else can't write.

Photos are copied, never moved: straightened (camera rotation), at most 1920 px on the longest side, saved as JPEG with
no hidden data, so the place a photo was taken (GPS) never reaches the site (her rule).
Her words are saved exactly as typed (only line endings tidied).
"""
import base64
import http.server
import io
import json
import os
import re
import shutil
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(os.environ.get("TRAVELS_ROOT", Path(__file__).resolve().parent.parent))
TOOLS = Path(__file__).resolve().parent
SITE, DATA = ROOT / "site", ROOT / "data"
PORT = int(os.environ.get("TRAVELS_PORT", "8041"))
MAX_BODY = 400_000_000       # a post with many phone photos (base64) fits; anything bigger is refused
MAX_PHOTO = 60_000_000
LONGEST = 1920
LOCK = threading.Lock()      # one save at a time, so two builds never write the site at once
sys.path.insert(0, str(TOOLS))


def slug_for(trip_dir):
    nums = [int(p.stem) for p in trip_dir.glob("*.md") if p.stem.isdigit()]
    return f"{(max(nums) + 1) if nums else 1:02d}"


def trip_id_for(title, frm, trips):
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40] or "trip"
    tid = f"{base}-{frm[:4]}"
    ids = {t["id"] for t in trips}
    n = 2
    while tid in ids:
        tid = f"{base}-{frm[:4]}-{n}"; n += 1
    return tid


def save_photo(data, dest):
    """Decode, straighten, shrink and save one photo as JPEG with no hidden data (no GPS). Returns its size."""
    from PIL import Image, ImageOps
    raw = base64.b64decode(data.split(",", 1)[-1], validate=False)
    if len(raw) > MAX_PHOTO:
        raise ValueError("a photo is too big (over 60 MB)")
    with Image.open(io.BytesIO(raw)) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.thumbnail((LONGEST, LONGEST))
        icc = im.info.get("icc_profile")
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "JPEG", quality=86, optimize=True, progressive=True, **({"icc_profile": icc} if icc else {}))
        return im.size


def dump_trips(doc):
    """trips.json in its hand-written layout: one line per trip."""
    rest = {k: v for k, v in doc.items() if k != "trips"}
    head = "".join(f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},\n" for k, v in rest.items())
    lines = ",\n".join("    " + json.dumps(t, ensure_ascii=False) for t in doc["trips"])
    return "{\n" + head + '  "trips": [\n' + lines + "\n  ]\n}\n"


def one_line(s):
    return re.sub(r"[\r\n]+", " ", str(s or "")).strip()


def save_post(body):
    """Save a post (and a new trip if asked). Returns (status, reply dict)."""
    import check_data
    trips_file = DATA / "trips.json"
    trips_text = trips_file.read_text(encoding="utf-8")
    trips_doc = json.loads(trips_text)
    trips = trips_doc["trips"]
    countries = json.loads((DATA / "countries.json").read_text(encoding="utf-8"))["countries"]
    problems = []
    trip = one_line(body.get("trip"))
    new = body.get("newTrip") if not trip else None
    if not trip:
        if not isinstance(new, dict) or not one_line(new.get("title")):
            return 400, {"ok": False, "problems": ["Choose a trip, or give the new trip a title."]}
        frm, to = one_line(new.get("from")), one_line(new.get("to") or new.get("from"))
        codes = [c for c in new.get("countries", []) if isinstance(c, str)]
        unknown = [c for c in codes if c not in countries]
        if unknown or not codes:
            return 400, {"ok": False, "problems": [f"Countries not on the list yet: {', '.join(unknown)}" if unknown else "Pick at least one country for the new trip."]}
        trip = trip_id_for(one_line(new["title"]), frm, trips)
        new_trip = {"id": trip, "title": one_line(new["title"]), "from": frm, "to": to, "countries": codes}
    elif trip not in {t["id"] for t in trips}:
        return 400, {"ok": False, "problems": [f"No trip called {trip}."]}
    else:
        new_trip = None
    title = one_line(body.get("title"))
    if not title:
        problems.append("The post needs a title.")
    days, dates = one_line(body.get("days")).replace("–", "-"), one_line(body.get("dates"))
    text = str(body.get("text") or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    photos = body.get("photos") or []
    if not isinstance(photos, list) or len(photos) > 60:
        problems.append("Up to 60 photos per post.")
    if problems:
        return 400, {"ok": False, "problems": problems}

    trip_dir = DATA / "posts" / trip
    new_dir = not trip_dir.exists()
    slug = slug_for(trip_dir)
    written = []
    try:
        names = []
        for k, ph in enumerate(photos, start=1):
            dest = SITE / "photos" / trip / f"{slug}-{k}.jpg"
            try:
                save_photo(ph.get("data", ""), dest)
            except Exception as e:  # noqa: BLE001 - say which photo, keep going no further
                raise ValueError(f"Photo {k} ({one_line(ph.get('name'))}) couldn’t be read: {e}")
            written.append(dest); names.append(dest.name)
        head = [f"title: {title}"]
        if dates:
            head.append(f"dates: {dates}")
        elif days:
            head.append(f"days: {days}")
        if one_line(body.get("place")):
            head.append(f"place: {one_line(body.get('place'))}")
        head.append(f"photos: {', '.join(names) if names else 0}")
        trip_dir.mkdir(parents=True, exist_ok=True)
        md = trip_dir / f"{slug}.md"
        md.write_text("---\n" + "\n".join(head) + "\n---\n" + text + "\n", encoding="utf-8")
        written.append(md)
        if new_trip:
            trips.append(new_trip)
        if body.get("cover") is True and names:   # "use photo 1 as the trip's cover picture"
            next(t for t in trips if t["id"] == trip)["cover"] = names[0]
        if new_trip or (body.get("cover") is True and names):
            trips_file.write_text(dump_trips(trips_doc), encoding="utf-8")
        found = check_data.problems(ROOT)
        if found:
            raise ValueError("; ".join(found))
        r = subprocess.run([sys.executable, "-X", "utf8", str(TOOLS / "build.py")], cwd=ROOT, capture_output=True, text=True,
                           encoding="utf-8", env=dict(os.environ, TRAVELS_ROOT=str(ROOT)), timeout=300)
        if r.returncode:
            raise ValueError("the site couldn’t be rebuilt: " + (r.stderr or r.stdout)[-400:])
    except ValueError as e:
        for f in written:
            f.unlink(missing_ok=True)
        trips_file.write_text(trips_text, encoding="utf-8")   # exactly as it was
        for d in ([trip_dir] if new_dir else []) + [SITE / "photos" / trip]:
            if d.exists() and not any(d.iterdir()):
                d.rmdir()
        return 400, {"ok": False, "problems": [str(e)]}
    return 200, {"ok": True, "trip": trip, "slug": slug, "url": f"#/trip/{trip}/{slug}"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(SITE), **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def reply(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/ping":
            return self.reply(200, {"ok": True})
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/post":
            return self.reply(404, {"ok": False, "problems": ["not here"]})
        if self.headers.get("X-Travels") != "1":
            return self.reply(403, {"ok": False, "problems": ["only the site itself can save posts"]})
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BODY:
            return self.reply(413, {"ok": False, "problems": ["too much to save at once"]})
        try:
            body = json.loads(self.rfile.read(n).decode("utf-8"))
            if not isinstance(body, dict):
                raise ValueError
        except Exception:  # noqa: BLE001
            return self.reply(400, {"ok": False, "problems": ["couldn’t read what was sent"]})
        with LOCK:
            status, out = save_post(body)
        self.reply(status, out)


def main():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Jemma’s Travels at http://localhost:{PORT}  (Ctrl+C to stop)", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
