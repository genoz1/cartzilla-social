// Writes a general-topic article (grounded in a product CATEGORY for
// inspiration, not one specific product), publishes it into the
// cartzilla_articles table, and announces it across all four social
// platforms. Uses an AI-generated image (bright, on-brand, never
// dark/black-background — see lib/imageGen.js) rather than a real product
// photo, and embeds a "shop this category" banner roughly mid-article
// rather than a plain inline text link. Rotation for these articles is
// tracked independently from the social-only post types via the postTypes
// filter in lib/rotation.js, using its own 'blog_article' post type.
require('dotenv').config();
const { supabase, storeGeneratedImage } = require('../lib/supabase');
const { fetchEligibleCollections } = require('../lib/shopify');
const { pickNextCollection } = require('../lib/rotation');
const { generateArticle, insertMidArticleBanner } = require('../lib/articleWriter');
const { generateArticleImage } = require('../lib/imageGen');
const { postToFacebookPage } = require('../lib/facebook');
const { createPost: postToInstagram } = require('../lib/instagram');
const { createPost: postToThreads } = require('../lib/threads');
const { createPin } = require('../lib/pinterest');
const { logPost } = require('../lib/postLog');
const { isLiveModeEnabled } = require('../lib/safeguards');

const DRY_RUN = process.env.DRY_RUN === 'true';
const SITE_URL = process.env.SITE_URL || 'https://cartzillagolfcart.com';

// Weighted so tutorials/troubleshooting (the two most naturally
// product-grounded, highest search-intent types) come up more often.
// "News" is deliberately not in this list — see lib/articleWriter.js.
const ARTICLE_TYPE_WEIGHTS = { tutorials: 35, troubleshooting: 30, 'buying-guides': 20, reviews: 15 };
const VALID_TYPES = Object.keys(ARTICLE_TYPE_WEIGHTS);

// Set ARTICLE_TYPE (e.g. ARTICLE_TYPE=tutorials) to force a specific type
// instead of the normal random weighted pick — used for the dedicated
// tutorial/troubleshooting commands and their own schedule.
function pickArticleType() {
  const forced = process.env.ARTICLE_TYPE;
  if (forced) {
    if (!VALID_TYPES.includes(forced)) {
      throw new Error(`ARTICLE_TYPE must be one of: ${VALID_TYPES.join(', ')} (got "${forced}")`);
    }
    return forced;
  }

  const entries = Object.entries(ARTICLE_TYPE_WEIGHTS);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [type, weight] of entries) {
    if (roll < weight) return type;
    roll -= weight;
  }
  return entries[0][0];
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

async function generateUniqueSlug(baseTitle) {
  const base = slugify(baseTitle);
  if (!supabase) return `${base}-${Date.now().toString(36)}`;

  let candidate = base;
  let suffix = 2;
  while (true) {
    const { data } = await supabase.from('cartzilla_articles').select('slug').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

function buildCategoryBanner(collection) {
  return `
<div class="category-banner">
  <p class="category-banner-label">🛒 Shop ${collection.title}</p>
  <p>See current options in this category on Cartzilla.</p>
  <a href="${collection.url}" class="btn" target="_blank" rel="noopener">Browse ${collection.title} &rarr;</a>
</div>
`;
}

async function announceOnSocial({ articleTitle, articleUrl, imageUrl, dek, logMeta }) {
  const facebookMessage = `New on the blog: ${articleTitle}\n\n${dek}\n\n${articleUrl}`;
  const instagramCaption = `${articleTitle}\n\n${dek}\n\nFull guide — link in bio.`;
  const threadsText = `${articleTitle}\n\n${articleUrl}`;

  const results = {};
  results.facebook = await postToFacebookPage({ message: facebookMessage, link: articleUrl, imageUrl, dryRun: DRY_RUN, meta: logMeta });
  results.instagram = await postToInstagram({ imageUrl, caption: instagramCaption, dryRun: DRY_RUN, meta: logMeta });
  results.threads = await postToThreads({ text: threadsText, imageUrl, dryRun: DRY_RUN, meta: logMeta });
  results.pinterest = await createPin({
    imageUrl,
    title: articleTitle.slice(0, 100),
    description: dek.slice(0, 500),
    link: articleUrl,
    dryRun: DRY_RUN,
    meta: logMeta,
  });
  return results;
}

async function main() {
  console.log(`\n=== Cartzilla article writer — ${new Date().toISOString()} ===`);
  console.log(`Live mode: ${isLiveModeEnabled() ? 'ON' : 'off (dry-run only)'}`);

  const collections = await fetchEligibleCollections();
  console.log(`Found ${collections.length} eligible collection(s).`);
  if (collections.length === 0) {
    console.log('No eligible collections — exiting.');
    return;
  }

  const collection = await pickNextCollection(collections, { postTypes: ['blog_article'] });
  if (!collection) {
    console.log('No eligible collection available for a new article today — exiting.');
    return;
  }

  const articleType = pickArticleType();
  console.log(`Selected category: "${collection.title}" — article type: ${articleType}`);

  let written;
  try {
    written = await generateArticle(collection, articleType);
  } catch (err) {
    console.error(`[error] Writing failed: ${err.message}`);
    process.exit(1);
  }

  const bannerHtml = buildCategoryBanner(collection);
  const bodyWithBanner = insertMidArticleBanner(written.body_html, bannerHtml);

  const slug = await generateUniqueSlug(written.meta_title || written.title);
  const articleUrl = `${SITE_URL}/article/${slug}`;

  console.log('Generating a real, topic-specific image (bright, on-brand — not a product photo)...');
  const imageBuffer = await generateArticleImage({ title: written.title, category: articleType });
  let imageUrl = null;
  if (imageBuffer && !DRY_RUN) {
    imageUrl = await storeGeneratedImage(imageBuffer, `article-${slug}.png`);
  }
  if (!imageUrl) imageUrl = collection.imageUrl; // fall back to a real category photo if generation failed

  if (DRY_RUN) {
    console.log(`[dry-run] Title: ${written.title}`);
    console.log(`[dry-run] Category: ${articleType}`);
    console.log(`[dry-run] Would link banner to: ${collection.title} (${collection.url})`);
    console.log(`[dry-run] Would use image: ${imageBuffer ? '(newly generated)' : `(fallback: ${collection.imageUrl})`}`);
    console.log(`[dry-run] Body with banner:\n${bodyWithBanner}`);
    console.log('[dry-run] Would announce on Facebook, Instagram, Threads, and Pinterest.');
    return;
  }

  if (!supabase) {
    console.error('[error] Supabase not configured — cannot save the article.');
    process.exit(1);
  }

  const { error } = await supabase.from('cartzilla_articles').insert({
    slug,
    title: written.title,
    meta_title: written.meta_title,
    dek: written.dek,
    body_html: bodyWithBanner,
    category: articleType,
    image_url: imageUrl,
    product_url: collection.url,
    product_title: collection.title,
  });

  if (error) {
    console.error(`[error] Could not save article: ${error.message}`);
    process.exit(1);
  }
  console.log(`Published: ${articleUrl}`);

  await logPost({
    shopifyProductId: collection.id,
    productTitle: written.title,
    productUrl: articleUrl,
    postType: 'blog_article',
    platform: 'cartzilla_site',
    caption: written.title,
    imageUrl,
    status: 'success',
  });

  const logMeta = { shopifyProductId: collection.id, productTitle: written.title, productUrl: articleUrl, postType: 'blog_article_announcement' };
  const socialResults = await announceOnSocial({
    articleTitle: written.title,
    articleUrl,
    imageUrl,
    dek: written.dek,
    logMeta,
  });
  console.log('Social announcement results:', JSON.stringify(socialResults, null, 2));

  console.log('=== Done ===');
}

main().catch((err) => {
  console.error('Fatal error in write-article.js:', err);
  process.exit(1);
});
