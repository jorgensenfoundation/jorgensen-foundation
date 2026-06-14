// Shared site chrome behaviour: nav scroll-state, mobile hamburger, smooth anchor scroll.
const nav = document.getElementById('nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });
}
// The mobile nav has three mutually-exclusive top-level panels: the hamburger menu
// (.menu-open on #nav), the login drawer (.nav-account.open) and the search drawer
// (.nav-msearch.open). closeNavPanels() resets all of them (plus the nested Programs
// accordion) so opening any one closes the others — styling/animation live in nav.css.
function closeNavPanels() {
  if (nav) nav.classList.remove('menu-open');
  document.querySelectorAll('.nav-account, .nav-msearch, .nav-dropdown').forEach(el => el.classList.remove('open'));
}
function toggleMenu() {
  if (!nav) return;
  const willOpen = !nav.classList.contains('menu-open');
  closeNavPanels();
  if (willOpen) nav.classList.add('menu-open');
}
// Mobile-only: tap the account icon → login drawer (closes the other two first).
function toggleAccount(e) {
  if (!window.matchMedia('(max-width:960px)').matches) return;
  e.preventDefault();
  const d = e.currentTarget.closest('.nav-account');
  const willOpen = d && !d.classList.contains('open');
  closeNavPanels();
  if (willOpen) d.classList.add('open');
}
// Mobile-only: tap the search icon → search drawer (closes the other two first).
function toggleSearch(e) {
  if (!window.matchMedia('(max-width:960px)').matches) return;
  e.preventDefault();
  const d = e.currentTarget.closest('.nav-msearch');
  const willOpen = d && !d.classList.contains('open');
  closeNavPanels();
  if (willOpen) d.classList.add('open');
}
// Mobile-only Programs: a SUB-accordion inside the hamburger menu — plain toggle, does
// not close the hamburger (it lives inside it). Desktop uses CSS hover.
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
