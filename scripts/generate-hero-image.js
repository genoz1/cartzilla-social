// One-off: generates and stores an on-brand hero image for the homepage
// banner. Prefer shipping the result as public/img/homepage-hero.jpg (the
// live site uses that static asset). Optionally upload to Supabase and set
// CARTZILLA_HERO_IMAGE_URL if you want a CDN override later.
//
// Prompt matches the light site theme — bright daylight, never a black
// studio plate (the old dark hero looked wrong on the light redesign).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { storeGeneratedImage } = require('../lib/supabase');
const { generateImage } = require('../lib/openai');

const PROMPT = `Photorealistic golf cart for a light professional website hero.
Modern utility golf cart in graphite and white (not pure black), with subtle
lime-green (#8fb032) wheel accents. Three-quarter front angle, cart fills most
of the frame. Bright daytime outdoor setting on a clean paved path with soft
green fairway and sky — high-key, well-lit, airy. Soft natural sunlight, no
neon glow, no dark studio, no black background. No brand logos or nameplates.
No readable text. No people. Clean commercial product photography.`;

async function main() {
  console.log('Generating light hero image...');
  const buffer = await generateImage(PROMPT);
  const outPath = path.join(__dirname, '..', 'public', 'img', 'homepage-hero.png');
  fs.writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath}`);

  const url = await storeGeneratedImage(buffer, 'homepage-hero-light.png');
  if (url) {
    console.log(`Also uploaded: ${url}`);
    console.log('(Site uses /img/homepage-hero.jpg by default; env override optional.)');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
