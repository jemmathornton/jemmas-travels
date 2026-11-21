"""Shared test setup: a throwaway copy of the site for each test, so tests never touch her real files.

A sandbox is a temporary folder laid out like the project: data/ copied (or empty), imports/ and the big unchanging
site files (world.js, fonts, photos) hard-linked, and everything the build writes (index.html, js/data.js) copied.
The scripts in tools/ are run with TRAVELS_ROOT pointing at the sandbox.
"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REAL = os.path.dirname(HERE)
TOOLS = os.path.join(REAL, "tools")
PYTHON = sys.executable
NODE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".tools", "node", "node.exe")   # shared in Jemma's Journals, the parent folder (21 Nov)


def _link_or_copy(src, dst):
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def _copy_tree(src, dst, link=()):
    os.makedirs(dst, exist_ok=True)
    for name in os.listdir(src):
        s, d = os.path.join(src, name), os.path.join(dst, name)
        if os.path.isdir(s):
            _copy_tree(s, d, link)
        elif name in link or s.endswith((".woff2", ".jpg", ".jpeg", ".png", ".webp")):
            _link_or_copy(s, d)
        else:
            shutil.copy2(s, d)


class Sandbox:
    """with Sandbox() as box: ...  -> a project copy at box.root, removed afterwards. data=False: empty data/."""

    def __init__(self, data=True):
        self.data = data

    def __enter__(self):
        self.root = tempfile.mkdtemp(prefix="travels-test-")
        if self.data:
            shutil.copytree(os.path.join(REAL, "data"), os.path.join(self.root, "data"))
        else:
            os.makedirs(os.path.join(self.root, "data", "posts"))
        _copy_tree(os.path.join(REAL, "imports"), os.path.join(self.root, "imports"), link=("countries-50m.json", "countries-110m.json"))
        _copy_tree(os.path.join(REAL, "site"), os.path.join(self.root, "site"), link=("world.js",))
        return self

    def __exit__(self, *a):
        shutil.rmtree(self.root, ignore_errors=True)

    def path(self, *p):
        return os.path.join(self.root, *p)

    def write_json(self, rel, obj):
        with open(self.path(rel), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)

    def write(self, rel, text):
        os.makedirs(os.path.dirname(self.path(rel)), exist_ok=True)
        with open(self.path(rel), "w", encoding="utf-8") as f:
            f.write(text)

    def read(self, rel):
        with open(self.path(rel), encoding="utf-8") as f:
            return f.read()


def run_tool(box, name, *args):
    """Run tools/<name>.py against the sandbox; returns CompletedProcess (stdout/stderr text)."""
    env = dict(os.environ, TRAVELS_ROOT=box.root, PYTHONUTF8="1")
    return subprocess.run([PYTHON, "-X", "utf8", os.path.join(TOOLS, name + ".py"), *args], env=env,
                          capture_output=True, text=True, encoding="utf-8")


def load(box, name):
    """Import tools/<name>.py fresh, with TRAVELS_ROOT set to the sandbox (for calling its functions directly)."""
    old = os.environ.get("TRAVELS_ROOT")
    os.environ["TRAVELS_ROOT"] = box.root
    try:
        spec = importlib.util.spec_from_file_location(f"{name}_under_test", os.path.join(TOOLS, name + ".py"))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    finally:
        if old is None:
            os.environ.pop("TRAVELS_ROOT", None)
        else:
            os.environ["TRAVELS_ROOT"] = old


def data_js(box):
    """The TRAVELS object the build wrote into the sandbox's site/js/data.js."""
    text = box.read("site/js/data.js")
    return json.loads(text[text.index("{"): text.rindex("}") + 1])
