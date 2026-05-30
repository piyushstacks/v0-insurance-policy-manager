import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple Levenshtein ratio
function wordDistanceRatio(s1: string, s2: string): number {
  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  const distance = track[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

function calculateSimilarity(name1: string, name2: string): number {
  const n1 = name1.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const n2 = name2.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  
  if (n1 === n2) return 1.0;
  
  const w1 = n1.split(/\s+/).filter(Boolean);
  const w2 = n2.split(/\s+/).filter(Boolean);
  
  if (w1.length === 0 || w2.length === 0) return 0;
  
  let matches = 0;
  const set2 = new Set(w2);
  w1.forEach(w => {
    if (set2.has(w)) {
      matches++;
    } else {
      for (const word2 of w2) {
        if (wordDistanceRatio(w, word2) > 0.8) {
          matches++;
          break;
        }
      }
    }
  });
  
  const minWords = Math.min(w1.length, w2.length);
  const wordRatio = matches / minWords;
  const overlapRatio = (2 * matches) / (w1.length + w2.length);
  
  return (wordRatio * 0.7) + (overlapRatio * 0.3);
}

export async function GET(request: NextRequest) {
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
              // Ignore
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch ALL customers with their policies counts to perform full database similarity check
    const { data: customers, error } = await supabaseAdmin!
      .from('customers')
      .select(`
         id,
         name,
         email,
         mobile,
         policies ( id )
      `)
      .eq('user_id', user.id)
      .neq('name', 'Bulk Upload Customer');

    if (error) throw error;
    if (!customers || customers.length < 2) {
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }

    const processed = customers.map(c => {
      const pCount = Array.isArray(c.policies) ? c.policies.length : (c.policies ? 1 : 0);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        mobile: c.mobile,
        policiesCount: pCount
      };
    });

    const suggestions: any[] = [];
    const matchedPairs = new Set<string>();

    for (let i = 0; i < processed.length; i++) {
      for (let j = i + 1; j < processed.length; j++) {
        const c1 = processed[i];
        const c2 = processed[j];

        // Skip if exact same ID
        if (c1.id === c2.id) continue;

        const similarity = calculateSimilarity(c1.name, c2.name);

        // High similarity match threshold (e.g. 75% or greater)
        if (similarity >= 0.75) {
          const pairKey = [c1.id, c2.id].sort().join(':');
          if (matchedPairs.has(pairKey)) continue;
          matchedPairs.add(pairKey);

          // Weight who is the keeper (target) and who gets merged (source)
          const c1Weight = (c1.policiesCount * 10) + (c1.email ? 5 : 0) + (c1.mobile ? 5 : 0);
          const c2Weight = (c2.policiesCount * 10) + (c2.email ? 5 : 0) + (c2.mobile ? 5 : 0);

          const target = c2Weight > c1Weight ? c2 : c1;
          const source = c2Weight > c1Weight ? c1 : c2;

          suggestions.push({
            similarity: Math.round(similarity * 100),
            source,
            target
          });
        }
      }
    }

    // Sort by highest similarity
    suggestions.sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (error: any) {
    console.error('Suggestions API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch suggestions' }, { status: 500 });
  }
}
