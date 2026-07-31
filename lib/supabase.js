const { createClient } = require('@supabase/supabase-js');

if (!process.env.CARTZILLA_SUPABASE_URL || !process.env.CARTZILLA_SUPABASE_SERVICE_KEY) {
  console.warn('[cartzilla-supabase] CARTZILLA_SUPABASE_URL / CARTZILLA_SUPABASE_SERVICE_KEY not set — rotation, dedupe, and logging will not work until this is configured.');
}

const supabase = (process.env.CARTZILLA_SUPABASE_URL && process.env.CARTZILLA_SUPABASE_SERVICE_KEY)
  ? createClient(process.env.CARTZILLA_SUPABASE_URL, process.env.CARTZILLA_SUPABASE_SERVICE_KEY)
  : null;

// Uploads generated image bytes to a Supabase Storage bucket called
// "cartzilla-images" (create this bucket once in Supabase — Storage > New
// bucket > public) for permanent hosting. Returns the public URL, or null
// if anything fails.
async function storeGeneratedImage(imageBuffer, filename, contentType = 'image/png') {
  if (!supabase) return null;
  try {
    const { error: uploadError } = await supabase.storage
      .from('cartzilla-images')
      .upload(filename, imageBuffer, { contentType, upsert: true });
    if (uploadError) {
      console.error(`  [error] Image upload failed: ${uploadError.message}`);
      return null;
    }
    const { data } = supabase.storage.from('cartzilla-images').getPublicUrl(filename);
    return data.publicUrl;
  } catch (err) {
    console.error(`  [error] Image storage failed: ${err.message}`);
    return null;
  }
}

module.exports = { supabase, storeGeneratedImage };
