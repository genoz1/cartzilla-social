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

function normalizeForSimilarity(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
}

function titleSimilarity(a, b) {
  const wordsA = new Set(normalizeForSimilarity(a));
  const wordsB = new Set(normalizeForSimilarity(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

// Fetches recent titles in this category (both to steer the AI away from
// repeating a topic up front, and to double-check the result afterward).
// Looked at a longer window than the news pipeline's 3 days — a
// troubleshooting/tutorial topic doesn't go stale the way a news story
// does, so a duplicate from a month ago is just as much a duplicate as one
// from yesterday.
async function fetchRecentTitles(articleType, limit = 30) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('cartzilla_articles')
    .select('title')
    .eq('category', articleType)
    .order('published_at', { ascending: false })
    .limit(limit);
  return (data || []).map((a) => a.title);
}

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

  const articleType = pickArticleType();

  // Type-specific rotation pool (e.g. 'blog_article_tutorials' vs
  // 'blog_article_troubleshooting') rather than one shared 'blog_article'
  // bucket — otherwise a collection used for a tutorial today would also
  // be blocked from getting a buying guide today, needlessly shrinking the
  // pool when you have several types running the same day.
  const collection = await pickNextCollection(collections, { postTypes: [`blog_article_${articleType}`] });
  if (!collection) {
    console.log(`No eligible collection available for a new ${articleType} article today — exiting.`);
    return;
  }

  console.log(`Selected category: "${collection.title}" — article type: ${articleType}`);

  const recentTitles = await fetchRecentTitles(articleType);

  let written;
  try {
    written = await generateArticle(collection, articleType, recentTitles);

    // Even with the "avoid these" instruction, double-check the actual
    // result — models don't always follow that instruction perfectly. One
    // retry, explicitly calling out which title it duplicated, before
    // giving up and just publishing what we got.
    let duplicateOf = recentTitles.find((t) => titleSimilarity(written.title, t) >= 0.6);
    if (duplicateOf) {
      console.log(`  This came out too similar to an existing article ("${duplicateOf}") — retrying once with that called out explicitly...`);
      written = await generateArticle(collection, articleType, [...recentTitles, `(too similar to avoid) ${duplicateOf}`]);
      duplicateOf = recentTitles.find((t) => titleSimilarity(written.title, t) >= 0.6);
      if (duplicateOf) {
        console.log(`  [warn] Still similar to "${duplicateOf}" after retrying — publishing anyway rather than looping indefinitely, but flagging this for review.`);
      }
    }
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
    postType: `blog_article_${articleType}`,
    platform: 'cartzilla_site',
    caption: written.title,
    imageUrl,
    status: 'success',
  });

  const logMeta = { shopifyProductId: collection.id, productTitle: written.title, productUrl: articleUrl, postType: 'blog_article_announcement' };
  if (process.env.SKIP_SOCIAL === 'true') {
    console.log('SKIP_SOCIAL is set — article saved to the site but not announced on social.');
  } else {
    const socialResults = await announceOnSocial({
      articleTitle: written.title,
      articleUrl,
      imageUrl,
      dek: written.dek,
      logMeta,
    });
    console.log('Social announcement results:', JSON.stringify(socialResults, null, 2));
  }

  console.log('=== Done ===');
}

main().catch((err) => {
  console.error('Fatal error in write-article.js:', err);
  process.exit(1);
});
