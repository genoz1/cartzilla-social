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

module.exports = { generateEducationalPost, generateSpotlightPost, generateCategoryHowToPost };

// This post type is different from the two above: it's NOT grounded in a
// single product's Shopify description, since "how to test X" is general
// repair knowledge rather than a fact from product data. Because of that,
// the rules here lean on well-established, standard diagnostic practices
// only, avoid anything that reads as a specific safety/electrical
// authority claim, and explicitly tell the reader to consult a
// professional if unsure — this content should be reviewed by a human
// before it's trusted to run unattended, unlike the product-grounded posts.
// Fixed, guaranteed safety line — appended in code rather than left to the
// AI to decide whether to include, since this matters too much to be
// conditional on model behavior. Same wording every time, on every post.
const SAFETY_DISCLAIMER = 'Always disconnect power before inspecting any electrical component, and consult a qualified technician if you\'re not comfortable doing this yourself.';

async function generateCategoryHowToPost(collection) {
  const system = `${BASE_RULES}

POST TYPE: Category how-to / diagnostic guide.
You are writing a short, genuinely helpful diagnostic or "how to test" guide
about a general type of golf cart part — NOT about one specific product.

The collection is: "${collection.title}"
Example products in this collection (for context on what type of part this
is, do not describe these as if writing individual product copy):
${collection.sampleProductTitles.map((t) => `- ${t}`).join('\n')}

Write about a common, realistic diagnostic question or symptom related to
this general part category (e.g. "how to test your solenoid," "signs your
forward/reverse switch is failing"). Use only well-established, standard,
non-hazardous diagnostic steps (visual inspection, listening for clicks,
basic multimeter continuity checks, checking connections) — do NOT invent
specific voltage numbers, model-specific steps, or anything that requires
disassembling high-voltage systems unsafely. A safety disclaimer will be
appended automatically after your response, so you do NOT need to write
your own — focus on the diagnostic content itself. End by directing the
reader to browse the category for a replacement if that's what the
diagnosis points to — do not name a specific product, only the category
itself.

The JSON shape is the same as before, except there is no single product
URL — use the collection URL provided for the link.`;

  const context = `Collection: ${collection.title}\nCollection URL: ${collection.url}`;
  const raw = await askClaude(system, context, 900);
  const captions = parseJsonResponse(raw);

  // Guaranteed append, every time, regardless of what the model wrote.
  captions.facebook = `${captions.facebook}\n\n${SAFETY_DISCLAIMER}`;
  captions.instagram = `${captions.instagram}\n\n${SAFETY_DISCLAIMER}`;
  captions.threads = `${captions.threads}\n\n${SAFETY_DISCLAIMER}`;
  captions.pinterest_description = `${captions.pinterest_description} ${SAFETY_DISCLAIMER}`;

  return captions;
}
