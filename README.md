# Cartzilla

Golf cart **content hub** + optional social automation for
[cartzillagolfcart.com](https://cartzillagolfcart.com).

Cartzilla publishes news, tutorials, troubleshooting guides, and buying advice.
It is independent of Florida Buzz and ROOK (separate repo, Supabase project, and
DigitalOcean app).

## Current operating mode

The **Shopify storefront is paused**. Credentials, DNS, and the Shopify account
stay in place so the store can be re-enabled later. Until then:

- Article / buying-guide writers use a **static topic catalog** (`lib/topics.js`), not live Shopify collections.
- Content crons need **OpenAI (or Anthropic fallback) + Supabase** only.
- Product social posts (educational / spotlight) stay **off** unless `CARTZILLA_SHOPIFY_ENABLED=true` and Shopify creds are present.
- Nav **Shop** links to `/category/buying-guides` while the storefront is disabled.
- Affiliate Amazon links include a tracking tag **only** when `CARTZILLA_AMAZON_ASSOCIATE_TAG` is set — nothing invents associate IDs.

## Setup

1. Use this GitHub repo (`genoz1/cartzilla-social`) and deploy as its own DigitalOcean App.
2. Supabase: run `db/schema.sql` in the Cartzilla project (not Florida Buzz / ROOK).
3. Copy `.env.example` into App Platform env vars. Prefer `OPENAI_API_KEY` for text + images.
4. Keep Shopify env vars filled in but leave `CARTZILLA_SHOPIFY_ENABLED=false` while the store is paused.

## Local commands

```bash
npm install
npm test                          # publishing regression checks (no API spend)
npm start                         # Express site (default port 8081)

# Controlled dry-runs (no Supabase writes, no social posts):
npm run write-buying-guide:dry
npm run write-tutorial:dry
npm run write-news:dry
```

Enable live article writes in production only after a successful dry-run:

- `CARTZILLA_WRITE_ARTICLES_ENABLED=true` — schedules tutorial (8am ET), troubleshooting (8:15am), buying-guide (1pm). Social announce is skipped by default (`SKIP_SOCIAL=true` on those jobs).
- `CARTZILLA_WRITE_NEWS_ENABLED=true` — news writer 7:30am ET.
- `CARTZILLA_LIVE_MODE=true` — required before any social platform API posts for real.

## Safeguards

- Content schedule is capped (3 article jobs/day max when articles enabled) to control OpenAI spend.
- Writers must not invent specs, prices, compatibility, or hands-on tests.
- Shopify Admin helpers remain in `lib/shopify.js` for optional future social / catalog use — they are not required for the content site.
- `/health` reports `textAi`, `shopifyEnabled`, and write flags.

## Key files

| Path | Role |
|------|------|
| `lib/ai.js` / `lib/openai.js` | OpenAI-first text generation |
| `lib/topics.js` | Static affiliate-ready topic catalog |
| `lib/affiliate.js` | Shopify opt-in + Amazon helpers (no invented tags) |
| `scripts/write-article.js` | Topic → article → Supabase (Shopify-independent) |
| `server.js` | Express + split content vs Shopify-social crons |
| `test/publishing-regression.js` | Guardrails for the publishing migration |
