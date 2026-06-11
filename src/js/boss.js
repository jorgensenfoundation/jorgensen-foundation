// boss page behaviour: citation copy.
let toastTimer;
function copyCitation() {
  navigator.clipboard.writeText('Jorgensen, W. L.; Tirado-Rives, J. J. Comput. Chem. 2005, 26, 1689.').catch(() => {});
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}
