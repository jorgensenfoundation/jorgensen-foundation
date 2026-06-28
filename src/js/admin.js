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

// Safe for a value placed inside a single-quoted JS string that itself sits in
// an inline on* attribute, e.g. onclick="f('JSATTR(v)')". Escape backslash and
// quote for the JS string FIRST (HTML-encoding alone won't protect it — the
// browser decodes &#39; back to ' before the JS runs), then HTML-encode for the
// attribute. Prevents JS-context breakout.
function jsAttr(value) {
  return esc(String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
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
  loadSupport();
  let saved = 'overview';
  try { saved = sessionStorage.getItem('jf_admin_section') || 'overview'; } catch (e) {}
  showSection(saved);
}

// ============================================================================
// SECTION RAIL + PROGRESS STEPPER (redesign)
// ============================================================================
let supportCounts = {};

// Switch the visible section + active rail item; remember it across refreshes.
function showSection(name) {
  try { sessionStorage.setItem('jf_admin_section', name); } catch (e) {}
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
  else { const o = document.getElementById('section-overview'); if (o) o.classList.add('active'); }
  document.querySelectorAll('.admin-rail .rail-item').forEach(b =>
    b.classList.toggle('active', b.dataset.section === name));
}

// Count chip on a rail item; `alert` tints it amber when there's something to act on.
function setRailCount(name, n, alert) {
  const el = document.getElementById('rail-count-' + name);
  if (!el) return;
  el.textContent = n > 0 ? String(n) : '';
  el.classList.toggle('rail-count--alert', !!alert && n > 0);
}

// Overview "needs your attention" callouts, derived from already-loaded data.
function renderOverviewAttention() {
  const box = document.getElementById('overview-attention');
  if (!box) return;
  const items = [];
  const needsReview = supportCounts.needs_review || 0;
  if (needsReview > 0) {
    items.push(`<div class="attn-item attn-item--alert" onclick="showSection('support')"><span class="attn-dot"></span>${needsReview} support ticket${needsReview > 1 ? 's' : ''} need review<span class="attn-arrow">&rarr;</span></div>`);
  }
  const action = (typeof allGrants !== 'undefined' ? allGrants : []).filter(g => ACTION_STATES.indexOf(g.status) !== -1).length;
  if (action > 0) {
    items.push(`<div class="attn-item attn-item--alert" onclick="showSection('grants')"><span class="attn-dot"></span>${action} grant${action > 1 ? 's' : ''} need action<span class="attn-arrow">&rarr;</span></div>`);
  }
  box.innerHTML = items.length ? items.join('')
    : '<div class="attn-item"><span class="attn-dot"></span>All caught up — nothing needs your attention.</div>';
}

// Generic horizontal progress stepper. steps: labels; currentIndex: active step.
// opts.errorIndex + opts.errorLabel mark a step as terminal-error (rejected) or,
// with opts.hold, a paused state.
function renderStepper(steps, currentIndex, opts) {
  opts = opts || {};
  return '<div class="stepper">' + steps.map((label, i) => {
    let cls, lbl = label;
    if (opts.errorIndex === i) { cls = opts.hold ? 'is-hold' : 'is-error'; if (opts.errorLabel) lbl = opts.errorLabel; }
    else if (i < currentIndex) cls = 'is-done';
    else if (i === currentIndex) cls = 'is-current';
    else cls = 'is-todo';
    const inner = cls === 'is-done' ? '&#10003;' : String(i + 1);
    return `<div class="stepper-step ${cls}"><div class="stepper-dot">${inner}</div><div class="stepper-label">${esc(lbl)}</div></div>`;
  }).join('') + '</div>';
}

function grantStepperHtml(status) {
  const labels = ['Submitted', 'Under review', 'Decision', 'Approved', 'Receipts', 'Reimbursed'];
  if (status === 'rejected') return renderStepper(labels, 2, { errorIndex: 2, errorLabel: 'Rejected' });
  const idx = { submitted: 0, under_review: 1, awaiting_decision: 2, approved: 3, receipts_submitted: 4, reimbursed: 5 };
  return renderStepper(labels, idx[status] !== undefined ? idx[status] : 0, {});
}

function ticketStepperHtml(status) {
  const labels = ['Open', 'Needs review', 'Approved', 'For Claude', 'Fixed', 'Closed'];
  if (status === 'hold') return renderStepper(labels, 2, { errorIndex: 2, errorLabel: 'On hold', hold: true });
  const idx = { bot: 0, needs_review: 1, approved: 2, for_dev: 3, fixed: 4, closed: 5 };
  return renderStepper(labels, idx[status] !== undefined ? idx[status] : 0, {});
}

// ============================================================================
// SUPPORT TICKETS (AI customer-support dashboard)
// ============================================================================
let supportFilter = '';

// Only treat http(s) URLs as linkable. page_url is visitor-supplied, so a
// "javascript:"/"data:" value must never reach an href (XSS). Returns '' if unsafe.
function safeHref(u) {
  return /^https?:\/\//i.test(String(u || '')) ? String(u) : '';
}

const SUPPORT_STATUS_LABEL = {
  bot: 'Bot', needs_review: 'Needs review', approved: 'Approved',
  for_dev: 'For Claude', hold: 'Hold', fixed: 'Fixed', closed: 'Closed',
};

function setSupportFilter(status, btn) {
  supportFilter = status;
  document.querySelectorAll('#support-filters .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadSupport();
}

async function loadSupport() {
  const tbody = document.getElementById('support-table');
  if (!tbody) return;
  try {
    const qs = supportFilter ? `?status=${encodeURIComponent(supportFilter)}` : '';
    const res = await fetch(`${API}/admin/support/tickets${qs}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (handleAuthError(res)) return;
    if (!res.ok) { tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Could not load tickets.</td></tr>'; return; }
    const data = await res.json();
    supportCounts = data.counts || {};
    setRailCount('support', supportCounts.needs_review || 0, true);
    renderOverviewAttention();
    renderSupport(data.tickets || []);
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Could not load tickets.</td></tr>';
  }
}

function renderSupport(tickets) {
  const tbody = document.getElementById('support-table');
  if (!tbody) return;
  if (!tickets.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No tickets.</td></tr>';
    return;
  }
  const fmt = v => v ? new Date(v).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—';
  tbody.innerHTML = tickets.map(t => {
    const status = t.status || 'bot';
    const sev = t.severity || '—';
    const summary = (t.summary || '(no summary yet)');
    const trimmed = summary.length > 70 ? summary.slice(0, 70) + '…' : summary;
    return `<tr>
      <td><span class="sup-badge sup-${escAttr(status)}">${esc(SUPPORT_STATUS_LABEL[status] || status)}</span></td>
      <td><span class="sup-sev sup-sev-${escAttr(sev)}">${esc(sev)}</span></td>
      <td>${esc(t.category || '—')}</td>
      <td>${esc(trimmed)}</td>
      <td>${esc(t.user_email || 'anonymous')}</td>
      <td>${esc(fmt(t.updated_at))}</td>
      <td><button class="filter-btn" onclick="viewTicket('${escAttr(t.id)}')">View</button></td>
    </tr>`;
  }).join('');
}

async function viewTicket(publicId) {
  try {
    const res = await fetch(`${API}/admin/support/tickets/${encodeURIComponent(publicId)}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (handleAuthError(res)) return;
    if (!res.ok) return;
    const t = await res.json();
    openTicketModal(t);
  } catch (e) {}
}

function openTicketModal(t) {
  closeTicketModal();
  const fmt = v => v ? new Date(v).toLocaleString('en-GB', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
  const thread = (t.thread || []).map(m => {
    if (m.role === 'note') {
      return `<div class="sup-msg sup-msg-note"><span class="sup-msg-who">${esc(m.author || 'Note')} · ${esc(fmt(m.created_at))}</span>${esc(m.content)}</div>`;
    }
    const who = m.role === 'user' ? 'Visitor' : 'Assistant';
    return `<div class="sup-msg sup-msg-${escAttr(m.role)}"><span class="sup-msg-who">${esc(who)}</span>${esc(m.content)}</div>`;
  }).join('');

  const statuses = ['needs_review','approved','for_dev','hold','fixed','closed','bot'];
  const options = statuses.map(s => `<option value="${s}"${s===t.status?' selected':''}>${esc(SUPPORT_STATUS_LABEL[s]||s)}</option>`).join('');
  const pid = escAttr(t.id);
  const pidJs = jsAttr(t.id);

  const overlay = document.createElement('div');
  overlay.className = 'sup-modal-overlay';
  overlay.id = 'sup-modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeTicketModal(); };
  overlay.innerHTML = `
    <div class="sup-modal" role="dialog" aria-label="Support ticket">
      <div class="sup-modal-head">
        <div>
          <span class="sup-badge sup-${escAttr(t.status)}">${esc(SUPPORT_STATUS_LABEL[t.status]||t.status)}</span>
          ${t.severity ? `<span class="sup-sev sup-sev-${escAttr(t.severity)}">${esc(t.severity)}</span>` : ''}
          <span class="sup-modal-cat">${esc(t.category || '')}</span>
        </div>
        <button class="sup-modal-close" onclick="closeTicketModal()" aria-label="Close">&times;</button>
      </div>
      <div class="sup-modal-body">
        ${ticketStepperHtml(t.status)}
        ${t.summary ? `<div class="sup-summary"><strong>Summary.</strong> ${esc(t.summary)}</div>` : ''}
        <div class="sup-meta">
          <span>From: <strong>${esc(t.user_email || 'anonymous')}</strong></span>
          ${t.page_url ? (safeHref(t.page_url)
            ? `<span>Page: <a href="${escAttr(safeHref(t.page_url))}" target="_blank" rel="noopener">${esc(t.page_url)}</a></span>`
            : `<span>Page: ${esc(t.page_url)}</span>`) : ''}
        </div>
        <div class="sup-thread">${thread || '<p class="detail-empty">No messages.</p>'}</div>
      </div>
      <div class="sup-modal-foot">
        <button class="sup-claude-btn" onclick="sendToClaude('${pidJs}')">Send to Claude Code &rarr;</button>
        <div class="sup-note-row">
          <input class="search-input" id="sup-note-input" type="text" placeholder="Add a note for the thread…" maxlength="4000">
          <button class="filter-btn" onclick="addTicketNote('${pidJs}')">Add note</button>
        </div>
        <div class="sup-action-row">
          <label>Status
            <select class="search-input" id="sup-status-select" onchange="setTicketStatus('${pidJs}', this.value)">${options}</select>
          </label>
          <button class="sup-delete" onclick="deleteTicket('${pidJs}')">Delete</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

// Build a complete, self-contained case brief (ticket + conversation + who the
// user is) as plain text, prefixed with the /support-queue command, and copy it
// to the clipboard. Ana pastes it into her Claude Code terminal — no password,
// no API call from the terminal. Also flags the ticket "for_dev" for tracking.
function buildCaseBrief(t, user) {
  const lines = [];
  lines.push(`Support ticket ${t.id} — ${t.category || 'support'} / ${t.severity || 'n/a'} (status: ${t.status})`);
  if (t.summary) lines.push(`Summary: ${t.summary}`);
  lines.push(`Visitor: ${t.user_email || 'anonymous (no account)'}`);
  if (t.page_url) lines.push(`Page they were on: ${t.page_url}`);
  lines.push('');
  lines.push('Conversation:');
  (t.thread || []).forEach(m => {
    const who = m.role === 'note' ? `Note (${m.author || 'Ana'})` : (m.role === 'user' ? 'Visitor' : 'Assistant');
    lines.push(`[${who}] ${m.content}`);
  });
  if (user && user.profile) {
    const p = user.profile;
    lines.push('');
    lines.push('About this user:');
    lines.push(`- ${(p.first_name || '') + ' ' + (p.last_name || '')}, ${p.institution || '—'}, ${p.account_type || '—'}; verified ${p.is_verified ? 'yes' : 'no'}; subscription ${p.subscription_status}`);
    lines.push(`- Registered ${p.created_at || '—'}; last login ${p.last_login || 'never'} (${p.login_count} logins)`);
    lines.push(`- They have ${(user.tickets || []).length} ticket(s), ${(user.grants || []).length} grant(s), ${(user.jobs || []).length} job(s).`);
  }
  return lines.join('\n');
}

async function sendToClaude(publicId) {
  try {
    const tRes = await fetch(`${API}/admin/support/tickets/${encodeURIComponent(publicId)}`, { headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (handleAuthError(tRes)) return;
    if (!tRes.ok) return;
    const t = await tRes.json();
    let user = null;
    if (t.user_email) {
      try {
        const uRes = await fetch(`${API}/admin/users/${encodeURIComponent(t.user_email)}/profile`, { headers: { 'Authorization': `Bearer ${adminToken}` } });
        if (uRes.ok) user = await uRes.json();
      } catch (e) {}
    }
    const clip = '/support-queue\n\n' + buildCaseBrief(t, user);
    let copied = false;
    try { await navigator.clipboard.writeText(clip); copied = true; } catch (e) {}
    // Flag for tracking (uses the admin session already in your browser — no password)
    try {
      await fetch(`${API}/admin/support/tickets/${encodeURIComponent(publicId)}/status`, {
        method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`},
        body: JSON.stringify({ status: 'for_dev' }),
      });
    } catch (e) {}
    alert(copied
      ? 'Case copied to your clipboard.\n\nOpen your Claude Code terminal, paste (Cmd+V), and press Enter. It starts with /support-queue and includes the full case.'
      : 'Could not access the clipboard. The case is flagged for Claude — open a ticket and copy its details manually.');
    await viewTicket(publicId);
    loadSupport();
  } catch (e) {}
}

function closeTicketModal() {
  const o = document.getElementById('sup-modal-overlay');
  if (o) o.remove();
}

async function addTicketNote(publicId) {
  const input = document.getElementById('sup-note-input');
  const note = input ? input.value.trim() : '';
  if (!note) return;
  try {
    const res = await fetch(`${API}/admin/support/tickets/${encodeURIComponent(publicId)}/note`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`},
      body: JSON.stringify({ note }),
    });
    if (handleAuthError(res)) return;
    if (res.ok) { await viewTicket(publicId); loadSupport(); }
  } catch (e) {}
}

async function setTicketStatus(publicId, status) {
  try {
    const res = await fetch(`${API}/admin/support/tickets/${encodeURIComponent(publicId)}/status`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`},
      body: JSON.stringify({ status }),
    });
    if (handleAuthError(res)) return;
    if (res.ok) { await viewTicket(publicId); loadSupport(); }
  } catch (e) {}
}

async function deleteTicket(publicId) {
  if (!confirm('Delete this ticket permanently?')) return;
  try {
    const res = await fetch(`${API}/admin/support/tickets/${encodeURIComponent(publicId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (handleAuthError(res)) return;
    if (res.ok) { closeTicketModal(); loadSupport(); }
  } catch (e) {}
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
    setRailCount('users', allUsers.length, false);
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
    setRailCount('grants', allGrants.filter(g => ACTION_STATES.indexOf(g.status) !== -1).length, true);
    renderOverviewAttention();
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
  const fmtDate = v => v ? new Date(v).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—';
  // Receipts (Phase 3): extra field rows shown only when a value exists, plus download links.
  const receipts = Array.isArray(g.receipts) ? g.receipts : [];
  const hasClaim = g.amount_claimed !== null && g.amount_claimed !== undefined && g.amount_claimed !== '';
  const receiptRows = [
    hasClaim ? `<tr><th>Amount claimed</th><td>$${esc(g.amount_claimed)}</td></tr>` : '',
    g.receipts_submitted_at ? `<tr><th>Receipts submitted</th><td>${esc(fmtDate(g.receipts_submitted_at))}</td></tr>` : '',
    g.reimbursed_at ? `<tr><th>Reimbursed</th><td>${esc(fmtDate(g.reimbursed_at))}</td></tr>` : ''
  ].join('');
  const receiptLinks = receipts.length
    ? receipts.map(r => `<a class="cv-link" href="${escAttr(r.download_url)}" target="_blank" rel="noopener">${esc(r.original_filename || 'Receipt')} →</a>`).join('')
    : '<p class="detail-empty">No receipts submitted.</p>';
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

  // Stage gating: reviewers can only be assigned and a decision only made BEFORE a decision exists.
  const preDecision = ['submitted', 'under_review', 'awaiting_decision'].indexOf(status) !== -1;

  // Always-on read-only "Assigned Reviewers" list (votes live in the Reviewers block above).
  const assignedListHtml = reviewers.length
    ? reviewers.map(r => `<div class="assigned-row"><span class="assigned-email">${esc(r.email)}</span><span class="assigned-mark">✓ Assigned</span></div>`).join('')
    : '<p class="detail-empty">No reviewers assigned yet.</p>';

  // Pick-list of board members NOT yet assigned + Assign button — pre-decision only.
  let assignControls = '';
  if (preDecision) {
    const unassigned = boardMembers.filter(m => assignedEmails.indexOf((m.email || '').toLowerCase()) === -1);
    if (!boardMembers.length) {
      assignControls = '<p class="detail-empty">No board members yet — add one below.</p>';
    } else if (!unassigned.length) {
      assignControls = '<p class="detail-empty">All board members are assigned.</p>';
    } else {
      const opts = unassigned.map(m => {
        const email = m.email || '';
        const name = `${esc(m.first_name || '')} ${esc(m.last_name || '')}`.trim();
        return `<label class="assign-opt">
          <input type="checkbox" value="${escAttr(email)}" onchange="syncAssignBtn('${gid}')">
          ${esc(email)}${name ? ` <span class="assign-name">(${name})</span>` : ''}
        </label>`;
      }).join('');
      assignControls = `<div class="assign-list" id="assign-list-${gid}">${opts}</div>
        <button class="refresh-btn" type="button" id="assign-btn-${gid}" onclick="assignReviewers('${gid}')" disabled>Assign</button>`;
    }
  }

  // Decision: Approve/Reject buttons pre-decision; a read-only decision line once decided.
  let decisionHtml;
  if (preDecision) {
    decisionHtml = `
        <span class="detail-label">Decision</span>
        <div class="decide-actions">
          <button class="action-btn action-activate" type="button" onclick="decideGrant('${gid}','approve')">Approve</button>
          <button class="action-btn action-deactivate" type="button" onclick="decideGrant('${gid}','reject')">Reject</button>
        </div>`;
  } else {
    const decided = status === 'rejected' ? 'rejected' : 'approved';
    const decidedLabel = status === 'rejected' ? 'Rejected' : 'Approved';
    decisionHtml = `
        <span class="detail-label">Decision</span>
        <div class="detail-decision">Decision: <span class="badge badge-${decided}">${esc(decidedLabel)}</span></div>`;
  }

  cell.innerHTML = `
    ${grantStepperHtml(status)}
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
        <span class="detail-label">Receipts</span>
        ${receiptRows ? `<table class="detail-fields">${receiptRows}</table>` : ''}
        <div class="receipts-files">${receiptLinks}</div>
        <div class="detail-desc-label">Research description</div>
        <p class="detail-desc">${esc(g.research_description || '—')}</p>
      </div>
      <div class="detail-side">
        <span class="detail-label">Reviewers</span>
        <div class="reviewers-list">${reviewersHtml}</div>

        <span class="detail-label">Assign Reviewers</span>
        <div class="assigned-reviewers">${assignedListHtml}</div>
        ${assignControls}

        ${decisionHtml}
        ${status === 'receipts_submitted' ? `
        <span class="detail-label">Reimbursement</span>
        <div class="decide-actions">
          <button class="action-btn action-activate" type="button" onclick="markReimbursed('${gid}')">Mark Reimbursed</button>
        </div>` : ''}
        <p class="detail-msg" id="detail-msg-${gid}"></p>
      </div>
    </div>`;
}

// Enable the Assign button only once at least one (newly-listed) board member is checked.
function syncAssignBtn(id) {
  const container = document.getElementById(`assign-list-${id}`);
  const btn = document.getElementById(`assign-btn-${id}`);
  if (!container || !btn) return;
  btn.disabled = !container.querySelector('input[type="checkbox"]:checked');
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

async function markReimbursed(id) {
  if (!confirm('Mark this grant as reimbursed? This records that payment has been made.')) return;
  const msg = document.getElementById(`detail-msg-${id}`);
  try {
    const res = await fetch(`${API}/admin/grants/${encodeURIComponent(id)}/mark-reimbursed`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`}
    });
    if (handleAuthError(res)) return;
    if (res.ok) {
      loadGrants();
      loadGrantDetail(id);
    } else {
      const data = await res.json().catch(() => ({}));
      if (msg) { msg.textContent = data.detail || 'Could not mark as reimbursed.'; msg.className = 'detail-msg error'; }
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
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No users found</td></tr>';
    if (more) more.innerHTML = '';
    return;
  }
  const visible = showMoreState.users ? users : users.slice(0, ROW_LIMIT);
  tbody.innerHTML = visible.map(u => {
    const date = u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—';
    const lastLogin = u.last_login ? new Date(u.last_login).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : 'never';
    const isActive = u.subscription_status === 'active';
    return `
      <tr>
        <td><button class="user-name-link" onclick="openUserProfile('${jsAttr(u.email)}')">${esc(u.first_name)} ${esc(u.last_name || '')}</button></td>
        <td>${esc(u.email)}</td>
        <td>${esc(u.institution || '—')}</td>
        <td><span class="badge badge-${escAttr(u.account_type)}">${esc(u.account_type)}</span></td>
        <td><span class="badge ${u.is_verified ? 'badge-verified' : 'badge-unverified'}">${u.is_verified ? 'Verified' : 'Unverified'}</span></td>
        <td><span class="badge ${isActive ? 'badge-active' : 'badge-inactive'}">${isActive ? 'Active' : 'Inactive'}</span></td>
        <td>${esc(lastLogin)}</td>
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

// --- User interaction register (profile modal) -----------------------------
function openUserProfile(email) {
  fetch(`${API}/admin/users/${encodeURIComponent(email)}/profile`, { headers: { 'Authorization': `Bearer ${adminToken}` } })
    .then(r => { if (handleAuthError(r)) return null; return r.ok ? r.json() : null; })
    .then(d => { if (d) renderUserProfileModal(d); })
    .catch(() => {});
}

function closeUserProfile() {
  const o = document.getElementById('usr-modal-overlay');
  if (o) o.remove();
}

function renderUserProfileModal(d) {
  closeUserProfile();
  const p = d.profile;
  const fmt = v => v ? new Date(v).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—';
  const fmtT = v => v ? new Date(v).toLocaleString('en-GB', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
  const facts = [
    ['Institution', p.institution || '—'],
    ['Type', p.account_type || '—'],
    ['Verified', p.is_verified ? 'Yes' : 'No'],
    ['Subscription', p.subscription_status],
    ['Board member', p.is_board_member ? 'Yes' : 'No'],
    ['Newsletter', p.newsletter ? 'Subscribed' : 'No'],
    ['Registered', fmt(p.created_at)],
    ['Last login', p.last_login ? fmt(p.last_login) : 'never'],
    ['Total logins', p.login_count],
  ].map(([k,v]) => `<div class="usr-fact"><span class="usr-fact-k">${esc(k)}</span><span class="usr-fact-v">${esc(String(v))}</span></div>`).join('');

  const timeline = (d.timeline || []).map(e => {
    const click = (e.kind === 'ticket' && e.ref) ? ` onclick="closeUserProfile();viewTicket('${jsAttr(e.ref)}')" style="cursor:pointer"` : '';
    return `<div class="usr-tl-item usr-tl-${escAttr(e.kind)}"${click}><span class="usr-tl-dot"></span><span class="usr-tl-text">${esc(e.text)}</span><span class="usr-tl-date">${esc(fmtT(e.at))}</span></div>`;
  }).join('') || '<p class="detail-empty">No activity yet.</p>';

  const tickets = (d.tickets || []).length
    ? d.tickets.map(t => `<button class="usr-link-row" onclick="closeUserProfile();viewTicket('${jsAttr(t.id)}')"><span class="sup-badge sup-${escAttr(t.status)}">${esc(SUPPORT_STATUS_LABEL[t.status] || t.status)}</span> ${esc(t.summary || t.category || 'Ticket')}</button>`).join('')
    : '<p class="detail-empty">No support tickets.</p>';
  const grants = (d.grants || []).length
    ? d.grants.map(g => `<div class="usr-row"><span class="badge badge-${escAttr(g.status)}">${esc(g.status)}</span> ${esc(g.conference_name || 'Grant')} — $${esc(g.amount_requested || '')}</div>`).join('')
    : '<p class="detail-empty">No grant applications.</p>';
  const jobs = (d.jobs || []).length
    ? d.jobs.map(j => `<div class="usr-row">${esc(j.calculation_type || 'Job')} — ${esc(j.status || '')}</div>`).join('')
    : '<p class="detail-empty">No calculation jobs.</p>';

  const overlay = document.createElement('div');
  overlay.className = 'sup-modal-overlay';
  overlay.id = 'usr-modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeUserProfile(); };
  overlay.innerHTML = `
    <div class="sup-modal usr-modal" role="dialog" aria-label="User profile">
      <div class="sup-modal-head">
        <div><div class="usr-name">${esc(p.first_name)} ${esc(p.last_name)}</div><div class="usr-email">${esc(p.email)}</div></div>
        <button class="sup-modal-close" onclick="closeUserProfile()" aria-label="Close">&times;</button>
      </div>
      <div class="sup-modal-body">
        <div class="usr-facts">${facts}</div>
        <div class="usr-cols">
          <div>
            <span class="detail-label">Support tickets (${(d.tickets || []).length})</span>
            <div class="usr-list">${tickets}</div>
            <span class="detail-label">Grants (${(d.grants || []).length})</span>
            <div class="usr-list">${grants}</div>
            <span class="detail-label">Jobs (${(d.jobs || []).length})</span>
            <div class="usr-list">${jobs}</div>
          </div>
          <div>
            <span class="detail-label">Activity</span>
            <div class="usr-timeline">${timeline}</div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
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
