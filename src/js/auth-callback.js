// OAuth token handoff (social sign-in landing page).
//
// The backend's /auth/{provider}/callback issues a session token and redirects
// here with it in the URL FRAGMENT (#token=…&remember=…). Fragments are never
// sent to servers, so the token can't leak via access logs or the Referer header.
// We read it, confirm it by calling /me, persist the session through the shared
// JFAuth helper (honouring "Remember me"), then forward to the dashboard.

(function () {
  var API = window.JF_API;

  function fail(reason) {
    window.location.href = '/login?error=' + encodeURIComponent(reason || 'oauth_exchange');
  }

  var params = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  var token = params.get('token');
  var remember = params.get('remember') === '1';

  // Scrub the token from the URL immediately (replace history, no Back leak).
  history.replaceState(null, '', location.pathname);

  if (!token) { fail('oauth_identity'); return; }

  fetch(API + '/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function (res) {
      if (!res.ok) throw new Error('me failed');
      return res.json();
    })
    .then(function (data) {
      var userInfo = {
        email: data.email,
        first_name: data.first_name,
        account_type: data.account_type,
        subscription_status: data.subscription_status,
        is_board_member: data.is_board_member
      };
      JFAuth.saveSession(userInfo, token, remember);
      window.location.href = '/dashboard';
    })
    .catch(function () { fail('oauth_exchange'); });
})();
