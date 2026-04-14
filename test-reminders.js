require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('reminders').select('*').limit(1);
  if (error) {
    console.log('ERROR:', error);
  } else {
    console.log('SUCCESS, table exists. Data:', data);
  }
}
test();
