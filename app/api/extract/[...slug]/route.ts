/**
 * API Routes - Extraction Service V2
 * Implements all endpoints for single, bulk, and queued extraction
 * Path: /app/api/v1/extraction/
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  extractDocumentInline,
  processExtractionJob,
  processBulkExtractions,
  getExtractionStatus,
  getExtractionStats,
  cleanupOldExtractionJobs,
  findOrCreateCustomer,
  findOrCreateInsurer,
  PolicyExtractionMetrics as ExtractionMetrics,
} from '@/services/extraction';
import { uploadPolicyDocument } from '@/services/upload';

// ============================================================================
// POST /api/v1/extraction/upload-single
// Single document upload with inline extraction
// ============================================================================

export async function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ROUTE: POST /api/v1/extraction/upload-single
  if (pathname.endsWith('/upload-single')) {
    try {
      console.log('[API] POST /extraction/upload-single');

      const formData = await request.formData();
      const file = formData.get('file') as File;
      const policyId = formData.get('policyId') as string;
      const userId = formData.get('userId') as string;

      if (!file || !policyId || !userId) {
        return NextResponse.json(
          { error: 'Missing required fields: file, policyId, userId' },
          { status: 400 }
        );
      }

      console.log(`[API] Uploading document for policy ${policyId}, user ${userId}`);

      // Upload and run inline extraction (fire-and-forget)
      const uploadResult = await uploadPolicyDocument(userId, policyId, file, true);

      return NextResponse.json(
        {
          success: true,
          message: 'Document uploaded and extraction queued',
          document: {
            documentId: uploadResult.documentId,
            fileName: uploadResult.fileName,
            fileUrl: uploadResult.fileUrl,
            fileSize: uploadResult.fileSize,
          },
          note: 'Extraction is being processed in background. Check status with GET /extraction/status/{jobId}',
        },
        { status: 201 }
      );
    } catch (error: any) {
      console.error('[API] Upload error:', error);
      return NextResponse.json(
        { error: error.message || 'Upload failed' },
        { status: 500 }
      );
    }
  }

  // ROUTE: POST /api/v1/extraction/upload-bulk
  // Bulk document upload (max 50 files)
  if (pathname.endsWith('/upload-bulk')) {
    try {
      console.log('[API] POST /extraction/upload-bulk');

      const formData = await request.formData();
      const files = formData.getAll('files') as File[];
      const policyId = formData.get('policyId') as string;
      const userId = formData.get('userId') as string;

      if (!files || files.length === 0 || !policyId || !userId) {
        return NextResponse.json(
          { error: 'Missing required fields: files[], policyId, userId' },
          { status: 400 }
        );
      }

      if (files.length > 50) {
        return NextResponse.json(
          { error: 'Maximum 50 files allowed per bulk upload' },
          { status: 400 }
        );
      }

      console.log(
        `[API] Bulk uploading ${files.length} documents for policy ${policyId}`
      );

      const uploadResults = await Promise.allSettled(
        files.map(file =>
          // autoExtract=false: caller will queue extraction separately
          uploadPolicyDocument(userId, policyId, file, false)
        )
      );

      const successful = uploadResults.filter(r => r.status === 'fulfilled').length;
      const failed = uploadResults.filter(r => r.status === 'rejected').length;

      console.log(`[API] Bulk upload: ${successful} successful, ${failed} failed`);

      return NextResponse.json(
        {
          success: successful > 0,
          summary: {
            total: files.length,
            successful,
            failed,
          },
          message: `${successful} documents queued for extraction, ${failed} failed`,
          note: 'Documents will be processed in background. Monitor /extraction/stats',
        },
        { status: successful > 0 ? 200 : 400 }
      );
    } catch (error: any) {
      console.error('[API] Bulk upload error:', error);
      return NextResponse.json(
        { error: error.message || 'Bulk upload failed' },
        { status: 500 }
      );
    }
  }

  // ROUTE: POST /api/v1/extraction/process-job
  // Manually trigger job processing (for cron or worker)
  if (pathname.endsWith('/process-job')) {
    try {
      console.log('[API] POST /extraction/process-job');

      // Authenticate: ensure request is from authorized worker/cron
      const token = request.headers.get('Authorization')?.replace('Bearer ', '');
      const expectedToken = process.env.EXTRACTION_WORKER_TOKEN;

      if (!expectedToken || token !== expectedToken) {
        return NextResponse.json(
          { error: 'Unauthorized: invalid or missing worker token' },
          { status: 401 }
        );
      }

      const result = await processExtractionJob();

      if (!result) {
        return NextResponse.json(
          { message: 'No pending jobs' },
          { status: 204 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          jobId: result.jobId,
          metrics: result.metrics,
          message: `Job processed: ${result.metrics.success ? '✓ Success' : '✗ Failed'}`,
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error('[API] Job processing error:', error);
      return NextResponse.json(
        { error: error.message || 'Job processing failed' },
        { status: 500 }
      );
    }
  }

  // ROUTE: POST /api/v1/extraction/process-bulk
  // Trigger bulk processing with concurrency limit
  if (pathname.endsWith('/process-bulk')) {
    try {
      console.log('[API] POST /extraction/process-bulk');

      const token = request.headers.get('Authorization')?.replace('Bearer ', '');
      const expectedToken = process.env.EXTRACTION_WORKER_TOKEN;

      if (!expectedToken || token !== expectedToken) {
        return NextResponse.json(
          { error: 'Unauthorized: invalid or missing worker token' },
          { status: 401 }
        );
      }

      const body = await request.json();
      const { maxConcurrent = 5 } = body;

      console.log(`[API] Starting bulk processing with max ${maxConcurrent} concurrent`);

      const results = await processBulkExtractions(maxConcurrent);

      const stats = {
        processed: results.length,
        successful: results.filter((r: ExtractionMetrics) => r.success).length,
        failed: results.filter((r: ExtractionMetrics) => !r.success).length,
        avgDuration: results.length > 0 
          ? results.reduce((sum: number, r: ExtractionMetrics) => sum + r.duration, 0) / results.length 
          : 0,
        customersDeduped: results.filter((r: ExtractionMetrics) => r.customerDeduped).length,
        insurersResolved: results.filter((r: ExtractionMetrics) => r.insurerResolved).length,
      };

      return NextResponse.json(
        {
          success: stats.successful > 0,
          stats,
          results: results.slice(0, 10), // Return first 10 for brevity
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error('[API] Bulk processing error:', error);
      return NextResponse.json(
        { error: error.message || 'Bulk processing failed' },
        { status: 500 }
      );
    }
  }

  // ROUTE: GET /api/v1/extraction/status/{jobId}
  if (pathname.includes('/status/')) {
    try {
      const jobId = pathname.split('/status/')[1];
      if (!jobId) {
        return NextResponse.json(
          { error: 'Job ID is required' },
          { status: 400 }
        );
      }

      console.log(`[API] GET /extraction/status/${jobId}`);

      const status = await getExtractionStatus(jobId);

      if (!status) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        jobId: status.id,
        status: status.status,
        documentId: status.document_id,
        extractedData: status.extracted_data || {},
        error: status.error_message,
        completedAt: status.completed_at,
        createdAt: status.created_at,
      });
    } catch (error: any) {
      console.error('[API] Status error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to get status' },
        { status: 500 }
      );
    }
  }

  // ROUTE: GET /api/v1/extraction/stats
  if (pathname.endsWith('/stats')) {
    try {
      console.log('[API] GET /extraction/stats');

      const stats = await getExtractionStats();

      return NextResponse.json({
        timestamp: new Date().toISOString(),
        stats,
        successRate: stats.totalJobs > 0 
          ? (stats.completedJobs / stats.totalJobs * 100).toFixed(2) + '%'
          : 'N/A',
      });
    } catch (error: any) {
      console.error('[API] Stats error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to get stats' },
        { status: 500 }
      );
    }
  }

  // ROUTE: POST /api/v1/extraction/cleanup
  if (pathname.endsWith('/cleanup')) {
    try {
      console.log('[API] POST /extraction/cleanup');

      const token = request.headers.get('Authorization')?.replace('Bearer ', '');
      const expectedToken = process.env.EXTRACTION_WORKER_TOKEN;

      if (!expectedToken || token !== expectedToken) {
        return NextResponse.json(
          { error: 'Unauthorized: invalid or missing worker token' },
          { status: 401 }
        );
      }

      const body = await request.json();
      const { daysOld = 30 } = body;

      const removed = await cleanupOldExtractionJobs(daysOld);

      return NextResponse.json({
        success: true,
        message: `Removed ${removed} extraction jobs older than ${daysOld} days`,
        removed,
      });
    } catch (error: any) {
      console.error('[API] Cleanup error:', error);
      return NextResponse.json(
        { error: error.message || 'Cleanup failed' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Endpoint not found' },
    { status: 404 }
  );
}

// ============================================================================
// Cron Job Handler (for Vercel or similar)
// Path: /api/crons/extraction-worker
// ============================================================================

export async function extractionWorkerCron(request: NextRequest) {
  console.log('[Cron] Extraction worker cron triggered');

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const expectedToken = process.env.EXTRACTION_WORKER_TOKEN;

  if (!expectedToken || token !== expectedToken) {
    console.error('[Cron] Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Process up to 20 jobs per cron run (adjust as needed)
    const results = await processBulkExtractions(5);

    const stats = {
      jobsProcessed: results.length,
      successful: results.filter((r: ExtractionMetrics) => r.success).length,
      failed: results.filter((r: ExtractionMetrics) => !r.success).length,
    };

    console.log('[Cron] Extraction worker completed:', stats);

    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (error: any) {
    console.error('[Cron] Extraction worker failed:', error);
    return NextResponse.json(
      { error: error.message || 'Cron failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// EXAMPLE: Client-side implementation
// ============================================================================

/**
 * Example: Single file upload
 */
export async function uploadSingleDocument(
  policyId: string,
  file: File,
  userId: string
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('policyId', policyId);
  formData.append('userId', userId);

  const response = await fetch('/api/v1/extraction/upload-single', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Upload failed');
  return response.json();
}

/**
 * Example: Bulk file upload
 */
export async function uploadBulkDocuments(
  policyId: string,
  files: File[],
  userId: string
) {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('policyId', policyId);
  formData.append('userId', userId);

  const response = await fetch('/api/v1/extraction/upload-bulk', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Bulk upload failed');
  return response.json();
}

/**
 * Example: Check extraction status
 */
export async function checkExtractionStatus(jobId: string) {
  const response = await fetch(`/api/v1/extraction/status/${jobId}`);
  if (!response.ok) throw new Error('Failed to get status');
  return response.json();
}

/**
 * Example: Poll for extraction completion
 */
export async function waitForExtraction(
  jobId: string,
  maxWaitMs = 30000,
  pollIntervalMs = 1000
) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkExtractionStatus(jobId);

    if (status.status === 'completed') {
      return { success: true, data: status.extractedData };
    }

    if (status.status === 'failed') {
      return { success: false, error: status.error };
    }

    // Still processing, wait and retry
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return { success: false, error: 'Extraction timeout' };
}

// ============================================================================
// EXAMPLE: Cron configuration for Vercel
// vercel.json or package.json
// ============================================================================

/**
 * vercel.json - Cron configuration:
 *
 * {
 *   "crons": [
 *     {
 *       "path": "/api/crons/extraction-worker",
 *       "schedule": "* * * * *"  // Every minute
 *     }
 *   ]
 * }
 *
 * Or in package.json:
 *
 * "crons": [
 *   {
 *     "path": "/api/crons/extraction-worker",
 *     "schedule": "0 0 * * *"  // Every day
 *   }
 * ]
 *
 * Environment variables needed:
 *
 * EXTRACTION_WORKER_TOKEN=your-secure-token-here
 * OPENROUTER_API_KEY=your-openrouter-key
 * SUPABASE_SERVICE_ROLE_KEY=your-supabase-key
 * OCR_PROVIDER=google-document-ai (or pdf-parse)
 */
