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
function fmtRange(t) { // "September 2026", "May – June 2020", "December 2026 – January 2027", "2026", "2014 – 2015"
  const fy = t.from.slice(0, 4), fm = monthOf(t.from), ty = t.to.slice(0, 4), tm = monthOf(t.to);
  const one = (y, m) => m ? `${MONTHS[m - 1]} ${y}` : y;
  if (fy === ty) return fm === tm ? one(fy, fm) : fm && tm ? `${MONTHS[fm - 1]} – ${MONTHS[tm - 1]} ${fy}` : fy;
  return `${one(fy, fm)} – ${one(ty, tm)}`;
}
function tripMonths(t) { // [[year, month], …] the trip touches; empty when the month isn't known
  const out = []; let y = +year(t), m = monthOf(t.from); const ty = +t.to.slice(0, 4), tm = monthOf(t.to);
  if (!m) return out;
  while (y < ty || (y === ty && m <= tm)) { out.push([y, m]); if (++m > 12) { m = 1; y++; } }
  return out;
}
function fmtDates(d) { // "2026-03-05" -> "5 March"; "2026-03-06 to 2026-03-07" -> "6–7 March"; across months/years in full
  const [a, b] = String(d).split(/\s+to\s+/).map(x => x.split("-").map(Number));
  if (!a || a.length < 3) return String(d);
  const one = (x, withYear) => `${x[2]} ${MONTHS[x[1] - 1]}${withYear ? " " + x[0] : ""}`;
  if (!b) return one(a);
  if (a[0] === b[0] && a[1] === b[1]) return `${a[2]}–${b[2]} ${MONTHS[a[1] - 1]}`;
  if (a[0] === b[0]) return `${one(a)} – ${one(b)}`;
  return `${one(a, true)} – ${one(b, true)}`;
}
function dayLabel(p) {
  if (p.dates) return fmtDates(p.dates);
  if (!p.days) return "";
  const [a, b] = p.days.split(/\s*[-–]\s*/);
  return b ? `Days ${a}–${b}` : `Day ${a}`;
}
function dayCount(p) { // how many days a post covers (from its days, or its dates)
  if (p.dates) {
    const [a, b] = String(p.dates).split(/\s+to\s+/).map(x => Date.parse(x + "T12:00:00Z"));
    return b && a ? Math.max(1, Math.round((b - a) / 864e5) + 1) : 1;
  }
  if (!p.days) return 1;
  const [a, b] = p.days.split(/\s*[-–]\s*/).map(Number);
  return b > a ? b - a + 1 : 1;
}
function placePins(trips, link = true) { // only places she named on a trip
  return trips.flatMap(t => (t.places || []).map(([name, lat, lon]) => ({ lat, lon, label: name, title: `${name} · ${t.title}`, href: link ? `#/trip/${t.id}` : null })));
}
function inCountry(c, lat, lon) { // is a point inside one of a country's shapes?
  const shape = WORLD.hi[isoOf(c)]; if (!shape) return false;
  return shape[1].some(r => {
    let inside = false;
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
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
  return [Math.max(-360, w), Math.max(-85, s), Math.min(360, e), Math.min(85, n)];   // may go past 180°: the map draws across it
}
// ---------- trial extras (21 Nov, her ask: "mock up and I'll see"): routes, distance, timeline, search ----------
const HOME_AT = () => D.homeAt || country(D.home).at;
function tripStops(t) { // where a trip went, in order: the places she named, or else each country's own point
  return t.places && t.places.length ? t.places.map(([, lat, lon]) => [lat, lon]) : t.countries.map(c => country(c).at);
}
function tripRoute(t) { return [HOME_AT(), ...tripStops(t), HOME_AT()]; }   // from home and back
function tripKm(t) { const r = tripRoute(t); let n = 0; for (let i = 0; i < r.length - 1; i++) n += km(r[i], r[i + 1]); return n; }
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
function photo(trip, file, i, cls = "", alt = "") {
  if (file) return `<figure class="photo ${cls}"><img src="photos/${encodeURIComponent(trip)}/${encodeURIComponent(file)}" alt="${esc(alt)}" loading="lazy"></figure>`;
  return `<figure class="photo empty ${cls}" style="--h:${tint(trip + i)}"><span>${icon("camera")}Photo to come</span></figure>`;
}
function cover(t) {
  const first = t.cover || postsOf(t.id).flatMap(p => p.photos).find(Boolean);
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
function yearGroups(trips, h = "h2") {
  const ys = [...new Set(trips.map(year))];
  return ys.map(y => {
    const ts = trips.filter(t => year(t) === y);
    return `<section class="year-group" id="y${y}"><${h} class="year-h"><a href="#/year/${y}">${y}</a><small>${plural(ts.length, "trip")}</small></${h}>
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
    ${p.text.find(x => !isPhotoMark(x)) ? `<p class="excerpt">${ph(p.text.find(x => !isPhotoMark(x)))}</p>` : ""}
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
    <p class="note">Comments will open when the site goes online.</p></section>`;
}

// ---------- pages ----------
// "This time of year" (21 Nov, instead of "on this day" until posts have dates): trips in this month in other years
function thisTimeOfYear(now = new Date()) {
  const m = now.getMonth() + 1, y = now.getFullYear();
  const ts = TRIPS.filter(t => tripMonths(t).some(([ty, tm]) => tm === m && ty !== y));
  if (!ts.length) return "";
  return `<section class="sec"><h2 class="sec-h">This time of year <span class="trial-tag">trial</span></h2><p class="note">Trips in ${MONTHS[m - 1]} in other years.</p><div class="trip-grid">${ts.map(tripCard).join("")}</div></section>`;
}
function surprisePost() { // a random post that isn't a placeholder, or a random trip if there are none yet
  const real = D.posts.filter(p => !p.placeholder);
  if (real.length) { const p = real[Math.floor(Math.random() * real.length)]; return `#/trip/${p.trip}/${p.slug}`; }
  return `#/trip/${TRIPS[Math.floor(Math.random() * TRIPS.length)].id}`;
}
function pageHome() {
  const latest = TRIPS.flatMap(t => postsOf(t.id).slice().reverse()).slice(0, 3);   // newest trip's newest posts first
  const continents = new Set(VISITED.map(c => country(c).continent));
  return `<section class="hero">
      <div class="hero-map">${worldMap(placePins(TRIPS, false), { visited: VISITED.map(isoOf), aria: "World map with the countries visited coloured in" })}</div>
      <div class="hero-text"><div class="kicker">${plural(TRIPS.length, "trip")} · ${YEARS[YEARS.length - 1]} to ${YEARS[0]}</div>
      <h1>Jemma’s <em>Travels</em></h1>
      <p class="tagline"><span class="ph-text">A line about these travels, in your own words.</span> <span class="ph">Placeholder</span></p></div>
    </section>
    ${statTiles([[TRIPS.length, "trips", "#/trips"], [VISITED.length, "countries", "#/countries"], [continents.size, "continents", "#/countries"], [YEARS.length, "years travelled", "#/stats"]])}
    ${thisTimeOfYear()}
    ${latest.length ? `<section class="sec"><h2 class="sec-h">Latest posts</h2><div class="post-tiles">${latest.map(postTile).join("")}</div></section>` : ""}
    <section class="sec"><h2 class="sec-h">Trips by year</h2>${yearGroups(TRIPS, "h3")}</section>`;
}
function yearChips(active) {
  return `<div class="filters"><a class="fchip ${active ? "" : "on"}" href="#/trips">All</a>${YEARS.map(y => `<a class="fchip ${active === y ? "on" : ""}" href="#/year/${y}">${y}</a>`).join("")}</div>`;
}
function pageTrips(y) {
  if (y !== undefined && !YEARS.includes(y)) return notFound();
  const ts = y ? TRIPS.filter(t => year(t) === y) : TRIPS;
  return head(y ? `${y}` : "Trips", y ? `${plural(ts.length, "trip")}` : `${plural(TRIPS.length, "trip")} · newest first`, yearChips(y)) + yearGroups(ts);
}
function pageTrip(id) {
  const t = tripById[id]; if (!t) return notFound();
  const posts = postsOf(id);
  const photos = posts.reduce((n, p) => n + p.photos.length, 0);
  return `<nav class="crumbs"><a href="#/trips">Trips</a> › <a href="#/year/${year(t)}">${year(t)}</a></nav>
    <header class="trip-head">
      <div class="trip-head-text"><div class="kicker">${icon("calendar")}${esc(fmtRange(t))}</div><h1>${esc(t.title)}</h1>
        <div class="chips">${chips(t.countries)}</div>
        <div class="meta">${posts.length ? `${plural(posts.length, "post")} · ${plural(photos, "photo")}` : "No posts yet"}</div></div>
      <div class="trip-map">${worldMap(placePins([t]), { ...mapOpts(t.countries), focus: focusOn(t.countries, placePins([t])), labels: true, routes: (t.places || []).length > 1 ? [tripStops(t)] : [], aria: `Map of ${t.title}` })}</div>
    </header>
    ${posts.length ? `<h2 class="sr-only">Posts</h2><div class="post-list">${posts.map(p => postCard(p)).join("")}</div>`
      : `<div class="empty-note">${icon("pen")}<p>No posts for this trip yet.</p></div>`}`;
}
// A post's words, with photos placed where she puts a marker on a line of its own (see for-jemma/post-templates.md):
//   [photo 2]  [photo 2 wide]  [photo 2 left]  [photo 2 right]  [photo 2 tall]  [photos 3-5]  [photos 3-8 mosaic]
//   anything after a colon is the caption: [photo 2 right: Looking back at the harbour]
// Photos are numbered in the order they're listed in the post's header; any not placed go in a gallery at the end.
const PHOTO_MARK = /^\[(photos?) (\d+)(?:\s*-\s*(\d+))?((?:\s+(?:left|right|wide|tall|mosaic))*)\s*(?::\s*(.+))?\]$/i;
function isPhotoMark(x) { return PHOTO_MARK.test(String(x).trim()); }
function postBody(p) {
  const used = new Set(); let html = "";
  for (const para of p.text) {
    const m = String(para).trim().match(PHOTO_MARK);
    if (!m) { html += `<p>${ph(para)}</p>`; continue; }
    const from = +m[2], to = m[3] ? +m[3] : from, opts = (m[4] || "").toLowerCase().trim().split(/\s+/).filter(Boolean), caption = m[5];
    const idx = []; for (let n = from; n <= to; n++) if (n >= 1 && n <= p.photos.length) { idx.push(n - 1); used.add(n - 1); }
    if (!idx.length) continue;
    const pics = idx.map(j => photo(p.trip, p.photos[j], j, opts.includes("tall") ? "tall" : "", idx.length === 1 && caption && !caption.startsWith("[placeholder]") ? caption : "")).join("");
    const cap = caption ? `<figcaption>${ph(caption)}</figcaption>` : "";
    if (idx.length === 1) {
      const where = ["left", "right", "wide"].find(o => opts.includes(o)) || "full";
      html += `<div class="inline ${where}${opts.includes("tall") ? " is-tall" : ""}">${pics}${cap}</div>`;
    } else {
      const kind = opts.includes("mosaic") ? "mosaic" : "row";
      html += `<div class="inline ${kind} n${Math.min(idx.length, 6)}${opts.includes("wide") ? " wide" : ""}${opts.includes("tall") ? " is-tall" : ""}"><div class="pics">${pics}</div>${cap}</div>`;
    }
  }
  const rest = p.photos.map((f, j) => j).filter(j => !used.has(j));
  return { html, rest };
}
function pagePost(id, slug) {
  const t = tripById[id]; const posts = postsOf(id); const i = posts.findIndex(p => p.slug === slug);
  if (!t || i < 0) return notFound();
  const p = posts[i], prev = posts[i - 1], next = posts[i + 1], body = postBody(p);
  return `<nav class="crumbs"><a href="#/trips">Trips</a> › <a href="#/year/${year(t)}">${year(t)}</a> › <a href="#/trip/${t.id}">${esc(t.title)}</a></nav>
    <article class="post">
      <header><div class="post-meta"><span class="day">${esc(dayLabel(p))}</span>${esc(fmtRange(t))}${p.place ? `<span class="place">${icon("map-pin")}${ph(p.place)}</span>` : ""}</div>
      <h1>${ph(p.title)}</h1></header>
      <div class="post-text">${body.html}</div>
      ${body.rest.length ? `<div class="gallery n${Math.min(body.rest.length, 5)}">${body.rest.map(j => photo(id, p.photos[j], j)).join("")}</div>` : ""}
      <nav class="post-nav">${prev ? `<a href="#/trip/${id}/${prev.slug}">${icon("chevron-left")}<span><small>${esc(dayLabel(prev))}</small>${ph(prev.title)}</span></a>` : "<span></span>"}
        ${next ? `<a class="next" href="#/trip/${id}/${next.slug}"><span><small>${esc(dayLabel(next))}</small>${ph(next.title)}</span>${icon("chevron-right")}</a>` : "<span></span>"}</nav>
    </article>${comments()}`;
}
// Routes, three ways to try (21 Nov, her note: every route at once is a bit much):
//   faint  all routes pale; point at a trip in the list (or its line) to bring it forward
//   year   one year at a time (newest first), year buttons above the map
//   pick   no lines until a trip is chosen from the list; then just that one
const ROUTE_STYLES = { faint: "A · All, faint", year: "B · One year at a time", pick: "C · Pick a trip" };
function pageMap(view, style, which) {
  const byCont = {};
  for (const c of VISITED) (byCont[country(c).continent] ||= []).push(c);
  const routes = view === "routes";
  style = ROUTE_STYLES[style] ? style : "faint";
  const tabs = `<div class="filters"><a class="fchip ${routes ? "" : "on"}" href="#/map">Countries</a><a class="fchip ${routes ? "on" : ""}" href="#/map/routes">Routes from home <span class="trial-tag">trial</span></a></div>`;
  const home = HOME_AT(), homePin = { lat: home[0], lon: home[1], label: D.homeTown || "Home", title: `Home: ${D.homeTown || country(D.home).name}` };
  let shown = TRIPS, extra = "", note = "Countries visited are coloured in; pins are places named on a trip.";
  if (routes) {
    const styleRow = `<div class="filters route-style" aria-label="Ways to show routes">${Object.entries(ROUTE_STYLES).map(([k, v]) => `<a class="fchip ${k === style ? "on" : ""}" href="#/map/routes/${k}">${v}</a>`).join("")}</div>`;
    if (style === "year") {
      const y = YEARS.includes(which) ? which : YEARS[0];
      shown = TRIPS.filter(t => year(t) === y);
      extra = styleRow + `<div class="filters">${YEARS.map(x => `<a class="fchip ${x === y ? "on" : ""}" href="#/map/routes/year/${x}">${x}</a>`).join("")}</div>`;
    } else if (style === "pick") {
      const t = tripById[which];
      shown = t ? [t] : [];
      extra = styleRow;
    } else extra = styleRow;
    note = style === "pick" && !shown.length ? "Choose a trip below to see its route." : `Trips drawn from ${esc(D.homeTown || "home")} to the places named on them (or the middle of each country) and back, the shortest way round the world.`;
  }
  const routeList = routes && style !== "year" ? `<ul class="route-list">${TRIPS.map(t => `<li><a href="#/map/routes/${style === "pick" ? "pick" : "faint"}/${t.id}" data-trip="${t.id}" class="${which === t.id ? "on" : ""}"><b>${esc(t.title)}</b><small>${esc(fmtRange(t))} · about ${(Math.round(tripKm(t) / 100) * 100).toLocaleString("en-GB")} km</small></a></li>`).join("")}</ul>` : "";
  const map = worldMap(routes ? [homePin, ...placePins(shown)] : placePins(TRIPS), { ...mapOpts(VISITED),
    routes: routes ? shown.map(t => ({ stops: tripRoute(t), id: t.id, title: `${t.title} · ${fmtRange(t)}` })) : [], aria: routes ? "Trips’ routes from home" : "Every country visited" });
  return head("Map", `${plural(VISITED.length, "country", "countries")} · ${plural(TRIPS.length, "trip")}`, tabs + extra) +
    `<div class="map-and-list${routeList ? " has-list" : ""}${routes ? " routes-" + style : ""}${which && style === "faint" ? " has-on" : ""}"><div class="big-map">${map}</div>${routeList}</div>
    <p class="note map-note">${icon("info")}${note} Map: Natural Earth.</p>
    ${routes ? "" : `<h2 class="sr-only">By continent</h2><div class="cont-cols">${Object.entries(byCont).map(([k, cs]) => `<section><h3>${esc(k)}</h3><ul>${cs.map(c => {
      const ts = TRIPS.filter(t => t.countries.includes(c));
      return `<li><a href="#/country/${c}">${esc(country(c).name)}</a><span>${ts.map(t => year(t)).join(", ")}</span></li>`;
    }).join("")}</ul></section>`).join("")}</div>`}`;
}
function markChosenRoute() {
  const on = document.querySelector(".routes-faint .route-list a.on"); if (!on) return;
  document.querySelectorAll(`.routes-faint [data-trip="${CSS.escape(on.dataset.trip)}"]`).forEach(x => x.classList.add("chosen"));
}
// pointing at a trip in the list (or its line) brings that route forward ("All, faint")
document.addEventListener("pointerover", e => {
  const el = e.target.closest?.("[data-trip]"); const box = document.querySelector(".routes-faint"); if (!box) return;
  box.querySelectorAll(".hi").forEach(x => x.classList.remove("hi"));
  if (el) box.querySelectorAll(`[data-trip="${CSS.escape(el.dataset.trip)}"]`).forEach(x => x.classList.add("hi"));
  box.classList.toggle("hovering", !!el);
});
document.addEventListener("focusin", e => { const el = e.target.closest?.(".route-list [data-trip]"); if (el) el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true })); });
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
  const pins = placePins(ts).filter(p => inCountry(code, p.lat, p.lon));   // only the places that are in this country
  return `<nav class="crumbs"><a href="#/countries">Countries</a> › ${esc(k.continent)}</nav>` +
    head(esc(k.name), `${plural(ts.length, "trip")} · ${esc(k.continent)}`) +
    `<div class="trip-map wide">${worldMap(pins, { ...mapOpts([code]), focus: focusOn([code], pins), labels: true, aria: `Map of ${k.name}` })}</div>
    <h2 class="sr-only">Trips</h2><div class="trip-grid">${ts.map(tripCard).join("")}</div>`;
}
function firsts() { // the first trip to each continent and to each country, oldest first (worked out from the trips)
  const seen = new Set(), rows = [];
  for (const t of [...TRIPS].reverse()) for (const c of t.countries) {
    const k = country(c).continent;
    if (c === D.home || !k || seen.has(k)) continue;
    seen.add(k); rows.push([k, t]);
  }
  if (!rows.length) return "";
  return `<section class="sec chart-sec"><h2 class="sec-h">Firsts <span class="trial-tag">trial</span></h2><ol class="firsts">${rows.map(([k, t]) =>
    `<li><span class="fk">First time in ${esc(k)}</span><a href="#/trip/${t.id}">${esc(t.title)}</a><small>${esc(fmtRange(t))}</small></li>`).join("")}</ol></section>`;
}
function pageStats() {
  if (!TRIPS.length) return head("Stats", "For fun") + `<p class="note">No trips yet.</p>`;
  const first = TRIPS[TRIPS.length - 1];
  const ys = YEARS.map(Number), span = []; for (let y = ys[ys.length - 1]; y <= ys[0]; y++) span.push(y);
  const perYear = span.map(y => [y, TRIPS.filter(t => +year(t) === y).length]);
  const maxY = Math.max(...perYear.map(x => x[1]));
  let gap = [0, 0, 0]; for (let i = 0; i < ys.length - 1; i++) if (ys[i] - ys[i + 1] > gap[0]) gap = [ys[i] - ys[i + 1], ys[i + 1], ys[i]];
  const monthN = Array(12).fill(0); TRIPS.forEach(t => new Set(tripMonths(t).map(x => x[1])).forEach(m => monthN[m - 1]++));
  const maxM = Math.max(...monthN), topMonth = monthN.indexOf(maxM);
  const counts = VISITED.map(c => [c, TRIPS.filter(t => t.countries.includes(c)).length]).sort((a, b) => b[1] - a[1]);
  const most = counts.length && counts[0][1] > 1 ? counts.filter(x => x[1] === counts[0][1]) : [];
  const home = D.homeAt || country(D.home).at;
  const far = VISITED.map(c => [c, km(home, country(c).at)]).sort((a, b) => b[1] - a[1])[0] || null;
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
      ${maxM ? fact("Favourite month", MONTHS[topMonth], `${maxM} of ${TRIPS.length} trips`) : ""}
      ${most.length ? fact("Most visited", most.map(x => esc(country(x[0]).name)).join(", "), `${plural(most[0][1], "trip")}${most.length > 1 ? " each" : ""}`) : ""}
      ${far ? fact("Furthest from home", esc(country(far[0]).name), `about ${(Math.round(far[1] / 100) * 100).toLocaleString("en-GB")} km from ${esc(D.homeTown || "home")}`) : ""}
      ${fact("Busiest year", busyYears.join(", "), `${plural(busiest, "trip")}`)}
      ${fact("First on record", esc(first.title), esc(fmtRange(first)))}
      ${fact("Longest gap", plural(gap[0], "year"), `${gap[1]} to ${gap[2]}`)}
      ${fact("Written so far", plural(posts, "post"), `${plural(days, "day")} · ${plural(photos, "photo")}`)}
      ${(() => { const total = TRIPS.reduce((n, t) => n + tripKm(t), 0); return fact(`Distance travelled <span class="trial-tag">trial</span>`, `${(Math.round(total / 1000) * 1000).toLocaleString("en-GB")} km`, `about ${(total / 40075).toFixed(1)} times round the world, as the crow flies from ${esc(D.homeTown || "home")}`); })()}
    </div>
    ${firsts()}
    <section class="sec chart-sec"><h2 class="sec-h">Trips each year</h2>
      <div class="bars" role="img" aria-label="Trips each year">${perYear.map(([y, n]) => `<div class="bar" title="${y}: ${plural(n, "trip")}"><span class="bv">${n || ""}</span><i style="height:${n / maxY * 100}%"></i><span class="bl">${String(y).slice(2)}</span></div>`).join("")}</div>
      <p class="note">Years from ${span[0]} to ${span[span.length - 1]}; labels are the last two digits. A trip counts in the year it started.</p></section>
    <section class="sec chart-sec"><h2 class="sec-h">Which months</h2>
      <div class="months">${monthN.map((n, i) => `<div class="mcell ${n / maxM > 0.5 ? "dark" : ""}" style="--a:${n ? 0.18 + 0.82 * n / maxM : 0}" title="${MONTHS[i]}: ${plural(n, "trip")}"><b>${n || ""}</b><span>${MONTHS[i].slice(0, 3)}</span></div>`).join("")}</div>
      <p class="note">Trips away in each month.</p></section>`;
}
function pageWrite() {
  if (!LOCAL) return notFound();
  const tripOpts = TRIPS.map(t => `<option value="${esc(t.id)}">${esc(t.title)} · ${esc(fmtRange(t))}</option>`).join("");
  const countryOpts = Object.entries(D.countries).filter(([c]) => c !== D.home).sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([c, k]) => `<label class="tick"><input type="checkbox" name="nc" value="${c}"> ${esc(k.name)}</label>`).join("");
  return head("Write a post", "Only on your PC") + `<p class="note banner-note" id="wServer">${icon("info")}This page only exists on your own computer, so no sign-in is needed: online, there is no way to write.</p>
    <form class="write" id="writeForm" novalidate>
      <label>Trip<select name="trip">${tripOpts}<option value="">+ New trip…</option></select></label>
      <fieldset class="newtrip" hidden><legend>New trip</legend>
        <label>Title<input name="ntitle" placeholder="e.g. Lake District"></label>
        <div class="two"><label>From (month)<input name="nfrom" type="month"></label><label>To (month)<input name="nto" type="month"></label></div>
        <div class="ticks" aria-label="Countries">${countryOpts}</div>
        <p class="note">A country that isn’t listed needs adding to the site first (ask Claude).</p>
      </fieldset>
      <div class="two"><label>Day or days<input name="days" placeholder="e.g. 3, or 2-4"></label><label>Or dates<input name="dates" placeholder="e.g. 2026-09-05 to 2026-09-07"></label></div>
      <label>Where<input name="place" placeholder="e.g. Kyoto"></label>
      <label>Title<input name="title" placeholder="Title for this post" required></label>
      <label>Notes<textarea name="text" rows="11" placeholder="Write as much or as little as you like. A blank line starts a new paragraph."></textarea></label>
      <p class="note">To put a photo in the middle of your words, write its marker on a line of its own, e.g. <code>[photo 2 right]</code>, <code>[photos 3-5]</code>, <code>[photos 1-6 mosaic]</code> (all of them: for-jemma/post-templates.md). Photos you don’t place go at the end.</p>
      <label class="drop" id="drop">${icon("upload")}<b>Drop photos here</b><span>or click to choose · copied and resized for the site; where they were taken is removed</span><input type="file" accept="image/*" multiple hidden id="files"></label>
      <ol class="picked" id="picked"></ol>
      <label class="tick"><input type="checkbox" name="cover"> Use photo 1 as the trip’s cover picture</label>
      <div class="actions"><button class="primary" id="saveBtn" type="submit">${icon("pen")}Save post</button><span class="note" id="wMsg">Saved posts go online the next time the site is published.</span></div>
    </form>`;
}
// the Write page's behaviour: photos chosen (numbered, so markers can point at them), new trip fields, saving
let picked = [];
function wireWrite() {
  const f = $("#writeForm"); if (!f) return;
  picked = [];
  const server = fetch("api/ping").then(r => r.ok ? r.json() : {}).then(j => j.ok === true).catch(() => false);
  server.then(ok => { if (!ok) { $("#wServer").innerHTML = `${icon("info")}To save, open the site from its own server: in Claude, start the “travels” preview (or run <code>python tools/serve.py</code>).`; $("#saveBtn").disabled = true; } });
  f.trip.onchange = () => { f.querySelector(".newtrip").hidden = f.trip.value !== ""; };
  const show = () => {
    $("#picked").innerHTML = picked.map((p, i) => `<li><img src="${p.url}" alt=""><span>${i + 1}</span><button type="button" data-i="${i}" aria-label="Remove photo ${i + 1}">${icon("x")}</button></li>`).join("");
  };
  const add = files => { for (const file of files) if (/^image\//.test(file.type)) picked.push({ file, url: URL.createObjectURL(file) }); show(); };
  $("#files").onchange = e => add(e.target.files);
  const drop = $("#drop");
  drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); add(e.dataTransfer.files); };
  $("#picked").onclick = e => { const b = e.target.closest("button"); if (b) { picked.splice(+b.dataset.i, 1); show(); } };
  f.onsubmit = async e => {
    e.preventDefault();
    const msg = $("#wMsg"), btn = $("#saveBtn");
    const v = n => (f.elements[n]?.value || "").trim();
    const body = { trip: f.trip.value, title: v("title"), days: v("days"), dates: v("dates"), place: v("place"), text: f.text.value, cover: f.cover.checked };
    if (!body.trip) body.newTrip = { title: v("ntitle"), from: v("nfrom"), to: v("nto") || v("nfrom"), countries: [...f.querySelectorAll("input[name=nc]:checked")].map(x => x.value) };
    if (!body.title) { msg.textContent = "The post needs a title."; f.title.focus(); return; }
    btn.disabled = true; msg.textContent = picked.length ? `Getting ${plural(picked.length, "photo")} ready…` : "Saving…";
    try {
      body.photos = await Promise.all(picked.map(p => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok({ name: p.file.name, data: r.result }); r.onerror = no; r.readAsDataURL(p.file); })));
      msg.textContent = "Saving…";
      const res = await fetch("api/post", { method: "POST", headers: { "Content-Type": "application/json", "X-Travels": "1" }, body: JSON.stringify(body) });
      const out = await res.json();
      if (!out.ok) { msg.textContent = "Not saved: " + (out.problems || []).join(" "); btn.disabled = false; return; }
      location.hash = out.url; location.reload();   // the site was rebuilt with the new post: load it fresh
    } catch (err) { msg.textContent = "Not saved: " + err; btn.disabled = false; }
  };
}
function notFound() { return head("Not found", "") + `<p><a href="#/">Back to the start</a></p>`; }

// ---------- shell ----------
function pageTimeline() {
  // each year with trips, and one line for each run of years without any ("2013 – 2022: no trips")
  const rows = []; let gap = null;
  for (let y = +YEARS[0]; y >= +YEARS[YEARS.length - 1]; y--) {
    if (YEARS.includes(String(y))) { if (gap) rows.push(gap); gap = null; rows.push(String(y)); }
    else gap = gap ? [gap[0], y] : [y, y];
  }
  return head("Timeline", `Every trip, newest first <span class="trial-tag">trial</span>`) + `<ol class="timeline">${rows.map(y => {
    if (Array.isArray(y)) return `<li class="tl-gap"><span class="tl-year">${y[1] === y[0] ? y[0] : `${y[1]} – ${y[0]}`}: no trips</span></li>`;
    const ts = TRIPS.filter(t => year(t) === y);
    return `<li class="tl-year-row"><h2 class="tl-year"><a href="#/year/${y}">${y}</a></h2><ol>${ts.map(t => `<li class="tl-trip">
      <a class="tl-cover" href="#/trip/${t.id}" tabindex="-1" aria-hidden="true">${cover(t)}</a>
      <div><div class="when">${icon("calendar")}${esc(fmtRange(t))}</div><h3><a href="#/trip/${t.id}">${esc(t.title)}</a></h3>
      <div class="chips">${chips(t.countries)}</div><div class="meta">about ${(Math.round(tripKm(t) / 100) * 100).toLocaleString("en-GB")} km there and back · ${plural(postsOf(t.id).length, "post")}</div></div></li>`).join("")}</ol></li>`;
  }).join("")}</ol>`;
}
function pageSearch(q) {
  q = String(q || "").trim();
  const box = `<form class="search-big" role="search" onsubmit="event.preventDefault(); location.hash = '#/search/' + encodeURIComponent(this.q.value.trim())"><input name="q" type="search" value="${esc(q)}" placeholder="A place, a country, a word from a post…" aria-label="Search"><button class="primary" type="submit">${icon("search")}Search</button></form>`;
  if (!q) return head("Search", `Trips, posts and countries <span class="trial-tag">trial</span>`) + box;
  const norm = x => String(x || "").replace(/^\[placeholder\]/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = norm(q).split(/\s+/).filter(Boolean), hit = text => words.every(w => norm(text).includes(w));
  const trips = TRIPS.filter(t => hit([t.title, fmtRange(t), ...t.countries.map(c => country(c).name), ...(t.places || []).map(p => p[0])].join(" ")));
  const posts = D.posts.filter(p => !p.placeholder && hit([p.title, p.place, ...p.text.filter(x => !isPhotoMark(x))].join(" ")));
  const cs = VISITED.filter(c => hit(country(c).name));
  const n = trips.length + posts.length + cs.length;
  return head("Search", `${plural(n, "result")} for “${esc(q)}” <span class="trial-tag">trial</span>`) + box +
    (cs.length ? `<section class="sec"><h2 class="sec-h">Countries</h2><div class="country-grid">${cs.map(c => `<a class="ctile" href="#/country/${c}"><span class="code">${c}</span><b>${esc(country(c).name)}</b></a>`).join("")}</div></section>` : "") +
    (trips.length ? `<section class="sec"><h2 class="sec-h">Trips</h2><div class="trip-grid">${trips.map(tripCard).join("")}</div></section>` : "") +
    (posts.length ? `<section class="sec"><h2 class="sec-h">Posts</h2><div class="post-list">${posts.map(p => postCard(p, { trip: true })).join("")}</div></section>` : "") +
    (n ? "" : `<p class="note">Nothing found. Placeholder posts aren’t searched.</p>`);
}
// ---- trial (21 Nov, her question: Map, Countries and Stats overlap): three ways to fold them together, to compare
//   #/try/1  Map and Countries as one page ("Map"): map, then the tracker, then the countries; Stats stays
//   #/try/2  the tracker moves into Stats; Map keeps the map and the list by continent
//   #/try/3  everything on one page ("Map and stats")
const bodyOf = html => html.replace(/^\s*(<nav class="crumbs">.*?<\/nav>)?\s*<header class="page-head">[\s\S]*?<\/header>/, "");
function pageTry(n) {
  const banner = `<p class="note banner-note">${icon("info")}Trying out a way to combine pages (${n} of 3): <a href="#/try/1">1</a> · <a href="#/try/2">2</a> · <a href="#/try/3">3</a>. Nothing else has changed yet.</p>`;
  const tracker = bodyOf(pageCountries());
  if (n === "1") return head("Map", `${plural(VISITED.length, "country", "countries")} · ${plural(TRIPS.length, "trip")} · option 1`) + banner +
    bodyOf(pageMap()).replace(/<h2 class="sr-only">By continent<\/h2><div class="cont-cols">[\s\S]*$/, "") + `<section class="sec"><h2 class="sec-h">Countries visited</h2>${tracker}</section>`;
  if (n === "2") return head("Stats", "For fun · option 2") + banner + `<section class="sec" style="margin-top:0"><h2 class="sec-h">Countries</h2>${tracker}</section>` + `<section class="sec"><h2 class="sec-h">Facts</h2>${bodyOf(pageStats())}</section>`;
  if (n === "3") return head("Map and stats", "Everything in one place · option 3") + banner +
    bodyOf(pageMap()).replace(/<h2 class="sr-only">By continent<\/h2><div class="cont-cols">[\s\S]*$/, "") +
    `<section class="sec"><h2 class="sec-h">Countries</h2>${tracker}</section><section class="sec"><h2 class="sec-h">Facts</h2>${bodyOf(pageStats())}</section>`;
  return notFound();
}
function nav(route) {
  const item = (href, ic, label, on, n) => `<a href="${href}" class="${on ? "on" : ""}">${icon(ic)}<span>${label}</span>${n != null ? `<small>${n}</small>` : ""}</a>`;
  const r = route[0] || "";
  return `<div class="nav-main">${item("#/", "home", "Home", r === "")}${item("#/trips", "plane", "Trips", r === "trips" || r === "trip" || r === "year", TRIPS.length)}${item("#/map", "map", "Map", r === "map")}${item("#/countries", "globe", "Countries", r === "countries" || r === "country", VISITED.length)}${item("#/stats", "chart", "Stats", r === "stats")}${item("#/timeline", "clock", "Timeline", r === "timeline")}${item("#/search", "search", "Search", r === "search")}<a href="#/surprise" class="surprise">${icon("shuffle")}<span>Surprise me</span></a>${LOCAL ? item("#/write", "pen", "Write", r === "write") : ""}</div>
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
  else if (r === "map") html = a && a !== "routes" ? notFound() : pageMap(a, b, route[3]);
  else if (r === "surprise") { location.replace(surprisePost()); return; }
  else if (r === "timeline") html = pageTimeline();
  else if (r === "try") html = pageTry(a);
  else if (r === "search") html = pageSearch(a);
  else if (r === "countries") html = pageCountries();
  else if (r === "country") html = pageCountry(a);
  else if (r === "stats") html = pageStats();
  else if (r === "write") html = pageWrite();
  else html = notFound();
  $("#view").innerHTML = html;
  $("#nav").innerHTML = nav(route);
  document.body.dataset.page = r || "home";
  setMenu(false);
  if (render.done) $("#view").focus({ preventScroll: true });   // after a click, keyboard and screen readers start at the new page
  render.done = true;
  if (r === "write") wireWrite();
  if (r === "map") markChosenRoute();
  const t = $("#view h1"); document.title = (r && t ? t.textContent.replace("Placeholder", "").trim() + " · " : "") + "Jemma’s Travels";
  window.scrollTo(0, 0);
}
$("#foot").innerHTML = `<b>Jemma’s Travels</b><span>No cookies, no tracking, no ads.</span><span>Map: Natural Earth · Fonts: Instrument Serif and Manrope · Icons by Lucide</span><div class="foot-links"><button class="mode-btn" id="topBtn" type="button">${icon("arrow-up")}Back to top</button><button class="mode-btn" id="modeBtn" type="button"></button></div>`;
// Back to top beside Dark mode (her ask, 21 Nov, as on Jemma’s Journals): to the top, and keyboard focus with it
$("#topBtn").onclick = () => { window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); $("#view").focus({ preventScroll: true }); };
// dark mode: light unless the footer button is pressed; remembered on this device (her pick, 21 Nov, like Jemma’s Journals)
function setMode(m) {
  document.documentElement.dataset.mode = m;
  try { localStorage.setItem("jt-mode", m); } catch (e) {}
  $("#modeBtn").innerHTML = m === "dark" ? `${icon("sun")}Light mode` : `${icon("moon")}Dark mode`;
  document.querySelectorAll('link[rel="icon"][data-dark]').forEach(l => { l.dataset.light ||= l.getAttribute("href"); l.href = m === "dark" ? l.dataset.dark : l.dataset.light; });
}
$("#modeBtn").onclick = () => setMode(document.documentElement.dataset.mode === "dark" ? "light" : "dark");
setMode((() => { try { return localStorage.getItem("jt-mode") === "dark" ? "dark" : "light"; } catch (e) { return "light"; } })());
$("#menuBtn").innerHTML = icon("menu");
// phone menu: slides in from the left over the page (her ask, 21 Nov: it used to push the page down)
function setMenu(o) { document.body.classList.toggle("menu-open", o); $("#menuBtn").setAttribute("aria-expanded", o); $("#menuBtn").innerHTML = icon(o ? "x" : "menu"); }
$("#menuBtn").onclick = () => setMenu(!document.body.classList.contains("menu-open"));
const scrim = document.createElement("div"); scrim.className = "scrim"; scrim.onclick = () => { setMenu(false); $("#menuBtn").focus(); }; $("#side").appendChild(scrim);
addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("menu-open")) { setMenu(false); $("#menuBtn").focus(); } });
addEventListener("hashchange", render);

// her picks (21 Nov): Old Atlas, pale sidebar with a faint grid, banner header, plain paper: set on <html> in index.html
render();
