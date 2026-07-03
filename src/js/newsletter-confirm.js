// /newsletter/confirm — completes a double opt-in newsletter sign-up. Reads the
// token from the URL, POSTs it to the backend, and shows success or error.
const API = window.JF_API;

function showState(id) {
  document.querySelectorAll('.state').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

async function confirmSubscription() {
  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) { showState('state-error'); return; }
  try {
    const res = await fetch(`${API}/newsletter/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    showState(res.ok ? 'state-success' : 'state-error');
  } catch (e) {
    showState('state-error');
  }
}

confirmSubscription();
