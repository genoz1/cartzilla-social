const { createClient } = require('@supabase/supabase-js');

if (!process.env.CARTZILLA_SUPABASE_URL || !process.env.CARTZILLA_SUPABASE_SERVICE_KEY) {
  console.warn('[cartzilla-supabase] CARTZILLA_SUPABASE_URL / CARTZILLA_SUPABASE_SERVICE_KEY not set — rotation, dedupe, and logging will not work until this is configured.');
}

const supabase = (process.env.CARTZILLA_SUPABASE_URL && process.env.CARTZILLA_SUPABASE_SERVICE_KEY)
  ? createClient(process.env.CARTZILLA_SUPABASE_URL, process.env.CARTZILLA_SUPABASE_SERVICE_KEY)
  : null;

module.exports = { supabase };
