// boss page behaviour: citation copy + BOSS launch.
// launchBoss wraps JFAuth.launchBoss (auth.js): the "Launch BOSS" anchors keep an
// href="/login" fallback for no-JS, so we preventDefault before delegating — the
// delegated dispatcher ignores handler return values (the old inline `return
// JFAuth.launchBoss()` suppressed the fallback that way).
function launchBoss(el, e) {
  if (e) e.preventDefault();
  return window.JFAuth.launchBoss();
}

let toastTimer;
function copyCitation() {
  navigator.clipboard.writeText('Jorgensen, W. L.; Tirado-Rives, J. J. Comput. Chem. 2005, 26, 1689.').catch(() => {});
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}
