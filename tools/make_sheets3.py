"""Round 3 choice sheets (Old Atlas variations) from tests/variants.js shots: for-jemma/looks-3/ -> for-jemma/round-3-*.jpg."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "for-jemma" / "looks-3"
OUT = ROOT / "for-jemma"
BOLD = "C:/Windows/Fonts/segoeuib.ttf"


def label(im, text, size=40):
    pad = size + 28
    out = Image.new("RGB", (im.width, im.height + pad), "white")
    out.paste(im, (0, pad))
    ImageDraw.Draw(out).text((18, 10), text, fill="#24403E", font=ImageFont.truetype(BOLD, size))
    return out


def grid(images, cols, gap=28):
    w = max(i.width for i in images); h = max(i.height for i in images)
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols + 1) * gap, rows * h + (rows + 1) * gap), "#D9DEDC")
    for n, im in enumerate(images):
        r, c = divmod(n, cols)
        sheet.paste(im, (gap + c * (w + gap), gap + r * (h + gap)))
    return sheet


def titled(im, text):
    out = Image.new("RGB", (im.width, im.height + 100), "white")
    ImageDraw.Draw(out).text((28, 22), text, fill="#24403E", font=ImageFont.truetype(BOLD, 54))
    out.paste(im, (0, 100))
    return out


def save(im, name, width=2400):
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(OUT / name, quality=84)
    print(name, im.size)


shot = lambda n: Image.open(SHOTS / f"v-{n}.jpg").convert("RGB")
save(titled(grid([label(shot("layout-side-pale"), "1 · Sidebar, pale"), label(shot("layout-side-sea"), "2 · Sidebar, sea green"), label(shot("layout-top"), "3 · Top bar (as before)")], 2), "Layout"), "round-3-1-layout.jpg")
save(titled(grid([label(shot("header-banner"), "1 · Banner (like the Library and Pokédex)"), label(shot("header-label"), "2 · Title label (like Jemma’s Journals)"), label(shot("header-plate"), "3 · Title over map (as before)")], 2), "Home page header"), "round-3-2-header.jpg")
save(titled(grid([label(shot("bg-" + k), t) for k, t in [("plain", "1 · Plain paper"), ("grain", "2 · Paper grain"), ("grid", "3 · Faint grid"), ("waves", "4 · Sea-chart lines"), ("dots", "5 · Dots (as before)")]], 3), "Background (look closely: they’re faint)"), "round-3-3-background.jpg")
pages = grid([label(shot("page-" + k), t) for k, t in [("trip", "A trip"), ("map", "Map"), ("countries", "Countries"), ("stats", "Stats")]], 2)
phones = [label(shot(n), t, 34) for n, t in [("phone-banner", "Phone · banner"), ("phone-label", "Phone · title label")]]
ph = grid(phones, 2)
ph = ph.resize((round(ph.width * pages.height / ph.height), pages.height), Image.LANCZOS)
both = Image.new("RGB", (pages.width + ph.width, pages.height), "#D9DEDC"); both.paste(pages, (0, 0)); both.paste(ph, (pages.width, 0))
save(titled(both, "Other pages with the sea green sidebar"), "round-3-4-pages.jpg")
