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

    // Attempt to use admin.auth.admin.listUsers() if available
    if (admin.auth && admin.auth.admin && typeof admin.auth.admin.listUsers === 'function') {
      const res = await admin.auth.admin.listUsers({ limit: 100 });
      console.log('Users:', res);
      process.exit(0);
    }

    console.log('admin.auth.admin.listUsers not available on this client version. Falling back to query on auth.users table.');
    const { data, error } = await admin.from('users').select('id,auth_user_id,email,first_name,last_name,created_at').limit(100);
    if (error) {
      console.error('Error querying users table:', error.message || error);
      process.exit(2);
    }

    console.log('Found users:', data.length);
    console.table(data);
    process.exit(0);
  } catch (e) {
    console.error('Unexpected error', e);
    process.exit(3);
  }
})();