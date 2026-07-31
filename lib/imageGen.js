// Generates a real, topic-specific image for an article, styled to match
// Cartzilla's actual brand (bold, high-contrast, black background with lime
// accent lighting — sampled directly from the real logo/site). Explicitly
// avoids real brand logos (EZGO, Club Car, Yamaha are real trademarks) even
// though articles can mention those names in text.
const { askClaude } = require('./anthropic');
const { generateImage } = require('./openai');

async function writeImagePrompt({ title, category }) {
  const system = `You write prompts for an AI image generator, for Cartzilla, a bold
golf cart parts & accessories brand ("Accessories That Dominate"). The brand's actual
visual identity is: pure black backgrounds, bright lime-green (#9fbb3b) accent lighting
or highlights, high-contrast dramatic photography — think automotive/performance-parts
photography, not a soft lifestyle blog aesthetic.

Write a prompt for a photorealistic image that fits the article's actual topic (use the
headline to pick a specific, relevant scene — a close-up of the actual mechanical part or
concept involved, not a generic golf cart photo every time).

CRITICAL — the image must NEVER include:
- any real brand logo or nameplate (EZGO, Club Car, Yamaha, or any other real manufacturer
  logo/badge) — describe generic/unbranded parts and carts only
- any readable text or lettering of any kind
- any real, identifiable person

Style: photorealistic, black or near-black background, dramatic lime-green rim lighting
or accent glow, high contrast — matching genuine automotive/performance-parts photography.

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
