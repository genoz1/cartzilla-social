// Affiliate / outbound commerce helpers.
// Does NOT invent tracking IDs. When CARTZILLA_AMAZON_ASSOCIATE_TAG is set,
// search/product links can include the tag. Otherwise links are plain
// Amazon search URLs (still useful) or omitted.
// Shopify storefront links are treated as paused unless explicitly re-enabled.

function shopifyEnabled() {
  // Opt-in only. The Shopify storefront is paused; do not send shoppers
  // there unless CARTZILLA_SHOPIFY_ENABLED is explicitly set to "true".
  return process.env.CARTZILLA_SHOPIFY_ENABLED === 'true'
    && !!(process.env.CARTZILLA_SHOPIFY_PUBLIC_DOMAIN || process.env.CARTZILLA_SHOPIFY_STORE_DOMAIN);
}

function shopHomeUrl() {
  if (!shopifyEnabled()) return null;
  const domain = process.env.CARTZILLA_SHOPIFY_PUBLIC_DOMAIN || process.env.CARTZILLA_SHOPIFY_STORE_DOMAIN;
  return domain ? `https://${domain}` : null;
}

function amazonAssociateTag() {
  const tag = (process.env.CARTZILLA_AMAZON_ASSOCIATE_TAG || '').trim();
  return tag || null;
}

function amazonSearchUrl(query) {
  const q = encodeURIComponent(String(query || '').trim());
  if (!q) return null;
  const tag = amazonAssociateTag();
  const base = `https://www.amazon.com/s?k=${q}`;
  return tag ? `${base}&tag=${encodeURIComponent(tag)}` : base;
}

function affiliateReady() {
  return !!amazonAssociateTag();
}

function disclosureHtml() {
  if (!affiliateReady()) {
    return `<aside class="affiliate-disclosure" data-affiliate-ready="false">
  <p><strong>Note:</strong> Cartzilla may earn a commission from qualifying purchases made through links on this site. Product recommendations are editorial; we do not invent hands-on tests or prices.</p>
</aside>`;
  }
  return `<aside class="affiliate-disclosure" data-affiliate-ready="true">
  <p><strong>Affiliate disclosure:</strong> As an Amazon Associate, Cartzilla earns from qualifying purchases. Links marked as sponsored may earn a commission at no extra cost to you.</p>
</aside>`;
}

function buildTopicCta(topic) {
  const search = topic?.amazonSearch || topic?.title;
  const href = amazonSearchUrl(search);
  if (!href) return '';
  const rel = affiliateReady() ? 'sponsored noopener' : 'noopener';
  const label = affiliateReady() ? 'See options on Amazon' : 'Browse related products';
  return `
<div class="category-banner affiliate-cta">
  <p class="category-banner-label">${escapeHtml(topic.title)}</p>
  <p>Compare current options for this category. We do not invent prices or stock status — check the retailer for live details.</p>
  <a href="${href}" class="btn" target="_blank" rel="${rel}">${label} &rarr;</a>
</div>
`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveOutboundUrl(articleOrTopic) {
  if (articleOrTopic?.amazonSearch) return amazonSearchUrl(articleOrTopic.amazonSearch);
  if (articleOrTopic?.product_url && shopifyEnabled()) return articleOrTopic.product_url;
  if (articleOrTopic?.title) return amazonSearchUrl(articleOrTopic.title);
  return null;
}

module.exports = {
  shopifyEnabled,
  shopHomeUrl,
  amazonAssociateTag,
  amazonSearchUrl,
  affiliateReady,
  disclosureHtml,
  buildTopicCta,
  resolveOutboundUrl,
};
