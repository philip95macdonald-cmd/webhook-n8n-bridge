// Stripe-style timestamped HMAC signature with replay protection.
// Header: "Stripe-Signature: t=<unix>,v1=<hex>"
// Docs: https://stripe.com/docs/webhooks/signatures

import { verifyHmacSha256 } from './hmac.js';

const REPLAY_WINDOW_SECONDS = 300;  // 5 min

export async function verifyStripeSig(secret, body, header) {
  if (!header) return false;

  const parts = Object.fromEntries(header.split(',').map(p => p.split('=', 2)));
  const { t, v1 } = parts;
  if (!t || !v1) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(t));
  if (ageSeconds > REPLAY_WINDOW_SECONDS) {
    console.warn(`Stripe signature: timestamp out of window (${ageSeconds}s)`);
    return false;
  }

  return verifyHmacSha256(secret, `${t}.${body}`, v1);
}
