# Cartzilla Social Automation

A **completely separate** Node.js app for automated social posting of
Cartzilla Golf Cart Parts & Accessories (Shopify) products. It shares no
code, no credentials, and no Supabase project with Florida Buzz or Villages
Golf Cart Trader.

## Setup

1. Create a **new GitHub repo** (e.g. `genoz1/cartzilla-social`) and paste
   these files in via the GitHub web editor, same as your other projects.
2. Create a **new Supabase project** (do not reuse an existing one) and run
   `db/schema.sql` in its SQL editor.
3. Copy `.env.example` to your DigitalOcean App Platform environment
   variables. Every variable is prefixed `CARTZILLA_` on purpose.
4. In Shopify: Settings → Apps → Develop apps → create an app with the
   `read_products` scope only, and grab the Admin API access token.
5. Deploy as a **new** DigitalOcean App (separate from Florida Buzz's app).

## Test mode first — do this before anything else

```
npm install
npm run test-mode
```

This pulls 5 products (from your real Shopify catalog once configured, or
5 built-in sample products if not), generates example captions for both
post types, prints everything to the console, and saves it all to
`proposed-posts.json`. **It never calls any social media API, live or
sandboxed.** Review the captions for accuracy before going any further —
in particular, double-check no compatibility/spec/shipping/warranty claims
slipped in that aren't actually in the Shopify description.

## Going live

Nothing posts for real until **both** of these are true:

- `CARTZILLA_LIVE_MODE=true` is set (this is the master switch — leave it
  `false` or unset for as long as you want)
- The specific platform's credentials (e.g. `CARTZILLA_FB_PAGE_ID` +
  `CARTZILLA_FB_PAGE_ACCESS_TOKEN`) are filled in

You can turn platforms on one at a time — e.g. go live on Facebook only
while leaving Pinterest credentials blank, and Pinterest will just be
skipped with a log line, no error.

Once you're ready, `server.js` schedules:
- **10:00 AM Eastern** — educational/problem-solving post (1 product)
- **6:00 PM Eastern** — product spotlight post (1 product)

That's a hard cap of 2 products/day, enforced by running once each.

## Safeguards built in

- Rotation always picks the least-recently-posted (or never-posted)
  eligible product, so the whole catalog cycles before any repeat
- Never posts the same product twice in one day
- Never posts an exact caption that's been posted before (checked per
  platform, right before each post)
- Re-checks the product is still in stock/published immediately before
  posting, in case it changed since selection
- One retry on transient API failures; a second failure is logged and
  surfaced, not retried further
- Every attempt (success or failure) is logged to `cartzilla_post_log`
  with product ID, title, URL, platform, caption, date, and status

## Files

- `lib/shopify.js` — pulls + filters your product catalog
- `lib/rotation.js` — picks the next product(s) to post
- `lib/captions.js` — generates captions, strictly grounded in Shopify
  product data (system prompt explicitly forbids inventing compatibility,
  specs, shipping, warranty, or install claims)
- `lib/facebook.js`, `lib/instagram.js`, `lib/threads.js`,
  `lib/pinterest.js` — one posting wrapper per platform
- `lib/safeguards.js` — retry-once + duplicate-caption check + the
  `CARTZILLA_LIVE_MODE` master switch
- `lib/postProduct.js` — orchestrates posting one product across all four
  platforms
- `lib/postLog.js` / `lib/supabase.js` — logging
- `scripts/test-mode.js` — run this first, always safe
- `scripts/post-educational.js` / `scripts/post-spotlight.js` — the real
  scheduled jobs
- `server.js` — Express app + cron scheduler
