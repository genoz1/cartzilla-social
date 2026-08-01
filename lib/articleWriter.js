// Writes general-topic articles for the Cartzilla content site — grounded
// in a Shopify COLLECTION (category) only for topic inspiration (what real
// products exist in this category, to pick a genuinely relevant subject),
// never claiming specific facts about any single product. This is
// deliberately different from a product review: it's general, honest golf
// cart knowledge, the same way a real independent buyer's guide would be
// written, with a banner mid-article pointing to the relevant category
// (not one specific product) for anyone who wants to shop it.
const { askClaude } = require('./anthropic');

const HONESTY_RULES = `You write articles for Cartzilla, a golf cart parts & accessories brand
that also publishes golf cart tutorials, troubleshooting guides, buying guides, and reviews.
The brand voice is bold and direct ("Accessories That Dominate") but the writing itself
should be genuinely useful — practical and specific, not hype.

These are GENERAL topic articles, not reviews or write-ups of one specific product. Write
the same way a genuine independent golf cart expert would — real, well-established
mechanical/electrical knowledge, safety-conscious, honest about tradeoffs. You are given a
product category as loose inspiration for what real products exist in this space, but you
must NOT claim specific facts (exact specs, exact compatibility, exact features) about any
one particular product — write generally about the topic and category instead.

CRITICAL — never invent:
- specific technical specifications, voltages, or measurements
- specific compatibility claims for a particular product
- prices
- installation steps, tools required, or torque specs you aren't confident are generally accurate
When in doubt, stay general and well-established rather than inventing specifics.

Respond with ONLY valid JSON, no markdown fences, no preamble, matching exactly this shape:
{
  "title": "string, under 70 characters, how a real golf cart owner would search for this",
  "meta_title": "string, under 60 characters, natural search phrasing",
  "dek": "string, one-sentence subhead, under 140 characters",
  "body_html": "string, 5-8 paragraphs as <p> and <h2> tags where useful, genuinely informative general-knowledge content — do NOT mention or link any specific product by name, that's handled separately",
  "tags": ["array of 2-4 short lowercase tags"]
}`;

function collectionContext(collection) {
  return `Product category: ${collection.title}
Examples of real products currently in this category (for topic inspiration only — do not
claim specific facts about any of these): ${collection.sampleProductTitles.join(', ')}`;
}

function parseJsonResponse(raw) {
  const cleaned = raw.replace(/^```json\s*|^```\s*|```$/gm, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Article writer did not return valid JSON: ${err.message}\nRaw: ${raw.slice(0, 500)}`);
  }
  const required = ['title', 'meta_title', 'dek', 'body_html', 'tags'];
  for (const key of required) {
    if (parsed[key] === undefined || parsed[key] === null) {
      throw new Error(`Article writer response missing field: ${key}`);
    }
  }
  return parsed;
}

const ARTICLE_TYPE_PROMPTS = {
  tutorials: `ARTICLE TYPE: Tutorial / how-to.
Write the kind of general step-by-step guide someone would search for while trying to
install, replace, or maintain something in this category — real, well-established general
knowledge, genuinely useful on its own without needing to reference any specific product.`,
  troubleshooting: `ARTICLE TYPE: Troubleshooting guide.
Write a genuine diagnostic guide for the kind of problem this category of part relates to —
real, common causes and checks a golf cart owner can actually work through, general enough
to apply regardless of which specific brand/product they end up using to fix it.`,
  'buying-guides': `ARTICLE TYPE: Buying guide.
Write a genuine buying-guide article about this general category — what actually matters
when choosing this kind of part (fitment, materials, common tradeoffs), based on general
knowledge of the category, not any one specific product's spec sheet.`,
  reviews: `ARTICLE TYPE: Evaluation guide.
Write a genuine "what to look for" evaluation guide for this category of product — real,
practical criteria a buyer should check (fitment, materials, what's typically included).
This is buyer guidance, not a review of any specific product.`,
};

async function generateArticle(collection, articleType) {
  const typePrompt = ARTICLE_TYPE_PROMPTS[articleType];
  if (!typePrompt) throw new Error(`Unknown article type: ${articleType}`);

  const system = `${HONESTY_RULES}\n\n${typePrompt}`;
  const raw = await askClaude(system, collectionContext(collection), 2200);
  return parseJsonResponse(raw);
}

// Inserts a category-shopping banner roughly in the middle of the article
// body — after the first major section rather than buried at the very end,
// so it's a genuine mid-article banner, not a text link. Splits on <h2>
// boundaries when there are enough of them; falls back to splitting on
// paragraph count for shorter articles with few/no headers.
function insertMidArticleBanner(bodyHtml, bannerHtml) {
  const h2Split = bodyHtml.split(/(?=<h2>)/i);
  if (h2Split.length >= 3) {
    const midpoint = Math.ceil(h2Split.length / 2);
    return h2Split.slice(0, midpoint).join('') + bannerHtml + h2Split.slice(midpoint).join('');
  }

  const blocks = bodyHtml.split(/(?<=<\/p>)/i).filter(Boolean);
  if (blocks.length < 2) return bodyHtml + bannerHtml; // too short to split meaningfully, append instead
  const midpoint = Math.ceil(blocks.length / 2);
  return blocks.slice(0, midpoint).join('') + bannerHtml + blocks.slice(midpoint).join('');
}

module.exports = { generateArticle, insertMidArticleBanner };
