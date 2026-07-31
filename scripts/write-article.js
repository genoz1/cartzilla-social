// Writes a real article grounded in an actual Shopify product, publishes it
// into the cartzilla_articles table (the new content site — NOT Shopify's
// own blog), and announces it across all four social platforms. Rotation
// for these articles is tracked independently from the existing social-only
// post types (educational/spotlight/category_howto) via the postTypes
// filter in lib/rotation.js, using its own 'blog_article' post type.
require('dotenv').config();
const { supabase } = require('../lib/supabase');
const { fetchActiveProducts } = require('../lib/shopify');
const { pickNextProducts } = require('../lib/rotation');
const { generateArticle } = require('../lib/articleWriter');
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

function pickArticleType() {
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
  results.facebook = await postToFacebookPage({ message: facebookMessage, link: articleUrl, dryRun: DRY_RUN, meta: logMeta });
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

  const products = await fetchActiveProducts();
  console.log(`Found ${products.length} eligible product(s).`);
  if (products.length === 0) {
    console.log('No eligible products — exiting.');
    return;
  }

  const [product] = await pickNextProducts(products, 1, { postTypes: ['blog_article'] });
  if (!product) {
    console.log('No eligible product available for a new article today — exiting.');
    return;
  }

  const articleType = pickArticleType();
  console.log(`Selected product: "${product.title}" — article type: ${articleType}`);

  let written;
  try {
    written = await generateArticle(product, articleType);
  } catch (err) {
    console.error(`[error] Writing failed: ${err.message}`);
    process.exit(1);
  }

  const slug = await generateUniqueSlug(written.meta_title || written.title);
  const articleUrl = `${SITE_URL}/article/${slug}`;

  if (DRY_RUN) {
    console.log(`[dry-run] Title: ${written.title}`);
    console.log(`[dry-run] Category: ${articleType}`);
    console.log(`[dry-run] Would link to product: ${product.title} (${product.url})`);
    console.log(`[dry-run] Body:\n${written.body_html}`);
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
    body_html: written.body_html,
    category: articleType,
    image_url: product.imageUrl,
    product_url: product.url,
    product_title: product.title,
  });

  if (error) {
    console.error(`[error] Could not save article: ${error.message}`);
    process.exit(1);
  }
  console.log(`Published: ${articleUrl}`);

  await logPost({
    shopifyProductId: product.id,
    productTitle: written.title,
    productUrl: articleUrl,
    postType: 'blog_article',
    platform: 'cartzilla_site',
    caption: written.title,
    imageUrl: product.imageUrl,
    status: 'success',
  });

  const logMeta = { shopifyProductId: product.id, productTitle: written.title, productUrl: articleUrl, postType: 'blog_article_announcement' };
  const socialResults = await announceOnSocial({
    articleTitle: written.title,
    articleUrl,
    imageUrl: product.imageUrl,
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
