// Grants page behaviour: FAQ accordion + grant application submission.
function toggleFaq(qEl) {
  const item = qEl.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

const API = 'https://jorgensen-backend-production.up.railway.app';
async function submitGrant() {
  const btn = document.getElementById('submit-btn');
  const msg = document.getElementById('form-msg');
  const fields = {
    first_name: document.getElementById('first-name').value.trim(),
    last_name: document.getElementById('last-name').value.trim(),
    email: document.getElementById('email').value.trim(),
    institution: document.getElementById('institution').value.trim(),
    supervisor_name: document.getElementById('supervisor').value.trim(),
    conference_name: document.getElementById('conference-name').value.trim(),
    conference_date: document.getElementById('conference-date').value.trim(),
    conference_location: document.getElementById('conference-location').value.trim(),
    amount_requested: document.getElementById('amount').value.trim(),
    research_description: document.getElementById('description').value.trim(),
  };
  for (const [k, v] of Object.entries(fields)) {
    if (!v) {
      msg.textContent = 'Please complete all fields before submitting.';
      msg.className = 'form-msg error';
      return;
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    msg.textContent = 'Please enter a valid email address.';
    msg.className = 'form-msg error';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Submitting…';
  msg.className = 'form-msg';
  try {
    const res = await fetch(`${API}/grants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (res.ok) {
      msg.textContent = 'Application received. We will be in touch within three weeks of the cycle closing date.';
      msg.className = 'form-msg success';
      btn.textContent = 'Application Submitted';
    } else {
      const data = await res.json().catch(() => ({}));
      msg.textContent = data.detail || 'Something went wrong. Please try again or email info@jorgensenfoundation.org.';
      msg.className = 'form-msg error';
      btn.disabled = false;
      btn.textContent = 'Submit Application';
    }
  } catch {
    msg.textContent = 'Unable to reach the server. Please try again or email info@jorgensenfoundation.org.';
    msg.className = 'form-msg error';
    btn.disabled = false;
    btn.textContent = 'Submit Application';
  }
}
