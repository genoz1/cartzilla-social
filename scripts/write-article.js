// Writes a general-topic article, publishes it into cartzilla_articles,
// and optionally announces it on social. Topics come from the static
// catalog in lib/topics.js (Shopify-independent). Affiliate CTAs are
// built only when credentials exist; otherwise banners stay informational.
require('dotenv').config();
const { supabase, storeGeneratedImage } = require('../lib/supabase');
const { listTopics } = require('../lib/topics');
const { pickNextCollection } = require('../lib/rotation');
const { generateArticle, insertMidArticleBanner } = require('../lib/articleWriter');
const { generateArticleImage } = require('../lib/imageGen');
const { buildTopicCta, disclosureHtml, amazonSearchUrl, affiliateReady } = require('../lib/affiliate');
const { textProvider } = require('../lib/ai');
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

const ARTICLE_TYPE_WEIGHTS = { tutorials: 35, troubleshooting: 30, 'buying-guides': 20, reviews: 15 };
const VALID_TYPES = Object.keys(ARTICLE_TYPE_WEIGHTS);

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
  console.log(`Text AI provider: ${textProvider() || 'none'}`);
  console.log(`Affiliate tag configured: ${affiliateReady() ? 'yes' : 'no (CTA links will omit tracking)'}`);

  const topics = listTopics();
  console.log(`Found ${topics.length} static topic(s) (Shopify-independent).`);
  if (topics.length === 0) {
    console.log('No topics configured — exiting.');
    return;
  }

  const articleType = pickArticleType();
  const topic = await pickNextCollection(topics, { postTypes: [`blog_article_${articleType}`] });
  if (!topic) {
    console.log(`No eligible topic available for a new ${articleType} article today — exiting.`);
    return;
  }

  console.log(`Selected topic: "${topic.title}" — article type: ${articleType}`);

  const recentTitles = await fetchRecentTitles(articleType);

  let written;
  try {
    written = await generateArticle(topic, articleType, recentTitles);

    let duplicateOf = recentTitles.find((t) => titleSimilarity(written.title, t) >= 0.6);
    if (duplicateOf) {
      console.log(`  This came out too similar to an existing article ("${duplicateOf}") — retrying once...`);
      written = await generateArticle(topic, articleType, [...recentTitles, `(too similar to avoid) ${duplicateOf}`]);
      duplicateOf = recentTitles.find((t) => titleSimilarity(written.title, t) >= 0.6);
      if (duplicateOf) {
        console.log(`  [warn] Still similar to "${duplicateOf}" after retrying — publishing anyway.`);
      }
    }
  } catch (err) {
    console.error(`[error] Writing failed: ${err.message}`);
    process.exit(1);
  }

  const bannerHtml = buildTopicCta(topic) + disclosureHtml();
  const bodyWithBanner = insertMidArticleBanner(written.body_html, bannerHtml);
  const outboundUrl = amazonSearchUrl(topic.amazonSearch || topic.title);

  const slug = await generateUniqueSlug(written.meta_title || written.title);
  const articleUrl = `${SITE_URL}/article/${slug}`;

  console.log('Generating a topic-specific image (bright, on-brand)...');
  const imageBuffer = await generateArticleImage({ title: written.title, category: articleType });
  let imageUrl = null;
  if (imageBuffer && !DRY_RUN) {
    imageUrl = await storeGeneratedImage(imageBuffer, `article-${slug}.png`);
  }
  if (!imageUrl) imageUrl = topic.imageUrl || null;

  if (DRY_RUN) {
    console.log(`[dry-run] Title: ${written.title}`);
    console.log(`[dry-run] Category: ${articleType}`);
    console.log(`[dry-run] Outbound CTA: ${outboundUrl || '(none)'}`);
    console.log(`[dry-run] Would use image: ${imageBuffer ? '(newly generated)' : '(none / placeholder)'}`);
    console.log(`[dry-run] Body with banner:\n${bodyWithBanner.slice(0, 1200)}...`);
    console.log('[dry-run] Would announce on social unless SKIP_SOCIAL=true.');
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
    product_url: outboundUrl,
    product_title: topic.title,
  });

  if (error) {
    console.error(`[error] Could not save article: ${error.message}`);
    process.exit(1);
  }
  console.log(`Published: ${articleUrl}`);

  await logPost({
    shopifyProductId: topic.id,
    productTitle: written.title,
    productUrl: articleUrl,
    postType: `blog_article_${articleType}`,
    platform: 'cartzilla_site',
    caption: written.title,
    imageUrl,
    status: 'success',
  });

  const logMeta = { shopifyProductId: topic.id, productTitle: written.title, productUrl: articleUrl, postType: 'blog_article_announcement' };
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
