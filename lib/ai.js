// Unified text-generation entry point.
// Prefers OpenAI (post-migration). Falls back to Anthropic only when
// OPENAI_API_KEY is missing and ANTHROPIC_API_KEY is still present —
// so a partial env migration does not hard-break publishing.
const { askOpenAI } = require('./openai');
const { askClaude } = require('./anthropic');

function hasOpenAI() {
  return !!process.env.OPENAI_API_KEY;
}

function hasAnthropic() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function hasTextAI() {
  return hasOpenAI() || hasAnthropic();
}

function textProvider() {
  if (hasOpenAI()) return 'openai';
  if (hasAnthropic()) return 'anthropic';
  return null;
}

async function askAI(systemPrompt, userPrompt, maxTokens = 1200) {
  if (hasOpenAI()) {
    return askOpenAI(systemPrompt, userPrompt, maxTokens);
  }
  if (hasAnthropic()) {
    return askClaude(systemPrompt, userPrompt, maxTokens);
  }
  throw new Error('No text AI configured. Set OPENAI_API_KEY (preferred) or ANTHROPIC_API_KEY.');
}

module.exports = { askAI, hasTextAI, hasOpenAI, hasAnthropic, textProvider };
