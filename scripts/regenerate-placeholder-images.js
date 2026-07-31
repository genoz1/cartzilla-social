// One-off: regenerates a real, topic-specific image for each article
// currently using the generic shared placeholder, and updates its row.
// Safe to re-run — it only touches rows where image_url is still the
// placeholder, so it won't overwrite real photos already in place.
require('dotenv').config();
const { supabase, storeGeneratedImage } = require('../lib/supabase');
const { generateArticleImage } = require('../lib/imageGen');

async function main() {
  if (!supabase) {
    console.error('[error] Supabase not configured.');
    process.exit(1);
  }

  const { data: articles, error } = await supabase
    .from('cartzilla_articles')
    .select('id, slug, title, category, image_url')
    .eq('image_url', '/img/placeholder.jpg');

  if (error) {
    console.error(`[error] Could not fetch articles: ${error.message}`);
    process.exit(1);
  }

  console.log(`Found ${articles.length} article(s) still using the placeholder image.`);

  for (const article of articles) {
    console.log(`\nGenerating image for: "${article.title}"...`);
    const buffer = await generateArticleImage({ title: article.title, category: article.category });
    if (!buffer) {
      console.log('  [skip] Generation failed — leaving placeholder in place for this one.');
      continue;
    }
    const imageUrl = await storeGeneratedImage(buffer, `article-${article.slug}.png`);
    if (!imageUrl) {
      console.log('  [skip] Upload failed — leaving placeholder in place for this one.');
      continue;
    }
    const { error: updateError } = await supabase
      .from('cartzilla_articles')
      .update({ image_url: imageUrl })
      .eq('id', article.id);
    if (updateError) {
      console.log(`  [error] Could not update row: ${updateError.message}`);
      continue;
    }
    console.log(`  Updated: ${imageUrl}`);
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
