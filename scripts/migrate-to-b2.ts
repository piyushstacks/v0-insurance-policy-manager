/**
 * Supabase Storage to Backblaze B2 Migration Script
 * 
 * Run with: npx tsx scripts/migrate-to-b2.ts
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import pLimit from 'p-limit';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = 'policy-documents'; // Matches storageBucket from lib/supabase

const B2_ENDPOINT = process.env.B2_ENDPOINT;
const B2_ACCESS_KEY_ID = process.env.B2_ACCESS_KEY_ID;
const B2_SECRET_ACCESS_KEY = process.env.B2_SECRET_ACCESS_KEY;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

if (!B2_ENDPOINT || !B2_ACCESS_KEY_ID || !B2_SECRET_ACCESS_KEY || !B2_BUCKET_NAME) {
  console.error('Missing Backblaze B2 credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const b2Client = new S3Client({
  region: 'auto',
  endpoint: B2_ENDPOINT,
  credentials: {
    accessKeyId: B2_ACCESS_KEY_ID,
    secretAccessKey: B2_SECRET_ACCESS_KEY,
  },
});

async function migrate() {
  console.log('Fetching documents from Supabase...');
  
  // 1. Fetch all documents
  const { data: documents, error: fetchError } = await supabase
    .from('policy_documents')
    .select('id, file_path, file_type');

  if (fetchError) {
    console.error('Error fetching documents:', fetchError);
    return;
  }

  if (!documents || documents.length === 0) {
    console.log('No documents found to migrate.');
    return;
  }

  console.log(`Found ${documents.length} documents. Starting migration...`);

  // We process with a concurrency limit of 5 to avoid overwhelming network/memory
  const limiter = pLimit(5);
  let successCount = 0;
  let failCount = 0;

  const tasks = documents.map((doc, index) => limiter(async () => {
    const { id, file_path, file_type } = doc;
    if (!file_path) return;

    try {
      console.log(`[${index + 1}/${documents.length}] Migrating: ${file_path}`);

      // 2. Download from Supabase
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(file_path);

      if (downloadError) {
        throw new Error(`Supabase download failed: ${downloadError.message}`);
      }

      if (!fileData) {
        throw new Error('Supabase returned empty file data');
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());

      // 3. Upload to Backblaze B2
      const contentType = file_type === 'pdf' ? 'application/pdf' : 
                          file_type === 'jpg' ? 'image/jpeg' : 'image/png';

      const uploadCommand = new PutObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: file_path,
        Body: buffer,
        ContentType: contentType,
      });

      await b2Client.send(uploadCommand);

      // 4. (Optional) Delete from Supabase after successful migration
      const { error: deleteError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([file_path]);

      if (deleteError) {
        console.warn(`[!] File migrated to B2, but failed to delete from Supabase: ${file_path}`);
      }

      successCount++;
    } catch (err: any) {
      console.error(`[X] Error migrating ${file_path}:`, err.message);
      failCount++;
    }
  }));

  await Promise.all(tasks);

  console.log('--- Migration Complete ---');
  console.log(`Total: ${documents.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
}

migrate().catch(console.error);
