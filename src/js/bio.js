/* Homepage BOSS/MCPRO band — ambient live protein–ligand structure.
   Renders the Abl tyrosine kinase bound to imatinib (PDB 2HYY), a landmark
   structure-based drug-design target: Oyster cartoon ribbon with the inhibitor
   in stick, brand-coloured atoms, slow auto-spin (drag to rotate). A different
   structure from the hero's HIV-1 RT so the page doesn't repeat a molecule.
   Shares the 3Dmol global loaded on the homepage. */
(function () {
  var el = document.getElementById('jf-bio');
  if (!el || !window.$3Dmol) return;

  // Brand atom palette (light enough to read on Midnight; one warm accent on O)
  var BRAND = { C: 0xDEDCD5, H: 0xF4EFE4, O: 0xC9824E, N: 0x9AA0AE, S: 0xE3C766 };

  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E' });

  // Drag-to-rotate stays; let the wheel/two-finger gesture scroll the page rather
  // than being hijacked for zoom (intercept before 3Dmol's canvas handler).
  el.addEventListener('wheel', function (e) { e.stopPropagation(); }, { capture: true, passive: true });

  $3Dmol.download('pdb:2HYY', viewer, {}, function () {
    // Protein backbone as an Oyster ribbon
    viewer.setStyle({}, { cartoon: { color: 0xDEDCD5, thickness: 0.4, arrows: true } });

    // Ligand (all hetero atoms) as sticks + small spheres
    viewer.setStyle({ hetflag: true }, {
      stick: { radius: 0.2, color: 0xDEDCD5 },
      sphere: { scale: 0.25, color: 0xDEDCD5 }
    });
    Object.keys(BRAND).forEach(function (e) {
      viewer.setStyle({ hetflag: true, elem: e }, {
        stick: { radius: 0.2, color: BRAND[e] },
        sphere: { scale: 0.25, color: BRAND[e] }
      });
    });

    // Hide waters, ions and cryoprotectants last so only protein + inhibitor show
    viewer.setStyle({ resn: ['HOH', 'SO4', 'PO4', 'GOL', 'EDO', 'NA', 'MG', 'CL', 'MN', 'ZN', 'ACT'] }, {});

    viewer.zoomTo();
    viewer.render();
    viewer.zoom(0.78, 800);
    viewer.spin('y', 0.3);
  });
}());
