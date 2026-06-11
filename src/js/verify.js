const API = 'https://jorgensen-backend-production.up.railway.app';

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toggleVis(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') { input.type = 'text'; btn.textContent = 'HIDE'; }
  else { input.type = 'password'; btn.textContent = 'SHOW'; }
}

let currentToken = '';
let currentUser = null;

function showState(id) {
  document.querySelectorAll('.state').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function verifyToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) { showState('state-error'); return; }
  currentToken = token;
  try {
    const res = await fetch(`${API}/verify?token=${token}`);
    const data = await res.json();
    if (!res.ok) { showState('state-error'); return; }    currentUser = data;
    if (data.has_password) {
      // Already has password — send to login
      window.location.href = '/login';
      return;
    }
    const typeLabel = data.account_type === 'academia' ? 'Academic Access' : 'Industry Access';
    document.getElementById('user-info').innerHTML = `
      <div class="user-name">${esc(data.first_name)} ${esc(data.last_name)}</div>
      <div class="user-meta">${esc(data.email)}</div>
      <span class="user-type">${typeLabel}</span>
    `;
    showState('state-set-password');
  } catch(e) {
    showState('state-error');
  }
}

async function setPassword() {
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('password-error');
  const btn = document.getElementById('set-password-btn');
  errorEl.classList.remove('show');
  if (password.length < 8) {
    errorEl.textContent = 'Password must be at least 8 characters.';
    errorEl.classList.add('show'); return;
  }
  btn.disabled = true;
  btn.textContent = 'Creating account...';
  try {
    const res = await fetch(`${API}/set-password`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token: currentToken, password})
    });
    if (!res.ok) {
      const data = await res.json();
      errorEl.textContent = data.detail || 'Something went wrong. Please try again.';
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Create Account & Continue';
      return;
    }
    // Auto-login and redirect to payment
    const loginRes = await fetch(`${API}/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: currentUser.email, password})
    });
    if (loginRes.ok) {
      const userData = await loginRes.json();
      sessionStorage.setItem('jf_user', JSON.stringify(userData));
    }
    window.location.href = '/login';
  } catch(e) {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Create Account & Continue';
  }
}

verifyToken();
