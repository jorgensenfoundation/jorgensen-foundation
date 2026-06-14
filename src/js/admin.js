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

function togglePasswordVisibility() {
  const input = document.getElementById('admin-password');
  const btn = document.getElementById('admin-show-btn');
  if (input.type === 'password') { input.type = 'text'; btn.textContent = 'HIDE'; }
  else { input.type = 'password'; btn.textContent = 'SHOW'; }
}

const API = 'https://jorgensen-backend-production.up.railway.app';
let adminToken = '';
let allUsers = [];
let allGrants = [];
let boardMembers = [];
let currentFilter = 'all';

// --- Per-table "show 10, then Show more / Show less" -----------------------------
const ROW_LIMIT = 10;
// Independent expanded state per table (false = collapsed to first 10).
const showMoreState = { users: false, grants: false, newsletter: false, board: false };

// Build the show-more/less button for a table; '' when the (filtered) set is <= 10 rows.
function showMoreBtn(key, total) {
  if (total <= ROW_LIMIT) return '';
  const label = showMoreState[key]
    ? 'Show less'
    : `Show more (${total - ROW_LIMIT} more)`;
  return `<button class="show-more-btn" type="button" onclick="toggleShowMore('${key}')">${label}</button>`;
}

// Toggle a table's expanded state, then re-derive its rows through the SAME path
// (filter → render) so the search filter and any sort are preserved.
function toggleShowMore(key) {
  showMoreState[key] = !showMoreState[key];
  if (key === 'users') filterUsers();
  else if (key === 'grants') filterGrants();
  else if (key === 'newsletter') filterNewsletter();
  else if (key === 'board') renderBoardMembers(boardMembers);
}

function showDashboard() {
  document.getElementById('login-wrap').style.display = 'none';
  document.getElementById('admin-dashboard').classList.add('active');
  document.getElementById('nav-logout').style.display = 'inline';
  loadUsers();
  loadNewsletter();
  loadGrants();
  loadBoardMembers();
}

// If a token-protected call returns 401 (expired/invalid token after the 8h TTL),
// clear the stored token and return to the login screen to re-prompt for the password.
function handleAuthError(res) {
  if (res.status === 401) { logout(); return true; }
  return false;
}

async function adminLogin() {
  const password = document.getElementById('admin-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  errorEl.classList.remove('show');
  if (!password) {
    errorEl.textContent = 'Please enter the admin password.';
    errorEl.classList.add('show'); return;
  }
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  try {
    const res = await fetch(`${API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: password })
    });
    if (!res.ok) {
      errorEl.textContent = 'Invalid admin password.';
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }
    const data = await res.json();
    adminToken = data.token;
    sessionStorage.setItem('jf_admin_token', adminToken);
    showDashboard();
  } catch(e) {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function loadUsers() {
  try {
    const res = await fetch(`${API}/admin/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!res.ok) { logout(); return; }
    allUsers = await res.json();
    updateStats(allUsers);
    filterUsers();
  } catch(e) {
    console.error('Failed to load users', e);
  }
}

function updateStats(users) {
  document.getElementById('stat-total').textContent = users.length;
  document.getElementById('stat-active').textContent = users.filter(u => u.subscription_status === 'active').length;
  document.getElementById('stat-academia').textContent = users.filter(u => u.account_type === 'academia').length;
  document.getElementById('stat-industry').textContent = users.filter(u => u.account_type === 'industry').length;
}

let allNewsletter = [];

async function loadNewsletter() {
  try {
    const res = await fetch(`${API}/admin/newsletter`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (handleAuthError(res)) return;
    if (!res.ok) return;
    allNewsletter = await res.json();
    document.getElementById('stat-newsletter').textContent = allNewsletter.length;
    filterNewsletter();
  } catch(e) {
    console.error('Failed to load newsletter subscribers', e);
  }
}

function filterNewsletter() {
  const search = document.getElementById('newsletter-search').value.toLowerCase();
  const filtered = !search ? allNewsletter : allNewsletter.filter(s =>
    (s.email || '').toLowerCase().includes(search)
  );
  renderNewsletter(filtered);
}

function renderNewsletter(subscribers) {
  const tbody = document.getElementById('newsletter-table');
  const more = document.getElementById('newsletter-more');
  if (!subscribers.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No subscribers found</td></tr>';
    if (more) more.innerHTML = '';
    return;
  }
  const visible = showMoreState.newsletter ? subscribers : subscribers.slice(0, ROW_LIMIT);
  tbody.innerHTML = visible.map((s, i) => {
    const date = s.subscribed_at ? new Date(s.subscribed_at).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—';
    return `
      <tr>
        <td style="color:#ccc">${i + 1}</td>
        <td><a href="mailto:${escAttr(s.email)}" style="color:#1a1510;border-bottom:1px solid #e8e0d0">${esc(s.email)}</a></td>
        <td>${esc(date)}</td>
      </tr>
    `;
  }).join('');
  if (more) more.innerHTML = showMoreBtn('newsletter', subscribers.length);
}

async function loadGrants() {
  try {
    const res = await fetch(`${API}/admin/grants`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (handleAuthError(res)) return;
    if (!res.ok) return;
    allGrants = await res.json();
    document.getElementById('stat-grants').textContent = allGrants.length;
    filterGrants();
  } catch(e) {
    console.error('Failed to load grants', e);
  }
}

// Grant lifecycle ordering for the table (lower sorts higher); unknown/missing sinks last.
const STATUS_ORDER = {
  receipts_submitted: 1,
  submitted: 2,
  awaiting_decision: 3,
  under_review: 4,
  approved: 5,
  reimbursed: 6,
  rejected: 7
};
// Short "what happens next" hint per status.
const NEXT_ACTION = {
  receipts_submitted: 'Verify & reimburse',
  submitted: 'Assign reviewers',
  awaiting_decision: 'Make decision',
  under_review: 'Awaiting board votes',
  approved: 'Awaiting receipts',
  reimbursed: 'Complete',
  rejected: 'Closed — not funded'
};
// Statuses that need the admin to act (emphasized) vs waiting (muted, e.g. under_review/approved)
// vs terminal (done). Anything not action/done — including approved and unknown — uses the wait style.
const ACTION_STATES = ['receipts_submitted', 'submitted', 'awaiting_decision'];
const DONE_STATES = ['reimbursed', 'rejected'];
function nextActionClass(status) {
  if (ACTION_STATES.indexOf(status) !== -1) return 'next-action--action';
  if (DONE_STATES.indexOf(status) !== -1) return 'next-action--done';
  return 'next-action--wait';
}

function filterGrants() {
  const search = document.getElementById('grants-search').value.toLowerCase();
  const filtered = !search ? allGrants : allGrants.filter(g =>
    (g.email || '').toLowerCase().includes(search) ||
    (g.first_name || '').toLowerCase().includes(search) ||
    (g.last_name || '').toLowerCase().includes(search) ||
    (g.institution || '').toLowerCase().includes(search) ||
    (g.conference_name || '').toLowerCase().includes(search)
  );
  renderGrants(filtered);
}

function renderGrants(grants) {
  const tbody = document.getElementById('grants-table');
  const more = document.getElementById('grants-more');
  if (!grants.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No applications found</td></tr>';
    if (more) more.innerHTML = '';
    return;
  }
  // Sort a COPY (never mutate allGrants): by lifecycle stage, then newest-first within a stage.
  const sorted = grants.slice().sort((a, b) => {
    const oa = STATUS_ORDER[a.status] || 99;
    const ob = STATUS_ORDER[b.status] || 99;
    if (oa !== ob) return oa - ob;
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;   // newest first within the same status
  });
  // 10-row limit applies AFTER sorting, counting DATA rows (detail rows don't count).
  const visible = showMoreState.grants ? sorted : sorted.slice(0, ROW_LIMIT);
  tbody.innerHTML = visible.map((g) => {
    const status = g.status || 'submitted';
    const naText = NEXT_ACTION[status] || '—';
    const naClass = nextActionClass(status);
    const gid = escAttr(g.id);   // g.id (not the row index) drives all detail/action calls
    return `
      <tr>
        <td>${esc(g.first_name)} ${esc(g.last_name)}</td>
        <td>${esc(g.institution || '—')}</td>
        <td>${esc(g.supervisor_name || '—')}</td>
        <td style="white-space:nowrap">$${esc(g.amount_requested || '—')}</td>
        <td><span class="badge badge-${escAttr(status)}">${esc(status)}</span></td>
        <td><span class="next-action ${naClass}">${esc(naText)}</span></td>
        <td><button class="action-btn action-details" onclick="toggleDetail('${gid}')">Details</button></td>
      </tr>
      <tr class="detail-row" id="detail-${gid}" hidden>
        <td colspan="7"><div class="detail-panel" id="detail-cell-${gid}">Loading…</div></td>
      </tr>
    `;
  }).join('');
  if (more) more.innerHTML = showMoreBtn('grants', sorted.length);
}

// --- Inline grant detail panel (board votes) + assign/decide controls ---------
function toggleDetail(id) {
  const row = document.getElementById(`detail-${id}`);
  if (!row) return;
  const opening = row.hidden;
  row.hidden = !row.hidden;
  if (opening && row.dataset.loaded !== 'true') {
    row.dataset.loaded = 'true';
    loadGrantDetail(id);
  }
}

async function loadGrantDetail(id) {
  const cell = document.getElementById(`detail-cell-${id}`);
  if (!cell) return;
  try {
    const res = await fetch(`${API}/admin/grants/${encodeURIComponent(id)}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (handleAuthError(res)) return;
    if (!res.ok) { cell.innerHTML = '<p class="detail-empty">Could not load this application.</p>'; return; }
    const g = await res.json();
    await loadBoardMembers();   // ensure the assign list is populated/cached
    renderGrantDetail(id, g);
  } catch (e) {
    cell.innerHTML = '<p class="detail-empty">Could not load this application.</p>';
  }
}

function renderGrantDetail(id, g) {
  const cell = document.getElementById(`detail-cell-${id}`);
  if (!cell) return;
  const gid = escAttr(id);
  const status = g.status || 'submitted';
  const date = g.created_at ? new Date(g.created_at).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—';
  const cv = g.cv_url ? `<a href="${escAttr(g.cv_url)}" target="_blank" rel="noopener" class="cv-link">View CV →</a>` : '—';
  const reviewers = Array.isArray(g.reviewers) ? g.reviewers : [];
  const assignedEmails = reviewers.map(r => (r.email || '').toLowerCase());

  const reviewersHtml = reviewers.length ? reviewers.map(r => {
    const rec = r.recommendation
      ? `<span class="badge badge-vote-${escAttr(r.recommendation)}">${esc(r.recommendation)}</span>`
      : '<span class="vote-pending">not yet voted</span>';
    const votedAt = r.voted_at ? new Date(r.voted_at).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '';
    return `<div class="reviewer-row">
        <div class="reviewer-email">${esc(r.email)}</div>
        <div class="reviewer-vote">${rec}${votedAt ? `<span class="reviewer-date">${esc(votedAt)}</span>` : ''}</div>
        ${r.comment ? `<p class="reviewer-comment">${esc(r.comment)}</p>` : ''}
      </div>`;
  }).join('') : '<p class="detail-empty">No reviewers assigned yet.</p>';

  const assignOptions = boardMembers.length ? boardMembers.map(m => {
    const email = m.email || '';
    const already = assignedEmails.indexOf(email.toLowerCase()) !== -1;
    const name = `${esc(m.first_name || '')} ${esc(m.last_name || '')}`.trim();
    return `<label class="assign-opt">
        <input type="checkbox" value="${escAttr(email)}"${already ? ' checked disabled' : ''}>
        ${esc(email)}${name ? ` <span class="assign-name">(${name})</span>` : ''}
      </label>`;
  }).join('') : '<p class="detail-empty">No board members yet — add one below.</p>';

  cell.innerHTML = `
    <div class="detail-grid">
      <div class="detail-main">
        <span class="detail-label">Application</span>
        <div class="detail-status">Status: <span class="badge badge-${escAttr(status)}">${esc(status)}</span></div>
        <table class="detail-fields">
          <tr><th>Applicant</th><td>${esc(g.first_name)} ${esc(g.last_name)}</td></tr>
          <tr><th>Email</th><td>${esc(g.email || g.user_email || '—')}</td></tr>
          <tr><th>Institution</th><td>${esc(g.institution || '—')}</td></tr>
          <tr><th>Supervisor</th><td>${esc(g.supervisor_name || '—')}</td></tr>
          <tr><th>Conference</th><td>${esc(g.conference_name || '—')}</td></tr>
          <tr><th>Dates</th><td>${esc(g.conference_date || '—')}</td></tr>
          <tr><th>Location</th><td>${esc(g.conference_location || '—')}</td></tr>
          <tr><th>Amount</th><td>$${esc(g.amount_requested || '—')}</td></tr>
          <tr><th>Submitted</th><td>${esc(date)}</td></tr>
          <tr><th>CV</th><td>${cv}</td></tr>
        </table>
        <div class="detail-desc-label">Research description</div>
        <p class="detail-desc">${esc(g.research_description || '—')}</p>
      </div>
      <div class="detail-side">
        <span class="detail-label">Reviewers</span>
        <div class="reviewers-list">${reviewersHtml}</div>

        <span class="detail-label">Assign reviewers</span>
        <div class="assign-list" id="assign-list-${gid}">${assignOptions}</div>
        <button class="refresh-btn" type="button" onclick="assignReviewers('${gid}')">Assign</button>

        <span class="detail-label">Decision</span>
        <div class="decide-actions">
          <button class="action-btn action-activate" type="button" onclick="decideGrant('${gid}','approve')">Approve</button>
          <button class="action-btn action-deactivate" type="button" onclick="decideGrant('${gid}','reject')">Reject</button>
        </div>
        <p class="detail-msg" id="detail-msg-${gid}"></p>
      </div>
    </div>`;
}

async function assignReviewers(id) {
  const msg = document.getElementById(`detail-msg-${id}`);
  const container = document.getElementById(`assign-list-${id}`);
  if (!container) return;
  const emails = Array.from(container.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)')).map(cb => cb.value);
  if (!emails.length) {
    if (msg) { msg.textContent = 'Select at least one board member to assign.'; msg.className = 'detail-msg error'; }
    return;
  }
  try {
    const res = await fetch(`${API}/admin/grants/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`},
      body: JSON.stringify({ emails })
    });
    if (handleAuthError(res)) return;
    if (res.ok) {
      loadGrants();          // refresh the status badge in the main table (assign sets under_review)
      loadGrantDetail(id);   // refresh this panel's reviewer list
    } else {
      const data = await res.json().catch(() => ({}));
      if (msg) { msg.textContent = data.detail || 'Could not assign reviewers.'; msg.className = 'detail-msg error'; }
    }
  } catch (e) {
    if (msg) { msg.textContent = 'Connection error. Please try again.'; msg.className = 'detail-msg error'; }
  }
}

async function decideGrant(id, decision) {
  const verb = decision === 'approve' ? 'Approve' : 'Reject';
  if (!confirm(`${verb} this application? This records the board's decision.`)) return;
  const msg = document.getElementById(`detail-msg-${id}`);
  try {
    const res = await fetch(`${API}/admin/grants/${encodeURIComponent(id)}/decide`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`},
      body: JSON.stringify({ decision })
    });
    if (handleAuthError(res)) return;
    if (res.ok) {
      loadGrants();
      loadGrantDetail(id);
    } else {
      const data = await res.json().catch(() => ({}));
      if (msg) { msg.textContent = data.detail || 'Could not record the decision.'; msg.className = 'detail-msg error'; }
    }
  } catch (e) {
    if (msg) { msg.textContent = 'Connection error. Please try again.'; msg.className = 'detail-msg error'; }
  }
}

// --- Board members --------------------------------------------------------------
async function loadBoardMembers() {
  try {
    const res = await fetch(`${API}/admin/board-members`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (handleAuthError(res)) return;
    if (!res.ok) return;
    boardMembers = await res.json();
    renderBoardMembers(boardMembers);
  } catch (e) {
    console.error('Failed to load board members', e);
  }
}

function renderBoardMembers(members) {
  const tbody = document.getElementById('board-members-table');
  const more = document.getElementById('board-more');
  if (!tbody) return;
  if (!Array.isArray(members) || !members.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No board members yet</td></tr>';
    if (more) more.innerHTML = '';
    return;
  }
  const visible = showMoreState.board ? members : members.slice(0, ROW_LIMIT);
  tbody.innerHTML = visible.map(m => `
      <tr>
        <td>${esc(m.email)}</td>
        <td>${esc(m.first_name || '—')}</td>
        <td>${esc(m.last_name || '—')}</td>
        <td><button class="action-btn action-deactivate" onclick="removeBoardMember('${escAttr(m.email)}')">Remove</button></td>
      </tr>`).join('');
  if (more) more.innerHTML = showMoreBtn('board', members.length);
}

async function inviteBoardMember() {
  const input = document.getElementById('board-email');
  const msg = document.getElementById('board-msg');
  const email = input ? input.value.trim() : '';
  if (!email) {
    if (msg) { msg.textContent = 'Enter an email address.'; msg.className = 'board-msg error'; }
    return;
  }
  try {
    const res = await fetch(`${API}/admin/invite-board-member`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`},
      body: JSON.stringify({ email })
    });
    if (handleAuthError(res)) return;
    if (res.ok) {
      if (msg) { msg.textContent = 'Board member invited.'; msg.className = 'board-msg success'; }
      input.value = '';
      loadBoardMembers();
    } else {
      const data = await res.json().catch(() => ({}));
      if (msg) { msg.textContent = data.detail || 'Could not invite board member.'; msg.className = 'board-msg error'; }
    }
  } catch (e) {
    if (msg) { msg.textContent = 'Connection error. Please try again.'; msg.className = 'board-msg error'; }
  }
}

async function removeBoardMember(email) {
  if (!confirm(`Remove ${email} as a board member? They keep their account.`)) return;
  const msg = document.getElementById('board-msg');
  try {
    const res = await fetch(`${API}/admin/remove-board-member`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`},
      body: JSON.stringify({ email })
    });
    if (handleAuthError(res)) return;
    if (res.ok) {
      if (msg) { msg.textContent = 'Board member removed.'; msg.className = 'board-msg success'; }
      loadBoardMembers();
    } else {
      const data = await res.json().catch(() => ({}));
      if (msg) { msg.textContent = data.detail || 'Could not remove board member.'; msg.className = 'board-msg error'; }
    }
  } catch (e) {
    if (msg) { msg.textContent = 'Connection error. Please try again.'; msg.className = 'board-msg error'; }
  }
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterUsers();
}

function filterUsers() {
  const search = document.getElementById('search').value.toLowerCase();
  let filtered = allUsers.filter(u => {
    const matchSearch = !search ||
      (u.email || '').toLowerCase().includes(search) ||
      (u.first_name || '').toLowerCase().includes(search) ||
      (u.last_name || '').toLowerCase().includes(search) ||
      (u.institution || '').toLowerCase().includes(search);
    const matchFilter =
      currentFilter === 'all' ||
      (currentFilter === 'academia' && u.account_type === 'academia') ||
      (currentFilter === 'industry' && u.account_type === 'industry') ||
      (currentFilter === 'active' && u.subscription_status === 'active') ||
      (currentFilter === 'inactive' && u.subscription_status !== 'active');
    return matchSearch && matchFilter;
  });
  renderUsers(filtered);
}

function renderUsers(users) {
  const tbody = document.getElementById('users-table');
  const more = document.getElementById('users-more');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No users found</td></tr>';
    if (more) more.innerHTML = '';
    return;
  }
  const visible = showMoreState.users ? users : users.slice(0, ROW_LIMIT);
  tbody.innerHTML = visible.map(u => {
    const date = u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—';
    const isActive = u.subscription_status === 'active';
    return `
      <tr>
        <td>${esc(u.first_name)} ${esc(u.last_name || '—')}</td>
        <td>${esc(u.email)}</td>
        <td>${esc(u.institution || '—')}</td>
        <td><span class="badge badge-${escAttr(u.account_type)}">${esc(u.account_type)}</span></td>
        <td><span class="badge ${u.is_verified ? 'badge-verified' : 'badge-unverified'}">${u.is_verified ? 'Verified' : 'Unverified'}</span></td>
        <td><span class="badge ${isActive ? 'badge-active' : 'badge-inactive'}">${isActive ? 'Active' : 'Inactive'}</span></td>
        <td>${esc(date)}</td>
        <td>
          ${isActive
            ? `<button class="action-btn action-deactivate" onclick="deactivateUser('${escAttr(u.email)}')">Deactivate</button>`
            : `<button class="action-btn action-activate" onclick="activateUser('${escAttr(u.email)}')">Activate</button>`
          }
          <button class="action-btn" onclick="deleteUser('${escAttr(u.email)}')" style="border-color:#e74c3c;color:#e74c3c;margin-left:0.4rem">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
  if (more) more.innerHTML = showMoreBtn('users', users.length);
}

async function activateUser(email) {
  try {
    const res = await fetch(`${API}/admin/activate`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`},
      body: JSON.stringify({email})
    });
    if (handleAuthError(res)) return;
    if (res.ok) loadUsers();
  } catch(e) { console.error(e); }
}

async function deleteUser(email) {
  if (!confirm(`Permanently delete ${email}? This cannot be undone.`)) return;
  try {
    const res = await fetch(`${API}/admin/delete-user`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`},
      body: JSON.stringify({email})
    });
    if (handleAuthError(res)) return;
    if (res.ok) loadUsers();
  } catch(e) { console.error(e); }
}

async function deactivateUser(email) {
  if (!confirm(`Deactivate ${email}?`)) return;
  try {
    const res = await fetch(`${API}/admin/deactivate`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`},
      body: JSON.stringify({email})
    });
    if (handleAuthError(res)) return;
    if (res.ok) loadUsers();
  } catch(e) { console.error(e); }
}

function logout() {
  sessionStorage.removeItem('jf_admin_token');
  adminToken = '';
  document.getElementById('login-wrap').style.display = 'flex';
  document.getElementById('admin-dashboard').classList.remove('active');
  document.getElementById('nav-logout').style.display = 'none';
  document.getElementById('admin-password').value = '';
}

// Check existing session
const saved = sessionStorage.getItem('jf_admin_token');
if (saved) {
  adminToken = saved;
  showDashboard();
}
