/* /bomb hero — live structure-based ligand growth.
   HIV-1 protease (PDB 1HSG) shown as a faint cartoon; its bound inhibitor
   (HET code MK1) is assembled fragment-by-fragment inside the binding site the
   way BOMB grows a lead — a central core scaffold is seated first, then each
   successive building block (a ring system, a substituent, a linker) is attached
   across a bond, flashing amber as it lands. Ring systems stay whole as cores;
   the molecule decomposes by cutting acyclic bonds at ring junctions. Once
   complete it holds briefly, then the search resets and regrows. A counter tracks
   fragments placed. Depicts the structure-based growth process — not a claim that
   BOMB designed this drug. Transparent canvas so the hero gradient shows through;
   pauses off-screen, reduced-motion safe. Shares the page's 3Dmol global; existing
   bomb.js untouched. */
(function () {
  var el = document.getElementById('bomb-viewer');
  if (!el || !window.$3Dmol) return;

  var OYSTER = 0xDEDCD5, AMBER = 0xC9824E;
  var viewer = $3Dmol.createViewer(el, { backgroundColor: '#302C2E', backgroundAlpha: 0 });
  // Let the wheel/two-finger gesture scroll the page instead of zooming the canvas.
  el.addEventListener('wheel', function (e) { e.stopPropagation(); }, { capture: true, passive: true });
  var nEl = document.getElementById('bomb-n');
  var unitEl = document.getElementById('bomb-unit');

  var PROTEIN = { hetflag: false };
  var LIGAND = { resn: 'MK1' };

  $3Dmol.download('pdb:1HSG', viewer, {}, function () {
    var atoms = viewer.getModel().selectedAtoms(LIGAND);
    if (!atoms.length) return;

    // --- Build a bond graph over the ligand's (heavy) atoms ------------------
    var lig = {};                       // global index -> true
    atoms.forEach(function (a) { lig[a.index] = true; });
    var adj = {};                       // global index -> [neighbour indices]
    atoms.forEach(function (a) {
      adj[a.index] = (a.bonds || []).filter(function (b) { return lig[b]; });
    });
    function deg(i) { return adj[i].length; }

    var bonds = [];                     // unique undirected bonds
    atoms.forEach(function (a) {
      adj[a.index].forEach(function (j) { if (a.index < j) bonds.push([a.index, j]); });
    });

    // A bond is a ring bond if its endpoints stay connected once it is removed.
    function connectedWithout(a, b) {
      var seen = {}, stack = [a]; seen[a] = true;
      while (stack.length) {
        var x = stack.pop();
        if (x === b) return true;
        var ns = adj[x];
        for (var k = 0; k < ns.length; k++) {
          var y = ns[k];
          if ((x === a && y === b) || (x === b && y === a)) continue;
          if (!seen[y]) { seen[y] = true; stack.push(y); }
        }
      }
      return false;
    }

    var ringAtom = {};
    bonds.forEach(function (bd) {
      if (connectedWithout(bd[0], bd[1])) { ringAtom[bd[0]] = true; ringAtom[bd[1]] = true; }
    });

    // Cuttable = acyclic bond at a ring junction, both ends non-terminal. This
    // keeps ring systems and terminal groups whole and peels off building blocks.
    function cuttable(bd) {
      var a = bd[0], b = bd[1];
      return !connectedWithout(a, b) && (ringAtom[a] || ringAtom[b]) && deg(a) >= 2 && deg(b) >= 2;
    }

    // --- Fragments = connected components once cuttable bonds are removed -----
    var fadj = {};
    atoms.forEach(function (a) { fadj[a.index] = []; });
    bonds.forEach(function (bd) {
      if (!cuttable(bd)) { fadj[bd[0]].push(bd[1]); fadj[bd[1]].push(bd[0]); }
    });
    var fragOf = {}, frags = [];
    atoms.forEach(function (a) {
      if (fragOf[a.index] === undefined) {
        var id = frags.length, comp = [], st = [a.index]; fragOf[a.index] = id;
        while (st.length) {
          var x = st.pop(); comp.push(x);
          fadj[x].forEach(function (y) { if (fragOf[y] === undefined) { fragOf[y] = id; st.push(y); } });
        }
        frags.push(comp);
      }
    });

    // Centroid + core fragment (the one holding the most central atom).
    var cx = 0, cy = 0, cz = 0;
    atoms.forEach(function (a) { cx += a.x; cy += a.y; cz += a.z; });
    cx /= atoms.length; cy /= atoms.length; cz /= atoms.length;
    var coreAtom = atoms[0], best = Infinity;
    atoms.forEach(function (a) {
      var dx = a.x - cx, dy = a.y - cy, dz = a.z - cz, d = dx * dx + dy * dy + dz * dz;
      if (d < best) { best = d; coreAtom = a; }
    });
    var coreFrag = fragOf[coreAtom.index];

    // Fragment-connectivity graph, then BFS from the core for the growth order.
    var fg = frags.map(function () { return []; });
    bonds.forEach(function (bd) {
      if (cuttable(bd)) {
        var fa = fragOf[bd[0]], fb = fragOf[bd[1]];
        if (fa !== fb) { fg[fa].push(fb); fg[fb].push(fa); }
      }
    });
    var fragOrder = [], seenF = {}, q = [coreFrag]; seenF[coreFrag] = true;
    while (q.length) {
      var f = q.shift(); fragOrder.push(f);
      fg[f].forEach(function (g) { if (!seenF[g]) { seenF[g] = true; q.push(g); } });
    }
    for (var i = 0; i < frags.length; i++) if (!seenF[i]) fragOrder.push(i);
    var F = fragOrder.length;

    function atomsUpTo(k) {
      var out = [];
      for (var j = 0; j < k; j++) out = out.concat(frags[fragOrder[j]]);
      return out;
    }

    function paint(k) {
      viewer.setStyle(LIGAND, {}); // hide whole ligand
      viewer.setStyle({ index: atomsUpTo(k) }, { stick: { radius: 0.2, color: OYSTER }, sphere: { scale: 0.32, color: OYSTER } });
      if (k > 1) { // flash the freshly attached building block; core stays settled
        viewer.setStyle({ index: frags[fragOrder[k - 1]] }, { stick: { radius: 0.22, color: AMBER }, sphere: { scale: 0.40, color: AMBER } });
      }
      if (nEl) nEl.textContent = k;
      if (unitEl) unitEl.textContent = (k === 1 ? 'fragment' : 'fragments');
      viewer.render();
    }

    // Faint protein context; hide waters.
    viewer.setStyle(PROTEIN, { cartoon: { color: OYSTER, opacity: 0.4, thickness: 0.3 } });
    viewer.setStyle({ resn: 'HOH' }, {});
    viewer.zoomTo(LIGAND);
    viewer.zoom(0.55, 400);

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { paint(F); return; } // static: fully grown lead

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(el);
    }

    var k = 1, phase = 'grow', holdStart = 0, last = 0;
    var FRAG_INTERVAL = 520, HOLD = 1500;
    paint(k);

    var FRAME = 1000 / 45, lastFrame = 0; // cap to ~45fps to ease GPU load/heat
    function loop(ts) {
      requestAnimationFrame(loop);
      if (!visible) return;
      var dt = ts - lastFrame;
      if (dt < FRAME) return;
      lastFrame = ts;
      viewer.rotate(0.22 * Math.min(dt, 120) / 16.67, { x: 0, y: 1, z: 0 }); // fps-independent
      if (phase === 'grow') {
        if (ts - last > FRAG_INTERVAL) {
          k = Math.min(F, k + 1);
          paint(k);
          last = ts;
          if (k >= F) { phase = 'hold'; holdStart = ts; }
        }
      } else if (ts - holdStart > HOLD) {
        k = 1; phase = 'grow'; last = ts; paint(k);
      }
      viewer.render();
    }
    requestAnimationFrame(loop);
  });
}());
