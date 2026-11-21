# Feature ideas

Checked **21 Nov 2026**. Ideas drawn from travel apps (been, Polarsteps, NomadMania-style trackers) and personal travel blogs. Every idea is **Claude’s suggestion (not decided)**. Effort is for this site (plain HTML/CSS/JS, data built by `tools/build.py`): **S** = an hour or two, **M** = a day or so, **L** = several days.

The project rule still applies: no made-up text, so anything that needs words uses hers or shows a placeholder.

---

## Map

| Idea | What it is | Why it might suit her | Effort |
|---|---|---|---|
| Route lines per trip | A line joining a trip’s places in order on the map | Polarsteps’ best-known feature: trips “plotted on the map” ([polarsteps.com](https://www.polarsteps.com/)); her trips already list places with lat/lon | M |
| Cities/places pins | A pin per place, tap to see posts there | Already have named places in `data/trips.json` | S |
| Year filter on the map | Show only one year’s countries or trips | Site is found “by year by default” | S |
| Home marker | Birmingham marked; lines start there | Home is already set for distances | S |

## Stats and trackers

| Idea | What it is | Why it might suit her | Effort |
|---|---|---|---|
| Distance travelled | Straight-line (great-circle) km from Birmingham through each trip’s places and back | Fun headline number; the haversine formula is a few lines, error usually under 0.3% ([Movable Type](https://www.movable-type.co.uk/scripts/latlong.html)) | S |
| “Around the world” comparisons | Total distance as times round the Earth or to the Moon | Light-hearted stat | S |
| Continents tracker | Countries per continent, already have totals | Exists in data; just a nicer display | S |
| % of the world | Countries visited out of 195 | Common in trackers like been | S |
| UNESCO World Heritage tracker | Tick the sites she has seen | The List has **1,273 sites in 173 countries** after July 2026 ([summary of the 48th session](https://www.thepeninsulaqatar.com/article/30/07/2026/with-qatari-participation-unesco-world-heritage-committee-inscribes-25-new-sites)); she’d list only hers by hand rather than import all | M |
| National parks tracker | Same idea for parks (e.g. US, Canada, Norway trips) | Only if she cares about parks | M |
| Days away | Count of days travelling per year | Needs exact trip dates (open question in TODO) | S |
| Firsts | First trip, furthest from home, longest trip | Worked out from her data, so no invented text | S |

## Browsing and stories

| Idea | What it is | Why it might suit her | Effort |
|---|---|---|---|
| Trip timeline | All trips on one line by year, with a photo each | Gives the “by year” view a visual spine | M |
| “On this day” | Home page shows a post from the same date in another year | Nice surprise for family; works only once posts have dates | S |
| Photo of the trip | She picks one photo per trip as its cover | Covers for trip cards, share previews and the timeline | S |
| Random post button | Opens any post | Cheap fun | S |
| Previous/next post | Links within a trip | Normal for multi-day posts | S |
| Search | Find posts by word or place, done in the browser | Useful once there are many posts | M |

## Flags without emoji

- Windows’ emoji font (Segoe UI Emoji) shows **two letters instead of flags**; England/Scotland/Wales show as a black flag ([Mozilla bug 1970980](https://bugzilla.mozilla.org/show_bug.cgi?id=1970980), [WordPress Trac #63451](https://core.trac.wordpress.org/ticket/63451)).
- **flag-icons** (MIT): SVG flags for every ISO code, 4:3 and square, used with a class like `fi fi-gb`. [github.com/lipis/flag-icons](https://github.com/lipis/flag-icons). Copy only the flags she needs. Would be a download (her OK first). Effort **S**.
- These would sit alongside the postcard stamps, not replace them.

## Sharing, reading and keeping

| Idea | What it is | Why it might suit her | Effort |
|---|---|---|---|
| Share previews | `og:title`, `og:type`, `og:image`, `og:url` (+ image width, height, alt) so links show a photo in WhatsApp etc. | How family will actually pass links round ([ogp.me](https://ogp.me/)). **Catch:** the site is one page with `#/` routes, so each post needs its own small HTML file for previews to work | M |
| RSS feed | `feed.xml` listing posts; needs channel `title`, `link`, `description` ([RSS 2.0 spec](https://www.rssboard.org/rss-specification)) | Lets the few who use feed readers follow along; built by `build.py` | S |
| Print a trip | A print stylesheet: one trip, photos and words, no menus | Polarsteps’ printed travel books are popular ([polarsteps.com](https://www.polarsteps.com/)); this is the free version (print to PDF) | M |
| Hidden from search | `<meta name="robots" content="noindex">` on every page; don’t block the pages in robots.txt or Google never sees the tag ([Google](https://developers.google.com/search/docs/crawling-indexing/block-indexing)). GitHub Pages can’t send the header version, so meta tags it is | Matches “public but not advertised” | S |
| Dark mode | Already on the to-do list | Consistency with Journals | M |

## Probably not

- **Live tracking / GPS logging** (Polarsteps-style): needs an app and a server; and the site strips GPS by design.
- **Leaderboards / ranking** (NomadMania-style): built for competitive country-counters, not a family blog.
