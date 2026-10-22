# Day 5 report experience and quotas

Date: 22 October 2026

Day 5 completes the golfer-facing report journey. A valid measured swing now
unlocks an explicit privacy and consent step, allowance status, evidence-linked
written insights, permanent limitations, and local usefulness feedback.

## User journey

1. The golfer marks address, top, and impact; finish remains optional.
2. The application builds a reduced report input in the browser.
3. Before generation, the interface explains that video and raw landmarks stay
   local and names the anonymous measurements that may be sent externally.
4. The golfer explicitly consents and requests the written review.
5. Each insight shows its server-owned measurements, confidence, relevant
   phases, and an action that returns the golfer to the video evidence.
6. The interface identifies whether wording came from OpenRouter, cache, or the
   deterministic local writer. Limit and failure states remain fully useful.

Feedback choices are stored only in browser local storage and contain the
selected feedback label, report source, and timestamp. They contain no video,
landmarks, measurements, or generated report text.

## Quotas and caching

The report API uses Upstash Redis over its serverless HTTP client. A Lua script
atomically checks and increments both counters so concurrent requests cannot
cross either limit:

- Five successful AI-assisted analyses per customer per UTC day.
- Forty-five total provider attempts per UTC day by default.
- A global limit override bounded to 1–1,000 through
  `REPORT_GLOBAL_DAILY_LIMIT`.

The customer key is an HMAC of the UTC date and the trusted forwarded request
IP. Raw IP addresses are never stored. Daily counters expire shortly after the
next UTC reset and cached reports expire after 48 hours.

The reduced validated input is hashed with SHA-256. An unchanged cached
analysis returns without consuming either allowance. Failed or rejected model
output releases the customer reservation while retaining the global provider
attempt, protecting both the user allowance and the external free-tier budget.

Production AI generation fails closed when quota storage or its HMAC secret is
missing: the same request receives the deterministic evidence report and no
external model call is made.

## Configuration

Required for production AI-assisted reports:

```text
OPENROUTER_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QUOTA_HMAC_SECRET=
REPORT_GLOBAL_DAILY_LIMIT=45
```

The Vercel Upstash integration may provide `KV_REST_API_URL` and
`KV_REST_API_TOKEN`; these are supported as fallbacks. All values are
server-only and must never use a `NEXT_PUBLIC_` prefix.

## Verification

Tests cover atomic reservation results, UTC resets, rotating anonymous
identifiers, response caching, quota and provider fallback states, consent,
report rendering, evidence navigation, and local feedback. The opt-in real
video Playwright journey now continues through phase marking to a written local
report without requiring an external model call in routine CI.
