/* Scroll choreography — fade/slide-up as content blocks enter the viewport.
   Loaded site-wide (base.njk); the .reveal CSS lives in components.css.
   Safe by design: the .reveal class (which hides the element) is only added by
   THIS script, and only when motion is allowed + IntersectionObserver exists.
   If JS is off, reduced-motion is set, or IO is unsupported, everything stays
   fully visible. Targets are below the fold, so adding the class causes no flash. */
(function () {
  // Content blocks across the site. Heroes/bands keep their own motion.
  var SELECTORS = [
    '#mission .hp-inner', '.hp-prog-header', '.prog-item',   // homepage
    '.access-card', '.stat',                                 // homepage
    '.pub-item', '.faq-item', '.team-member'                 // inner pages
  ];

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return; // leave content visible

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  // Stagger resets per group, so each row cascades from its own left edge.
  SELECTORS.forEach(function (sel) {
    var group = document.querySelectorAll(sel);
    if (!group.length) return;
    Array.prototype.forEach.call(group, function (n, i) {
      n.classList.add('reveal');
      n.style.transitionDelay = (Math.min(i, 6) * 70) + 'ms';
      io.observe(n);
    });
  });
}());
