/* Count-up animation for the "By the numbers" credibility band.
   Animates each .stat__num from 0 to its data-count when scrolled into view.
   data-suffix appends a string (e.g. "+"); data-group adds thousands commas.
   Respects reduced motion / missing IO by jumping straight to the final value. */
(function () {
  var nums = document.querySelectorAll('.stat__num[data-count]');
  if (!nums.length) return;

  function fmt(n, group) { return group ? n.toLocaleString('en-US') : String(n); }
  function finalText(el) {
    return fmt(parseInt(el.getAttribute('data-count'), 10), el.getAttribute('data-group')) +
      (el.getAttribute('data-suffix') || '');
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    nums.forEach(function (el) { el.textContent = finalText(el); });
    return;
  }

  function animate(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    var suffix = el.getAttribute('data-suffix') || '';
    var group = el.getAttribute('data-group');
    var dur = 1500, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = fmt(Math.round(eased * target), group) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { animate(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.4 });

  nums.forEach(function (el) { io.observe(el); });
}());
