"""Serve the travel site at http://localhost:8041 and let its Write page save posts (her PC only).

    python -X utf8 tools/serve.py            (the preview "travels" in .claude/launch.json runs this)

Only this computer can reach it (it listens on 127.0.0.1), and only by the names localhost:<port> / 127.0.0.1:<port>: a page
elsewhere pointing its own name at this computer (DNS rebinding) gets nothing (round 3 review, as the Library's server does).
The site's pages are plain files from site/.

    GET  /family/<file>  the family's shared code (dark mode, footer, Menu drawer), from Jemma's Journals: ../site/family
         (her decision, 22 Nov: all shared code lives in Jemma's Journals and every site loads it from /family/)

    GET  /api/ping   {"ok": true}: the Write page asks this to know it can save
    POST /api/post   a new post, as JSON:
         {trip: "<id>" | "", newTrip: {title, from, to, countries: [codes]} (when trip is ""),
          title, days | dates, place, text, photos: [{name, data: "<base64>"}], cover: true (photo 1 becomes the trip's cover)}
         Saves data/posts/<trip>/<nn>.md and the photos as site/photos/<trip>/<nn>-<k>.jpg, checks the data and
         rebuilds the site. Replies {ok, url} or {ok: false, problems: [...]}: then nothing is kept, whatever went wrong
         (photos and post removed, trips.json put back byte for byte).
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
# the family's shared code, in Jemma's Journals (this project is its travels/ folder); tests point TRAVELS_FAMILY at it from a sandbox
FAMILY = Path(os.environ.get("TRAVELS_FAMILY", os.path.join(Path(__file__).resolve().parent.parent, "..", "site", "family"))).resolve()
MAX_BODY = 400_000_000       # a post with many phone photos (base64) fits; anything bigger is refused
MAX_PHOTO = 60_000_000
LONGEST = 1920
LOCK = threading.Lock()      # one save at a time, so two builds never write the site at once
sys.path.insert(0, str(TOOLS))


def slug_for(trip_dir, photo_dir=None):
    """The next post number: past every post and every photo already there (a post deleted by hand may leave its
    NN-k.jpg photos behind; a new post must never overwrite them, nor a failed save delete them)."""
    nums = [int(p.stem) for p in trip_dir.glob("*.md") if p.stem.isdigit()]
    if photo_dir is not None:
        nums += [int(m.group(1)) for p in photo_dir.glob("*.jpg") if (m := re.fullmatch(r"(\d+)-\d+", p.stem))]
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


def rollback(written, trips_file, trips_bytes, new_dirs):
    """Undo a failed save: remove the photos and post written, put trips.json back byte for byte, remove folders it made.
    Each step is tried even if an earlier one fails."""
    for f in written:
        try:
            f.unlink(missing_ok=True)
        except OSError:
            pass
    for _ in range(3):
        try:
            if trips_file.read_bytes() != trips_bytes:
                trips_file.write_bytes(trips_bytes)
            break
        except OSError:
            pass
    for d in new_dirs:
        try:
            if d.exists() and not any(d.iterdir()):
                d.rmdir()
        except OSError:
            pass


def save_post(body):
    """Save a post (and a new trip if asked). Returns (status, reply dict)."""
    import check_data
    trips_file = DATA / "trips.json"
    trips_bytes = trips_file.read_bytes()   # restored byte for byte if the save fails
    trips_doc = json.loads(trips_bytes.decode("utf-8"))
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
    photo_dir = SITE / "photos" / trip
    new_dirs = [d for d in (trip_dir, photo_dir) if not d.exists()]
    slug = slug_for(trip_dir, photo_dir)
    written = []
    try:
        names = []
        for k, ph in enumerate(photos, start=1):
            dest = photo_dir / f"{slug}-{k}.jpg"
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
    except Exception as e:  # noqa: BLE001 - any failure (bad data, a build past its time limit, a disk error): keep nothing
        rollback(written, trips_file, trips_bytes, new_dirs)
        if isinstance(e, ValueError):
            return 400, {"ok": False, "problems": [str(e)]}
        what = "the rebuild took too long" if isinstance(e, subprocess.TimeoutExpired) else f"{type(e).__name__}: {e}"
        return 500, {"ok": False, "problems": [f"Nothing was saved ({what})."]}
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

    def host_ok(self):   # only this computer's own names (round 3 review)
        port = self.server.server_address[1]
        return (self.headers.get("Host") or "").lower() in (f"localhost:{port}", f"127.0.0.1:{port}")

    def family_file(self):
        """The file for GET /family/<name>: a plain file name (letters, digits, - and _, one dot, a web file type), spelt exactly as a
        file straight inside FAMILY; None otherwise. So no folders, no "mode.js." / "mode.js%20" / "mode.js::$DATA" (Windows would
        read those as mode.js), no README.md (round 5 review: as strict as the Library's)."""
        from urllib.parse import unquote
        name = unquote(self.path.split("?", 1)[0].split("#", 1)[0][len("/family/"):])
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*\.(?:js|css|svg|png|woff2)", name):
            return None
        try:
            if name not in os.listdir(FAMILY):
                return None
        except OSError:
            return None
        f = FAMILY / name
        return f if f.is_file() else None

    def send_family(self, head_only=False):
        f = self.family_file()
        if not f:
            return self.send_error(404)
        data = f.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(str(f)))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if not head_only:
            self.wfile.write(data)

    def do_GET(self):
        if not self.host_ok():
            return self.send_error(403)
        if self.path.split("?")[0] == "/api/ping":
            return self.reply(200, {"ok": True})
        if self.path.startswith("/family/"):
            return self.send_family()
        return super().do_GET()

    def do_HEAD(self):
        if not self.host_ok():
            return self.send_error(403)
        if self.path.startswith("/family/"):
            return self.send_family(head_only=True)
        return super().do_HEAD()

    def do_POST(self):
        if not self.host_ok():
            return self.reply(403, {"ok": False, "problems": ["not from this computer’s own address"]})
        if self.path.split("?")[0] != "/api/post":
            return self.reply(404, {"ok": False, "problems": ["not here"]})
        if self.headers.get("X-Travels") != "1":
            return self.reply(403, {"ok": False, "problems": ["only the site itself can save posts"]})
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self.reply(400, {"ok": False, "problems": ["couldn’t read what was sent"]})
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


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128   # the default 5 refused some files under load (round 4 review)


def main():
    srv = Server(("127.0.0.1", PORT), Handler)
    print(f"Jemma’s Travels at http://localhost:{PORT}  (Ctrl+C to stop)", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
