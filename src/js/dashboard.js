// Standalone /dashboard page. Renders the logged-in dashboard from the JFAuth session
// (auth.js, global). Login-gated like grants.js: logged out → sign-in gate card. The
// Stripe payment/activate flow stays on /login — the activate banner just links there.

function toggleCard(btn) {
  const expanded = btn.nextElementSibling;
  const isOpen = expanded.classList.contains('open');
  expanded.classList.toggle('open', !isOpen);
  btn.querySelector('span').textContent = isOpen ? '↓' : '↑';
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

// ---- Gate: only logged-in users see the dashboard; others see the sign-in card ----
(function initDashboard() {
  const gate = document.getElementById('dash-gate');
  const content = document.getElementById('dashboard-content');
  const user = (window.JFAuth && JFAuth.isLoggedIn() && JFAuth.getUser && JFAuth.getUser()) || null;

  if (!user) {
    if (gate) gate.hidden = false;
    if (content) content.hidden = true;
    return;
  }

  if (gate) gate.hidden = true;
  if (content) content.hidden = false;

  // Header
  const first = user.first_name || (user.email ? user.email.split('@')[0] : 'there');
  setText('dash-name', first);
  setText('dash-email', user.email || '');
  setText('dash-type', user.account_type === 'academia' ? 'Academic Access' : 'Industry Access');

  // Subscription gating: non-active users get the activate prompt + locked program launches.
  const active = user.subscription_status === 'active';
  if (content) content.classList.toggle('needs-activation', !active);
  const banner = document.getElementById('activate-banner');
  if (banner) banner.hidden = active;

  // Board-only "Review Applications" choice button (links to /review).
  const review = document.getElementById('choice-review');
  if (review) review.hidden = !user.is_board_member;

  // Honor a deep-link hash (e.g. #your-programs) once the section is visible.
  const h = location.hash;
  if (h) {
    requestAnimationFrame(() => {
      const t = document.querySelector(h);
      if (t && t.offsetParent !== null) t.scrollIntoView({ behavior: 'auto' });
    });
  }
})();
