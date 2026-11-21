"""A small made-up set of trips with known answers, for tests (never her real data).

Covers the awkward cases: a trip with no month, a trip across New Year, several countries, a country over the
180° line (Fiji), a visit to the home country, a title with < > & and an apostrophe, posts with dates instead of
days, posts with real photo files and photo markers, an empty year in the middle.
"""
from PIL import Image

COUNTRIES = {
    "_note": "made up for tests",
    "home": "GB", "homeTown": "Birmingham", "homeAt": [52.48, -1.9],
    "continentTotals": {"Europe": 44, "Asia": 48, "Africa": 54, "North America": 23, "South America": 12, "Oceania": 14},
    "countries": {
        "GB": {"name": "United Kingdom", "continent": "Europe", "at": [54.0, -2.5], "iso": "826"},
        "FR": {"name": "France", "continent": "Europe", "at": [46.6, 2.4], "iso": "250"},
        "IT": {"name": "Italy", "continent": "Europe", "at": [42.8, 12.5], "iso": "380"},
        "FJ": {"name": "Fiji", "continent": "Oceania", "at": [-17.7, 178.0], "iso": "242"},
        "NZ": {"name": "New Zealand", "continent": "Oceania", "at": [-41.0, 174.0], "iso": "554"},
        "CL": {"name": "Chile", "continent": "South America", "at": [-33.4, -70.6], "iso": "152"},
    },
}

TRIPS = {"_note": "made up for tests", "trips": [
    {"id": "fiji-nz-2027", "title": "Fiji & New Zealand", "from": "2026-12", "to": "2027-01", "countries": ["FJ", "NZ"]},
    {"id": "chile-2026", "title": "Chile", "from": "2026", "to": "2026", "countries": ["CL"]},
    {"id": "paris-2026", "title": "Paris <with> Mum's & Dad's", "from": "2026-03", "to": "2026-03", "countries": ["FR"],
     "places": [["Paris", 48.86, 2.35]]},
    {"id": "scotland-2020", "title": "Scotland", "from": "2020-08", "to": "2020-08", "countries": ["GB"]},
    {"id": "italy-france-2020", "title": "Italy and France", "from": "2020-05", "to": "2020-06", "countries": ["IT", "FR"]},
]}

# expected answers (worked out by hand)
EXPECT = {
    "trips": 5,
    "visited": 5,            # FR, IT, FJ, NZ, CL (GB is home, not counted)
    "continents": 3,         # Europe, Oceania, South America
    "years": ["2026", "2020"],   # 2027 is only where a trip ends; trips are filed by their start year
    "busiest": "2026",       # 3 trips start in 2026
    "longest_gap": (6, 2020, 2026),
    "most_visited": ["France"],   # 2 trips
    # trip distances: Birmingham (52.48, -1.9) to each stop and back, great circle, R 6371 km, to the nearest 10 km
    "distances": {"paris-2026": "1,000 km",           # 1,003.1
                  "italy-france-2020": "3,140 km",    # 3,144.3 (Italy's point, then France's)
                  "fiji-nz-2027": "37,470 km"},       # 37,468.1
    "furthest": "New Zealand",    # from Birmingham: NZ ~18,300 km, Fiji ~16,300 km
}

POSTS = {
    "paris-2026/01.md": """---
title: Arriving & the Eiffel Tower
dates: 2026-03-05
place: Paris
photos: a.jpg, b.jpg, c.jpg, d.jpg
---
First paragraph of notes.

[photo 1 right: Looking up]

Second paragraph.

[photos 2-3]

Last paragraph.
""",
    "paris-2026/02.md": """---
title: Two days in Montmartre
dates: 2026-03-06 to 2026-03-07
photos: 0
---
Words only.
""",
    "fiji-nz-2027/01.md": """---
title: [placeholder] New Year’s Eve
days: 1-3
photos: 2
placeholder: yes
---
[placeholder] Notes.

[photos 1-2 mosaic]
""",
}


def make_photo(path, w=800, h=600, colour=(120, 170, 160)):
    Image.new("RGB", (w, h), colour).save(path, quality=80)


def install(box):
    """Write the made-up trips, countries, posts and photos into a sandbox (replacing its data)."""
    import os
    import shutil
    shutil.rmtree(box.path("data"), ignore_errors=True)
    os.makedirs(box.path("data", "posts"))
    box.write_json("data/trips.json", TRIPS)
    box.write_json("data/countries.json", COUNTRIES)
    for rel, text in POSTS.items():
        box.write(f"data/posts/{rel}", text)
    photos = box.path("site", "photos", "paris-2026")
    shutil.rmtree(box.path("site", "photos"), ignore_errors=True)
    os.makedirs(photos)
    for i, n in enumerate("abcd"):
        make_photo(os.path.join(photos, f"{n}.jpg"), colour=(100 + i * 30, 160, 170))
