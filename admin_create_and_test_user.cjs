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
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const anon = env.VITE_SUPABASE_ANON_KEY;
    if (!url || !serviceKey || !anon) {
      console.error('.env.local must define SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_ANON_KEY');
      process.exit(1);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const client = createClient(url, anon, { auth: { persistSession: false } });

    const email = `fixuser+${Date.now()}@example.com`;
    const password = '12345678';

    console.log('Creating user via admin API:', email);

    if (admin.auth && admin.auth.admin && typeof admin.auth.admin.createUser === 'function') {
      const res = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Fix User' },
      });

      console.log('Admin createUser response:', res);
    } else {
      console.log('admin.auth.admin.createUser not available in this client version');
    }

    console.log('Attempting signIn with anon client...');
    const { data: signinData, error: signinError } = await client.auth.signInWithPassword({ email, password });
    if (signinError) {
      console.error('signIn error', signinError.message || signinError);
    } else {
      console.log('signIn ok', signinData);
    }

    process.exit(0);
  } catch (e) {
    console.error('Unexpected', e);
    process.exit(2);
  }
})();