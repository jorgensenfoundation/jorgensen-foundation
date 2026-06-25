/* /opls hero — live OPLS-AA force-field parameter explorer.
   Methanol (PubChem CID 887) shown as ball-and-stick; the molecule turns slowly
   while each atom is highlighted in turn with a translucent van der Waals shell
   sized to its Lennard-Jones sigma. The readout shows that atom's OPLS-AA partial
   charge (e) and atom type. Values are the published OPLS-AA methanol parameters
   (Jorgensen, Maxwell, Tirado-Rives, JACS 1996, 118, 11225); the four partial
   charges sum to zero. Transparent canvas so the hero gradient shows through;
   pauses off-screen, reduced-motion safe. Shares the page's 3Dmol global; existing
   opls.js is untouched. */
(function () {
  var el = document.getElementById('opls-viewer');
  if (!el || !window.$3Dmol) return;

  var OYSTER = 0xDEDCD5, CREAM = 0xF4EFE4, AMBER = 0xC9824E, SLATE = 0x9AA0AE;
  var BRAND = { C: OYSTER, H: CREAM, O: AMBER, N: SLATE };
  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E', backgroundAlpha: 0 });
  // Let the wheel/two-finger gesture scroll the page instead of zooming the canvas.
  el.addEventListener('wheel', function (e) { e.stopPropagation(); }, { capture: true, passive: true });
  var qEl = document.getElementById('opls-q');
  var typeEl = document.getElementById('opls-type');

  // OPLS-AA parameters for methanol (charges sum to 0). sigma in Angstrom.
  var P = {
    C:  { type: 'opls_157', q: '+0.145', sigma: 3.50 }, // CH3 carbon
    HC: { type: 'opls_156', q: '+0.040', sigma: 2.50 }, // methyl H
    O:  { type: 'opls_154', q: '−0.683', sigma: 3.12 }, // hydroxyl O
    HO: { type: 'opls_155', q: '+0.418', sigma: 0.00 }  // hydroxyl H (point charge, no LJ)
  };
  var SIGMA_TO_VDW = 0.5612; // r_vdw = sigma * 2^(1/6) / 2

  function classify(atom, atoms) {
    if (atom.elem === 'O') return P.O;
    if (atom.elem === 'C') return P.C;
    if (atom.elem === 'H') {
      var b = atom.bonds && atom.bonds.length ? atoms[atom.bonds[0]] : null;
      return (b && b.elem === 'O') ? P.HO : P.HC;
    }
    return null;
  }

  function baseStyle() {
    viewer.setStyle({}, { stick: { radius: 0.13, color: OYSTER }, sphere: { scale: 0.22, color: OYSTER } });
    Object.keys(BRAND).forEach(function (e) {
      viewer.setStyle({ elem: e }, { stick: { radius: 0.13, color: BRAND[e] }, sphere: { scale: 0.22, color: BRAND[e] } });
    });
  }

  function highlight(atom, p) {
    viewer.removeAllShapes();
    baseStyle();
    viewer.setStyle({ index: atom.index }, { stick: { radius: 0.13, color: BRAND[atom.elem] || OYSTER }, sphere: { scale: 0.30, color: BRAND[atom.elem] || OYSTER } });
    if (p.sigma > 0) {
      viewer.addSphere({ center: { x: atom.x, y: atom.y, z: atom.z }, radius: p.sigma * SIGMA_TO_VDW, color: 'orange', opacity: 0.28 });
    }
    if (qEl) qEl.textContent = p.q;
    if (typeEl) typeEl.textContent = 'OPLS-AA · ' + p.type + ' · σ ' + p.sigma.toFixed(2) + ' Å · methanol';
    viewer.render();
  }

  $3Dmol.download('cid:887', viewer, {}, function () {
    var atoms = viewer.getModel().selectedAtoms({});
    // Build the cycle order: C, then its methyl H's, the O, then the hydroxyl H.
    var order = [];
    atoms.forEach(function (a) { if (a.elem === 'C') order.push(a); });
    atoms.forEach(function (a) { if (a.elem === 'H' && classify(a, atoms) === P.HC) order.push(a); });
    atoms.forEach(function (a) { if (a.elem === 'O') order.push(a); });
    atoms.forEach(function (a) { if (a.elem === 'H' && classify(a, atoms) === P.HO) order.push(a); });

    baseStyle();
    viewer.zoomTo();
    viewer.zoom(0.92, 400);

    var i = 0;
    function step() { var a = order[i % order.length]; highlight(a, classify(a, atoms)); i += 1; }

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { step(); return; } // static: show the first atom's parameters

    step();

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(el);
    }

    var last = 0, INTERVAL = 1500; // ms each atom is featured
    var FRAME = 1000 / 45, lastFrame = 0; // cap to ~45fps to ease GPU load/heat
    function loop(ts) {
      requestAnimationFrame(loop);
      if (!visible) return;
      var dt = ts - lastFrame;
      if (dt < FRAME) return;
      lastFrame = ts;
      viewer.rotate(0.25 * Math.min(dt, 50) / 16.67, { x: 0, y: 1, z: 0 }); // fps-independent
      if (ts - last > INTERVAL) { step(); last = ts; }
      viewer.render();
    }
    requestAnimationFrame(loop);
  });
}());
