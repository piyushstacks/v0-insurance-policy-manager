const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function wipe() {
  console.log('Wiping policies...');
  await supabase.from('policies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Wiping insurers...');
  await supabase.from('insurers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Wiping customers...');
  await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  const { data } = await supabase.storage.from('policy-documents').list();
  if (data && data.length > 0) {
     const files = data.map(x => x.name);
     await supabase.storage.from('policy-documents').remove(files);
     console.log('Storage wiped.');
  }

  console.log('Done!');
}
wipe();
