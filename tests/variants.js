// Screenshots of Old Atlas variations for her choice sheets.
// node tests/variants.js <outdir>   (writes v-<name>.jpg for each entry below)
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', 'site');
const OUT = path.resolve(process.argv[2]);
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const LAP = { width: 1600, height: 1000 }, PHONE = { width: 390, height: 844 };
const SHOTS = [
  ['layout-side-pale', 'layout=side-pale&header=banner&bg=plain', '#/', LAP],
  ['layout-side-sea', 'layout=side-sea&header=banner&bg=plain', '#/', LAP],
  ['layout-top', 'layout=top&header=banner&bg=plain', '#/', LAP],
  ['header-banner', 'layout=side-sea&header=banner&bg=plain', '#/', LAP],
  ['header-label', 'layout=side-sea&header=label&bg=plain', '#/', LAP],
  ['header-plate', 'layout=side-sea&header=plate&bg=plain', '#/', LAP],
  ...['plain', 'grain', 'grid', 'waves', 'dots'].map(bg => ['bg-' + bg, 'layout=side-sea&header=banner&bg=' + bg, '#/trips', LAP, { x: 560, y: 150, width: 900, height: 560 }]),
  ['page-trip', 'layout=side-sea&header=banner&bg=grain', '#/trip/japan-2024', LAP],
  ['page-map', 'layout=side-sea&header=banner&bg=grain', '#/map', LAP],
  ['page-countries', 'layout=side-sea&header=banner&bg=grain', '#/countries', LAP],
  ['page-stats', 'layout=side-sea&header=banner&bg=grain', '#/stats', LAP],
  ['phone-banner', 'layout=side-sea&header=banner&bg=grain', '#/', PHONE],
  ['phone-label', 'layout=side-pale&header=label&bg=grain', '#/', PHONE],
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'msedge' });
  let errors = 0;
  for (const [name, q, hash, vp, clip] of SHOTS) {
    const phone = vp === PHONE;
    const ctx = await b.newContext({ viewport: vp, isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1 });
    const p = await ctx.newPage();
    p.on('pageerror', e => { errors++; console.log('ERROR', name, e.message); });
    await p.route('http://localhost:8099/**', r => {
      const u = new URL(r.request().url());
      const f = path.join(ROOT, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname.slice(1)));
      if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
      r.fulfill({ body: fs.readFileSync(f), contentType: T[path.extname(f)] || '' });
    });
    await p.goto(`http://localhost:8099/?trial=off&${q}${hash}`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) { errors++; console.log('WIDE', name); }
    await p.screenshot({ path: path.join(OUT, `v-${name}.jpg`), type: 'jpeg', quality: 84, ...(clip ? { clip } : {}) });
    await ctx.close();
  }
  await b.close();
  console.log(errors ? errors + ' problem(s)' : 'ok');
})();
