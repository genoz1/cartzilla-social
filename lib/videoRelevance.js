// Shared relevance check for the How-To Videos section — filters out
// live-show announcements, off-topic content, or anything that isn't
// genuine golf cart repair/how-to material, using only the video's own
// title and description. Used by both the weekly new-video checker and
// any one-off bulk import.
const { askClaude } = require('./anthropic');

async function isRelevantHowTo(title, description) {
  const system = `You screen YouTube videos for a golf cart parts & accessories site's
"How-To Videos" section. Answer ONLY "YES" or "NO".
Answer YES for: genuine repair, installation, troubleshooting, or maintenance how-to content
for golf carts (EZGO, Club Car, Yamaha, or similar).
Answer NO for: live-show announcements ("join us live Tuesday"), off-topic vlogs, channel
intros/about videos, unrelated product ads, or anything that isn't actual how-to content.
When genuinely unsure, answer NO.`;
  const user = `Title: ${title}\nDescription: ${(description || '').slice(0, 500)}`;
  try {
    const raw = await askClaude(system, user, 10);
    return raw.trim().toUpperCase().startsWith('YES');
  } catch (err) {
    console.error(`  [error] Relevance check failed, skipping to be safe: ${err.message}`);
    return false;
  }
}

module.exports = { isRelevantHowTo };
