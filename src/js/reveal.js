/* Scroll choreography — fade/slide-up as content blocks enter the viewport.
   Safe by design: the .reveal class (which hides the element) is only added by
   THIS script, and only when motion is allowed + IntersectionObserver exists.
   If JS is off, reduced-motion is set, or IO is unsupported, everything stays
   fully visible. Targets are all below the fold, so adding the class causes no
   visible flash. */
(function () {
  // Editorial content blocks (homepage). Bands/heroes keep their own motion.
  var SELECTORS = ['#mission .hp-inner', '.hp-prog-header', '.prog-item', '.test-card', '.access-card'];

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return; // leave content visible

  var nodes = [];
  SELECTORS.forEach(function (s) {
    Array.prototype.push.apply(nodes, document.querySelectorAll(s));
  });
  if (!nodes.length) return;

  nodes.forEach(function (n, i) {
    n.classList.add('reveal');
    n.style.transitionDelay = (Math.min(i % 6, 5) * 60) + 'ms'; // gentle stagger within grids
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  nodes.forEach(function (n) { io.observe(n); });
}());
