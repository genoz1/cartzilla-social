// Shared relevance check for the How-To Videos section — filters out
// pure promotional/announcement content while correctly recognizing real
// repair topics even when they're wrapped in a channel's recurring show
// branding (e.g. "Gearheads Ep. 302: 'High RPM electric motor' | Live Q&A
// Tue 1PM ET" is a real topic — the "Live Q&A" part is just this channel's
// weekly-show format, not a sign the content itself is a mere announcement).
// Used by both the weekly new-video checker and any one-off bulk import.
const { askClaude } = require('./anthropic');

async function isRelevantHowTo(title, description) {
  const system = `You screen YouTube videos for a golf cart parts & accessories site's
"How-To Videos" section. Answer ONLY "YES" or "NO".

Answer YES for: any video whose title or description names a specific golf cart repair,
diagnostic, installation, or maintenance topic (a symptom, a part, a specific job) — even if
it's also formatted as part of a recurring weekly show or live-stream series. A title like
Gearheads Ep. 302: "High RPM electric motor" | Live Q&A Tue 1PM ET IS real content — the
quoted/named topic is the actual subject, and "Live Q&A Tue 1PM ET" is just this channel's
standing show branding, not evidence the video itself lacks real content. Don't reject a
video just because its title contains scheduling/show-format text alongside a real topic.

Answer NO only for videos that name NO specific technical topic at all — pure channel
promos (a phone number, a website URL, "subscribe to our channel"), generic "join us live"
announcements with no named subject, channel intro/about videos, or clearly off-topic
content. When genuinely unsure, prefer YES if any real topic is named anywhere in the
title, even briefly — only answer NO when there's truly no identifiable subject matter.`;
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
