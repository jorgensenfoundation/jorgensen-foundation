const PASSWORD = 'OPLS';

function toggleVis() {
  const input = document.getElementById('password');
  const btn = document.getElementById('eye-btn');
  if (input.type === 'password') { input.type = 'text'; btn.textContent = 'HIDE'; }
  else { input.type = 'password'; btn.textContent = 'SHOW'; }
}

function unlock() {
  const val = document.getElementById('password').value;
  const err = document.getElementById('error-msg');
  if (val === PASSWORD) {
    sessionStorage.setItem('jf_access', 'true');
    window.location.replace('/');
  } else {
    err.textContent = 'Incorrect password.';
    document.getElementById('password').value = '';
    document.getElementById('password').focus();
  }
}

// Already unlocked — skip gate
if (sessionStorage.getItem('jf_access') === 'true') {
  window.location.replace('/');
}
