# Travel photos on a static site

Checked **21 Nov 2026**. Local tests were run on her PC with **Pillow 12.3.0** (already installed, with WebP and AVIF support switched on).

---

## Formats

| Format | Browser support | Size vs JPEG | Notes |
|---|---|---|---|
| JPEG | Everything | — | Safe fallback; best for social share images |
| WebP | **97.3%** of users | Lossy WebP is **25–34% smaller** at equal quality | Fast to encode |
| AVIF | **96.7%** of users (Safari 16.4+, Chrome 85+, Firefox 93+, Edge 121+) | Often **over 50% smaller**, but varies (their own example was only 6% smaller) | Slower to encode |

Sources: [caniuse WebP](https://caniuse.com/webp), [caniuse AVIF](https://caniuse.com/avif) (StatCounter data, Oct 2026), [Google WebP](https://developers.google.com/speed/webp), [web.dev AVIF](https://web.dev/articles/compress-images-avif).

Pillow can write both: WebP `quality` (default 80) and `method` 0–6; AVIF `quality` (default 75) and `speed` 0–10 (lower is slower and better). [Pillow formats](https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html)

**Claude’s suggestion (not decided):** WebP only for the site (one format, half the files), plus one JPEG per post for share previews. Add AVIF later only if space gets tight.

---

## How many sizes (srcset)

- With `srcset="a.webp 480w, b.webp 960w, …"` plus `sizes`, the browser picks the best file for the screen; the `w` number must match the file’s real width. [MDN img](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img)
- Always give `width` and `height` so the page reserves space and doesn’t jump; this matters most for lazy images. [MDN img](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img)

**Claude’s suggestion (not decided):** three widths, longest side about **480 / 1024 / 1920 px**: small for thumbnails and phones, medium for in-post photos, large for the lightbox.

### Typical file sizes — rough estimate, not measured
Not measured on her photos (there are none in the project yet). As a rough guide for a busy outdoor photo at WebP quality 75–80: ~30–60 KB at 480 px, ~100–200 KB at 1024 px, ~250–500 KB at 1920 px, so **about 0.5 MB per photo for all three**. Measure on 20 of her real photos before deciding.

---

## GitHub limits

| Limit | Value | Source |
|---|---|---|
| Published Pages site | **1 GB max** | [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) |
| Pages source repo | recommended **1 GB** | same |
| Bandwidth | soft **100 GB/month** | same |
| Builds | soft 10 per hour (not for custom Actions workflows) | same |
| Deploy time | times out after 10 minutes | same |
| Single file | warning over **50 MiB**, **blocked over 100 MiB**; 25 MiB via the web upload | [Large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) |
| Repo size | ideally **under 1 GB**, under 5 GB strongly recommended | same |

At ~0.5 MB a photo, 1 GB is roughly **1,500–2,000 photos** after leaving room for the rest of the site. Git also keeps every old version of a file, so re-exporting all photos at a new quality adds to the repo size each time.

**Claude’s suggestion (not decided):** keep the **originals out of the repo** (her Pictures folder plus a normal backup); commit only the resized web copies.

---

## Git LFS on Pages

- Free personal accounts get **10 GiB LFS storage and 10 GiB bandwidth** a month; over the limit (with a $0 budget) LFS is blocked for the rest of the month. [GitHub LFS billing](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-storage-and-bandwidth-usage)
- Pages does not serve LFS files from a branch; people get them published by building with GitHub Actions using `lfs: true` on checkout. [Hugo forum](https://discourse.gohugo.io/t/github-pages-git-lfs/34217/3). Checkout downloads count against LFS bandwidth. [GitHub Community](https://github.community/t/does-actions-checkout-count-against-git-lfs-bandwidth-usage/17835)
- **Pros:** the Git repo stays small; old photo versions don’t bloat history.
- **Cons:** the **published site is still capped at 1 GB**, so LFS doesn’t raise the real limit; needs an Actions workflow; extra quota to watch.
- **Claude’s suggestion (not decided):** don’t use LFS. Small web copies fit comfortably without it.

---

## Privacy: stripping EXIF / GPS

Tested on her PC (Pillow 12.3.0, a test image with GPS, date and orientation):

- Saving as JPEG, WebP or AVIF **without** an `exif=` argument wrote **no EXIF and no XMP**, so the GPS was gone.
- Saving **with** `exif=img.getexif()` **kept the GPS**. So: never pass the original EXIF through.
- `ImageOps.exif_transpose()` rotates the pixels to match the camera’s Orientation tag and removes that tag ([Pillow ImageOps](https://pillow.readthedocs.io/en/stable/reference/ImageOps.html)). Do this **before** resizing, or sideways photos stay sideways once the tag is gone.
- **Keeping the date:** simplest is to keep the date in the post data (`data/posts/…`) rather than in the file. If wanted in the file, build a new EXIF with only DateTimeOriginal.
- **Colour profile:** Pillow leaves out the ICC profile unless given ([Pillow formats](https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html)); phone photos in wide colour can look duller without it. Pass `icc_profile=img.info.get("icc_profile")`: it holds colour data only, no location.
- Check afterwards: a build step that opens every file in `site/photos/` and fails if any has GPS.

---

## Reading the date and GPS to sort into days

- Pillow reads EXIF: `img.getexif()`, then `.get_ifd(0x8769)` for DateTimeOriginal (tag 0x9003) and `.get_ifd(0x8825)` for GPS (latitude/longitude as degrees, minutes, seconds plus N/S/E/W). Tested on her PC.
- Camera times are **local time with no time zone** unless the OffsetTimeOriginal tag is present; on trips across time zones, sort by the time the phone recorded and check the day boundaries.
- GPS can suggest the place for a post (nearest named place in `data/trips.json`), used only on her PC and never copied to the site.
- **iPhone HEIC photos:** Pillow alone cannot open HEIC; **pillow-heif** (BSD-3, Windows wheels, v1.8.1, 11 Oct 2026) adds it as a Pillow plugin. [PyPI](https://pypi.org/project/pillow-heif/). It is **not installed** (tested), so it would be a download (her OK first). Not needed if her phone saves JPEG or she exports JPEGs.

---

## Lazy loading

- `loading="lazy"` waits until the image is near the screen; `decoding="async"` stops the page waiting for decoding; `fetchpriority="high"` for the first big photo. [MDN img](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img)
- Don’t lazy-load the top photo of a post (it is on screen straight away).

---

## Lightbox / zoom without heavy libraries

- **Built-in `<dialog>`** with `showModal()`: blocks the page behind, Esc closes it, focus moves inside, `::backdrop` styles the dark overlay; works in all browsers since March 2022. [MDN dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog). Add arrow keys and swipe with a little JavaScript. Effort: small to medium; no download.
- **PhotoSwipe 5** (MIT): pinch-zoom, swipe, loads bigger files as you zoom, no dependencies, ES module. [photoswipe.com](https://photoswipe.com/). It **needs each image’s width and height in advance** ([getting started](https://photoswipe.com/getting-started/)); the build script already knows these. Would be a download (her OK first).
- **Claude’s suggestion (not decided):** start with `<dialog>`; switch to PhotoSwipe only if pinch-zoom on phones matters to her.

---

## Alt text

- Photos that carry meaning: a short description of what matters in the photo. Purely decorative ones: `alt=""`. If the caption already says it all, alt can be shorter. [W3C WAI decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/)
- Her words only (project rule): the post header could take an optional alt line per photo; missing alt shows the placeholder badge on her PC, never invented text.
