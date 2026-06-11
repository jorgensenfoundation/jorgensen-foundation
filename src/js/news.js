// News page behaviour: newsletter subscription.
const API = 'https://jorgensen-backend-production.up.railway.app';
async function subscribeNewsletter() {
  const input = document.getElementById('newsletter-email');
  const msg = document.getElementById('newsletter-msg');
  const btn = document.querySelector('.newsletter-btn');
  const email = input.value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msg.textContent = 'Please enter a valid email address.';
    msg.style.color = 'rgba(245,240,230,0.5)';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Subscribing…';
  try {
    const res = await fetch(`${API}/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    msg.textContent = data.message || 'Thank you — you\'re subscribed.';
    msg.style.color = 'rgba(245,240,230,0.45)';
    input.value = '';
    btn.textContent = 'Subscribed ✓';
  } catch {
    msg.textContent = 'Something went wrong. Please try again.';
    msg.style.color = 'rgba(245,240,230,0.5)';
    btn.disabled = false;
    btn.textContent = 'Subscribe →';
  }
}
