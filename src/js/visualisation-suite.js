/* /visualisation hero — live demo of the Molecular Visualisation Suite.
   Trypsin in complex with benzamidine (PDB 3PTB), the classic protein-ligand
   binding system, slowly rotating while the renderer cycles through its display
   modes — ribbon → surface → space-filling — to show the suite re-rendering the
   same structure interactively. The benzamidine ligand stays amber in the active
   site throughout, so the binding mode reads in every representation. Waters are
   hidden. Transparent canvas so the hero gradient shows through; pauses off-screen,
   reduced-motion safe. Shares the 3Dmol global loaded on the page. */
(function () {
  var el = document.getElementById('vis-viewer');
  if (!el || !window.$3Dmol) return;

  var OYSTER = 0xDEDCD5, CREAM = 0xF4EFE4, AMBER = 0xC9824E;
  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E', backgroundAlpha: 0 });
  var modeEl = document.getElementById('vis-mode');

  var PROTEIN = { hetflag: false };   // the polymer
  var LIGAND = { resn: 'BEN' };       // benzamidine

  function ligandSticks() {
    viewer.setStyle(LIGAND, { stick: { radius: 0.22, color: AMBER }, sphere: { scale: 0.30, color: AMBER } });
  }

  function clearScene() { viewer.removeAllSurfaces(); viewer.setStyle({}, {}); }

  var modes = [
    { name: 'ribbon', apply: function () {
        clearScene();
        viewer.setStyle(PROTEIN, { cartoon: { color: OYSTER } });
        ligandSticks();
        viewer.render();
      } },
    { name: 'surface', apply: function () {
        clearScene();
        viewer.setStyle(PROTEIN, { cartoon: { color: OYSTER } });
        ligandSticks();
        viewer.render();
        viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.62, color: CREAM }, PROTEIN);
        viewer.render();
      } },
    { name: 'space-filling', apply: function () {
        clearScene();
        viewer.setStyle(PROTEIN, { sphere: { color: OYSTER } });
        viewer.setStyle(LIGAND, { sphere: { color: AMBER } });
        viewer.render();
      } }
  ];

  function show(i) {
    modes[i].apply();
    if (modeEl) modeEl.textContent = modes[i].name;
  }

  $3Dmol.download('pdb:3PTB', viewer, {}, function () {
    viewer.zoomTo(PROTEIN);
    viewer.zoom(0.85, 400);
    show(0);

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // static: ribbon view

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(el);
    }

    var i = 0, last = 0, INTERVAL = 2600; // ms each representation is held
    function loop(ts) {
      requestAnimationFrame(loop);
      if (!visible) return;
      viewer.rotate(0.2, { x: 0, y: 1, z: 0 }); // slow continuous turn
      if (ts - last > INTERVAL) { i = (i + 1) % modes.length; show(i); last = ts; }
      viewer.render();
    }
    requestAnimationFrame(loop);
  });
}());
