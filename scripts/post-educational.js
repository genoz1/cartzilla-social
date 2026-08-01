require('dotenv').config();
const { fetchActiveProducts } = require('../lib/shopify');
const { pickNextProductsWeighted } = require('../lib/rotation');
const { isPriority, isExcluded } = require('./product-preferences');
const { generateEducationalPost } = require('../lib/captions');
const { postProductEverywhere } = require('../lib/postProduct');
const { isLiveModeEnabled } = require('../lib/safeguards');

const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  console.log(`\n=== Cartzilla educational post — ${new Date().toISOString()} ===`);
  console.log(`Live mode: ${isLiveModeEnabled() ? 'ON' : 'off (dry-run only)'}`);

  const allEligible = await fetchActiveProducts();
  // Excluded here (social posts only) rather than in fetchActiveProducts
  // itself — these products are still fine to write about in articles and
  // reviews, just excluded from Facebook/social specifically (their product
  // photos tend to be messy multi-angle composites, not clean single shots).
  const eligible = allEligible.filter((p) => !isExcluded(p));
  console.log(`Found ${eligible.length} eligible product(s) after filtering (${allEligible.length - eligible.length} excluded from social).`);
  if (eligible.length === 0) {
    console.log('No eligible products to post — exiting.');
    return;
  }

  const [product] = await pickNextProductsWeighted(eligible, isPriority);
  if (!product) {
    console.log('No eligible product available for today (already posted or none left) — exiting.');
    return;
  }
  console.log(`Selected product: "${product.title}" (${product.url})`);

  // Re-fetch right before posting so we don't post a product that went out
  // of stock or was unpublished between selection and posting.
  const stillEligible = await fetchActiveProducts();
  if (!stillEligible.some((p) => p.id === product.id)) {
    console.log(`  [skip] "${product.title}" is no longer eligible (sold out / unpublished) — skipping this run.`);
    return;
  }

  const captions = await generateEducationalPost(product);
  const results = await postProductEverywhere({ product, postType: 'educational', captions, dryRun: DRY_RUN });

  console.log('Results:', JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('Fatal error in post-educational.js:', err);
  process.exit(1);
});
