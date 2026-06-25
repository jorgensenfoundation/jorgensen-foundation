// Payment-success behaviour: clear any session and redirect to sign in.
sessionStorage.clear();
// Also drop a "Remember me" session persisted in localStorage, so the user is
// forced through a fresh sign-in (which re-reads their now-active subscription).
if (window.JFAuth && JFAuth.clearSession) JFAuth.clearSession();
setTimeout(() => { window.location.href = '/login'; }, 2000);
