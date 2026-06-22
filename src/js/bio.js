/* Homepage BOSS/MCPRO band — ambient live protein–ligand structure.
   Renders HIV-1 protease bound to indinavir (PDB 1HSG): Oyster cartoon ribbon
   with the ligand in stick, brand-coloured atoms, slow auto-spin (drag to rotate).
   Shares the 3Dmol global loaded on the homepage. */
(function () {
  var el = document.getElementById('jf-bio');
  if (!el || !window.$3Dmol) return;

  // Brand atom palette (light enough to read on Midnight; one warm accent on O)
  var BRAND = { C: 0xDEDCD5, H: 0xF4EFE4, O: 0xC9824E, N: 0x9AA0AE, S: 0xE3C766 };

  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E' });

  $3Dmol.download('pdb:1HSG', viewer, {}, function () {
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

    // Hide crystallographic waters last so they never reappear
    viewer.setStyle({ resn: 'HOH' }, {});

    viewer.zoomTo();
    viewer.render();
    viewer.zoom(0.78, 800);
    viewer.spin('y', 0.3);
  });
}());
