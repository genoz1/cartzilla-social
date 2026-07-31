// Checks the golf cart industry RSS sources for new items, screens each for
// appropriateness, writes an honest source-credited summary, publishes it
// into cartzilla_articles (category: news), and announces it on social.
// Dedup works two ways, same as Florida Buzz's automate.js: alreadySeen()
// catches the same RSS item appearing again, and titleSimilarity() catches
// the same real-world story picked up independently by two different feeds.
require('dotenv').config();
const Parser = require('rss-parser');
const { supabase } = require('../lib/supabase');
const { isAppropriate, writeNewsArticle } = require('../lib/newsWriter');
const { postToFacebookPage } = require('../lib/facebook');
const { createPost: postToInstagram } = require('../lib/instagram');
const { createPost: postToThreads } = require('../lib/threads');
const { createPin } = require('../lib/pinterest');
const { logPost } = require('../lib/postLog');
const { isLiveModeEnabled } = require('../lib/safeguards');
const SOURCES = require('./sources');

const parser = new Parser({
  timeout: 15000,
  customFields: { item: [['media:content', 'mediaContent', { keepArray: true }]] },
});
const DRY_RUN = process.env.DRY_RUN === 'true';
const MAX_ITEMS_PER_SOURCE = parseInt(process.env.MAX_ITEMS_PER_SOURCE, 10) || 3;
const SITE_URL = process.env.SITE_URL || 'https://cartzillagolfcart.com';

function extractImage(item) {
  if (Array.isArray(item.mediaContent) && item.mediaContent[0]?.$?.url) {
    return item.mediaContent[0].$.url;
  }
  return null;
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
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

async function alreadySeen(guid) {
  if (!supabase) return false;
  const { data } = await supabase.from('cartzilla_seen_feed_items').select('id').eq('guid', guid).maybeSingle();
  return !!data;
}

async function markSeen(guid) {
  if (!supabase || DRY_RUN) return;
  await supabase.from('cartzilla_seen_feed_items').insert({ guid });
}

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

async function isDuplicateOfRecent(title) {
  if (!supabase) return false;
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase.from('cartzilla_articles').select('title').eq('category', 'news').gte('published_at', since);
  if (!data) return false;
  return data.some((a) => titleSimilarity(title, a.title) >= 0.5);
}

async function announceOnSocial({ articleTitle, articleUrl, imageUrl, dek, logMeta }) {
  const facebookMessage = `${articleTitle}\n\n${dek}\n\n${articleUrl}`;
  const results = {};
  results.facebook = await postToFacebookPage({ message: facebookMessage, link: articleUrl, dryRun: DRY_RUN, meta: logMeta });
  if (imageUrl) {
    results.instagram = await postToInstagram({ imageUrl, caption: `${articleTitle}\n\n${dek}\n\nFull story — link in bio.`, dryRun: DRY_RUN, meta: logMeta });
    results.threads = await postToThreads({ text: `${articleTitle}\n\n${articleUrl}`, imageUrl, dryRun: DRY_RUN, meta: logMeta });
    results.pinterest = await createPin({ imageUrl, title: articleTitle.slice(0, 100), description: dek.slice(0, 500), link: articleUrl, dryRun: DRY_RUN, meta: logMeta });
  }
  return results;
}

async function run() {
  console.log(`\n=== Cartzilla news writer — ${new Date().toISOString()} ===`);
  if (DRY_RUN) console.log('DRY RUN: nothing will be saved or posted.\n');

  for (const source of SOURCES) {
    console.log(`Checking ${source.name}...`);
    let feed;
    try {
      feed = await parser.parseURL(source.url);
    } catch (err) {
      console.error(`  [error] Could not load feed: ${err.message}`);
      continue;
    }

    const itemsToCheck = (feed.items || []).slice(0, MAX_ITEMS_PER_SOURCE);
    for (const item of itemsToCheck) {
      const guid = item.guid || item.link;
      if (await alreadySeen(guid)) {
        console.log(`  Already covered: "${item.title}"`);
        continue;
      }

      console.log(`  New item: "${item.title}" — checking content...`);
      const summary = item.contentSnippet || item.content || item.title;
      const ok = await isAppropriate(item.title, summary);
      if (!ok) {
        console.log('  [skip] Not a fit for the site — skipping.');
        await markSeen(guid);
        continue;
      }

      let article;
      try {
        article = await writeNewsArticle({ sourceTitle: item.title, sourceSummary: summary, sourceName: source.name, sourceUrl: item.link });
      } catch (err) {
        console.error(`  [error] Writing failed: ${err.message}`);
        await markSeen(guid);
        continue;
      }

      if (!DRY_RUN && (await isDuplicateOfRecent(article.title))) {
        console.log('  [skip] Looks like the same story as something published in the last 3 days — skipping.');
        await markSeen(guid);
        continue;
      }

      const slug = await generateUniqueSlug(article.meta_title || article.title);
      const imageUrl = extractImage(item) || '/img/placeholder.jpg';
      const articleUrl = `${SITE_URL}/article/${slug}`;

      if (DRY_RUN) {
        console.log(`  [dry-run] Title: ${article.title}`);
        console.log(`  [dry-run] Body:\n${article.body_html}`);
      } else if (supabase) {
        const { error } = await supabase.from('cartzilla_articles').insert({
          slug,
          title: article.title,
          meta_title: article.meta_title,
          dek: article.dek,
          body_html: article.body_html,
          category: 'news',
          image_url: imageUrl,
          source_name: source.name,
          source_url: item.link,
        });
        if (error) {
          console.error(`  [error] Could not save article: ${error.message}`);
          continue;
        }
        console.log(`  Saved: ${articleUrl}`);

        await logPost({ shopifyProductId: guid, productTitle: article.title, productUrl: articleUrl, postType: 'news_article', platform: 'cartzilla_site', caption: article.title, imageUrl, status: 'success' });

        const logMeta = { shopifyProductId: guid, productTitle: article.title, productUrl: articleUrl, postType: 'news_article_announcement' };
        const socialResults = await announceOnSocial({ articleTitle: article.title, articleUrl, imageUrl, dek: article.dek, logMeta });
        console.log('  Social results:', JSON.stringify(socialResults));
      }

      await markSeen(guid);
    }
  }

  console.log('\n=== Run complete ===');
}

run().catch((err) => {
  console.error('Fatal error in news writer run:', err);
  process.exit(1);
});
