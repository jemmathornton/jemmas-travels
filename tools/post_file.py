"""Reading one post file (data/posts/<trip id>/<nn>.md): the one parser shared by tools/build.py and tools/check_data.py
(round 5 review: it was written twice and could drift).

A post is a header between --- lines ("key: value", keys in any case), then her words, a blank line between paragraphs.
"""
import re

POST = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", re.S)


def split_post(text):
    """(meta dict with lower-case keys, list of paragraphs), or (None, None) when there's no header."""
    m = POST.match(text)
    if not m:
        return None, None
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip().lower()] = v.strip()
    paras = [p.strip() for p in re.split(r"\n\s*\n", m.group(2).strip()) if p.strip()]
    return meta, paras


def read_post_file(path):
    return split_post(path.read_text(encoding="utf-8"))
