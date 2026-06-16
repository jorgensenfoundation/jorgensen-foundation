const API = 'https://jorgensen-backend-production.up.railway.app';
let resetToken = '';

function showState(id) {
  document.querySelectorAll('.state').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

const EYE_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
function toggleVis(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') { input.type = 'text'; btn.innerHTML = EYE_CLOSED; btn.setAttribute('aria-label', 'Hide password'); }
  else { input.type = 'password'; btn.innerHTML = EYE_OPEN; btn.setAttribute('aria-label', 'Show password'); }
}

async function requestReset() {
  const email = document.getElementById('reset-email').value.trim();
  const errorEl = document.getElementById('request-error');
  const btn = document.getElementById('request-btn');
  errorEl.classList.remove('show');
  if (!email) {
    errorEl.textContent = 'Please enter your email address.';
    errorEl.classList.add('show'); return;
  }
  btn.disabled = true;
  btn.textContent = 'Sending...';
  try {
    await fetch(`${API}/forgot-password`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email})
    });
    showState('state-sent');
  } catch(e) {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
  }
}

async function resetPassword() {
  const password = document.getElementById('new-password').value;
  const errorEl = document.getElementById('reset-error');
  const btn = document.getElementById('reset-btn');
  errorEl.classList.remove('show');
  if (password.length < 10) {
    errorEl.textContent = 'Password must be at least 10 characters.';
    errorEl.classList.add('show'); return;
  }
  btn.disabled = true;
  btn.textContent = 'Updating password...';
  try {
    const res = await fetch(`${API}/reset-password`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token: resetToken, password})
    });
    if (!res.ok) {
      showState('state-error'); return;
    }
    showState('state-success');
  } catch(e) {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Set New Password';
  }
}

// Check for token in URL
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
if (token) {
  resetToken = token;
  showState('state-reset');
}
