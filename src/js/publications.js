// Publications page behaviour: category filter + citation copy toast.
function applyFilter(category) {
  document.querySelectorAll('.filter-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === category));

  const items = document.querySelectorAll('.pub-item[data-category]');
  let visible = 0;
  items.forEach(item => {
    const show = category === 'all' || item.dataset.category === category;
    item.classList.toggle('hidden', !show);
    if (show) visible++;
  });

  const empty = document.getElementById('empty-state');
  if (empty) empty.style.display = visible === 0 ? 'block' : 'none';
}
function setFilter(el) { applyFilter(el.dataset.filter); }

// Deep-link support: /publications#force-fields (etc.) preselects that category,
// so the nav dropdown can jump straight to a topic.
(function initPubFilterFromHash() {
  const KNOWN = ['force-fields', 'monte-carlo', 'free-energy', 'drug-discovery'];
  const h = (window.location.hash || '').replace('#', '');
  if (KNOWN.indexOf(h) !== -1) applyFilter(h);
})();

let toastTimer;
function copyCite(el) {
  navigator.clipboard.writeText(el.dataset.cite).catch(() => {});
  const toast = document.getElementById('toast');
  toast.textContent = 'Citation copied';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}
