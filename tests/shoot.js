// Screenshots of each look and page, for her to choose from, plus a check that no page throws.
// Run:  C:/Users/Jemma/Documents/JemmasJournals/.tools/node/node.exe tests/shoot.js [outdir] [looks] [pages]
// Uses the Playwright her Sim World project already has (Microsoft Edge). Serves site/ itself on localhost-like
// host travels.localhost, so the Write page shows. Changes nothing but the screenshot folder.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'site');
const HOST = 'http://localhost:8099/';
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'for-jemma', 'looks'));
const LOOKS = (process.argv[3] || 'f').split(',');
const PAGES = (process.argv[4] || 'home,trips,trip/japan-2024,trip/japan-2024/02,map,countries,stats,write').split(',');
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
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'missing' });
      route.fulfill({ body: fs.readFileSync(file), contentType: TYPES[path.extname(file)] || 'application/octet-stream' });
    });
    for (const look of LOOKS) {
      for (const p of PAGES) {
        await page.goto(`${HOST}?look=${look}&trial=off#/${p === 'home' ? '' : p}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        if (overflow) { errors++; console.log(`  WIDE ${size.name} ${look} ${p}`); }
        const name = `${look}-${size.name}-${p.replace(/\//g, '_')}.jpg`;
        await page.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 82, fullPage: size.name === 'laptop' ? true : false });
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(errors ? `${errors} problem(s)` : 'ok, no errors', '→', OUT);
  process.exit(errors ? 1 : 0);
})();
