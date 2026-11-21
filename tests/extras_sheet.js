// Screenshots of the trial extras, dark mode and the Write page, for her to look at (21 Nov).
// node tests/extras_sheet.js <outdir>
const path = require('path'), fs = require('fs');
const { chromium } = require('C:/Users/Jemma/Documents/SimTracker/node_modules/playwright');
const ROOT = path.join(__dirname, '..', 'site'), OUT = path.resolve(process.argv[2]);
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const SHOTS = [
  ['routes', '#/map/routes', false, 1000], ['trip-route', '#/trip/nyc-nashville-2024', false, 760], ['timeline', '#/timeline', false, 1300],
  ['search', '#/search/spain', false, 900], ['stats', '#/stats', false, 760], ['write', '#/write', false, 1000],
  ['dark-home', '#/', true, 1000], ['dark-post', '#/trip/italy-2026/06', true, 1000], ['dark-stats', '#/stats', true, 1000],
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'msedge' });
  for (const [name, hash, dark, h] of SHOTS) {
    const ctx = await b.newContext({ viewport: { width: 1600, height: h } });
    if (dark) await ctx.addInitScript(() => localStorage.setItem('jt-mode', 'dark'));
    const p = await ctx.newPage();
    await p.route('http://localhost:8099/**', r => {
      const u = new URL(r.request().url());
      if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });   // pretend the server is there
      const f = path.join(ROOT, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname.slice(1)));
      if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
      r.fulfill({ body: fs.readFileSync(f), contentType: T[path.extname(f)] || '' });
    });
    await p.goto('http://localhost:8099/' + hash, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(OUT, `x-${name}.jpg`), type: 'jpeg', quality: 84 });
    await ctx.close();
  }
  await b.close();
})();
