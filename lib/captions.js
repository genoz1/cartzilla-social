// Generates the two post types (educational / spotlight) with
// platform-specific caption variants, using ONLY the product's actual
// Shopify title/description/type/tags as source material. The system
// prompt explicitly forbids inventing compatibility, specs, shipping
// times, warranties, or installation claims that aren't in that data —
// and askClaude is asked to respond with strict JSON so we can validate
// the shape before anything gets near a posting API.
const { askClaude } = require('./anthropic');

const BASE_RULES = `You write social media captions for Cartzilla Golf Cart Parts & Accessories,
a Shopify store selling golf cart parts and accessories.

CRITICAL — you may ONLY use facts present in the product data given to you below
(title, description, product type, tags). You must NEVER invent or assume:
- compatible golf cart makes/models, unless explicitly stated in the description
- technical specifications not stated in the description
- shipping times, delivery windows, or "fast shipping" claims
- warranty terms or guarantees
- installation difficulty, tools required, or "easy install" claims
If the description doesn't mention something, simply don't mention it. When in
doubt, write more generally rather than filling in a plausible-sounding detail.

Tone: helpful, plain-spoken, written by someone who actually knows golf carts —
not salesy hype. No exclamation-point spam. No emojis unless natural (max 1-2).

Respond with ONLY valid JSON, no markdown fences, no preamble, matching exactly
this shape:
{
  "facebook": "string - a helpful caption, 2-4 sentences, natural CTA at the end",
  "instagram": "string - concise caption (under ~150 words) + 3-6 relevant hashtags + a line telling people the link is in bio",
  "threads": "string - short, conversational, 1-3 sentences, no hashtags",
  "pinterest_title": "string - SEO-friendly, under 100 characters",
  "pinterest_description": "string - SEO-friendly, under 500 characters"
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
    throw new Error(`Caption generator did not return valid JSON: ${err.message}\nRaw: ${raw.slice(0, 500)}`);
  }
  const required = ['facebook', 'instagram', 'threads', 'pinterest_title', 'pinterest_description'];
  for (const key of required) {
    if (!parsed[key] || typeof parsed[key] !== 'string') {
      throw new Error(`Caption generator response missing/invalid field: ${key}`);
    }
  }
  return parsed;
}

async function generateEducationalPost(product) {
  const system = `${BASE_RULES}

POST TYPE: Educational / problem-solving.
Open by naming a common, realistic golf-cart problem or question this type of
product relates to (based on its actual title/type/description — don't invent
a problem that doesn't logically connect to what the product is). Briefly
explain how this specific product may help with that problem, staying within
what the description actually says. End with a natural call to action
(e.g. "check it out" / "see if it fits your cart" / "take a look") — not
pushy, no fake urgency or discount claims.`;

  const raw = await askClaude(system, productContext(product), 900);
  return parseJsonResponse(raw);
}

async function generateSpotlightPost(product) {
  const system = `${BASE_RULES}

POST TYPE: Product spotlight.
Lead with the product's single most important benefit, as actually described
in the product data. Mention compatible golf cart makes/models ONLY if the
description explicitly states them — otherwise skip that entirely, don't
generalize to "most carts" or similar. Briefly note why someone might need
this product, grounded in the description.`;

  const raw = await askClaude(system, productContext(product), 900);
  return parseJsonResponse(raw);
}

module.exports = { generateEducationalPost, generateSpotlightPost };
