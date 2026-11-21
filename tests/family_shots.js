// Screenshots for the family rules (21 Nov): home, a trip, the map and the drawer open, at 1600 and 390 wide, light and dark.
// Run:  C:/Users/Jemma/Documents/SimTracker/.tools/node/node.exe tests/family_shots.js [outdir]
// Serves site/ itself; changes nothing but the screenshot folder. Fails on page errors or sideways scrolling.
const path = require('path'), fs = require('fs');
const { chromium } = require('C:/Users/Jemma/Documents/SimTracker/node_modules/playwright');

const ROOT = path.join(__dirname, '..', 'site');
const HOST = 'http://localhost:8099/';
const OUT = path.resolve(process.argv[2] || 'C:/Users/Jemma/Documents/JemmasJournals/for-jemma/concepts/app-styles/built/family');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PAGES = [['home', '#/'], ['trip', '#/trip/japan-2024'], ['map', '#/map']];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  let errors = 0;
  for (const mode of ['light', 'dark']) {
    for (const [w, h, phone] of [[1600, 1000, false], [390, 844, true]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1 });
      await ctx.addInitScript(m => { try { localStorage.setItem('jj-mode', m); } catch (e) {} }, mode);
      const page = await ctx.newPage();
      page.on('pageerror', e => { errors++; console.log('  ERROR ' + e.message); });
      await page.route(HOST + '**', route => {
        const url = new URL(route.request().url());
        const file = path.join(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
        if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'missing' });
        route.fulfill({ body: fs.readFileSync(file), contentType: TYPES[path.extname(file)] || 'application/octet-stream' });
      });
      const shots = PAGES.map(([n, hash]) => [n, hash, false]);
      if (phone) shots.push(['drawer', '#/trip/japan-2024', true], ['footer', '#/map', 'foot']);
      for (const [name, hash, drawer] of shots) {
        await page.goto(HOST + hash, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) { errors++; console.log(`  WIDE ${w} ${mode} ${name}`); }
        if (drawer === true) { await page.tap('#menuBtn'); await page.waitForTimeout(400); }
        if (drawer === 'foot') { await page.waitForTimeout(400); await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); }
        const file = `travels-${name}-${w}-${mode}.jpg`;
        await page.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 84, fullPage: !phone });
        console.log('  ' + file);
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(errors ? `${errors} problem(s)` : 'ok, no errors', '→', OUT);
  process.exit(errors ? 1 : 0);
})();
