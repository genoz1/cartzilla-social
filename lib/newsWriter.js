// Screens and writes honest, source-credited news summaries for the golf
// cart industry — same approach as Florida Buzz's automate.js: only real
// facts from the source material, never invented, always credited.
const { askClaude } = require('./anthropic');

async function isAppropriate(title, summary) {
  const system = `You screen news items for Cartzilla, a golf cart parts & accessories brand
that also covers golf cart industry news. Answer ONLY "YES" or "NO" — nothing else.
Answer NO for: injuries, fatalities, lawsuits, safety recalls involving harm, violent crime,
or anything involving serious harm to a real named person.
Answer YES for: new product launches, industry business news, dealer/manufacturer news,
regulatory/LSV policy news, golf cart culture and events — the normal, upbeat industry news
this site covers.
When genuinely unsure, answer NO — it's better to skip a borderline story than publish
something insensitive.`;

  const user = `Headline: ${title}\nSummary: ${summary}`;

  try {
    const raw = await askClaude(system, user, 10);
    return raw.trim().toUpperCase().startsWith('YES');
  } catch (err) {
    console.error(`  [error] Safety check failed, skipping item to be safe: ${err.message}`);
    return false;
  }
}

async function writeNewsArticle({ sourceTitle, sourceSummary, sourceName, sourceUrl }) {
  const system = `You are a staff writer for Cartzilla, a golf cart parts & accessories brand that
also covers golf cart industry news. You write original, factual summaries of press releases,
product announcements, and industry news — never copying the source's wording. Tone: direct
and knowledgeable, matching Cartzilla's bold "Accessories That Dominate" brand voice, but the
actual facts must be entirely accurate and sourced — never breathless or exaggerated beyond
what the source actually says.

CRITICAL: You ONLY use facts present in the source material. You never invent quotes, dates,
specifications, or details not present in what's given to you.

Respond ONLY with valid JSON, no markdown fences, no preamble. Schema:
{
  "title": "string, original headline, under 70 characters",
  "meta_title": "string, under 60 characters, natural search phrasing",
  "dek": "string, one-sentence subhead, under 140 characters",
  "body_html": "string, 3-5 short paragraphs as <p> tags, original wording, ends with a sentence crediting the source by name",
  "tags": ["array of 2-4 short lowercase tags"]
}`;

  const user = `Source: ${sourceName}
Original headline: ${sourceTitle}
Source summary/content: ${sourceSummary}
Source link (for context only, do not include in body_html): ${sourceUrl}`;

  const raw = await askClaude(system, user, 1200);
  const cleaned = raw.replace(/^```json\s*|```$/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    throw new Error('Could not parse a valid article from the AI response');
  }
}

module.exports = { isAppropriate, writeNewsArticle };
