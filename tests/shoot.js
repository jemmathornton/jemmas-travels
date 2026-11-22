// Screenshots of each page (laptop and phone), for checking my own work, plus a check that no page throws.
// (The looks loop went 22 Nov: the look is decided and the ?look= options no longer exist.)
// Run:  C:/Users/Jemma/Documents/JemmasJournals/.tools/node/node.exe tests/shoot.js [outdir] [pages]
// Uses the Playwright her Sim World project already has (Microsoft Edge). Serves site/ itself on localhost-like
// host travels.localhost, so the Write page shows. Changes nothing but the screenshot folder.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'site');
const HOST = 'http://localhost:8099/';
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'for-jemma', 'looks'));
const FAMILY = path.join(__dirname, '..', '..', 'site', 'family');
const PAGES = (process.argv[3] || 'home,trips,trip/japan-2024,trip/japan-2024/02,map,countries,stats,write').split(',');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const SIZES = [
  { name: 'laptop', viewport: { width: 1600, height: 1000 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  let errors = 0;
  for (const size of SIZES) {
    const ctx = await browser.newContext(size);
    const page = await ctx.newPage();
    page.on('pageerror', e => { errors++; console.log('  ERROR ' + e.message); });
    await page.route(HOST + '**', route => {
      const url = new URL(route.request().url());
      const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const fam = rel.startsWith('family/');   // the family's shared code, from Jemma's Journals (22 Nov)
      const base = fam ? FAMILY : ROOT, file = path.join(base, fam ? rel.slice(7) : rel);
      if (!file.startsWith(base + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'missing' });
      route.fulfill({ body: fs.readFileSync(file), contentType: TYPES[path.extname(file)] || 'application/octet-stream' });
    });
    for (const p of PAGES) {
      await page.goto(`${HOST}#/${p === 'home' ? '' : p}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow) { errors++; console.log(`  WIDE ${size.name} ${p}`); }
      const name = `${size.name}-${p.replace(/\//g, '_')}.jpg`;
      await page.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 82, fullPage: size.name === 'laptop' ? true : false });
    }
    await ctx.close();
  }
  await browser.close();
  console.log(errors ? `${errors} problem(s)` : 'ok, no errors', '→', OUT);
  process.exit(errors ? 1 : 0);
})();
