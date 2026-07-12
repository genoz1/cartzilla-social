const { logPost } = require('./postLog');
const { withRetryOnce, isLiveModeEnabled } = require('./safeguards');

const GRAPH_BASE = 'https://graph.threads.net/v1.0';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForContainerReady(containerId, accessToken, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${GRAPH_BASE}/${containerId}?fields=status&access_token=${accessToken}`);
    const data = await res.json();
    if (!res.ok) throw new Error(`Threads container status check failed: ${JSON.stringify(data)}`);
    if (data.status === 'FINISHED') return true;
    if (data.status === 'ERROR') throw new Error(`Threads container processing failed: ${JSON.stringify(data)}`);
    await sleep(2000);
  }
  throw new Error('Threads container did not finish processing in time.');
}

async function createPost({ text, imageUrl, dryRun, meta }) {
  const effectiveDryRun = dryRun || !isLiveModeEnabled();

  if (effectiveDryRun) {
    console.log(`  [dry-run] Would post to Cartzilla Threads: "${text}"${imageUrl ? ` (image: ${imageUrl})` : ''}`);
    return { ok: true, dryRun: true };
  }

  const accessToken = process.env.CARTZILLA_THREADS_ACCESS_TOKEN;
  const userId = process.env.CARTZILLA_THREADS_USER_ID;

  if (!accessToken || !userId) {
    console.log('  [skip] CARTZILLA_THREADS_ACCESS_TOKEN / CARTZILLA_THREADS_USER_ID not set — skipping.');
    return { ok: false, skipped: true };
  }

  try {
    const result = await withRetryOnce(async () => {
      const createRes = await fetch(`${GRAPH_BASE}/${userId}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: imageUrl ? 'IMAGE' : 'TEXT',
          text,
          ...(imageUrl ? { image_url: imageUrl } : {}),
          access_token: accessToken,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(`Threads container creation failed: ${JSON.stringify(createData)}`);

      if (imageUrl) await waitForContainerReady(createData.id, accessToken);

      const publishRes = await fetch(`${GRAPH_BASE}/${userId}/threads_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: createData.id, access_token: accessToken }),
      });
      const publishData = await publishRes.json();
      if (!publishRes.ok) throw new Error(`Threads publish failed: ${JSON.stringify(publishData)}`);
      return publishData;
    }, { label: 'Cartzilla Threads post' });

    await logPost({ ...meta, platform: 'threads', caption: text, imageUrl, status: 'success' });
    return { ok: true, result };
  } catch (err) {
    await logPost({ ...meta, platform: 'threads', caption: text, imageUrl, status: 'failed', errorDetail: err.message });
    return { ok: false, error: err.message };
  }
}

module.exports = { createPost };
