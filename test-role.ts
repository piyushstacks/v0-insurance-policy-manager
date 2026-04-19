import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data, error } = await supabase.rpc('get_column_details', {}); 
  // Maybe just try to insert a fake role to see if it causes an enum error
  const { error: err2 } = await supabase.from('user_profiles').update({ role: 'SUB_ADMIN' }).eq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Update subadmin error:', err2?.message || 'none');
}

check();
