const API = window.JF_API;

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// SVG eye toggle — consistent with login.js / reset-password.js.
const EYE_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
function toggleVis(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') { input.type = 'text'; btn.innerHTML = EYE_CLOSED; btn.setAttribute('aria-label', 'Hide password'); }
  else { input.type = 'password'; btn.innerHTML = EYE_OPEN; btn.setAttribute('aria-label', 'Show password'); }
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
  // Token is now captured in JS state (currentToken). Strip ?token= from the address bar so it
  // doesn't linger in history/Referer — the GET below uses the local `token`, and set-password
  // uses `currentToken`, so neither depends on the URL after this point.
  history.replaceState({}, '', '/verify');
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
  if (password.length < 10) {
    errorEl.textContent = 'Password must be at least 10 characters.';
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
    // Auto-login, then send the new (non-active) user to their dashboard — where a
    // subscription is OPTIONAL (activate banner), not forced. Fall back to /login only
    // if the auto-login somehow fails (no session stored).
    const loginRes = await fetch(`${API}/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: currentUser.email, password})
    });
    if (loginRes.ok) {
      const userData = await loginRes.json();
      const userInfo = {
        email: userData.email,
        first_name: userData.first_name,
        account_type: userData.account_type,
        subscription_status: userData.subscription_status,
        is_board_member: userData.is_board_member
      };
      JFAuth.saveSession(userInfo, userData.token, false);
      window.location.href = '/dashboard';
    } else {
      window.location.href = '/login';
    }
  } catch(e) {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Create Account & Continue';
  }
}

verifyToken();
