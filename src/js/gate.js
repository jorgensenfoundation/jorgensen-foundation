// Coming-soon gate: bounce to the splash unless the visitor entered the access
// password this session. Loaded blocking in <head> (via base.njk) so it runs
// before the page renders. Externalised from an inline <script> so the CSP can
// drop script-src 'unsafe-inline'.
if (sessionStorage.getItem('jf_access') !== 'true') {
  window.location.replace('/coming-soon');
}
