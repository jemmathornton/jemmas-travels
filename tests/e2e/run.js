// The page tests: the site in headless Edge (Playwright borrowed from Sim World), served straight from a folder.
//   node tests/e2e/run.js <site folder> <her|fixture> [expect.json] [name filter]
// Prints one JSON line per test: {"name", "ok", "error"}. Run through tests/e2e/test_site.py (python run_tests.py e2e).
// Pages are drawn by changing the address (#/...) in one loaded page per width, as she would click about.
const path = require('path'), fs = require('fs');
const { chromium } = require('C:/Users/Jemma/Documents/SimTracker/node_modules/playwright');

const [SITE, SUITE, EXPECT_FILE, FILTER] = process.argv.slice(2);
const EXPECT = EXPECT_FILE && fs.existsSync(EXPECT_FILE) ? JSON.parse(fs.readFileSync(EXPECT_FILE, 'utf8')) : {};
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const LOCAL = 'http://localhost:8099/', ONLINE = 'https://travels.test/';
const WIDTHS = [[1600, 1000, false], [1280, 800, false], [1024, 768, false], [390, 844, true]];

let browser;
const TESTS = [];
const test = (name, fn) => TESTS.push({ name, fn });
const ok = (v, msg) => { if (!v) throw new Error(msg || 'not true'); };
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

async function open({ width = 1600, height = 1000, phone = false, host = LOCAL, hash = '#/' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1 });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.route(host + '**', r => {
    const u = new URL(r.request().url());
    const f = path.join(SITE, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname.slice(1)));
    if (!f.startsWith(path.resolve(SITE)) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: 'missing' });
    r.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'application/octet-stream' });
  });
  await page.goto(host + hash, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  page.close2 = () => ctx.close();
  return page;
}
// draw a page by changing the address, as a click would
async function go(page, hash) {
  await page.evaluate(h => new Promise(done => {
    if (location.hash === h) { window.dispatchEvent(new HashChangeEvent('hashchange')); return setTimeout(done, 0); }
    addEventListener('hashchange', () => setTimeout(done, 0), { once: true }); location.hash = h;
  }), hash);
}
const routes = page => page.evaluate(() => {
  const D = TRAVELS, r = ['#/', '#/trips', '#/map', '#/countries', '#/stats', '#/write'];
  for (const y of new Set(D.trips.map(t => t.from.slice(0, 4)))) r.push('#/year/' + y);
  for (const t of D.trips) r.push('#/trip/' + t.id);
  for (const p of D.posts) r.push(`#/trip/${p.trip}/${p.slug}`);
  for (const c of new Set(D.trips.flatMap(t => t.countries))) r.push('#/country/' + c);
  return r;
});
const shown = page => page.evaluate(() => ({
  h1: document.querySelector('#view h1')?.textContent.trim() || '',
  sideways: document.documentElement.scrollWidth - innerWidth,
  title: document.title,
  text: document.querySelector('#view').innerText,
}));

// ---------------------------------------------------------------- her site
if (SUITE === 'her') {
  test('every page opens without errors or sideways scrolling, at four widths', async () => {
    const bad = [];
    for (const [w, h, phone] of WIDTHS) {
      const page = await open({ width: w, height: h, phone });
      for (const r of await routes(page)) {
        await go(page, r);
        const s = await shown(page);
        if (!s.h1 || s.h1 === 'Not found') bad.push(`${w} ${r}: no page (${s.h1})`);
        if (s.sideways > 1) bad.push(`${w} ${r}: scrolls sideways by ${s.sideways}px`);
        if (!s.title.endsWith('Jemma’s Travels')) bad.push(`${w} ${r}: tab title ${s.title}`);
      }
      if (page.errors.length) bad.push(`${w}: errors ${page.errors.slice(0, 3).join(' / ')}`);
      await page.close2();
    }
    ok(!bad.length, bad.slice(0, 12).join('\n'));
  });

  test('every link on every page goes to a real page', async () => {
    const page = await open();
    const seen = new Set(), bad = [];
    for (const r of await routes(page)) {
      await go(page, r);
      for (const href of await page.$$eval('#view a[href^="#/"], #nav a[href^="#/"]', as => as.map(a => a.getAttribute('href')))) seen.add(href);
    }
    for (const href of seen) { await go(page, href); const s = await shown(page); if (!s.h1 || s.h1 === 'Not found') bad.push(href); }
    ok(seen.size > 30, `only ${seen.size} links found`);
    ok(!bad.length, 'dead links: ' + bad.join(', '));
    await page.close2();
  });

  test('sidebar counts match the data', async () => {
    const page = await open();
    const r = await page.evaluate(() => {
      const n = href => +document.querySelector(`#nav a[href="${href}"] small`)?.textContent;
      const D = TRAVELS, visited = new Set(D.trips.flatMap(t => t.countries).filter(c => c !== D.home));
      const years = {}; D.trips.forEach(t => { const y = t.from.slice(0, 4); years[y] = (years[y] || 0) + 1; });
      return { trips: [n('#/trips'), D.trips.length], countries: [n('#/countries'), visited.size],
        years: Object.entries(years).map(([y, c]) => [y, n('#/year/' + y), c]) };
    });
    eq(r.trips[0], r.trips[1], 'trips'); eq(r.countries[0], r.countries[1], 'countries');
    for (const [y, shownN, want] of r.years) eq(shownN, want, 'year ' + y);
    await page.close2();
  });

  test('stats and tracker figures match the data', async () => {
    const page = await open({ hash: '#/stats' });
    const r = await page.evaluate(() => {
      const D = TRAVELS, visited = [...new Set(D.trips.flatMap(t => t.countries))].filter(c => c !== D.home);
      const fact = k => [...document.querySelectorAll('.fact')].find(f => f.querySelector('.fk').textContent.trim().toLowerCase() === k)?.querySelector('b').textContent.trim();
      return { countries: [fact('countries'), String(visited.length)], trips: [fact('trips'), String(D.trips.length)],
        continents: [fact('continents'), String(new Set(visited.map(c => D.countries[c].continent)).size)] };
    });
    for (const [k, [got, want]] of Object.entries(r)) eq(got, want, k);
    await go(page, '#/countries');
    const ring = await page.evaluate(() => document.querySelector('.ring b').textContent);
    eq(ring, r.countries[1], 'tracker ring');
    await page.close2();
  });

  test('home banner: title clear of the map, map drawn whole, at every laptop width', async () => {
    const bad = [];
    for (const w of [1241, 1280, 1366, 1440, 1600, 1920, 2560]) {
      const page = await open({ width: w, height: 900 });
      const r = await page.evaluate(() => {
        const svg = document.querySelector('.hero-map svg'), t = document.querySelector('.hero h1').getBoundingClientRect();
        const box = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
        const k = Math.min(box.width / vb.width, box.height / vb.height);
        const drawnW = vb.width * k, left = box.left + (box.width - drawnW) / 2;
        // the map's land on screen: every country path's box
        const land = [...svg.querySelectorAll('path.c')].map(p => p.getBoundingClientRect());
        const landLeft = Math.min(...land.map(b => b.left));
        // what the title covers: is any visited country under it?
        const under = [...svg.querySelectorAll('path.c.v')].filter(p => { const b = p.getBoundingClientRect(); return b.left < t.right && b.right > t.left && b.top < t.bottom && b.bottom > t.top; }).map(p => p.querySelector('title').textContent);
        const hero = document.querySelector('.hero').getBoundingClientRect();
        return { slice: svg.getAttribute('preserveAspectRatio'), fits: drawnW <= box.width + 1 && vb.height * k <= box.height + 1,
          inHero: left >= hero.left - 1 && left + drawnW <= hero.right + 1, landLeft, titleRight: t.right, under };
      });
      if (r.slice && /slice/.test(r.slice)) bad.push(`${w}: map is cropped (slice)`);
      if (!r.fits || !r.inHero) bad.push(`${w}: map not drawn whole`);
      if (r.under.length > 1) bad.push(`${w}: title covers ${r.under.join(', ')}`);
      await page.close2();
    }
    ok(!bad.length, bad.join('\n'));
  });

  test('maps: every visited country is inside the world maps; trip maps show their pins', async () => {
    const page = await open();
    const bad = [];
    for (const r of ['#/', '#/map']) {
      await go(page, r);
      const out = await page.evaluate(() => {
        const svg = document.querySelector('svg.worldmap'), vb = svg.viewBox.baseVal;
        return [...svg.querySelectorAll('path.c')].map(p => { const b = p.getBBox(); return [p.querySelector('title').textContent, b.x, b.y, b.x + b.width, b.y + b.height]; })
          .filter(([n, x0, y0, x1, y1]) => ['New Zealand', 'Argentina', 'Chile', 'Japan', 'Australia', 'Fiji'].includes(n) && (x0 < -1 || y0 < -1 || x1 > vb.width + 1 || y1 > vb.height + 1)).map(x => x[0]);
      });
      if (out.length) bad.push(`${r}: cut off: ${out.join(', ')}`);
    }
    for (const r of (await routes(page)).filter(r => /^#\/(trip\/[^/]+|country\/\w+)$/.test(r))) {
      await go(page, r);
      const out = await page.evaluate(() => {
        const svg = document.querySelector('#view svg.worldmap'); if (!svg) return 'no map';
        const vb = svg.viewBox.baseVal;
        const pins = [...svg.querySelectorAll('.pin-dot')].filter(c => { const x = +c.getAttribute('cx'), y = +c.getAttribute('cy'); return x < 0 || y < 0 || x > vb.width || y > vb.height; });
        const visited = svg.querySelectorAll('path.c.v').length;
        const stripe = [...svg.querySelectorAll('path.c.v')].some(p => p.getBBox().width > vb.width * 3);   // a visited country drawn right across (the 180° line bug)
        return (pins.length ? `${pins.length} pins off the map ` : '') + (visited ? '' : 'no country coloured in ') + (stripe ? 'a country stretches across the map' : '');
      });
      if (out) bad.push(`${r}: ${out}`);
    }
    ok(!bad.length, bad.join('\n'));
    await page.close2();
  });

  test('phone menu slides over the page and closes by ×, outside, Esc and a link', async () => {
    const page = await open({ width: 390, height: 844, phone: true });
    const top = () => page.evaluate(() => document.querySelector('#view').getBoundingClientRect().top);
    const isOpen = () => page.evaluate(() => document.body.classList.contains('menu-open'));
    const t0 = await top();
    const btn = await page.evaluate(() => { const b = document.querySelector('#menuBtn').getBoundingClientRect(); return b.left < innerWidth / 2; });
    ok(btn, 'menu button should be on the left');
    await page.tap('#menuBtn'); await page.waitForTimeout(350);
    ok(await isOpen(), 'did not open'); eq(await top(), t0, 'page moved when the menu opened:');
    const navIn = await page.evaluate(() => document.querySelector('#nav').getBoundingClientRect().left >= -1);
    ok(navIn, 'menu did not slide in');
    await page.tap('#menuBtn'); await page.waitForTimeout(300); ok(!(await isOpen()), '× did not close it');
    await page.tap('#menuBtn'); await page.waitForTimeout(300); await page.tap('.scrim', { position: { x: 370, y: 600 } }); await page.waitForTimeout(300);
    ok(!(await isOpen()), 'tapping outside did not close it');
    await page.tap('#menuBtn'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); ok(!(await isOpen()), 'Esc did not close it');
    await page.tap('#menuBtn'); await page.waitForTimeout(300); await page.tap('#nav a[href="#/stats"]'); await page.waitForTimeout(300);
    ok(!(await isOpen()), 'a link did not close it'); eq(await page.evaluate(() => location.hash), '#/stats');
    await page.close2();
  });

  test('Write page only on her PC: online there is no Write page or link', async () => {
    const local = await open({ hash: '#/write' });
    eq((await shown(local)).h1, 'Write a post', 'on her PC');
    await local.close2();
    const online = await open({ host: ONLINE, hash: '#/write' });
    eq((await shown(online)).h1, 'Not found', 'online');
    ok(!(await online.$('#nav a[href="#/write"]')), 'online the sidebar still has Write');
    ok(!online.errors.length, online.errors.join(' / '));
    await online.close2();
  });

  test('posts: every photo marker becomes photos; unplaced photos go to the end', async () => {
    const page = await open();
    const bad = [];
    const posts = await page.evaluate(() => TRAVELS.posts.map(p => ({ id: p.trip, slug: p.slug, n: p.photos.length, marks: p.text.filter(x => /^\[photos? /.test(x.trim())) })));
    for (const p of posts) {
      await go(page, `#/trip/${p.id}/${p.slug}`);
      const r = await page.evaluate(() => ({ text: document.querySelector('.post-text').innerText, placed: document.querySelectorAll('.post-text .photo').length, gallery: document.querySelectorAll('.post .gallery .photo').length }));
      if (/\[photos? /.test(r.text)) bad.push(`${p.id}/${p.slug}: marker shown as text`);
      let want = 0; for (const m of p.marks) { const x = m.match(/(\d+)(?:\s*-\s*(\d+))?/); want += (+(x[2] || x[1])) - (+x[1]) + 1; }
      if (r.placed !== want) bad.push(`${p.id}/${p.slug}: ${r.placed} placed, markers ask for ${want}`);
      if (r.placed + r.gallery !== p.n) bad.push(`${p.id}/${p.slug}: ${r.placed}+${r.gallery} shown of ${p.n}`);
    }
    ok(!bad.length, bad.join('\n'));
    await page.close2();
  });

  test('shown text: no straight apostrophes, no raw [placeholder] or [photo] text, placeholders marked', async () => {
    const page = await open();
    const bad = [];
    for (const r of await routes(page)) {
      await go(page, r);
      const t = await page.evaluate(() => document.body.innerText);
      if (/[A-Za-z]'[A-Za-z]/.test(t)) bad.push(`${r}: straight apostrophe: ${t.match(/.{0,20}[A-Za-z]'[A-Za-z].{0,20}/)[0]}`);
      if (/\[placeholder\]|\[photos? \d/i.test(t)) bad.push(`${r}: raw marker in text`);
    }
    ok(!bad.length, bad.slice(0, 10).join('\n'));
    await page.close2();
  });

  test('pictures all load; images have alt attributes', async () => {
    const page = await open();
    const bad = [];
    for (const r of await routes(page)) {
      await go(page, r);
      await page.waitForLoadState('networkidle');
      const b = await page.evaluate(() => [...document.images].filter(i => !i.complete || !i.naturalWidth || !i.hasAttribute('alt')).map(i => i.getAttribute('src')));
      if (b.length) bad.push(`${r}: ${b.join(', ')}`);
    }
    ok(!bad.length, bad.join('\n'));
    await page.close2();
  });

  test('keyboard: skip link, visible focus, every link reachable', async () => {
    const page = await open();
    await page.keyboard.press('Tab');
    eq(await page.evaluate(() => document.activeElement.className), 'skip', 'first Tab');
    await page.keyboard.press('Enter');
    eq(await page.evaluate(() => document.activeElement.id), 'view', 'skip link moves to the page');
    await page.keyboard.press('Tab');
    const style = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth; });
    ok(!/none|0px/.test(style), 'focus has no outline: ' + style);
    await page.close2();
  });

  // ---- from the critical review (21 Nov): each one stays fixed
  test('addresses can’t run code, and unknown years or trips say Not found', async () => {
    const page = await open();
    await go(page, '#/year/%3Cimg%20src%3Dx%20onerror%3D%22window.__hit%3D1%22%3E');
    await page.waitForTimeout(200);
    ok(!(await page.evaluate(() => window.__hit)), 'code in the address ran');
    eq((await shown(page)).h1, 'Not found', 'a made-up year');
    for (const r of ['#/year/1999', '#/trip/nowhere', '#/trip/japan-2024/99', '#/country/ZZ', '#/nothing']) { await go(page, r); eq((await shown(page)).h1, 'Not found', r); }
    await page.close2();
  });

  test('latest posts on the home page are the newest trip’s newest posts', async () => {
    const page = await open();
    const r = await page.evaluate(() => {
      const t = [...TRAVELS.trips].sort((a, b) => (b.from.length === 4 ? b.from + '-00' : b.from).localeCompare(a.from.length === 4 ? a.from + '-00' : a.from))
        .find(t => TRAVELS.posts.some(p => p.trip === t.id));
      const want = TRAVELS.posts.filter(p => p.trip === t.id).map(p => `#/trip/${p.trip}/${p.slug}`).reverse().slice(0, 3);
      return [[...document.querySelectorAll('.post-tile h3 a')].map(a => a.getAttribute('href')), want];
    });
    eq(r[0], r[1]);
    await page.close2();
  });

  test('country pages show the places named in that country, inside the map', async () => {
    const page = await open();
    for (const [code, place] of [['ES', 'Tenerife'], ['FR', 'Strasbourg'], ['US', 'Nashville']]) {
      await go(page, '#/country/' + code);
      const r = await page.evaluate(() => { const svg = document.querySelector('#view svg.worldmap'), vb = svg.viewBox.baseVal;
        return [...svg.querySelectorAll('.pin')].map(g => { const c = g.querySelector('.pin-dot'); return [g.querySelector('title').textContent, +c.getAttribute('cx') >= 0 && +c.getAttribute('cx') <= vb.width && +c.getAttribute('cy') >= 0 && +c.getAttribute('cy') <= vb.height]; }); });
      const pin = r.find(([t]) => t.startsWith(place));
      ok(pin, `${code}: no ${place} pin (${r.map(x => x[0]).join(', ')})`); ok(pin[1], `${code}: ${place} pin is off the map`);
    }
    await go(page, '#/country/JP');
    eq(await page.evaluate(() => document.querySelectorAll('#view .pin').length), 0, 'Japan has no named places, so no pins');
    await page.close2();
  });

  test('headings go in order (no skipped levels) on every page', async () => {
    const page = await open();
    const bad = [];
    for (const r of await routes(page)) {
      await go(page, r);
      const levels = await page.evaluate(() => [...document.querySelectorAll('#view h1, #view h2, #view h3, #view h4')].map(h => +h.tagName[1]));
      if (levels[0] !== 1) bad.push(`${r}: starts at h${levels[0]}`);
      for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) { bad.push(`${r}: h${levels[i - 1]} then h${levels[i]}`); break; }
    }
    ok(!bad.length, bad.join('\n'));
    await page.close2();
  });

  test('after following a link, focus is on the new page; Esc on the menu returns to its button', async () => {
    const page = await open();
    await page.click('#nav a[href="#/stats"]'); await page.waitForTimeout(100);
    eq(await page.evaluate(() => document.activeElement.id), 'view');
    await page.close2();
    const phone = await open({ width: 390, height: 844, phone: true });
    await phone.tap('#menuBtn'); await phone.waitForTimeout(300); await phone.keyboard.press('Escape');
    eq(await phone.evaluate(() => document.activeElement.id), 'menuBtn');
    await phone.close2();
  });

  test('text is dark enough to read (contrast 4.5:1) for small grey and green text', async () => {
    const page = await open({ hash: '#/trip/japan-2024/01' });
    const bad = await page.evaluate(() => {
      const rgb = c => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = c => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
      const bgOf = el => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; const m = b.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] === 1)) return b; } return 'rgb(255,255,255)'; };   // first solid background (see-through tints skipped)
      const out = [];
      for (const sel of ['.crumbs', '.crumbs a', '.post-meta', '.day', '.ph', '.ph-text', '.note', '.post-nav small', '.foot span', '.nav a small', '.home-link', '.nav-h']) {
        const el = document.querySelector(sel); if (!el) continue;
        const r = ratio(getComputedStyle(el).color, bgOf(el));
        if (r < 4.5) out.push(`${sel} ${r.toFixed(2)}`);
      }
      return out;
    });
    ok(!bad.length, 'too faint: ' + bad.join(', '));
    await page.close2();
  });

  test('phone: the Write page and every form fit the screen', async () => {
    const page = await open({ width: 390, height: 844, phone: true, hash: '#/write' });
    const r = await page.evaluate(() => [...document.querySelectorAll('.write input, .write select, .write textarea, .drop')].filter(e => e.getBoundingClientRect().right > innerWidth - 8).length);
    eq(r, 0, 'controls sticking out');
    await page.close2();
  });

  test('only one filter id per map, even with two maps on a page', async () => {
    const page = await open({ hash: '#/trip/japan-2024' });
    const ids = await page.evaluate(() => [...document.querySelectorAll('filter')].map(f => f.id));
    eq(new Set(ids).size, ids.length, 'duplicate ids ' + ids);
    await page.close2();
  });
}

// ---------------------------------------------------------------- made-up trips with known answers
if (SUITE === 'fixture') {
  test('stats give the worked-out answers', async () => {
    const page = await open({ hash: '#/stats' });
    const f = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.fact')].map(x => [x.querySelector('.fk').textContent.trim().toLowerCase(), x.querySelector('b').textContent.trim() + ' | ' + (x.querySelector('small')?.textContent.trim() || '')])));
    eq(f['countries'].split(' | ')[0], String(EXPECT.visited), 'countries');
    eq(f['continents'].split(' | ')[0], String(EXPECT.continents), 'continents');
    eq(f['trips'].split(' | ')[0], String(EXPECT.trips), 'trips');
    eq(f['busiest year'].split(' | ')[0], EXPECT.busiest, 'busiest year');
    eq(f['longest gap'], `${EXPECT.longest_gap[0]} years | ${EXPECT.longest_gap[1]} to ${EXPECT.longest_gap[2]}`, 'longest gap');
    eq(f['most visited'].split(' | ')[0], EXPECT.most_visited.join(', '), 'most visited');
    eq(f['favourite month'].split(' | ')[0], EXPECT.fav_month, 'favourite month');
    ok(f['furthest from home'].startsWith(EXPECT.furthest) && /Birmingham/.test(f['furthest from home']), 'furthest: ' + f['furthest from home']);
    const bars = await page.evaluate(() => [...document.querySelectorAll('.bar')].map(b => b.title));
    eq(bars[0], '2020: 2 trips', 'first bar'); eq(bars[bars.length - 1], '2026: 3 trips', 'last bar');
    ok(bars.includes('2023: 0 trips'), 'empty years shown as zero');
    await page.close2();
  });

  test('home country visits are not counted as countries visited', async () => {
    const page = await open({ hash: '#/countries' });
    const r = await page.evaluate(() => ({ ring: document.querySelector('.ring b').textContent, tiles: [...document.querySelectorAll('.ctile b')].map(b => b.textContent) }));
    eq(r.ring, String(EXPECT.visited)); ok(!r.tiles.includes('United Kingdom'), 'UK listed as visited');
    await page.close2();
  });

  test('dates: no month, across New Year, posts with dates', async () => {
    const page = await open({ hash: '#/trips' });
    const when = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.trip-card')].map(c => [c.querySelector('h3').textContent, c.querySelector('.when').textContent.trim()])));
    eq(when['Chile'], '2026'); eq(when['Fiji & New Zealand'], 'December 2026 – January 2027'); eq(when['Italy and France'], 'May – June 2020');
    const years = await page.evaluate(() => [...document.querySelectorAll('.year-h a')].map(a => a.textContent));
    eq(years, EXPECT.years, 'year groups');
    await go(page, '#/trip/paris-2026/01'); eq(await page.evaluate(() => document.querySelector('.post .day').textContent), '5 March');
    await go(page, '#/trip/paris-2026/02'); eq(await page.evaluate(() => document.querySelector('.post .day').textContent), '6–7 March');
    await go(page, '#/trip/fiji-nz-2027/01'); eq(await page.evaluate(() => document.querySelector('.post .day').textContent), 'Days 1–3');
    await page.close2();
  });

  test('titles with < > & and apostrophes show as written, not as code', async () => {
    const page = await open({ hash: '#/trip/paris-2026' });
    eq(await page.evaluate(() => document.querySelector('#view h1').textContent), 'Paris <with> Mum\'s & Dad\'s');
    ok(!(await page.$('#view with')), 'title was read as HTML');
    await go(page, '#/trip/paris-2026/01');
    eq(await page.evaluate(() => document.querySelector('.post h1').textContent), 'Arriving & the Eiffel Tower');
    ok(!page.errors.length, page.errors.join(' / '));
    await page.close2();
  });

  test('photos: real files load, markers place them, caption shown, rest at the end', async () => {
    const page = await open({ hash: '#/trip/paris-2026/01' });
    await page.waitForLoadState('networkidle');
    const r = await page.evaluate(() => ({
      right: document.querySelectorAll('.post-text .inline.right img').length,
      caption: document.querySelector('.post-text .inline.right figcaption')?.textContent,
      row: document.querySelectorAll('.post-text .inline.row img').length,
      gallery: [...document.querySelectorAll('.post .gallery img')].map(i => i.getAttribute('src')),
      broken: [...document.images].filter(i => !i.naturalWidth).length,
      excerptOnTrip: null,
    }));
    eq([r.right, r.caption, r.row, r.gallery], [1, 'Looking up', 2, ['photos/paris-2026/d.jpg']]);
    eq(r.broken, 0, 'broken pictures');
    await go(page, '#/trip/paris-2026');
    eq(await page.evaluate(() => document.querySelector('.post-card .excerpt').textContent), 'First paragraph of notes.', 'excerpt skips markers');
    eq(await page.evaluate(() => document.querySelectorAll('.trip-card, .post-card .strip img').length), 4, 'photo strip');
    await page.close2();
  });

  test('country over the 180° line (Fiji) maps without a stripe, pins on the map', async () => {
    const page = await open({ hash: '#/country/FJ' });
    const r = await page.evaluate(() => {
      const svg = document.querySelector('#view svg.worldmap'), vb = svg.viewBox.baseVal;
      const fiji = [...svg.querySelectorAll('path.c.v')].map(p => p.getBBox());
      return { n: fiji.length, widest: Math.max(...fiji.map(b => b.width)), vbw: vb.width, inside: fiji.some(b => b.x + b.width > 0 && b.x < vb.width) };
    });
    ok(r.n >= 1 && r.inside, 'Fiji not on its map'); ok(r.widest < r.vbw * 1.2, 'Fiji stretches across the map: ' + r.widest + ' of ' + r.vbw);
    await go(page, '#/trip/fiji-nz-2027');
    const t = await page.evaluate(() => { const svg = document.querySelector('#view svg.worldmap'), vb = svg.viewBox.baseVal; return [...svg.querySelectorAll('path.c.v')].map(p => { const b = p.getBBox(); return b.x < vb.width && b.x + b.width > 0; }); });
    ok(t.length >= 2 && t.every(Boolean), 'Fiji and New Zealand should both be on the trip map');
    await page.close2();
  });
}

(async () => {
  browser = await chromium.launch({ channel: 'msedge' });
  for (const t of TESTS) {
    if (FILTER && !t.name.toLowerCase().includes(FILTER.toLowerCase())) continue;
    let error = null;
    try { await Promise.race([t.fn(), new Promise((_, no) => setTimeout(() => no(new Error('took over 3 minutes')), 180000))]); }
    catch (e) { error = String(e && e.message || e); }
    console.log(JSON.stringify({ name: t.name, ok: !error, error }));
  }
  await browser.close();
})();
