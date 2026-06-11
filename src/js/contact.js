// Contact page behaviour: submit the contact form.
function submitContact() {
  const firstName = document.getElementById('first-name').value.trim();
  const lastName  = document.getElementById('last-name').value.trim();
  const email     = document.getElementById('email').value.trim();
  const subject   = document.getElementById('subject').value;
  const message   = document.getElementById('message').value.trim();
  const msgEl     = document.getElementById('form-msg');
  const btn       = document.getElementById('submit-btn');

  msgEl.className = 'form-msg';
  msgEl.textContent = '';

  if (!firstName || !lastName || !email || !subject || !message) {
    msgEl.className = 'form-msg error';
    msgEl.textContent = 'Please fill in all fields.';
    return;
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    msgEl.className = 'form-msg error';
    msgEl.textContent = 'Please enter a valid email address.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending…';

  fetch('https://jorgensen-backend-production.up.railway.app/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      email,
      subject,
      message,
    }),
  })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      btn.disabled = false;
      btn.textContent = 'Send Message';
      if (ok) {
        msgEl.className = 'form-msg success';
        msgEl.textContent = data.message || 'Your message has been sent. We will be in touch shortly.';
        document.getElementById('first-name').value = '';
        document.getElementById('last-name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('subject').selectedIndex = 0;
        document.getElementById('message').value = '';
      } else {
        msgEl.className = 'form-msg error';
        msgEl.textContent = data.detail || 'Something went wrong. Please try again.';
      }
    })
    .catch(() => {
      btn.disabled = false;
      btn.textContent = 'Send Message';
      msgEl.className = 'form-msg error';
      msgEl.textContent = 'Connection error. Please try again.';
    });
}
