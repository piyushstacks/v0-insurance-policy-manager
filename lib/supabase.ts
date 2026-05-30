import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { getB2PublicUrl } from './b2';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Missing Supabase environment variables – running in offline/demo mode. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to enable auth and DB.');
}

// Client for browser (with anon key - automatically manages cookies)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Server-side client (with service role key for admin operations)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })
  : null;

// Helper to get current session
export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

// Helper to get current user
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Helper for storage bucket operations
export const storageBucket = 'policy-documents';

export async function uploadFile(file: File, path: string) {
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;
  return data;
}


export async function getPublicUrl(path: string) {
  return getB2PublicUrl(path);
}

export async function deleteFile(path: string) {
  const { error } = await supabase.storage.from(storageBucket).remove([path]);
  if (error) throw error;
}
