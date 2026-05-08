[![CI](https://github.com/philip95macdonald-cmd/webhook-n8n-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/philip95macdonald-cmd/webhook-n8n-bridge/actions)
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

**1. n8n** — add a Webhook node, copy the URL.

**2. Deploy**
```bash
npm install -g wrangler
wrangler secret put WEBHOOK_SECRET    # shared with your sender
wrangler secret put N8N_WEBHOOK_URL   # your n8n webhook node URL
wrangler deploy src/webhook.js
```

**3.** Point your sender at the Worker URL.

## Idempotency

Bind a Cloudflare KV namespace as `IDEMPOTENCY_KV` and duplicate event IDs within 24h are dropped before forwarding. Without it, dedup in n8n instead.

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "IDEMPOTENCY_KV"
id      = "your-kv-namespace-id"
```

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

## License

MIT
