// One-time batch seeding: writes 5 real articles for each of the 4
// article types (20 total), using the actual live pipeline — real
// categories, real AI images, real mid-article banners. Runs sequentially
// (not in parallel) so each run sees the up-to-date rotation history from
// the one before it, and so the AI/image/Shopify APIs aren't hit all at
// once. Social posting is skipped for this batch (SKIP_SOCIAL=true) so you
// don't get 20 articles flooding Facebook/Instagram/Threads/Pinterest back
// to back — the regular daily schedule will handle social posting for
// everything going forward.
//
// Usage:
//   node scripts/seed-articles.js          — writes all 20 for real
//   DRY_RUN=true node scripts/seed-articles.js   — previews without saving
//
// Takes a while (20 runs, each doing real AI writing + image generation)
// — expect this to run for several minutes. Safe to leave running; each
// run's progress prints as it happens.
require('dotenv').config();
const { execSync } = require('child_process');

const TYPES = ['tutorials', 'troubleshooting', 'buying-guides', 'reviews'];
const RUNS_PER_TYPE = 5;
const DELAY_BETWEEN_RUNS_MS = 5000; // gentle pacing on the AI/image/Shopify APIs

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const dryRun = process.env.DRY_RUN === 'true';
  const total = TYPES.length * RUNS_PER_TYPE;
  console.log(`\n=== Cartzilla batch seeding — ${total} articles (${RUNS_PER_TYPE} each of ${TYPES.join(', ')}) ===`);
  console.log(dryRun ? 'DRY RUN — nothing will be saved.\n' : 'Social posting is skipped for this batch (SKIP_SOCIAL=true).\n');

  let completed = 0;
  let failed = 0;

  for (const type of TYPES) {
    for (let i = 1; i <= RUNS_PER_TYPE; i++) {
      const runNumber = completed + failed + 1;
      console.log(`\n--- [${runNumber}/${total}] ${type} (${i}/${RUNS_PER_TYPE}) ---`);
      try {
        const env = {
          ...process.env,
          ARTICLE_TYPE: type,
          SKIP_SOCIAL: 'true',
          DRY_RUN: dryRun ? 'true' : 'false',
        };
        execSync('node scripts/write-article.js', { stdio: 'inherit', env });
        completed++;
      } catch (err) {
        console.error(`  [error] This run failed — continuing with the rest of the batch.`);
        failed++;
      }

      const isLastRun = runNumber === total;
      if (!isLastRun) {
        await sleep(DELAY_BETWEEN_RUNS_MS);
      }
    }
  }

  console.log(`\n=== Batch seeding complete: ${completed} succeeded, ${failed} failed (out of ${total}) ===`);
}

main().catch((err) => {
  console.error('Fatal error in seed-articles.js:', err);
  process.exit(1);
});
