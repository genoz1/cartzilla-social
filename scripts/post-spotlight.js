require('dotenv').config();
const { fetchActiveProducts } = require('../lib/shopify');
const { pickNextProductsWeighted } = require('../lib/rotation');
const { isPriority, isExcluded } = require('./product-preferences');
const { generateSpotlightPost } = require('../lib/captions');
const { postProductEverywhere } = require('../lib/postProduct');
const { isLiveModeEnabled } = require('../lib/safeguards');

const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  console.log(`\n=== Cartzilla spotlight post — ${new Date().toISOString()} ===`);
  console.log(`Live mode: ${isLiveModeEnabled() ? 'ON' : 'off (dry-run only)'}`);

  const allEligible = await fetchActiveProducts();
  const eligible = allEligible.filter((p) => !isExcluded(p));
  console.log(`Found ${eligible.length} eligible product(s) after filtering (${allEligible.length - eligible.length} excluded from social).`);
  if (eligible.length === 0) {
    console.log('No eligible products to post — exiting.');
    return;
  }

  // pickNextProductsWeighted already excludes anything posted today
  // (including this morning's educational pick), so this naturally can't
  // repeat it.
  const [product] = await pickNextProductsWeighted(eligible, isPriority);
  if (!product) {
    console.log('No eligible product available for today (already posted or none left) — exiting.');
    return;
  }
  console.log(`Selected product: "${product.title}" (${product.url})`);

  const stillEligible = await fetchActiveProducts();
  if (!stillEligible.some((p) => p.id === product.id)) {
    console.log(`  [skip] "${product.title}" is no longer eligible (sold out / unpublished) — skipping this run.`);
    return;
  }

  const captions = await generateSpotlightPost(product);
  const results = await postProductEverywhere({ product, postType: 'spotlight', captions, dryRun: DRY_RUN });

  console.log('Results:', JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('Fatal error in post-spotlight.js:', err);
  process.exit(1);
});
