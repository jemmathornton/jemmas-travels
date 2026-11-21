"""Round 4 sheets: banner at several widths; pale/sea sidebar x plain/grid. for-jemma/looks-4/ -> for-jemma/round-4-*.jpg"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOTS, OUT = ROOT / "for-jemma" / "looks-4", ROOT / "for-jemma"
BOLD = "C:/Windows/Fonts/segoeuib.ttf"
shot = lambda n: Image.open(SHOTS / f"b-{n}.jpg").convert("RGB")


def label(im, text, size=40):
    out = Image.new("RGB", (im.width, im.height + size + 28), "white")
    out.paste(im, (0, size + 28))
    ImageDraw.Draw(out).text((18, 10), text, fill="#24403E", font=ImageFont.truetype(BOLD, size))
    return out


def row(images, gap=28, h=None):
    h = h or max(i.height for i in images)
    images = [i.resize((round(i.width * h / i.height), h), Image.LANCZOS) for i in images]
    sheet = Image.new("RGB", (sum(i.width for i in images) + gap * (len(images) + 1), h + 2 * gap), "#D9DEDC")
    x = gap
    for i in images:
        sheet.paste(i, (x, gap)); x += i.width + gap
    return sheet


def stack(images, gap=0):
    w = max(i.width for i in images)
    sheet = Image.new("RGB", (w, sum(i.height for i in images)), "#D9DEDC")
    y = 0
    for i in images:
        sheet.paste(i, (0, y)); y += i.height
    return sheet


def titled(im, text):
    out = Image.new("RGB", (im.width, im.height + 100), "white")
    ImageDraw.Draw(out).text((28, 22), text, fill="#24403E", font=ImageFont.truetype(BOLD, 54))
    out.paste(im, (0, 100))
    return out


def save(im, name, width=2400):
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(OUT / name, quality=84); print(name, im.size)


save(titled(stack([row([label(shot("width-1600"), "Laptop, full width"), label(shot("width-1366"), "Smaller laptop")], h=860),
                   row([label(shot("width-1100"), "Narrower window: map on top, title under"), label(shot("width-900"), "Narrow window"), label(shot("width-390"), "Phone")], h=1100)]),
             "Banner: the title now keeps clear of the map"), "round-4-1-banner.jpg")
save(titled(stack([row([label(shot("side-pale-plain"), "Pale sidebar · plain paper"), label(shot("side-pale-grid"), "Pale sidebar · faint grid")]),
                   row([label(shot("side-sea-plain"), "Sea green sidebar · plain paper"), label(shot("side-sea-grid"), "Sea green sidebar · faint grid")])]),
             "Sidebar and background"), "round-4-2-sidebar-background.jpg")
save(titled(stack([row([label(shot("side-pale-plain-stats"), "Pale · plain"), label(shot("side-pale-grid-stats"), "Pale · grid")]),
                   row([label(shot("side-sea-plain-stats"), "Sea green · plain"), label(shot("side-sea-grid-stats"), "Sea green · grid")])]),
             "The same four on the Stats page"), "round-4-3-stats-page.jpg")
