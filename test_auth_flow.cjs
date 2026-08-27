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
    const url = env.VITE_SUPABASE_URL;
    const anon = env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      console.error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required in .env.local');
      process.exit(1);
    }

    const client = createClient(url, anon, { auth: { persistSession: false } });
    const testEmail = `test+${Date.now()}@example.com`;
    const testPass = '12345678';
    console.log('Attempting signUp for', testEmail);
    const { data: signupData, error: signupError } = await client.auth.signUp({ email: testEmail, password: testPass });
    if (signupError) {
      console.error('signUp error', signupError.message || signupError);
    } else {
      console.log('signUp ok', signupData);
    }

    console.log('Attempting signIn for', testEmail);
    const { data: signinData, error: signinError } = await client.auth.signInWithPassword({ email: testEmail, password: testPass });
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