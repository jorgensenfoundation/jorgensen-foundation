// Vercel Serverless Function — outbound-mail relay for jorgensen-backend.
//
// Why this exists: Railway (where the backend runs) blocks ALL outbound SMTP
// ports on its lower plans — verified empirically from inside the container —
// while Vercel functions can open 587/465 freely (also verified). The domain's
// mail lives on iCloud+ (custom email domain), so rather than paying for an
// email SaaS or a Railway plan bump, the backend POSTs here over HTTPS and this
// function does the actual SMTP submission through Apple with the foundation's
// own mailbox credentials.
//
// Auth mirrors api/collect.js in reverse: a shared secret header. Without a
// matching EMAIL_RELAY_SECRET the function refuses everything, so it cannot be
// used as an open mail cannon. The SMTP credentials live only in this Vercel
// project's env (SMTP_USER = the Apple ID used for login; recipients only ever
// see the From address). Nothing here is logged beyond delivery success.
//
// CommonJS with the (req, res) signature, same as collect.js.

const { timingSafeEqual } = require('node:crypto');
const nodemailer = require('nodemailer');

const FROM_EMAIL = 'info@jorgensenfoundation.org';
const FROM = `"The Jorgensen Foundation" <${FROM_EMAIL}>`;
const MAX_RECIPIENTS = 5;
const MAX_BODY_BYTES = 300 * 1024;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }
  const secret = process.env.EMAIL_RELAY_SECRET || '';
  if (!secret) return res.status(503).json({ error: 'relay not configured' });
  const given = String(req.headers['x-relay-secret'] || '');
  const a = Buffer.from(given), b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const user = process.env.SMTP_USER, pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) return res.status(503).json({ error: 'smtp not configured' });

  let body = req.body;
  if (!body || typeof body !== 'object') {
    try { body = JSON.parse(String(body || '')); } catch { body = null; }
  }
  if (!body) return res.status(400).json({ error: 'JSON body required' });

  const to = (Array.isArray(body.to) ? body.to : [body.to])
    .filter((x) => typeof x === 'string' && x.includes('@'))
    .slice(0, MAX_RECIPIENTS);
  const subject = String(body.subject || '').slice(0, 500);
  const html = String(body.html || '');
  if (!to.length || !subject || !html) {
    return res.status(400).json({ error: 'to, subject and html are required' });
  }
  if (Buffer.byteLength(html) > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'message too large' });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mail.me.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,               // 587 = STARTTLS
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 25000,
  });

  try {
    await transporter.sendMail({
      from: FROM,
      // Envelope sender = the foundation address (an alias on the same iCloud
      // account), so bounces route to the foundation mailbox, not the Apple ID.
      envelope: { from: FROM_EMAIL, to },
      to,
      subject,
      html,
      replyTo: typeof body.replyTo === 'string' && body.replyTo.includes('@')
        ? body.replyTo : undefined,
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    // Error text can include the server's SMTP response — useful and safe; the
    // credentials themselves never appear in nodemailer error messages.
    return res.status(502).json({ error: `send failed: ${e.code || ''} ${e.message || e}`.trim() });
  }
};

module.exports.config = { maxDuration: 60 };
