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
const WIDTHS = [[1600, 1000, false], [1280, 800, false], [1024, 768, false], [950, 800, false], [390, 844, true]];   // 950: the sidebar beside a narrow page (round-2 review)

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
    if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });   // files only: no server behind it
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
  const D = TRAVELS, r = ['#/', '#/trips', '#/trips/by-country', '#/map', '#/countries', '#/stats', '#/write'];
  for (const y of new Set(D.trips.map(t => t.from.slice(0, 4)))) r.push('#/year/' + y);
  for (const t of D.trips) r.push('#/trip/' + t.id);
  for (const p of D.posts) r.push(`#/trip/${p.trip}/${p.slug}`);
  for (const c of new Set(D.trips.flatMap(t => t.countries))) r.push('#/country/' + c);
  for (const k of new Set(D.trips.flatMap(t => t.countries).filter(c => c !== D.home).map(c => D.countries[c].continent))) r.push('#/continent/' + encodeURIComponent(k));
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
  test('every page opens without errors or sideways scrolling, at five widths', async () => {
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
    const page = await open({ hash: '#/trips' });   // Trips open, showing its years
    const r = await page.evaluate(() => {
      const n = href => +document.querySelector(`#nav a[href="${href}"] small`)?.textContent;
      const D = TRAVELS, visited = new Set(D.trips.flatMap(t => t.countries).filter(c => c !== D.home));
      const years = {}; D.trips.forEach(t => { const y = t.from.slice(0, 4); years[y] = (years[y] || 0) + 1; });
      return { trips: [n('#/trips'), D.trips.length], countries: [n('#/map'), visited.size],
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
    const written = await page.evaluate(() => { const f = [...document.querySelectorAll('.fact')].find(f => f.querySelector('.fk').textContent.trim() === 'Written so far');
      const n = TRAVELS.posts.filter(p => !p.placeholder).length; return [f.querySelector('b').textContent.trim(), `${n} post${n === 1 ? '' : 's'}`]; });
    eq(written[0], written[1], 'written so far counts only her real posts (not placeholders):');
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

  test('phone menu slides over the page and closes outside, by Esc and a link', async () => {
    const page = await open({ width: 390, height: 844, phone: true });
    const top = () => page.evaluate(() => document.querySelector('#view').getBoundingClientRect().top);
    const isOpen = () => page.evaluate(() => document.body.classList.contains('menu-open'));
    const t0 = await top();
    const btn = await page.evaluate(() => { const b = document.querySelector('#menuBtn').getBoundingClientRect(); return b.left < innerWidth / 2; });
    ok(btn, 'menu button should be on the left');
    await page.tap('#menuBtn'); await page.waitForTimeout(350);
    ok(await isOpen(), 'did not open'); eq(await top(), t0, 'page moved when the menu opened:');
    const navIn = await page.evaluate(() => document.querySelector('#side').getBoundingClientRect().left >= -1);
    ok(navIn, 'menu did not slide in');
    ok(await page.evaluate(() => document.getElementById('topbar').inert), 'while open the bar (under the drawer) should be inert (family rules)'); await page.keyboard.press('Escape'); await page.waitForTimeout(300); ok(!(await isOpen()), 'Esc did not close it');
    await page.tap('#menuBtn'); await page.waitForTimeout(300); await page.tap('.scrim', { position: { x: 370, y: 600 } }); await page.waitForTimeout(300);
    ok(!(await isOpen()), 'tapping outside did not close it');
    await page.tap('#menuBtn'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); ok(!(await isOpen()), 'Esc did not close it');
    await page.tap('#menuBtn'); await page.waitForTimeout(300); await page.tap('#nav a[href="#/stats"]'); await page.waitForTimeout(300);
    ok(!(await isOpen()), 'a link did not close it'); eq(await page.evaluate(() => location.hash), '#/stats');
    await page.close2();
  });

  // ---- the family rules (21 Nov, her decision for all her sites; JemmasJournals/research/family-rules.md)
  test('family: opens light with the device set to dark; the button switches, saves jj-mode, changes the bar colour; a reload keeps it', async () => {
    const page = await open({ hash: '#/stats' });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle' });
    const st = () => page.evaluate(() => [document.documentElement.dataset.mode, localStorage.getItem('jj-mode'), document.querySelector('meta[name="theme-color"]').content,
      document.querySelector('#modeBtn').getAttribute('aria-pressed'), document.querySelector('#modeBtn').textContent.trim()]);
    eq(await st(), ['light', null, '#ECF1EA', 'false', 'Dark mode'], 'opens light:');
    eq(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(247, 245, 238)', 'light page:');
    await page.click('#modeBtn');
    eq(await st(), ['dark', 'dark', '#15212C', 'true', 'Light mode'], 'after the button:');
    await page.reload({ waitUntil: 'networkidle' });
    eq(await st(), ['dark', 'dark', '#15212C', 'true', 'Light mode'], 'after a reload:');
    // another site in the family choosing light is followed here
    await page.evaluate(() => localStorage.setItem('jj-mode', 'light')); await page.reload({ waitUntil: 'networkidle' });
    eq((await st())[0], 'light', 'jj-mode light from elsewhere:');
    // no dark styles follow the device setting
    const media = await page.evaluate(() => [...document.styleSheets].flatMap(x => { try { return [...x.cssRules]; } catch (e) { return []; } })
      .filter(r => r.media && /prefers-color-scheme/.test(r.media.mediaText)).length);
    eq(media, 0, 'prefers-color-scheme rules:');
    await page.close2();
  });

  test('family: her old choice (jt-mode) is kept once, moved to jj-mode; the mode is set before the page is drawn', async () => {
    const page = await open();
    await page.evaluate(() => { localStorage.removeItem('jj-mode'); localStorage.setItem('jt-mode', 'dark'); });
    await page.reload({ waitUntil: 'networkidle' });
    eq(await page.evaluate(() => [document.documentElement.dataset.mode, localStorage.getItem('jj-mode'), localStorage.getItem('jt-mode')]), ['dark', 'dark', null]);
    // the head script runs before the stylesheet (no flash of light)
    const order = await page.evaluate(() => { const h = document.head.innerHTML; return h.indexOf('jj-mode') > 0 && h.indexOf('jj-mode') < h.indexOf('site.css'); });
    ok(order, 'the mode script should come before the stylesheet');
    await page.evaluate(() => localStorage.clear());
    await page.close2();
  });

  const footerCheck = async (width, height, phone) => {
      const page = await open({ width, height, phone });
      const pages = await page.evaluate(() => { const t = TRAVELS.trips[0], p = TRAVELS.posts[0];
        return ['#/', '#/trips', '#/trip/' + t.id, `#/trip/${p.trip}/${p.slug}`, '#/map', '#/country/' + t.countries[0], '#/stats', '#/timeline', '#/no-such-page']; });
      const bad = [];
      for (const h of pages) {
        await go(page, h);
        const r = await page.evaluate(() => {
          const f = document.querySelector('.foot'), ps = [...f.querySelectorAll('.about-site p')], crs = [...ps[1].querySelectorAll('.cr')];
          const a = document.querySelector('#topBtn').getBoundingClientRect(), b = document.querySelector('#modeBtn').getBoundingClientRect();
          return { footers: document.querySelectorAll('footer').length, order: [...f.children].map(e => e.className), name: f.querySelector('.foot-name').textContent,
            italic: getComputedStyle(f.querySelector('.foot-name')).fontStyle, line1: ps[0].textContent, credits: crs.map(c => c.textContent),
            capitals: crs.every(c => /^[A-Z]/.test(c.textContent)), rows: new Set(crs.map(c => Math.round(c.getBoundingClientRect().top))).size,
            size: getComputedStyle(ps[0]).fontSize, level: Math.abs(a.top - b.top) < 2 && a.height >= 44 && b.height >= 44 && a.right < b.left,
            sideways: document.documentElement.scrollWidth > innerWidth,
            seps: [...ps[1].querySelectorAll('.sep')].every(d => d.textContent === '\u00a0·' && d.previousElementSibling.classList.contains('cr')),
            balance: /balance/.test(getComputedStyle(ps[1]).textWrap || '') || getComputedStyle(ps[1]).textWrapStyle === 'balance' };
        });
        const want = { footers: 1, order: ['foot-name', 'about-site', 'foot-links'], name: 'Jemma’s Travels', italic: 'normal',
          line1: 'No cookies, no tracking, no ads. Made with plain HTML and CSS, kept on GitHub.',
          credits: ['Photos are my own', 'Country shapes from Natural Earth', 'Fonts: Instrument Serif and Manrope', 'Icons by Lucide'], capitals: true,
          rows: phone ? 4 : 1, size: '12.5px', level: true, sideways: false, seps: true, balance: true };
        for (const k in want) if (JSON.stringify(r[k]) !== JSON.stringify(want[k])) bad.push(`${h} ${k}: ${JSON.stringify(r[k])}`);
      }
      ok(!bad.length, bad.join('\n'));
      await page.close2();
  };
  test('family: the footer in the family layout on several kinds of page (laptop)', () => footerCheck(1600, 1000, false));
  test('family: the footer in the family layout on several kinds of page (phone)', () => footerCheck(390, 844, true));

  test('family: the Menu bar shows at 899px and the sidebar at 901px; Menu on the left, then the name as a link home', async () => {
    const page = await open({ width: 901, height: 800, hash: '#/stats' });
    const state = () => page.evaluate(() => ({ bar: getComputedStyle(document.querySelector('.topbar')).display !== 'none',
      side: document.getElementById('side').getBoundingClientRect().left >= 0 && !document.getElementById('side').inert && getComputedStyle(document.getElementById('side')).visibility === 'visible' }));
    eq(await state(), { bar: false, side: true }, 'at 901:');
    await page.setViewportSize({ width: 899, height: 800 }); await page.waitForTimeout(350);
    eq(await state(), { bar: true, side: false }, 'at 899:');
    const r = await page.evaluate(() => { const b = document.querySelector('#menuBtn'), a = document.querySelector('.topbar a.brand-bar');
      return [b.textContent.trim(), !!b.querySelector('svg'), b.getAttribute('aria-controls'), b.getAttribute('aria-expanded'), a.textContent, a.getAttribute('href'),
        getComputedStyle(a.querySelector('em')).fontStyle, b.getBoundingClientRect().right <= a.getBoundingClientRect().left, b.getBoundingClientRect().height >= 44]; });
    eq(r, ['Menu', true, 'side', 'false', 'Jemma’s Travels', '#/', 'italic', true, true]);
    eq(await page.evaluate(() => getComputedStyle(document.querySelector('.topbar a.brand-bar')).fontSize), '26px', 'name in the bar (the same on every site):');
    await page.click('#menuBtn'); await page.waitForTimeout(300);
    eq(await page.evaluate(() => getComputedStyle(document.querySelector('#scrim')).backgroundColor), 'rgba(0, 0, 0, 0.45)', 'scrim black at 45%:');
    await page.keyboard.press('Escape');
    eq(await page.evaluate(() => document.getElementById('side').querySelector('a').textContent.trim()), '← Jemma’s Journals', 'first in the drawer:');
    eq(await page.evaluate(() => !!document.querySelector('.topbar .home-link')), false, 'the Journals link should not be in the bar:');
    await page.click('.topbar a.brand-bar'); await page.waitForTimeout(150);
    eq(await page.evaluate(() => location.hash), '#/');
    await page.close2();
  });

  test('family: the drawer: focus in and back, closed it is inert, page locked while open, crossing 900px resets it', async () => {
    const page = await open({ width: 390, height: 844 });
    const isOpen = () => page.evaluate(() => document.body.classList.contains('menu-open'));
    const inSide = () => page.evaluate(() => document.getElementById('side').contains(document.activeElement));
    await page.click('#menuBtn'); await page.waitForTimeout(300);
    eq([await isOpen(), await inSide()], [true, true], 'open, focus inside:');
    eq(await page.evaluate(() => [document.getElementById('main').inert, getComputedStyle(document.documentElement).overflow, document.getElementById('menuBtn').getAttribute('aria-expanded')]), [true, 'hidden', 'true']);
    await page.keyboard.press('Escape');
    eq([await isOpen(), await page.evaluate(() => document.activeElement.id), await page.evaluate(() => document.getElementById('side').inert)], [false, 'menuBtn', true], 'closed:');
    for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); ok(!(await inSide()), `Tab ${i + 1} reached the closed drawer`); }
    await page.click('#menuBtn'); await page.waitForTimeout(300);
    await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(300);
    eq(await page.evaluate(() => [document.body.classList.contains('menu-open'), document.getElementById('side').inert, document.getElementById('main').inert,
      document.documentElement.classList.contains('nav-lock'), document.getElementById('menuBtn').getAttribute('aria-expanded')]), [false, false, false, false, 'false'], 'after widening:');
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
    eq(await page.evaluate(() => [document.body.classList.contains('menu-open'), document.getElementById('side').inert]), [false, true], 'after narrowing again:');
    await page.close2();
  });

  test('family: the drawer opens to the page’s own link (Home if none); while open Tab stays inside; focus back on Menu when crossing 900px', async () => {
    const page = await open({ width: 390, height: 844, hash: '#/stats' });
    const act = () => page.evaluate(() => { const a = document.activeElement; return a === document.body ? 'body' : document.getElementById('side').contains(a) ? 'side:' + (a.getAttribute('href') || a.tagName) : (a.id || a.className || a.tagName); });
    await page.click('#menuBtn'); await page.waitForTimeout(300);
    eq(await act(), 'side:#/stats', 'opens to the Stats link:');
    eq(await page.evaluate(() => [document.getElementById('topbar').inert, document.querySelector('.skip').inert, document.getElementById('main').inert]), [true, true, true], 'everything else inert:');
    const bad = [];
    for (const key of ['Tab', 'Shift+Tab']) for (let i = 0; i < 30; i++) { await page.keyboard.press(key); const a = await act(); if (!/^side:|^body$/.test(a)) bad.push(`${key} ${i + 1}: ${a}`); }
    ok(!bad.length, 'Tab left the open drawer: ' + bad.slice(0, 4).join(', '));
    await page.keyboard.press('Escape');
    eq(await page.evaluate(() => [document.getElementById('topbar').inert, document.querySelector('.skip').inert, document.getElementById('main').inert]), [false, false, false], 'closed, nothing inert:');
    await go(page, '#/search'); await page.click('#menuBtn'); await page.waitForTimeout(300);
    eq(await act(), 'side:#/', 'a page with no link of its own opens to Home:');
    await page.keyboard.press('Escape');
    await go(page, '#/trip/japan-2024'); await page.click('#menuBtn'); await page.waitForTimeout(300);
    eq(await act(), 'side:#/trip/japan-2024', 'a trip opens to its own link:');
    // open, then wide (focus stays on the sidebar link), then narrow again: focus back on Menu, not lost
    await page.setViewportSize({ width: 1000, height: 800 }); await page.waitForTimeout(300);
    ok((await act()).startsWith('side:'), 'wide: focus stays on the sidebar link');
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
    eq(await act(), 'menuBtn', 'narrow again:');
    eq(page.errors, [], 'page errors');
    await page.close2();
  });

  test('family: the ← Jemma’s Journals link is at least 24px tall; opened as a file it goes to the Journals page, not the C drive', async () => {
    const page = await open();
    const h = await page.evaluate(() => document.querySelector('.home-link').getBoundingClientRect().height);
    ok(h >= 24, 'Journals link is ' + h + 'px tall');
    eq(await page.evaluate(() => document.querySelector('.home-link').getAttribute('href')), '/', 'served: the shared address');
    await page.close2();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const f = await ctx.newPage();
    await f.goto('file:///' + path.resolve(SITE, 'index.html').split(path.sep).join('/') + '#/');
    eq(await f.evaluate(() => document.querySelector('.home-link').getAttribute('href')), '../../JemmasJournals/concepts/index.html', 'as a file:');
    await ctx.close();
  });

  test('Map page tracker: bars drawn and figures inside the card between 900 and 1100px (round-2 review)', async () => {
    const bad = [];
    for (const w of [901, 950, 1000, 1024, 1100, 1280, 899, 860, 390]) {
      const page = await open({ width: w, height: 800, phone: w < 600, hash: '#/map' });
      const r = await page.evaluate(() => { const t = document.querySelector('.tracker').getBoundingClientRect();
        return { tracks: [...document.querySelectorAll('.cbar .track')].map(x => Math.round(x.getBoundingClientRect().width)),
          out: [...document.querySelectorAll('.cbar .cval')].filter(x => x.getBoundingClientRect().right > t.right + 1).length, sideways: document.documentElement.scrollWidth - innerWidth }; });
      if (Math.min(...r.tracks) < 60) bad.push(`${w}: bars only ${Math.min(...r.tracks)}px`);
      if (r.out) bad.push(`${w}: ${r.out} figures stick out of the card`);
      if (r.sideways > 0) bad.push(`${w}: scrolls sideways by ${r.sideways}px`);
      await page.close2();
    }
    ok(!bad.length, bad.join('\n'));
  });

  test('Japan’s country page frames all its main islands (Hokkaido, Kyushu, Okinawa); France without French Guiana, the US without Alaska', async () => {
    const page = await open({ hash: '#/country/JP' });
    const r = await page.evaluate(() => ({ jp: focusOn(['JP'], [], true), fr: focusOn(['FR'], [], true), us: focusOn(['US'], [], true) }));
    const inside = ([w, s, e, n], [lat, lon]) => lon >= w && lon <= e && lat >= s && lat <= n;
    for (const [name, pt] of [['Hokkaido', [43.8, 142.8]], ['Wakkanai', [45.4, 141.7]], ['Kyushu south', [31.1, 130.7]], ['Okinawa', [26.4, 127.8]], ['Tokyo', [35.7, 139.7]]]) ok(inside(r.jp, pt), `${name} is off Japan’s map ${r.jp.map(x => x.toFixed(1))}`);
    ok(inside(r.fr, [42.2, 9.1]) && !inside(r.fr, [4.0, -53.0]), 'France: Corsica in, French Guiana out ' + r.fr);
    ok(!inside(r.us, [64.8, -147.7]), 'US: Alaska out ' + r.us);
    eq(page.errors, []);
    await page.close2();
  });

  test('small text 4.5:1 on tinted backgrounds too: month cells, postcard stamps, home banner, highlighted sidebar counts (both modes)', async () => {
    const bad = [];
    for (const mode of ['light', 'dark']) {
      const page = await open({ hash: '#/' });
      await page.evaluate(m => { localStorage.setItem('jj-mode', m); }, mode); await page.reload({ waitUntil: 'networkidle' });
      for (const [hash, sels] of [['#/', ['.hero .kicker', '.hero .ph-text', '.hero .ph', '.stamp']], ['#/stats', ['.mcell b', '.mcell span']], ['#/trips', ['.nav a.on small', '.nav a.is-open small', '.nav a small']], ['#/trip/japan-2024/01', ['.crumbs', '.post-meta', '.note', '.about-site p']]]) {
        await go(page, hash);
        const out = await page.evaluate(sels => {
          const parse = c => { const v = c.match(/[\d.]+/g).map(Number); return c.startsWith('color(srgb') ? [v[0] * 255, v[1] * 255, v[2] * 255, v[3] ?? 1] : [v[0], v[1], v[2], v[3] ?? 1]; };
          const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
          const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
          const bgOf = el => {   // see-through backgrounds laid over what's behind them
            const layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } }
            let base = [255, 255, 255]; for (const c of layers.reverse()) base = base.map((v, i) => v * (1 - c[3]) + c[i] * c[3]); return base;
          };
          const res = [];
          for (const sel of sels) for (const el of document.querySelectorAll(sel)) { if (!el.getClientRects().length) continue; const r = ratio(parse(getComputedStyle(el).color), bgOf(el)); if (r < 4.5) res.push(`${sel} “${el.textContent.trim().slice(0, 12)}” ${r.toFixed(2)}`); }
          return res;
        }, sels);
        for (const o of out) bad.push(`${mode} ${hash} ${o}`);
      }
      await page.evaluate(() => localStorage.removeItem('jj-mode'));
      await page.close2();
    }
    ok(!bad.length, 'too faint: ' + [...new Set(bad)].slice(0, 12).join(', '));
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
      if (r !== '#/write' && /\[placeholder\]|\[photos? \d/i.test(t)) bad.push(`${r}: raw marker in text`);   // the Write page shows markers as help
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
    for (const r of ['#/year/1999', '#/trip/nowhere', '#/trip/japan-2024/99', '#/country/ZZ', '#/nothing', '#/trip/constructor', '#/trip/__proto__', '#/trip/toString/01', '#/country/constructor', '#/country/toString', '#/country/__proto__', '#/continent/constructor'])
      { await go(page, r); eq((await shown(page)).h1, 'Not found', r); }
    eq(page.errors, [], 'page errors');
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
      for (const sel of ['.crumbs', '.crumbs a', '.post-meta', '.day', '.ph', '.ph-text', '.note', '.post-nav small', '.about-site p', '.nav a small', '.home-link', '.nav-h']) {
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

  // ---- 21 Nov: dark mode, tab icon, trial extras
  test('dark mode: light at first, the footer button switches and is remembered, text still readable', async () => {
    const page = await open({ hash: '#/stats' });
    eq(await page.evaluate(() => document.documentElement.dataset.mode), 'light', 'opens light');
    await page.click('#modeBtn');
    eq(await page.evaluate(() => document.documentElement.dataset.mode), 'dark');
    ok(/Light mode/.test(await page.textContent('#modeBtn')), 'button should offer light mode back');
    await page.reload({ waitUntil: 'networkidle' });
    eq(await page.evaluate(() => document.documentElement.dataset.mode), 'dark', 'remembered after reloading');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    ok(bg !== 'rgb(247, 245, 238)', 'background should be dark: ' + bg);
    for (const r of ['#/', '#/trip/japan-2024/02', '#/countries', '#/trip/japan-2024']) {
      await go(page, r); ok(!page.errors.length, page.errors.join(' / '));
    }
    await page.click('#modeBtn');
    await page.close2();
  });

  test('the tab has an icon', async () => {
    const page = await open();
    const href = await page.evaluate(() => document.querySelector('link[rel="icon"]')?.getAttribute('href'));
    ok(href && fs.existsSync(path.join(SITE, href)), 'icon file missing: ' + href);
    await page.close2();
  });

  test('every trip page shows its route from home and back, with the distance; the Map page has no routes', async () => {
    const page = await open();
    for (const id of await page.evaluate(() => TRAVELS.trips.map(t => t.id))) {
      await go(page, '#/trip/' + id);
      const r = await page.evaluate(() => { const svg = document.querySelector('.trip-map svg'), vb = svg.viewBox.baseVal;
        const home = svg.querySelector('.pin.home .pin-dot'); const x = +home.getAttribute('cx'), y = +home.getAttribute('cy');
        return { routes: svg.querySelectorAll('.route').length, homeOnMap: x >= 0 && y >= 0 && x <= vb.width && y <= vb.height, km: /About [\d,]+ km from Birmingham and back/.test(document.querySelector('.route-meta')?.textContent || '') }; });
      eq(r, { routes: 1, homeOnMap: true, km: true }, id);
    }
    await go(page, '#/map'); eq(await page.evaluate(() => document.querySelectorAll('.big-map .route').length), 0, 'Map page');
    await go(page, '#/map/routes'); eq((await shown(page)).h1, 'Not found', 'old routes address');
    await page.close2();
  });

  test('timeline: every trip once, years in order, empty years grouped', async () => {
    const page = await open({ hash: '#/timeline' });
    const r = await page.evaluate(() => ({ trips: [...document.querySelectorAll('.tl-trip h3 a')].map(a => a.getAttribute('href')), all: TRAVELS.trips.length,
      years: [...document.querySelectorAll('.tl-year-row .tl-year')].map(h => +h.textContent), gaps: [...document.querySelectorAll('.tl-gap')].map(g => g.textContent) }));
    eq(new Set(r.trips).size, r.all, 'each trip once');
    eq(r.years, [...r.years].sort((a, b) => b - a), 'newest first');
    eq(r.gaps, ['2013 – 2022: no trips']);
    await page.close2();
  });

  test('search finds trips, countries and places; placeholders are not searched', async () => {
    const page = await open();
    const count = async q => { await go(page, '#/search/' + encodeURIComponent(q)); return page.evaluate(() => ({ trips: document.querySelectorAll('#view .trip-card').length, countries: document.querySelectorAll('#view .ctile').length, posts: document.querySelectorAll('#view .post-card').length })); };
    eq(await count('norway'), { trips: 1, countries: 1, posts: 0 });
    eq(await count('Nashville'), { trips: 1, countries: 0, posts: 0 });
    eq(await count('your notes'), { trips: 0, countries: 0, posts: 0 }, 'placeholder text');
    eq(await count('ZÜRICH xyz'), { trips: 0, countries: 0, posts: 0 });
    await go(page, '#/search');
    await page.fill('.search-big input', 'spain'); await page.press('.search-big input', 'Enter'); await page.waitForTimeout(150);
    eq(await page.evaluate(() => location.hash), '#/search/spain');
    await page.close2();
  });

  test('distance travelled on the stats page adds up the trips', async () => {
    const page = await open({ hash: '#/stats' });
    const r = await page.evaluate(() => {
      const f = [...document.querySelectorAll('.fact')].find(x => /distance/i.test(x.querySelector('.fk').textContent));
      const total = TRAVELS.trips.reduce((n, t) => n + tripKm(t), 0);
      return [f.querySelector('b').textContent, `${(Math.round(total / 1000) * 1000).toLocaleString('en-GB')} km`];
    });
    eq(r[0], r[1]);
    await page.close2();
  });


  test('this time of year, firsts, surprise me', async () => {
    const page = await open();
    const nov = await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = thisTimeOfYear(new Date(2026, 10, 21)); return [...d.querySelectorAll('.trip-card h3')].map(h => h.textContent); });
    eq(nov, ['Brazil and Argentina'], 'November 2026');
    eq(await page.evaluate(() => thisTimeOfYear(new Date(2026, 0, 5))), '', 'January: nothing');
    await go(page, '#/stats');
    const f = await page.evaluate(() => [...document.querySelectorAll('.firsts li')].map(li => li.querySelector('.fk').textContent + ': ' + li.querySelector('a').textContent));
    eq(f, ['First time in Asia: India', 'First time in North America: Canada and Boston', 'First time in South America: Brazil and Argentina'], 'not her home continent');
    await go(page, '#/surprise'); await page.waitForTimeout(150);
    ok(/^#\/trip\//.test(await page.evaluate(() => location.hash)), 'surprise lands on a trip or post');
    await page.close2();
  });

  test('Back to top sits beside Dark mode at the bottom and goes to the top', async () => {
    const page = await open({ hash: '#/timeline', height: 700 });
    const r = await page.evaluate(() => { const a = document.querySelector('#topBtn').getBoundingClientRect(), b = document.querySelector('#modeBtn').getBoundingClientRect(); return Math.abs(a.top - b.top) < 4 && a.right < b.left; });
    ok(r, 'buttons side by side');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.click('#topBtn'); await page.waitForTimeout(900);
    eq(await page.evaluate(() => Math.round(scrollY)), 0, 'scrolled to the top');
    eq(await page.evaluate(() => document.activeElement.id), 'view', 'focus at the top');
    await page.close2();
  });

  test('Map and Countries are one page (her pick); the old Countries address shows it; no Countries in the sidebar', async () => {
    const page = await open({ hash: '#/map' });
    const r = await page.evaluate(() => ({ map: !!document.querySelector('.big-map svg'), ring: document.querySelector('.ring b')?.textContent, tiles: document.querySelectorAll('.ctile').length,
      nav: [...document.querySelectorAll('#nav .nav-main a span')].map(s => s.textContent) }));
    ok(r.map && r.ring && r.tiles > 0, JSON.stringify(r)); ok(!r.nav.includes('Countries'), r.nav.join(', '));
    await go(page, '#/countries'); eq((await shown(page)).h1, 'Map');
    await go(page, '#/country/FR'); eq(await page.evaluate(() => [document.querySelector('#nav a.on span').textContent, document.querySelector('#nav a[data-key=map]').classList.contains('is-open')]), ['France', true], 'country pages: Map open, the country lit');
    await page.close2();
  });

  test('sidebar one level at a time (her pick, like Sim World): Trips › years › trips, Map › continents › countries; a click opens, a second closes', async () => {
    for (const [w, h, phone] of [WIDTHS[0], WIDTHS[4]]) { const k = 'a';
      const page = await open({ width: w, height: h, phone, hash: '#/country/JP' });
      const info = () => page.evaluate(() => {
        const D = TRAVELS, visited = [...new Set(D.trips.flatMap(t => t.countries))].filter(c => c !== D.home);
        return { visited, links: [...document.querySelectorAll('#nav a')].map(a => a.getAttribute('href')), on: [...document.querySelectorAll('#nav a.on')].map(a => a.getAttribute('href')), err: document.documentElement.scrollWidth - innerWidth };
      });
      const r = await info();
      eq(r.err, 0, `${k} ${w}: sideways scrolling`);
      {
        // A, one level at a time (like Sim World's worlds > neighbourhoods > lots): Trips > years > trips, Map > continents > countries
        ok(r.on.includes('#/country/JP') && r.links.includes('#/country/IN'), `a: Map > Asia open with Japan lit (${r.on})`);
        ok(!r.links.includes('#/country/FR') && !r.links.some(l => l.startsWith('#/year/')), 'a: Europe and Trips stay closed');
        await go(page, '#/');
        ok(!(await info()).links.some(l => /^#\/(year|continent|country|trip)\//.test(l)), 'a: home shows only the main items');
        const click = async sel => { await page.evaluate(sel => document.querySelector(sel).click(), sel); await page.waitForTimeout(80); };
        await click('#nav a[data-key=trips]');
        eq(await page.evaluate(() => location.hash), '#/trips');
        ok((await info()).links.includes('#/year/2024'), 'a: Trips opens to years');
        await click('#nav a[data-key=y2024]');
        ok((await info()).links.includes('#/trip/japan-2024'), 'a: 2024 opens to its trips');
        await click('#nav a[data-key=y2024]');
        ok(!(await info()).links.includes('#/trip/japan-2024'), 'a: a second click closes 2024');
        eq(await page.evaluate(() => location.hash), '#/year/2024', 'closing stays on the page');
        await click('#nav a[data-key=trips]');
        ok(!(await info()).links.includes('#/year/2024'), 'a: a second click closes Trips');
        await go(page, '#/trip/japan-2024/02');
        const t = await info();
        ok(t.on.includes('#/trip/japan-2024') && t.links.includes('#/trip/france-spain-2024'), 'a: Trips > 2024 open on a post, Japan lit: ' + t.on);
        await go(page, '#/continent/Europe');
        eq((await shown(page)).h1, 'Europe');
        ok((await info()).links.includes('#/country/FR'), 'a: Europe open on its page');
        if (!phone) {
          await page.fill('.nav-search input', 'japan'); await page.press('.nav-search input', 'Enter'); await page.waitForTimeout(100);
          eq(await page.evaluate(() => location.hash), '#/search/japan', 'search box');
        }
      }
      await go(page, '#/trips/by-country');
      const bc = await page.evaluate(() => ({ h1: document.querySelector('#view h1').textContent, countries: [...document.querySelectorAll('.by-country h3 a')].map(a => a.getAttribute('href')), tab: document.querySelector('.tabs a.on')?.textContent }));
      eq(bc.h1, 'Trips'); eq(bc.tab, 'By country');
      eq(bc.countries.length, r.visited.length, 'every country on Trips by country');
      eq(page.errors, [], 'page errors');
      await page.close2();
    }
  });

  test('from the 21 Nov check: no repeated names, year once, Previous/Next words, ways on from Not found', async () => {
    const page = await open({ hash: '#/map' });
    const titles = await page.evaluate(() => [...document.querySelectorAll('.big-map .pin title')].map(t => t.textContent));
    ok(!titles.some(t => { const [a, b] = t.split(' · '); return a === b; }), 'pin says a name twice: ' + titles.join(', '));
    ok(await page.evaluate(() => [...document.querySelectorAll('.big-map path.c title')].some(t => t.textContent === 'United States')), 'map uses the page name for the US');
    await go(page, '#/year/2024');
    eq(await page.evaluate(() => document.querySelectorAll('.year-h').length), 0, 'year page says its year once');
    await go(page, '#/trips');
    ok(await page.evaluate(() => [...document.querySelectorAll('.trip-card')].every(c => ![...c.querySelectorAll('.chip')].some(ch => ch.textContent === c.querySelector('h3').textContent))), 'a card repeats its title as a chip');
    await go(page, '#/trip/japan-2024/02');
    const nav = await page.evaluate(() => [...document.querySelectorAll('.post-nav small')].map(s => s.textContent.split(' · ')[0]));
    eq(nav, ['Previous', 'Next']);
    ok(await page.evaluate(() => !!document.querySelector('.back-trip a[href="#/trip/japan-2024"]')), 'back to the trip');
    eq(await page.evaluate(() => document.querySelectorAll('.comments textarea, .comments button').length), 0, 'no greyed-out comment box');
    await go(page, '#/trip/nope');
    eq(await page.evaluate(() => [...document.querySelectorAll('.not-found-links a')].map(a => a.getAttribute('href'))), ['#/', '#/trips', '#/map']);
    await go(page, '#/country/GB'); ok((await shown(page)).text.includes('not counted'), 'home country page says why it’s empty');
    eq(page.errors, []);
    await page.close2();
  });

  test('framed boxes never touch each other, on every page at every width (her ask, 21 Nov)', async () => {
    const bad = [];
    for (const [w, h, phone] of WIDTHS) {
      const page = await open({ width: w, height: h, phone });
      for (const r of await routes(page)) {
        await go(page, r);
        const found = await page.evaluate(() => {
          // a box's frame: its border plus the double edge drawn outside it (box-shadow up to 5px), or a map's outline (6px)
          const boxes = [...document.querySelectorAll('#view .trip-card, #view .post-tile, #view .post-card, #view .fact, #view .chart-sec, #view .tracker, #view .comments, #view .ctile, #view .write, #view .big-map, #view .trip-map, #view .tl-trip, #view .stat-row')]
            .filter(e => e.offsetParent).map(e => { const b = e.getBoundingClientRect(), o = /map/.test(e.className) ? 6 : /stat-row/.test(e.className) ? 0 : 5; return { e, l: b.left - o, r: b.right + o, t: b.top - o, b: b.bottom + o }; });
          const out = [];
          for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], c = boxes[j];
            if (a.e.contains(c.e) || c.e.contains(a.e)) continue;
            const gapX = Math.max(c.l - a.r, a.l - c.r), gapY = Math.max(c.t - a.b, a.t - c.b);
            if (Math.max(gapX, gapY) < 8) out.push(`${a.e.className.split(' ')[0]} / ${c.e.className.split(' ')[0]} (${Math.round(Math.max(gapX, gapY))}px)`);
          }
          return [...new Set(out)];
        });
        if (found.length) bad.push(`${w} ${r}: ${found.slice(0, 3).join(', ')}`);
      }
      await page.close2();
    }
    ok(!bad.length, bad.slice(0, 20).join('\n'));
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
    eq(f['continents'], `${EXPECT.continents} | of 7`, 'continents (her pick, 21 Nov: out of 7)');
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

// ---------------------------------------------------------------- the Write page against a real local server (a throwaway copy)
if (SUITE === 'write') {
  const BASE = EXPECT.base;   // http://127.0.0.1:<port>/ of tools/serve.py running on the copy
  const openLive = async (hash, size = { width: 1400, height: 1000 }) => {
    const ctx = await browser.newContext({ viewport: size });
    const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
    await page.goto(BASE + hash, { waitUntil: 'networkidle' }); page.close2 = () => ctx.close(); return page;
  };
  test('a new post with photos is saved, the site rebuilt, and the post shown', async () => {
    const page = await openLive('#/write');
    await page.waitForFunction(() => !document.querySelector('#saveBtn').disabled);
    await page.selectOption('select[name=trip]', 'paris-2026');
    await page.fill('input[name=days]', '4');
    await page.fill('input[name=place]', 'Versailles');
    await page.fill('input[name=title]', 'Gardens & fountains');
    await page.fill('textarea[name=text]', 'The palace first.\n\n[photo 2 right: Mirror lake]\n\nThen the gardens, which were “huge”.');
    await page.setInputFiles('#files', EXPECT.photos);
    eq(await page.evaluate(() => [...document.querySelectorAll('#picked li span')].map(s => s.textContent)), ['1', '2'], 'photos numbered');
    await Promise.all([page.waitForEvent('load', { timeout: 90000 }), page.click('#saveBtn')]);   // saved: the page reloads on the new post
    eq(await page.evaluate(() => location.hash), '#/trip/paris-2026/03');
    await page.waitForLoadState('networkidle');
    eq(await page.evaluate(() => document.querySelector('.post h1').textContent), 'Gardens & fountains');
    eq(await page.evaluate(() => document.querySelector('.post-text .inline.right figcaption').textContent), 'Mirror lake');
    eq(await page.evaluate(() => [...document.images].filter(i => i.naturalWidth > 0).length), 2, 'both photos showing');
    ok(!page.errors.length, page.errors.join(' / '));
    await page.close2();
  });
  test('a new trip from the Write page', async () => {
    const page = await openLive('#/write');
    await page.waitForFunction(() => !document.querySelector('#saveBtn').disabled);
    await page.selectOption('select[name=trip]', '');
    ok(await page.isVisible('.newtrip'), 'new trip fields should show');
    await page.fill('input[name=ntitle]', 'Lakes');
    await page.fill('input[name=nfrom]', '2027-05');
    await page.check('input[name=nc][value=IT]');
    await page.fill('input[name=title]', 'Como');
    await Promise.all([page.waitForEvent('load', { timeout: 90000 }), page.click('#saveBtn')]);
    eq(await page.evaluate(() => location.hash), '#/trip/lakes-2027/01');
    eq(await page.evaluate(() => document.querySelector('.crumbs').textContent.includes('Lakes')), true);
    await page.close2();
  });
  test('a problem is shown and nothing is saved', async () => {
    const page = await openLive('#/write');
    await page.waitForFunction(() => !document.querySelector('#saveBtn').disabled);
    await page.selectOption('select[name=trip]', 'chile-2026');
    await page.fill('input[name=title]', 'Oops');
    await page.fill('textarea[name=text]', '[photo 5 left]');
    await page.click('#saveBtn');
    await page.waitForFunction(() => /Not saved/.test(document.querySelector('#wMsg').textContent), null, { timeout: 30000 });
    ok(/photo 5/.test(await page.textContent('#wMsg')), await page.textContent('#wMsg'));
    eq(await page.evaluate(() => location.hash), '#/write', 'stayed on the Write page');
    await page.close2();
  });
  test('without the server, the Write page says how to save and won’t try', async () => {
    const page = await open({ hash: '#/write' });   // served from files, no server behind it
    await page.waitForFunction(() => document.querySelector('#saveBtn').disabled);
    ok(/start the .travels. preview/.test(await page.textContent('#wServer')), await page.textContent('#wServer'));
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
