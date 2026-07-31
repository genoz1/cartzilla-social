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

router.get('/', async (req, res) => {
  let articles = [];
  if (supabase) {
    const { data } = await supabase
      .from('cartzilla_articles')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(24);
    articles = data || [];
  }
  res.render('home', { articles, categoryLabels: CATEGORY_LABELS });
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

module.exports = router;
