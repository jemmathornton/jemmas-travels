// Screenshot one element of a page: node tests/element_shot.js <out.png> <hash e.g. #/map> <look> <css selector> [width]
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', 'site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const [out, hash = '#/', look = 'f', sel = 'body', width = '1600'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await (await b.newContext({ viewport: { width: +width, height: 1000 } })).newPage();
  await p.route('http://localhost:8099/**', r => {
    const u = new URL(r.request().url());
    const f = path.join(ROOT, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname.slice(1)));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'application/octet-stream' });
  });
  await p.goto(`http://localhost:8099/?look=${look}&trial=off${hash}`, { waitUntil: 'networkidle' });
  await p.locator(sel).first().screenshot({ path: out });
  await b.close();
})();
