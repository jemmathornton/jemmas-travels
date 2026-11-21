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


def free_port():
    import socket
    with socket.socket() as so:
        so.bind(("127.0.0.1", 0)); return so.getsockname()[1]


def wait_for(url, seconds=20):
    import time, urllib.request
    end = time.time() + seconds
    while time.time() < end:
        try:
            urllib.request.urlopen(url, timeout=1); return
        except Exception:  # noqa: BLE001
            time.sleep(0.2)
    raise RuntimeError("the local server didn’t start")


def results(suite):
    """Run the suite once (all its tests), and remember the answers."""
    if suite in _cache:
        return _cache[suite]
    flt = os.environ.get("TRAVELS_TEST_FILTER", "")
    if flt and not any(flt.replace("_", " ").lower() in n.lower() for n in names(suite)):
        flt = ""   # the filter picks a whole class (e.g. -k WritePage), not test names: run them all
    with Sandbox() as box:
        server = None
        if suite == "write":   # the real local server, on the copy, on a spare port
            fixture_trips.install(box)
            run_tool(box, "build")
            port = free_port()
            server = subprocess.Popen([sys.executable, "-X", "utf8", os.path.join(os.path.dirname(HERE), "tools", "serve.py")],
                                      env=dict(os.environ, TRAVELS_ROOT=box.root, TRAVELS_PORT=str(port)), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            wait_for(f"http://127.0.0.1:{port}/api/ping")
            photos = []
            for i in (1, 2):
                path = box.path(f"upload-{i}.jpg"); fixture_trips.make_photo(path, 2400, 1600, (60 * i, 150, 170)); photos.append(path)
            fixture_trips.EXPECT_WRITE = {"base": f"http://127.0.0.1:{port}/", "photos": photos}
        if suite == "fixture":
            fixture_trips.install(box)
            r = run_tool(box, "build")
            if r.returncode:
                raise RuntimeError("fixture build failed: " + r.stderr)
        expect = box.path("expect.json")
        with open(expect, "w", encoding="utf-8") as f:
            json.dump(fixture_trips.EXPECT_WRITE if suite == "write" else fixture_trips.EXPECT, f)
        try:
          p = subprocess.run([NODE, RUN, box.path("site"), suite, expect, flt.replace("_", " ")], capture_output=True, text=True,
                           encoding="utf-8", timeout=1500)
        finally:
            if server:
                server.terminate(); server.wait(10)
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


for suite, cls_name in (("her", "HerSite"), ("fixture", "MadeUp"), ("write", "WritePage")):
    attrs = {}
    for n in names(suite):
        attrs["test_" + re.sub(r"[^a-z0-9]+", "_", n.lower()).strip("_")[:80]] = make(suite, n.replace("\\'", "'"))
    globals()[cls_name] = type(cls_name, (unittest.TestCase,), attrs)


if __name__ == "__main__":
    unittest.main()
