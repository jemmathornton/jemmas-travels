# Writing posts from a phone, once the site is online

Research only (21 Nov), nothing built. All of these are my suggestions (not decided).

## What any option needs first

Today the Write page saves through `tools/serve.py` on her PC, which shrinks photos, removes their location and rebuilds `site/js/data.js`. Online (GitHub Pages) there is no server, so a phone option has to do those jobs another way:

- **A GitHub Actions workflow** that runs on every change: shrinks new photos, strips location data, runs `tools/check_data.py` and `tools/build.py`, then publishes `site/`. Free on a public repo. Build once; every option below except the last relies on it.
- **Photo location:** phone photos carry GPS. The workflow should strip it (today the data check refuses such photos, so it would need to strip rather than refuse).
- **Posts as files:** her posts are already Markdown files with a header (`title`, `days`, `place`, `photos`), the format these tools expect. New trips mean editing `data/trips.json`.

## The options

| Option | What it is | Pros | Cons | Cost |
|---|---|---|---|---|
| **1. GitHub website on the phone** | In the phone’s browser on github.com: Add file in `data/posts/<trip>/`, type the header and words, upload photos | Nothing to set up beyond the workflow; nothing new to sign in to | Fiddly on a small screen; header typed by hand (a typo stops the build); photo names must match the header | Free |
| **2. Pages CMS** ([pagescms.org](https://pagescms.org/)) | A hosted editor at app.pagescms.org; sign in with GitHub, get forms for each post (title, days, place, photos, words) that save as files in the repo | Forms instead of typing the header; photo uploads; no server of her own; open source | A third party gets access to the repo; needs a `.pages.yml` setup file; not tested on her phone | Free ([its FAQ](https://pagescms.org/docs/)) |
| **3. Sveltia CMS** ([GitHub](https://github.com/sveltia/sveltia-cms)) | An editor page added to her own site (e.g. `/admin/`), sign in with a GitHub token; forms like option 2 | Lives on her own site; no third party; open source | Its own notes say small screens still have rough edges; sign-in by token (a password-like key to keep safe) or a small sign-in helper on Cloudflare’s free plan | Free |
| **4. A git app on the phone** | e.g. Working Copy (iPhone) or a similar Android app: a copy of the repo on the phone, edit files and push | Works offline (write on the plane, send later) | Most need a paid upgrade to push; still typing the header by hand; another app to learn | Paid app (one-off or subscription, varies) |
| **5. Draft on the phone, publish from the PC** | Write in Notes or email to herself while away; paste into the Write page at home | No changes at all; keeps the “no writing online” rule; photos handled as now | Not live while travelling; copying across later | Free |

## Things to weigh

- **Safety:** options 1–4 can change the public repo from the phone, so a lost phone with GitHub signed in matters (two-step sign-in on GitHub helps). Option 5 changes nothing online.
- **Effort to set up:** 5 none; 1 the workflow only; 2 and 3 the workflow plus a settings file; 4 the workflow plus an app.
- **Comments:** separate decision (`research/comments.md`); none of these add comments.

Sources: [Pages CMS docs](https://pagescms.org/docs/), [Sveltia CMS](https://github.com/sveltia/sveltia-cms) (token sign-in; mobile still being improved), [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) (Cloudflare Worker), GitHub Pages notes in `JemmasJournals/research/going-online.md`.

## Her decision (21 Nov)

**Option 5:** draft on the phone while away (Notes or email), then add the post through the Write page on her PC at home. Nothing built online. She may look again at options 2 or 3 once the site is online.
