// Weekly check: for each trusted channel, look at its most recent uploads
// and add any new, genuinely relevant ones to cartzilla_videos. Skips
// anything already in the table (by youtube_id) and anything that doesn't
// look like real golf-cart repair/how-to content (e.g. live-show
// announcements, off-topic vlogs) via a lightweight relevance check.
require('dotenv').config();
const { supabase } = require('../lib/supabase');
const { getUploadsPlaylistId, getRecentUploads } = require('../lib/youtube');
const { isRelevantHowTo } = require('../lib/videoRelevance');
const CHANNELS = require('./trusted-video-channels');

const DRY_RUN = process.env.DRY_RUN === 'true';
const MAX_PER_CHANNEL = parseInt(process.env.MAX_VIDEOS_PER_CHANNEL, 10) || 5;

async function alreadyAdded(youtubeId) {
  if (!supabase) return false;
  const { data } = await supabase.from('cartzilla_videos').select('id').eq('youtube_id', youtubeId).maybeSingle();
  return !!data;
}

async function run() {
  console.log(`\n=== Cartzilla video checker — ${new Date().toISOString()} ===`);
  if (DRY_RUN) console.log('DRY RUN: nothing will be saved.\n');

  for (const channel of CHANNELS) {
    console.log(`Checking ${channel.name}...`);
    let playlistId;
    try {
      playlistId = await getUploadsPlaylistId(channel);
    } catch (err) {
      console.error(`  [error] Could not resolve channel: ${err.message}`);
      continue;
    }
    if (!playlistId) {
      console.error(`  [error] Channel not found — check the handle/username in trusted-video-channels.js`);
      continue;
    }

    let uploads;
    try {
      uploads = await getRecentUploads(playlistId, MAX_PER_CHANNEL);
    } catch (err) {
      console.error(`  [error] Could not fetch uploads: ${err.message}`);
      continue;
    }

    for (const video of uploads) {
      if (await alreadyAdded(video.videoId)) {
        continue; // already have it, skip quietly — this is the normal case most weeks
      }

      console.log(`  New upload: "${video.title}" — checking relevance...`);
      const relevant = await isRelevantHowTo(video.title, video.description);
      if (!relevant) {
        console.log('  [skip] Not genuine how-to content.');
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [dry-run] Would add: "${video.title}" (${video.videoId})`);
        continue;
      }

      if (!supabase) {
        console.error('  [error] Supabase not configured — cannot save.');
        continue;
      }
      const { error } = await supabase.from('cartzilla_videos').insert({
        youtube_id: video.videoId,
        title: video.title,
        channel_name: channel.name,
        channel_url: channel.url,
        published_at: video.publishedAt,
      });
      if (error) {
        console.error(`  [error] Could not save: ${error.message}`);
      } else {
        console.log(`  Added: "${video.title}"`);
      }
    }
  }

  console.log('\n=== Run complete ===');
}

run().catch((err) => {
  console.error('Fatal error in video checker:', err);
  process.exit(1);
});
