// Delegated event dispatcher — lets every page drop inline on* handlers so the
// CSP no longer needs script-src 'unsafe-inline'.
//
// Contract:
//   data-action="fn"  → on click, calls fn(element, event)
//   data-enter="fn"   → on Enter keydown, calls fn(element, event) (preventDefault)
// `fn` is resolved on window and may be dotted (e.g. "JFAuth.logout"). Pass
// arguments as data-* attributes and read them from element.dataset inside fn.
// Only the NEAREST ancestor carrying the attribute fires, so a button inside a
// clickable row triggers once — no manual stopPropagation needed.
(function () {
  function resolve(name) {
    return name ? name.split('.').reduce(function (o, k) { return o && o[k]; }, window) : null;
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var fn = resolve(el.dataset.action);
    if (typeof fn === 'function') fn(el, e);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var el = e.target.closest('[data-enter]');
    if (!el) return;
    var fn = resolve(el.dataset.enter);
    if (typeof fn === 'function') { e.preventDefault(); fn(el, e); }
  });
})();
