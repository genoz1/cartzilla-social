const { supabase } = require('./supabase');

// Retries a transient failure exactly once, with a short pause. Anything
// that fails twice is a real failure and gets logged/surfaced as such.
async function withRetryOnce(fn, { label = 'operation' } = {}) {
  try {
    return await fn();
  } catch (firstErr) {
    console.warn(`  [retry] ${label} failed once (${firstErr.message}) — retrying in 5s...`);
    await new Promise((r) => setTimeout(r, 5000));
    return fn(); // if this throws too, it propagates as the real failure
  }
}

// Checks whether this exact caption has already been posted successfully,
// on any platform, ever — a simple, reliable duplicate-caption guard.
async function captionAlreadyUsed(caption) {
  if (!supabase || !caption) return false;
  const { data, error } = await supabase
    .from('cartzilla_post_log')
    .select('id')
    .eq('status', 'success')
    .eq('caption', caption)
    .limit(1);

  if (error) {
    console.warn(`  [warn] Could not check for duplicate caption: ${error.message}`);
    return false; // fail open on the check itself, but the caption content
                   // is freshly AI-generated per run, so true collisions are rare
  }
  return (data || []).length > 0;
}

// Master safety switch. Everything defaults to NOT live. A real post can
// only go out if this is explicitly set to "true" AND the caller didn't
// pass dryRun.
function isLiveModeEnabled() {
  return process.env.CARTZILLA_LIVE_MODE === 'true';
}

module.exports = { withRetryOnce, captionAlreadyUsed, isLiveModeEnabled };
