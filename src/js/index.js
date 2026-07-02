// Homepage-only behaviour: billing toggle, registration modal, FAQ accordion.
// The billing toggle now affects Industry only — Academia is free, so its card
// stays "Free" in both monthly and annual states.
let isAnnual = false;
function toggleBilling() {
  isAnnual = !isAnnual;
  const knob = document.getElementById('toggle-knob');
  knob.style.transform = isAnnual ? 'translateX(20px)' : 'translateX(0)';
  document.getElementById('industry-price').textContent = isAnnual ? '$1,990' : '$199';
  document.getElementById('industry-period').textContent = isAnnual ? 'per year' : 'per month';
}

function openModal() {
  document.getElementById('modal-form').style.display = 'block';
  document.getElementById('modal-success').style.display = 'none';
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('modal-firstname').value = '';
  document.getElementById('modal-lastname').value = '';
  document.getElementById('modal-institution').value = '';
  document.getElementById('modal-email').value = '';
}
function submitRequest() {
  const firstName = document.getElementById('modal-firstname').value.trim();
  const lastName = document.getElementById('modal-lastname').value.trim();
  const institution = document.getElementById('modal-institution').value.trim();
  const email = document.getElementById('modal-email').value.trim();
  const noteEl = document.getElementById('modal-note');
  const btn = document.getElementById('modal-btn');
  noteEl.style.color = '#bbb';
  noteEl.textContent = '';
  if (!firstName || !lastName || !institution || !email) {
    noteEl.style.color = '#c0392b';
    noteEl.textContent = 'Please fill in all fields.'; return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    noteEl.style.color = '#c0392b';
    noteEl.textContent = 'Please enter a valid email address.'; return;
  }
  btn.disabled = true;
  btn.textContent = 'Creating account...';
  fetch(window.JF_API + '/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ first_name: firstName, last_name: lastName, institution, email })
  }).then(res => res.json()).then(() => {
    btn.disabled = false;
    btn.textContent = 'Create Account';
    // Any successful registration shows the generic success modal — the backend now returns a
    // single generic message (the old 'resent' / 'log in' message branches are dead).
    document.getElementById('modal-form').style.display = 'none';
    document.getElementById('modal-success').style.display = 'block';
  }).catch(() => {
    btn.disabled = false;
    btn.textContent = 'Create Account';
    noteEl.style.color = '#c0392b';
    noteEl.textContent = 'Connection error. Please try again.';
  });
}
document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
function toggleFaq(qEl) {
  const item = qEl.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

// Open the registration modal when arriving via the nav "Create Account" link (#signup) —
// on initial load, and when the hash changes while already on the homepage.
function maybeOpenSignup() {
  if (location.hash === '#signup') openModal();
}
maybeOpenSignup();
window.addEventListener('hashchange', maybeOpenSignup);
