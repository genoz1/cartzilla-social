// Talks to the Shopify Admin REST API (read_products scope only — this
// never writes anything to Shopify) and returns only products that are
// safe to post about: active + published, in stock, with a real image and
// a real product-page URL.

const API_VERSION = process.env.CARTZILLA_SHOPIFY_API_VERSION || '2024-10';

function assertConfigured() {
  if (!process.env.CARTZILLA_SHOPIFY_STORE_DOMAIN || !process.env.CARTZILLA_SHOPIFY_ADMIN_TOKEN) {
    throw new Error('CARTZILLA_SHOPIFY_STORE_DOMAIN / CARTZILLA_SHOPIFY_ADMIN_TOKEN not set.');
  }
}

function publicProductUrl(handle) {
  const domain = process.env.CARTZILLA_SHOPIFY_PUBLIC_DOMAIN || process.env.CARTZILLA_SHOPIFY_STORE_DOMAIN;
  return `https://${domain}/products/${handle}`;
}

// A product counts as "in stock" if at least one variant is purchasable:
// either Shopify isn't tracking inventory for it (inventory_management is
// null, meaning it's always considered available), or it has quantity > 0,
// or its inventory policy explicitly allows overselling/backorder.
function hasStock(product) {
  if (!Array.isArray(product.variants) || product.variants.length === 0) return false;
  return product.variants.some((v) => {
    if (!v.inventory_management) return true; // not tracked -> always available
    if (v.inventory_policy === 'continue') return true; // backorder allowed
    return (v.inventory_quantity || 0) > 0;
  });
}

function hasUsableImage(product) {
  return Array.isArray(product.images) && product.images.length > 0 && !!product.images[0].src;
}

function hasValidUrl(product) {
  return !!product.handle;
}

// Strips Shopify's body_html down to plain text so it's safe to feed to the
// caption generator as source material without HTML tags leaking through.
function plainDescription(bodyHtml) {
  if (!bodyHtml) return '';
  return bodyHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchActiveProducts() {
  assertConfigured();

  const base = `https://${process.env.CARTZILLA_SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/products.json`;
  const headers = {
    'X-Shopify-Access-Token': process.env.CARTZILLA_SHOPIFY_ADMIN_TOKEN,
    'Content-Type': 'application/json',
  };

  let url = `${base}?status=active&limit=250`;
  const allProducts = [];

  // Shopify paginates via a Link header (cursor-based), not page numbers.
  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Shopify API error ${res.status}: ${errText}`);
    }
    const data = await res.json();
    allProducts.push(...(data.products || []));

    const linkHeader = res.headers.get('link');
    const nextMatch = linkHeader && linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
  }

  const eligible = allProducts
    // status=active already excludes draft/archived at the API level, but
    // we re-check explicitly here as a second layer, and also require the
    // product to actually be published (not just active-but-unpublished).
    .filter((p) => p.status === 'active' && !!p.published_at)
    .filter(hasStock)
    .filter(hasUsableImage)
    .filter(hasValidUrl)
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: plainDescription(p.body_html),
      productType: p.product_type || '',
      tags: p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      imageUrl: p.images[0].src,
      url: publicProductUrl(p.handle),
      handle: p.handle,
    }));

  return eligible;
}

module.exports = { fetchActiveProducts };
