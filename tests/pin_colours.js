// Pin colour options for her to compare (21 Nov: "red pins look weird"): the real pages with --pin swapped.
// node tests/pin_colours.js <outdir>
const path = require('path'), fs = require('fs');
const { chromium } = require('C:/Users/Jemma/Documents/SimTracker/node_modules/playwright');
const ROOT = path.join(__dirname, '..', 'site'), OUT = path.resolve(process.argv[2]);
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const OPTIONS = {
  now: ['#B4553F', '#4A7FA8'],   // [pins and route, home pin]
  a: ['#3E7CB1', '#24403E'],
  b: ['#2F7565', '#4A7FA8'],
  c: ['#2B4C6F', '#3E8A7A'],
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'msedge' });
  for (const [k, [pin, home]] of Object.entries(OPTIONS)) for (const [name, hash, clip] of [['trip', '#/trip/nyc-nashville-2024', { x: 860, y: 40, width: 640, height: 340 }], ['map', '#/map', { x: 380, y: 180, width: 1100, height: 500 }]]) {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } }); const p = await ctx.newPage();
    await p.route('http://localhost:8099/**', r => { const u = new URL(r.request().url()); if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 200, body: '{"ok":false}' });
      const f = path.join(ROOT, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname.slice(1))); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ body: fs.readFileSync(f), contentType: T[path.extname(f)] || '' }); });
    await p.goto('http://localhost:8099/' + hash, { waitUntil: 'networkidle' });
    await p.addStyleTag({ content: `:root{--pin:${pin}} .worldmap .pin.home .pin-dot{fill:${home}} .worldmap .pin.home .pin-halo{fill:color-mix(in srgb, ${home} 22%, transparent)}` });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(OUT, `pin-${k}-${name}.png`), clip });
    await ctx.close();
  }
  await b.close();
})();
