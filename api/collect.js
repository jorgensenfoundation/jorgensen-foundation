// Vercel Edge Function: the same-origin sink for the pageview beacon.
//
// The browser POSTs { p: path, r: referrerHost } here. At the edge we can read
// Vercel's geo headers and the User-Agent, and we still have the client IP —
// which we use ONLY to compute a per-day salted visitor hash and then discard.
// Nothing identifying is stored or forwarded: we send a clean, enriched event
// to the backend's /collect with the shared COLLECT_SECRET. Disabled (no-op)
// until COLLECT_SECRET is configured, so shipping it is inert.

export const config = { runtime: 'edge' };

const BACKEND = process.env.BACKEND_URL || 'https://jorgensen-backend-production.up.railway.app';

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseUA(ua) {
  ua = ua || '';
  if (/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview|monitor|curl|wget|python-requests|headless/i.test(ua)) {
    return { bot: true };
  }
  const device = /Mobi|iPhone|iPod|Android.+Mobile/.test(ua) ? 'mobile'
    : (/iPad|Tablet|Android(?!.*Mobile)/.test(ua) ? 'tablet' : 'desktop');
  const os = /Windows/.test(ua) ? 'Windows'
    : /iPhone|iPad|iPod|iOS/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /Linux/.test(ua) ? 'Linux' : 'Other';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) && !/Chrome/.test(ua) ? 'Safari' : 'Other';
  return { bot: false, device, os, browser };
}

export default async function handler(request) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const secret = process.env.COLLECT_SECRET;
  if (!secret) return new Response(null, { status: 204 }); // analytics off until configured

  let data = {};
  try { data = JSON.parse((await request.text()) || '{}'); } catch { return new Response(null, { status: 204 }); }
  const path = typeof data.p === 'string' ? data.p : '';
  if (!path.startsWith('/')) return new Response(null, { status: 204 });

  const ua = request.headers.get('user-agent') || '';
  const info = parseUA(ua);
  if (info.bot) return new Response(null, { status: 204 }); // drop bots/crawlers

  // IP is used only to salt the daily visitor hash, then discarded — never sent on.
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || request.headers.get('x-real-ip') || '';
  const day = new Date().toISOString().slice(0, 10);
  const visitorId = (await sha256Hex(`${ip}|${ua}|${day}|${process.env.ANALYTICS_SALT || ''}`)).slice(0, 32);

  const event = {
    path: path.slice(0, 300),
    referrer_host: (typeof data.r === 'string' ? data.r : '').slice(0, 255) || null,
    country: request.headers.get('x-vercel-ip-country') || null,
    region: request.headers.get('x-vercel-ip-country-region') || null,
    device: info.device,
    os: info.os,
    browser: info.browser,
    visitor_id: visitorId,
  };

  try {
    await fetch(`${BACKEND}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Collect-Secret': secret },
      body: JSON.stringify(event),
    });
  } catch (e) { /* best-effort */ }

  return new Response(null, { status: 204 });
}
