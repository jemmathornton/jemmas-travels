"""Make labelled comparison sheets from tests/shoot.js screenshots (for-jemma/looks/ -> for-jemma/choice-*.jpg)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "for-jemma" / "looks"
OUT = ROOT / "for-jemma"
NAMES = {"a": "A · Family (like your Library and Pokédex)", "b": "B · Postcard", "c": "C · Atlas", "d": "D · Lagoon"}
FONT = "C:/Windows/Fonts/segoeuib.ttf"


def font(size):
    return ImageFont.truetype(FONT, size)


def crop_top(path, h):
    im = Image.open(path).convert("RGB")
    return im.crop((0, 0, im.width, min(h, im.height)))


def label(im, text, size=44):
    pad = size + 30
    out = Image.new("RGB", (im.width, im.height + pad), "white")
    out.paste(im, (0, pad))
    ImageDraw.Draw(out).text((20, 12), text, fill="#15302D", font=font(size))
    return out


def grid(images, cols, gap=30, bg="#D9DEDC"):
    w = max(i.width for i in images); h = max(i.height for i in images)
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols + 1) * gap, rows * h + (rows + 1) * gap), bg)
    for n, im in enumerate(images):
        r, c = divmod(n, cols)
        sheet.paste(im, (gap + c * (w + gap), gap + r * (h + gap)))
    return sheet


def save(im, name, width=2400):
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(OUT / name, quality=84)
    print(name, im.size)


# 1. the four home pages side by side
save(grid([label(crop_top(SHOTS / f"{k}-laptop-home.jpg", 1000), NAMES[k]) for k in NAMES], 2), "choice-1-home-pages.jpg")
# 2. one sheet per look: inner pages + phone
pages = [("trip_japan-2024", "A trip"), ("trip_japan-2024_02", "A post (days 2–4)"), ("countries", "Countries tracker"), ("stats", "Stats")]
for n, k in enumerate(NAMES, start=2):
    tiles = [label(crop_top(SHOTS / f"{k}-laptop-{p}.jpg", 1000), t) for p, t in pages]
    sheet = grid(tiles, 2)
    phone = label(Image.open(SHOTS / f"{k}-phone-home.jpg").convert("RGB"), "Phone", 40)
    ph = phone.resize((round(phone.width * sheet.height / phone.height), sheet.height), Image.LANCZOS)
    both = Image.new("RGB", (sheet.width + ph.width + 30, sheet.height + 110), "white")
    ImageDraw.Draw(both).text((30, 24), NAMES[k], fill="#15302D", font=font(60))
    both.paste(sheet, (0, 110)); both.paste(ph, (sheet.width + 15, 110))
    save(both, f"choice-{n}-look-{k}.jpg")
