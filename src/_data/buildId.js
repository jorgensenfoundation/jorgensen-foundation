// Cache-busting build id appended to local CSS/JS URLs as `?v=`. Computed once
// per build, so every deploy serves fresh assets instead of a stale cached file
// (browsers otherwise hold onto /css/admin.css & friends across deploys).
module.exports = String(Date.now());
