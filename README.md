[![CI](https://github.com/martechbuilder/webhook-n8n-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/martechbuilder/webhook-n8n-bridge/actions)
![License](https://img.shields.io/badge/license-MIT-blue)

# webhook-n8n-bridge

The gap between "n8n can receive webhooks" and "n8n should verify signatures and deduplicate retries" is usually filled with brittle glue code. This Cloudflare Worker fills that gap properly — so your automation logic stays in n8n where it belongs.

```
External service → signed POST → [Cloudflare Worker] → verify + dedup → n8n Webhook node → your workflow
```

## Why not just point the sender directly at n8n?

- n8n doesn't verify HMAC signatures natively
- Retrying senders will trigger your workflow multiple times
- You get no rate limiting or replay protection

This bridge adds all three in ~200 lines, deployed to Cloudflare's edge.

## Supported signature schemes

| Scheme | Header | Works with |
|---|---|---|
| Generic HMAC-SHA256 | `x-webhook-signature` | Most custom senders, n8n outgoing hooks |
| Stripe-style | `Stripe-Signature` | Stripe, and any sender using `t=,v1=` format |

Auto-detected from which header is present.

## Setup

**1. n8n** — add a Webhook node, set authentication to None (the bridge handles it), copy the URL.

**2. Clone and configure**
```bash
git clone https://github.com/martechbuilder/webhook-n8n-bridge
cd webhook-n8n-bridge
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml: set your account_id
```

**3. Deploy**
```bash
npm install -g wrangler
wrangler login
wrangler secret put WEBHOOK_SECRET    # shared secret with your sender
wrangler secret put N8N_WEBHOOK_URL   # your n8n webhook node URL
wrangler deploy src/webhook.js
```

**4. Validate**
```bash
# Replace URL and SECRET with yours
curl -s -X POST https://your-worker.workers.dev \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $(echo -n '{"type":"test"}' | openssl dgst -sha256 -hmac 'YOUR_SECRET' -binary | xxd -p -c 256)" \
  -d '{"type":"test"}' | jq .
# Expected: forwarded to n8n, n8n returns 200
```

**5.** Point your sender at the Worker URL.

## Idempotency (optional)

Bind a Cloudflare KV namespace as `IDEMPOTENCY_KV` and duplicate event IDs within 24h are dropped before forwarding. Without it, handle deduplication in n8n instead.

```toml
# wrangler.toml — add this block
[[kv_namespaces]]
binding = "IDEMPOTENCY_KV"
id      = "your-kv-namespace-id"
```

Create the namespace: `wrangler kv:namespace create IDEMPOTENCY_KV` — it prints the ID to paste above.

## What n8n receives

Original event payload plus `_meta`:
```json
{
  "type": "order.paid",
  "id": "evt_123",
  "_meta": {
    "receivedAt": "2026-05-08T07:30:00.000Z",
    "eventId": "evt_123",
    "sourceIp": "1.2.3.4"
  }
}
```

## You know it worked when

- The curl test above does not return a 401 or 403 (signature valid)
- Your n8n workflow execution log shows the test event within seconds
- Sending the same event twice in quick succession triggers the n8n workflow only once (with KV bound)

## License

MIT
