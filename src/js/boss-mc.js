/* /boss hero — live Monte Carlo solvent shell.
   A phenol solute (PubChem CID 996) sits in an explicit solvent shell: ~46 soft
   dots that jitter via accepted Monte Carlo moves (kept within a spherical shell),
   while a configurations-sampled counter ticks up. Transparent canvas so the hero
   gradient shows through. Slow rotate, pauses off-screen, reduced-motion safe.
   Shares the 3Dmol global loaded on the page; existing boss.js is untouched. */
(function () {
  var el = document.getElementById('boss-viewer');
  if (!el || !window.$3Dmol) return;

  var OYSTER = 0xDEDCD5, AMBER = 0xC9824E;
  var BRAND = { C: OYSTER, H: 0xF4EFE4, O: AMBER, N: 0x9AA0AE };
  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E', backgroundAlpha: 0 });
  var stepEl = document.getElementById('boss-step');

  var N = 46, RMIN = 2.4, RMAX = 5.6, solvent = [];
  var cx = 0, cy = 0, cz = 0; // solute centroid (PubChem coords aren't origin-centred)
  function centroid() {
    var a = viewer.getModel().selectedAtoms({}), n = a.length;
    if (!n) return;
    var sx = 0, sy = 0, sz = 0, i;
    for (i = 0; i < n; i++) { sx += a[i].x; sy += a[i].y; sz += a[i].z; }
    cx = sx / n; cy = sy / n; cz = sz / n;
  }
  function seed() {
    solvent = [];
    for (var i = 0; i < N; i++) {
      var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 2.9 + Math.random() * 2.4;
      var s = Math.sqrt(1 - u * u);
      solvent.push({ x: cx + r * s * Math.cos(th), y: cy + r * s * Math.sin(th), z: cz + r * u });
    }
  }
  function drawSolvent() {
    viewer.removeAllShapes();
    for (var i = 0; i < solvent.length; i++) {
      var p = solvent[i];
      viewer.addSphere({ center: { x: p.x, y: p.y, z: p.z }, radius: 0.26, color: OYSTER, opacity: 0.6 });
    }
  }
  function mcStep() { // trial moves, accepted only if they stay in the shell
    for (var i = 0; i < solvent.length; i++) {
      var p = solvent[i];
      var nx = p.x + (Math.random() - 0.5) * 0.5, ny = p.y + (Math.random() - 0.5) * 0.5, nz = p.z + (Math.random() - 0.5) * 0.5;
      var dx = nx - cx, dy = ny - cy, dz = nz - cz, rr = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (rr > RMIN && rr < RMAX) { p.x = nx; p.y = ny; p.z = nz; }
    }
  }
  function styleSolute() {
    viewer.setStyle({}, { stick: { radius: 0.15, color: OYSTER } });
    Object.keys(BRAND).forEach(function (e) { viewer.setStyle({ elem: e }, { stick: { radius: 0.15, color: BRAND[e] } }); });
  }

  $3Dmol.download('cid:996', viewer, {}, function () {
    styleSolute();
    centroid(); seed(); drawSolvent();
    viewer.zoomTo();
    viewer.zoom(0.55, 400);
    viewer.render();

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { if (stepEl) stepEl.textContent = '—'; viewer.render(); return; }

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(el);
    }

    var step = 0, lastMC = 0;
    function loop(ts) {
      requestAnimationFrame(loop);
      if (!visible) return;
      viewer.rotate(0.25, 'y');
      if (ts - lastMC > 120) {
        mcStep(); drawSolvent();
        step += 64; if (stepEl) stepEl.textContent = step.toLocaleString('en-US');
        lastMC = ts;
      }
      viewer.render();
    }
    requestAnimationFrame(loop);
  });
}());
