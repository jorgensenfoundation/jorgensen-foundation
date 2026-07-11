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
// Only allow http(s) URLs into href — blocks javascript:/data: from a stored cv_url.
function safeUrl(value) {
  if (!value) return '';
  const s = String(value).trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

function toggleFaq(qEl) {
  const item = qEl.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

const API = window.JF_API;

// Set once the applicant submits in this session, so a subsequent loadMyGrants keeps
// the on-form success message visible instead of swapping the form for the notice.
let submittedThisSession = false;

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
      submittedThisSession = true;
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

// Short date formatter shared by the card + receipts summary.
function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

// ---- Payout account (Stripe Connect) ----
// Awardees receive their reimbursement as a Stripe transfer into their own payout
// account, which they set up via Stripe-hosted onboarding. We show this once a grant
// is approved (or awaiting reimbursement). payoutStatus is a per-user cache, loaded
// only when a grant actually needs it.
let payoutStatus = null;
const PAYOUT_RELEVANT = ['approved', 'receipts_submitted'];

async function loadPayoutStatus() {
  try {
    const res = await fetch(`${API}/my/payout/status`, { headers: JFAuth.authHeader() });
    if (res.ok) payoutStatus = await res.json();
  } catch (e) { /* leave null → the panel shows the setup CTA */ }
}

function renderPayoutPanel() {
  if (payoutStatus && payoutStatus.payouts_enabled) {
    return `
      <div class="payout-block payout-ready">
        <span class="payout-label">Payout account</span>
        <p class="payout-note"><span class="payout-check" aria-hidden="true">✓</span> Your payout account is set up — you're all set to receive your reimbursement.</p>
      </div>`;
  }
  const started = !!(payoutStatus && payoutStatus.onboarded);
  return `
    <div class="payout-block">
      <span class="payout-label">Payout account</span>
      <p class="input-hint">To receive your reimbursement, set up your payout account. You'll enter your bank details securely on Stripe — the Foundation never sees or stores them.</p>
      <button class="btn btn--primary" type="button" data-action="startPayout">${started ? 'Finish payout setup' : 'Set up payouts'}</button>
      <p class="form-msg" id="payout-msg"></p>
    </div>`;
}

// Kick off (or resume) Stripe-hosted onboarding, then hand off to Stripe.
async function startPayout(el) {
  const msg = document.getElementById('payout-msg');
  const original = el ? el.textContent : '';
  if (el) { el.disabled = true; el.textContent = 'Starting…'; }
  if (msg) msg.className = 'form-msg';
  try {
    const res = await fetch(`${API}/my/payout/start`, { method: 'POST', headers: JFAuth.authHeader() });
    if (res.status === 401) { promptRelogin(); return; }
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) { window.location.href = data.url; return; }
    if (msg) { msg.textContent = data.detail || 'Could not start payout setup. Please try again.'; msg.className = 'form-msg error'; }
    if (el) { el.disabled = false; el.textContent = original || 'Set up payouts'; }
  } catch (e) {
    if (msg) { msg.textContent = 'Unable to reach the server. Please try again.'; msg.className = 'form-msg error'; }
    if (el) { el.disabled = false; el.textContent = original || 'Set up payouts'; }
  }
}

// Status-gated receipts UI appended below the step indicator on each grant card.
//  - approved            -> upload form (multi-file + amount_claimed)
//  - receipts_submitted  -> read-only summary + receipt download links
//  - reimbursed          -> same summary, plus the reimbursed date
//  - anything else        -> nothing
function renderReceiptsBlock(g) {
  const status = g.status || 'submitted';
  const gid = escAttr(g.id);

  if (status === 'approved') {
    return `
      ${renderPayoutPanel()}
      <div class="receipts-block">
        <span class="receipts-label">Submit Receipts</span>
        <p class="input-hint">Upload your conference receipts (PDF or image, up to 10 files, 10MB each), then enter the total amount you are claiming. The claim cannot exceed your approved amount (max $2,000).</p>
        <div class="input-group">
          <label class="input-label" for="receipts-files-${gid}">Receipt files</label>
          <input class="input input-file" type="file" id="receipts-files-${gid}" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic">
          <span class="input-hint">PDF, JPG, PNG or HEIC. Up to 10 files, 10MB each.</span>
        </div>
        <div class="input-group">
          <label class="input-label" for="receipts-amount-${gid}">Amount claimed (USD)</label>
          <input class="input" type="number" id="receipts-amount-${gid}" min="1" max="2000" step="0.01" placeholder="e.g. 1850">
        </div>
        <button class="btn btn--primary submit-btn" type="button" data-action="submitReceipts" data-id="${gid}">Submit Receipts</button>
        <p class="form-msg" id="receipts-msg-${gid}"></p>
      </div>`;
  }

  if (status === 'receipts_submitted' || status === 'reimbursed') {
    const claimed = (g.amount_claimed !== null && g.amount_claimed !== undefined && g.amount_claimed !== '') ? ('$' + esc(g.amount_claimed)) : '—';
    const receipts = Array.isArray(g.receipts) ? g.receipts : [];
    const links = receipts.length
      ? receipts.map(r => `<a class="grant-cv-link" href="${escAttr(r.download_url)}" target="_blank" rel="noopener">${esc(r.original_filename || 'Receipt')} →</a>`).join('')
      : '<span class="receipts-none">No receipt files on record.</span>';
    return `
      <div class="receipts-block">
        <span class="receipts-label">Receipts</span>
        <div class="receipts-summary">
          <div>Amount claimed: <strong>${claimed}</strong></div>
          <div>Receipts submitted: ${esc(fmtDate(g.receipts_submitted_at))}</div>
          ${g.reimbursed_at ? `<div>Reimbursed: ${esc(fmtDate(g.reimbursed_at))}</div>` : ''}
        </div>
        <div class="receipts-files">${links}</div>
      </div>
      ${status === 'receipts_submitted' ? renderPayoutPanel() : ''}`;
  }

  return '';
}

// Plain-language line under the step indicator so every status reads as a clear,
// self-explanatory state rather than a bare stepper — one per scenario.
const STATUS_NOTES = {
  submitted: 'Your application has been received and is in the queue for board review.',
  under_review: 'Board members are reviewing your application now.',
  awaiting_decision: 'Reviews are in and a final decision is being prepared.',
  approved: 'Congratulations — your grant was approved. After your conference, submit your receipts below to be reimbursed.',
  rejected: 'This application wasn’t selected this cycle. You’re very welcome to apply again in a future cycle.',
  receipts_submitted: 'Thank you — your receipts are with us and reimbursement is being arranged.',
  reimbursed: 'This grant is complete and your reimbursement has been processed. Thank you.',
};
function renderStatusNote(status) {
  const note = STATUS_NOTES[status];
  return note ? `<p class="grant-status-note">${esc(note)}</p>` : '';
}

// An application is "in flight" for any status the backend's duplicate guard treats as
// open — everything except a final rejection or a completed reimbursement. While one is
// in flight the applicant can't start another, so we hide the form and show a notice.
const TERMINAL = ['rejected', 'reimbursed'];
function hasInflight(list) {
  return Array.isArray(list) && list.some(g => TERMINAL.indexOf(g.status || 'submitted') === -1);
}
// Show the blank form OR the in-progress notice based on whether an application is open.
// Skipped right after an in-session submit so the success message stays put (submittedThisSession).
function applyApplyState(list) {
  const form = document.getElementById('grant-form');
  const notice = document.getElementById('grant-inflight');
  const inflight = hasInflight(list);
  if (form) form.hidden = inflight;
  if (notice) notice.hidden = !inflight;
}

function renderMyGrants(list) {
  const wrap = document.getElementById('my-grants-list');
  if (!wrap) return;
  if (!Array.isArray(list) || list.length === 0) {
    wrap.innerHTML = '<p class="status-empty">You have not submitted any applications yet.</p>';
    return;
  }
  wrap.innerHTML = list.map(g => {
    const date = fmtDate(g.created_at);
    const amount = (g.amount_requested !== null && g.amount_requested !== undefined && g.amount_requested !== '') ? ('$' + esc(g.amount_requested)) : '—';
    const cvHref = safeUrl(g.cv_url);
    const cv = cvHref ? `<a class="grant-cv-link" href="${escAttr(cvHref)}" target="_blank" rel="noopener">View CV →</a>` : '';
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
        ${renderStatusNote(g.status || 'submitted')}
        ${renderReceiptsBlock(g)}
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
      revealFormFallback();
      return;
    }
    const list = await res.json();
    // Only fetch payout readiness when a grant actually needs it (approved or
    // awaiting reimbursement), so the extra call is skipped for everyone else.
    if (Array.isArray(list) && list.some(g => PAYOUT_RELEVANT.indexOf(g.status || '') !== -1)) {
      await loadPayoutStatus();
    }
    renderMyGrants(list);
    // Don't flip the form away right after an in-session submit — keep the success
    // message visible; the in-progress notice takes over on the next page load.
    if (!submittedThisSession) applyApplyState(list);
  } catch (e) {
    if (wrap) wrap.innerHTML = '<p class="status-empty">Could not load your applications right now.</p>';
    revealFormFallback();
  }
}

// If we can't determine the applicant's application state (network/API error), fail open:
// show the blank form so they can still apply. The backend's duplicate guard is the real
// backstop against a second in-flight application.
function revealFormFallback() {
  if (submittedThisSession) return;
  const form = document.getElementById('grant-form');
  const notice = document.getElementById('grant-inflight');
  if (form) form.hidden = false;
  if (notice) notice.hidden = true;
}

// ---- Submit receipts for an approved grant (multipart, multiple files + amount_claimed) ----
const RECEIPT_RE = /\.(pdf|jpe?g|png|heic)$/i;
const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];

async function submitReceipts(el) {
  const grantId = el.dataset.id;
  const msg = document.getElementById(`receipts-msg-${grantId}`);
  const filesInput = document.getElementById(`receipts-files-${grantId}`);
  const amountInput = document.getElementById(`receipts-amount-${grantId}`);
  const files = filesInput && filesInput.files ? Array.from(filesInput.files) : [];

  if (!files.length) return fail(msg, 'Please attach at least one receipt file.');
  if (files.length > 10) return fail(msg, 'Please attach no more than 10 files.');
  for (const f of files) {
    const okType = RECEIPT_TYPES.indexOf(f.type) !== -1 || RECEIPT_RE.test(f.name);
    if (!okType) return fail(msg, `“${f.name}” is not an accepted file type. Use PDF, JPG, PNG or HEIC.`);
    if (f.size > 10 * 1024 * 1024) return fail(msg, `“${f.name}” is larger than 10MB. Please attach smaller files.`);
  }
  const amount = amountInput ? amountInput.value.trim() : '';
  const amt = Number(amount);
  if (!amount || !Number.isFinite(amt) || amt <= 0) {
    return fail(msg, 'Please enter a valid amount claimed in USD.');
  }

  if (!window.JFAuth || !JFAuth.isLoggedIn()) { promptRelogin(); return; }

  const btn = filesInput ? filesInput.closest('.receipts-block').querySelector('.submit-btn') : null;
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
  if (msg) msg.className = 'form-msg';

  // FormData -> multipart/form-data. Do NOT set Content-Type: the browser adds the boundary.
  const fd = new FormData();
  fd.append('amount_claimed', amount);
  files.forEach(f => fd.append('files', f));

  try {
    const res = await fetch(`${API}/my/grants/${encodeURIComponent(grantId)}/receipts`, {
      method: 'POST',
      headers: JFAuth.authHeader(),
      body: fd,
    });
    if (res.status === 401) { promptRelogin(); return; }
    if (res.ok) {
      if (msg) { msg.textContent = 'Receipts received. We will review them and arrange reimbursement.'; msg.className = 'form-msg success'; }
      loadMyGrants();   // re-renders this card into its receipts_submitted state
    } else {
      const data = await res.json().catch(() => ({}));
      fail(msg, data.detail || 'Something went wrong. Please try again or email info@jorgensenfoundation.org.');
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Receipts'; }
    }
  } catch (e) {
    fail(msg, 'Unable to reach the server. Please try again or email info@jorgensenfoundation.org.');
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Receipts'; }
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
  if (status) status.hidden = false;
  // Form vs. in-progress notice is decided by loadMyGrants → applyApplyState once we know
  // whether an application is already in flight; leave the form hidden until then.
  prefillFromMe();
  loadMyGrants();
})();
