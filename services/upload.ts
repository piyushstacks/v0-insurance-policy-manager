/**
 * Upload Service
 * Handles file uploads to Supabase Storage and document record creation
 */

import { supabaseAdmin, supabase, storageBucket } from '@/lib/supabase';
import { queueDocumentExtraction } from './extraction';

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

    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
      throw new Error('File size exceeds 10MB limit');
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

    console.log(`[v0] Uploading file: ${fileName}`);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(storageBucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
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
          file_url: fileUrl,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
        },
      ])
      .select('id')
      .single();

    if (docError) {
      throw new Error(`Failed to create document record: ${docError.message}`);
    }

    const documentId = docData.id;
    console.log(`[v0] Document created: ${documentId}`);

    // Queue for OCR extraction if enabled
    if (autoExtract) {
      try {
        await queueDocumentExtraction(userId, documentId, policyId, fileUrl);
        console.log(`[v0] Extraction job queued for document: ${documentId}`);
      } catch (extractError) {
        console.error(`[v0] Failed to queue extraction:`, extractError);
        // Don't fail the upload if extraction queueing fails
        // User can retry extraction later
      }
    }

    return {
      success: true,
      documentId,
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
    const { error: storageError } = await supabase.storage
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
    const { data: docData, error: docError } = await supabaseAdmin!
      .from('policy_documents')
      .select('extraction_job_id')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;

    if (!docData.extraction_job_id) {
      return { status: 'not_started' };
    }

    const { data: jobData, error: jobError } = await supabaseAdmin!
      .from('extraction_jobs')
      .select('*')
      .eq('id', docData.extraction_job_id)
      .single();

    if (jobError) throw jobError;

    return {
      status: jobData.status,
      data: jobData.extracted_data,
      error: jobData.error_message,
    };
  } catch (error) {
    console.error('[v0] Failed to get extraction status:', error);
    throw error;
  }
}
