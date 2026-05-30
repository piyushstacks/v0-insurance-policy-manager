const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  const userId = '91f4537d-2e85-4283-98b9-a41fd4d546b5'; // User ID from logs

  console.log('Updating customers...');
  const { data: custData, error: custErr } = await supabase
    .from('customers')
    .update({ user_id: userId })
    .is('user_id', null)
    .select();
  console.log(`Updated ${custData?.length || 0} customers`, custErr || '');

  console.log('Updating policies...');
  const { data: polData, error: polErr } = await supabase
    .from('policies')
    .update({ user_id: userId })
    .is('user_id', null)
    .select();
  console.log(`Updated ${polData?.length || 0} policies`, polErr || '');
}

fix();
