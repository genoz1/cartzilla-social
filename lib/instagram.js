// Same container -> poll -> publish pattern as Florida Buzz's Instagram
// integration, pointed at Cartzilla's own account/tokens.
const { logPost } = require('./postLog');
const { withRetryOnce, isLiveModeEnabled } = require('./safeguards');

const GRAPH_BASE = 'https://graph.instagram.com/v21.0';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForContainerReady(containerId, accessToken, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`);
    const data = await res.json();
    if (!res.ok) throw new Error(`Instagram container status check failed: ${JSON.stringify(data)}`);
    if (data.status_code === 'FINISHED') return true;
    if (data.status_code === 'ERROR') throw new Error(`Instagram container processing failed: ${JSON.stringify(data)}`);
    await sleep(2000);
  }
  throw new Error('Instagram container did not finish processing in time.');
}

async function createPost({ imageUrl, caption, dryRun, meta }) {
  const effectiveDryRun = dryRun || !isLiveModeEnabled();

  if (effectiveDryRun) {
    console.log(`  [dry-run] Would post to Cartzilla Instagram: "${caption}" (image: ${imageUrl})`);
    return { ok: true, dryRun: true };
  }

  const accessToken = process.env.CARTZILLA_INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.CARTZILLA_INSTAGRAM_USER_ID;

  if (!accessToken || !igUserId) {
    console.log('  [skip] CARTZILLA_INSTAGRAM_ACCESS_TOKEN / CARTZILLA_INSTAGRAM_USER_ID not set — skipping.');
    return { ok: false, skipped: true };
  }

  try {
    const result = await withRetryOnce(async () => {
      const createRes = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(`Instagram container creation failed: ${JSON.stringify(createData)}`);

      await waitForContainerReady(createData.id, accessToken);

      const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: createData.id, access_token: accessToken }),
      });
      const publishData = await publishRes.json();
      if (!publishRes.ok) throw new Error(`Instagram publish failed: ${JSON.stringify(publishData)}`);
      return publishData;
    }, { label: 'Cartzilla Instagram post' });

    await logPost({ ...meta, platform: 'instagram', caption, imageUrl, status: 'success' });
    return { ok: true, result };
  } catch (err) {
    await logPost({ ...meta, platform: 'instagram', caption, imageUrl, status: 'failed', errorDetail: err.message });
    return { ok: false, error: err.message };
  }
}

module.exports = { createPost };
