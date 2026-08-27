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

    const summary = { companies_found: [], deleted: { companies: [], users: [], customers: [], orders: [], other: [] } };

    // Find companies with name or slug containing 'nexo'
    const { data: companies } = await admin.from('companies').select('id,name,slug,created_at').ilike('name', '%nexo%');
    // also try slug match
    const { data: companies2 } = await admin.from('companies').select('id,name,slug,created_at').ilike('slug', '%nexo%');
    const companiesMap = new Map();
    (companies || []).forEach(c => companiesMap.set(c.id, c));
    (companies2 || []).forEach(c => companiesMap.set(c.id, c));
    const companiesList = Array.from(companiesMap.values());
    summary.companies_found = companiesList;
    console.log('Companies matched:', companiesList.map(c => ({ id: c.id, name: c.name, slug: c.slug })));

    const tablesToDeleteByCompany = ['memberships','role_permissions','permissions','roles','product_categories','products','order_items','orders','quotes','quote_items','tasks','task_comments','procedures','procedure_steps','production_orders','inventory_items','inventory_movements','suppliers','purchase_orders','purchase_items','financial_transactions','payments','notifications','problems','problem_comments','attachments','audit_logs','automations','ai_conversations','ai_insights','customers','leads','opportunities'];

    for (const comp of companiesList) {
      console.log('\nCleaning company', comp.id, comp.name);
      for (const t of tablesToDeleteByCompany) {
        try {
          const del = await admin.from(t).delete().eq('company_id', comp.id).select('id');
          if (del.error) console.log(`Skip delete ${t}:`, del.error.message);
          else if (del.data && del.data.length) console.log(`Deleted ${del.data.length} rows from ${t}`);
        } catch (e) {
          console.log('Error deleting from', t, e.message || e);
        }
      }

      // delete users belonging to this company
      try {
        const delUsers = await admin.from('users').delete().eq('company_id', comp.id).select('id,email');
        if (delUsers.error) console.log('users del error', delUsers.error.message);
        else console.log('Deleted users:', delUsers.data && delUsers.data.map(u => u.email));
        summary.deleted.users.push(...(delUsers.data || []));
      } catch (e) {
        console.log('user delete err', e.message);
      }

      // finally delete company
      try {
        const delC = await admin.from('companies').delete().eq('id', comp.id).select('id,name');
        if (delC.error) console.log('company delete error', delC.error.message);
        else { console.log('Deleted company', delC.data); summary.deleted.companies.push(...(delC.data || [])); }
      } catch (e) {
        console.log('company delete exception', e.message);
      }
    }

    // targeted deletions for standalone demo records
    const demoCustomerNames = ['Armazém Central','Tecnova','Miller & Filho','Casa do Aço'];
    for (const name of demoCustomerNames) {
      try {
        const sel = await admin.from('customers').select('id,name,company_id').ilike('name', name);
        if (sel.data && sel.data.length) {
          for (const r of sel.data) {
            const del = await admin.from('customers').delete().eq('id', r.id).select('id,name');
            console.log('Deleted customer', del.data);
            summary.deleted.customers.push(...(del.data || []));
          }
        }
      } catch (e) { console.log('customer delete err', e.message); }
    }

    // delete orders with known numbers
    const demoOrderNumbers = ['#4821','#6648','#7194','#5078'];
    for (const num of demoOrderNumbers) {
      try {
        const sel = await admin.from('orders').select('id,order_number,company_id').ilike('order_number', num);
        if (sel.data && sel.data.length) {
          for (const r of sel.data) {
            await admin.from('order_items').delete().eq('order_id', r.id);
            const del = await admin.from('orders').delete().eq('id', r.id).select('id,order_number');
            console.log('Deleted order', del.data);
            summary.deleted.orders.push(...(del.data || []));
          }
        }
      } catch (e) { console.log('order del err', e.message); }
    }

    // delete users with emails starting nexo.
    try {
      const selUsers = await admin.from('users').select('id,email,company_id').ilike('email','nexo.%');
      if (selUsers.data && selUsers.data.length) {
        for (const u of selUsers.data) {
          const del = await admin.from('users').delete().eq('id', u.id).select('id,email');
          console.log('Deleted user', del.data);
          summary.deleted.users.push(...(del.data || []));
        }
      }
    } catch (e) { console.log('del test users err', e.message); }

    // delete ai conversations/insights with QA/demo markers
    try {
      const delAIConv = await admin.from('ai_conversations').delete().ilike('title','%qa%').select('id'); if(delAIConv.data) console.log('Deleted ai_conversations',delAIConv.data.length);
      const delAIIns = await admin.from('ai_insights').delete().ilike('title','%qa%').select('id'); if(delAIIns.data) console.log('Deleted ai_insights',delAIIns.data.length);
    } catch (e) { console.log('ai del err', e.message); }

    // remove audit_logs that seem demo (message contains 'New user registered' or user email like nexo.)
    try {
      const delAudit = await admin.from('audit_logs').delete().ilike('change_summary','%New user%').select('id'); if(delAudit.data) console.log('Deleted audit logs by summary:', delAudit.data.length);
      const delAudit2 = await admin.from('audit_logs').delete().ilike('change_summary','%nexo.%').select('id'); if(delAudit2.data) console.log('Deleted audit logs by email pattern:', delAudit2.data.length);
    } catch (e) { console.log('audit del err', e.message); }

    console.log('\nCleanup summary:', JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Unexpected error', e);
    process.exit(2);
  }
})();
