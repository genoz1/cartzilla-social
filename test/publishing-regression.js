const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('OpenAI chat client exists and text writers use askAI', () => {
  const openai = fs.readFileSync(path.join(root, 'lib/openai.js'), 'utf8');
  assert.match(openai, /askOpenAI/);
  assert.match(openai, /chat\/completions/);
  assert.match(openai, /gpt-4o-mini/);

  for (const file of ['lib/articleWriter.js', 'lib/newsWriter.js', 'lib/imageGen.js', 'lib/captions.js', 'lib/videoRelevance.js']) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(src, /askAI/, `${file} should call askAI`);
    assert.doesNotMatch(src, /require\('\.\/anthropic'\)/, `${file} should not import anthropic directly`);
  }
});

test('content cron no longer requires Shopify credentials', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(src, /contentArmed/);
  assert.match(src, /shopifySocialArmed/);
  assert.match(src, /hasTextAI/);
  // Content writers must not sit only inside hasShopifyCreds gate.
  const contentBlock = src.slice(src.indexOf('if (contentArmed)'));
  assert.match(contentBlock, /CARTZILLA_WRITE_ARTICLES_ENABLED/);
  assert.match(contentBlock, /buying-guides/);
});

test('write-article uses static topics, not live Shopify collections', () => {
  const src = fs.readFileSync(path.join(root, 'scripts/write-article.js'), 'utf8');
  assert.match(src, /listTopics/);
  assert.match(src, /buildTopicCta/);
  assert.doesNotMatch(src, /fetchEligibleCollections/);
  assert.doesNotMatch(src, /require\('\.\.\/lib\/shopify'\)/);
});

test('affiliate helpers do not invent tracking IDs', () => {
  const { amazonSearchUrl, affiliateReady, shopifyEnabled, buildTopicCta } = require('../lib/affiliate');
  delete process.env.CARTZILLA_AMAZON_ASSOCIATE_TAG;
  delete process.env.CARTZILLA_SHOPIFY_ENABLED;
  assert.equal(affiliateReady(), false);
  assert.equal(shopifyEnabled(), false);
  const url = amazonSearchUrl('golf cart battery charger');
  assert.match(url, /amazon\.com\/s\?k=/);
  assert.doesNotMatch(url, /tag=/);
  process.env.CARTZILLA_AMAZON_ASSOCIATE_TAG = 'cartzilla-20';
  assert.equal(affiliateReady(), true);
  assert.match(amazonSearchUrl('tires'), /tag=cartzilla-20/);
  const cta = buildTopicCta({ title: 'Brakes', amazonSearch: 'golf cart brake pads' });
  assert.match(cta, /rel="sponsored noopener"/);
  delete process.env.CARTZILLA_AMAZON_ASSOCIATE_TAG;
});

test('static topics cover high-intent affiliate categories', () => {
  const { listTopics } = require('../lib/topics');
  const topics = listTopics();
  assert.ok(topics.length >= 10);
  const titles = topics.map((t) => t.title.toLowerCase()).join(' | ');
  // Match "battery" or "batteries" (plural does not contain "battery" as a substring).
  assert.match(titles, /batter(?:y|ies)/);
  assert.match(titles, /dash/);
  assert.match(titles, /inflator|tire/);
  assert.match(titles, /cleaning|detail/);
});

test('shop nav falls back to buying guides when Shopify disabled', () => {
  const header = fs.readFileSync(path.join(root, 'views/partials/header.ejs'), 'utf8');
  assert.match(header, /shopHomeUrl/);
  assert.match(header, /\/category\/buying-guides/);
  assert.doesNotMatch(header, /CARTZILLA_SHOPIFY_PUBLIC_DOMAIN \? 'https:\/\/' \+ process\.env\.CARTZILLA_SHOPIFY_PUBLIC_DOMAIN/);
});

test('health endpoint exposes AI and Shopify status fields', () => {
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(src, /textAi/);
  assert.match(src, /shopifyEnabled/);
  assert.match(src, /writeArticlesEnabled/);
});
