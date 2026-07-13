// Supplements the two product-level posts (educational, spotlight) with a
// third post type that isn't about one product at all — it's a general
// diagnostic/how-to guide tied to a part category (e.g. "how to test your
// solenoid"), linking to the category page rather than one product.
//
// IMPORTANT: unlike the product posts, this content is NOT grounded in
// Shopify product data (there's no "diagnostic steps" field in your
// catalog) — it's general repair knowledge. Review the first batch this
// produces before trusting it to run fully unattended, the same way you
// reviewed test-mode before going live on the product posts.
require('dotenv').config();
const { fetchEligibleCollections } = require('../lib/shopify');
const { pickNextCollection } = require('../lib/rotation');
const { generateCategoryHowToPost } = require('../lib/captions');
const { postProductEverywhere } = require('../lib/postProduct');
const { isLiveModeEnabled } = require('../lib/safeguards');

const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  console.log(`\n=== Cartzilla category how-to post — ${new Date().toISOString()} ===`);
  console.log(`Live mode: ${isLiveModeEnabled() ? 'ON' : 'off (dry-run only)'}`);

  const eligible = await fetchEligibleCollections();
  console.log(`Found ${eligible.length} eligible collection(s) (2+ in-stock products each).`);
  if (eligible.length === 0) {
    console.log('No eligible collections to post — exiting.');
    return;
  }

  const collection = await pickNextCollection(eligible);
  if (!collection) {
    console.log('No eligible collection available for today (already posted or none left) — exiting.');
    return;
  }
  console.log(`Selected collection: "${collection.title}" (${collection.url})`);

  const captions = await generateCategoryHowToPost(collection);
  const results = await postProductEverywhere({ product: collection, postType: 'category_howto', captions, dryRun: DRY_RUN });

  console.log('Results:', JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('Fatal error in post-category-howto.js:', err);
  process.exit(1);
});
