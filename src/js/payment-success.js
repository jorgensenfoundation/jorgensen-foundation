// Payment-success behaviour: clear any session and redirect to sign in.
sessionStorage.clear();
setTimeout(() => { window.location.href = '/login'; }, 2000);
