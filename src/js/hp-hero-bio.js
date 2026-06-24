/* Homepage hero — signature live structure.
   HIV-1 reverse transcriptase bound to the Jorgensen lab's own NNRTI inhibitor
   (PDB 8U69, from the group's crystallography): Oyster cartoon ribbon with the
   inhibitor amber in the pocket, slow auto-spin. Drag to rotate; the wheel /
   two-finger gesture is left to scroll the page (not hijacked for zoom).
   Transparent canvas blends into the Midnight hero; pauses off-screen,
   reduced-motion safe. Shares the 3Dmol global already loaded on the homepage. */
(function () {
  var el = document.getElementById('hp-hero-bio');
  if (!el || !window.$3Dmol) return;

  var OYSTER = 0xDEDCD5, AMBER = 0xC9824E;
  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E', backgroundAlpha: 0 });

  // Keep drag-to-rotate, but stop the wheel/two-finger gesture being hijacked for
  // zoom — intercept it before 3Dmol's canvas handler so the page scrolls normally.
  el.addEventListener('wheel', function (e) { e.stopPropagation(); }, { capture: true, passive: true });

  $3Dmol.download('pdb:8U69', viewer, {}, function () {
    viewer.setStyle({}, { cartoon: { color: OYSTER, thickness: 0.4, arrows: true } });
    // Inhibitor (hetero atoms) amber in the pocket; hide crystallographic waters.
    viewer.setStyle({ hetflag: true }, { stick: { radius: 0.2, color: AMBER }, sphere: { scale: 0.28, color: AMBER } });
    viewer.setStyle({ resn: 'HOH' }, {});
    viewer.zoomTo();
    viewer.zoom(1.0, 600);
    viewer.render();

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // static structure

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.02 }).observe(el);
    }
    function loop() {
      requestAnimationFrame(loop);
      if (!visible) return;
      viewer.rotate(0.14, { x: 0, y: 1, z: 0 }); // slow auto-spin
      viewer.render();
    }
    requestAnimationFrame(loop);
  });
}());
