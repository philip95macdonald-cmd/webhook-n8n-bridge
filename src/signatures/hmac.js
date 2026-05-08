// Generic HMAC-SHA256 signature verification.
// Sender computes HMAC-SHA256(secret, rawBody), sends it as hex in a header.

export async function verifyHmacSha256(secret, body, signature) {
  if (!secret || !body || !signature) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const computed = bufToHex(sigBuf);
  const incoming = signature.includes('=') ? signature.split('=').pop() : signature;

  return timingSafeEqualHex(computed, incoming);
}

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
