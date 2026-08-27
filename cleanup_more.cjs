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

    const patterns = ['%demo%','%example%','%test%','%sample%','%qa%','%nexo%','%teste%'];
    const tablesToScan = ['customers','products','suppliers','ai_conversations','ai_insights','automations','audit_logs','notifications','tasks','procedures','leads','opportunities','orders','quotes'];
    const summary = { deleted: [] };

    for (const tbl of tablesToScan) {
      for (const p of patterns) {
        try {
          // try matching common text columns
          const candidates = await admin.from(tbl).select('id,name,title,email,order_number,company_id').or(`name.ilike.${p},title.ilike.${p},email.ilike.${p},order_number.ilike.${p}`);
          if (candidates.error) continue;
          if (candidates.data && candidates.data.length) {
            console.log(`Found ${candidates.data.length} matching rows in ${tbl} for pattern ${p}`);
            for (const row of candidates.data) {
              try {
                const del = await admin.from(tbl).delete().eq('id', row.id).select('id');
                if (del.error) console.log(`Error deleting from ${tbl}:`, del.error.message);
                else summary.deleted.push({ table: tbl, id: row.id });
              } catch (e) { console.log('delete err', e.message); }
            }
          }
        } catch (e) { /* ignore table/column mismatches */ }
      }
    }

    // remove companies with QA/demo markers
    for (const p of patterns) {
      try {
        const sel = await admin.from('companies').select('id,name,slug').or(`name.ilike.${p},slug.ilike.${p}`);
        if (sel.data && sel.data.length) {
          for (const c of sel.data) {
            try {
              // delete dependents first
              await admin.from('memberships').delete().eq('company_id', c.id);
              await admin.from('roles').delete().eq('company_id', c.id);
              await admin.from('permissions').delete().eq('company_id', c.id);
              await admin.from('companies').delete().eq('id', c.id).select('id');
              summary.deleted.push({ table: 'companies', id: c.id });
            } catch (e) { console.log('company delete err', e.message); }
          }
        }
      } catch (e) {}
    }

    console.log('Cleanup_more summary deleted count:', summary.deleted.length);
    process.exit(0);
  } catch (e) {
    console.error('Unexpected error', e);
    process.exit(2);
  }
})();
