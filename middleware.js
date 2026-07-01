// Server-side "coming soon" gate (Vercel Edge Middleware).
//
// Runs at the edge before any page HTML is served, so — unlike the old
// client-side sessionStorage check — curl / view-source / JS-disabled clients
// cannot see gated content. Access proof is an HttpOnly cookie whose value is
// SHA-256(SITE_PASSWORD); the raw password lives only in the SITE_PASSWORD env
// var and in /api/unlock, never in client JS.
//
// Launch switch: UNSET the SITE_PASSWORD env var in Vercel to open the whole
// site (gate disabled). Set it to enable the gate. (Also flip site.gated in
// src/_data/site.json to re-enable indexing at launch.)

const COOKIE = 'jf_gate';

// Static assets + the gate's own routes are always reachable, so the
// coming-soon page can load its CSS/JS and the unlock form can post.
// Note: .html is deliberately NOT allowlisted — pages must stay gated.
const ASSET_RE = /\.(css|js|mjs|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|mp4|webm|json|xml|txt|pdf|zip)$/i;

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(header, name) {
  if (!header) return '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

export default async function middleware(request) {
  const password = process.env.SITE_PASSWORD;

  // Gate disabled (no password configured) → site is fully public.
  if (!password) return;

  const { pathname } = new URL(request.url);

  // Always allow static assets and the gate's own routes.
  if (
    ASSET_RE.test(pathname) ||
    pathname === '/coming-soon' ||
    pathname.startsWith('/coming-soon/') ||
    pathname.startsWith('/api/')
  ) {
    return;
  }

  const token = readCookie(request.headers.get('cookie'), COOKIE);
  if (token && token === (await sha256Hex(password))) return; // unlocked

  const to = new URL('/coming-soon', request.url);
  return Response.redirect(to, 307);
}
