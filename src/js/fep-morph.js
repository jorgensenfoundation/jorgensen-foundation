/* /fep — live alchemical λ-morph.
   Benzene → chlorobenzene (PubChem CID 7964): the chlorine grows in as the
   coupling parameter λ sweeps 0→1, while a schematic ⟨∂H/∂λ⟩ curve traces and
   its running integral gives ΔG. A real lead-optimisation-style perturbation.
   Shares the 3Dmol global loaded on the page. Pauses when off-screen; respects
   reduced motion (renders the final state, no animation). */
(function () {
  var el = document.getElementById('fep-viewer');
  if (!el || !window.$3Dmol) return;

  var OYSTER = 0xDEDCD5, AMBER = 0xC9824E;
  var BRAND = { C: OYSTER, H: 0xF4EFE4, O: AMBER, N: 0x9AA0AE };
  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E' });

  var lambdaEl = document.getElementById('fep-lambda');
  var dgEl = document.getElementById('fep-dg');
  var lineEl = document.getElementById('fep-line');
  var fillEl = document.getElementById('fep-fill');
  var markEl = document.getElementById('fep-mark');

  // ---- schematic free-energy curve: <dH/dλ> vs λ ----
  var VW = 320, PADL = 44, PADR = 16, PADT = 18, PADB = 34, VH = 180;
  var x0 = PADL, x1 = VW - PADR, yb = VH - PADB, yt = PADT;
  var FMIN = -4.5, FMAX = 1.0;
  function f(l) { return -3.4 + 4.2 * l - 2.4 * l * l; }   // schematic ∂H/∂λ
  function sx(l) { return x0 + (x1 - x0) * l; }
  function sy(v) { return yb + (yt - yb) * ((v - FMIN) / (FMAX - FMIN)); }
  function integ(L) { var n = 48, s = 0, dx = L / n, i; for (i = 0; i < n; i++) s += f((i + 0.5) * dx) * dx; return s; }

  (function () { // draw the full curve once
    var N = 64, d = 'M', i;
    for (i = 0; i <= N; i++) { var l = i / N; d += (i ? ' L' : '') + sx(l).toFixed(1) + ',' + sy(f(l)).toFixed(1); }
    lineEl.setAttribute('d', d);
  }());

  function updateCurve(L) {
    var n = Math.max(2, Math.round(64 * L)), d = 'M' + sx(0).toFixed(1) + ',' + yb.toFixed(1), i;
    for (i = 0; i <= n; i++) { var l = L * i / n; d += ' L' + sx(l).toFixed(1) + ',' + sy(f(l)).toFixed(1); }
    d += ' L' + sx(L).toFixed(1) + ',' + yb.toFixed(1) + ' Z';
    fillEl.setAttribute('d', d);
    markEl.setAttribute('cx', sx(L).toFixed(1));
    markEl.setAttribute('cy', sy(f(L)).toFixed(1));
  }

  function styleMol(L) {
    viewer.setStyle({}, { stick: { radius: 0.14, color: OYSTER } });
    Object.keys(BRAND).forEach(function (e) { viewer.setStyle({ elem: e }, { stick: { radius: 0.14, color: BRAND[e] } }); });
    viewer.setStyle({ elem: 'Cl' }, { sphere: { scale: 0.05 + 0.5 * L, color: AMBER }, stick: { radius: 0.05 + 0.13 * L, color: AMBER } });
    viewer.render();
  }

  function setState(L) { lambdaEl.textContent = L.toFixed(2); dgEl.textContent = integ(L).toFixed(1); updateCurve(L < 0.002 ? 0.002 : L); }

  $3Dmol.download('cid:7964', viewer, {}, function () {
    viewer.zoomTo();
    styleMol(0); setState(0);
    viewer.zoom(1.15, 400);

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { styleMol(1); setState(1); return; } // final state, no animation

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 })
        .observe(el);
    }

    var start = null, period = 5200, hold = 1100, lastL = -1;
    function loop(ts) {
      requestAnimationFrame(loop);
      if (!visible) { start = null; return; }   // pause off-screen, resume cleanly
      if (!start) start = ts;
      var t = (ts - start) % (period + hold);
      var L = t < period ? t / period : 1;
      setState(L);
      viewer.rotate(0.4, 'y');
      if (Math.abs(L - lastL) > 0.03) { styleMol(L); lastL = L; } else { viewer.render(); }
    }
    requestAnimationFrame(loop);
  });
}());
