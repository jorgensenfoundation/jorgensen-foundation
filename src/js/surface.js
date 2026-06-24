/* Homepage "Open science" split band — live molecular surface.
   Renders cholesterol (PubChem CID 5997) as a brand-coloured stick model wrapped
   in a translucent Connolly (molecular) surface — a third distinct representation
   alongside the protein ribbon and the small-molecule sticks. Slow auto-spin.
   Shares the 3Dmol global loaded on the homepage. */
(function () {
  var el = document.getElementById('jf-surface');
  if (!el || !window.$3Dmol) return;

  var BRAND = { C: 0xDEDCD5, H: 0xF4EFE4, O: 0xC9824E, N: 0x9AA0AE, S: 0xE3C766 };
  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E' });

  // Drag-to-rotate stays; let the wheel/two-finger gesture scroll the page rather
  // than being hijacked for zoom (intercept before 3Dmol's canvas handler).
  el.addEventListener('wheel', function (e) { e.stopPropagation(); }, { capture: true, passive: true });

  $3Dmol.download('cid:5997', viewer, {}, function () {
    viewer.setStyle({}, { stick: { radius: 0.13, color: 0xDEDCD5 } });
    Object.keys(BRAND).forEach(function (e) {
      viewer.setStyle({ elem: e }, { stick: { radius: 0.13, color: BRAND[e] } });
    });
    // Translucent molecular surface in Oyster — reads as soft electron density
    viewer.addSurface($3Dmol.SurfaceType.MS, { opacity: 0.5, color: 0xDEDCD5 });
    viewer.zoomTo();
    viewer.render();
    viewer.zoom(0.95, 600);
    viewer.spin('y', 0.3);
  });
}());
