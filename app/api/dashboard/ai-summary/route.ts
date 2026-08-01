import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import redis from '@/lib/redis';
import { getAdvancedDashboardMetrics } from '@/services/dashboard-cache';
import { getTeamUserIds } from '@/services/team';

// Initialize OpenAI client inside the request handler to avoid build errors if env vars are missing at build time
const getOpenAIClient = () => {
  return new OpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY || 'dummy-key-for-build',
  });
};

const MODEL = process.env.EXTRACTION_MODEL || 'llama-3.3-70b-versatile';

/**
 * Extracts all numeric values from a given string.
 * This is used for hallucination validation.
 */
function extractNumbers(text: string): number[] {
  const matches = text.match(/\b\d+(?:[\.,]\d+)?\b/g);
  if (!matches) return [];
  return matches.map(m => parseFloat(m.replace(/,/g, ''))).filter(n => !isNaN(n));
}

export async function GET(request: Request) {
  try {
    const openai = getOpenAIClient();
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
    const teamUserIds = await getTeamUserIds(userId);
    const date = new Date();
    const monthKey = `${date.getFullYear()}_${date.getMonth() + 1}`;
    const cacheKey = `dashboard:team:${teamUserIds.sort().join('_')}:ai_summary:${monthKey}`;

    // 1. Try Cache First
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json({ summary: cached });
    }

    // 2. Fetch Data
    const metrics = await getAdvancedDashboardMetrics(userId);
    
    // We construct a strictly minimal JSON payload to avoid token bloat
    const payload = {
      total_aum: metrics.aum,
      aum_growth_mom_percent: metrics.aumGrowthMoM,
      aum_growth_yoy_percent: metrics.aumGrowthYoY,
      persistency_13_month_percent: metrics.persistency13M,
      persistency_25_month_percent: metrics.persistency25M,
      at_risk_renewals_count: metrics.lapseRiskPolicies?.length || 0,
      top_clients_count: metrics.topClients?.length || 0,
    };

    const payloadString = JSON.stringify(payload, null, 2);
    const validNumbers = extractNumbers(payloadString);

    const systemPrompt = `You are a strict, purely analytical AI assistant for an insurance advisory firm.
Your job is to generate a short, professional, natural-language summary (3-5 sentences) of the current month's business activity based strictly on the JSON data provided.

RULES:
1. ONLY narrate the numbers provided in the JSON.
2. DO NOT hallucinate, invent, or estimate any numbers, currencies, percentages, or dates that are absent from the JSON.
3. If a metric is 0 or absent, you may mention it is zero, but do not invent a value.
4. Keep the tone serious, numbers-driven, and suitable for a senior wealth manager.
5. Do not include introductory or concluding conversational filler. Just return the summary paragraph.
`;

    const maxRetries = 1;
    let summary = '';
    let isValid = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `JSON Data:\n${payloadString}` }
        ],
        temperature: 0.1, // Low temperature for factual consistency
        max_tokens: 150,
      });

      const generatedText = response.choices[0]?.message?.content?.trim() || '';
      if (!generatedText) break;

      // Validation Check: Ensure no hallucinated numbers
      const generatedNumbers = extractNumbers(generatedText);
      const invalidNumbers = generatedNumbers.filter(
        num => !validNumbers.includes(num) && num !== 0 && num !== 13 && num !== 25 
      );

      if (invalidNumbers.length === 0) {
        summary = generatedText;
        isValid = true;
        break; // Success
      } else {
        console.warn(`[AI Summary] Attempt ${attempt + 1} failed validation. Hallucinated numbers:`, invalidNumbers);
        summary = generatedText; 
      }
    }

    if (!summary) {
      summary = "Business metrics are stable this month. Continue monitoring persistency and upcoming renewals.";
    }

    // Cache the result for the remainder of the month
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    const ttlSeconds = Math.floor((endOfMonth.getTime() - date.getTime()) / 1000);
    
    if (isValid && ttlSeconds > 0) {
      await redis.set(cacheKey, summary, { ex: ttlSeconds });
    }

    return NextResponse.json({ summary, isValid });
  } catch (error: any) {
    console.error('Error generating AI summary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
