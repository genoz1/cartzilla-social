const { logPost } = require('./postLog');
const { withRetryOnce, isLiveModeEnabled } = require('./safeguards');

async function postToFacebookPage({ message, link, imageUrl, dryRun, meta }) {
  const effectiveDryRun = dryRun || !isLiveModeEnabled();

  if (effectiveDryRun) {
    console.log(`  [dry-run] Would post to Cartzilla Facebook: "${message}"${link ? ` (link: ${link})` : ''}${imageUrl ? ` (photo: ${imageUrl})` : ''}`);
    return { ok: true, dryRun: true };
  }

  if (!process.env.CARTZILLA_FB_PAGE_ID || !process.env.CARTZILLA_FB_PAGE_ACCESS_TOKEN) {
    console.log('  [skip] CARTZILLA_FB_PAGE_ID / CARTZILLA_FB_PAGE_ACCESS_TOKEN not set — skipping.');
    return { ok: false, skipped: true };
  }

  try {
    const result = await withRetryOnce(async () => {
      // When we have a real image, upload it directly via the /photos
      // endpoint — this guarantees the photo actually shows on the post.
      // The /feed endpoint (message + link only) depends entirely on
      // Facebook's own link-preview scraper successfully pulling an image
      // from the target page, which isn't reliable — it can come up
      // empty, especially right after a domain/URL change. The link still
      // reaches readers fine as plain text inside the caption.
      if (imageUrl) {
        const caption = link ? `${message}\n\n${link}` : message;
        const res = await fetch(`https://graph.facebook.com/v19.0/${process.env.CARTZILLA_FB_PAGE_ID}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: imageUrl, caption, access_token: process.env.CARTZILLA_FB_PAGE_ACCESS_TOKEN }),
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }

      const body = { message, access_token: process.env.CARTZILLA_FB_PAGE_ACCESS_TOKEN };
      if (link) body.link = link;

      const res = await fetch(`https://graph.facebook.com/v19.0/${process.env.CARTZILLA_FB_PAGE_ID}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }, { label: 'Cartzilla Facebook post' });

    await logPost({ ...meta, platform: 'facebook', caption: message, status: 'success' });
    return { ok: true, result };
  } catch (err) {
    await logPost({ ...meta, platform: 'facebook', caption: message, status: 'failed', errorDetail: err.message });
    return { ok: false, error: err.message };
  }
}

module.exports = { postToFacebookPage };
