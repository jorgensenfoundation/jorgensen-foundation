/* /boss hero — live Monte Carlo sampling.
   Phenol (PubChem CID 996) shown as it is sampled by Metropolis Monte Carlo:
   the molecule SNAPS to a new random orientation on each accepted move (so the
   atoms — including the hydroxyl — land in different positions), rather than
   spinning smoothly. A samples counter ticks up. Transparent canvas so the hero
   gradient shows through. Pauses off-screen, reduced-motion safe. Shares the
   3Dmol global loaded on the page; existing boss.js is untouched. */
(function () {
  var el = document.getElementById('boss-viewer');
  if (!el || !window.$3Dmol) return;

  var OYSTER = 0xDEDCD5, AMBER = 0xC9824E;
  var BRAND = { C: OYSTER, H: 0xF4EFE4, O: AMBER, N: 0x9AA0AE };
  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E', backgroundAlpha: 0 });
  var stepEl = document.getElementById('boss-step');

  function styleMol() {
    viewer.setStyle({}, { stick: { radius: 0.15, color: OYSTER }, sphere: { scale: 0.22, color: OYSTER } });
    Object.keys(BRAND).forEach(function (e) {
      viewer.setStyle({ elem: e }, { stick: { radius: 0.15, color: BRAND[e] }, sphere: { scale: 0.22, color: BRAND[e] } });
    });
  }

  // One Monte Carlo move: a discrete jump to a new random orientation
  function mcMove() {
    var ax = Math.random() * 2 - 1, ay = Math.random() * 2 - 1, az = Math.random() * 2 - 1;
    var n = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    var ang = 40 + Math.random() * 110;
    viewer.rotate(ang, { x: ax / n, y: ay / n, z: az / n });
  }

  $3Dmol.download('cid:996', viewer, {}, function () {
    styleMol();
    viewer.zoomTo();
    viewer.zoom(0.6, 400);
    viewer.render();

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { if (stepEl) stepEl.textContent = '—'; return; }

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(el);
    }

    var samples = 0, last = 0, INTERVAL = 620; // ms between sampled configurations
    function loop(ts) {
      requestAnimationFrame(loop);
      if (!visible) return;
      if (ts - last > INTERVAL) {
        mcMove();
        viewer.render();
        samples += 1;
        if (stepEl) stepEl.textContent = samples.toLocaleString('en-US');
        last = ts;
      }
    }
    requestAnimationFrame(loop);
  });
}());
