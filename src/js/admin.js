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
let currentFilter = 'all';

function showDashboard() {
  document.getElementById('login-wrap').style.display = 'none';
  document.getElementById('admin-dashboard').classList.add('active');
  document.getElementById('nav-logout').style.display = 'inline';
  loadUsers();
  loadNewsletter();
  loadGrants();
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
    const res = await fetch(`${API}/admin/users`, {
      headers: { 'Authorization': `Bearer ${password}` }
    });
    if (!res.ok) {
      errorEl.textContent = 'Invalid admin password.';
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }
    adminToken = password;
    sessionStorage.setItem('jf_admin_token', adminToken);
    const data = await res.json();
    allUsers = data;
    showDashboard();
    renderUsers(allUsers);
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
  if (!subscribers.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No subscribers found</td></tr>';
    return;
  }
  tbody.innerHTML = subscribers.map((s, i) => {
    const date = s.subscribed_at ? new Date(s.subscribed_at).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—';
    return `
      <tr>
        <td style="color:#ccc">${i + 1}</td>
        <td><a href="mailto:${escAttr(s.email)}" style="color:#1a1510;border-bottom:1px solid #e8e0d0">${esc(s.email)}</a></td>
        <td>${esc(date)}</td>
      </tr>
    `;
  }).join('');
}

async function loadGrants() {
  try {
    const res = await fetch(`${API}/admin/grants`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!res.ok) return;
    allGrants = await res.json();
    document.getElementById('stat-grants').textContent = allGrants.length;
    filterGrants();
  } catch(e) {
    console.error('Failed to load grants', e);
  }
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
  if (!grants.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No applications found</td></tr>';
    return;
  }
  tbody.innerHTML = grants.map((g, i) => {
    const date = g.created_at ? new Date(g.created_at).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—';
    const desc = g.research_description || '';
    const short = desc.length > 120 ? desc.slice(0, 120) + '…' : desc;
    const hasMore = desc.length > 120;
    return `
      <tr>
        <td>${esc(g.first_name)} ${esc(g.last_name)}</td>
        <td><a href="mailto:${escAttr(g.email)}" style="color:#1a1510;border-bottom:1px solid #e8e0d0">${esc(g.email)}</a></td>
        <td>${esc(g.institution || '—')}</td>
        <td>${esc(g.supervisor_name || '—')}</td>
        <td style="min-width:160px">${esc(g.conference_name || '—')}<br><span style="font-size:0.62rem;color:#aaa">${esc(g.conference_date)} · ${esc(g.conference_location)}</span></td>
        <td style="white-space:nowrap">$${esc(g.amount_requested || '—')}</td>
        <td style="white-space:nowrap">${esc(date)}</td>
        <td style="min-width:200px;max-width:280px">
          <span class="desc-short" id="desc-short-${i}">${esc(short)}</span>
          <span class="desc-full" id="desc-full-${i}">${esc(desc)}</span>
          ${hasMore ? `<button class="desc-toggle" onclick="toggleDesc(${i})">Show more</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

function toggleDesc(i) {
  const s = document.getElementById(`desc-short-${i}`);
  const f = document.getElementById(`desc-full-${i}`);
  const btn = s.parentElement.querySelector('.desc-toggle');
  const expanded = f.style.display === 'inline';
  s.style.display = expanded ? 'inline' : 'none';
  f.style.display = expanded ? 'none' : 'inline';
  btn.textContent = expanded ? 'Show more' : 'Show less';
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
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No users found</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => {
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
}

async function activateUser(email) {
  try {
    const res = await fetch(`${API}/admin/activate`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`},
      body: JSON.stringify({email})
    });
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
