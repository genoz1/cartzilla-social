require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8081;

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', require('./routes/main'));

// Simple health endpoint so you (or an uptime monitor) can confirm the
// service is up and see whether live posting is armed.
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    liveMode: process.env.CARTZILLA_LIVE_MODE === 'true',
    time: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Cartzilla running on port ${PORT}`);
});

const hasShopifyCreds = !!(process.env.CARTZILLA_SHOPIFY_STORE_DOMAIN && process.env.CARTZILLA_SHOPIFY_CLIENT_ID && process.env.CARTZILLA_SHOPIFY_CLIENT_SECRET);
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
const hasSupabase = !!(process.env.CARTZILLA_SUPABASE_URL && process.env.CARTZILLA_SUPABASE_SERVICE_KEY);

// Both scheduled jobs require Shopify + Anthropic + Supabase to be
// configured at minimum. Whether they actually PUBLISH anything further
// depends on CARTZILLA_LIVE_MODE=true, checked separately inside each
// platform posting library (lib/facebook.js, etc.) — so even if this cron
// fires, nothing goes out live unless that switch is explicitly on.
if (hasShopifyCreds && hasAnthropicKey && hasSupabase) {
  cron.schedule('0 10 * * *', () => {
    console.log('Running scheduled Cartzilla educational post...');
    require('child_process').exec('node scripts/post-educational.js', (err, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    });
  }, { timezone: 'America/New_York' });

  cron.schedule('0 18 * * *', () => {
    console.log('Running scheduled Cartzilla spotlight post...');
    require('child_process').exec('node scripts/post-spotlight.js', (err, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    });
  }, { timezone: 'America/New_York' });

  // Opt-in separately from the master schedule above: this content is
  // general repair/diagnostic knowledge, not grounded in your Shopify
  // product data like the other two, so it's worth reviewing via
  // `npm run test-mode-category` before turning this on. Only arms once
  // you explicitly set CARTZILLA_CATEGORY_HOWTO_ENABLED=true.
  if (process.env.CARTZILLA_CATEGORY_HOWTO_ENABLED === 'true') {
    cron.schedule('0 14 * * *', () => {
      console.log('Running scheduled Cartzilla category how-to post...');
      require('child_process').exec('node scripts/post-category-howto.js', (err, stdout, stderr) => {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
      });
    }, { timezone: 'America/New_York' });
    console.log('Cartzilla category how-to post also scheduled: 2pm Eastern daily.');
  }

  console.log(`Cartzilla posts scheduled: 10am (educational) and 6pm (spotlight) Eastern daily. LIVE MODE is ${process.env.CARTZILLA_LIVE_MODE === 'true' ? 'ON — real posts will publish.' : 'OFF — runs will log/dry-run only.'}`);

  // Opt-in separately: writes a real article to the content site
  // (cartzilla_articles) and announces it on all 4 platforms — a bigger
  // action than a social caption, so review a dry-run batch first via
  // `npm run write-article:dry` before setting this true.
  if (process.env.CARTZILLA_WRITE_ARTICLES_ENABLED === 'true') {
    cron.schedule('0 9 * * *', () => {
      console.log('Running scheduled Cartzilla article writer...');
      require('child_process').exec('node scripts/write-article.js', (err, stdout, stderr) => {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
      });
    }, { timezone: 'America/New_York' });
    console.log('Cartzilla article writer also scheduled: 9am Eastern daily.');
  }

  // Opt-in separately: pulls from real golf cart industry RSS sources
  // (scripts/sources.js) and writes honest, source-credited news summaries.
  // Review a dry-run batch via `npm run write-news:dry` before enabling.
  if (process.env.CARTZILLA_WRITE_NEWS_ENABLED === 'true') {
    cron.schedule('30 8,16 * * *', () => {
      console.log('Running scheduled Cartzilla news writer...');
      require('child_process').exec('node scripts/write-news.js', (err, stdout, stderr) => {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
      });
    }, { timezone: 'America/New_York' });
    console.log('Cartzilla news writer also scheduled: 8:30am and 4:30pm Eastern daily.');
  }
} else {
  console.log('Cartzilla posting NOT scheduled — set CARTZILLA_SHOPIFY_STORE_DOMAIN, CARTZILLA_SHOPIFY_CLIENT_ID, CARTZILLA_SHOPIFY_CLIENT_SECRET, ANTHROPIC_API_KEY, CARTZILLA_SUPABASE_URL, and CARTZILLA_SUPABASE_SERVICE_KEY to enable.');
}
