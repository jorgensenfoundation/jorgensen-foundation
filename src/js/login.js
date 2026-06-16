const EYE_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
function toggleVis(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') { input.type = 'text'; btn.innerHTML = EYE_CLOSED; btn.setAttribute('aria-label', 'Hide password'); }
  else { input.type = 'password'; btn.innerHTML = EYE_OPEN; btn.setAttribute('aria-label', 'Show password'); }
}

const API = 'https://jorgensen-backend-production.up.railway.app';
let currentUser = null;
let selectedPlan = 'monthly';

const ACADEMIA_PRICES = { monthly: '$49/mo', annual: '$490/yr' };
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

function setupPaymentPage(user) {
  const isAcademia = user.account_type === 'academia';
  const prices = isAcademia ? ACADEMIA_PRICES : INDUSTRY_PRICES;
  document.getElementById('plan-type-label').textContent = isAcademia ? 'Academia Access' : 'Industry Access';
  document.getElementById('price-monthly').innerHTML = prices.monthly.replace('/', '<span>/') + '</span>';
  document.getElementById('price-annual').innerHTML = prices.annual.replace('/', '<span>/') + '</span>';
}

function selectPlan(period) {
  selectedPlan = period;
  document.getElementById('plan-monthly').classList.toggle('selected', period === 'monthly');
  document.getElementById('plan-annual').classList.toggle('selected', period === 'annual');
}

function toggleAccessCode() {
  const section = document.getElementById('access-code-section');
  section.classList.toggle('show');
}

async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
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
      body: JSON.stringify({email, password})
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
    sessionStorage.setItem('jf_user_token', data.token);
    sessionStorage.setItem('jf_user', JSON.stringify(userInfo));
    currentUser = userInfo;
    if (userInfo.subscription_status === 'active') {
      window.location.href = '/dashboard';
    } else {
      showAppNavUser(userInfo);
      setupPaymentPage(userInfo);
      showPage('page-payment');
    }
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
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: currentUser.email, billing_period: selectedPlan})
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

async function applyAccessCode() {
  if (!currentUser) return;
  const code = document.getElementById('access-code-input').value.trim();
  const errorEl = document.getElementById('code-error');
  const successEl = document.getElementById('code-success');
  errorEl.classList.remove('show');
  successEl.classList.remove('show');
  if (!code) {
    errorEl.textContent = 'Please enter an access code.';
    errorEl.classList.add('show'); return;
  }
  try {
    const res = await fetch(`${API}/apply-access-code`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: currentUser.email, code})
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.detail || 'Invalid access code.';
      errorEl.classList.add('show'); return;
    }
    successEl.textContent = 'Access code accepted! Redirecting...';
    successEl.classList.add('show');
    currentUser.subscription_status = 'active';
    sessionStorage.setItem('jf_user', JSON.stringify(currentUser));
    setTimeout(() => { window.location.href = '/dashboard'; }, 1200);
  } catch(e) {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.classList.add('show');
  }
}

function logout() {
  sessionStorage.removeItem('jf_user_token');
  sessionStorage.removeItem('jf_user');
  currentUser = null;
  document.getElementById('nav-user').style.display = 'none';
  document.getElementById('nav-logout').style.display = 'none';
  showPage('page-login');
}

// Bootstrap. The dashboard + board review now live on the real /dashboard and /review pages;
// /login only handles sign-in and the subscription/Stripe activate step.
//   logged-out                  → login form
//   logged-in + active          → redirect to the real /dashboard
//   logged-in + NOT active      → payment/activate page here (Stripe flow)
const saved = sessionStorage.getItem('jf_user');
if (saved) {
  const user = JSON.parse(saved);
  currentUser = user;
  if (user.subscription_status === 'active') {
    window.location.href = '/dashboard';
  } else {
    showAppNavUser(user);
    setupPaymentPage(user);
    showPage('page-payment');
  }
} else {
  showPage('page-login');
}
