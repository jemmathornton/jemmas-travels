# To do / to decide

## For Jemma to choose
- **How to write posts:** Write page on her PC is OK; through-me for past trips still my suggestion (not decided). Options in `for-jemma/writing-options.md`.
- **Exact dates** for trips (start and end days) if you want “days away” stats; months are enough for now.
- **Tagline** on the home page: a line in your own words (or none).

## From the critical review (21 Nov): fixed
XSS through the address (#/year/…), unknown years now Not found; an unmarked sentence in a Japan placeholder post (and a data check so it can’t happen again); wide photos making the page scroll sideways at 821–1300px; the Write page too wide on phones; country pages showing no pins or the wrong ones; dates like 2016-11 to 2017, en dashes in days, days counted from dates; maps cut at the 180° line (Fiji, Russia); stats crashing with no countries; photo names with # or ?; “Latest posts” showing the oldest; faint grey/green text (darker now, 4.5:1); focus after clicking; Esc on the menu; skipped heading levels; footer landmark; text addressed to Jemma on the public site; duplicate map filter ids; accented letters (latin-ext fonts); dead code and about 45% dead CSS (stylesheet rewritten).

## Still open from the review (need her say, or later)
- **← Jemma’s Journals link** points at `/` (decided for when all sites share one address). On her PC it just reloads Travels; fine until going online.
- **Trips across New Year** count in the year they started (said under the chart). Her call if they should show in both years.
- **Alt text** for real photos: comes from the caption when there is one; a separate alt field could be added.
- Going online: split world.js so the detailed shapes load only on zoomed maps (1.2 MB now).

## Research (21 Nov, in research/; all suggestions not decided)
- **Comments:** Cusdis is dead (archived July 2026). Shortlist: Hyvor Talk (€50/year, guests comment with a name), Comentario, an email link, giscus (needs GitHub accounts).
- **Photos:** WebP at about 480/1024/1920 px; originals stay out of the repo; Pillow drops GPS when saving without exif (keep orientation with exif_transpose); iPhone HEIC would need pillow-heif (ask before installing).
- **Ideas:** route lines per trip, distance travelled, on this day, photo of the trip (cover), trip timeline, search, UNESCO tracker. Flags need an icon set (Windows has no flag emoji).
- **Counting countries:** keep 195; territories count for their country (Tenerife → Spain); UK nations not split; tiny countries (Vatican, Monaco, Malta) have no shape on the world map, so they’d need a dot.

## Later
- Real trips and dates (the current ones are placeholders).
- Going online: load the detailed map (world.js is 1.2 MB, mostly the 1:50m shapes) only on pages that zoom in.
- Comments: choose a service when going online.
- Dark mode (light by default, button in the footer, like Journals).
- Tab icon (her own design, like Journals).
