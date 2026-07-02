const EYE_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
function toggleVis(btn) {
  const input = document.getElementById(btn.dataset.target);
  if (input.type === 'password') { input.type = 'text'; btn.innerHTML = EYE_CLOSED; btn.setAttribute('aria-label', 'Hide password'); }
  else { input.type = 'password'; btn.innerHTML = EYE_OPEN; btn.setAttribute('aria-label', 'Show password'); }
}

const API = window.JF_API;
let currentUser = null;
let selectedPlan = 'monthly';

// Academic access is free — academics are entitled and never reach the payment page (see the
// entitlement gate in the bootstrap). Kept only as a defensive label if opened directly.
const ACADEMIA_PRICES = { monthly: 'Free', annual: 'Free' };
const INDUSTRY_PRICES = { monthly: '$199/mo', annual: '$1,990/yr' };

function showPage(id) {
  document.getElementById('page-login').classList.toggle('hidden', id !== 'page-login');
  document.getElementById('page-payment').classList.toggle('hidden', id !== 'page-payment');
  document.getElementById('page-login').style.display = id === 'page-login' ? 'flex' : 'none';
  document.getElementById('page-payment').style.display = id === 'page-payment' ? 'flex' : 'none';
}

// Reflect the logged-in state in the app nav (name + Sign Out) for a non-active user who stays
// on the payment/activate page — mirrors what the old in-page dashboard used to set.
function showAppNavUser(user) {
  const first = user.first_name || user.email.split('@')[0];
  const u = document.getElementById('nav-user');
  const lo = document.getElementById('nav-logout');
  if (u) { u.textContent = first; u.style.display = 'inline'; }
  if (lo) lo.style.display = 'inline';
}

// Wrap the "/period" suffix in a <span> for styling — but only when there is one. A plain
// string like "Free" (no slash) renders as-is, avoiding a stray closing tag.
function priceHtml(p) {
  const i = p.indexOf('/');
  return i === -1 ? p : p.slice(0, i) + '<span>' + p.slice(i) + '</span>';
}

function setupPaymentPage(user) {
  const isAcademia = user.account_type === 'academia';
  const prices = isAcademia ? ACADEMIA_PRICES : INDUSTRY_PRICES;
  document.getElementById('plan-type-label').textContent = isAcademia ? 'Academia Access' : 'Industry Access';
  document.getElementById('price-monthly').innerHTML = priceHtml(prices.monthly);
  document.getElementById('price-annual').innerHTML = priceHtml(prices.annual);
}

function selectPlan(el) {
  const period = el.dataset.period;
  selectedPlan = period;
  document.getElementById('plan-monthly').classList.toggle('selected', period === 'monthly');
  document.getElementById('plan-annual').classList.toggle('selected', period === 'annual');
}

async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const rememberEl = document.getElementById('login-remember');
  const remember = !!(rememberEl && rememberEl.checked);
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  errorEl.classList.remove('show');
  if (!email || !password) {
    errorEl.textContent = 'Please enter your email and password.';
    errorEl.classList.add('show'); return;
  }
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, password, remember})
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.detail || 'Invalid email or password.';
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }
    const userInfo = {
      email: data.email,
      first_name: data.first_name,
      account_type: data.account_type,
      subscription_status: data.subscription_status,
      is_board_member: data.is_board_member
    };
    JFAuth.saveSession(userInfo, data.token, remember);
    currentUser = userInfo;
    // Every logged-in user lands on the dashboard (active or non-active). The dashboard shows
    // the activate banner for non-active users; the payment page is only reached when they
    // explicitly choose to activate (which arrives here as /login#activate — see bootstrap).
    window.location.href = '/dashboard';
  } catch(e) {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function proceedToPayment() {
  if (!currentUser) return;
  const btn = document.getElementById('payment-btn');
  const errorEl = document.getElementById('payment-error');
  errorEl.classList.remove('show');
  btn.disabled = true;
  btn.textContent = 'Redirecting to payment...';
  try {
    const res = await fetch(`${API}/create-checkout`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + JFAuth.getToken()},
      body: JSON.stringify({billing_period: selectedPlan})
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.detail || 'Could not create checkout. Please try again.';
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Continue to Payment';
      return;
    }
    window.location.href = data.checkout_url;
  } catch(e) {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Continue to Payment';
  }
}

// Revoke the token server-side (POST /logout), THEN clear the local session and show the login
// form. Local clear always happens regardless of the network result; a safety cap avoids hangs.
function logout() {
  const token = JFAuth.getToken();
  let done = false;
  function finish() {
    if (done) return;
    done = true;
    JFAuth.clearSession();
    currentUser = null;
    const u = document.getElementById('nav-user'); if (u) u.style.display = 'none';
    const lo = document.getElementById('nav-logout'); if (lo) lo.style.display = 'none';
    showPage('page-login');
  }
  if (!token) { finish(); return; }
  setTimeout(finish, 2500);
  try {
    fetch(`${API}/logout`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }).then(finish, finish);
  } catch (e) {
    finish();
  }
}

// Bootstrap. Every logged-in user (active OR non-active) lands on the real /dashboard; the
// payment page is shown ONLY when the user explicitly chose to activate — the dashboard's
// "Activate" / "Subscribe to launch" buttons link to /login#activate, and that flag (for a
// non-active user) opens the Stripe activate page here instead of bouncing to the dashboard.
//   logged-out                          → login form
//   logged-in + #activate + non-active  → payment/activate page (Stripe flow)
//   logged-in (everything else)         → redirect to /dashboard
const user = JFAuth.getUser();
if (user) {
  currentUser = user;
  const wantsActivate = location.hash === '#activate';
  // Only genuinely non-entitled users (industry path, not yet active) see the Stripe payment
  // page. Academics and board members are the free tier — entitled, so they go straight to the
  // dashboard and never see a price. Mirrors JFAuth.hasProgramAccess / the backend.
  const entitled = (window.JFAuth && JFAuth.hasProgramAccess)
    ? JFAuth.hasProgramAccess(user)
    : (user.subscription_status === 'active' || user.account_type === 'academia' || user.is_board_member);
  if (wantsActivate && !entitled) {
    showAppNavUser(user);
    setupPaymentPage(user);
    showPage('page-payment');
  } else {
    window.location.href = '/dashboard';
  }
} else {
  // Surface a friendly message when social sign-in bounced back with ?error=…
  // (see the backend's _oauth_error_redirect reasons).
  const oauthErr = new URLSearchParams(location.search).get('error');
  if (oauthErr) {
    const MAP = {
      oauth_unconfigured: 'That sign-in option isn’t available yet. Please use email and password.',
      oauth_denied: 'Sign-in was cancelled. Please try again.',
      oauth_state: 'Your sign-in session expired. Please try again.',
      oauth_exchange: 'We couldn’t complete sign-in with that provider. Please try again.',
      oauth_identity: 'That provider didn’t return enough information to sign you in.',
    };
    const el = document.getElementById('login-error');
    if (el) { el.textContent = MAP[oauthErr] || 'Sign-in failed. Please try again.'; el.classList.add('show'); }
    history.replaceState(null, '', location.pathname);   // scrub ?error= from the URL
  }
  showPage('page-login');
}
