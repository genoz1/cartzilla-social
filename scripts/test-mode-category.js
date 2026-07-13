// Same idea as scripts/test-mode.js, but for the new category-level
// diagnostic/how-to post type. Never posts anywhere — just shows you what
// it would generate so you can confirm the diagnostic content reads as
// accurate before this ever runs unattended.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { fetchEligibleCollections } = require('../lib/shopify');
const { generateCategoryHowToPost } = require('../lib/captions');

const TEST_COUNT = 3;
const OUTPUT_FILE = path.join(__dirname, '..', 'proposed-category-posts.json');

async function main() {
  console.log('=== CARTZILLA CATEGORY HOW-TO TEST MODE — no posts will be published anywhere ===\n');

  const eligible = await fetchEligibleCollections();
  console.log(`Found ${eligible.length} eligible collection(s) (2+ in-stock products each).\n`);

  if (eligible.length === 0) {
    console.log('No eligible collections found — nothing to test. Make sure your Shopify Collections each have at least 2 active, in-stock, published products with images.');
    return;
  }

  const sample = eligible.slice(0, TEST_COUNT);
  const proposals = [];

  for (const collection of sample) {
    console.log(`--- Collection: "${collection.title}" ---`);
    console.log(`  URL: ${collection.url}`);
    console.log(`  Sample products: ${collection.sampleProductTitles.join(', ')}`);

    let captions;
    try {
      captions = await generateCategoryHowToPost(collection);
    } catch (err) {
      console.error(`  [error] Caption generation failed: ${err.message}`);
      proposals.push({ collection, error: err.message });
      console.log('');
      continue;
    }

    console.log(`  Facebook: ${captions.facebook}`);
    console.log(`  Instagram: ${captions.instagram}`);
    console.log(`  Threads: ${captions.threads}`);
    console.log(`  Pinterest title: ${captions.pinterest_title}`);
    console.log(`  Pinterest description: ${captions.pinterest_description}`);
    console.log('');

    proposals.push({ collectionId: collection.id, collectionTitle: collection.title, collectionUrl: collection.url, captions, published: false });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), proposals }, null, 2));
  console.log(`Saved ${proposals.length} proposed post(s) to ${OUTPUT_FILE}`);
  console.log('\nReview each one carefully — this content is general repair knowledge, not pulled from your Shopify data, so accuracy matters more here than in the product posts.');
}

main().catch((err) => {
  console.error('Fatal error in test-mode-category.js:', err);
  process.exit(1);
});
