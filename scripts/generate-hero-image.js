// One-off: generates and stores a bright, on-brand hero image for the
// homepage banner. Run once — the resulting URL gets set as
// CARTZILLA_HERO_IMAGE_URL, not regenerated on every page load.
require('dotenv').config();
const { storeGeneratedImage } = require('../lib/supabase');
const { generateImage } = require('../lib/openai');

const PROMPT = `A photorealistic golf cart with a black body and lime-green (#9fbb3b) wheel
accents, parked on a paved path through a bright, sunlit forest with green trees and dappled
daylight. Clean, professional automotive photography style, genuinely bright and well-lit —
not dark or moody. No visible brand logos or nameplates on the cart. No readable text
anywhere in the image. No people.`;

async function main() {
  console.log('Generating hero image...');
  const buffer = await generateImage(PROMPT);
  const url = await storeGeneratedImage(buffer, 'homepage-hero.png');
  if (!url) {
    console.error('[error] Upload failed.');
    process.exit(1);
  }
  console.log(`\nDone! Set this as an environment variable:\n\nCARTZILLA_HERO_IMAGE_URL=${url}\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
