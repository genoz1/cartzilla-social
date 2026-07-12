// TEST MODE — this script never calls any social media posting API, full
// stop. It pulls a handful of real Shopify products, runs them through the
// same caption-generation logic the live scripts use, and writes the
// results to a local file so you can review them before anything goes
// live. Safe to run as many times as you want.
//
// Run with: npm run test-mode
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { generateEducationalPost, generateSpotlightPost } = require('../lib/captions');

const TEST_PRODUCT_COUNT = 5;
const OUTPUT_FILE = path.join(__dirname, '..', 'proposed-posts.json');

// Used only if Shopify credentials aren't configured yet, so you can see
// the whole pipeline (filtering -> caption generation -> display) working
// before connecting the real store. Clearly labeled as sample data below.
const SAMPLE_PRODUCTS = [
  {
    id: 'sample-1',
    title: '48V Golf Cart Battery Meter with Hour Indicator',
    description: 'A digital battery meter that displays your golf cart\'s battery charge level and hour meter reading. Mounts to the dash and wires directly into your existing 48V system. Easy-to-read LCD display.',
    productType: 'Electrical',
    tags: ['battery', 'meter', '48v', 'gauge'],
    imageUrl: 'https://example.com/sample-battery-meter.jpg',
    url: 'https://cartzillagolfcart.com/products/sample-battery-meter',
  },
  {
    id: 'sample-2',
    title: 'Heavy Duty Golf Cart Rear Seat Kit with Cushions',
    description: 'Rear-facing flip seat kit that adds two extra seats to the back of your golf cart. Includes powder-coated steel frame and weather-resistant cushions in black vinyl.',
    productType: 'Seating',
    tags: ['seat kit', 'rear seat', 'accessories'],
    imageUrl: 'https://example.com/sample-rear-seat.jpg',
    url: 'https://cartzillagolfcart.com/products/sample-rear-seat-kit',
  },
  {
    id: 'sample-3',
    title: 'Golf Cart LED Headlight Kit',
    description: 'Bright LED replacement headlights for improved visibility. Direct plug-and-play replacement for factory halogen headlights on compatible models.',
    productType: 'Lighting',
    tags: ['led', 'headlights', 'lighting'],
    imageUrl: 'https://example.com/sample-led-headlights.jpg',
    url: 'https://cartzillagolfcart.com/products/sample-led-headlights',
  },
  {
    id: 'sample-4',
    title: 'Golf Cart Storage Cover, Fits 2-Passenger Carts',
    description: 'Weatherproof storage cover made from heavy-duty polyester, protects your cart from sun, rain, and dust when parked outdoors. Fits most 2-passenger golf carts.',
    productType: 'Covers',
    tags: ['cover', 'storage', 'weatherproof'],
    imageUrl: 'https://example.com/sample-cover.jpg',
    url: 'https://cartzillagolfcart.com/products/sample-storage-cover',
  },
  {
    id: 'sample-5',
    title: 'Golf Cart Brake Pad Set, Front',
    description: 'Replacement front brake pad set for worn or squeaky brakes. Standard fitment brake pads sold as a set of 2.',
    productType: 'Brakes',
    tags: ['brakes', 'brake pads', 'maintenance'],
    imageUrl: 'https://example.com/sample-brake-pads.jpg',
    url: 'https://cartzillagolfcart.com/products/sample-brake-pads',
  },
];

async function getTestProducts() {
  const shopifyConfigured = process.env.CARTZILLA_SHOPIFY_STORE_DOMAIN && process.env.CARTZILLA_SHOPIFY_CLIENT_ID && process.env.CARTZILLA_SHOPIFY_CLIENT_SECRET;

  if (!shopifyConfigured) {
    console.log('CARTZILLA_SHOPIFY_STORE_DOMAIN / CARTZILLA_SHOPIFY_CLIENT_ID / CARTZILLA_SHOPIFY_CLIENT_SECRET not set.');
    console.log('Using 5 built-in SAMPLE products so you can see the pipeline work end-to-end.');
    console.log('Once your Shopify credentials are set, this will pull your real catalog instead.\n');
    return { products: SAMPLE_PRODUCTS.slice(0, TEST_PRODUCT_COUNT), isSample: true };
  }

  const { fetchActiveProducts } = require('../lib/shopify');
  const eligible = await fetchActiveProducts();
  console.log(`Found ${eligible.length} eligible product(s) in your live catalog after filtering (excludes sold-out, draft/archived, no image, no URL).\n`);
  return { products: eligible.slice(0, TEST_PRODUCT_COUNT), isSample: false };
}

async function main() {
  console.log('=== CARTZILLA TEST MODE — no posts will be published anywhere ===\n');

  const { products, isSample } = await getTestProducts();

  if (products.length === 0) {
    console.log('No eligible products found. Nothing to test.');
    return;
  }

  const proposals = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    // Alternate post types across the 5 test products so you see examples
    // of both — this mirrors how the real 10am/6pm schedule alternates.
    const postType = i % 2 === 0 ? 'educational' : 'spotlight';

    console.log(`--- Product ${i + 1}/${products.length}: "${product.title}" ---`);
    console.log(`  URL: ${product.url}`);
    console.log(`  Image: ${product.imageUrl}`);
    console.log(`  Post type: ${postType}`);

    let captions;
    try {
      captions = postType === 'educational'
        ? await generateEducationalPost(product)
        : await generateSpotlightPost(product);
    } catch (err) {
      console.error(`  [error] Caption generation failed: ${err.message}`);
      proposals.push({ product, postType, error: err.message });
      console.log('');
      continue;
    }

    console.log(`  Facebook: ${captions.facebook}`);
    console.log(`  Instagram: ${captions.instagram}`);
    console.log(`  Threads: ${captions.threads}`);
    console.log(`  Pinterest title: ${captions.pinterest_title}`);
    console.log(`  Pinterest description: ${captions.pinterest_description}`);
    console.log('');

    proposals.push({
      shopifyProductId: product.id,
      productTitle: product.title,
      productUrl: product.url,
      imageUrl: product.imageUrl,
      postType,
      captions,
      wouldPostAt: postType === 'educational' ? '10:00 AM Eastern' : '6:00 PM Eastern',
      published: false,
    });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), isSampleData: isSample, proposals }, null, 2));
  console.log(`Saved ${proposals.length} proposed post(s) to ${OUTPUT_FILE}`);
  console.log('Nothing was posted to any platform. Review the file above, then when ready:');
  console.log('  1. Set CARTZILLA_LIVE_MODE=true in your environment');
  console.log('  2. Fill in the real platform credentials for the ones you want active');
  console.log('  3. Schedule scripts/post-educational.js (10am ET) and scripts/post-spotlight.js (6pm ET)');
}

main().catch((err) => {
  console.error('Fatal error in test-mode.js:', err);
  process.exit(1);
});
