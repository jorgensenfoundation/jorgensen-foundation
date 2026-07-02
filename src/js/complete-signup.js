// Social sign-in onboarding.
//
// The backend redirects a brand-new social user here with a signed #pending=… blob
// (base64url(JSON).HMAC). We read the JSON half client-side only to prefill the form
// and decide whether to ask for an email — the signature still gates the real call
// server-side, so a tampered blob is rejected by /auth/complete-signup.

const CS_API = window.JF_API;

let csPending = '';
let csRemember = false;

function csDecode(blob) {
  try {
    const raw = blob.split('.')[0];
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
    return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')));
  } catch (e) {
    return null;
  }
}

function csShowError(msg) {
  const el = document.getElementById('cs-error');
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

async function completeSignup() {
  const instEl = document.getElementById('cs-institution');
  const emailEl = document.getElementById('cs-email');
  const emailGroupVisible = document.getElementById('email-group').style.display !== 'none';
  const btn = document.getElementById('cs-btn');
  const errEl = document.getElementById('cs-error');
  if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }

  const institution = (instEl.value || '').trim();
  if (!institution) { csShowError('Please enter your institution.'); return; }

  const payload = { pending: csPending, institution: institution };
  if (emailGroupVisible) {
    const email = (emailEl.value || '').trim();
    if (!email) { csShowError('Please enter your email address.'); return; }
    payload.email = email;
  }

  btn.disabled = true;
  btn.textContent = 'Creating account…';
  try {
    const res = await fetch(`${CS_API}/auth/complete-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      csShowError(data.detail || 'Could not create your account. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Create Account';
      return;
    }
    const userInfo = {
      email: data.email,
      first_name: data.first_name,
      account_type: data.account_type,
      subscription_status: data.subscription_status,
      is_board_member: data.is_board_member
    };
    JFAuth.saveSession(userInfo, data.token, csRemember);
    window.location.href = '/dashboard';
  } catch (e) {
    csShowError('Connection error. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

// Bootstrap: pull the pending blob from the fragment, prefill, and reveal the email
// field only when the provider didn't supply one.
(function () {
  const params = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  csPending = params.get('pending') || '';
  history.replaceState(null, '', location.pathname);   // scrub the blob from the URL

  if (!csPending) { window.location.href = '/login?error=oauth_state'; return; }

  const claims = csDecode(csPending);
  csRemember = !!(claims && claims.remember);
  if (!claims || !claims.email) {
    document.getElementById('email-group').style.display = 'block';
  }
})();
