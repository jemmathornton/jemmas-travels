// Round 4: the banner at several window widths, and pale/sea sidebar × plain/grid.
// node tests/banner_widths.js <outdir>
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', 'site'), OUT = path.resolve(process.argv[2]);
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const SHOTS = [
  ...[1600, 1366, 1100, 900].map(w => [`width-${w}`, 'layout=side-sea&bg=plain', '#/', { width: w, height: 760 }]),
  ['width-390', 'layout=side-sea&bg=plain', '#/', { width: 390, height: 844 }, true],
  ...['side-pale', 'side-sea'].flatMap(l => ['plain', 'grid'].map(bg => [`${l}-${bg}`, `layout=${l}&bg=${bg}`, '#/', { width: 1600, height: 1000 }])),
  ...['side-pale', 'side-sea'].flatMap(l => ['plain', 'grid'].map(bg => [`${l}-${bg}-stats`, `layout=${l}&bg=${bg}`, '#/stats', { width: 1600, height: 1000 }])),
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'msedge' });
  let errors = 0;
  for (const [name, q, hash, vp, phone] of SHOTS) {
    const ctx = await b.newContext({ viewport: vp, isMobile: !!phone, hasTouch: !!phone, deviceScaleFactor: phone ? 2 : 1 });
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
    const bad = await p.evaluate(() => {
      const t = document.querySelector('.hero h1'), m = document.querySelector('.hero-map svg');
      if (!t || !m) return '';
      const a = t.getBoundingClientRect(), c = m.getBoundingClientRect();
      const overlap = a.right > c.left + 2 && a.left < c.right && a.bottom > c.top + 2 && a.top < c.bottom;
      return (document.documentElement.scrollWidth > innerWidth + 1 ? 'wide ' : '') + (overlap ? 'title on map' : '');
    });
    if (bad) { errors++; console.log('PROBLEM', name, bad); }
    await p.screenshot({ path: path.join(OUT, `b-${name}.jpg`), type: 'jpeg', quality: 84 });
    await ctx.close();
  }
  await b.close();
  console.log(errors ? errors + ' problem(s)' : 'ok');
})();
