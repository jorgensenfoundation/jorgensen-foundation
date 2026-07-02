// Vercel Serverless Function (Node runtime) — the same-origin sink for the
// pageview beacon. Written as CommonJS with the (req, res) signature so Vercel
// runs it directly (no ESM->CJS compile) and passes Node's request object.
//
// We read Vercel's geo headers + the User-Agent, salt a per-day visitor hash
// from the client IP (which is never stored or forwarded), drop bots, and
// forward a clean event to the backend's /collect with the shared secret.
// No-ops until COLLECT_SECRET is configured.

const { createHash } = require('node:crypto');

const BACKEND = process.env.BACKEND_URL || 'https://jorgensen-backend-production.up.railway.app';

function sha256Hex(str) {
  return createHash('sha256').update(str).digest('hex');
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
    : (/Chrome\//.test(ua) && !/Chromium/.test(ua)) ? 'Chrome'
    : (/Safari\//.test(ua) && !/Chrome/.test(ua)) ? 'Safari' : 'Other';
  return { bot: false, device, os, browser };
}

async function readBody(req) {
  // req.body is populated by Vercel for known content types; text/plain may not
  // be, so fall back to reading the raw stream.
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) {
    raw = await new Promise((resolve) => {
      let b = '';
      req.on('data', (c) => { b += c; });
      req.on('end', () => resolve(b));
      req.on('error', () => resolve(''));
    });
  }
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  const secret = process.env.COLLECT_SECRET;
  // TEMP diagnostic (no secret value leaked) — reports config presence + the
  // backend's response to a probe forward, to pinpoint a setup mismatch.
  if (req.query && req.query.debug === '1') {
    let forwardStatus = null;
    if (secret) {
      try {
        const r = await fetch(`${BACKEND}/collect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Collect-Secret': secret },
          body: JSON.stringify({ path: '/__debug_probe', visitor_id: 'debugprobe' }),
        });
        forwardStatus = r.status;
      } catch (e) { forwardStatus = 'fetch-error: ' + (e && e.message); }
    }
    res.status(200).json({ hasSecret: !!secret, hasSalt: !!process.env.ANALYTICS_SALT, backend: BACKEND, forwardStatus });
    return;
  }
  if (!secret) { res.status(204).end(); return; } // analytics off until configured

  const data = await readBody(req);
  const path = typeof data.p === 'string' ? data.p : '';
  if (!path.startsWith('/')) { res.status(204).end(); return; }

  const ua = req.headers['user-agent'] || '';
  const info = parseUA(ua);
  if (info.bot) { res.status(204).end(); return; } // drop bots/crawlers

  // IP is used only to salt the daily visitor hash, then discarded — never sent on.
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.headers['x-real-ip'] || '';
  const day = new Date().toISOString().slice(0, 10);
  const visitorId = sha256Hex(`${ip}|${ua}|${day}|${process.env.ANALYTICS_SALT || ''}`).slice(0, 32);

  const event = {
    path: path.slice(0, 300),
    referrer_host: (typeof data.r === 'string' ? data.r : '').slice(0, 255) || null,
    country: req.headers['x-vercel-ip-country'] || null,
    region: req.headers['x-vercel-ip-country-region'] || null,
    device: info.device,
    os: info.os,
    browser: info.browser,
    visitor_id: visitorId,
    not_found: data.nf === true,
  };

  try {
    await fetch(`${BACKEND}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Collect-Secret': secret },
      body: JSON.stringify(event),
    });
  } catch (e) { /* best-effort */ }

  res.status(204).end();
};
