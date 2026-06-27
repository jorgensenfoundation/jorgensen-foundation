/* Site search — fully client-side, no backend.
 *
 * Reads /search-index.json (generated at build time from site.sitemapPages, see
 * .eleventy.js + search-index.njk) and powers the nav search boxes: the "Discover"
 * box in the Sign In mega-panel and the menu/mobile search box. Because the index
 * is built from the page collection, any public page added in the future is
 * searchable automatically — this file never needs to change.
 *
 * The index is fetched once, lazily, on first focus, then cached for the session.
 */
(function () {
  "use strict";

  var INDEX_URL = "/search-index.json";
  var MAX_RESULTS = 6;

  var indexPromise = null; // shared, fetched once
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(INDEX_URL, { credentials: "same-origin" })
        .then(function (r) {
          if (!r.ok) throw new Error("search index " + r.status);
          return r.json();
        })
        .catch(function (err) {
          // Let a later focus retry rather than caching the failure forever.
          indexPromise = null;
          throw err;
        });
    }
    return indexPromise;
  }

  function tokenize(q) {
    return q
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  }

  // Score a single page against the query terms. Returns 0 when any term is
  // missing everywhere (AND match), so results stay precise.
  function scoreEntry(entry, terms) {
    var title = (entry.title || "").toLowerCase();
    var desc = (entry.description || "").toLowerCase();
    var keywords = (entry.keywords || "").toLowerCase();
    var text = (entry.text || "").toLowerCase();
    var score = 0;

    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var inTitle = title.indexOf(t) !== -1;
      var inDesc = desc.indexOf(t) !== -1;
      var inKw = keywords.indexOf(t) !== -1;
      var inText = text.indexOf(t) !== -1;
      if (!inTitle && !inDesc && !inKw && !inText) return 0; // term not found at all

      if (inTitle) score += 10;
      if (title.indexOf(t) === 0 || title.indexOf(" " + t) !== -1) score += 4; // word-start in title
      if (inKw) score += 6;
      if (inDesc) score += 3;
      if (inText) score += 1;
    }
    // Small boost when the whole query appears verbatim in the title.
    if (terms.length > 1 && title.indexOf(terms.join(" ")) !== -1) score += 8;
    return score;
  }

  function search(index, query) {
    var terms = tokenize(query);
    if (!terms.length) return [];
    var scored = [];
    for (var i = 0; i < index.length; i++) {
      var s = scoreEntry(index[i], terms);
      if (s > 0) scored.push({ entry: index[i], score: s });
    }
    scored.sort(function (a, b) {
      return b.score - a.score || a.entry.title.localeCompare(b.entry.title);
    });
    return scored.slice(0, MAX_RESULTS).map(function (x) {
      return x.entry;
    });
  }

  // Build a ~140-char snippet centered on the first matched term, with <mark>s.
  function snippet(entry, terms) {
    var src = entry.description && entry.description.length > 30 ? entry.description : entry.text || entry.description || "";
    var lower = src.toLowerCase();
    var at = -1;
    for (var i = 0; i < terms.length; i++) {
      var p = lower.indexOf(terms[i]);
      if (p !== -1 && (at === -1 || p < at)) at = p;
    }
    var start = at > 60 ? at - 60 : 0;
    var slice = src.slice(start, start + 160).trim();
    if (start > 0) slice = "… " + slice;
    if (start + 160 < src.length) slice = slice + " …";
    return highlight(slice, terms);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function highlight(text, terms) {
    var safe = escapeHtml(text);
    terms.forEach(function (t) {
      var re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      safe = safe.replace(re, "<mark>$1</mark>");
    });
    return safe;
  }

  // Wire a single input + its results panel.
  function attach(input) {
    // Use the form/wrapper as the positioning context for the dropdown.
    var host = input.closest(".nav-search, .nav-menu-search, .nav-menu-search-wrap") || input.parentElement;
    host.classList.add("nav-search-host");

    var panel = document.createElement("div");
    panel.className = "nav-search-results";
    panel.setAttribute("role", "listbox");
    panel.hidden = true;
    host.appendChild(panel);

    var current = []; // current result entries
    var active = -1; // keyboard-highlighted index

    function close() {
      panel.hidden = true;
      panel.innerHTML = "";
      current = [];
      active = -1;
    }

    function render(results, terms) {
      current = results;
      active = -1;
      if (!results.length) {
        panel.innerHTML = '<div class="nav-search-empty">No matches</div>';
        panel.hidden = false;
        return;
      }
      panel.innerHTML = results
        .map(function (e, i) {
          return (
            '<a class="nav-search-result" role="option" href="' +
            e.url +
            '" data-i="' +
            i +
            '">' +
            '<span class="nav-search-result-title">' +
            highlight(e.title.replace(/\s*[—-]\s*Jorgensen Foundation$/, ""), terms) +
            "</span>" +
            '<span class="nav-search-result-snip">' +
            snippet(e, terms) +
            "</span>" +
            "</a>"
          );
        })
        .join("");
      panel.hidden = false;
    }

    function run() {
      var q = input.value.trim();
      if (q.length < 2) {
        close();
        return;
      }
      loadIndex()
        .then(function (index) {
          // Ignore stale resolves if the query changed/cleared meanwhile.
          if (input.value.trim() !== q) return;
          var terms = tokenize(q);
          render(search(index, q), terms);
        })
        .catch(function () {
          panel.innerHTML = '<div class="nav-search-empty">Search is unavailable right now</div>';
          panel.hidden = false;
        });
    }

    function setActive(n) {
      var nodes = panel.querySelectorAll(".nav-search-result");
      if (!nodes.length) return;
      active = (n + nodes.length) % nodes.length;
      nodes.forEach(function (el, i) {
        el.classList.toggle("is-active", i === active);
      });
      nodes[active].scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("focus", function () {
      loadIndex().catch(function () {}); // warm the cache
      if (input.value.trim().length >= 2) run();
    });
    input.addEventListener("input", run);

    input.addEventListener("keydown", function (e) {
      if (panel.hidden) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(active + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(active - 1);
      } else if (e.key === "Enter") {
        var target = active >= 0 ? current[active] : current[0];
        if (target) {
          e.preventDefault();
          window.location.href = target.url;
        }
      } else if (e.key === "Escape") {
        close();
        input.blur();
      }
    });

    // If this input lives in a <form>, hijack submit → go to the top result.
    var form = input.closest("form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var target = active >= 0 ? current[active] : current[0];
        if (target) window.location.href = target.url;
      });
    }

    // Close when focus/click leaves the host.
    document.addEventListener("click", function (e) {
      if (!host.contains(e.target)) close();
    });
  }

  function init() {
    var inputs = document.querySelectorAll(".nav-search-input, .nav-menu-search-input");
    if (!inputs.length) return;
    inputs.forEach(attach);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
