// Privacy-first pageview beacon. Sends only the current path and the referrer's
// host to our own same-origin edge function (/api/collect), which adds coarse
// geo + device from request headers and a per-day salted visitor hash (the raw
// IP never leaves the edge) before storing. No cookies, no persistent id, no
// third party. Honours Do-Not-Track, skips the admin console, and can never
// break the page (all wrapped in try/catch; fire-and-forget via sendBeacon).
(function () {
  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1') return;
    var path = location.pathname || '/';
    if (path.indexOf('/admin') === 0) return;             // never track the back office
    var ref = '';
    try {
      if (document.referrer) ref = new URL(document.referrer).host;
    } catch (e) { ref = ''; }
    if (ref === location.host) ref = '';                  // internal navigation isn't a referrer
    if (!navigator.sendBeacon) return;
    var nf = document.body.getAttribute('data-nf') === '1'; // this is the 404 page
    var payload = new Blob([JSON.stringify({ p: path, r: ref, nf: nf })], { type: 'text/plain' });
    navigator.sendBeacon('/api/collect', payload);        // simple, same-origin, non-blocking
  } catch (e) { /* analytics is best-effort — swallow everything */ }
})();
