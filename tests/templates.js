// Screenshots of the template posts (Italy 2026) at laptop and phone size, full page.
// node tests/templates.js <outdir>
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', 'site'), OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'for-jemma', 'templates'));
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const POSTS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'msedge' });
  let errors = 0;
  for (const [size, vp, phone] of [['laptop', { width: 1600, height: 1000 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1 });
    const p = await ctx.newPage();
    p.on('pageerror', e => { errors++; console.log('ERROR', e.message); });
    await p.route('http://localhost:8099/**', r => {
      const u = new URL(r.request().url());
      const f = path.join(ROOT, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname.slice(1)));
      if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
      r.fulfill({ body: fs.readFileSync(f), contentType: T[path.extname(f)] || '' });
    });
    for (const n of POSTS) {
      await p.goto(`http://localhost:8099/#/trip/italy-2026/${n}`, { waitUntil: 'networkidle' });
      await p.evaluate(() => document.fonts.ready);
      const bad = await p.evaluate(() => {
        const out = [];
        if (document.documentElement.scrollWidth > innerWidth + 1) out.push('sideways scroll');
        if (document.querySelector('.post-text') && /\[photo/.test(document.querySelector('.post-text').textContent)) out.push('marker shown as text');
        return out.join(', ');
      });
      if (bad) { errors++; console.log('PROBLEM', size, n, bad); }
      await p.screenshot({ path: path.join(OUT, `${size}-${n}.jpg`), type: 'jpeg', quality: 80, fullPage: true });
    }
    await p.goto('http://localhost:8099/#/trip/italy-2026', { waitUntil: 'networkidle' });
    await p.screenshot({ path: path.join(OUT, `${size}-trip.jpg`), type: 'jpeg', quality: 80, fullPage: true });
    await ctx.close();
  }
  await b.close();
  console.log(errors ? errors + ' problem(s)' : 'ok');
})();
