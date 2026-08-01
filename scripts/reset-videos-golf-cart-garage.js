// One-off: deletes every row currently in cartzilla_videos, then pulls
// Golf Cart Garage's ENTIRE uploads catalog (paginated — not just a small
// batch) and adds every genuinely relevant how-to video, skipping things
// like live-show announcements and channel intros via the same relevance
// check the weekly checker uses. This is specifically for Golf Cart
// Garage — if you want to bulk-import a different channel later, this
// script is easy to adapt (just change GOLF_CART_GARAGE below).
//
// Usage:
//   node scripts/reset-videos-golf-cart-garage.js         — does it for real
//   DRY_RUN=true node scripts/reset-videos-golf-cart-garage.js  — preview only, deletes nothing, saves nothing
//
// This channel has a large catalog, so this will make one relevance-check
// API call per video and can take a while — progress prints as it goes.
require('dotenv').config();
const { supabase } = require('../lib/supabase');
const { getUploadsPlaylistId, getAllUploads } = require('../lib/youtube');
const { isRelevantHowTo } = require('../lib/videoRelevance');

const DRY_RUN = process.env.DRY_RUN === 'true';
const DELAY_BETWEEN_CHECKS_MS = 500; // gentle pacing on the relevance-check API

const GOLF_CART_GARAGE = { name: 'Golf Cart Garage', handle: 'GolfCartGarage', url: 'https://www.youtube.com/@GolfCartGarage' };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deleteAllExistingVideos() {
  if (!supabase) {
    console.error('[error] Supabase not configured — cannot delete existing videos.');
    process.exit(1);
  }
  const { data: existing, error: fetchError } = await supabase.from('cartzilla_videos').select('id');
  if (fetchError) {
    console.error(`[error] Could not check existing videos: ${fetchError.message}`);
    process.exit(1);
  }
  const count = (existing || []).length;
  if (count === 0) {
    console.log('No existing videos to delete.');
    return;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] Would delete ${count} existing video(s).`);
    return;
  }

  // Supabase requires a filter on delete — .gt('id', '00000000-0000-0000-0000-000000000000')
  // matches every real UUID, since all real UUIDs sort above the all-zero one.
  const { error: deleteError } = await supabase.from('cartzilla_videos').delete().gt('id', '00000000-0000-0000-0000-000000000000');
  if (deleteError) {
    console.error(`[error] Could not delete existing videos: ${deleteError.message}`);
    process.exit(1);
  }
  console.log(`Deleted ${count} existing video(s).`);
}

async function run() {
  console.log(`\n=== Cartzilla bulk video import: ${GOLF_CART_GARAGE.name} — ${new Date().toISOString()} ===`);
  if (DRY_RUN) console.log('DRY RUN: nothing will be deleted or saved.\n');

  await deleteAllExistingVideos();

  console.log(`\nResolving ${GOLF_CART_GARAGE.name}'s channel...`);
  const playlistId = await getUploadsPlaylistId(GOLF_CART_GARAGE);
  if (!playlistId) {
    console.error('[error] Channel not found — check the handle in this script.');
    process.exit(1);
  }

  console.log('Fetching the complete uploads catalog (this pages through everything, may take a moment)...');
  const uploads = await getAllUploads(playlistId);
  console.log(`Found ${uploads.length} total video(s) on the channel.\n`);

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < uploads.length; i++) {
    const video = uploads[i];
    console.log(`[${i + 1}/${uploads.length}] "${video.title}"`);

    const relevant = await isRelevantHowTo(video.title, video.description);
    if (!relevant) {
      console.log('  [skip] Not genuine how-to content.');
      skipped++;
      await sleep(DELAY_BETWEEN_CHECKS_MS);
      continue;
    }

    if (DRY_RUN) {
      console.log('  [dry-run] Would add this video.');
      added++;
      await sleep(DELAY_BETWEEN_CHECKS_MS);
      continue;
    }

    const { error } = await supabase.from('cartzilla_videos').insert({
      youtube_id: video.videoId,
      title: video.title,
      channel_name: GOLF_CART_GARAGE.name,
      channel_url: GOLF_CART_GARAGE.url,
    });
    if (error) {
      console.error(`  [error] Could not save: ${error.message}`);
      failed++;
    } else {
      console.log('  Added.');
      added++;
    }

    await sleep(DELAY_BETWEEN_CHECKS_MS);
  }

  console.log(`\n=== Import complete: ${added} added, ${skipped} skipped (not how-to content), ${failed} failed (out of ${uploads.length} total) ===`);
}

run().catch((err) => {
  console.error('Fatal error in reset-videos-golf-cart-garage.js:', err);
  process.exit(1);
});
