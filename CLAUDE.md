# Jemma’s Travels

A blog of Jemma’s trips: each trip has posts (one day or several days together) with her notes and photos, comments, a map, a countries-visited tracker and fun stats. Found by year by default, or by country / on the map. Started 21 Nov 2026, in the family of her other apps (Library `Documents\HomeLibrary`, Pokédex `Documents\Pokedex`, Sim World `Documents\SimTracker`, home page `Documents\JemmasJournals`). Static site on her PC, built to go online later. Open things are in `TODO.md`.

## Working rules (as for her other apps)

- **Never edit Jemma’s own files without asking** (Downloads, Documents, Pictures, her other projects). Copy into this project and work on the copy.
- **British English**; **curly apostrophes** in shown text (ids, links and data keys stay straight).
- **No made-up text on the site:** her words only, word for word. Missing means a marked placeholder (`[placeholder]` at the start of a post field shows the dashed Placeholder badge). Labels and figures worked out from her data are fine.
- **No AI-generated art.** Photos are hers. Icons: Lucide (ISC). Maps: Natural Earth shapes (public domain).
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
- 21 Nov (round 1 → 2): **likes B Postcard best, C Atlas close second**; wants a mix of the two, **paler blue and green, not too dark**. A Family and D Lagoon dropped from the switch (CSS still there until she picks).
- 21 Nov: **no dotted map** (“too digital, like LED dots”). Now a real country map from Natural Earth (her OK to download, world-atlas 2.0.2 from jsDelivr), visited countries coloured in.
- 21 Nov: the trips are **placeholders** for now (her words); Portugal is April. Home for distances: **Birmingham**.
- 21 Nov: Write page OK as long as it’s only on her PC.
- 21 Nov: **GitHub backup: yes**, to the repo she made (jemmas-travels, public).
- 21 Nov (round 3): **F Old Atlas is closest.** Not sold on the dotted paper background; the map was cropped (fixed: tip of South America, New Zealand); the home page needs a header, not just a big map; worried it’s too far from her other apps (no sidebar). The switch now offers Old Atlas variations only: Layout (sidebar pale / sidebar sea green / top bar), Home header (banner / title label / title over map), Background (plain / grain / grid / sea-chart lines / dots). Sheets: `for-jemma/round-3-*.jpg`.
- 21 Nov (round 4): **her picks: banner home header, a sidebar, plain paper.** The banner was reworked (title in its own column, never on the map; under ~1240px wide the map goes on top and the title underneath). Still open: **pale or sea green sidebar** (she meant the faint grid *in the pale sidebar*, now an option; the page stays plain). The switch has one row: Pale with faint grid / Pale, plain / Sea green.
- 21 Nov: banner map was cropped in her browser (slice into a box narrower than the map): now drawn whole inside a fixed-width column. **Country stamps: the postcard stamps** (white, dotted blue edge, tilted), not the red postmark circles (she disliked them).

## Where things are

- `data/trips.json`: one line per trip (id, title, from/to as `YYYY-MM` or `YYYY`, country codes, optional named places with lat/lon for pins).
- `data/countries.json`: name, continent and map point per country; `home` (GB, not counted as visited); countries per continent for the tracker (195 in all).
- `data/posts/<trip id>/<nn>.md`: one post per file, a header between `---` lines (title, days `1` or `2-4` or dates, place, photos = file names in `site/photos/<trip id>/`, or a number of placeholder frames; placeholder: yes) then her words, blank line between paragraphs. The Japan posts are placeholders to show the layout.
- `imports/world-atlas-2.0.2/`: Natural Earth country shapes as downloaded (110m and 50m TopoJSON, ISC licence). `tools/make_world.py` (run with `python -I`) turns them into `site/js/world.js` (generated; 1:110m for world maps, 1:50m for zoomed maps; rings across 180° made continuous). `site/js/map.js` draws them in the Natural Earth projection.
- `tools/build.py`: builds `site/js/data.js` (**generated, never edit**) and stamps file fingerprints into `site/index.html`. Run after any change to data/ or site/.
- `site/`: the app (`index.html`, `site.css`, `js/app.js` pages and router, `js/map.js` dotted map, `js/icons.js` Lucide). Pages: home, trips by year, a trip, a post (with comments), map, countries tracker, a country, stats, Write (only on her PC: localhost/file).
- `tests/banner_widths.js`: round-4 shots (banner at 1600/1366/1100/900/390 wide, checks the title never sits on the map; sidebar × background); `tools/make_sheets4.py` makes the sheets.
- `tests/variants.js`: screenshots of the round-3 variations into `for-jemma/looks-3/`; `tools/make_sheets3.py` makes the round-3 sheets. `tests/element_shot.js`: one element of a page (set MSYS_NO_PATHCONV=1 in Git Bash so `#/` isn’t mangled).
- `tests/shoot.js`: screenshots every look × page × laptop/phone into `for-jemma/looks/` and fails on page errors or sideways scrolling. `tools/make_sheets.py` turns them into the labelled `for-jemma/choice-*.jpg`.

## How to work here

- Python 3.13: `C:/Users/Jemma/AppData/Local/Programs/Python/Python313/python.exe -X utf8` (plain `python` is the Store stub and hangs). Ask before installing anything.
- Node + Playwright: borrowed from Sim World, `C:/Users/Jemma/Documents/SimTracker/.tools/node/node.exe` (uses Edge, no download).
- Preview: `travels` in `.claude/launch.json` (port 8041).
- Check after each change: `tools/build.py`, then `node tests/shoot.js` (about a minute and a half).
- Git: commit after each piece of work and push. Backed up to GitHub, https://github.com/jemmathornton/jemmas-travels (**public**, the repo she made 21 Nov: anything committed, photos included, can be read by anyone). Push with `git -c "credential.helper=!'C:/Program Files/GitHub CLI/gh.exe' auth git-credential" push`.
- **Reopen the browser pane every time** I show her changes (her ask, 21 Nov), and give file paths too.
