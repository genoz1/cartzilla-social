// Thin wrapper around OpenAI's image generation API — same provider Florida
// Buzz uses for its article images.
async function generateImage(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      n: 1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI image API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const b64 = data.data[0].b64_json;
  return Buffer.from(b64, 'base64');
}

module.exports = { generateImage };
