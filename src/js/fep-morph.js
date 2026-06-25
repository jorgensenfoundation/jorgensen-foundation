/* /fep hero — live alchemical λ-morph.
   Benzene → chlorobenzene (PubChem CID 7964): the chlorine grows in as the
   coupling parameter λ sweeps 0→1, the molecule slowly rotating. The λ readout
   updates live. Shares the 3Dmol global loaded on the page. Pauses when
   off-screen; reduced-motion safe (renders the final state, no animation). */
(function () {
  var el = document.getElementById('fep-viewer');
  if (!el || !window.$3Dmol) return;

  var OYSTER = 0xDEDCD5, AMBER = 0xC9824E;
  var BRAND = { C: OYSTER, H: 0xF4EFE4, O: AMBER, N: 0x9AA0AE };
  // Transparent canvas so the hero's gradient background shows through (not a flat box)
  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E', backgroundAlpha: 0 });
  // Let the wheel/two-finger gesture scroll the page instead of zooming the canvas.
  el.addEventListener('wheel', function (e) { e.stopPropagation(); }, { capture: true, passive: true });
  var lambdaEl = document.getElementById('fep-lambda');

  function styleMol(L) {
    viewer.setStyle({}, { stick: { radius: 0.14, color: OYSTER } });
    Object.keys(BRAND).forEach(function (e) { viewer.setStyle({ elem: e }, { stick: { radius: 0.14, color: BRAND[e] } }); });
    viewer.setStyle({ elem: 'Cl' }, { sphere: { scale: 0.05 + 0.5 * L, color: AMBER }, stick: { radius: 0.05 + 0.13 * L, color: AMBER } });
    viewer.render();
  }

  $3Dmol.download('cid:7964', viewer, {}, function () {
    viewer.zoomTo();
    styleMol(0);
    if (lambdaEl) lambdaEl.textContent = '0.00';
    viewer.zoom(0.6, 400);   // smaller, more restrained presence

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { styleMol(1); if (lambdaEl) lambdaEl.textContent = '1.00'; return; }

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(el);
    }

    var start = null, period = 5200, hold = 1100, lastL = -1;
    var FRAME = 1000 / 30, lastFrame = 0; // cap to ~30fps to ease GPU load/heat
    function loop(ts) {
      requestAnimationFrame(loop);
      if (!visible) { start = null; return; }
      if (ts - lastFrame < FRAME) return;
      lastFrame = ts;
      if (!start) start = ts;
      var t = (ts - start) % (period + hold);
      var L = t < period ? t / period : 1;
      if (lambdaEl) lambdaEl.textContent = L.toFixed(2);
      viewer.rotate(0.8, 'y'); // 2x/frame at 30fps
      if (Math.abs(L - lastL) > 0.03) { styleMol(L); lastL = L; } else { viewer.render(); }
    }
    requestAnimationFrame(loop);
  });
}());
