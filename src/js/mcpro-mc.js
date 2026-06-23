/* /mcpro hero — live Monte Carlo sampling of a protein.
   Crambin (PDB 1CRN) shown as a cartoon ribbon, sampled by Metropolis Monte
   Carlo: the protein SNAPS to a new random orientation on each accepted move
   (a discrete configuration, not a smooth spin), and a configurations counter
   ticks up. Helices are amber, sheets oyster — restrained brand palette on the
   Midnight hero. Transparent canvas so the hero gradient shows through. Pauses
   off-screen, reduced-motion safe. Shares the 3Dmol global loaded on the page;
   existing mcpro.js is untouched. */
(function () {
  var el = document.getElementById('mcpro-viewer');
  if (!el || !window.$3Dmol) return;

  var OYSTER = 0xDEDCD5, CREAM = 0xF4EFE4, AMBER = 0xC9824E;
  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E', backgroundAlpha: 0 });
  var stepEl = document.getElementById('mcpro-step');

  function styleProtein() {
    // Cartoon ribbon, coloured by secondary structure in the brand palette.
    viewer.setStyle({}, { cartoon: { color: OYSTER, thickness: 0.4 } });
    viewer.setStyle({ ss: 'h' }, { cartoon: { color: AMBER, thickness: 0.4 } });
    viewer.setStyle({ ss: 's' }, { cartoon: { color: CREAM, thickness: 0.5, arrows: true } });
  }

  // One Monte Carlo move: a discrete jump to a new sampled configuration.
  function mcMove() {
    var ax = Math.random() * 2 - 1, ay = Math.random() * 2 - 1, az = Math.random() * 2 - 1;
    var n = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    var ang = 35 + Math.random() * 95;
    viewer.rotate(ang, { x: ax / n, y: ay / n, z: az / n });
  }

  $3Dmol.download('pdb:1CRN', viewer, {}, function () {
    styleProtein();
    viewer.zoomTo();
    viewer.zoom(0.6, 400);
    viewer.render();

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { if (stepEl) stepEl.textContent = '—'; return; }

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(el);
    }

    var samples = 0, last = 0, INTERVAL = 680; // ms between sampled configurations
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
