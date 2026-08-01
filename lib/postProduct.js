const { captionAlreadyUsed } = require('./safeguards');
const { postToFacebookPage } = require('./facebook');
const { createPost: postToInstagram } = require('./instagram');
const { createPost: postToThreads } = require('./threads');
const { createPin } = require('./pinterest');
const { logPost } = require('./postLog');

// Posts one product, one post type, across all four platforms. Re-checks
// caption uniqueness right before each platform call (not just once up
// front) since this can run across a slow multi-minute sequence.
async function postProductEverywhere({ product, postType, captions, dryRun }) {
  const meta = {
    shopifyProductId: product.id,
    productTitle: product.title,
    productUrl: product.url,
    postType,
  };

  const results = {};

  for (const [platform, caption] of [
    ['facebook', captions.facebook],
    ['instagram', captions.instagram],
    ['threads', captions.threads],
  ]) {
    if (await captionAlreadyUsed(caption)) {
      console.log(`  [skip] ${platform}: this exact caption has already been posted before — skipping to avoid a duplicate.`);
      await logPost({ ...meta, platform, caption, status: 'failed', errorDetail: 'Skipped: duplicate caption' });
      results[platform] = { ok: false, skipped: true, reason: 'duplicate_caption' };
      continue;
    }

    if (platform === 'facebook') {
      results.facebook = await postToFacebookPage({ message: caption, link: product.url, imageUrl: product.imageUrl, dryRun, meta });
    } else if (platform === 'instagram') {
      results.instagram = await postToInstagram({ imageUrl: product.imageUrl, caption, dryRun, meta });
    } else if (platform === 'threads') {
      results.threads = await postToThreads({ text: caption, imageUrl: product.imageUrl, dryRun, meta });
    }
  }

  const pinterestCaption = `${captions.pinterest_title} — ${captions.pinterest_description}`;
  if (await captionAlreadyUsed(pinterestCaption)) {
    console.log('  [skip] pinterest: this exact caption has already been posted before — skipping to avoid a duplicate.');
    await logPost({ ...meta, platform: 'pinterest', caption: pinterestCaption, status: 'failed', errorDetail: 'Skipped: duplicate caption' });
    results.pinterest = { ok: false, skipped: true, reason: 'duplicate_caption' };
  } else {
    results.pinterest = await createPin({
      imageUrl: product.imageUrl,
      title: captions.pinterest_title,
      description: captions.pinterest_description,
      link: product.url,
      dryRun,
      meta,
    });
  }

  return results;
}

module.exports = { postProductEverywhere };
