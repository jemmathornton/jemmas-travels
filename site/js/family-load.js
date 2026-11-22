/* The family's shared code (Jemma’s Journals’ site/family/: dark mode, footer, Back to top, Menu drawer), from the right place
   before anything is drawn (round 5 review): /family/ when the site is served (her PC’s servers, and online), ../../site/family/
   when index.html is opened as a file (this site sits in Jemma’s Journals’ travels/ folder). Choosing here, before any request,
   means no failed file:///C:/family/… requests and no flash of light when dark is chosen.
   document.write from this small blocking script puts the tags exactly here in <head>, in order: mode.js runs before the
   stylesheets (no flash), family.css comes before site.css, and family.js is deferred as if written in the page.
   (A strict Content-Security-Policy allows this: it is the site’s own file, no inline code.) */
(function () {
  var base = location.protocol === "file:" ? "../../site/family/" : "/family/";
  document.write('<script src="' + base + 'mode.js" data-old-key="jt-mode"><\/script>' +
    '<link rel="stylesheet" href="' + base + 'family.css">' +
    '<script src="' + base + 'family.js" defer><\/script>');
})();
