// Idempotency store — deduplicates webhook deliveries by event ID.
// Default backend: Cloudflare KV (env.IDEMPOTENCY_KV).
// Swap getKv() for Redis, Postgres, or DynamoDB as needed.

const TTL_SECONDS = 86400;  // 24h — covers typical sender retry windows

function getKv(env) { return env.IDEMPOTENCY_KV; }

export async function isEventProcessed(env, eventId) {
  const kv = getKv(env);
  if (!kv) { console.warn('IDEMPOTENCY_KV not configured — duplicates will not be deduped.'); return false; }
  return (await kv.get(eventId)) !== null;
}

export async function markEventProcessed(env, eventId) {
  const kv = getKv(env);
  if (!kv) return;
  await kv.put(eventId, '1', { expirationTtl: TTL_SECONDS });
}
