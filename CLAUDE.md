# Jemma’s Travels

A blog of Jemma’s trips: each trip has posts (one day or several days together) with her notes and photos, comments, a map, a countries-visited tracker and fun stats. Found by year by default, or by country / on the map. Started 21 Nov 2026, in the family of her other apps (Library `Documents\HomeLibrary`, Pokédex `Documents\Pokedex`, Sim World `Documents\SimTracker`, home page `Documents\JemmasJournals`). Static site on her PC, built to go online later. Open things are in `TODO.md`.

## Working rules (as for her other apps)

- **Never edit Jemma’s own files without asking** (Downloads, Documents, Pictures, her other projects). Copy into this project and work on the copy.
- **British English**; **curly apostrophes** in shown text (ids, links and data keys stay straight).
- **No made-up text on the site:** her words only, word for word. Missing means a marked placeholder (`[placeholder]` at the start of a post field shows the dashed Placeholder badge). Labels and figures worked out from her data are fine.
- **No AI-generated art.** Photos are hers. Icons: Lucide (ISC). The map is drawn in code (`site/js/map.js`).
- **Her colours here: blues and greens** (her choice, 21 Nov; different from the Library’s browns).
- **Show, don’t ask, for looks:** build options into the site (the trial switch, bottom right, only while she’s choosing), screenshot at 1600 wide and phone size, send them labelled. Words are fine for facts.
- **When asking her to choose, list every option** in the message. **Label suggestions** “my suggestion (not decided)”.
- Short, plain answers. When she’s away for hours, keep working through checks and small fixes in one turn.
- **Downloads need her OK first** (say what, from where, how big).
- **Photos going online:** strip location data (EXIF GPS) from the copies the site uses.

## Her decisions so far

- 21 Nov: name **Jemma’s Travels**; blog style with posts and comments; a post can be one day or several (“Day 1”, “Days 2–4”).
- 21 Nov: **comments: decide when going online.** The comment box is built into each post, switched off.
- 21 Nov: **joins Jemma’s Journals** (her yes): “My Travels” on the home page (stand-in picture: this site’s map), and the “← Jemma’s Journals” link at the top of the sidebar/top bar.
- 21 Nov: her trips (titles are her words, slashes written as “and”; “Strasbourgh” spelt Strasbourg): Italy Sep 2026; Norway/Denmark/Sweden Jun 2026; Portugal 2026; Brazil/Argentina Nov–Dec 2025; Strasbourg Dec 2025; Tenerife Sep 2025; Japan Sep 2024; France/Spain Jun 2024; NYC/Nashville Mar 2024; Canada/Boston Sep–Oct 2023; India Sep 2012.
- Still open: which look (A Family, B Postcard, C Atlas, D Lagoon), how she writes posts (see `for-jemma/writing-options.md`).

## Where things are

- `data/trips.json`: one line per trip (id, title, from/to as `YYYY-MM` or `YYYY`, country codes, optional named places with lat/lon for pins).
- `data/countries.json`: name, continent and map point per country; `home` (GB, not counted as visited); countries per continent for the tracker (195 in all).
- `data/posts/<trip id>/<nn>.md`: one post per file, a header between `---` lines (title, days `1` or `2-4` or dates, place, photos = file names in `site/photos/<trip id>/`, or a number of placeholder frames; placeholder: yes) then her words, blank line between paragraphs. The Japan posts are placeholders to show the layout.
- `tools/build.py`: builds `site/js/data.js` (**generated, never edit**) and stamps file fingerprints into `site/index.html`. Run after any change to data/ or site/.
- `site/`: the app (`index.html`, `site.css`, `js/app.js` pages and router, `js/map.js` dotted map, `js/icons.js` Lucide). Pages: home, trips by year, a trip, a post (with comments), map, countries tracker, a country, stats, Write (only on her PC: localhost/file).
- `tests/shoot.js`: screenshots every look × page × laptop/phone into `for-jemma/looks/` and fails on page errors or sideways scrolling. `tools/make_sheets.py` turns them into the labelled `for-jemma/choice-*.jpg`.

## How to work here

- Python 3.13: `C:/Users/Jemma/AppData/Local/Programs/Python/Python313/python.exe -X utf8` (plain `python` is the Store stub and hangs). Ask before installing anything.
- Node + Playwright: borrowed from Sim World, `C:/Users/Jemma/Documents/SimTracker/.tools/node/node.exe` (uses Edge, no download).
- Preview: `travels` in `.claude/launch.json` (port 8041).
- Check after each change: `tools/build.py`, then `node tests/shoot.js` (about a minute and a half).
- Git: local repo, commit after each piece of work. No GitHub repo yet (her other apps are public on GitHub; ask before making one: photos would be public too).
