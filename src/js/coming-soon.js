// Coming-soon splash: progressive enhancement only. The actual gate is
// server-side — the form POSTs to /api/unlock, which validates the password
// against the SITE_PASSWORD env var and sets the access cookie. No password
// or access state lives in this file.

function toggleVis() {
  const input = document.getElementById('password');
  const btn = document.getElementById('eye-btn');
  if (input.type === 'password') { input.type = 'text'; btn.textContent = 'HIDE'; }
  else { input.type = 'password'; btn.textContent = 'SHOW'; }
}

// Surface the incorrect-password message that /api/unlock signals via ?error=1.
if (new URLSearchParams(location.search).get('error')) {
  const err = document.getElementById('error-msg');
  if (err) err.textContent = 'Incorrect password.';
  const input = document.getElementById('password');
  if (input) input.focus();
}
