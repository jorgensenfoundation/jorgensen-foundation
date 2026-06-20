// Standalone /dashboard page. Renders the logged-in dashboard from the JFAuth session
// (auth.js, global). Login-gated like grants.js: logged out → sign-in gate card. The
// Stripe payment/activate flow stays on /login — the activate banner just links there.

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

  // Access gating. Entitlement mirrors the backend's policy (has_boss_access /
  // has_free_program_access): a user may launch programs if they have an ACTIVE paid
  // subscription OR they fall in the free tier (academics AND board members). We prefer
  // the backend's authoritative boss_access flag when the stored session carries it
  // (/me exposes it); otherwise we derive the free tier locally from account_type /
  // is_board_member, which the login + /me responses always include.
  const active = user.subscription_status === 'active';
  const freeAccess = (typeof user.boss_access === 'boolean')
    ? user.boss_access
    : (user.account_type === 'academia' || !!user.is_board_member);
  const entitled = active || freeAccess;

  // Only genuinely non-entitled users (industry path: not academic, not board, not active)
  // get the activate prompt and the "Subscribe to launch →" buttons pointing at the Stripe
  // flow (/login#activate). Entitled users keep the static "Launch [NAME] →" → /<program>
  // markup as authored, and never see the activate banner.
  if (content) content.classList.toggle('needs-activation', !entitled);
  const banner = document.getElementById('activate-banner');
  if (banner) banner.hidden = entitled;
  if (!entitled) {
    document.querySelectorAll('.prog-launch').forEach(a => {
      a.setAttribute('href', '/login#activate');
      a.textContent = 'Subscribe to launch →';
    });
  }

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
