// Maps drawn from Natural Earth country shapes (js/world.js), in the Natural Earth projection.
// worldMap(pins, opts) returns SVG markup. Visited countries are filled and link to their page.
// opts: focus [west, south, east, north] (degrees) to zoom in; visited: [ISO numeric ids]; links: {isoNumeric: href};
// labels: show pin names; aria: description.
const RAD = Math.PI / 180;
function neProject(lon, lat) {
  const l = lon * RAD, p = lat * RAD, p2 = p * p, p4 = p2 * p2;
  return [
    l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
    p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))),
  ];
}
const _bbox = {};
function countryBox(set, id) {
  const k = set + id; if (_bbox[k]) return _bbox[k];
  let w = 180, s = 90, e = -180, n = -90;
  for (const r of WORLD[set][id][1]) for (let i = 0; i < r.length; i += 2) {
    if (r[i] < w) w = r[i]; if (r[i] > e) e = r[i]; if (r[i + 1] < s) s = r[i + 1]; if (r[i + 1] > n) n = r[i + 1];
  }
  return (_bbox[k] = [w, s, e, n]);
}
function worldMap(pins = [], opts = {}) {
  const zoom = !!opts.focus;
  const [w0, s0, e0, n0] = opts.focus || opts.bounds || [-180, -57, 180, 84];
  const set = zoom && (e0 - w0) < 120 ? "hi" : "lo";
  // fit the focus box (in projected units) to a 1000-wide picture
  // the edges bulge (widest at the equator), so sample along all four sides, not just the corners
  const corners = [];
  for (let i = 0; i <= 12; i++) { const lat = s0 + (n0 - s0) * i / 12, lon = w0 + (e0 - w0) * i / 12; corners.push([w0, lat], [e0, lat], [lon, s0], [lon, n0]); }
  corners.forEach((c, i) => { corners[i] = neProject(c[0], c[1]); });
  const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 1000, k = W / (maxX - minX), H = Math.round((maxY - minY) * k);
  const P = (lon, lat) => { const [x, y] = neProject(lon, lat); return [(x - minX) * k, (maxY - y) * k]; };
  const f = v => v.toFixed(1);
  const visited = new Set(opts.visited || []), links = opts.links || {};
  const pad = zoom ? 12 : 0;
  let land = "", lines = "";
  const g = zoom ? 10 : 30;   // graticule spacing in degrees
  for (let lon = Math.ceil(w0 / g) * g; lon <= e0; lon += g) {
    let d = ""; for (let lat = Math.max(s0 - 5, -85); lat <= Math.min(n0 + 5, 88); lat += 2) { const [x, y] = P(lon, lat); d += (d ? "L" : "M") + f(x) + " " + f(y); }
    lines += d;
  }
  for (let lat = Math.ceil(s0 / g) * g; lat <= n0; lat += g) {
    let d = ""; for (let lon = w0 - 5; lon <= e0 + 5; lon += 2) { const [x, y] = P(lon, lat); d += (d ? "L" : "M") + f(x) + " " + f(y); }
    lines += d;
  }
  for (const id in WORLD[set]) {
    const b = countryBox(set, id);
    if (b[2] < w0 - pad || b[0] > e0 + pad || b[3] < s0 - pad || b[1] > n0 + pad) continue;
    const [name, rings] = WORLD[set][id];
    let d = "";
    for (const r of rings) {
      for (let i = 0; i < r.length; i += 2) { const [x, y] = P(r[i], r[i + 1]); d += (i ? "L" : "M") + f(x) + " " + f(y); }
      d += "Z";
    }
    const v = visited.has(id);
    const path = `<path class="c${v ? " v" : ""}" d="${d}"><title>${esc(name)}</title></path>`;
    land += v && links[id] ? `<a href="${links[id]}" aria-label="${esc(name)}">${path}</a>` : path;
  }
  let pinsSvg = "";
  for (const p of pins) {
    const [x, y] = P(p.lon, p.lat).map(f);
    const label = opts.labels ? `<text x="${x}" y="${(y - 13).toFixed(1)}" text-anchor="middle">${esc(p.label)}</text>` : "";
    const body = `<g class="pin"><circle class="pin-halo" cx="${x}" cy="${y}" r="9"/><circle class="pin-dot" cx="${x}" cy="${y}" r="4.5"/>${label}<title>${esc(p.title || p.label)}</title></g>`;
    pinsSvg += p.href ? `<a href="${p.href}" aria-label="${esc(p.title || p.label)}">${body}</a>` : body;
  }
  return `<svg class="worldmap${zoom ? " zoom" : ""}" viewBox="0 0 ${W} ${H}"${opts.slice ? ' preserveAspectRatio="xMidYMid slice"' : ""} role="img" aria-label="${esc(opts.aria || "World map")}"><defs><filter id="rough" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="${zoom ? 4 : 2.2}"/></filter></defs><rect class="sea" width="${W}" height="${H}"/><path class="grat" d="${lines}"/><g class="land">${land}</g>${pinsSvg}</svg>`;
}
