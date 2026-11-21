# Post templates: where photos can go

Ten example posts are in the **Italy (September 2026)** trip, one for each way of placing photos. Their words and photos are placeholders. Open them at http://localhost:8041/#/trip/italy-2026.

| Post | Template | Photos |
|---|---|---|
| Day 1 | One big photo at the top | 1 |
| Day 2 | A photo on the right, words beside it (with a caption) | 1 |
| Day 3 | A tall photo on the left | 1 |
| Day 4 | Two photos side by side, halfway down (with a caption) | 2 |
| Day 5 | Three photos in a row | 3 |
| Days 6–7 | Left, right, then one across the page | 3 |
| Day 8 | A mosaic of six (one big, five small) | 6 |
| Day 9 | Words only, no photos | 0 |
| Day 10 | All the photos together at the end | 8 |
| Days 11–12 | A mix: one in the text, two tall side by side, one on the right | 4 |

## How it works

Photos are numbered in the order they’re listed for the post (1, 2, 3…). To put one somewhere in the words, write a marker on a line of its own:

| Marker | What you get |
|---|---|
| `[photo 2]` | photo 2, the width of the words |
| `[photo 2 wide]` | photo 2, stretching a bit wider than the words |
| `[photo 2 left]` | photo 2 on the left, words flowing round it on the right |
| `[photo 2 right]` | photo 2 on the right, words flowing round it on the left |
| `[photo 2 tall]` | a portrait-shaped frame (works with left, right or on its own) |
| `[photos 3-5]` | photos 3, 4 and 5 side by side in a row |
| `[photos 3-8 mosaic]` | photos 3 to 8 as a mosaic, the first one big |
| `[photo 2 right: Your caption]` | anything after a colon is the caption |

Any photos you don’t place show together at the end of the post, so you never have to place them all. On a phone, left and right photos sit full width between paragraphs.
