import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import redis from '@/lib/redis';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const cacheKey = `dashboard:gap_detection:${userId}`;
    
    const cached = await redis.get(cacheKey);
    
    // If not cached, trigger a background worker request (fire and forget)
    if (!cached) {
      // In a real production setup with QStash you'd publish to QStash here.
      // For immediate fallback, we fetch the worker route asynchronously.
      // (This will take time, but the UI can poll or we can just return empty for now)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      fetch(`${baseUrl}/api/worker/gap-detection`, {
        method: 'POST',
        headers: {
           'Authorization': `Bearer ${process.env.EXTRACTION_WORKER_SECRET || 'pv_wrk_8f9c1e7a4b2d3f6a8e5c1b9d4f7a2e3c'}`,
        }
      }).catch(console.error);

      return NextResponse.json({ 
        data: { crossSell: [], atRisk: [] },
        status: 'calculating'
      });
    }

    // `redis.get` automatically parses JSON for objects, but handles strings if it's stringified
    const data = typeof cached === 'string' ? JSON.parse(cached) : cached;

    return NextResponse.json({ data, status: 'ready' });
  } catch (error: any) {
    console.error('Gap detection fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
