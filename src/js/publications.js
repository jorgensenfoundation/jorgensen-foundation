// Publications page behaviour: category filter + citation copy toast.
function setFilter(btn, category) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const items = document.querySelectorAll('.pub-item[data-category]');
  let visible = 0;
  items.forEach(item => {
    const show = category === 'all' || item.dataset.category === category;
    item.classList.toggle('hidden', !show);
    if (show) visible++;
  });

  const empty = document.getElementById('empty-state');
  empty.style.display = visible === 0 ? 'block' : 'none';
}

let toastTimer;
function copyCite(text) {
  navigator.clipboard.writeText(text).catch(() => {});
  const toast = document.getElementById('toast');
  toast.textContent = 'Citation copied';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}
