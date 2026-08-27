const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}

(async () => {
  try {
    const env = loadEnv('.env.local');
    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
    if (!url || !serviceKey) {
      console.error('.env.local must define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      process.exit(1);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const tables = [
      'production_orders','production','production_items','orders','order_items','customers','products','suppliers','inventory_items','inventory_movements','ai_conversations','ai_insights','automations','notifications','tasks','procedures','leads','opportunities','payments','financial_transactions','attachments','audit_logs','quotes','quote_items'
    ];

    const summary = { deleted: {} };

    for (const tbl of tables) {
      try {
        // attempt to delete all rows in table (skip if table missing)
        const del = await admin.from(tbl).delete().not('id', 'is', null).select('id');
        if (del.error) {
          console.log(`Skip ${tbl}:`, del.error.message);
          continue;
        }
        const count = del.data ? del.data.length : 0;
        summary.deleted[tbl] = count;
        console.log(`Deleted ${count} rows from ${tbl}`);
      } catch (e) {
        console.log(`Error deleting from ${tbl}:`, e.message || e);
      }
    }

    console.log('Done. Summary:', JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Unexpected error', e);
    process.exit(2);
  }
})();