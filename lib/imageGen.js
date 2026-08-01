// Generates a real, topic-specific image for an article, styled to match
// Cartzilla's brand accent color (lime green) while staying visually
// distinct from the site's own pure-black page background — a dark or
// black-background image disappears into the page, so these need genuine
// brightness and contrast, not a black backdrop with lime highlights.
const { askClaude } = require('./anthropic');
const { generateImage } = require('./openai');

async function writeImagePrompt({ title, category }) {
  const system = `You write prompts for an AI image generator, for Cartzilla, a bold
golf cart parts & accessories brand ("Accessories That Dominate"). The brand's accent
color is a bright lime-green (#9fbb3b), used as a highlight color on parts/details —
but the image itself will be displayed on a page with a solid black background, so it
MUST be genuinely bright and well-lit, not dark or black-background — a dark image
would visually disappear into the page.

Write a prompt for a photorealistic image that fits the article's actual topic (use the
headline to pick a specific, relevant scene — a close-up of the actual mechanical part or
concept involved, not a generic golf cart photo every time).

CRITICAL — the image must NEVER include:
- any real brand logo or nameplate (EZGO, Club Car, Yamaha, or any other real manufacturer
  logo/badge) — describe generic/unbranded parts and carts only
- any readable text or lettering of any kind
- any real, identifiable person

CRITICAL — the background and overall image must NEVER be dark, black, or near-black.
Use a genuinely bright setting instead: a well-lit workshop/garage with visible daylight
or bright work-lighting, a clean bright studio background (light gray or white), or an
outdoor daytime scene. Lime-green (#9fbb3b) should appear as an accent — on a tool grip,
a highlight reflection, a detail on the part itself — not as the dominant lighting of an
otherwise dark scene.

Style: photorealistic, genuinely bright and well-lit, high contrast against a light
background — like real automotive/performance-parts product photography shot with
proper studio or daylight lighting, not moody or dark.

Respond with ONLY the image prompt text, nothing else — no preamble, no quotes.`;

  const user = `Article headline: ${title}\nCategory: ${category}`;
  return askClaude(system, user, 200);
}

async function generateArticleImage({ title, category }) {
  try {
    const prompt = await writeImagePrompt({ title, category });
    return await generateImage(prompt);
  } catch (err) {
    console.error(`  [error] Image generation failed: ${err.message}`);
    return null;
  }
}

module.exports = { generateArticleImage };
