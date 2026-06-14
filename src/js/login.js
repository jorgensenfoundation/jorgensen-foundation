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
  document.getElementById('dashboard').classList.toggle('active', id === 'dashboard');
  document.getElementById('page-login').style.display = id === 'page-login' ? 'flex' : 'none';
  document.getElementById('page-payment').style.display = id === 'page-payment' ? 'flex' : 'none';
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

function showDashboard(user) {
  currentUser = user;
  const first = user.first_name || user.email.split('@')[0];
  document.getElementById('dash-name').textContent = first;
  document.getElementById('dash-email').textContent = user.email;
  document.getElementById('dash-type').textContent = user.account_type === 'academia' ? 'Academic Access' : 'Industry Access';
  document.getElementById('nav-user').textContent = first;
  document.getElementById('nav-user').style.display = 'inline';
  document.getElementById('nav-logout').style.display = 'inline';
  showPage('dashboard');
  setupBoardReview(user);
}

// --- Board review (only for board members) ---------------------------------
// esc/escAttr: entity-encode any backend-supplied data before it touches innerHTML.
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escAttr(value) { return esc(value); }

function isBoardMember(user) {
  // Prefer the stored session (JFAuth), fall back to the passed-in user object.
  const stored = (window.JFAuth && JFAuth.getUser && JFAuth.getUser()) || null;
  if (stored && stored.is_board_member) return true;
  return !!(user && user.is_board_member);
}

function setupBoardReview(user) {
  const section = document.getElementById('board-review');
  if (!section) return;
  if (!isBoardMember(user)) { section.hidden = true; return; }
  section.hidden = false;
  loadAssignments();
}

function reviewAuthHeader() {
  // Board endpoints use the regular user Bearer token.
  if (window.JFAuth && JFAuth.authHeader) return JFAuth.authHeader();
  return { 'Authorization': 'Bearer ' + sessionStorage.getItem('jf_user_token') };
}

// On an expired/invalid user token, clear the session and return to login.
function reviewRelogin() {
  logout();
}

async function loadAssignments() {
  const wrap = document.getElementById('review-list');
  try {
    const res = await fetch(`${API}/board/assignments`, { headers: reviewAuthHeader() });
    if (res.status === 401) { reviewRelogin(); return; }
    if (!res.ok) {
      if (wrap) wrap.innerHTML = '<p class="review-empty">Could not load your assignments right now.</p>';
      return;
    }
    const list = await res.json();
    renderAssignments(list);
  } catch (e) {
    if (wrap) wrap.innerHTML = '<p class="review-empty">Could not load your assignments right now.</p>';
  }
}

function renderAssignments(list) {
  const wrap = document.getElementById('review-list');
  if (!wrap) return;
  if (!Array.isArray(list) || list.length === 0) {
    wrap.innerHTML = '<p class="review-empty">You have no applications assigned for review.</p>';
    return;
  }
  wrap.innerHTML = list.map(a => {
    const id = a.grant_id != null ? a.grant_id : a.id;
    const applicant = `${esc(a.first_name || '')} ${esc(a.last_name || '')}`.trim() || '—';
    const amount = (a.amount_requested !== null && a.amount_requested !== undefined && a.amount_requested !== '') ? ('$' + esc(a.amount_requested)) : '—';
    const conf = esc(a.conference_name || 'Conference');
    const confMeta = [a.conference_date, a.conference_location].filter(Boolean).map(esc).join(' · ');
    const cv = a.cv_url ? `<a class="grant-cv-link" href="${escAttr(a.cv_url)}" target="_blank" rel="noopener">View CV →</a>` : '';
    const status = esc(a.status || 'submitted');
    const voted = a.recommendation;
    const voteBlock = voted
      ? `<div class="vote-recorded">
           <span class="vote-recorded-label">Your recommendation</span>
           <span class="badge-vote badge-vote-${escAttr(voted)}">${esc(voted)}</span>
           ${a.comment ? `<p class="vote-comment">${esc(a.comment)}</p>` : ''}
         </div>`
      : renderVoteForm(id);
    return `
      <div class="review-card">
        <div class="review-card-head">
          <div>
            <div class="review-card-title">${conf}</div>
            <div class="review-card-meta">${applicant} · ${esc(a.institution || '—')}</div>
            <div class="review-card-meta">${confMeta || '—'} · ${amount}</div>
          </div>
          <span class="tag-status">${status}</span>
        </div>
        ${a.research_description ? `<p class="review-desc">${esc(a.research_description)}</p>` : ''}
        ${cv}
        ${voteBlock}
        <p class="form-msg review-msg" id="vote-msg-${escAttr(id)}"></p>
      </div>`;
  }).join('');
}

function renderVoteForm(id) {
  const safeId = escAttr(id);
  return `
    <div class="vote-form" id="vote-form-${safeId}">
      <span class="vote-label">Your recommendation</span>
      <div class="vote-options">
        <label class="vote-opt"><input type="radio" name="rec-${safeId}" value="approve"> Approve</label>
        <label class="vote-opt"><input type="radio" name="rec-${safeId}" value="reject"> Reject</label>
        <label class="vote-opt"><input type="radio" name="rec-${safeId}" value="abstain"> Abstain</label>
      </div>
      <textarea class="input vote-textarea" id="vote-comment-${safeId}" placeholder="Comments (optional) — rationale for your recommendation."></textarea>
      <button class="choice-btn choice-btn-primary vote-submit" type="button" onclick="submitVote('${safeId}')">Submit Review</button>
    </div>`;
}

async function submitVote(id) {
  const msg = document.getElementById(`vote-msg-${id}`);
  const picked = document.querySelector(`input[name="rec-${id}"]:checked`);
  if (!picked) {
    if (msg) { msg.textContent = 'Please choose a recommendation before submitting.'; msg.className = 'form-msg review-msg error'; }
    return;
  }
  const commentEl = document.getElementById(`vote-comment-${id}`);
  const comment = commentEl ? commentEl.value.trim() : '';
  const btn = document.querySelector(`#vote-form-${id} .vote-submit`);
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
  if (msg) msg.className = 'form-msg review-msg';
  try {
    const res = await fetch(`${API}/board/assignments/${encodeURIComponent(id)}/vote`, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, reviewAuthHeader()),
      body: JSON.stringify({ recommendation: picked.value, comment })
    });
    if (res.status === 401) { reviewRelogin(); return; }
    if (res.ok) {
      if (msg) { msg.textContent = 'Review submitted.'; msg.className = 'form-msg review-msg success'; }
      loadAssignments();
    } else {
      const data = await res.json().catch(() => ({}));
      if (msg) { msg.textContent = data.detail || 'Could not submit your review. Please try again.'; msg.className = 'form-msg review-msg error'; }
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Review'; }
    }
  } catch (e) {
    if (msg) { msg.textContent = 'Connection error. Please try again.'; msg.className = 'form-msg review-msg error'; }
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Review'; }
  }
}

function toggleCard(btn) {
  const expanded = btn.nextElementSibling;
  const isOpen = expanded.classList.contains('open');
  expanded.classList.toggle('open', !isOpen);
  btn.querySelector('span').textContent = isOpen ? '↓' : '↑';
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
      showDashboard(userInfo);
    } else {
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
    setTimeout(() => showDashboard(currentUser), 1200);
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

// Check existing session
const saved = sessionStorage.getItem('jf_user');
if (saved) {
  const user = JSON.parse(saved);
  currentUser = user;
  if (user.subscription_status === 'active') {
    showDashboard(user);
  } else {
    setupPaymentPage(user);
    showPage('page-payment');
  }
} else {
  showPage('page-login');
}
