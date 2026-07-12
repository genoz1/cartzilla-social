// Every posting attempt (success or failure) gets written here. This is
// also the single source of truth the rotation logic (lib/rotation.js)
// reads from to decide which product hasn't been posted in the longest
// time — there is no separate "state" table to keep in sync.
const { supabase } = require('./supabase');

async function logPost({
  shopifyProductId,
  productTitle,
  productUrl,
  postType,
  platform,
  caption,
  imageUrl,
  status,
  errorDetail,
}) {
  if (!supabase) {
    console.warn('  [warn] Supabase not configured — post log entry was NOT saved.');
    return;
  }
  try {
    await supabase.from('cartzilla_post_log').insert({
      shopify_product_id: String(shopifyProductId),
      product_title: productTitle,
      product_url: productUrl,
      post_type: postType,
      platform,
      caption: caption ? String(caption).slice(0, 2000) : null,
      image_url: imageUrl || null,
      status,
      error_detail: errorDetail ? String(errorDetail).slice(0, 1000) : null,
    });
  } catch (err) {
    // A logging failure should never take down the actual posting flow.
    console.error(`  [warn] Could not write to cartzilla_post_log: ${err.message}`);
  }
}

module.exports = { logPost };
