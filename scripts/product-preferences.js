// Controls which products get featured in social posts. Matches against
// both a product's Shopify product_type AND its tags (case-insensitive,
// partial match) — so "Motor Controller" as a product_type, or "controller"
// as a tag, both get caught by the keyword "controller" below.

// Products matching ANY of these keywords are excluded from social posts
// (Facebook/Instagram/Threads/Pinterest) specifically — they're still fully
// fine to write about in articles, buying guides, and reviews on the site
// itself. Useful for categories whose product photos don't work well as a
// social image (e.g. messy multi-angle composite shots) even though the
// product and its written content are perfectly good. Add more any time.
const EXCLUDED_KEYWORDS = ['controller', 'speed controller'];

// Products matching ANY of these keywords are preferred for social posts —
// picked ~75% of the time when at least one eligible priority product
// exists, falling back to the full eligible pool otherwise. This is a
// starting list based on generally higher-demand golf cart accessories;
// tune freely as you see what actually performs well.
const PRIORITY_KEYWORDS = ['battery', 'batteries', 'tire', 'wheel', 'seat', 'light', 'led', 'mirror', 'lift kit', 'charger'];

function matchesAnyKeyword(product, keywords) {
  const haystack = `${product.productType || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

function isExcluded(product) {
  return matchesAnyKeyword(product, EXCLUDED_KEYWORDS);
}

function isPriority(product) {
  return matchesAnyKeyword(product, PRIORITY_KEYWORDS);
}

module.exports = { EXCLUDED_KEYWORDS, PRIORITY_KEYWORDS, isExcluded, isPriority };
