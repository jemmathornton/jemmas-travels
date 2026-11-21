"""The map shapes (site/js/world.js, made by tools/make_world.py from Natural Earth)."""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from support import REAL, Sandbox, run_tool  # noqa: E402


def world(path):
    text = open(path, encoding="utf-8").read()
    return json.loads(text[text.index("{"): text.rindex("}") + 1])


class World(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = world(os.path.join(REAL, "site", "js", "world.js"))
        cls.countries = json.load(open(os.path.join(REAL, "data", "countries.json"), encoding="utf-8"))["countries"]

    def test_every_country_on_her_trips_has_a_shape(self):
        for code, c in self.countries.items():
            for set_ in ("lo", "hi"):
                self.assertIn(c["iso"], self.w[set_], f"{code} ({c['iso']}) missing from {set_}")

    def test_no_ring_jumps_across_the_map(self):
        """Rings over the 180° line (Russia, Fiji) are made continuous, so no stripe is drawn across the world."""
        for set_ in ("lo", "hi"):
            for cid, (name, rings) in self.w[set_].items():
                for r in rings:
                    lons = r[0::2]
                    jumps = [abs(a - b) for a, b in zip(lons, lons[1:])]
                    self.assertLess(max(jumps or [0]), 180, f"{name} ({set_}) has a ring that jumps across the map")

    def test_antarctica_left_out(self):
        self.assertNotIn("010", self.w["lo"])
        self.assertNotIn("010", self.w["hi"])

    def test_new_zealand_and_tierra_del_fuego_present(self):
        nz = self.w["lo"]["554"][1]
        self.assertTrue(any(-47 < r[1] < -34 for r in nz))
        south = min(min(r[1::2]) for r in self.w["lo"]["032"][1])
        self.assertLess(south, -54, "Argentina should reach Tierra del Fuego")

    def test_world_js_is_what_make_world_makes(self):
        with Sandbox() as box:
            r = run_tool(box, "make_world")
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(world(box.path("site", "js", "world.js")), self.w, "world.js is out of date: run tools/make_world.py")
            self.assertTrue(os.path.exists(box.path("site", "js", "LICENSE-world-atlas.txt")))


if __name__ == "__main__":
    unittest.main()
