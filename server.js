require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const path = require('path');
const { hasTextAI, textProvider } = require('./lib/ai');
const { shopifyEnabled, shopHomeUrl } = require('./lib/affiliate');

const app = express();
const PORT = process.env.PORT || 8081;

app.set('view engine', 'ejs');
// Locals available to every EJS template (Shop link softens when paused).
app.use((req, res, next) => {
  res.locals.shopHomeUrl = shopHomeUrl();
  res.locals.shopifyEnabled = shopifyEnabled();
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', require('./routes/main'));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    liveMode: process.env.CARTZILLA_LIVE_MODE === 'true',
    textAi: textProvider(),
    shopifyEnabled: shopifyEnabled(),
    writeArticlesEnabled: process.env.CARTZILLA_WRITE_ARTICLES_ENABLED === 'true',
    writeNewsEnabled: process.env.CARTZILLA_WRITE_NEWS_ENABLED === 'true',
    time: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Cartzilla running on port ${PORT}`);
});

const hasSupabase = !!(process.env.CARTZILLA_SUPABASE_URL && process.env.CARTZILLA_SUPABASE_SERVICE_KEY);
const hasShopifyCreds = !!(
  process.env.CARTZILLA_SHOPIFY_STORE_DOMAIN &&
  process.env.CARTZILLA_SHOPIFY_CLIENT_ID &&
  process.env.CARTZILLA_SHOPIFY_CLIENT_SECRET
);
// Product social posts still need Shopify; content publishing does not.
const shopifySocialArmed = hasShopifyCreds && shopifyEnabled() && hasTextAI() && hasSupabase;
const contentArmed = hasTextAI() && hasSupabase;

function runScript(label, command) {
  console.log(label);
  require('child_process').exec(command, (err, stdout, stderr) => {
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    if (err) console.error(`[error] ${label}: ${err.message}`);
  });
}

if (shopifySocialArmed) {
  cron.schedule('0 10 * * *', () => {
    runScript('Running scheduled Cartzilla educational post...', 'node scripts/post-educational.js');
  }, { timezone: 'America/New_York' });

  cron.schedule('0 18 * * *', () => {
    runScript('Running scheduled Cartzilla spotlight post...', 'node scripts/post-spotlight.js');
  }, { timezone: 'America/New_York' });

  if (process.env.CARTZILLA_CATEGORY_HOWTO_ENABLED === 'true') {
    cron.schedule('0 14 * * *', () => {
      runScript('Running scheduled Cartzilla category how-to post...', 'node scripts/post-category-howto.js');
    }, { timezone: 'America/New_York' });
    console.log('Cartzilla category how-to post also scheduled: 2pm Eastern daily.');
  }

  console.log(`Cartzilla Shopify social posts scheduled: 10am + 6pm ET. LIVE MODE is ${process.env.CARTZILLA_LIVE_MODE === 'true' ? 'ON' : 'OFF'}.`);
} else {
  console.log('Cartzilla Shopify social posts NOT scheduled (store paused / missing Shopify creds, or AI/Supabase missing). Content publishing can still run independently.');
}

if (contentArmed) {
  if (process.env.CARTZILLA_WRITE_ARTICLES_ENABLED === 'true') {
    // Keep schedule modest: 1 tutorial + 1 troubleshooting per day (not 4)
    // to control OpenAI spend after the migration repair.
    cron.schedule('0 8 * * *', () => {
      runScript('Running scheduled Cartzilla tutorial writer...', 'ARTICLE_TYPE=tutorials SKIP_SOCIAL=true node scripts/write-article.js');
    }, { timezone: 'America/New_York' });

    cron.schedule('15 8 * * *', () => {
      runScript('Running scheduled Cartzilla troubleshooting writer...', 'ARTICLE_TYPE=troubleshooting SKIP_SOCIAL=true node scripts/write-article.js');
    }, { timezone: 'America/New_York' });

    // Buying guides once daily (afternoon) — affiliate-ready topics.
    cron.schedule('0 13 * * *', () => {
      runScript('Running scheduled Cartzilla buying-guide writer...', 'ARTICLE_TYPE=buying-guides SKIP_SOCIAL=true node scripts/write-article.js');
    }, { timezone: 'America/New_York' });

    console.log('Cartzilla content writers scheduled: tutorial 8am, troubleshooting 8:15am, buying-guide 1pm ET (SKIP_SOCIAL default).');
  }

  if (process.env.CARTZILLA_WRITE_NEWS_ENABLED === 'true') {
    cron.schedule('30 7 * * *', () => {
      runScript('Running scheduled Cartzilla news writer...', 'node scripts/write-news.js');
    }, { timezone: 'America/New_York' });
    console.log('Cartzilla news writer scheduled: 7:30am Eastern daily.');
  }

  if (process.env.CARTZILLA_CHECK_VIDEOS_ENABLED === 'true') {
    cron.schedule('0 7 * * 1', () => {
      runScript('Running scheduled Cartzilla video checker...', 'node scripts/check-new-videos.js');
    }, { timezone: 'America/New_York' });
    console.log('Cartzilla video checker scheduled: Mondays 7am Eastern.');
  }

  if (
    process.env.CARTZILLA_WRITE_ARTICLES_ENABLED !== 'true' &&
    process.env.CARTZILLA_WRITE_NEWS_ENABLED !== 'true' &&
    process.env.CARTZILLA_CHECK_VIDEOS_ENABLED !== 'true'
  ) {
    console.log('Content AI ready, but no CARTZILLA_WRITE_* / CHECK_VIDEOS flags enabled yet.');
  }
} else {
  console.log('Cartzilla content publishing NOT scheduled — set OPENAI_API_KEY (preferred) or ANTHROPIC_API_KEY, plus CARTZILLA_SUPABASE_URL and CARTZILLA_SUPABASE_SERVICE_KEY.');
}
