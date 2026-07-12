require('dotenv').config();
const express = require('express');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 8081;

app.get('/', (req, res) => {
  res.send('Cartzilla social automation is running.');
});

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
  console.log(`Cartzilla social automation running on port ${PORT}`);
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

  console.log(`Cartzilla posts scheduled: 10am (educational) and 6pm (spotlight) Eastern daily. LIVE MODE is ${process.env.CARTZILLA_LIVE_MODE === 'true' ? 'ON — real posts will publish.' : 'OFF — runs will log/dry-run only.'}`);
} else {
  console.log('Cartzilla posting NOT scheduled — set CARTZILLA_SHOPIFY_STORE_DOMAIN, CARTZILLA_SHOPIFY_CLIENT_ID, CARTZILLA_SHOPIFY_CLIENT_SECRET, ANTHROPIC_API_KEY, CARTZILLA_SUPABASE_URL, and CARTZILLA_SUPABASE_SERVICE_KEY to enable.');
}
