// Shared auth helpers for logged-in (user) pages. Plain script — no bundler; attaches a
// small API to window.JFAuth so page scripts (grants.js, etc.) can read the session that
// login.js / verify.js stored. Canonical keys: 'jf_user_token' (token), 'jf_user' (curated
// {email, first_name, account_type, subscription_status}). The password is never stored.
(function () {
  var USER_KEY = 'jf_user';
  var TOKEN_KEY = 'jf_user_token';
  var API = 'https://jorgensen-backend-production.up.railway.app';   // same Railway backend as login.js / verify.js

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    var raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function isLoggedIn() {
    return !!sessionStorage.getItem(USER_KEY);
  }

  function authHeader() {
    return { 'Authorization': 'Bearer ' + getToken() };
  }

  // DOM-free logout for the global nav: revoke the token server-side (POST /logout with the
  // Bearer token), THEN clear the local session and return home. Robust by design — the local
  // clear + redirect ALWAYS happen, regardless of the network result (success/failure/offline),
  // and a short safety cap prevents getting stuck if the request hangs. No token → just clear.
  // Deliberately does NOT touch 'jf_admin_token' — admin is a separate auth domain.
  function logout() {
    var token = getToken();
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      window.location.href = '/';
    }
    if (!token) { finish(); return; }
    setTimeout(finish, 2500);   // never get stuck if the network hangs
    try {
      fetch(API + '/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }).then(finish, finish);
    } catch (e) {
      finish();
    }
  }

  window.JFAuth = {
    isLoggedIn: isLoggedIn,
    getToken: getToken,
    getUser: getUser,
    authHeader: authHeader,
    logout: logout
  };
})();
