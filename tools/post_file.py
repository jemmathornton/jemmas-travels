"""Reading one post file (data/posts/<trip id>/<nn>.md): the one parser shared by tools/build.py and tools/check_data.py
(round 5 review: it was written twice and could drift).

A post is a header between --- lines ("key: value", keys in any case), then her words, a blank line between paragraphs.
"""
import re

POST = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", re.S)
# a photo marker on a line of its own ("[photo 2 right]", "[photos 3-5: caption]"), as her guide and the Write page say
MARK_LINE = re.compile(r"^\[photos?\b.*\]$", re.I)


def paragraphs(body):
    """Her words as paragraphs (a blank line between them). A photo marker on a line of its own is a paragraph of its own
    even without blank lines round it (overnight review, 23 Nov: "Lovely day.\\n[photo 2 right]\\nMore words." showed the
    marker as text, though for-jemma/post-templates.md and the Write page only ask for a line of its own)."""
    out = []
    for block in re.split(r"\n\s*\n", body.strip()):
        lines = []
        for line in block.split("\n"):
            if MARK_LINE.match(line.strip()):
                if lines:
                    out.append("\n".join(lines).strip())
                out.append(line.strip())
                lines = []
            else:
                lines.append(line)
        if "\n".join(lines).strip():
            out.append("\n".join(lines).strip())
    return [p for p in out if p]


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
    return meta, paragraphs(m.group(2))


def read_post_file(path):
    return split_post(path.read_text(encoding="utf-8"))
