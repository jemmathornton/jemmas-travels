# Comments for Jemma’s Travels

Checked **21 Nov 2026**. Prices and features change; re-check the linked pages when going online.

**What she needs:** friends and family (not developers) can comment, ideally **without signing in**; the site is static on GitHub Pages; UK privacy rules; little or no upkeep.

---

## At a glance

| Option | Sign-in to comment? | Cost | Server she runs? | Spam / moderation | Status |
|---|---|---|---|---|---|
| giscus | **Yes, GitHub** | Free | No | Moderate on GitHub | Active |
| utterances | **Yes, GitHub** | Free | No | Moderate on GitHub | Older, still works |
| Cusdis (hosted) | No | — | No | Approve each comment; no spam filter | **Deprecated, archived Jul 2026** |
| Cusdis (self-hosted) | No | Server costs | **Yes** | As above | **Deprecated, archived Jul 2026** |
| Remark42 | Optional (anonymous allowed) | Free software + server | **Yes** | Admin delete/block, banned words, votes | Active (v1.18.0, Oct 2026) |
| Commento (original) | — | — | — | — | commento.io pricing page gone (404) |
| Commento++ | Name only for guests | Free software + server + PostgreSQL | **Yes** | Akismet, Perspective, moderation | Unclear |
| Comentario (Commento successor) | Optional (anonymous allowed) | Free software; a managed cloud exists | Yes, or their cloud | Akismet / APILayer / Perspective, rules for pre-moderation | Active |
| Hyvor Talk | **No (guest commenting on by default)** | From **€5/month or €50/year** | No | Akismet or FortGuard, shadow-ban, rules | Active |
| Isso | No (name/email optional) | Free software + server | **Yes** | Moderation queue, rate limit | Active (0.14.0) |
| Cactus Comments | Matrix account (guest use not confirmed) | Free (donations) | No (public server) or yes | Not documented on home page | Quiet since about 2023 |
| Staticman | Not documented | Free software + server | **Yes** (Node.js) | Comments arrive as pull requests | Old |
| Disqus | Account or guest (varies) | Free with **ads**; Plus about $12/month | No | Good tools | Active, but heavy tracking |
| FastComments | Not confirmed for guests | Usage-based, often under £1/month | No | Yes | Active |
| Bluesky/Mastodon replies | **Yes (their account)** | Free | No | Moderation on the social site | Small DIY scripts |

---

## Each option

### giscus
- **Sign-in:** visitors must authorise the giscus app through GitHub, or comment on GitHub directly. [giscus.app](https://giscus.app/)
- **Cost:** “always free”; “No tracking, no ads”. [giscus.app](https://giscus.app/)
- **Needs:** a **public** repo, the giscus app installed, Discussions switched on. [giscus.app](https://giscus.app/)
- **Moderation:** on GitHub. **Export:** comments live in GitHub Discussions, so they stay in her repo.
- **Effort:** small (one script tag).
- **For her:** **poor fit**: family members would need GitHub accounts. Her backup repo is already public, so the technical side would be easy.

### utterances
- **Sign-in:** GitHub OAuth required. Free, “No tracking, no ads”. Stores comments as GitHub Issues. [github.com/utterance/utterances](https://github.com/utterance/utterances)
- giscus is the newer version of the same idea. Same poor fit for non-developers.

### Cusdis (hosted and self-hosted)
- **Important:** the README now says **“Cusdis is deprecated now”** and the repo was **archived on 17 Jul 2026**; data exports are by email request. [github.com/djyde/cusdis](https://github.com/djyde/cusdis). cusdis.com returned a server error (HTTP 521) when checked on 21 Nov 2026.
- When it was active: no sign-in, about 5 KB widget, no cookies, approve-first moderation, no spam filter. [github.com/djyde/cusdis](https://github.com/djyde/cusdis). A June 2026 comparison still listed the cloud free tier as 1 site and 100 approved comments a month, Pro $12/year. [merginit.com](https://merginit.com/blog/21062026-free-commenting-platforms-comparison)
- **For her:** **avoid**: no longer maintained.

### Remark42
- **Sign-in:** social logins, email login, and **optional anonymous** login (`AUTH_ANON`, off by default). [remark42 parameters](https://remark42.com/docs/configuration/parameters/), [GitHub](https://github.com/umputun/remark42)
- **Cost:** free (MIT), but **she must run a server**: one program or Docker, data in a single embedded file, no separate database. [GitHub](https://github.com/umputun/remark42). The cheapest Hetzner cloud server, for example, is from €5.49/month before VAT. [hetzner.com/cloud](https://www.hetzner.com/cloud/)
- **Moderation:** admins can delete comments and block users; banned-word lists; score thresholds; no pre-moderation setting found in the parameters page. Email/Telegram notifications to admins. [parameters](https://remark42.com/docs/configuration/parameters/)
- **Privacy:** says it does not track users; it uses an HttpOnly login cookie. [parameters](https://remark42.com/docs/configuration/parameters/)
- **Export:** JSON export and automatic backups; imports from Disqus and WordPress. [GitHub](https://github.com/umputun/remark42)
- **Status:** v1.18.0, 11 Oct (2026). [releases](https://github.com/umputun/remark42/releases)
- **Effort:** medium to large (server, domain, HTTPS, updates).

### Commento / Commento++ / Comentario
- **Commento (original):** commento.io and its pricing page returned 404 on 21 Nov 2026; treat it as gone.
- **Commento++:** fork with Akismet and Perspective spam checks, moderation, thread locking, Disqus import; guests can leave a name; **needs PostgreSQL and a server**; MIT. [github.com/souramoo/commentoplusplus](https://github.com/souramoo/commentoplusplus)
- **Comentario:** the active successor. Optional **commenting without registration, including anonymous**; per-site rules that send comments to moderation (first-time commenters, links, etc.); Akismet, APILayer SpamChecker and Perspective checks; imports from Disqus, WordPress, Commento; **JSON export**; “no tracking scripts or pixels, and shows no ads”. [features](https://docs.comentario.app/en/about/features/). MIT licence. [GitLab](https://gitlab.com/comentario/comentario). Self-hosting needs a database and a server; “a managed cloud version is available” (price not found). [getting started](https://docs.comentario.app/en/getting-started/)
- **Effort:** medium (cloud) to large (self-host).

### Hyvor Talk
- **Sign-in:** **guest commenting is on by default**; name required, email optional (used for reply notifications, visible to the site owner). [docs](https://hyvor.com/talk/docs/commenting)
- **Cost:** no free tier; 14-day trial, no card. **Personal €5/month or €50/year**: 1 website, 2,500 credits a month, 1 moderator. Comments cost 1 credit; embed loads also use credits (the page gives no exact page-view figure). Going over two months running pauses the embed until the next month. [pricing](https://hyvor.com/talk/pricing)
- **Spam / moderation:** Akismet or their FortGuard filter; shadow-banning, IP controls, trusted users, email moderation, rules. [hyvor.com/talk](https://hyvor.com/talk)
- **Privacy:** “GDPR compliant”, no ads or tracking codes added; cookie use not stated. [hyvor.com/talk](https://hyvor.com/talk)
- **Export:** data can be exported any time; Disqus/WordPress import. [hyvor.com/talk](https://hyvor.com/talk)
- **Effort:** small (script snippet plus one setting per page).

### Isso
- **Sign-in:** none; name and email are optional by default (`require-author`, `require-email` both off). [server config](https://isso-comments.de/docs/reference/server-config/)
- **Moderation:** optional queue (new comments hidden until approved), rate limit (2 a minute by default), email notifications with approve/delete links. [server config](https://isso-comments.de/docs/reference/server-config/)
- **Needs:** a server with Python 3.8+ and SQLite; MIT; Disqus/WordPress import. [GitHub](https://github.com/posativ/isso). Latest release 0.14.0 (26 March). [releases](https://github.com/isso-comments/isso/releases)
- **Privacy:** sets a cookie (used so people can edit their own comments for 15 minutes). [server config](https://isso-comments.de/docs/reference/server-config/)
- **Effort:** large (server upkeep).

### Cactus Comments
- Comments run on Matrix; people log in through any Matrix server; free and funded by donations; LGPL/AGPL. [cactus.chat](https://cactus.chat/). No recent (2025–26) news found; latest dated items are from about 2021–2023. [search summary of cactus.chat, GitLab](https://cactus.chat/blog)
- **For her:** family would not have Matrix accounts. Poor fit.

### Staticman
- Turns each comment into a **pull request** on her repo (so she approves by merging); needs **her own Staticman instance** on a Node.js host. [staticman docs](https://best.staticman.net/docs/)
- Site rebuild per comment; setup is developer-level. Poor fit.

### Disqus
- Free Basic plan is **ad-supported**; sites that can’t run ads may not qualify. [Disqus help](https://help.disqus.com/articles/1717110). Plus about $12/month (ads can be turned off), Pro about $115/month; live pricing page did not load, so these come from Disqus’s own getting-started page via search. [about.disqus.com](https://about.disqus.com/disqus-101/getting-started-with-disqus)
- **Privacy:** Disqus and partners set cookies to track visits across sites for advertising, and share data with affiliate Zeta Global. [Disqus privacy policy](https://help.disqus.com/en/articles/1717103-disqus-features-and-pricing)
- **For her:** would need a cookie consent banner under UK rules (see below). Not recommended.

### Newer or other options
- **FastComments:** usage-based, billed in GBP; first site and first admin free, then about £0.72 per 100k page loads; “Most sites only pay $0.99”. Only functional login cookies (no banner needed, by their account). EU data option (eu.fastcomments.com). Guest commenting **not confirmed** on the pricing page. [pricing](https://fastcomments.com/traffic-pricing)
- **Bluesky / Mastodon replies as comments:** a small script shows replies to a social post under the blog post; writing a comment still happens on Bluesky/Mastodon, so commenters need an account there. [Frontend Masters](https://frontendmasters.com/blog/?p=4962), [handyman5](https://handyman5.github.io/posts/bluesky-comments)
- **No comment box at all:** a “Send me a note” email link per post. No service, no spam, no privacy notice for a third party. (Not a researched product; listed for completeness.)

---

## UK privacy notes
- Non-essential cookies need **active consent**; carrying on browsing is not enough; strictly necessary cookies are exempt. The rule covers anyone storing information on a visitor’s device, so third-party widgets count. [ICO, cookies guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/) (The ICO says this guidance is being revised.)
- GitHub Pages itself logs visitors’ IP addresses for security. [GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)
- Any comment system means storing commenters’ names (and maybe emails). Claude’s suggestion (not decided): a short plain-English note under the comment box saying where comments are stored and how to ask for one to be removed.

---

## Shortlist for her situation — Claude’s suggestion (not decided)

1. **Hyvor Talk, Personal (€50/year).** Guests comment with just a name, spam filter included, nothing to run, export available. Watch the 2,500-credit allowance.
2. **Comentario (managed cloud, if the price suits).** Anonymous comments, first-comment moderation, JSON export, open source (so it can be moved to self-hosting later).
3. **Email link instead of comments.** Free and zero upkeep; family reply privately. Easy to swap for 1 or 2 later because the comment box is already built and switched off.
4. **giscus.** Only if she is happy for comments to come from people with GitHub accounts (free, data in her repo).

Not suggested: Cusdis (deprecated), Disqus (ads and tracking), Remark42/Isso/Staticman/Commento++ (each needs a server she would have to keep running), Cactus (Matrix accounts).
