const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

const CATEGORY_LABELS = {
  news: '📰 Golf Cart News',
  tutorials: '🔧 Tutorials & How-To',
  troubleshooting: '⚡ Troubleshooting',
  'buying-guides': '🛒 Buying Guides',
  reviews: '⭐ Product Reviews',
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

router.get('/sitemap.xml', async (req, res) => {
  const SITE_URL = process.env.SITE_URL || 'https://cartzillagolfcart.com';
  const staticPaths = ['/', '/about', '/videos', ...CATEGORY_ORDER.map((c) => `/category/${c}`)];

  let articleSlugs = [];
  if (supabase) {
    const { data } = await supabase.from('cartzilla_articles').select('slug, published_at').order('published_at', { ascending: false });
    articleSlugs = data || [];
  }

  const urls = [
    ...staticPaths.map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`),
    ...articleSlugs.map((a) => `  <url><loc>${SITE_URL}/article/${a.slug}</loc><lastmod>${new Date(a.published_at).toISOString().split('T')[0]}</lastmod></url>`),
  ];

  res.set('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`);
});

// Rough reading time from body_html word count — no stored field for this,
// so it's computed on the fly from the actual content each time.
function estimateReadTime(bodyHtml) {
  const text = (bodyHtml || '').replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

router.get('/', async (req, res) => {
  let newsArticles = [];
  let guideArticles = [];
  if (supabase) {
    const [newsResult, guidesResult] = await Promise.all([
      supabase.from('cartzilla_articles').select('*').eq('category', 'news').order('published_at', { ascending: false }).limit(4),
      supabase.from('cartzilla_articles').select('*').neq('category', 'news').order('published_at', { ascending: false }).limit(6),
    ]);
    newsArticles = newsResult.data || [];
    guideArticles = guidesResult.data || [];
  }
  res.render('home', { newsArticles, guideArticles, categoryLabels: CATEGORY_LABELS, estimateReadTime });
});

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  let results = [];
  if (supabase && q) {
    const { data } = await supabase
      .from('cartzilla_articles')
      .select('*')
      .or(`title.ilike.%${q}%,dek.ilike.%${q}%,body_html.ilike.%${q}%`)
      .order('published_at', { ascending: false })
      .limit(30);
    results = data || [];
  }
  res.render('search', { results, searchQuery: q, categoryLabels: CATEGORY_LABELS, estimateReadTime });
});

router.get('/category/:category', async (req, res) => {
  const { category } = req.params;
  if (!CATEGORY_ORDER.includes(category)) {
    return res.status(404).send('Category not found');
  }
  let articles = [];
  if (supabase) {
    const { data } = await supabase
      .from('cartzilla_articles')
      .select('*')
      .eq('category', category)
      .order('published_at', { ascending: false })
      .limit(24);
    articles = data || [];
  }
  res.render('category', { category, articles, categoryLabels: CATEGORY_LABELS });
});

router.get('/article/:slug', async (req, res) => {
  const { slug } = req.params;
  if (!supabase) return res.status(404).send('Not found');

  const { data: article } = await supabase
    .from('cartzilla_articles')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!article) return res.status(404).send('Article not found');

  const { data: related } = await supabase
    .from('cartzilla_articles')
    .select('slug, title, dek, image_url, category')
    .eq('category', article.category)
    .neq('slug', slug)
    .order('published_at', { ascending: false })
    .limit(3);

  res.render('article', { article, related: related || [], categoryLabels: CATEGORY_LABELS });
});

router.get('/about', (req, res) => {
  res.render('about');
});

router.get('/videos', async (req, res) => {
  const q = (req.query.q || '').trim();
  let videos = [];
  if (supabase) {
    let query = supabase.from('cartzilla_videos').select('*').order('added_at', { ascending: false });
    if (q) {
      // Matches against title OR channel name, case-insensitive
      query = query.or(`title.ilike.%${q}%,channel_name.ilike.%${q}%`);
    }
    const { data } = await query;
    videos = data || [];
  }
  res.render('videos', { videos, category: 'videos', searchQuery: q });
});

module.exports = router;
