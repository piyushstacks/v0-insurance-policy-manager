/**
 * Upload Service
 * Handles file uploads to Supabase Storage and document record creation
 */

import { supabaseAdmin, storageBucket } from '@/lib/supabase';
import { extractDocumentInline, queueDocumentExtraction } from './extraction';
import { compressPdf } from './pdf-compression';

/**
 * Upload a policy document
 * Creates record in policy_documents table and queues for extraction
 */
export async function uploadPolicyDocument(
  userId: string,
  policyId: string,
  file: File,
  autoExtract: boolean = true
) {
  try {
    // Validate file
    if (!file) {
      throw new Error('No file provided');
    }

    const maxFileSize = 50 * 1024 * 1024; // 50MB limits natively
    if (file.size > maxFileSize) {
      throw new Error('File size exceeds 50MB limit');
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('File type must be PDF, JPG, or PNG');
    }

    // Generate unique file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${userId}/${policyId}/${timestamp}-${randomId}.${fileExtension}`;

    console.log(`[v0] Processing file: ${fileName}`);

    let uploadBody: File | Buffer = file;
    if (file.type === 'application/pdf') {
      const buffer = Buffer.from(await file.arrayBuffer());
      uploadBody = await compressPdf(buffer);
    }

    // Upload to Supabase Storage using Admin client to bypass RLS policies
    const { data: uploadData, error: uploadError } = await supabaseAdmin!.storage
      .from(storageBucket)
      .upload(fileName, uploadBody, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      if (uploadError.message.toLowerCase().includes('not found') || uploadError.message.toLowerCase().includes('bucket')) {
        console.log(`[v0] Bucket '${storageBucket}' not found. Auto-creating public bucket...`);
        const { error: bucketErr } = await supabaseAdmin!.storage.createBucket(storageBucket, { public: true });
        
        if (bucketErr && !bucketErr.message.includes('already exists')) {
           throw new Error(`Failed to auto-create bucket: ${bucketErr.message}`);
        }
        
        // Retry upload after successful bucket creation natively bypassing RLS
        const retry = await supabaseAdmin!.storage.from(storageBucket).upload(fileName, uploadBody, {
           cacheControl: '3600',
           upsert: false,
           contentType: file.type,
        });
        
        if (retry.error) {
           throw new Error(`Upload failed after bucket creation: ${retry.error.message}`);
        }
      } else {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin!.storage
      .from(storageBucket)
      .getPublicUrl(fileName);

    const fileUrl = urlData.publicUrl;

    // Create document record
    const { data: docData, error: docError } = await supabaseAdmin!
      .from('policy_documents')
      .insert([
        {
          policy_id: policyId,
          file_name: file.name,
          file_path: fileName, 
          file_type: file.type === 'application/pdf' ? 'pdf' : (file.type === 'image/jpeg' ? 'jpg' : 'png'),
          upload_date: new Date().toISOString(),
        },
      ])
      .select('id')
      .single();

    if (docError) {
      throw new Error(`Failed to create document record: ${docError.message}`);
    }

    const documentId = docData.id;
    console.log(`[v0] Document created: ${documentId}`);

    // Run extraction:
    // autoExtract=true  → inline (synchronous, used by single-file upload)
    // autoExtract=false → caller handles queueing (bulk upload calls queueDocumentExtraction separately)
    if (autoExtract) {
      // Run inline extraction — does NOT block response (fire-and-forget, best-effort)
      extractDocumentInline(documentId, policyId, fileUrl).catch((e) =>
        console.error('[v0] Inline extraction failed (non-fatal):', e)
      );
    }

    return {
      success: true,
      documentId,
      policyId,
      fileName: file.name,
      fileUrl,
      fileSize: file.size,
    };
  } catch (error) {
    console.error('[v0] Upload error:', error);
    throw error;
  }
}

/**
 * Delete a policy document
 */
export async function deletePolicyDocument(documentId: string, filePath: string) {
  try {
    // Delete from storage
    const { error: storageError } = await supabaseAdmin!.storage
      .from(storageBucket)
      .remove([filePath]);

    if (storageError) {
      console.warn('Storage deletion warning:', storageError);
    }

    // Delete record from database
    const { error: dbError } = await supabaseAdmin!
      .from('policy_documents')
      .delete()
      .eq('id', documentId);

    if (dbError) {
      throw new Error(`Failed to delete document record: ${dbError.message}`);
    }

    return { success: true };
  } catch (error) {
    console.error('[v0] Delete error:', error);
    throw error;
  }
}

/**
 * Get extraction result for a document
 */
export async function getDocumentExtraction(documentId: string) {
  try {
    const { data: jobData, error: jobError } = await supabaseAdmin!
      .from('extraction_jobs')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!jobData) {
      return { status: 'not_started' };
    }

    return {
      status: jobData.status,
      data: null, // The JSON was successfully written directly into the policies table by the new AI worker rules!
      error: jobData.error_message,
    };
  } catch (error) {
    console.error('[v0] Failed to get extraction status:', error);
    throw error;
  }
}
