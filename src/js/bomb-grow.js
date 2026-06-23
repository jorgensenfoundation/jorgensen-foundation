/* /bomb hero — live structure-based ligand growth.
   HIV-1 protease (PDB 1HSG) shown as a faint cartoon; its bound inhibitor
   (HET code MK1) is built up atom-by-atom from a seed, expanding outward through
   the binding site the way BOMB grows a lead candidate. The growth front flashes
   amber as each fragment is placed; once complete the molecule holds briefly, then
   the search resets and grows again. A counter tracks atoms placed. Depicts the
   structure-based growth process — not a claim that BOMB designed this drug.
   Transparent canvas so the hero gradient shows through; pauses off-screen,
   reduced-motion safe. Shares the page's 3Dmol global; existing bomb.js untouched. */
(function () {
  var el = document.getElementById('bomb-viewer');
  if (!el || !window.$3Dmol) return;

  var OYSTER = 0xDEDCD5, AMBER = 0xC9824E;
  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E', backgroundAlpha: 0 });
  var nEl = document.getElementById('bomb-n');

  var PROTEIN = { hetflag: false };
  var LIGAND = { resn: 'MK1' };

  function paint(count, order) {
    viewer.setStyle(LIGAND, {}); // hide whole ligand
    var shown = order.slice(0, count);
    viewer.setStyle({ index: shown }, { stick: { radius: 0.2, color: OYSTER }, sphere: { scale: 0.32, color: OYSTER } });
    var front = order.slice(Math.max(0, count - 3), count); // most recently placed
    viewer.setStyle({ index: front }, { stick: { radius: 0.22, color: AMBER }, sphere: { scale: 0.40, color: AMBER } });
    if (nEl) nEl.textContent = count;
    viewer.render();
  }

  $3Dmol.download('pdb:1HSG', viewer, {}, function () {
    var atoms = viewer.getModel().selectedAtoms(LIGAND);
    if (!atoms.length) return;

    // Grow outward from the ligand core: order atoms by distance from centroid.
    var cx = 0, cy = 0, cz = 0;
    atoms.forEach(function (a) { cx += a.x; cy += a.y; cz += a.z; });
    cx /= atoms.length; cy /= atoms.length; cz /= atoms.length;
    var order = atoms.map(function (a) {
      var dx = a.x - cx, dy = a.y - cy, dz = a.z - cz;
      return { i: a.index, d: dx * dx + dy * dy + dz * dz };
    }).sort(function (a, b) { return a.d - b.d; }).map(function (o) { return o.i; });
    var N = order.length;

    // Faint protein context; hide waters.
    viewer.setStyle(PROTEIN, { cartoon: { color: OYSTER, opacity: 0.4, thickness: 0.3 } });
    viewer.setStyle({ resn: 'HOH' }, {});
    viewer.zoomTo(LIGAND);
    viewer.zoom(0.55, 400);

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { paint(N, order); return; } // static: fully grown lead

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(el);
    }

    var count = 1, phase = 'grow', holdStart = 0, last = 0;
    var STEP = 2, GROW_INTERVAL = 190, HOLD = 1400, SEED = 1;
    paint(count, order);

    function loop(ts) {
      requestAnimationFrame(loop);
      if (!visible) return;
      viewer.rotate(0.22, { x: 0, y: 1, z: 0 }); // slow continuous turn
      if (phase === 'grow') {
        if (ts - last > GROW_INTERVAL) {
          count = Math.min(N, count + STEP);
          paint(count, order);
          last = ts;
          if (count >= N) { phase = 'hold'; holdStart = ts; }
        }
      } else if (ts - holdStart > HOLD) {
        count = SEED; phase = 'grow'; last = ts; paint(count, order);
      }
      viewer.render();
    }
    requestAnimationFrame(loop);
  });
}());
