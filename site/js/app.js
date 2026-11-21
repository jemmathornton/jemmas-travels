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
const tripById = Object.assign(Object.create(null), Object.fromEntries(TRIPS.map(t => [t.id, t])));   // no inherited names (#/trip/constructor is Not found)
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
const year = t => t.from.slice(0, 4);
const YEARS = [...new Set(TRIPS.map(year))];
const postsOf = id => D.posts.filter(p => p.trip === id);
const country = c => own(D.countries, c) || { name: c, continent: "", at: [0, 0] };
const VISITED = [...new Set(TRIPS.flatMap(t => t.countries))].filter(c => c !== D.home);
window.MAP_NAMES = Object.fromEntries(Object.values(D.countries).filter(c => c.iso).map(c => [c.iso, c.name]));   // maps use the same country names as the pages
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
  return trips.flatMap(t => (t.places || []).map(([name, lat, lon]) => ({ lat, lon, label: name, title: name === t.title ? name : `${name} · ${t.title}`, href: link ? `#/trip/${t.id}` : null })));
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
const _main = Object.create(null);
// bounding box of a country's biggest piece (so France means mainland France, the US the lower 48); with islands, also every piece
// within 2° of it, one after another (Japan's Hokkaido, Kyushu and Okinawa, Corsica, Zealand), but not far-off ones (Alaska, French Guiana)
function mainBox(c, islands = false) {
  const key = c + (islands ? "+" : "");
  if (_main[key]) return _main[key];
  const shape = WORLD.hi[isoOf(c)]; if (!shape) { const a = country(c).at; return [a[1] - 3, a[0] - 3, a[1] + 3, a[0] + 3]; }
  const boxOf = r => { let w = 180, s = 90, e = -180, n = -90; for (let i = 0; i < r.length; i += 2) { w = Math.min(w, r[i]); e = Math.max(e, r[i]); s = Math.min(s, r[i + 1]); n = Math.max(n, r[i + 1]); } return [w, s, e, n]; };
  let best = 0, bestA = -1;
  shape[1].forEach((r, j) => {
    let a = 0; for (let i = 0; i < r.length - 2; i += 2) a += r[i] * r[i + 3] - r[i + 2] * r[i + 1];
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = j; }
  });
  const boxes = shape[1].map(boxOf); let u = boxes[best];
  if (islands) {
    const used = new Set([best]); let grew = true;
    while (grew) {
      grew = false;
      boxes.forEach((b, j) => {
        if (used.has(j) || Math.max(b[0] - u[2], u[0] - b[2], b[1] - u[3], u[1] - b[3]) > 2) return;
        used.add(j); grew = true; u = [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])];
      });
    }
  }
  return (_main[key] = u);
}
function focusOn(codes, pins = [], islands = false) {
  let w = 180, s = 90, e = -180, n = -90;
  for (const c of codes) { const b = mainBox(c, islands); w = Math.min(w, b[0]); s = Math.min(s, b[1]); e = Math.max(e, b[2]); n = Math.max(n, b[3]); }
  for (const p of pins) { w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat); }
  const px = Math.max(3, (e - w) * 0.18), py = Math.max(2, (n - s) * 0.18);
  w -= px; e += px; s -= py; n += py;
  const midLat = Math.cos(((s + n) / 2) * Math.PI / 180);
  const wide = (e - w) * midLat, tall = n - s;
  if (wide < tall * 1.7) { const c = (w + e) / 2, h = tall * 1.7 / midLat / 2; w = c - h; e = c + h; }
  else if (tall < wide / 2.4) { const c = (s + n) / 2, h = wide / 2.4 / 2; s = c - h; n = c + h; }
  return [Math.max(-360, w), Math.max(-85, s), Math.min(360, e), Math.min(85, n)];   // may go past 180°: the map draws across it
}
// ---------- extras (21 Nov; she likes them all): routes, distance, timeline, search ----------
const HOME_AT = () => D.homeAt || country(D.home).at;
function tripStops(t) { // where a trip went, in order: the places she named, or else each country's own point
  return t.places && t.places.length ? t.places.map(([, lat, lon]) => [lat, lon]) : t.countries.map(c => country(c).at);
}
function tripRoute(t) { return [HOME_AT(), ...tripStops(t), HOME_AT()]; }   // from home and back
function tripKm(t) { const r = tripRoute(t); let n = 0; for (let i = 0; i < r.length - 1; i++) n += km(r[i], r[i + 1]); return n; }
function fmtKm(n) { return `${(Math.round(n / 10) * 10).toLocaleString("en-GB")} km`; }   // to the nearest 10 km, e.g. 4,820 km
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
      <div class="chips">${chips(t.countries.filter(c => country(c).name !== t.title))}</div>
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
    <p class="note">Comments will open when the site goes online.</p></section>`;
}

// ---------- pages ----------
// "This time of year" (21 Nov, instead of "on this day" until posts have dates): trips in this month in other years
function thisTimeOfYear(now = new Date()) {
  const m = now.getMonth() + 1, y = now.getFullYear();
  const ts = TRIPS.filter(t => tripMonths(t).some(([ty, tm]) => tm === m && ty !== y));
  if (!ts.length) return "";
  return `<section class="sec"><h2 class="sec-h">This time of year</h2><p class="note">Trips in ${MONTHS[m - 1]} in other years.</p><div class="trip-grid">${ts.map(tripCard).join("")}</div></section>`;
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
      <p class="tagline"><span class="ph-text">A line about these travels, in Jemma’s own words.</span> <span class="ph">Placeholder</span></p></div>
    </section>
    ${statTiles([[TRIPS.length, "trips", "#/trips"], [VISITED.length, "countries", "#/map"], [continents.size, "continents", "#/map"], [YEARS.length, "years travelled", "#/stats"]])}
    ${thisTimeOfYear()}
    ${latest.length ? `<section class="sec"><h2 class="sec-h">Latest posts</h2><div class="post-tiles">${latest.map(postTile).join("")}</div></section>` : ""}
    <section class="sec"><h2 class="sec-h">Trips by year</h2>${yearGroups(TRIPS, "h3")}</section>`;
}
function yearChips(active) {
  return `<div class="filters"><a class="fchip ${active ? "" : "on"}" href="#/trips">All</a>${YEARS.map(y => `<a class="fchip ${active === y ? "on" : ""}" href="#/year/${y}">${y}</a>`).join("")}</div>`;
}
// Trips by year (as before) or by country (21 Nov: continents, then countries, then their trips)
function tripTabs(on) {
  return `<div class="tabs" role="navigation" aria-label="Trips by"><a href="#/trips" class="${on === "year" ? "on" : ""}"${on === "year" ? ' aria-current="page"' : ""}>${icon("calendar")}By year</a><a href="#/trips/by-country" class="${on === "country" ? "on" : ""}"${on === "country" ? ' aria-current="page"' : ""}>${icon("flag")}By country</a></div>`;
}
function pageTrips(y) {
  if (y !== undefined && !YEARS.includes(y)) return notFound();
  const ts = y ? TRIPS.filter(t => year(t) === y) : TRIPS;
  return head(y ? `${y}` : "Trips", y ? `${plural(ts.length, "trip")}` : `${plural(TRIPS.length, "trip")} · newest first`, (y ? "" : tripTabs("year")) + yearChips(y)) + (y ? `<h2 class="sr-only">Trips</h2><div class="trip-grid">${ts.map(tripCard).join("")}</div>` : yearGroups(ts));
}
function pageTripsByCountry() {
  const conts = CONTINENTS();
  return head("Trips", `${plural(VISITED.length, "country", "countries")} · ${plural(conts.length, "continent")}`, tripTabs("country") +
      `<div class="filters">${conts.map(k => `<a class="fchip" href="#/trips/by-country" onclick="event.preventDefault();document.getElementById('k-${k.replace(/\W/g, "")}').scrollIntoView()">${esc(k)}</a>`).join("")}</div>`) +
    conts.map(k => {
      const cs = VISITED.filter(c => country(c).continent === k).sort((x, y) => country(x).name.localeCompare(country(y).name));
      return `<section class="year-group" id="k-${k.replace(/\W/g, "")}"><h2 class="year-h"><a href="#/continent/${encodeURIComponent(k)}">${esc(k)}</a><small>${plural(cs.length, "country", "countries")}</small></h2>
        ${cs.map(c => `<div class="by-country"><h3><a href="#/country/${c}">${esc(country(c).name)}</a></h3><ul class="trip-lines">${tripsIn(c).map(t =>
          `<li><a href="#/trip/${t.id}">${esc(t.title)}</a><small>${esc(fmtRange(t))}</small></li>`).join("")}</ul></div>`).join("")}</section>`;
    }).join("") + `<p class="note">A trip to several countries is under each of them. Home (${esc(country(D.home).name)}) isn’t listed.</p>`;
}
function homePin() {
  const h = HOME_AT();
  return { lat: h[0], lon: h[1], label: D.homeTown || "Home", title: `Home: ${D.homeTown || country(D.home).name}`, kind: "home" };
}
function tripMap(t) { // the trip's countries coloured in, its places, and its route from home and back
  const pins = placePins([t]), stops = tripStops(t).map(([lat, lon]) => ({ lat, lon }));
  return worldMap([homePin(), ...pins], { ...mapOpts(t.countries), focus: focusOn(t.countries, [homePin(), ...pins, ...stops]), labels: true,
    routes: [{ stops: tripRoute(t), id: t.id, title: `${t.title}: from ${D.homeTown || "home"} and back` }], aria: `Map of ${t.title} and the way there from ${D.homeTown || "home"}` });
}
function pageTrip(id) {
  const t = tripById[id]; if (!t) return notFound();
  const posts = postsOf(id);
  const photos = posts.reduce((n, p) => n + p.photos.length, 0);
  return `<nav class="crumbs"><a href="#/trips">Trips</a> › <a href="#/year/${year(t)}">${year(t)}</a></nav>
    <header class="trip-head">
      <div class="trip-head-text"><div class="kicker">${icon("calendar")}${esc(fmtRange(t))}</div><h1>${esc(t.title)}</h1>
        <div class="chips">${chips(t.countries)}</div>
        <div class="meta">${posts.length ? `${plural(posts.length, "post")} · ${plural(photos, "photo")}` : "No posts yet"}</div>
        <div class="meta route-meta">${icon("route")}<span class="dk">Distance</span> <b class="dist">${fmtKm(tripKm(t))}</b> <span>from ${esc(D.homeTown || "home")} and back, as the crow flies</span></div></div>
      <div class="trip-map">${tripMap(t)}</div>
    </header>
    ${posts.length ? `<h2 class="sr-only">Posts</h2><div class="post-list">${posts.map(p => postCard(p)).join("")}</div>`
      : `<div class="empty-note">${icon("pen")}<p>Posts for this trip will go here.</p></div>`}`;
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
      <nav class="post-nav">${prev ? `<a href="#/trip/${id}/${prev.slug}">${icon("chevron-left")}<span><small>Previous · ${esc(dayLabel(prev))}</small>${ph(prev.title)}</span></a>` : "<span></span>"}
        ${next ? `<a class="next" href="#/trip/${id}/${next.slug}"><span><small>Next · ${esc(dayLabel(next))}</small>${ph(next.title)}</span>${icon("chevron-right")}</a>` : "<span></span>"}</nav>
      <p class="back-trip"><a href="#/trip/${id}">${icon("arrow-left")}All posts from ${esc(t.title)}</a></p>
    </article>${comments()}`;
}
// Map and Countries as one page (her pick, 21 Nov): the map, then the countries tracker, then the countries visited
function pageMap() {
  return head("Map", `${plural(VISITED.length, "country", "countries")} · ${plural(TRIPS.length, "trip")}`) +
    `<div class="big-map">${worldMap(placePins(TRIPS), { ...mapOpts(VISITED), aria: "Every country visited" })}</div>
    <p class="note map-note">${icon("info")}Countries visited are coloured in; pins are places named on a trip. Each trip’s page shows its route from ${esc(D.homeTown || "home")}. Map: Natural Earth.</p>
    <section class="sec"><h2 class="sec-h">Countries visited</h2>${countriesBody()}</section>`;
}
function countriesBody() {
  const pct = VISITED.length / TOTAL_COUNTRIES;
  const conts = Object.entries(D.continentTotals).map(([k, n]) => [k, VISITED.filter(c => country(c).continent === k).length, n]);
  const C = 2 * Math.PI * 52;
  return `<div class="tracker-box"><div class="tracker">
    <div class="ring"><svg viewBox="0 0 120 120" role="img" aria-label="${VISITED.length} of ${TOTAL_COUNTRIES} countries"><circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg" cx="60" cy="60" r="52" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/></svg>
      <div><b>${VISITED.length}</b><span>of ${TOTAL_COUNTRIES} countries</span><small>${(pct * 100).toFixed(1)}% of the world</small></div></div>
    <div class="cont-bars">${conts.map(([k, v, n]) => `<div class="cbar" title="${esc(k)}: ${v} of ${n}"><span class="cname">${esc(k)}</span><span class="track"><i style="width:${Math.max(v ? 2 : 0, v / n * 100)}%"></i></span><span class="cval">${v} <small>of ${n}</small></span></div>`).join("")}</div>
  </div></div>
  <h3 class="sr-only">Each country</h3><div class="country-grid">${VISITED.map(c => {
    const ts = TRIPS.filter(t => t.countries.includes(c));
    return `<a class="ctile" href="#/country/${c}"><span class="code">${c}</span><b>${esc(country(c).name)}</b><small>${plural(ts.length, "trip")} · ${[...new Set(ts.map(year))].join(", ")}</small></a>`;
  }).join("")}</div>
  <p class="note">Home (${esc(country(D.home).name)}) isn’t counted. Out of 195: the UN’s members plus the Vatican and Palestine.</p>`;
}
// a continent (21 Nov, with the Sim World-style sidebar): its countries visited, on a map, and the trips there
function pageContinent(k) {
  if (!CONTINENTS().includes(k)) return notFound();
  const cs = VISITED.filter(c => country(c).continent === k).sort((x, y) => country(x).name.localeCompare(country(y).name));
  const ts = TRIPS.filter(t => t.countries.some(c => cs.includes(c)));
  const pins = placePins(ts).filter(p => cs.some(c => inCountry(c, p.lat, p.lon)));
  return `<nav class="crumbs"><a href="#/map">Map</a></nav>` +
    head(esc(k), `${cs.length} of ${D.continentTotals[k]} countries · ${plural(ts.length, "trip")}`) +
    `<div class="trip-map wide">${worldMap(pins, { ...mapOpts(cs), focus: focusOn(cs, pins), labels: true, aria: `Map of the countries visited in ${k}` })}</div>
    <section class="sec"><h2 class="sec-h">Countries</h2><div class="country-grid">${cs.map(c => `<a class="ctile" href="#/country/${c}"><b>${esc(country(c).name)}</b><small>${plural(tripsIn(c).length, "trip")} · ${[...new Set(tripsIn(c).map(year))].join(", ")}</small></a>`).join("")}</div></section>
    <section class="sec"><h2 class="sec-h">Trips</h2><div class="trip-grid">${ts.map(tripCard).join("")}</div></section>`;
}
function pageCountry(code) {
  const k = own(D.countries, code); if (!k) return notFound();
  const ts = TRIPS.filter(t => t.countries.includes(code));
  const pins = placePins(ts).filter(p => inCountry(code, p.lat, p.lon));   // only the places that are in this country
  return `<nav class="crumbs"><a href="#/map">Map</a> › <a href="#/continent/${encodeURIComponent(k.continent)}">${esc(k.continent)}</a></nav>` +
    head(esc(k.name), `${plural(ts.length, "trip")} · ${esc(k.continent)}`) +
    `<div class="trip-map wide">${worldMap(pins, { ...mapOpts([code]), focus: focusOn([code], pins, true), labels: true, aria: `Map of ${k.name}` })}</div>
    ${ts.length ? `<h2 class="sr-only">Trips</h2><div class="trip-grid">${ts.map(tripCard).join("")}</div>` : `<p class="note">${code === D.home ? "Home, so not counted as a country visited." : "No trips here yet."}</p>`}`;
}
function firsts() { // the first trip to each continent and to each country, oldest first (worked out from the trips)
  const seen = new Set(), rows = [];
  for (const t of [...TRIPS].reverse()) for (const c of t.countries) {
    const k = country(c).continent;
    if (c === D.home || !k || k === country(D.home).continent || seen.has(k)) continue;   // not her home continent
    seen.add(k); rows.push([k, t]);
  }
  if (!rows.length) return "";
  return `<section class="sec chart-sec"><h2 class="sec-h">Firsts</h2><ol class="firsts">${rows.map(([k, t]) =>
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
  const maxM = Math.max(...monthN);
  const counts = VISITED.map(c => [c, TRIPS.filter(t => t.countries.includes(c)).length]).sort((a, b) => b[1] - a[1]);
  const most = counts.length && counts[0][1] > 1 ? counts.filter(x => x[1] === counts[0][1]) : [];
  const home = D.homeAt || country(D.home).at;
  const far = VISITED.map(c => [c, km(home, country(c).at)]).sort((a, b) => b[1] - a[1])[0] || null;
  const busiest = Math.max(...perYear.map(x => x[1]));
  const busyYears = perYear.filter(x => x[1] === busiest).map(x => x[0]);
  const real = D.posts.filter(p => !p.placeholder);   // her own posts only: placeholder and template posts aren't her writing
  const posts = real.length, photos = real.reduce((n, p) => n + p.photos.length, 0);
  const days = real.reduce((n, p) => n + dayCount(p), 0);
  const continents = new Set(VISITED.map(c => country(c).continent));
  const fact = (k, v, s) => `<div class="fact"><span class="fk">${k}</span><b>${v}</b>${s ? `<small>${s}</small>` : ""}</div>`;
  return head("Stats", "For fun") + `<div class="facts">
      ${fact("Countries", VISITED.length, `of ${TOTAL_COUNTRIES}`)}
      ${fact("Continents", continents.size, "of 7")}
      ${fact("Trips", TRIPS.length, `${YEARS.length} different years`)}
      ${most.length ? fact("Most visited", most.map(x => esc(country(x[0]).name)).join(", "), `${plural(most[0][1], "trip")}${most.length > 1 ? " each" : ""}`) : ""}
      ${far ? fact("Furthest from home", esc(country(far[0]).name), `about ${(Math.round(far[1] / 100) * 100).toLocaleString("en-GB")} km from ${esc(D.homeTown || "home")}`) : ""}
      ${fact("Busiest year", busyYears.join(", "), `${plural(busiest, "trip")}`)}
      ${fact("First on record", esc(first.title), esc(fmtRange(first)))}
      ${fact("Longest gap", plural(gap[0], "year"), `${gap[1]} to ${gap[2]}`)}
      ${fact("Written so far", plural(posts, "post"), `${plural(days, "day")} · ${plural(photos, "photo")}`)}
      ${(() => { const total = TRIPS.reduce((n, t) => n + tripKm(t), 0); return fact(`Distance travelled`, `${(Math.round(total / 1000) * 1000).toLocaleString("en-GB")} km`, `about ${(total / 40075).toFixed(1)} times round the world, as the crow flies from ${esc(D.homeTown || "home")}`); })()}
    </div>
    ${firsts()}
    <section class="sec chart-sec"><h2 class="sec-h">Trips each year</h2>
      <div class="bars" role="img" aria-label="Trips each year">${perYear.map(([y, n]) => `<div class="bar" title="${y}: ${plural(n, "trip")}"><span class="bv">${n || ""}</span><i style="height:${n / maxY * 100}%"></i><span class="bl">${String(y).slice(2)}</span></div>`).join("")}</div>
      <p class="note">Years from ${span[0]} to ${span[span.length - 1]}; labels are the last two digits. A trip counts in the year it started.</p></section>
    <section class="sec chart-sec"><h2 class="sec-h">Which months</h2>
      <div class="months">${monthN.map((n, i) => `<div class="mcell ${n && n === maxM ? "top" : ""}" style="--a:${n ? (0.15 + 0.6 * n / maxM).toFixed(3) : 0}" title="${MONTHS[i]}: ${plural(n, "trip")}"><b>${n || ""}</b><span>${MONTHS[i].slice(0, 3)}</span></div>`).join("")}</div>
      <p class="note">Trips away in each month.</p></section>`;
}
function pageWrite() {
  if (!LOCAL) return notFound();
  const tripOpts = TRIPS.map(t => `<option value="${esc(t.id)}">${esc(t.title)} · ${esc(fmtRange(t))}</option>`).join("");
  const countryOpts = Object.entries(D.countries).filter(([c]) => c !== D.home).sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([c, k]) => `<label class="tick"><input type="checkbox" name="nc" value="${c}"> ${esc(k.name)}</label>`).join("");
  return head("Write a post", "Only on this PC") + `<p class="note banner-note" id="wServer">${icon("info")}This page only exists on this computer, so no sign-in is needed: online, there is no way to write.</p>
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
      <label>Notes<textarea name="text" rows="11" placeholder="Any length. A blank line starts a new paragraph."></textarea></label>
      <p class="note">To put a photo in the middle of the text, write its marker on a line of its own, e.g. <code>[photo 2 right]</code>, <code>[photos 3-5]</code>, <code>[photos 1-6 mosaic]</code> (all of them: for-jemma/post-templates.md). Photos not placed go at the end.</p>
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
function notFound() { return head("Not found", "") + `<p class="note">There’s nothing at this address.</p><p class="not-found-links"><a href="#/">Home</a> · <a href="#/trips">All trips</a> · <a href="#/map">Map</a></p>`; }

// ---------- shell ----------
function pageTimeline() {
  // each year with trips, and one line for each run of years without any ("2013 – 2022: no trips")
  const rows = []; let gap = null;
  for (let y = +YEARS[0]; y >= +YEARS[YEARS.length - 1]; y--) {
    if (YEARS.includes(String(y))) { if (gap) rows.push(gap); gap = null; rows.push(String(y)); }
    else gap = gap ? [gap[0], y] : [y, y];
  }
  return head("Timeline", `Every trip, newest first`) + `<ol class="timeline">${rows.map(y => {
    if (Array.isArray(y)) return `<li class="tl-gap"><span class="tl-year">${y[1] === y[0] ? y[0] : `${y[1]} – ${y[0]}`}: no trips</span></li>`;
    const ts = TRIPS.filter(t => year(t) === y);
    return `<li class="tl-year-row"><h2 class="tl-year"><a href="#/year/${y}">${y}</a></h2><ol>${ts.map(t => `<li class="tl-trip">
      <a class="tl-cover" href="#/trip/${t.id}" tabindex="-1" aria-hidden="true">${cover(t)}</a>
      <div><div class="when">${icon("calendar")}${esc(fmtRange(t))}</div><h3><a href="#/trip/${t.id}">${esc(t.title)}</a></h3>
      <div class="chips">${chips(t.countries.filter(c => country(c).name !== t.title))}</div><div class="meta">about ${(Math.round(tripKm(t) / 100) * 100).toLocaleString("en-GB")} km there and back · ${postsOf(t.id).length ? plural(postsOf(t.id).length, "post") : "No posts yet"}</div></div></li>`).join("")}</ol></li>`;
  }).join("")}</ol>`;
}
function pageSearch(q) {
  q = String(q || "").trim();
  const box = `<form class="search-big" role="search" onsubmit="event.preventDefault(); location.hash = '#/search/' + encodeURIComponent(this.q.value.trim())"><input name="q" type="search" value="${esc(q)}" placeholder="A place, a country, a word from a post…" aria-label="Search"><button class="primary" type="submit">${icon("search")}Search</button></form>`;
  if (!q) return head("Search", `Trips, posts and countries`) + box;
  const norm = x => String(x || "").replace(/^\[placeholder\]/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = norm(q).split(/\s+/).filter(Boolean), hit = text => words.every(w => norm(text).includes(w));
  const trips = TRIPS.filter(t => hit([t.title, fmtRange(t), ...t.countries.map(c => country(c).name), ...(t.places || []).map(p => p[0])].join(" ")));
  const posts = D.posts.filter(p => !p.placeholder && hit([p.title, p.place, ...p.text.filter(x => !isPhotoMark(x))].join(" ")));
  const cs = VISITED.filter(c => hit(country(c).name));
  const n = trips.length + posts.length + cs.length;
  return head("Search", `${plural(n, "result")} for “${esc(q)}”`) + box +
    (cs.length ? `<section class="sec"><h2 class="sec-h">Countries</h2><div class="country-grid">${cs.map(c => `<a class="ctile" href="#/country/${c}"><span class="code">${c}</span><b>${esc(country(c).name)}</b></a>`).join("")}</div></section>` : "") +
    (trips.length ? `<section class="sec"><h2 class="sec-h">Trips</h2><div class="trip-grid">${trips.map(tripCard).join("")}</div></section>` : "") +
    (posts.length ? `<section class="sec"><h2 class="sec-h">Posts</h2><div class="post-list">${posts.map(p => postCard(p, { trip: true })).join("")}</div></section>` : "") +
    (n ? "" : `<p class="note">Nothing found. Placeholder posts aren’t searched.</p>`);
}
// ---------- sidebar ----------
// One level at a time, like Sim World's worlds › neighbourhoods › lots (her pick, 21 Nov): only the main items show;
// Trips opens to its years, a year to its trips; Map opens to its continents, a continent to its countries.
// A click opens one and goes to its page; a click on an open one closes it (and stays on the page).
// What you're on opens by itself. Search box at the top.
const navOpen = new Set();   // what she opened ("key") or closed ("-key"); closed ones open again on a new page inside them
const CONTINENTS = () => Object.keys(D.continentTotals).filter(k => VISITED.some(c => country(c).continent === k));
const tripsIn = c => TRIPS.filter(t => t.countries.includes(c));
function nav(route) {
  const item = (href, ic, label, on) => `<a href="${href}" class="${on ? "on" : ""}">${icon(ic)}<span>${label}</span></a>`;
  const r = route[0] || "", here = r === "country" ? route[1] : "";
  const t = r === "trip" ? tripById[route[1]] : null, yOn = r === "year" ? route[1] : t ? year(t) : "";
  const kOn = r === "continent" ? route[1] : here ? country(here).continent : "";
  const at = route.join("/");
  if (at !== nav.at) { [...navOpen].filter(k => k[0] === "-").forEach(k => navOpen.delete(k)); nav.at = at; }
  const isOpen = (key, auto) => navOpen.has(key) || (auto && !navOpen.has("-" + key));
  const kids = (body, open) => open ? `<div class="nav-kids">${body}</div>` : "";
  const opener = (key, href, ic, text, on, n, open, cls = "") => `<a href="${href}" data-key="${key}" class="${cls} ${on ? "on" : ""} ${open ? "is-open" : ""}" aria-expanded="${open}">${ic ? icon(ic) : ""}<span>${text}</span>${n != null ? `<small>${n}</small>` : ""}</a>`;
  const tripsOpen = isOpen("trips", r === "trips" || r === "trip" || r === "year"), mapOpen = isOpen("map", ["map", "countries", "country", "continent"].includes(r));
  const years = YEARS.map(y => {
    const ts = TRIPS.filter(x => year(x) === y), open = isOpen("y" + y, y === yOn);
    return opener("y" + y, `#/year/${y}`, "", y, r === "year" && route[1] === y, ts.length, open, "kid") +
      kids(ts.map(x => `<a href="#/trip/${x.id}" class="kid2 ${t && t.id === x.id ? "on" : ""}"><span>${esc(x.title)}</span></a>`).join(""), open);
  }).join("");
  const continents = CONTINENTS().map(k => {
    const cs = VISITED.filter(c => country(c).continent === k).sort((x, y) => country(x).name.localeCompare(country(y).name)), open = isOpen("k" + k, k === kOn);
    return opener("k" + k, `#/continent/${encodeURIComponent(k)}`, "", esc(k), r === "continent" && route[1] === k, cs.length, open, "kid") +
      kids(cs.map(c => `<a href="#/country/${c}" class="kid2 ${here === c ? "on" : ""}"><span>${esc(country(c).name)}</span><small>${tripsIn(c).length}</small></a>`).join(""), open);
  }).join("");
  const search = `<form class="nav-search" role="search" onsubmit="event.preventDefault(); location.hash = '#/search/' + encodeURIComponent(this.q.value.trim())">${icon("search")}<input name="q" type="search" placeholder="Search…" aria-label="Search trips, posts and countries" value="${r === "search" && route[1] ? esc(route[1]) : ""}"></form>`;
  return `${search}<div class="nav-main">${item("#/", "home", "Home", r === "")}
    ${opener("trips", "#/trips", "plane", "Trips", r === "trips", TRIPS.length, tripsOpen)}${kids(years, tripsOpen)}
    ${opener("map", "#/map", "map", "Map", r === "map" || r === "countries", VISITED.length, mapOpen)}${kids(continents, mapOpen)}
    ${item("#/stats", "chart", "Stats", r === "stats")}${item("#/timeline", "clock", "Timeline", r === "timeline")}<a href="#/surprise" class="surprise">${icon("shuffle")}<span>Surprise me</span></a>${LOCAL ? item("#/write", "pen", "Write", r === "write") : ""}</div>`;
}
const navRoute = () => location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
$("#nav").addEventListener("click", e => {
  const a = e.target.closest("a[data-key]"); if (!a) return;
  const key = a.dataset.key;
  if (a.getAttribute("aria-expanded") === "true") { e.preventDefault(); navOpen.delete(key); navOpen.add("-" + key); $("#nav").innerHTML = nav(navRoute()); }
  else { navOpen.delete("-" + key); navOpen.add(key); if (a.getAttribute("href") === location.hash) { e.preventDefault(); $("#nav").innerHTML = nav(navRoute()); } }
});

function render() {
  const route = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [r, a, b] = route;
  let html;
  if (!r) html = pageHome();
  else if (r === "trips") html = a === "by-country" ? pageTripsByCountry() : a ? notFound() : pageTrips();
  else if (r === "year") html = pageTrips(a);
  else if (r === "trip") html = b ? pagePost(a, b) : pageTrip(a);
  else if (r === "map") html = a ? notFound() : pageMap();
  else if (r === "surprise") { location.replace(surprisePost()); return; }
  else if (r === "timeline") html = pageTimeline();
  else if (r === "search") html = pageSearch(a);
  else if (r === "countries") html = pageMap();   // the old Countries address still works
  else if (r === "country") html = pageCountry(a);
  else if (r === "continent") html = pageContinent(a);
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
  const t = $("#view h1"); document.title = (r && t ? t.textContent.replace("Placeholder", "").trim() + " · " : "") + "Jemma’s Travels";
  window.scrollTo(0, 0);
}
// the footer is in index.html (the family layout, 21 Nov); here its icons and buttons
document.querySelector("#topBtn .ico").outerHTML = icon("arrow-up");
// Back to top beside Dark mode (her ask, 21 Nov, as on Jemma’s Journals): to the top, and keyboard focus with it
$("#topBtn").onclick = () => { window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); $("#view").focus({ preventScroll: true }); };
// dark mode (the family rules, 21 Nov): light unless the footer button is pressed; one setting for all her sites, localStorage "jj-mode"
// (index.html's head script sets data-mode before the page is drawn and moves the old "jt-mode" over once)
const BAR = { light: "#ECF1EA", dark: "#15212C" };   // theme-color: the sidebar / top bar colour in each mode
function setMode(m, save) {
  document.documentElement.dataset.mode = m;
  if (save) try { localStorage.setItem("jj-mode", m); } catch (e) {}
  const b = $("#modeBtn");
  b.querySelector(".ico, svg").outerHTML = icon(m === "dark" ? "sun" : "moon");
  b.querySelector(".txt").textContent = m === "dark" ? "Light mode" : "Dark mode";
  b.setAttribute("aria-pressed", m === "dark");
  document.querySelector('meta[name="theme-color"]').setAttribute("content", BAR[m]);
}
$("#modeBtn").onclick = () => setMode(document.documentElement.dataset.mode === "dark" ? "light" : "dark", true);
setMode(document.documentElement.dataset.mode === "dark" ? "dark" : "light");
// the menu on narrow screens (the family rules, 21 Nov): at 900px and below the sidebar is a drawer sliding in from the left over the page
// (her ask, 21 Nov), Menu button on the left; closes on a link, Escape or the scrim; inert while closed; the page behind doesn't scroll
$("#menuIco").outerHTML = icon("menu");
const NARROW = matchMedia("(max-width: 900px)");
function setMenu(o, back) {
  const narrow = NARROW.matches; o = o && narrow;
  const was = document.body.classList.contains("menu-open");
  document.body.classList.toggle("menu-open", o);
  document.documentElement.classList.toggle("nav-lock", o);
  $("#menuBtn").setAttribute("aria-expanded", o);
  $("#side").inert = narrow && !o;
  for (const el of [$("#main"), $("#topbar"), $(".skip")]) el.inert = o;   // while open, Tab stays inside the drawer
  if (o && !was) ($("#nav a.on") || $('#nav a[href="#/"]')).focus();   // the page you're on (Home if none), never the Journals link
  else if (!o && was && back) $("#menuBtn").focus();
}
$("#menuBtn").onclick = () => setMenu(!document.body.classList.contains("menu-open"), true);
$("#scrim").onclick = () => setMenu(false, true);
addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("menu-open")) setMenu(false, true); });
NARROW.addEventListener("change", () => {   // crossing 900px resets the drawer; focus back on Menu if it was in the drawer
  const inside = $("#side").contains(document.activeElement);
  setMenu(false);
  if (inside && NARROW.matches) $("#menuBtn").focus();
});
addEventListener("hashchange", render);
// on her PC: if the site has been rebuilt since this page was opened, load the new version (so she never sees an old copy)
if (LOCAL && location.protocol.startsWith("http")) addEventListener("hashchange", () => {
  fetch("index.html", { cache: "no-store" }).then(r => r.text()).then(html => {
    const now = (html.match(/js\/app\.js\?v=([0-9a-f]+)/) || [])[1], mine = ([...document.scripts].map(s => s.src).find(u => /app\.js/.test(u)) || "").split("v=")[1];
    if (now && mine && now !== mine) location.reload();
  }).catch(() => {});
});

// "← Jemma’s Journals" goes to "/" (all her sites at one address once online); opened as a file on her PC, to the Journals page
// beside this project instead of a listing of the C drive (as Sim World does)
const HOME_LOCAL = "../../site/index.html";   // since 21 Nov this site sits inside Jemma’s Journals: travels/site → site
if (location.protocol === "file:") $(".home-link").setAttribute("href", HOME_LOCAL);

// her picks (21 Nov): Old Atlas, pale sidebar with a faint grid, banner header, plain paper: set on <html> in index.html
render();
