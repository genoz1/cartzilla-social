// Writes full articles for the Cartzilla content site (cartzilla_articles
// table), grounded ONLY in real Shopify product data — same honesty rule as
// lib/captions.js. Deliberately does NOT cover the "news" category: that
// needs a real, verifiable event to report on, which isn't something this
// pipeline has a source for. Tutorials/Troubleshooting/Buying Guides/Reviews
// all naturally pair with a real product, so automation focuses there.
const { askClaude } = require('./anthropic');

const HONESTY_RULES = `You write articles for Cartzilla, a golf cart parts & accessories brand
that also publishes golf cart tutorials, troubleshooting guides, buying guides, and reviews.
The brand voice is bold and direct ("Accessories That Dominate") but the writing itself
should be genuinely useful — practical and specific, not hype.

CRITICAL — you may ONLY use facts present in the product data given to you below (title,
description, product type, tags). You must NEVER invent or assume:
- compatible golf cart makes/models, unless explicitly stated in the description
- technical specifications, voltages, or measurements not stated in the description
- shipping times, delivery windows, warranty terms, or guarantees
- installation steps, tools required, or torque specs that aren't in the source data
- prices (never quote a specific price — the product link handles that)
If the description doesn't mention something, don't invent it — write more generally, or
frame that part as general background knowledge clearly separate from product-specific
claims. Less specific and true beats specific and invented.

Respond with ONLY valid JSON, no markdown fences, no preamble, matching exactly this shape:
{
  "title": "string, under 70 characters, how a real golf cart owner would search for this",
  "meta_title": "string, under 60 characters, natural search phrasing",
  "dek": "string, one-sentence subhead, under 140 characters",
  "body_html": "string, 5-8 paragraphs as <p> and <h2> tags where useful, genuinely informative, ending with a natural (non-pushy) mention of the linked product as one real option",
  "tags": ["array of 2-4 short lowercase tags"]
}`;

function productContext(product) {
  return `Product title: ${product.title}
Product type: ${product.productType || '(not specified)'}
Tags: ${product.tags && product.tags.length ? product.tags.join(', ') : '(none)'}
Product description (verbatim from Shopify, plain text):
${product.description || '(no description provided)'}
Product URL: ${product.url}`;
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
Write the kind of step-by-step guide someone would search for while actively trying to
install, replace, or set up something this product relates to — based only on what the
product data actually says. Genuinely useful on its own, with the product mentioned
naturally near the end.`,
  troubleshooting: `ARTICLE TYPE: Troubleshooting guide.
Write a genuine diagnostic guide for the kind of problem this product would actually help
solve, based only on the product data given. Walk through real, common causes and checks —
not a sales pitch — with the product mentioned naturally near the end as one real fix.`,
  'buying-guides': `ARTICLE TYPE: Buying guide.
Write a genuine buying-guide article about the general category this product belongs to
(use its product type/tags to understand the category) — what actually matters when
choosing this kind of part, based only on what's in the product data. Mention this specific
product naturally near the end as one real option, without claiming it's "the best."`,
  reviews: `ARTICLE TYPE: Evaluation guide.
Write a genuine "what to look for" evaluation guide for this category of product — real,
practical criteria a buyer should actually check (fitment, materials, what's included),
based only on the product data given. Do NOT write this as if it's a firsthand review of
this specific product — you have no firsthand experience with it. Frame it as buyer
guidance, mentioning this product near the end as one real, current option.`,
};

async function generateArticle(product, articleType) {
  const typePrompt = ARTICLE_TYPE_PROMPTS[articleType];
  if (!typePrompt) throw new Error(`Unknown article type: ${articleType}`);

  const system = `${HONESTY_RULES}\n\n${typePrompt}`;
  const raw = await askClaude(system, productContext(product), 2200);
  return parseJsonResponse(raw);
}

module.exports = { generateArticle };
