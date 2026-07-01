// Server-side password check for the coming-soon gate (Vercel Edge Function).
//
// The coming-soon form POSTs { password } here. On a correct match against the
// SITE_PASSWORD env var we set an HttpOnly cookie (value = SHA-256 of the
// password) that middleware.js checks on every request, then send the visitor
// to the home page. The password is never exposed to the client.

export const config = { runtime: 'edge' };

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function redirect(location, cookie) {
  const headers = { Location: location, 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(null, { status: 303, headers });
}

export default async function handler(request) {
  const origin = new URL(request.url).origin;

  if (request.method !== 'POST') {
    return redirect(origin + '/coming-soon');
  }

  const password = process.env.SITE_PASSWORD;
  let submitted = '';
  try {
    const form = await request.formData();
    submitted = String(form.get('password') || '');
  } catch {
    submitted = '';
  }

  if (password && submitted === password) {
    const token = await sha256Hex(password);
    // 30-day session cookie; HttpOnly + Secure + SameSite=Lax so it can't be
    // read by JS and is sent on top-level navigations.
    const cookie = `jf_gate=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`;
    return redirect(origin + '/', cookie);
  }

  return redirect(origin + '/coming-soon?error=1');
}
