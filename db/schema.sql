-- Run this in a NEW Supabase project created specifically for Cartzilla.
-- Do NOT run this against the Florida Buzz or Villages Golf Cart Trader
-- Supabase projects — this is intentionally a separate database.

-- One row per attempted post (success or failure). This single table is
-- also how the rotation logic figures out which product to post next
-- (least-recently-successfully-posted, or never-posted) — no separate
-- "state" table needed, so there's only one source of truth.
create table if not exists cartzilla_post_log (
  id uuid primary key default gen_random_uuid(),
  shopify_product_id text not null,
  product_title text not null,
  product_url text not null,
  post_type text not null,          -- 'educational' | 'spotlight'
  platform text not null,           -- 'facebook' | 'instagram' | 'threads' | 'pinterest'
  caption text,
  image_url text,
  status text not null,             -- 'success' | 'failed'
  error_detail text,
  posted_at timestamptz default now()
);

create index if not exists cartzilla_post_log_product_idx
  on cartzilla_post_log (shopify_product_id);
create index if not exists cartzilla_post_log_posted_idx
  on cartzilla_post_log (posted_at desc);

-- Prevents posting the exact same caption twice, and gives a fast way to
-- check "has this product already been posted today" without scanning
-- posted_at ranges by hand.
create index if not exists cartzilla_post_log_caption_idx
  on cartzilla_post_log (caption);
