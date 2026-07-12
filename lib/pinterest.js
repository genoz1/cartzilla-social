const { logPost } = require('./postLog');
const { withRetryOnce, isLiveModeEnabled } = require('./safeguards');

const PINTEREST_API_BASE = process.env.CARTZILLA_PINTEREST_USE_SANDBOX === 'true'
  ? 'https://api-sandbox.pinterest.com'
  : 'https://api.pinterest.com';

async function createPin({ imageUrl, title, description, link, dryRun, meta }) {
  const effectiveDryRun = dryRun || !isLiveModeEnabled();

  if (effectiveDryRun) {
    console.log(`  [dry-run] Would post to Cartzilla Pinterest: "${title}" (link: ${link})`);
    return { ok: true, dryRun: true };
  }

  if (!process.env.CARTZILLA_PINTEREST_ACCESS_TOKEN || !process.env.CARTZILLA_PINTEREST_BOARD_ID) {
    console.log('  [skip] CARTZILLA_PINTEREST_ACCESS_TOKEN / CARTZILLA_PINTEREST_BOARD_ID not set — skipping.');
    return { ok: false, skipped: true };
  }

  const caption = `${title} — ${description}`;

  try {
    const result = await withRetryOnce(async () => {
      const res = await fetch(`${PINTEREST_API_BASE}/v5/pins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.CARTZILLA_PINTEREST_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          link,
          title,
          description,
          board_id: process.env.CARTZILLA_PINTEREST_BOARD_ID,
          media_source: { source_type: 'image_url', url: imageUrl },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }, { label: 'Cartzilla Pinterest post' });

    await logPost({ ...meta, platform: 'pinterest', caption, imageUrl, status: 'success' });
    return { ok: true, result };
  } catch (err) {
    await logPost({ ...meta, platform: 'pinterest', caption, imageUrl, status: 'failed', errorDetail: err.message });
    return { ok: false, error: err.message };
  }
}

module.exports = { createPin };
