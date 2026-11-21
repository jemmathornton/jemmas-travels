"""The data check and the build, on throwaway copies (her real data, and the made-up trips)."""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from support import REAL, Sandbox, data_js, load, run_tool  # noqa: E402
import fixture_trips  # noqa: E402


class RealData(unittest.TestCase):
    def test_her_data_has_no_problems(self):
        with Sandbox() as box:
            self.assertEqual(load(box, "check_data").problems(box.root), [])

    def test_site_is_up_to_date_with_data(self):
        """data.js in the real site matches what the build makes from data/ now (rebuild if this fails)."""
        with Sandbox() as box:
            r = run_tool(box, "build")
            self.assertEqual(r.returncode, 0, r.stderr)
            with open(os.path.join(REAL, "site", "js", "data.js"), encoding="utf-8") as f:
                real = f.read()
            self.assertEqual(box.read("site/js/data.js"), real, "site/js/data.js is out of date: run tools/build.py")

    def test_index_fingerprints_match_files(self):
        with Sandbox() as box:
            run_tool(box, "build")
            self.assertEqual(box.read("site/index.html"), open(os.path.join(REAL, "site", "index.html"), encoding="utf-8").read(),
                             "index.html fingerprints are stale: run tools/build.py")


class CheckData(unittest.TestCase):
    def setUp(self):
        self.box = Sandbox().__enter__()
        fixture_trips.install(self.box)
        self.check = load(self.box, "check_data")

    def tearDown(self):
        self.box.__exit__()

    def problems(self):
        return self.check.problems(self.box.root)

    def edit_trips(self, fn):
        t = json.loads(self.box.read("data/trips.json")); fn(t["trips"]); self.box.write_json("data/trips.json", t)

    def test_made_up_data_is_fine(self):
        self.assertEqual(self.problems(), [])

    def test_unknown_country(self):
        self.edit_trips(lambda ts: ts[0]["countries"].append("ZZ"))
        self.assertTrue(any("ZZ" in p for p in self.problems()))

    def test_bad_dates(self):
        for bad in ({"from": "2026-13", "to": "2026-13"}, {"from": "2026-05", "to": "2026-03"}, {"from": "2026", "to": "2026-03"}, {"from": "May 2026", "to": "May 2026"}):
            with self.subTest(bad=bad):
                fixture_trips.install(self.box)
                self.edit_trips(lambda ts: ts[1].update(bad))
                self.assertTrue(self.problems(), f"{bad} not caught")

    def test_duplicate_id(self):
        self.edit_trips(lambda ts: ts.append(dict(ts[0])))
        self.assertTrue(any("used twice" in p for p in self.problems()))

    def test_bad_place(self):
        self.edit_trips(lambda ts: ts[2].update(places=[["Paris", 248, 2]]))
        self.assertTrue(any("place" in p for p in self.problems()))

    def test_country_needs_map_code(self):
        c = json.loads(self.box.read("data/countries.json")); del c["countries"]["FR"]["iso"]; self.box.write_json("data/countries.json", c)
        self.assertTrue(any("ISO" in p for p in self.problems()))

    def test_post_for_missing_trip(self):
        self.box.write("data/posts/nowhere-2030/01.md", "---\ntitle: x\nphotos: 0\n---\nhi\n")
        self.assertTrue(any("nowhere-2030" in p for p in self.problems()))

    def test_marker_past_last_photo(self):
        self.box.write("data/posts/paris-2026/03.md", "---\ntitle: x\nphotos: 2\n---\n[photo 3 left]\n")
        self.assertTrue(any("photo 3" in p for p in self.problems()))

    def test_misspelt_marker(self):
        self.box.write("data/posts/paris-2026/03.md", "---\ntitle: x\nphotos: 2\n---\n[photo 1 lefft]\n")
        self.assertTrue(any("isn’t one" in p for p in self.problems()))

    def test_missing_photo_file(self):
        self.box.write("data/posts/paris-2026/03.md", "---\ntitle: x\nphotos: nope.jpg\n---\nhi\n")
        self.assertTrue(any("nope.jpg" in p for p in self.problems()))

    def test_bad_days_and_dates(self):
        self.box.write("data/posts/paris-2026/03.md", "---\ntitle: x\ndays: two\nphotos: 0\n---\nhi\n")
        self.box.write("data/posts/paris-2026/04.md", "---\ntitle: x\ndates: 5 March\nphotos: 0\n---\nhi\n")
        found = self.problems()
        self.assertTrue(any("03.md" in p and "days" in p for p in found))
        self.assertTrue(any("04.md" in p and "dates" in p for p in found))

    def test_placeholder_post_must_mark_everything(self):
        self.box.write("data/posts/paris-2026/03.md", "---\ntitle: [placeholder] T\nplaceholder: yes\nphotos: 1\n---\n"
                       "[placeholder] ok\n\nNot marked.\n\n[photo 1: unmarked caption]\n")
        found = [p for p in self.problems() if "03.md" in p]
        self.assertTrue(any("Not marked" in p for p in found), found)
        self.assertTrue(any("caption" in p for p in found), found)

    def test_post_without_header(self):
        self.box.write("data/posts/paris-2026/03.md", "just words\n")
        self.assertTrue(any("header" in p for p in self.problems()))


    # ---- photos must not say where they were taken (round-2 review: the repo is public; catches photos copied in by hand)
    def photo(self, name, exif_gps=False, xmp_gps=False):
        from PIL import Image
        im = Image.new("RGB", (40, 30), (90, 140, 170)); exif = Image.Exif()
        if exif_gps:
            exif[0x8825] = {1: "N", 2: (52.0, 28.0, 48.0), 3: "W", 4: (1.0, 53.0, 24.0)}
        kw = {"exif": exif}
        if xmp_gps:
            kw["xmp"] = b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="52,28.8N" exif:GPSLongitude="1,53.4W"/></rdf:RDF></x:xmpmeta>'
        path = self.box.path("site", "photos", "paris-2026", name)
        im.save(path, "JPEG", **kw)
        return path

    def test_photo_with_exif_gps_is_refused(self):
        self.photo("a.jpg", exif_gps=True)
        self.assertTrue(any("a.jpg" in p and "location" in p for p in self.problems()), self.problems())

    def test_photo_with_xmp_gps_is_refused(self):
        self.photo("b.jpg", xmp_gps=True)
        self.assertTrue(any("b.jpg" in p and "location" in p for p in self.problems()), self.problems())

    def test_photo_without_location_is_fine(self):
        self.photo("a.jpg")
        self.assertEqual(self.problems(), [])

    def test_build_refuses_photo_with_location(self):
        self.photo("c.jpg", exif_gps=True)
        r = run_tool(self.box, "build")
        self.assertNotEqual(r.returncode, 0, "the build should refuse a photo that says where it was taken")

    def test_her_photos_have_no_location(self):
        """Her real site/photos/ (checked in place, read only)."""
        self.assertEqual(self.check.photo_location_problems(REAL), [])


class Build(unittest.TestCase):
    def test_builds_made_up_trips(self):
        with Sandbox() as box:
            fixture_trips.install(box)
            r = run_tool(box, "build")
            self.assertEqual(r.returncode, 0, r.stderr)
            d = data_js(box)
            self.assertEqual(len(d["trips"]), 5)
            self.assertEqual(d["homeTown"], "Birmingham")
            post = next(p for p in d["posts"] if p["trip"] == "paris-2026" and p["slug"] == "01")
            self.assertEqual(post["photos"], ["a.jpg", "b.jpg", "c.jpg", "d.jpg"])
            self.assertEqual(post["dates"], "2026-03-05")
            self.assertEqual(post["text"][1], "[photo 1 right: Looking up]")
            self.assertFalse(post["placeholder"])
            ph = next(p for p in d["posts"] if p["trip"] == "fiji-nz-2027")
            self.assertEqual(ph["photos"], [None, None])
            self.assertTrue(ph["placeholder"])
            self.assertEqual(ph["days"], "1-3")

    def test_refuses_bad_data(self):
        with Sandbox() as box:
            fixture_trips.install(box)
            t = json.loads(box.read("data/trips.json")); t["trips"][0]["countries"] = ["ZZ"]; box.write_json("data/trips.json", t)
            before = box.read("site/js/data.js")
            r = run_tool(box, "build")
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("ZZ", r.stderr)
            self.assertEqual(box.read("site/js/data.js"), before, "a refused build must not change data.js")

    def test_stamps_fingerprints(self):
        with Sandbox() as box:
            box.write("site/js/app.js", box.read("site/js/app.js") + "\n// changed\n")
            run_tool(box, "build")
            html = box.read("site/index.html")
            import hashlib
            want = hashlib.sha1(open(box.path("site", "js", "app.js"), "rb").read()).hexdigest()[:8]
            self.assertIn(f"js/app.js?v={want}", html)
            for name in ("site.css", "js/icons.js", "js/data.js", "js/world.js", "js/map.js", "js/app.js"):
                self.assertRegex(html, rf"{name}\?v=[0-9a-f]{{8}}")

    def test_text_is_kept_word_for_word(self):
        """No rewording: paragraphs come out exactly as written (her rule: her words, word for word)."""
        with Sandbox() as box:
            fixture_trips.install(box)
            words = "It’s “quoted”, has — dashes, & ampersands, <angle> brackets and émigré accents."
            box.write("data/posts/paris-2026/03.md", f"---\ntitle: T\nphotos: 0\n---\n{words}\n\nSecond.\n")
            run_tool(box, "build")
            post = next(p for p in data_js(box)["posts"] if p["slug"] == "03")
            self.assertEqual(post["text"], [words, "Second."])


if __name__ == "__main__":
    unittest.main()
