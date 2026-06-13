// Shared auth helpers for logged-in (user) pages. Plain script — no bundler; attaches a
// small API to window.JFAuth so page scripts (grants.js, etc.) can read the session that
// login.js / verify.js stored. Canonical keys: 'jf_user_token' (token), 'jf_user' (curated
// {email, first_name, account_type, subscription_status}). The password is never stored.
(function () {
  var USER_KEY = 'jf_user';
  var TOKEN_KEY = 'jf_user_token';

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

  window.JFAuth = {
    isLoggedIn: isLoggedIn,
    getToken: getToken,
    getUser: getUser,
    authHeader: authHeader
  };
})();
