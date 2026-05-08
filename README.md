# webhook-n8n-bridge

Cloudflare Worker that sits between any signed webhook source and your n8n instance. Verifies the signature, deduplicates retries, then forwards the event to an n8n Webhook node — so your automation logic stays in n8n, not in glue code.

```
External service → signed POST → [Cloudflare Worker] → verify + dedup → n8n Webhook node → your workflow
```

## Why

Directly exposing n8n to external webhooks skips signature verification and lets duplicates through. This bridge adds a security and reliability layer in front of n8n without you having to build it inside n8n itself.

## Supported signature schemes

| Scheme | Header | Usage |
|---|---|---|
| Generic HMAC-SHA256 | `x-webhook-signature` | Most custom senders, n8n outgoing hooks |
| Stripe-style | `Stripe-Signature` | Stripe, and any sender using the `t=,v1=` format |

The bridge auto-detects which scheme to use based on which header is present.

## Setup

**1. Configure n8n**
- Add a "Webhook" node to your workflow
- Set it to POST, copy the URL → this is your `N8N_WEBHOOK_URL`

**2. Deploy to Cloudflare Workers**
```bash
npm install -g wrangler
wrangler secret put WEBHOOK_SECRET      # shared with your webhook sender
wrangler secret put N8N_WEBHOOK_URL     # your n8n webhook node URL
wrangler deploy src/webhook.js
```

**3. Point your sender at the Worker URL**

## Idempotency

If `IDEMPOTENCY_KV` is bound (a Cloudflare KV namespace), duplicate event IDs within 24h are dropped before forwarding. Without it, duplicates pass through — configure dedup in n8n instead.

Add to `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "IDEMPOTENCY_KV"
id      = "your-kv-namespace-id"
```

## What n8n receives

The original event payload plus a `_meta` object:
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
