/* Homepage "Open science" split — live multi-representation rendering.
   Abl tyrosine kinase bound to imatinib (PDB 2HYY) cycles through display modes
   — ribbon -> surface -> space-filling — echoing the Visualisation suite, so the
   homepage shows a third distinct rendering (the hero is a ribbon, the band a
   molecular surface). Ligand amber in the pocket; waters hidden. Drag to rotate;
   the wheel/two-finger gesture scrolls the page. Shares the page's 3Dmol global. */
(function () {
  var el = document.getElementById('jf-surface');
  if (!el || !window.$3Dmol) return;

  var OYSTER = 0xDEDCD5, CREAM = 0xF4EFE4, AMBER = 0xC9824E;
  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E' });

  // Drag-to-rotate stays; let the wheel/two-finger gesture scroll the page rather
  // than being hijacked for zoom (intercept before 3Dmol's canvas handler).
  el.addEventListener('wheel', function (e) { e.stopPropagation(); }, { capture: true, passive: true });

  var PROTEIN = { hetflag: false };
  var LIGAND = { resn: 'STI' }; // imatinib

  function ligand() {
    viewer.setStyle(LIGAND, { stick: { radius: 0.22, color: AMBER }, sphere: { scale: 0.30, color: AMBER } });
  }
  function clearScene() { viewer.removeAllSurfaces(); viewer.setStyle({}, {}); }

  var modes = [
    function () { clearScene(); viewer.setStyle(PROTEIN, { cartoon: { color: OYSTER } }); ligand(); viewer.render(); },
    function () { clearScene(); viewer.setStyle(PROTEIN, { cartoon: { color: OYSTER } }); ligand(); viewer.render();
                  viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.6, color: CREAM }, PROTEIN); viewer.render(); },
    function () { clearScene(); viewer.setStyle(PROTEIN, { sphere: { color: OYSTER } }); viewer.setStyle(LIGAND, { sphere: { color: AMBER } }); viewer.render(); }
  ];

  $3Dmol.download('pdb:2HYY', viewer, {}, function () {
    viewer.setStyle({ resn: 'HOH' }, {});
    viewer.zoomTo(PROTEIN);
    viewer.zoom(0.85, 400);
    modes[0]();

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(el);
    }
    var i = 0, last = 0, INTERVAL = 2600;
    var FRAME = 1000 / 30, lastFrame = 0; // cap to ~30fps to ease GPU load/heat
    function loop(ts) {
      requestAnimationFrame(loop);
      if (!visible) return;
      if (ts - lastFrame < FRAME) return;
      lastFrame = ts;
      viewer.rotate(0.4, { x: 0, y: 1, z: 0 }); // 2x/frame at 30fps
      if (ts - last > INTERVAL) { i = (i + 1) % modes.length; modes[i](); last = ts; }
      viewer.render();
    }
    requestAnimationFrame(loop);
  });
}());
