# Maps and counting countries

Checked **21 Nov 2026**. Facts about her map files were checked directly in `imports/world-atlas-2.0.2/` on her PC.

---

## Natural Earth: terms and credit

- **Public domain:** “All versions of Natural Earth raster + vector map data … are in the public domain”; use in any way, including modifying. [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/)
- **Credit is optional** (“Crediting the authors is unnecessary”). Suggested wording if wanted:
  - short: **“Made with Natural Earth.”**
  - long: **“Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.”** [same page](https://www.naturalearthdata.com/about/terms-of-use/)
- **world-atlas** repackages Natural Earth **version 4.1.0** as TopoJSON under the **ISC licence**; each country’s `id` is the ISO 3166-1 numeric code and `properties.name` its name. [github.com/topojson/world-atlas](https://github.com/topojson/world-atlas)
- Claude’s suggestion (not decided): footer line “Map: Made with Natural Earth (via world-atlas, ISC)”. Credits the source and the ISC packaging in one go.

## How Natural Earth draws borders

- Shows **de facto** borders, “according to who controls the territory”, with separate disputed-area layers for anyone who wants a different view. [Natural Earth Admin 0](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/)
- Its Countries layer keeps some dependencies separate (e.g. **Greenland separate from Denmark**); a finer “map units” layer splits out places like France’s overseas regions. [same page](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/)

### What that means in her files (checked on her PC)

| | 1:110m (world map) | 1:50m (zoomed maps) |
|---|---|---|
| Shapes | 177 | 241 |
| **No ISO id** (can’t be matched by code) | Kosovo, N. Cyprus, Somaliland | the same, plus Indian Ocean Ter., Siachen Glacier |
| Greenland | own shape (304), not Denmark | same |
| Puerto Rico | own shape (630), not USA | same |
| Hong Kong, Macao | **no own shape** (falls within China’s outline) | own shapes (344, 446) |
| Gibraltar | no own shape | **no own shape** |
| Canary Islands (Tenerife) | **not drawn** (Spain is one shape) | part of **Spain** |
| Vatican, San Marino, Monaco, Andorra, Liechtenstein, Malta, Singapore | **no own shape** (too small) | own shapes |
| French Guiana | part of **France** | part of France |

So: tiny countries need a **dot or stamp** on the world map, since there is no shape to colour. If she has been to the Vatican (Italy trip), it is already in her 195 list but can’t be coloured at 1:110m.

---

## What the trackers count

| List | Count | Notes | Source |
|---|---|---|---|
| UN members | **193** | Standard “countries” list | [UN Model UN: UN at a glance](https://www.un.org/en/model-united-nations/un-glance) |
| UN members + observers | **195** | Adds Holy See (Vatican) and State of Palestine, the two non-member observer states | [UN Library guide](https://research.un.org/en/unmembers/observers) |
| NomadMania “SLOW” list | 196 | UN 193 + Taiwan, Palestine, Kosovo | [NomadMania lists](https://nomadmania.com/lists/) (via search summary) |
| NomadMania UN+ / regions | ~265 / ~1,301 | Adds territories / splits into regions | [NomadMania](https://nomadmania.com/travel-lists/) (via search summary) |
| Travelers’ Century Club | **330** (as of Jan 2022) | Counts England, Scotland, Wales, Northern Ireland, Canary Islands, Balearics, Sicily, Sardinia, Gibraltar, Greenland, Hong Kong, Puerto Rico **separately**; 100 to join | [TCC list](https://travelerscenturyclub.org/countries-and-territories) |
| been (app) | UN-based plus some extras | Reported to include Scotland, Wales and Puerto Rico; shows whether each is a UN member. Exact total not confirmed. | [Johnny Jet review](https://johnnyjet.com/how-many-countries-have-you-been-to-this-free-app-will-show-you-and-help-you-keep-track-of-how-much-of-the-world-youve-seen/) (page blocked automated reading; via search summary) |
| Polarsteps | Counts from trip steps; manual adds via a scratch map | Rules for territories not published | [Polarsteps help](https://support.polarsteps.com/hc/en-us/articles/33242544423954-Adding-countries-to-your-travel-statistics) |

Her project already uses **195 = UN members + Vatican + Palestine** (`data/countries.json`).

---

## The tricky places

| Place | What it is | Counted in 195? | TCC |
|---|---|---|---|
| **Tenerife** (Canary Islands) | Part of Spain (an autonomous community) | **Spain** | Separate (Canary Islands) |
| **Greenland** | Autonomous territory within the Kingdom of Denmark | Denmark (not a UN member) | Separate |
| **Hong Kong** | Special Administrative Region of China | China | Separate |
| **Puerto Rico** | US territory | United States | Separate |
| **Gibraltar** | British Overseas Territory (not part of the UK itself) | Not a country on the list; nearest is UK | Separate |
| **England / Scotland / Wales / NI** | Countries within the UK; not separate ISO codes | United Kingdom | Separate |

Sources: [Canary Islands](https://en.wikipedia.org/wiki/Canary_Islands), [Greenland](https://en.wikipedia.org/wiki/Greenland), [Hong Kong](https://en.wikipedia.org/wiki/Hong_Kong), [Puerto Rico](https://en.wikipedia.org/wiki/Puerto_Rico), [Gibraltar](https://en.wikipedia.org/wiki/Gibraltar), [Countries of the UK](https://en.wikipedia.org/wiki/Countries_of_the_United_Kingdom), [TCC list](https://travelerscenturyclub.org/countries-and-territories).

---

## Claude’s suggestion (not decided)

1. **Keep 195** (UN 193 + Vatican + Palestine) as the headline count. Simple to explain, matches most trackers, already built.
2. **Territories count towards their country:** Tenerife → Spain, Hong Kong → China, Puerto Rico → USA, Greenland → Denmark. On the map, colour Greenland/Puerto Rico/Hong Kong only if she has actually been there (they are separate shapes, so visiting Denmark won’t colour Greenland).
3. **Optional “Places beyond the count” line** on a country page (e.g. “Canary Islands” under Spain), if she likes TCC-style detail. No effect on 195.
4. **UK home nations: don’t split** for the count. The UK is home and already not counted. If she wants, a small “Around the UK” panel later (England, Scotland, Wales, Northern Ireland) as a separate fun stat.
5. **Tiny countries:** show a dot/stamp on the 1:110m map for any she visits (Vatican, Monaco, Malta, etc.).
6. **Disputed places** (Kosovo, Taiwan, Northern Cyprus, Western Sahara): only matter if she goes. Then decide case by case; the map shows de facto lines.
