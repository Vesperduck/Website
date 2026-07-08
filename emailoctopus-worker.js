/**
 * Vesper — EmailOctopus mailing-list proxy (Cloudflare Worker)
 * ---------------------------------------------------------------
 * Keeps your EmailOctopus API key server-side. The website POSTs
 * { email } here; this Worker calls the EmailOctopus v2 API using
 * the secret key, and returns a small JSON result to the browser.
 *
 * DEPLOY (one time, free):
 *   1. Create a Cloudflare account → Workers & Pages → Create Worker.
 *   2. Paste this file as the Worker code and Deploy.
 *   3. Add secrets/vars (Worker → Settings → Variables):
 *        EMAILOCTOPUS_API_KEY  (Secret)  = eo_xxxxxxxx...   ← your key
 *        EMAILOCTOPUS_LIST_ID  (Variable)= a9c94cac-....     ← your list id
 *        ALLOWED_ORIGIN        (Variable)= https://vesper.mu
 *   4. Copy the Worker URL (e.g. https://vesper-list.you.workers.dev)
 *      and paste it into MAILING_LIST_PROXY in the site.
 *
 * NOTE: rotate the API key you shared in chat — treat it as compromised.
 */

const EO_BASE = 'https://api.emailoctopus.com';

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    }

    // Parse body
    let email = '';
    try {
      const body = await request.json();
      email = String(body.email || '').trim().toLowerCase();
    } catch (_) {
      return json({ ok: false, error: 'bad_request' }, 400, cors);
    }

    // Validate
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: 'invalid_email' }, 422, cors);
    }

    // Call EmailOctopus v2 API
    try {
      const res = await fetch(
        `${EO_BASE}/lists/${env.EMAILOCTOPUS_LIST_ID}/contacts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.EMAILOCTOPUS_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email_address: email,
            // Use "pending" if your list has double opt-in enabled and
            // you want EmailOctopus to send the confirmation email.
            status: 'subscribed',
          }),
        }
      );

      if (res.ok) {
        return json({ ok: true }, 200, cors);
      }

      // Already-subscribed is a friendly, non-fatal outcome.
      const data = await res.json().catch(() => ({}));
      const code = data && data.error && data.error.code;
      if (code === 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS' || code === 'CONFLICT') {
        return json({ ok: true, already: true }, 200, cors);
      }
      return json({ ok: false, error: code || 'upstream_error' }, 502, cors);
    } catch (_) {
      return json({ ok: false, error: 'network_error' }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
