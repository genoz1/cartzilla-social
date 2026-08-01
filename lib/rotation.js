// Rotation strategy: for every eligible product, find the timestamp of its
// most recent SUCCESSFUL post (or null if it's never been posted). Sort
// ascending with nulls first, and always pick from the front of that list.
// Because a product's "last posted" timestamp only updates when it's
// actually posted, this naturally cycles through the entire catalog before
// any product comes up a second time — no separate cycle-counter needed.
const { supabase } = require('./supabase');

// Pass postTypes (e.g. ['blog_article_tutorials']) to track rotation
// independently per content type/bucket — without it, ALL post types
// share one combined rotation history, which is rarely what you want when
// several different post types (social spotlight, tutorial, buying guide,
// etc.) might all reasonably want to use the same product/collection on
// the same day.
async function getLastPostedMap(productIds, { postTypes } = {}) {
  const lastPosted = new Map();
  if (!supabase || productIds.length === 0) return lastPosted;

  let query = supabase
    .from('cartzilla_post_log')
    .select('shopify_product_id, posted_at, status')
    .eq('status', 'success')
    .in('shopify_product_id', productIds.map(String))
    .order('posted_at', { ascending: false });

  if (postTypes && postTypes.length) {
    query = query.in('post_type', postTypes);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`  [warn] Could not read rotation history: ${error.message}`);
    return lastPosted;
  }

  // Results are newest-first; only keep the first (most recent) row seen
  // per product.
  for (const row of data || []) {
    if (!lastPosted.has(row.shopify_product_id)) {
      lastPosted.set(row.shopify_product_id, row.posted_at);
    }
  }
  return lastPosted;
}

async function getProductsPostedToday(productIds, { postTypes } = {}) {
  if (!supabase || productIds.length === 0) return new Set();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  let query = supabase
    .from('cartzilla_post_log')
    .select('shopify_product_id')
    .eq('status', 'success')
    .in('shopify_product_id', productIds.map(String))
    .gte('posted_at', startOfToday.toISOString());

  if (postTypes && postTypes.length) {
    query = query.in('post_type', postTypes);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`  [warn] Could not check today's posts: ${error.message}`);
    return new Set();
  }
  return new Set((data || []).map((r) => r.shopify_product_id));
}

// Returns up to `count` products, in rotation order, excluding anything
// already posted today (safeguard: never post the same product twice same
// day) and anything in `excludeIds` (e.g. already selected earlier in the
// same run). Pass postTypes to track rotation independently per content
// type — without it, all post types share one rotation history.
async function pickNextProducts(eligibleProducts, count, { excludeIds = [], postTypes } = {}) {
  const ids = eligibleProducts.map((p) => String(p.id));
  const [lastPosted, postedToday] = await Promise.all([
    getLastPostedMap(ids, { postTypes }),
    getProductsPostedToday(ids, { postTypes }),
  ]);

  const excludeSet = new Set(excludeIds.map(String));

  const candidates = eligibleProducts
    .filter((p) => !postedToday.has(String(p.id)))
    .filter((p) => !excludeSet.has(String(p.id)))
    .map((p) => ({ product: p, lastPostedAt: lastPosted.get(String(p.id)) || null }))
    .sort((a, b) => {
      if (!a.lastPostedAt && !b.lastPostedAt) return 0;
      if (!a.lastPostedAt) return -1; // never-posted goes first
      if (!b.lastPostedAt) return 1;
      return new Date(a.lastPostedAt) - new Date(b.lastPostedAt);
    });

  return candidates.slice(0, count).map((c) => c.product);
}

// Same rotation strategy, applied to collections instead of products.
// Reuses the same cartzilla_post_log table (collection id stored in the
// shopify_product_id column) so there's no separate table to maintain.
async function pickNextCollection(eligibleCollections, { excludeIds = [], postTypes } = {}) {
  const picked = await pickNextProducts(
    eligibleCollections.map((c) => ({ ...c, id: c.id })),
    1,
    { excludeIds, postTypes }
  );
  return picked[0] || null;
}

// Same rotation fairness as pickNextProducts, but biased toward a
// "priority" subset of products (e.g. higher-demand categories) ~75% of
// the time, falling back to the full eligible pool the rest of the time —
// or automatically, whenever no priority product is currently eligible.
async function pickNextProductsWeighted(eligibleProducts, isPriorityFn, { excludeIds = [], postTypes } = {}) {
  const priorityPool = eligibleProducts.filter(isPriorityFn);
  const usepriority = priorityPool.length > 0 && Math.random() < 0.75;
  const pool = usepriority ? priorityPool : eligibleProducts;
  return pickNextProducts(pool, 1, { excludeIds, postTypes });
}

module.exports = { pickNextProducts, pickNextCollection, pickNextProductsWeighted };
