// Picture of the tab icon options (site/icon-options/*.svg) in a pretend browser tab, light and dark, at real sizes.
// node tests/icon_sheet.js <out.png>
const path = require('path'), fs = require('fs');
const { chromium } = require('C:/Users/Jemma/Documents/SimTracker/node_modules/playwright');
const DIR = path.join(__dirname, '..', 'site', 'icon-options');
const NAMES = { 'a-globe.svg': 'A · Globe', 'b-j-globe.svg': 'B · J on a globe', 'c-stamp.svg': 'C · Stamp', 'd-pin.svg': 'D · Map pin' };
(async () => {
  const uri = f => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(DIR, f)).toString('base64');
  const rows = Object.entries(NAMES).map(([f, n]) => `<tr><th>${n}</th>
    <td><div class="tab light"><img src="${uri(f)}" width="16" height="16"><span>Jemma’s Travels</span></div></td>
    <td><div class="tab dark"><img src="${uri(f)}" width="16" height="16"><span>Jemma’s Travels</span></div></td>
    <td><img src="${uri(f)}" width="32" height="32"></td><td><img src="${uri(f)}" width="96" height="96"></td></tr>`).join('');
  const html = `<html><body style="margin:0;font:600 15px Segoe UI,sans-serif;background:#fff;color:#24403E;padding:24px">
    <style>table{border-collapse:separate;border-spacing:24px 18px}th{text-align:left;font-size:20px;white-space:nowrap}
    .tab{display:flex;align-items:center;gap:8px;width:210px;padding:8px 12px;border-radius:8px 8px 0 0;font:400 13px Segoe UI}
    .light{background:#F1F3F4;color:#222}.dark{background:#35363A;color:#eee}td{vertical-align:middle}</style>
    <h2 style="margin:0 0 4px">Tab icon options</h2><div style="color:#5E6E69;font-weight:500">In a tab (light and dark browser), then 32 and 96 pixels</div><table>${rows}</table></body></html>`;
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await (await b.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 })).newPage();
  await p.setContent(html); await p.waitForTimeout(300);
  await p.screenshot({ path: process.argv[2], fullPage: true });
  await b.close();
})();
