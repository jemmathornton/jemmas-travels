"""The local server behind the Write page (tools/serve.py): saving posts and photos, on throwaway copies."""
import base64
import io
import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from support import Sandbox, data_js, load  # noqa: E402
import fixture_trips  # noqa: E402
from PIL import Image  # noqa: E402


def photo_b64(w=3000, h=2000, gps=True, rotate=False):
    """A JPEG like a phone's: with a GPS position and (optionally) 'turn me 90°' in its hidden data."""
    im = Image.new("RGB", (w, h), (90, 140, 170))
    exif = Image.Exif()
    if gps:
        exif[0x8825] = {1: "N", 2: (52.0, 28.0, 48.0), 3: "W", 4: (1.0, 53.0, 24.0)}   # Birmingham
    if rotate:
        exif[0x0112] = 6   # the camera was held sideways
    buf = io.BytesIO(); im.save(buf, "JPEG", exif=exif); return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


class Saving(unittest.TestCase):
    def setUp(self):
        self.box = Sandbox().__enter__()
        fixture_trips.install(self.box)
        self.serve = load(self.box, "serve")

    def tearDown(self):
        self.box.__exit__()

    def test_post_with_photos_saved_rebuilt_and_private(self):
        words = "First day.\n\nIt’s “lovely” — & <warm>.\n\n[photo 1 right: The harbour]\n\nLast bit."
        status, out = self.serve.save_post({"trip": "paris-2026", "title": "Harbour day", "days": "3–4", "place": "Nice",
                                            "text": words, "photos": [{"name": "a.jpg", "data": photo_b64(rotate=True)}, {"name": "b.jpg", "data": photo_b64(gps=False)}]})
        self.assertEqual(status, 200, out)
        self.assertEqual(out["url"], "#/trip/paris-2026/03")
        md = self.box.read("data/posts/paris-2026/03.md")
        self.assertIn("days: 3-4", md)
        self.assertIn("photos: 03-1.jpg, 03-2.jpg", md)
        self.assertTrue(md.endswith(words + "\n"), "her words must be saved exactly")
        with Image.open(self.box.path("site", "photos", "paris-2026", "03-1.jpg")) as im:
            self.assertEqual(max(im.size), 1920, "shrunk to 1920 on the longest side")
            self.assertEqual(im.size, (1280, 1920), "turned upright (the camera was sideways)")
            exif = im.getexif()
            self.assertNotIn(0x8825, exif, "where it was taken must be gone")
            self.assertNotIn(0x0112, exif)
        post = next(p for p in data_js(self.box)["posts"] if p["trip"] == "paris-2026" and p["slug"] == "03")
        self.assertEqual(post["title"], "Harbour day")

    def test_cover_from_photo_1(self):
        status, out = self.serve.save_post({"trip": "chile-2026", "title": "Andes", "text": "x", "cover": True,
                                            "photos": [{"name": "a.jpg", "data": photo_b64(gps=False)}]})
        self.assertEqual(status, 200, out)
        t = next(t for t in json.loads(self.box.read("data/trips.json"))["trips"] if t["id"] == "chile-2026")
        self.assertEqual(t["cover"], f"{out['slug']}-1.jpg")

    def test_new_trip(self):
        status, out = self.serve.save_post({"trip": "", "newTrip": {"title": "Lake & Hills", "from": "2027-05", "to": "2027-06", "countries": ["IT", "FR"]},
                                            "title": "Arrival", "text": "Hello.", "photos": []})
        self.assertEqual(status, 200, out)
        trips = json.loads(self.box.read("data/trips.json"))["trips"]
        t = next(t for t in trips if t["id"] == out["trip"])
        self.assertEqual((t["title"], t["from"], t["to"], t["countries"]), ("Lake & Hills", "2027-05", "2027-06", ["IT", "FR"]))
        self.assertTrue(out["trip"].startswith("lake-hills-2027"))
        self.assertIn(out["trip"], [x["id"] for x in data_js(self.box)["trips"]])

    def test_problems_keep_nothing(self):
        before = (self.box.read("data/trips.json"), sorted(os.listdir(self.box.path("data", "posts"))))
        status, out = self.serve.save_post({"trip": "", "newTrip": {"title": "Bad", "from": "2027-05", "to": "2027-05", "countries": ["IT"]},
                                            "title": "x", "text": "[photo 3 left]", "photos": [{"name": "a.jpg", "data": photo_b64()}]})
        self.assertEqual(status, 400)
        self.assertTrue(any("photo 3" in p for p in out["problems"]), out)
        self.assertEqual((self.box.read("data/trips.json"), sorted(os.listdir(self.box.path("data", "posts")))), before)
        self.assertFalse(any(f.startswith("01-") for d in os.listdir(self.box.path("site", "photos")) for f in os.listdir(self.box.path("site", "photos", d))))

    def snapshot(self):
        """Every file under data/ and site/photos/ with its exact bytes, and every folder."""
        out = {}
        for top in ("data", os.path.join("site", "photos")):
            for d, dirs, files in os.walk(self.box.path(top)):
                out[os.path.relpath(d, self.box.root) + os.sep] = None
                for f in files:
                    with open(os.path.join(d, f), "rb") as fh:
                        out[os.path.relpath(os.path.join(d, f), self.box.root)] = fh.read()
        return out

    def test_any_failure_keeps_nothing(self):
        """round 5 review: not only ValueError: a build past its time limit, a disk error, any other exception"""
        import subprocess
        from pathlib import Path
        from unittest import mock
        # trips.json with Windows line endings, so "put back" has to be byte for byte, not just the same text
        with open(self.box.path("data", "trips.json"), "rb") as f:
            raw = f.read()
        with open(self.box.path("data", "trips.json"), "wb") as f:
            f.write(raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
        import check_data
        real_write = Path.write_text

        def disk_error_on(name):
            def fake(path, *a, **k):
                if path.name == name:
                    raise OSError(28, "No space left on device")
                return real_write(path, *a, **k)
            return mock.patch.object(Path, "write_text", fake)

        failures = {
            "build timed out": mock.patch.object(self.serve.subprocess, "run", side_effect=subprocess.TimeoutExpired("build.py", 300)),
            "disk error writing the post": disk_error_on("01.md"),
            "disk error writing trips.json": disk_error_on("trips.json"),
            "unexpected error in the check": mock.patch.object(check_data, "problems", side_effect=KeyError("boom")),
        }
        for why, patch in failures.items():
            with self.subTest(why=why):
                before = self.snapshot()
                with patch:
                    status, out = self.serve.save_post({"trip": "", "newTrip": {"title": "Lake", "from": "2027-05", "to": "2027-05", "countries": ["IT"]},
                                                        "title": "x", "text": "Words.", "cover": True,
                                                        "photos": [{"name": "a.jpg", "data": photo_b64(400, 300)}, {"name": "b.jpg", "data": photo_b64(400, 300)}]})
                self.assertEqual(status, 500, out)
                self.assertFalse(out["ok"]); self.assertTrue(out["problems"][0].startswith("Nothing was saved"), out)
                after = self.snapshot()
                self.assertEqual(sorted(after), sorted(before), "files or folders left behind / lost")
                self.assertEqual(after, before, "a file changed (trips.json must be put back byte for byte)")
        # and a normal save still works afterwards
        status, out = self.serve.save_post({"trip": "chile-2026", "title": "Andes", "text": "x"})
        self.assertEqual(status, 200, out)

    def test_post_number_never_reuses_left_photos(self):
        """round 5 review: her last post's .md deleted by hand, its photos left: the next post gets a new number"""
        status, out = self.serve.save_post({"trip": "chile-2026", "title": "One", "text": "x", "photos": [{"name": "a.jpg", "data": photo_b64(400, 300)}]})
        self.assertEqual((status, out["slug"]), (200, "01"), out)
        os.remove(self.box.path("data", "posts", "chile-2026", "01.md"))
        with open(self.box.path("site", "photos", "chile-2026", "01-1.jpg"), "rb") as f:
            kept = f.read()
        status, out = self.serve.save_post({"trip": "chile-2026", "title": "Two", "text": "[photo 9]", "photos": [{"name": "b.jpg", "data": photo_b64(400, 300)}]})
        self.assertEqual(status, 400, out)   # fails (marker past the last photo) ...
        with open(self.box.path("site", "photos", "chile-2026", "01-1.jpg"), "rb") as f:
            self.assertEqual(f.read(), kept, "... and the photo left behind is untouched")
        status, out = self.serve.save_post({"trip": "chile-2026", "title": "Two", "text": "x", "photos": [{"name": "b.jpg", "data": photo_b64(400, 300)}]})
        self.assertEqual((status, out["slug"]), (200, "02"), out)

    def test_refusals(self):
        for body, why in [({"trip": "nowhere", "title": "x"}, "No trip"), ({"trip": "paris-2026", "title": ""}, "title"),
                          ({"trip": "", "newTrip": {"title": "T", "from": "2027-01", "countries": ["ZZ"]}, "title": "x"}, "ZZ"),
                          ({"trip": "paris-2026", "title": "x", "photos": [{"name": "n.jpg", "data": "bm90IGEgcGhvdG8="}]}, "Photo 1")]:
            with self.subTest(why=why):
                status, out = self.serve.save_post(body)
                self.assertEqual(status, 400); self.assertTrue(any(why in p for p in out["problems"]), out)


class Http(unittest.TestCase):
    """The server itself: only this site may save (header), pages are served."""
    @classmethod
    def setUpClass(cls):
        cls.box = Sandbox().__enter__()
        fixture_trips.install(cls.box)
        serve = load(cls.box, "serve")
        import http.server
        cls.srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), serve.Handler)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.srv.server_address[1]}/"

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown(); cls.box.__exit__()

    def post(self, body, header=True):
        req = urllib.request.Request(self.base + "api/post", data=json.dumps(body).encode(), method="POST",
                                     headers={"Content-Type": "application/json", **({"X-Travels": "1"} if header else {})})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_ping_and_pages(self):
        with urllib.request.urlopen(self.base + "api/ping") as r:
            self.assertEqual(json.loads(r.read()), {"ok": True})
        with urllib.request.urlopen(self.base) as r:
            self.assertIn("Jemma’s Travels", r.read().decode("utf-8"))

    def test_needs_the_sites_header(self):
        status, out = self.post({"trip": "paris-2026", "title": "x"}, header=False)
        self.assertEqual(status, 403)

    def get(self, path, host=None):
        req = urllib.request.Request(self.base + path, headers={"Host": host} if host else {})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, r.read(), r.headers.get("Content-Type", "")
        except urllib.error.HTTPError as e:
            return e.code, e.read(), e.headers.get("Content-Type", "")

    def test_only_this_computers_own_names(self):
        """round 3 review: a page elsewhere pointing its own name at this computer (DNS rebinding) gets nothing"""
        port = self.srv.server_address[1]
        for host in (f"localhost:{port}", f"127.0.0.1:{port}"):
            self.assertEqual(self.get("api/ping", host)[0], 200, host)
        for host in ("evil.example", f"evil.example:{port}", "localhost:1", f"localhost.evil.example:{port}"):
            self.assertEqual(self.get("api/ping", host)[0], 403, host)
            self.assertEqual(self.get("", host)[0], 403, host)
        req = urllib.request.Request(self.base + "api/post", data=b'{"trip": "chile-2026", "title": "x"}', method="POST",
                                     headers={"Content-Type": "application/json", "X-Travels": "1", "Host": "evil.example"})
        with self.assertRaises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(req)
        self.assertEqual(e.exception.code, 403)

    def test_family_shared_code(self):
        """/family/ serves Jemma's Journals' shared code (site/family/), and nothing outside it"""
        for name, kind in (("mode.js", "javascript"), ("family.js", "javascript"), ("family.css", "css")):
            status, body, ctype = self.get("family/" + name)
            self.assertEqual(status, 200, name); self.assertIn(kind, ctype); self.assertIn(b"Jemma", body)
        for bad in ("family/", "family/nope.js", "family/../index.html", "family/%2e%2e/index.html", "family/..%2f..%2ftravels%2ftools%2fserve.py",
                    "family/..%5c..%5ctools%5cserve.py", "family//etc/passwd",
                    # round 5 review: only plain names spelt exactly (Windows reads these as mode.js), and only web files
                    "family/mode.js.", "family/mode.js%20", "family/mode.js::$DATA", "family/MODE.JS", "family/README.md", "family/mode"):
            self.assertEqual(self.get(bad)[0], 404, bad)

    def test_bad_content_length_is_400(self):
        import http.client
        c = http.client.HTTPConnection("127.0.0.1", self.srv.server_address[1], timeout=10)
        c.putrequest("POST", "/api/post"); c.putheader("X-Travels", "1"); c.putheader("Content-Length", "abc"); c.endheaders()
        r = c.getresponse(); self.assertEqual(r.status, 400); r.read(); c.close()

    def test_saves_over_http(self):
        status, out = self.post({"trip": "chile-2026", "title": "Andes", "dates": "2026-02-01", "text": "Snow."})
        self.assertEqual(status, 200, out)
        self.assertIn("dates: 2026-02-01", self.box.read(f"data/posts/chile-2026/{out['slug']}.md"))


if __name__ == "__main__":
    unittest.main()
