// Webhook receiver → n8n bridge.
// Receives a signed webhook, verifies the signature, deduplicates, then forwards to n8n.
//
// Deploy on Cloudflare Workers / Pages Functions.
// Env vars:
//   WEBHOOK_SECRET    — shared HMAC secret with the sender
//   N8N_WEBHOOK_URL   — your n8n Webhook node URL
//   IDEMPOTENCY_KV    — Cloudflare KV namespace binding (optional, for dedup)

import { verifyHmacSha256 } from './signatures/hmac.js';
import { verifyStripeSig }  from './signatures/stripe-style.js';
import { isEventProcessed, markEventProcessed } from './idempotency.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const rawBody = await request.text();

  // 1. Verify signature — swap verifier to match your sender's scheme
  const sig    = request.headers.get('x-webhook-signature') || '';
  const stripeSig = request.headers.get('stripe-signature') || '';

  let valid = false;
  if (stripeSig) {
    valid = await verifyStripeSig(env.WEBHOOK_SECRET, rawBody, stripeSig);
  } else {
    valid = await verifyHmacSha256(env.WEBHOOK_SECRET, rawBody, sig);
  }

  if (!valid) return new Response('Invalid signature', { status: 401 });

  // 2. Parse body
  let event;
  try { event = JSON.parse(rawBody); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  // 3. Idempotency — drop duplicate deliveries
  const eventId = event.id || request.headers.get('x-idempotency-key');
  if (!eventId) return new Response('Missing event id', { status: 400 });

  if (await isEventProcessed(env, eventId)) {
    return new Response('OK (duplicate)', { status: 200 });
  }

  // 4. Forward to n8n
  if (!env.N8N_WEBHOOK_URL) {
    console.error('N8N_WEBHOOK_URL not configured');
    return new Response('Not configured', { status: 503 });
  }

  try {
    const n8nRes = await fetch(env.N8N_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        ...event,
        _meta: {
          receivedAt:  new Date().toISOString(),
          eventId,
          sourceIp:    request.headers.get('CF-Connecting-IP') || null,
        },
      }),
    });

    if (!n8nRes.ok) {
      console.error(`n8n returned ${n8nRes.status}`);
      return new Response('Upstream error', { status: 502 });
    }
  } catch (e) {
    console.error('Failed to forward to n8n', e.message);
    return new Response('Forward failed', { status: 500 });
  }

  // 5. Mark processed and ack
  await markEventProcessed(env, eventId);
  return new Response('OK', { status: 200 });
}
