/* /lab — Live Molecule Hero (PREVIEW).
   Renders real 3D structures with 3Dmol.js, resolved by name from PubChem.
   Self-contained; safe to delete with lab.njk + css/lab.css. */
(function () {
  var el = document.getElementById('jf-viewer');
  if (!el || !window.$3Dmol) {
    var s = document.getElementById('mol-status');
    if (s) s.textContent = 'Could not load the 3D engine.';
    return;
  }

  var MIDNIGHT = '#302C2E'; // brand Midnight (--ink), per styleguide
  var nameEl = document.getElementById('mol-name');
  var formulaEl = document.getElementById('mol-formula');
  var statusEl = document.getElementById('mol-status');
  var form = document.getElementById('try-form');
  var input = document.getElementById('try-input');

  var viewer = $3Dmol.createViewer(el, { backgroundColor: MIDNIGHT });

  // Drag-to-rotate stays; let the wheel/two-finger gesture scroll the page rather
  // than being hijacked for zoom (intercept before 3Dmol's canvas handler).
  el.addEventListener('wheel', function (e) { e.stopPropagation(); }, { capture: true, passive: true });

  // Brand atom palette — Oyster carbons / Cream hydrogens on Midnight, one warm
  // accent on oxygen, soft slate on nitrogen. Reads as art-directed, not CPK-default.
  var BRAND = { C: 0xDEDCD5, H: 0xF4EFE4, O: 0xC9824E, N: 0xAFA290, S: 0xE3C766, P: 0xCB8E5A };

  // Subscript digits so formulas read like chemistry (C8H10N4O2 -> C₈H₁₀N₄O₂)
  var SUBS = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' };
  function pretty(formula) {
    return (formula || '').replace(/\d/g, function (d) { return SUBS[d]; });
  }

  function paint() {
    // Base (covers any element not in BRAND), then per-element brand colours
    viewer.setStyle({}, {
      stick: { radius: 0.15, color: 0xDEDCD5 },
      sphere: { scale: 0.23, color: 0xDEDCD5 }
    });
    Object.keys(BRAND).forEach(function (e) {
      viewer.setStyle({ elem: e }, {
        stick: { radius: 0.15, color: BRAND[e] },
        sphere: { scale: 0.23, color: BRAND[e] }
      });
    });
    viewer.zoomTo();
    viewer.render();
    viewer.zoom(1.15, 600);
    viewer.spin('y', 0.5);
  }

  function renderCid(cid, label) {
    statusEl.textContent = 'Rendering…';
    viewer.clear();
    $3Dmol.download('cid:' + cid, viewer, {}, function () {
      statusEl.textContent = '';
      if (label) nameEl.textContent = label;
      paint();
    });
  }

  function titleCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function resolve(name) {
    name = name.trim();
    if (!name) return;
    statusEl.textContent = 'Searching PubChem…';
    fetch('https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' +
          encodeURIComponent(name) + '/property/MolecularFormula/JSON')
      .then(function (r) { if (!r.ok) throw new Error('nf'); return r.json(); })
      .then(function (j) {
        var p = j.PropertyTable.Properties[0];
        formulaEl.textContent = pretty(p.MolecularFormula);
        renderCid(p.CID, titleCase(name));
      })
      .catch(function () {
        statusEl.textContent = '“' + name + '” not found — try a common name like aspirin or glucose.';
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    resolve(input.value);
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-mol]'), function (btn) {
    btn.addEventListener('click', function () {
      input.value = btn.getAttribute('data-mol');
      resolve(btn.getAttribute('data-mol'));
    });
  });

  // Default molecule on load: caffeine (CID 2519)
  formulaEl.textContent = pretty('C8H10N4O2');
  renderCid(2519, 'Caffeine');
}());
