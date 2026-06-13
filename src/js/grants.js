// Grants page behaviour: FAQ accordion + authenticated grant applicant flow
// (account gate, /me pre-fill, multipart submission with Bearer token, /my/grants status view).
// Auth helpers come from /js/auth.js (window.JFAuth), loaded before this file.

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escAttr(value) {
  // Entity-encoded for safe use inside quoted HTML attribute values
  return esc(value);
}

function toggleFaq(qEl) {
  const item = qEl.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

const API = 'https://jorgensen-backend-production.up.railway.app';

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function setVal(id, v) {
  const el = document.getElementById(id);
  if (el && v !== null && v !== undefined && v !== '') el.value = v;
}
function fail(msg, text) {
  if (msg) { msg.textContent = text; msg.className = 'form-msg error'; }
  return false;
}

// 401 / expired token: send the applicant back to the login gate.
function promptRelogin() {
  const gate = document.getElementById('grant-gate');
  const form = document.getElementById('grant-form');
  const status = document.getElementById('my-applications');
  if (form) form.hidden = true;
  if (status) status.hidden = true;
  if (gate) gate.hidden = false;
}

// ---- Pre-fill from GET /me (logged-in only) ----
async function prefillFromMe() {
  try {
    const res = await fetch(`${API}/me`, { headers: JFAuth.authHeader() });
    if (res.status === 401) { promptRelogin(); return; }
    if (!res.ok) return;
    const me = await res.json();
    setVal('first-name', me.first_name);
    setVal('last-name', me.last_name);
    setVal('email', me.email);
    setVal('institution', me.institution);
  } catch (e) { /* leave fields blank/editable on network error */ }
}

// ---- Submit the application as multipart/form-data with the Bearer token ----
async function submitGrant() {
  const btn = document.getElementById('submit-btn');
  const msg = document.getElementById('form-msg');
  const text = {
    first_name: val('first-name'),
    last_name: val('last-name'),
    email: val('email'),
    institution: val('institution'),
    supervisor_name: val('supervisor'),
    conference_name: val('conference-name'),
    conference_date: val('conference-date'),
    conference_location: val('conference-location'),
    amount_requested: val('amount'),
    research_description: val('description'),
  };
  for (const [, v] of Object.entries(text)) {
    if (!v) return fail(msg, 'Please complete all fields before submitting.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.email)) {
    return fail(msg, 'Please enter a valid email address.');
  }
  const amt = Number(text.amount_requested);
  if (!Number.isFinite(amt) || amt <= 0) {
    return fail(msg, 'Please enter a valid amount in USD.');
  }
  if (amt > 2000) {
    return fail(msg, 'The maximum award is $2,000. Please request $2,000 or less.');
  }
  const cvInput = document.getElementById('cv');
  const file = cvInput && cvInput.files && cvInput.files[0];
  if (!file) return fail(msg, 'Please attach your supervisor letter / CV as a PDF.');
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return fail(msg, 'The CV must be a PDF file.');
  if (file.size > 10 * 1024 * 1024) return fail(msg, 'The PDF must be 10MB or smaller.');

  if (!window.JFAuth || !JFAuth.isLoggedIn()) { promptRelogin(); return; }

  btn.disabled = true;
  btn.textContent = 'Submitting…';
  msg.className = 'form-msg';

  // FormData -> multipart/form-data. Do NOT set Content-Type: the browser adds the boundary.
  const fd = new FormData();
  Object.entries(text).forEach(([k, v]) => fd.append(k, v));
  fd.append('cv', file);

  try {
    const res = await fetch(`${API}/grants`, {
      method: 'POST',
      headers: JFAuth.authHeader(),
      body: fd,
    });
    if (res.status === 401) {
      btn.disabled = false;
      btn.textContent = 'Submit Application';
      promptRelogin();
      return;
    }
    if (res.ok) {
      msg.textContent = 'Application received. You can track its progress in “Your Applications” below. We will be in touch within three weeks of the cycle closing date.';
      msg.className = 'form-msg success';
      btn.textContent = 'Application Submitted';
      loadMyGrants();
    } else {
      const data = await res.json().catch(() => ({}));
      fail(msg, data.detail || 'Something went wrong. Please try again or email info@jorgensenfoundation.org.');
      btn.disabled = false;
      btn.textContent = 'Submit Application';
    }
  } catch (e) {
    fail(msg, 'Unable to reach the server. Please try again or email info@jorgensenfoundation.org.');
    btn.disabled = false;
    btn.textContent = 'Submit Application';
  }
}

// ---- Status view: GET /my/grants + horizontal step indicator ----
const FLOW_LABELS = ['Submitted', 'Under Review', 'Awaiting Decision', 'Decision', 'Receipts', 'Reimbursed'];
const FLOW_INDEX = {
  submitted: 0,
  under_review: 1,
  awaiting_decision: 2,
  approved: 3,
  rejected: 3,
  receipts_submitted: 4,
  reimbursed: 5,
};

function renderSteps(status) {
  const isRejected = status === 'rejected';
  const active = FLOW_INDEX[status] != null ? FLOW_INDEX[status] : 0;
  const decided = ['approved', 'receipts_submitted', 'reimbursed'].indexOf(status) !== -1;
  let html = '<div class="steps-indicator">';
  for (let i = 0; i < FLOW_LABELS.length; i++) {
    let label = FLOW_LABELS[i];
    if (i === 3) label = isRejected ? 'Rejected' : (decided ? 'Approved' : 'Decision');
    let cls;
    if (isRejected) cls = i < 3 ? 'done' : (i === 3 ? 'rejected' : 'upcoming');
    else cls = i < active ? 'done' : (i === active ? 'current' : 'upcoming');
    html += `<div class="step-node ${cls}"><span class="step-marker"></span><span class="step-label">${esc(label)}</span></div>`;
  }
  return html + '</div>';
}

function renderMyGrants(list) {
  const wrap = document.getElementById('my-grants-list');
  if (!wrap) return;
  if (!Array.isArray(list) || list.length === 0) {
    wrap.innerHTML = '<p class="status-empty">You have not submitted any applications yet.</p>';
    return;
  }
  wrap.innerHTML = list.map(g => {
    const date = g.created_at ? new Date(g.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const amount = (g.amount_requested !== null && g.amount_requested !== undefined && g.amount_requested !== '') ? ('$' + esc(g.amount_requested)) : '—';
    const cv = g.cv_url ? `<a class="grant-cv-link" href="${escAttr(g.cv_url)}" target="_blank" rel="noopener">View CV →</a>` : '';
    return `
      <div class="grant-card">
        <div class="grant-card-head">
          <div>
            <div class="grant-card-title">${esc(g.conference_name || 'Conference')}</div>
            <div class="grant-card-meta">${amount} · Submitted ${esc(date)}</div>
          </div>
          ${cv}
        </div>
        ${renderSteps(g.status || 'submitted')}
      </div>`;
  }).join('');
}

async function loadMyGrants() {
  const wrap = document.getElementById('my-grants-list');
  try {
    const res = await fetch(`${API}/my/grants`, { headers: JFAuth.authHeader() });
    if (res.status === 401) { promptRelogin(); return; }
    if (!res.ok) {
      if (wrap) wrap.innerHTML = '<p class="status-empty">Could not load your applications right now.</p>';
      return;
    }
    const list = await res.json();
    renderMyGrants(list);
  } catch (e) {
    if (wrap) wrap.innerHTML = '<p class="status-empty">Could not load your applications right now.</p>';
  }
}

// ---- Gate: only logged-in users see the form + status; others see the account-required card ----
(function initGrants() {
  const gate = document.getElementById('grant-gate');
  const form = document.getElementById('grant-form');
  const status = document.getElementById('my-applications');
  const loggedIn = !!(window.JFAuth && JFAuth.isLoggedIn());
  if (!loggedIn) {
    if (gate) gate.hidden = false;
    if (form) form.hidden = true;
    if (status) status.hidden = true;
    return;
  }
  if (gate) gate.hidden = true;
  if (form) form.hidden = false;
  if (status) status.hidden = false;
  prefillFromMe();
  loadMyGrants();
})();
