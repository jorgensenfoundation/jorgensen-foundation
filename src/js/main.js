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

// --- Inline login + logged-in account menu -------------------------------------
// Same backend contract as the /login page (login.js): POST /login → {token, email,
// first_name, account_type, subscription_status, is_board_member}. JFAuth (auth.js,
// global) owns the session keys 'jf_user_token' / 'jf_user'.
const NAV_API = 'https://jorgensen-backend-production.up.railway.app';

// Reflect auth state in the nav: .is-authed swaps the login mega for the account menu
// (CSS), and we fill the welcome name + board-only "Review Applications" item.
function applyAuthState() {
  if (!nav) return;
  const authed = !!(window.JFAuth && JFAuth.isLoggedIn());
  nav.classList.toggle('is-authed', authed);
  if (authed && window.JFAuth) {
    const u = JFAuth.getUser() || {};
    const nameEl = document.getElementById('nav-acct-name');
    if (nameEl) nameEl.textContent = u.first_name || 'there';
    const review = document.getElementById('nav-acct-review');
    if (review) review.hidden = !u.is_board_member;            // board only
    const grants = document.getElementById('nav-acct-grants');
    if (grants) grants.hidden = !!u.is_board_member;           // applicants only (inverse of review)
  }
}

async function navLogin() {
  const emailEl = document.getElementById('nav-login-email');
  const pwEl = document.getElementById('nav-login-password');
  const errEl = document.getElementById('nav-login-error');
  const btn = document.getElementById('nav-login-btn');
  if (!emailEl || !pwEl) return;
  const email = emailEl.value.trim();
  const password = pwEl.value;
  const showErr = (msg) => { if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); } };
  if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
  if (!email || !password) { showErr('Please enter your email and password.'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
  try {
    const res = await fetch(`${NAV_API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showErr(data.detail || 'Invalid email or password.');
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
      return;
    }
    const userInfo = {
      email: data.email,
      first_name: data.first_name,
      account_type: data.account_type,
      subscription_status: data.subscription_status,
      is_board_member: data.is_board_member
    };
    sessionStorage.setItem('jf_user_token', data.token);
    sessionStorage.setItem('jf_user', JSON.stringify(userInfo));
    if (userInfo.subscription_status === 'active') {
      // Active subscriber → flip the nav to logged-in in place (no page jump).
      applyAuthState();
      closeNavPanels();
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
    } else {
      // Needs payment/activation — that flow lives on the /login page.
      window.location.href = '/login';
    }
  } catch (e) {
    showErr('Connection error. Please try again.');
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
  }
}

applyAuthState();   // main.js runs at end of body → DOM is ready
