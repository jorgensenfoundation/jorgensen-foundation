// Shared auth helpers for logged-in (user) pages. Plain script — no bundler; attaches a
// small API to window.JFAuth so page scripts (grants.js, etc.) can read the session that
// login.js / verify.js stored. Canonical keys: 'jf_user_token' (token), 'jf_user' (curated
// {email, first_name, account_type, subscription_status}). The password is never stored.
(function () {
  var USER_KEY = 'jf_user';
  var TOKEN_KEY = 'jf_user_token';
  var API = 'https://jorgensen-backend-production.up.railway.app';   // same Railway backend as login.js / verify.js
  // Base URL of the BOSS web app (The Console). Centralised here so program launches from the
  // dashboard and the /boss page share one configurable value — change it in this one spot.
  // The app reads the session token from the URL fragment: <BOSS_APP_URL>/login#token=<TOKEN>.
  var BOSS_APP_URL = 'https://app.jorgensenfoundation.org';

  // Session storage policy ("Remember me"):
  //   remember = true  → localStorage  (survives a browser restart, up to the
  //                       backend's 30-day token TTL)
  //   remember = false → sessionStorage (cleared when the tab/window closes)
  // Reads always check sessionStorage first, then localStorage, so a freshly
  // signed-in (non-remembered) session takes precedence over a stale remembered
  // one. saveSession writes ONE store and clears the other, so the two can never
  // hold divergent tokens. All access is wrapped in try/catch — storage can throw
  // in private-mode / disabled-storage browsers, and auth must never hard-fail.
  function readKey(key) {
    try {
      var v = sessionStorage.getItem(key);
      if (v !== null) return v;
      return localStorage.getItem(key);
    } catch (e) { return null; }
  }

  // Persist a logged-in session. `user` is the curated profile object; `token` the
  // bearer token; `remember` selects the store (see policy above).
  function saveSession(user, token, remember) {
    var primary = remember ? localStorage : sessionStorage;
    var other = remember ? sessionStorage : localStorage;
    try {
      primary.setItem(TOKEN_KEY, token);
      primary.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {}
    try {
      other.removeItem(TOKEN_KEY);
      other.removeItem(USER_KEY);
    } catch (e) {}
  }

  // Drop the session from BOTH stores. Used on logout and whenever a token is
  // found to be expired/invalid. Leaves unrelated keys (admin, coming-soon) alone.
  function clearSession() {
    try { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); } catch (e) {}
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) {}
  }

  function getToken() {
    return readKey(TOKEN_KEY);
  }

  function getUser() {
    var raw = readKey(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function isLoggedIn() {
    return !!readKey(USER_KEY);
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
      clearSession();
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

  // Program-access policy, mirroring the backend (has_boss_access / has_free_program_access):
  // an ACTIVE paid subscription OR the free tier (academics AND board members). Prefers the
  // backend's authoritative boss_access flag when the session carries it; otherwise derives it
  // from account_type / is_board_member (both always present on login + /me responses). Single
  // source of truth so the dashboard gate and the launch handler can't diverge.
  function hasProgramAccess(user) {
    user = user || getUser() || {};
    if (user.subscription_status === 'active') return true;
    if (typeof user.boss_access === 'boolean') return user.boss_access;
    return user.account_type === 'academia' || !!user.is_board_member;
  }

  // The BOSS app URL for the current user, with the existing session token in the URL fragment
  // (NOT a query param) so the app recognises them without a second login. No token → '/login'.
  function bossAppUrl() {
    var token = getToken();
    return token ? (BOSS_APP_URL + '/login#token=' + token) : '/login';
  }

  // Open the BOSS app for the current user. Returns false so it can be used directly as an
  // anchor onclick (suppresses the fallback href navigation). Sensible fallbacks: not logged
  // in → sign in; logged in but not entitled → the subscribe/activate flow (never the app).
  function launchBoss() {
    if (!getToken()) { window.location.href = '/login'; return false; }
    if (!hasProgramAccess()) { window.location.href = '/login#activate'; return false; }
    window.location.href = bossAppUrl();
    return false;
  }

  window.JFAuth = {
    isLoggedIn: isLoggedIn,
    getToken: getToken,
    getUser: getUser,
    saveSession: saveSession,
    clearSession: clearSession,
    authHeader: authHeader,
    logout: logout,
    hasProgramAccess: hasProgramAccess,
    bossAppUrl: bossAppUrl,
    launchBoss: launchBoss,
    BOSS_APP_URL: BOSS_APP_URL
  };
})();
