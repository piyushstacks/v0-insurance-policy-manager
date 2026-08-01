import { redirect } from 'next/navigation';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Sidebar from '@/components/sidebar';
import BottomNav from '@/components/bottom-nav';
import { TeamProvider } from '@/hooks/use-team';
import { GlobalCommandPalette } from '@/components/ui/command-palette';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
            // Ignore cookie setting errors
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] w-[100vw] overflow-hidden bg-background font-sans transition-colors">
      <Sidebar user={user} />
      <main className="flex-1 w-full flex flex-col min-w-0 h-[100dvh]">
        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full pb-20 lg:pb-0 relative">
          <TeamProvider>
            {children}
          </TeamProvider>
        </div>
      </main>
      <BottomNav />
      <GlobalCommandPalette />
    </div>
  );
}
