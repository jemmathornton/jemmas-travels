// Jemma's Travels: the whole site, drawn from TRAVELS (js/data.js, built from data/ by tools/build.py).
"use strict";
const D = TRAVELS;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = n => ICONS[n] || "";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LOCAL = ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname);
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + "s")}`;

// ---------- data helpers ----------
const sortKey = t => t.from.length === 4 ? t.from + "-00" : t.from;
const TRIPS = [...D.trips].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
const tripById = Object.fromEntries(TRIPS.map(t => [t.id, t]));
const year = t => t.from.slice(0, 4);
const YEARS = [...new Set(TRIPS.map(year))];
const postsOf = id => D.posts.filter(p => p.trip === id);
const country = c => D.countries[c] || { name: c, continent: "", at: [0, 0] };
const VISITED = [...new Set(TRIPS.flatMap(t => t.countries))].filter(c => c !== D.home);
const TOTAL_COUNTRIES = Object.values(D.continentTotals).reduce((a, b) => a + b, 0);

function monthOf(s) { return s.length > 4 ? +s.slice(5, 7) : 0; }
function fmtRange(t) {
  const [fy, fm, ty, tm] = [year(t), monthOf(t.from), t.to.slice(0, 4), monthOf(t.to)];
  if (!fm) return fy;
  if (fy === ty && fm === tm) return `${MONTHS[fm - 1]} ${fy}`;
  if (fy === ty) return `${MONTHS[fm - 1]} – ${MONTHS[tm - 1]} ${fy}`;
  return `${MONTHS[fm - 1]} ${fy} – ${MONTHS[tm - 1]} ${ty}`;
}
function tripMonths(t) { // [[year, month], …] the trip touches; empty when the month isn't known
  const out = []; let y = +year(t), m = monthOf(t.from); const ty = +t.to.slice(0, 4), tm = monthOf(t.to);
  if (!m) return out;
  while (y < ty || (y === ty && m <= tm)) { out.push([y, m]); if (++m > 12) { m = 1; y++; } }
  return out;
}
function dayLabel(p) {
  if (p.dates) return p.dates.replace(" to ", " – ");
  if (!p.days) return "";
  const [a, b] = p.days.split("-").map(s => s.trim());
  return b ? `Days ${a}–${b}` : `Day ${a}`;
}
function dayCount(p) { if (!p.days) return 1; const [a, b] = p.days.split("-").map(Number); return b ? b - a + 1 : 1; }
function pinsFor(trips) {
  const pins = [];
  for (const t of trips) {
    if (t.places) for (const [name, lat, lon] of t.places) pins.push({ lat, lon, label: name, title: `${name} · ${t.title}`, href: `#/trip/${t.id}` });
    for (const c of t.countries) {
      if (t.places && t.places.length >= t.countries.length) continue;
      const k = country(c); pins.push({ lat: k.at[0], lon: k.at[1], label: k.name, title: `${k.name} · ${t.title}`, href: `#/trip/${t.id}` });
    }
  }
  return pins;
}
function placePins(trips) { // only places she named on a trip
  return trips.flatMap(t => (t.places || []).map(([name, lat, lon]) => ({ lat, lon, label: name, title: `${name} · ${t.title}`, href: `#/trip/${t.id}` })));
}
function countryPins() {
  return VISITED.map(c => { const k = country(c); return { lat: k.at[0], lon: k.at[1], label: k.name, href: `#/country/${c}` }; });
}
function isoOf(c) { return country(c).iso; }
function mapOpts(codes) { const links = {}; codes.forEach(c => { links[isoOf(c)] = `#/country/${c}`; }); return { visited: codes.map(isoOf), links }; }
const _main = {};
function mainBox(c) { // bounding box of a country's biggest piece (so France means mainland France, the US the lower 48)
  if (_main[c]) return _main[c];
  const shape = WORLD.hi[isoOf(c)]; if (!shape) { const a = country(c).at; return [a[1] - 3, a[0] - 3, a[1] + 3, a[0] + 3]; }
  let best = null, bestA = -1;
  for (const r of shape[1]) {
    let a = 0; for (let i = 0; i < r.length - 2; i += 2) a += r[i] * r[i + 3] - r[i + 2] * r[i + 1];
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = r; }
  }
  let w = 180, s = 90, e = -180, n = -90;
  for (let i = 0; i < best.length; i += 2) { w = Math.min(w, best[i]); e = Math.max(e, best[i]); s = Math.min(s, best[i + 1]); n = Math.max(n, best[i + 1]); }
  return (_main[c] = [w, s, e, n]);
}
function focusOn(codes, pins = []) {
  let w = 180, s = 90, e = -180, n = -90;
  for (const c of codes) { const b = mainBox(c); w = Math.min(w, b[0]); s = Math.min(s, b[1]); e = Math.max(e, b[2]); n = Math.max(n, b[3]); }
  for (const p of pins) { w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat); }
  const px = Math.max(3, (e - w) * 0.18), py = Math.max(2, (n - s) * 0.18);
  w -= px; e += px; s -= py; n += py;
  const midLat = Math.cos(((s + n) / 2) * Math.PI / 180);
  const wide = (e - w) * midLat, tall = n - s;
  if (wide < tall * 1.7) { const c = (w + e) / 2, h = tall * 1.7 / midLat / 2; w = c - h; e = c + h; }
  else if (tall < wide / 2.4) { const c = (s + n) / 2, h = wide / 2.4 / 2; s = c - h; n = c + h; }
  return [Math.max(-180, w), Math.max(-85, s), Math.min(180, e), Math.min(85, n)];
}
function focusFor(pins) {
  const lats = pins.map(p => p.lat), lons = pins.map(p => p.lon);
  let [w, e, s, n] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const padX = Math.max(14, (e - w) * 0.35), padY = Math.max(9, (n - s) * 0.35);
  w -= padX; e += padX; s -= padY; n += padY;
  if ((e - w) < (n - s) * 2.2) { const c = (w + e) / 2, h = (n - s) * 1.1; w = c - h; e = c + h; }
  return [w, s, e, n];
}
function km(a, b) {
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- small pieces ----------
function ph(text) { // her words, or a marked placeholder
  const s = String(text || "");
  if (s.startsWith("[placeholder]")) return `<span class="ph-text">${esc(s.slice(13).trim())}</span> <span class="ph">Placeholder</span>`;
  return esc(s);
}
function tint(id) { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997; return 160 + (h % 32); }
function photo(trip, file, i, cls = "") {
  if (file) return `<figure class="photo ${cls}"><img src="photos/${esc(trip)}/${esc(file)}" alt="" loading="lazy"></figure>`;
  return `<figure class="photo empty ${cls}" style="--h:${tint(trip + i)}"><span>${icon("camera")}Your photo</span></figure>`;
}
function cover(t) {
  const first = postsOf(t.id).flatMap(p => p.photos).find(Boolean);
  return photo(t.id, first, 0, "cover");
}
function chips(codes) { return codes.map(c => `<a class="chip" href="#/country/${c}">${esc(country(c).name)}</a>`).join(""); }
function tripCard(t) {
  const n = postsOf(t.id).length;
  return `<article class="trip-card">
    <a class="trip-cover" href="#/trip/${t.id}" tabindex="-1" aria-hidden="true">${cover(t)}<span class="stamp">${esc(t.countries.join(" · "))}</span></a>
    <div class="trip-body">
      <div class="when">${icon("calendar")}${esc(fmtRange(t))}</div>
      <h3><a href="#/trip/${t.id}">${esc(t.title)}</a></h3>
      <div class="chips">${chips(t.countries)}</div>
      <div class="meta">${n ? plural(n, "post") : "No posts yet"}</div>
    </div></article>`;
}
function yearGroups(trips) {
  const ys = [...new Set(trips.map(year))];
  return ys.map(y => {
    const ts = trips.filter(t => year(t) === y);
    return `<section class="year-group" id="y${y}"><h2 class="year-h"><a href="#/year/${y}">${y}</a><small>${plural(ts.length, "trip")}</small></h2>
      <div class="trip-grid">${ts.map(tripCard).join("")}</div></section>`;
  }).join("");
}
function postTile(p) {
  const t = tripById[p.trip];
  return `<article class="post-tile"><a href="#/trip/${p.trip}/${p.slug}" tabindex="-1" aria-hidden="true">${photo(p.trip, p.photos[0], 0, "cover")}</a>
    <div class="post-meta"><span class="day">${esc(dayLabel(p))}</span><a href="#/trip/${t.id}">${esc(t.title)}</a></div>
    <h3><a href="#/trip/${p.trip}/${p.slug}">${ph(p.title)}</a></h3><div class="meta">${esc(fmtRange(t))} · ${plural(p.photos.length, "photo")}</div></article>`;
}
function postCard(p, opts = {}) {
  const t = tripById[p.trip];
  const strip = p.photos.slice(0, 4).map((f, i) => photo(p.trip, f, i, "thumb")).join("");
  return `<article class="post-card">
    <div class="post-meta"><span class="day">${esc(dayLabel(p))}</span>${opts.trip ? `<a href="#/trip/${t.id}">${esc(t.title)}</a> · ${esc(fmtRange(t))}` : ""}${p.place ? `<span class="place">${icon("map-pin")}${ph(p.place)}</span>` : ""}</div>
    <h3><a href="#/trip/${p.trip}/${p.slug}">${ph(p.title)}</a></h3>
    ${p.text[0] ? `<p class="excerpt">${ph(p.text[0])}</p>` : ""}
    ${strip ? `<div class="strip">${strip}</div>` : ""}
    <a class="more" href="#/trip/${p.trip}/${p.slug}">Read post ${icon("arrow-right")}</a>
  </article>`;
}
function statTiles(items) {
  return `<div class="stat-row">${items.map(([n, label, href]) =>
    `<${href ? `a href="${href}"` : "div"} class="stat"><b>${n}</b><span>${esc(label)}</span></${href ? "a" : "div"}>`).join("")}</div>`;
}
function head(title, kicker, extra = "") {
  return `<header class="page-head">${kicker ? `<div class="kicker">${kicker}</div>` : ""}<h1>${title}</h1>${extra}</header>`;
}
function comments() {
  return `<section class="comments" aria-label="Comments"><h2>${icon("message")}Comments</h2>
    <div class="comment-box"><textarea disabled placeholder="Comments open when the site goes online"></textarea><button disabled>Post</button></div>
    <p class="note">Comments switch on when the site goes online (your choice, 21 Nov).</p></section>`;
}

// ---------- pages ----------
function pageHome() {
  const latest = TRIPS.flatMap(t => postsOf(t.id)).slice(0, 3);
  const continents = new Set(VISITED.map(c => country(c).continent));
  return `<section class="hero">
      <div class="hero-map">${worldMap(placePins(TRIPS), { ...mapOpts(VISITED), aria: "Countries visited" })}</div>
      <div class="hero-text"><div class="kicker">${plural(TRIPS.length, "trip")} · ${YEARS[YEARS.length - 1]} to ${YEARS[0]}</div>
      <h1>Jemma’s <em>Travels</em></h1>
      <p class="tagline"><span class="ph-text">A line about these travels, in your own words.</span> <span class="ph">Placeholder</span></p></div>
    </section>
    ${statTiles([[TRIPS.length, "trips", "#/trips"], [VISITED.length, "countries", "#/countries"], [continents.size, "continents", "#/countries"], [YEARS.length, "years travelled", "#/stats"]])}
    ${latest.length ? `<section class="sec"><h2 class="sec-h">Latest posts</h2><div class="post-tiles">${latest.map(postTile).join("")}</div></section>` : ""}
    <section class="sec"><h2 class="sec-h">Trips by year</h2>${yearGroups(TRIPS)}</section>`;
}
function yearChips(active) {
  return `<div class="filters"><a class="fchip ${active ? "" : "on"}" href="#/trips">All</a>${YEARS.map(y => `<a class="fchip ${active === y ? "on" : ""}" href="#/year/${y}">${y}</a>`).join("")}</div>`;
}
function pageTrips(y) {
  const ts = y ? TRIPS.filter(t => year(t) === y) : TRIPS;
  return head(y ? `${y}` : "Trips", y ? `${plural(ts.length, "trip")}` : `${plural(TRIPS.length, "trip")} · newest first`, yearChips(y)) + yearGroups(ts);
}
function pageTrip(id) {
  const t = tripById[id]; if (!t) return notFound();
  const posts = postsOf(id), pins = pinsFor([t]);
  const photos = posts.reduce((n, p) => n + p.photos.length, 0);
  return `<nav class="crumbs"><a href="#/trips">Trips</a> › <a href="#/year/${year(t)}">${year(t)}</a></nav>
    <header class="trip-head">
      <div class="trip-head-text"><div class="kicker">${icon("calendar")}${esc(fmtRange(t))}</div><h1>${esc(t.title)}</h1>
        <div class="chips">${chips(t.countries)}</div>
        <div class="meta">${posts.length ? `${plural(posts.length, "post")} · ${plural(photos, "photo")}` : "No posts yet"}</div></div>
      <div class="trip-map">${worldMap(placePins([t]), { ...mapOpts(t.countries), focus: focusOn(t.countries, placePins([t])), labels: true, aria: `Map of ${t.title}` })}</div>
    </header>
    ${posts.length ? `<div class="post-list">${posts.map(p => postCard(p)).join("")}</div>`
      : `<div class="empty-note">${icon("pen")}<p>No posts for this trip yet.</p></div>`}`;
}
function pagePost(id, slug) {
  const t = tripById[id]; const posts = postsOf(id); const i = posts.findIndex(p => p.slug === slug);
  if (!t || i < 0) return notFound();
  const p = posts[i], prev = posts[i - 1], next = posts[i + 1];
  return `<nav class="crumbs"><a href="#/trips">Trips</a> › <a href="#/year/${year(t)}">${year(t)}</a> › <a href="#/trip/${t.id}">${esc(t.title)}</a></nav>
    <article class="post">
      <header><div class="post-meta"><span class="day">${esc(dayLabel(p))}</span>${esc(fmtRange(t))}${p.place ? `<span class="place">${icon("map-pin")}${ph(p.place)}</span>` : ""}</div>
      <h1>${ph(p.title)}</h1></header>
      <div class="post-text">${p.text.map(x => `<p>${ph(x)}</p>`).join("")}</div>
      ${p.photos.length ? `<div class="gallery n${Math.min(p.photos.length, 5)}">${p.photos.map((f, j) => photo(id, f, j)).join("")}</div>` : ""}
      <nav class="post-nav">${prev ? `<a href="#/trip/${id}/${prev.slug}">${icon("chevron-left")}<span><small>${esc(dayLabel(prev))}</small>${ph(prev.title)}</span></a>` : "<span></span>"}
        ${next ? `<a class="next" href="#/trip/${id}/${next.slug}"><span><small>${esc(dayLabel(next))}</small>${ph(next.title)}</span>${icon("chevron-right")}</a>` : "<span></span>"}</nav>
    </article>${comments()}`;
}
function pageMap() {
  const byCont = {};
  for (const c of VISITED) (byCont[country(c).continent] ||= []).push(c);
  return head("Map", `${plural(VISITED.length, "country", "countries")} · ${plural(TRIPS.length, "trip")}`) +
    `<div class="big-map">${worldMap(placePins(TRIPS), { ...mapOpts(VISITED), aria: "Every country visited" })}</div>
    <p class="note map-note">${icon("info")}Countries you’ve been to are coloured in; pins are places named on a trip. Map: Natural Earth.</p>
    <div class="cont-cols">${Object.entries(byCont).map(([k, cs]) => `<section><h3>${esc(k)}</h3><ul>${cs.map(c => {
      const ts = TRIPS.filter(t => t.countries.includes(c));
      return `<li><a href="#/country/${c}">${esc(country(c).name)}</a><span>${ts.map(t => year(t)).join(", ")}</span></li>`;
    }).join("")}</ul></section>`).join("")}</div>`;
}
function pageCountries() {
  const pct = VISITED.length / TOTAL_COUNTRIES;
  const conts = Object.entries(D.continentTotals).map(([k, n]) => [k, VISITED.filter(c => country(c).continent === k).length, n]);
  const C = 2 * Math.PI * 52;
  return head("Countries", "Tracker") + `<div class="tracker">
    <div class="ring"><svg viewBox="0 0 120 120" role="img" aria-label="${VISITED.length} of ${TOTAL_COUNTRIES} countries"><circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg" cx="60" cy="60" r="52" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/></svg>
      <div><b>${VISITED.length}</b><span>of ${TOTAL_COUNTRIES} countries</span><small>${(pct * 100).toFixed(1)}% of the world</small></div></div>
    <div class="cont-bars">${conts.map(([k, v, n]) => `<div class="cbar" title="${esc(k)}: ${v} of ${n}"><span class="cname">${esc(k)}</span><span class="track"><i style="width:${Math.max(v ? 2 : 0, v / n * 100)}%"></i></span><span class="cval">${v} <small>of ${n}</small></span></div>`).join("")}</div>
  </div>
  <section class="sec"><h2 class="sec-h">Visited</h2><div class="country-grid">${VISITED.map(c => {
    const ts = TRIPS.filter(t => t.countries.includes(c));
    return `<a class="ctile" href="#/country/${c}"><span class="code">${c}</span><b>${esc(country(c).name)}</b><small>${plural(ts.length, "trip")} · ${[...new Set(ts.map(year))].join(", ")}</small></a>`;
  }).join("")}</div>
  <p class="note">Home (${esc(country(D.home).name)}) isn’t counted. Out of 195: the UN’s members plus the Vatican and Palestine.</p></section>`;
}
function pageCountry(code) {
  const k = D.countries[code]; if (!k) return notFound();
  const ts = TRIPS.filter(t => t.countries.includes(code));
    return `<nav class="crumbs"><a href="#/countries">Countries</a> › ${esc(k.continent)}</nav>` +
    head(esc(k.name), `${plural(ts.length, "trip")} · ${esc(k.continent)}`) +
    `<div class="trip-map wide">${worldMap(placePins(ts).filter(p => ts.some(t => t.countries.length === 1)), { ...mapOpts([code]), focus: focusOn([code]), labels: true, aria: `Map of ${k.name}` })}</div>
    <div class="trip-grid">${ts.map(tripCard).join("")}</div>`;
}
function pageStats() {
  const first = TRIPS[TRIPS.length - 1];
  const ys = YEARS.map(Number), span = []; for (let y = ys[ys.length - 1]; y <= ys[0]; y++) span.push(y);
  const perYear = span.map(y => [y, TRIPS.filter(t => +year(t) === y).length]);
  const maxY = Math.max(...perYear.map(x => x[1]));
  let gap = [0, 0, 0]; for (let i = 0; i < ys.length - 1; i++) if (ys[i] - ys[i + 1] > gap[0]) gap = [ys[i] - ys[i + 1], ys[i + 1], ys[i]];
  const monthN = Array(12).fill(0); TRIPS.forEach(t => new Set(tripMonths(t).map(x => x[1])).forEach(m => monthN[m - 1]++));
  const maxM = Math.max(...monthN), topMonth = monthN.indexOf(maxM);
  const counts = VISITED.map(c => [c, TRIPS.filter(t => t.countries.includes(c)).length]).sort((a, b) => b[1] - a[1]);
  const most = counts.filter(x => x[1] === counts[0][1]);
  const home = D.homeAt || country(D.home).at;
  const far = VISITED.map(c => [c, km(home, country(c).at)]).sort((a, b) => b[1] - a[1])[0];
  const busiest = Math.max(...perYear.map(x => x[1]));
  const busyYears = perYear.filter(x => x[1] === busiest).map(x => x[0]);
  const posts = D.posts.length, photos = D.posts.reduce((n, p) => n + p.photos.length, 0);
  const days = D.posts.reduce((n, p) => n + dayCount(p), 0);
  const continents = new Set(VISITED.map(c => country(c).continent));
  const fact = (k, v, s) => `<div class="fact"><span class="fk">${k}</span><b>${v}</b>${s ? `<small>${s}</small>` : ""}</div>`;
  return head("Stats", "For fun") + `<div class="facts">
      ${fact("Countries", VISITED.length, `of ${TOTAL_COUNTRIES}`)}
      ${fact("Continents", continents.size, "of 7")}
      ${fact("Trips", TRIPS.length, `${YEARS.length} different years`)}
      ${fact("Favourite month", MONTHS[topMonth], `${maxM} of ${TRIPS.length} trips`)}
      ${fact("Most visited", most.map(x => esc(country(x[0]).name)).join(", "), `${plural(most[0][1], "trip")} each`)}
      ${fact("Furthest from home", esc(country(far[0]).name), `about ${(Math.round(far[1] / 100) * 100).toLocaleString("en-GB")} km from ${esc(D.homeTown || "home")}`)}
      ${fact("Busiest year", busyYears.join(", "), `${plural(busiest, "trip")}`)}
      ${fact("First on record", esc(first.title), esc(fmtRange(first)))}
      ${fact("Longest gap", plural(gap[0], "year"), `${gap[1]} to ${gap[2]}`)}
      ${fact("Written so far", plural(posts, "post"), `${plural(days, "day")} · ${plural(photos, "photo")}`)}
    </div>
    <section class="sec chart-sec"><h2 class="sec-h">Trips each year</h2>
      <div class="bars" role="img" aria-label="Trips each year">${perYear.map(([y, n]) => `<div class="bar" title="${y}: ${plural(n, "trip")}"><span class="bv">${n || ""}</span><i style="height:${n / maxY * 100}%"></i><span class="bl">${String(y).slice(2)}</span></div>`).join("")}</div>
      <p class="note">Years from ${span[0]} to ${span[span.length - 1]}; labels are the last two digits.</p></section>
    <section class="sec chart-sec"><h2 class="sec-h">Which months</h2>
      <div class="months">${monthN.map((n, i) => `<div class="mcell ${n / maxM > 0.5 ? "dark" : ""}" style="--a:${n ? 0.18 + 0.82 * n / maxM : 0}" title="${MONTHS[i]}: ${plural(n, "trip")}"><b>${n || ""}</b><span>${MONTHS[i].slice(0, 3)}</span></div>`).join("")}</div>
      <p class="note">Trips away in each month.</p></section>`;
}
function pageWrite() {
  if (!LOCAL) return notFound();
  return head("Write a post", "Only on your PC") + `<p class="note banner-note">${icon("info")}Mock-up for choosing (not saving yet). This page only exists on your own computer, so no sign-in is needed: online, there is no way to write.</p>
    <form class="write" onsubmit="event.preventDefault()">
      <label>Trip<select>${TRIPS.map(t => `<option>${esc(t.title)} · ${esc(fmtRange(t))}</option>`).join("")}<option>+ New trip…</option></select></label>
      <div class="two"><label>Day or days<input placeholder="e.g. 3, or 2-4"></label><label>Where<input placeholder="e.g. Kyoto"></label></div>
      <label>Title<input placeholder="Title for this post"></label>
      <label>Notes<textarea rows="9" placeholder="Write as much or as little as you like. A blank line starts a new paragraph."></textarea></label>
      <div class="drop">${icon("upload")}<b>Drop photos here</b><span>or click to choose · they’re resized and copied into the site</span></div>
      <div class="actions"><button class="primary" disabled>${icon("pen")}Save post</button><span class="note">Saved posts go online the next time the site is published.</span></div>
    </form>`;
}
function notFound() { return head("Not found", "") + `<p><a href="#/">Back to the start</a></p>`; }

// ---------- shell ----------
function nav(route) {
  const item = (href, ic, label, on, n) => `<a href="${href}" class="${on ? "on" : ""}">${icon(ic)}<span>${label}</span>${n != null ? `<small>${n}</small>` : ""}</a>`;
  const r = route[0] || "";
  return `<div class="nav-main">${item("#/", "home", "Home", r === "")}${item("#/trips", "plane", "Trips", r === "trips" || r === "trip" || r === "year", TRIPS.length)}${item("#/map", "map", "Map", r === "map")}${item("#/countries", "globe", "Countries", r === "countries" || r === "country", VISITED.length)}${item("#/stats", "chart", "Stats", r === "stats")}${LOCAL ? item("#/write", "pen", "Write", r === "write") : ""}</div>
    <div class="nav-years"><div class="nav-h">Years</div>${YEARS.map(y => item(`#/year/${y}`, "calendar", y, r === "year" && route[1] === y, TRIPS.filter(t => year(t) === y).length)).join("")}</div>`;
}
function render() {
  const route = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [r, a, b] = route;
  let html;
  if (!r) html = pageHome();
  else if (r === "trips") html = pageTrips();
  else if (r === "year") html = pageTrips(a);
  else if (r === "trip") html = b ? pagePost(a, b) : pageTrip(a);
  else if (r === "map") html = pageMap();
  else if (r === "countries") html = pageCountries();
  else if (r === "country") html = pageCountry(a);
  else if (r === "stats") html = pageStats();
  else if (r === "write") html = pageWrite();
  else html = notFound();
  $("#view").innerHTML = html;
  $("#nav").innerHTML = nav(route);
  document.body.dataset.page = r || "home";
  setMenu(false);
  const t = $("#view h1"); document.title = (r && t ? t.textContent.replace("Placeholder", "").trim() + " · " : "") + "Jemma’s Travels";
  window.scrollTo(0, 0);
}
$("#foot").innerHTML = `<b>Jemma’s Travels</b><span>No cookies, no tracking, no ads.</span><span>Fonts: Instrument Serif and Manrope · Icons by Lucide</span>`;
$("#menuBtn").innerHTML = icon("menu");
// phone menu: slides in from the left over the page (her ask, 21 Nov: it used to push the page down)
function setMenu(o) { document.body.classList.toggle("menu-open", o); $("#menuBtn").setAttribute("aria-expanded", o); $("#menuBtn").innerHTML = icon(o ? "x" : "menu"); }
$("#menuBtn").onclick = () => setMenu(!document.body.classList.contains("menu-open"));
const scrim = document.createElement("div"); scrim.className = "scrim"; scrim.onclick = () => setMenu(false); $("#side").appendChild(scrim);
addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
addEventListener("hashchange", render);

// ---------- trial switch (only while she is choosing; round 3: Old Atlas variations) ----------
// Each row sets one attribute on <html>; ?layout=…&header=…&bg=… in the address picks them too.
const TRIAL = {
  layout: { label: "Sidebar", opts: { "side-pale-grid": "Pale with faint grid", "side-pale": "Pale, plain", "side-sea": "Sea green" } },
};
function setTrial(row, k) {
  document.documentElement.dataset[row] = k;
  try { localStorage.setItem("jt-" + row, k); } catch (e) {}
  document.querySelectorAll(`.trial button[data-row="${row}"]`).forEach(b => b.classList.toggle("on", b.dataset.k === k));
}
(function trial() {
  const q = new URLSearchParams(location.search);
  document.documentElement.dataset.look = "f";
  document.documentElement.dataset.header = "banner";   // her pick, 21 Nov
  document.documentElement.dataset.bg = "plain";        // her pick, 21 Nov
  const box = document.createElement("div"); box.className = "trial";
  box.innerHTML = Object.entries(TRIAL).map(([row, t]) => `<div class="trow"><span>${t.label}</span>${Object.entries(t.opts).map(([k, v]) => `<button data-row="${row}" data-k="${k}">${v}</button>`).join("")}</div>`).join("");
  box.onclick = e => { const b = e.target.closest("button"); if (b) setTrial(b.dataset.row, b.dataset.k); };
  if (q.get("trial") !== "off") document.body.appendChild(box);
  for (const [row, t] of Object.entries(TRIAL)) {
    let k = q.get(row); if (!k) try { k = localStorage.getItem("jt-" + row); } catch (e) {}
    setTrial(row, t.opts[k] ? k : Object.keys(t.opts)[0]);
  }
})();
render();
