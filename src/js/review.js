// Standalone /review page — board-only. Voting contract is identical to the old
// /login #board-review (login.js): GET /board/assignments, POST /board/assignments/{id}/vote
// with body {recommendation, comment} and the user Bearer header. Only the UI is restyled
// (Option 1: compact rows + inline expand). JFAuth (auth.js) is global.

const API = window.JF_API;

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escAttr(value) { return esc(value); }
// Only allow http(s) URLs into href — blocks javascript:/data: from a stored cv_url.
function safeUrl(value) {
  if (!value) return '';
  const s = String(value).trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

// The specific application to open on load, from the review email's deep link
// (/review?grant=<id>). Returns the id as a string, or '' if absent/invalid.
function deepLinkGrantId() {
  try {
    const raw = new URLSearchParams(location.search).get('grant');
    return raw && /^\d+$/.test(raw) ? raw : '';
  } catch (e) { return ''; }
}

// User Bearer token (same as login.js reviewAuthHeader).
function reviewAuthHeader() {
  if (window.JFAuth && JFAuth.authHeader) return JFAuth.authHeader();
  return { 'Authorization': 'Bearer ' + sessionStorage.getItem('jf_user_token') };
}
// On an expired/invalid token, clear the session and return home (analog of login.js logout()).
function reviewRelogin() {
  if (window.JFAuth && JFAuth.logout) JFAuth.logout();
  else window.location.href = '/';
}

// At-a-glance eligibility chips derived server-side (a.signals). Tone: `ok`
// (neutral-good), `warn` (worth a second look), plain (informational).
function rvSignals(s) {
  if (!s) return '';
  const chips = [];
  if (s.first_time_applicant) {
    chips.push(['ok', 'First-time applicant']);
  } else {
    const n = s.prior_applications || 0;
    chips.push(['', `Repeat applicant · ${n} prior`]);
    if (s.prior_grants_funded > 0) chips.push(['warn', `Funded before ×${s.prior_grants_funded}`]);
  }
  if (s.other_open_applications > 0) chips.push(['warn', `${s.other_open_applications} other open`]);
  if (s.amount_pct_of_cap != null) {
    const tone = s.at_cap ? 'warn' : '';
    chips.push([tone, s.at_cap ? 'At the $' + (s.cap || 2000) + ' cap' : `${s.amount_pct_of_cap}% of cap`]);
  }
  if (s.account_type) chips.push(['', s.account_type === 'industry' ? 'Industry' : 'Academia']);
  if (!chips.length) return '';
  return `<div class="rv-signals">${chips
    .map(([tone, label]) => `<span class="rv-sig${tone ? ' rv-sig-' + tone : ''}">${esc(label)}</span>`)
    .join('')}</div>`;
}

async function loadAssignments() {
  const wrap = document.getElementById('review-list');
  try {
    const res = await fetch(`${API}/board/assignments`, { headers: reviewAuthHeader() });
    if (res.status === 401) { reviewRelogin(); return; }
    if (!res.ok) {
      if (wrap) wrap.innerHTML = '<p class="rv-empty">Could not load your assignments right now.</p>';
      return;
    }
    const list = await res.json();
    renderAssignments(list);
  } catch (e) {
    if (wrap) wrap.innerHTML = '<p class="rv-empty">Could not load your assignments right now.</p>';
  }
}

function renderAssignments(list) {
  const wrap = document.getElementById('review-list');
  if (!wrap) return;
  if (!Array.isArray(list) || list.length === 0) {
    wrap.innerHTML = '<p class="rv-empty">You have no applications assigned for review.</p>';
    return;
  }
  wrap.innerHTML = list.map(a => {
    const id = a.grant_id != null ? a.grant_id : a.id;
    const sid = escAttr(id);
    const applicant = `${esc(a.first_name || '')} ${esc(a.last_name || '')}`.trim() || '—';
    const institution = esc(a.institution || '—');
    const supervisor = esc(a.supervisor_name || '');
    const amount = (a.amount_requested !== null && a.amount_requested !== undefined && a.amount_requested !== '') ? ('$' + esc(a.amount_requested)) : '—';
    const conf = esc(a.conference_name || 'Conference');
    const date = esc(a.conference_date || '—');
    const location = esc(a.conference_location || '—');
    const status = esc(a.status || 'submitted');
    const cvHref = safeUrl(a.cv_url);
    const cv = cvHref ? `<a class="rv-cv" href="${escAttr(cvHref)}" target="_blank" rel="noopener">View CV →</a>` : '';
    const voted = a.recommendation;
    // "Open" = the pre-decision window where board voting applies (same set admin.js uses).
    // Anything else (approved/rejected/receipts_submitted/reimbursed) is a final decision: no voting.
    const OPEN = ['submitted', 'under_review', 'awaiting_decision'];
    const isOpen = OPEN.indexOf(a.status || 'submitted') !== -1;

    // Right-hand cell of the collapsed row: voted chip (open+voted) else the status/outcome badge.
    const rowState = (isOpen && voted)
      ? `<span class="rv-voted"><span class="rv-chip rv-chip-${escAttr(voted)}">✓ ${esc(voted)}</span></span>`
      : `<span class="rv-badge rv-badge-${escAttr(status)}">${status.replace(/_/g, ' ')}</span>`;

    // Expanded panel action area — three states:
    let action;
    if (!isOpen) {
      // 1) FINAL DECISION — no voting controls; show the outcome read-only.
      action = `<div class="rv-final"><span class="rv-final-label">Decision</span>
           <span class="rv-badge rv-badge-${escAttr(status)}">${status.replace(/_/g, ' ')}</span>
           <span class="rv-final-note">Voting is closed for this application.</span></div>`;
    } else if (voted) {
      // 2) OPEN, already voted — compact recorded chip, no resubmit.
      action = `<div class="rv-recorded"><span class="rv-recorded-label">You voted</span>
           <span class="rv-chip rv-chip-${escAttr(voted)}">✓ ${esc(voted)}</span>
           ${a.comment ? `<p class="rv-comment">${esc(a.comment)}</p>` : ''}</div>`;
    } else {
      // 3) OPEN, not yet voted — the only state with active voting controls.
      action = `<div class="rv-vote" id="rv-vote-${sid}">
           <div class="rv-vote-btns">
             <button class="rv-vbtn rv-vbtn-app" type="button" data-rec="approve" data-action="pickVote" data-id="${sid}">Approve</button>
             <button class="rv-vbtn rv-vbtn-rej" type="button" data-rec="reject" data-action="pickVote" data-id="${sid}">Reject</button>
             <button class="rv-vbtn rv-vbtn-abs" type="button" data-rec="abstain" data-action="pickVote" data-id="${sid}">Abstain</button>
           </div>
           <textarea class="rv-textarea" id="rv-comment-${sid}" placeholder="Comments (optional) — rationale for your recommendation."></textarea>
           <button class="rv-submit" type="button" data-action="submitVote" data-id="${sid}">Submit Review</button>
           <p class="rv-msg" id="rv-msg-${sid}"></p>
         </div>`;
    }

    return `
      <div class="rv-item">
        <div class="rv-row">
          <div class="rv-title">${conf}</div>
          <div class="rv-applicant">${applicant} · ${institution}</div>
          <div class="rv-amount">${amount}</div>
          <div class="rv-state">${rowState}</div>
          <button class="rv-details" type="button" data-action="toggleDetail" data-id="${sid}">Details ▸</button>
        </div>
        <div class="rv-panel" id="rv-panel-${sid}" hidden>
          <div class="rv-applicant-card">
            <span class="rv-ac-label">Applicant</span>
            <p class="rv-ac-name">${applicant}</p>
            <p class="rv-ac-inst">${institution}${supervisor ? ` · Supervisor: ${supervisor}` : ''}</p>
          </div>
          <div class="rv-meta"><span><b>Date</b> ${date}</span><span><b>Location</b> ${location}</span><span><b>Amount</b> ${amount}</span></div>
          ${rvSignals(a.signals)}
          <div class="rv-docs">${cv || '<span class="rv-nocv">No CV attached to this application.</span>'}</div>
          ${a.research_description ? `<div class="rv-story"><span class="rv-story-label">Research summary</span><p class="rv-desc">${esc(a.research_description)}</p></div>` : '<p class="rv-nocv">No research summary provided.</p>'}
          ${action}
        </div>
      </div>`;
  }).join('');
  autoExpand(list);
}

// Open the deep-linked application (from the review email) automatically, or — when a
// reviewer has just one thing assigned — open that, so they see the full applicant
// details and voting controls without first hunting for a "Details" toggle.
function autoExpand(list) {
  let targetId = deepLinkGrantId();
  if (!targetId && Array.isArray(list) && list.length === 1) {
    const only = list[0];
    targetId = String(only.grant_id != null ? only.grant_id : only.id);
  }
  if (!targetId) return;
  const panel = document.getElementById(`rv-panel-${targetId}`);
  if (!panel) return;
  panel.hidden = false;
  const item = panel.parentElement;
  const btn = item ? item.querySelector('.rv-details') : null;
  if (btn) btn.textContent = 'Close ▾';
  if (item && item.scrollIntoView) {
    try { item.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { item.scrollIntoView(); }
  }
}

function toggleDetail(el) {
  const id = el.dataset.id;
  const panel = document.getElementById(`rv-panel-${id}`);
  if (!panel) return;
  panel.hidden = !panel.hidden;
  const btn = panel.parentElement.querySelector('.rv-details');
  if (btn) btn.textContent = panel.hidden ? 'Details ▸' : 'Close ▾';
}

// Select one of the three recommendations (highlight); the value is read on submit.
function pickVote(el) {
  const box = document.getElementById(`rv-vote-${el.dataset.id}`);
  if (!box) return;
  box.querySelectorAll('.rv-vbtn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

// Same POST contract as login.js submitVote: body {recommendation, comment}, user Bearer.
async function submitVote(el) {
  const id = el.dataset.id;
  const msg = document.getElementById(`rv-msg-${id}`);
  const picked = document.querySelector(`#rv-vote-${id} .rv-vbtn.selected`);
  if (!picked) {
    if (msg) { msg.textContent = 'Please choose a recommendation before submitting.'; msg.className = 'rv-msg error'; }
    return;
  }
  const recommendation = picked.dataset.rec;
  const commentEl = document.getElementById(`rv-comment-${id}`);
  const comment = commentEl ? commentEl.value.trim() : '';
  const btn = document.querySelector(`#rv-vote-${id} .rv-submit`);
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
  if (msg) msg.className = 'rv-msg';
  try {
    const res = await fetch(`${API}/board/assignments/${encodeURIComponent(id)}/vote`, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, reviewAuthHeader()),
      body: JSON.stringify({ recommendation, comment })
    });
    if (res.status === 401) { reviewRelogin(); return; }
    if (res.ok) {
      // End on a thank-you (with a clear exit) rather than silently re-rendering the row.
      const item = el.closest ? el.closest('.rv-item') : null;
      const titleEl = item ? item.querySelector('.rv-title') : null;
      showThankYou(titleEl ? titleEl.textContent : '', recommendation);
    } else {
      const data = await res.json().catch(() => ({}));
      if (msg) { msg.textContent = data.detail || 'Could not submit your review. Please try again.'; msg.className = 'rv-msg error'; }
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Review'; }
    }
  } catch (e) {
    if (msg) { msg.textContent = 'Connection error. Please try again.'; msg.className = 'rv-msg error'; }
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Review'; }
  }
}

// Confirmation shown once a vote is recorded: a thank-you plus a clear way out
// (dashboard) and a way back to any remaining assigned reviews.
function showThankYou(confName, recommendation) {
  const content = document.getElementById('review-content');
  const label = content ? content.querySelector('.rv-label') : null;
  if (label) label.hidden = true;
  const wrap = document.getElementById('review-list');
  if (!wrap) return;
  const rec = esc(recommendation || '');
  const conf = esc((confName || '').trim() || 'this application');
  wrap.innerHTML = `
    <div class="rv-thanks" role="status">
      <div class="rv-thanks-check" aria-hidden="true">✓</div>
      <h2 class="rv-thanks-title">Thank you — your review is recorded.</h2>
      <p class="rv-thanks-body">Your recommendation${rec ? ` to <strong>${rec}</strong>` : ''} for <strong>${conf}</strong> has been sent to the board. We appreciate you taking the time.</p>
      <div class="rv-thanks-actions">
        <button class="rv-thanks-btn rv-thanks-primary" type="button" data-action="reviewGoDashboard">Go to Dashboard</button>
        <button class="rv-thanks-btn rv-thanks-ghost" type="button" data-action="reviewAnother">Back to reviews</button>
      </div>
    </div>`;
  if (wrap.scrollIntoView) { try { wrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
}

function reviewGoDashboard() { window.location.href = '/dashboard'; }

function reviewAnother() {
  const content = document.getElementById('review-content');
  const label = content ? content.querySelector('.rv-label') : null;
  if (label) label.hidden = false;
  const wrap = document.getElementById('review-list');
  if (wrap) wrap.innerHTML = '<p class="rv-empty">Loading your assigned applications…</p>';
  loadAssignments();
}

// ---- Gate: board members only ----
(function initReview() {
  const gate = document.getElementById('review-gate');
  const content = document.getElementById('review-content');
  const loggedIn = !!(window.JFAuth && JFAuth.isLoggedIn());
  const user = (loggedIn && JFAuth.getUser && JFAuth.getUser()) || null;
  const isBoard = !!(user && user.is_board_member);

  // Not signed in → bounce through login carrying the current deep link, so a board
  // member from a review email lands right back on this application after one sign-in.
  if (!loggedIn) {
    const next = location.pathname + location.search;
    window.location.replace('/login?next=' + encodeURIComponent(next));
    return;
  }
  // Signed in but not a board member — this page isn't for them.
  if (!isBoard) {
    if (gate) gate.hidden = false;
    if (content) content.hidden = true;
    return;
  }
  if (gate) gate.hidden = true;
  if (content) content.hidden = false;
  loadAssignments();
})();
