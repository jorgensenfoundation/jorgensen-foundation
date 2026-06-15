// Standalone /review page — board-only. Voting contract is identical to the old
// /login #board-review (login.js): GET /board/assignments, POST /board/assignments/{id}/vote
// with body {recommendation, comment} and the user Bearer header. Only the UI is restyled
// (Option 1: compact rows + inline expand). JFAuth (auth.js) is global.

const API = 'https://jorgensen-backend-production.up.railway.app';

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escAttr(value) { return esc(value); }

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
    const amount = (a.amount_requested !== null && a.amount_requested !== undefined && a.amount_requested !== '') ? ('$' + esc(a.amount_requested)) : '—';
    const conf = esc(a.conference_name || 'Conference');
    const date = esc(a.conference_date || '—');
    const location = esc(a.conference_location || '—');
    const status = esc(a.status || 'submitted');
    const cv = a.cv_url ? `<a class="rv-cv" href="${escAttr(a.cv_url)}" target="_blank" rel="noopener">View CV →</a>` : '';
    const voted = a.recommendation;

    // Right-hand cell of the collapsed row: a voted chip OR the status badge.
    const rowState = voted
      ? `<span class="rv-voted"><span class="rv-chip">✓ ${esc(voted)}</span></span>`
      : `<span class="rv-badge rv-badge-${escAttr(status)}">${status}</span>`;

    // Expanded panel action area: recorded vote OR the vote controls.
    const action = voted
      ? `<div class="rv-recorded"><span class="rv-recorded-label">Your recommendation</span>
           <span class="rv-chip rv-chip-${escAttr(voted)}">✓ ${esc(voted)}</span>
           ${a.comment ? `<p class="rv-comment">${esc(a.comment)}</p>` : ''}</div>`
      : `<div class="rv-vote" id="rv-vote-${sid}">
           <div class="rv-vote-btns">
             <button class="rv-vbtn rv-vbtn-app" type="button" data-rec="approve" onclick="pickVote('${sid}', this)">Approve</button>
             <button class="rv-vbtn rv-vbtn-rej" type="button" data-rec="reject" onclick="pickVote('${sid}', this)">Reject</button>
             <button class="rv-vbtn rv-vbtn-abs" type="button" data-rec="abstain" onclick="pickVote('${sid}', this)">Abstain</button>
           </div>
           <textarea class="rv-textarea" id="rv-comment-${sid}" placeholder="Comments (optional) — rationale for your recommendation."></textarea>
           <button class="rv-submit" type="button" onclick="submitVote('${sid}')">Submit Review</button>
           <p class="rv-msg" id="rv-msg-${sid}"></p>
         </div>`;

    return `
      <div class="rv-item">
        <div class="rv-row">
          <div class="rv-title">${conf}</div>
          <div class="rv-applicant">${applicant} · ${institution}</div>
          <div class="rv-amount">${amount}</div>
          <div class="rv-state">${rowState}</div>
          <button class="rv-details" type="button" onclick="toggleDetail('${sid}')">Details ▸</button>
        </div>
        <div class="rv-panel" id="rv-panel-${sid}" hidden>
          <div class="rv-meta"><span><b>Date</b> ${date}</span><span><b>Location</b> ${location}</span><span><b>Amount</b> ${amount}</span>${cv ? `<span>${cv}</span>` : ''}</div>
          ${a.research_description ? `<p class="rv-desc">${esc(a.research_description)}</p>` : ''}
          ${action}
        </div>
      </div>`;
  }).join('');
}

function toggleDetail(id) {
  const panel = document.getElementById(`rv-panel-${id}`);
  if (!panel) return;
  panel.hidden = !panel.hidden;
  const btn = panel.parentElement.querySelector('.rv-details');
  if (btn) btn.textContent = panel.hidden ? 'Details ▸' : 'Close ▾';
}

// Select one of the three recommendations (highlight); the value is read on submit.
function pickVote(id, btn) {
  const box = document.getElementById(`rv-vote-${id}`);
  if (!box) return;
  box.querySelectorAll('.rv-vbtn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

// Same POST contract as login.js submitVote: body {recommendation, comment}, user Bearer.
async function submitVote(id) {
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
      if (msg) { msg.textContent = 'Review submitted.'; msg.className = 'rv-msg success'; }
      loadAssignments();   // refresh — the row re-renders into its voted state
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

// ---- Gate: board members only ----
(function initReview() {
  const gate = document.getElementById('review-gate');
  const content = document.getElementById('review-content');
  const user = (window.JFAuth && JFAuth.isLoggedIn() && JFAuth.getUser && JFAuth.getUser()) || null;
  const isBoard = !!(user && user.is_board_member);
  if (!isBoard) {
    if (gate) gate.hidden = false;
    if (content) content.hidden = true;
    return;
  }
  if (gate) gate.hidden = true;
  if (content) content.hidden = false;
  loadAssignments();
})();
