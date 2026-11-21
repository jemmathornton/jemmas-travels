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

    def test_saves_over_http(self):
        status, out = self.post({"trip": "chile-2026", "title": "Andes", "dates": "2026-02-01", "text": "Snow."})
        self.assertEqual(status, 200, out)
        self.assertIn("dates: 2026-02-01", self.box.read(f"data/posts/chile-2026/{out['slug']}.md"))


if __name__ == "__main__":
    unittest.main()
