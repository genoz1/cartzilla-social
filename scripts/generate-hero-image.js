// One-off: generates and stores an on-brand hero image for the homepage
// banner. Run once — the resulting URL gets set as CARTZILLA_HERO_IMAGE_URL,
// not regenerated on every page load.
//
// Note this is deliberately different from the article-thumbnail image
// prompt in lib/imageGen.js — those need to be bright because they're small
// thumbnails that have to stay visible in a grid. A big hero image is the
// opposite case: it should look like it belongs to the page, not like a
// stock photo dropped in a box, so this asks for a dark background that
// blends into the site instead of a bright environmental scene.
require('dotenv').config();
const { storeGeneratedImage } = require('../lib/supabase');
const { generateImage } = require('../lib/openai');

const PROMPT = `A photorealistic golf cart with a black body and lime-green (#9fbb3b) wheel
accents and rim lighting, shot in dramatic automotive studio photography style. Tight crop
— the cart fills most of the frame, photographed at a three-quarter angle. Background is a
dark, near-black gradient (matching a pure black website background, so the image blends
into the page rather than looking like an inserted photo) with subtle lime-green rim
lighting along the cart's edges for depth and drama. No full environmental scene (no trees,
no path, no daylight) — this is a dark studio product shot, not an outdoor photo. No visible
brand logos or nameplates on the cart. No readable text anywhere in the image. No people.`;

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
