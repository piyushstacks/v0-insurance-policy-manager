import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractDocumentInline } from '@/services/extraction';
import { getB2PublicUrl } from '@/lib/b2';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching policies for ICICI and Digit...');
    
    // Find ICICI, Digit, and Tata insurers
    const { data: insurers } = await supabaseAdmin!
      .from('insurers')
      .select('id, name')
      .or('name.ilike.%icici%,name.ilike.%digit%,name.ilike.%tata%');

    if (!insurers || insurers.length === 0) {
      return NextResponse.json({ message: 'No such insurers found.' });
    }
    
    const insurerIds = insurers.map(i => i.id);
    console.log(`Found insurers: ${insurers.map(i => i.name).join(', ')}`);

    // Find policies
    const { data: policies } = await supabaseAdmin!
      .from('policies')
      .select('id, policy_number, insurer_id')
      .in('insurer_id', insurerIds);

    if (!policies || policies.length === 0) {
      return NextResponse.json({ message: 'No policies found for these insurers.' });
    }
    console.log(`Found ${policies.length} policies.`);

    // Find documents for these policies
    const { data: docs } = await supabaseAdmin!
      .from('policy_documents')
      .select('id, policy_id, file_path, raw_ocr_text')
      .in('policy_id', policies.map(p => p.id));

    if (!docs || docs.length === 0) {
      return NextResponse.json({ message: 'No documents found.' });
    }
    
    const results = [];
    console.log(`Found ${docs.length} documents to re-extract.`);

    for (const doc of docs) {
      console.log(`Re-extracting document ${doc.id} for policy ${doc.policy_id}...`);
      
      if (doc.file_path) {
         const fileUrl = getB2PublicUrl(doc.file_path);
         console.log(`Fetching PDF from B2 to re-extract: ${fileUrl}`);
         
         // Trigger inline extraction asynchronously, fire-and-forget so the request doesn't timeout
         extractDocumentInline(doc.id, doc.policy_id, fileUrl).catch(e => console.error(`[Fix] Error on ${doc.id}:`, e.message));
         
         results.push({ id: doc.id, status: 'queued for re-extraction with full PDF' });
      } else {
         console.log(`No file path available for document ${doc.id}. Skipping.`);
         results.push({ id: doc.id, status: 'skipped (no file path)' });
      }
    }

    return NextResponse.json({ message: 'Done', results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
