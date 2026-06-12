// Shared site chrome behaviour: nav scroll-state, mobile hamburger, smooth anchor scroll.
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
});
function toggleMenu() {
  const links = document.querySelector('.nav-links');
  if (links) {
    const open = links.style.display === 'flex';
    links.style.cssText = open ? '' : 'display:flex;flex-direction:column;position:fixed;top:60px;left:0;right:0;background:#fff;padding:2rem 1.5rem;gap:1.5rem;border-bottom:1px solid #ede8de;z-index:99';
    if (!open) document.querySelectorAll('.nav-links a').forEach(a => a.style.color = '#111');
  }
}
// Mobile-only Programs dropdown: tap "Programs" to expand the submenu; desktop uses CSS hover.
function toggleDropdown(e) {
  if (window.matchMedia('(max-width:960px)').matches) {
    e.preventDefault();
    const d = e.currentTarget.closest('.nav-dropdown');
    if (d) d.classList.toggle('open');
  }
}
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
  });
});
