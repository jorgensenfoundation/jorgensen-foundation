// fep page behaviour: citation copy.
let toastTimer;
function copyCitation() {
  navigator.clipboard.writeText('Jorgensen, W. L.; Ravimohan, C. J. Chem. Phys. 1985, 83, 3050.').catch(() => {});
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}
