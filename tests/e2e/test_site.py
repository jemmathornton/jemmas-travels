"""Page tests: tests/e2e/run.js drives the site in headless Edge; each JavaScript test is its own result here.

  HerSite   her real site (a throwaway copy): every page at four widths, links, figures, maps, menu, posts, keyboard
  MadeUp    the made-up trips (tests/fixture_trips.py, built by the real build), where the answers are known exactly
"""
import json
import os
import re
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from support import HERE, NODE, Sandbox, run_tool  # noqa: E402
import fixture_trips  # noqa: E402

RUN = os.path.join(HERE, "e2e", "run.js")
_cache = {}


def results(suite):
    """Run the suite once (all its tests), and remember the answers."""
    if suite in _cache:
        return _cache[suite]
    flt = os.environ.get("TRAVELS_TEST_FILTER", "")
    with Sandbox() as box:
        if suite == "fixture":
            fixture_trips.install(box)
            r = run_tool(box, "build")
            if r.returncode:
                raise RuntimeError("fixture build failed: " + r.stderr)
        expect = box.path("expect.json")
        with open(expect, "w", encoding="utf-8") as f:
            json.dump(fixture_trips.EXPECT, f)
        p = subprocess.run([NODE, RUN, box.path("site"), suite, expect, flt.replace("_", " ")], capture_output=True, text=True,
                           encoding="utf-8", timeout=1500)
    out = {}
    for line in p.stdout.splitlines():
        if line.startswith("{"):
            r = json.loads(line)
            out[r["name"]] = r
    if not out:
        raise RuntimeError("the page tests didn’t run:\n" + p.stdout[-2000:] + p.stderr[-2000:])
    _cache[suite] = out
    return out


def names(suite):
    """Test names in run.js for a suite, in order (read from the file, so each is its own Python test)."""
    src = open(RUN, encoding="utf-8").read()
    block = src.split(f"if (SUITE === '{suite}')")[1].split("\nif (SUITE ===")[0].split("\n(async () =>")[0]
    return re.findall(r"^\s*test\('((?:[^'\\]|\\.)*)'", block, re.M)


def make(suite, name):
    def t(self):
        r = results(suite).get(name)
        if r is None:
            self.skipTest("not run (filtered)")
        if not r["ok"]:
            self.fail(r["error"])
    t.__doc__ = name
    return t


for suite, cls_name in (("her", "HerSite"), ("fixture", "MadeUp")):
    attrs = {}
    for n in names(suite):
        attrs["test_" + re.sub(r"[^a-z0-9]+", "_", n.lower()).strip("_")[:80]] = make(suite, n.replace("\\'", "'"))
    globals()[cls_name] = type(cls_name, (unittest.TestCase,), attrs)


if __name__ == "__main__":
    unittest.main()
