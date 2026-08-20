import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

export const runtime = 'nodejs';

// Lazy load OpenAI to prevent module evaluation crashes if API key is missing
let openaiClient: OpenAI | null = null;
function getOpenAI() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured in the environment.');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

async function getAuthSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
  return await supabase.auth.getUser();
}

export async function POST(request: NextRequest) {
  try {
    const { data: { user } } = await getAuthSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const target = formData.get('target') as string;

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    if (!['todo', 'followup'].includes(target)) {
      return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
    }

    // 1. Transcribe Audio using Whisper
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    const transcribedText = transcription.text;
    console.log(`[Voice Command] Transcribed text: "${transcribedText}"`);

    if (!transcribedText || transcribedText.trim().length === 0) {
      return NextResponse.json({ error: 'Could not understand audio' }, { status: 400 });
    }

    // 2. Parse Intent with GPT-4o-mini
    const todayDate = new Date().toISOString().split('T')[0];
    
    // Define the schema for structured output
    const prompt = `
You are an AI assistant helping a user manage their insurance agency CRM.
The user is currently on the "${target}" page.
Today's date is: ${todayDate}.

Extract the action and details from the user's voice command: "${transcribedText}"

Target must be: "todo" or "followup".
Action must be one of: "CREATE", "UPDATE", "DELETE", "COMPLETE".

For CREATE, provide the necessary fields.
For UPDATE, DELETE, or COMPLETE, provide a search query or a keyword to identify the record they are referring to in "search_hint".

Respond with a JSON object exactly matching this structure (do not include markdown formatting):
{
  "action": "CREATE" | "UPDATE" | "DELETE" | "COMPLETE",
  "target": "todo" | "followup",
  "search_hint": "string (only if action is not CREATE)",
  "payload": {
    // For CREATE Todo: title, description (optional), category (e.g. Personal, Business), priority (High, Medium, Low), scheduled_date (YYYY-MM-DD)
    // For CREATE Follow-up: prospect_name (or customer_name), notes (optional), category, priority (High, Medium, Low), scheduled_date (YYYY-MM-DD)
  }
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const aiResponseText = completion.choices[0].message.content || '{}';
    const parsedIntent = JSON.parse(aiResponseText);
    
    console.log('[Voice Command] Parsed Intent:', parsedIntent);

    // 3. Execute Database Action
    const { action, payload, search_hint } = parsedIntent;
    const finalTarget = parsedIntent.target || target;

    if (action === 'CREATE') {
      if (finalTarget === 'todo') {
        const { data, error } = await supabaseAdmin!
          .from('todos')
          .insert({
            user_id: user.id,
            title: payload.title || 'Voice Task',
            description: payload.description || null,
            category: payload.category || 'Personal',
            priority: payload.priority || 'Medium',
            scheduled_date: payload.scheduled_date || todayDate,
            status: 'pending'
          });
        
        if (error) throw error;
        return NextResponse.json({ message: `Created todo: ${payload.title || 'Voice Task'}` });
      } else {
        const { data, error } = await supabaseAdmin!
          .from('business_followups')
          .insert({
            user_id: user.id,
            assignees: [user.id],
            prospect_name: payload.prospect_name || payload.customer_name || 'Voice Prospect',
            category: payload.category || payload.priority || '',
            notes: payload.notes || payload.description || '',
            scheduled_date: payload.scheduled_date || todayDate,
            status: 'pending'
          });
          
        if (error) throw error;
        return NextResponse.json({ message: `Created follow-up for: ${payload.prospect_name || 'Voice Prospect'}` });
      }
    } else if (action === 'COMPLETE' || action === 'DELETE' || action === 'UPDATE') {
      // Find the record using search_hint
      if (!search_hint) {
        return NextResponse.json({ error: 'Could not identify which record to modify.' }, { status: 400 });
      }

      const table = finalTarget === 'todo' ? 'todos' : 'business_followups';
      const searchColumn = finalTarget === 'todo' ? 'title' : 'prospect_name';

      // Find the closest match for the user
      const { data: records, error: searchError } = await supabaseAdmin!
        .from(table)
        .select('*')
        .eq('user_id', user.id)
        .ilike(searchColumn, `%${search_hint}%`)
        .limit(1);

      if (searchError) throw searchError;
      
      if (!records || records.length === 0) {
        return NextResponse.json({ error: `Could not find a ${finalTarget} matching "${search_hint}"` }, { status: 404 });
      }

      const recordId = records[0].id;

      if (action === 'COMPLETE') {
        const { error } = await supabaseAdmin!.from(table).update({ status: 'completed' }).eq('id', recordId);
        if (error) throw error;
        return NextResponse.json({ message: `Marked "${records[0][searchColumn]}" as completed` });
      } else if (action === 'DELETE') {
        const { error } = await supabaseAdmin!.from(table).delete().eq('id', recordId);
        if (error) throw error;
        return NextResponse.json({ message: `Deleted "${records[0][searchColumn]}"` });
      } else if (action === 'UPDATE') {
        // Minimal update logic
        const { error } = await supabaseAdmin!.from(table).update({ ...payload }).eq('id', recordId);
        if (error) throw error;
        return NextResponse.json({ message: `Updated "${records[0][searchColumn]}"` });
      }
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });

  } catch (error: any) {
    console.error('Voice Command Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
