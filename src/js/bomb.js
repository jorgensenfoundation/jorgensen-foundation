// bomb page behaviour: citation copy.
let toastTimer;
function copyCitation() {
  navigator.clipboard.writeText('Jorgensen, W. L. Science 2004, 303, 1813.').catch(() => {});
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}
