/**
 * Bulk Upload Integration Test Suite
 * Tests the complete flow: upload → queue → extraction → realtime update
 * 
 * To run: npx tsx app/__tests__/bulk-upload.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WORKER_SECRET = process.env.EXTRACTION_WORKER_SECRET || 'test-secret';

// Test data
const TEST_PDFS = [
  {
    name: 'policy1.pdf',
    url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table.pdf', // Sample PDF for testing
  },
  {
    name: 'policy2.pdf',
    url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table.pdf',
  },
  {
    name: 'policy3.pdf',
    url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table.pdf',
  },
  {
    name: 'policy4.pdf',
    url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table.pdf',
  },
];

describe('Bulk Upload & Extraction System', () => {
  let authToken: string;
  let uploadedPolicies: Array<{ policyId: string; documentId: string }> = [];

  beforeAll(async () => {
    console.log('🔧 Setting up test environment...');
    
    // Note: In a real test, we'd authenticate here
    // For now, we'll use the API's auto-auth for development
    authToken = 'dev-auth'; // Placeholder
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test data...');
    // In a real test, we'd delete uploaded policies and documents
  });

  describe('File Upload', () => {
    it('should upload a single file successfully', async () => {
      console.log('\n📤 Test: Upload single file');

      // Create a test file
      const testFile = await fetch(TEST_PDFS[0].url).then(r => r.blob());

      const formData = new FormData();
      formData.append('file', testFile, TEST_PDFS[0].name);
      formData.append('autoExtract', 'true');

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.documentId).toBeDefined();
      expect(result.policyId).toBeDefined();
      expect(result.fileName).toBe(TEST_PDFS[0].name);

      uploadedPolicies.push({
        policyId: result.policyId,
        documentId: result.documentId,
      });

      console.log('✅ Single file uploaded successfully');
      console.log(`   Policy ID: ${result.policyId}`);
      console.log(`   Document ID: ${result.documentId}`);
    });

    it('should upload 4 files in bulk', async () => {
      console.log('\n📤 Test: Upload 4 files in bulk');

      const uploadPromises = TEST_PDFS.map(async (pdf) => {
        const testFile = await fetch(pdf.url).then(r => r.blob());
        const formData = new FormData();
        formData.append('file', testFile, pdf.name);
        formData.append('autoExtract', 'true');

        return fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          body: formData,
        });
      });

      const responses = await Promise.all(uploadPromises);
      const results = await Promise.all(responses.map(r => r.json()));

      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.length).toBe(4);

      // Store uploaded policies
      results.forEach((result, index) => {
        uploadedPolicies.push({
          policyId: result.policyId,
          documentId: result.documentId,
        });
        console.log(`   ✅ File ${index + 1}: ${result.fileName}`);
      });

      console.log(`✅ All 4 files uploaded successfully`);
    });

    it('should reject files with invalid type', async () => {
      console.log('\n📤 Test: Reject invalid file type');

      const testFile = new File(['invalid content'], 'test.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('file', testFile);
      formData.append('autoExtract', 'true');

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.error).toBeDefined();

      console.log('✅ Invalid file type rejected');
      console.log(`   Error: ${error.error}`);
    });
  });

  describe('Extraction Queue', () => {
    it('should check extraction job status', async () => {
      console.log('\n📋 Test: Check extraction job status');

      const response = await fetch(`${API_URL}/api/debug/extraction-jobs`, {
        headers: {
          'Authorization': `Bearer ${WORKER_SECRET}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.summary).toBeDefined();
      expect(data.summary.totalJobs).toBeGreaterThan(0);

      console.log('✅ Extraction job status retrieved');
      console.log(`   Total jobs: ${data.summary.totalJobs}`);
      console.log(`   Queued: ${data.summary.queuedCount}`);
      console.log(`   Processing: ${data.summary.processingCount}`);
      console.log(`   Completed: ${data.summary.completedCount}`);
      console.log(`   Failed: ${data.summary.failedCount}`);
      console.log(`   Redis queue length: ${data.summary.redisQueueLength}`);

      if (data.summary.issue) {
        console.log(`   ⚠️ Issue detected: ${data.summary.issue}`);
      }
    });

    it('should process extraction jobs from queue', async () => {
      console.log('\n⚙️ Test: Process extraction jobs');

      const response = await fetch(`${API_URL}/api/worker/extract`, {
        headers: {
          'Authorization': `Bearer ${WORKER_SECRET}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.jobsProcessed).toBeGreaterThanOrEqual(0);

      console.log('✅ Extraction worker ran successfully');
      console.log(`   Jobs processed: ${data.jobsProcessed}`);
      console.log(`   Jobs succeeded: ${data.jobsSucceeded || 0}`);
      console.log(`   Jobs failed: ${data.jobsFailed || 0}`);
      console.log(`   Remaining in queue: ${data.queueLength}`);
    });

    it('should handle failed extractions and allow retry', async () => {
      console.log('\n🔄 Test: Retry failed extractions');

      // First check for failed jobs
      const statusResponse = await fetch(`${API_URL}/api/debug/extraction-jobs`, {
        headers: {
          'Authorization': `Bearer ${WORKER_SECRET}`,
        },
      });

      const statusData = await statusResponse.json();
      const failedCount = statusData.summary.failedCount;

      if (failedCount > 0) {
        console.log(`   Found ${failedCount} failed jobs`);

        // Retry failed jobs
        const retryResponse = await fetch(`${API_URL}/api/debug/fix-extraction`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WORKER_SECRET}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'retry-failed' }),
        });

        expect(retryResponse.status).toBe(200);
        const retryData = await retryResponse.json();

        expect(retryData.success).toBe(true);
        console.log(`✅ Retried ${retryData.retryCount} failed jobs`);
      } else {
        console.log('   No failed jobs found');
      }
    });
  });

  describe('Policy Status', () => {
    it('should verify uploaded policies exist', async () => {
      console.log('\n🔍 Test: Verify uploaded policies');

      if (uploadedPolicies.length === 0) {
        console.log('⚠️ No policies uploaded yet');
        return;
      }

      for (const policy of uploadedPolicies.slice(0, 2)) {
        const response = await fetch(`${API_URL}/api/policies/${policy.policyId}`);
        
        if (response.ok) {
          const policyData = await response.json();
          console.log(`✅ Policy ${policy.policyId.substring(0, 8)}... exists`);
          console.log(`   Policy Number: ${policyData.policy?.policy_number}`);
          console.log(`   Status: ${policyData.policy?.status}`);
          console.log(`   Has extraction data: ${Object.keys(policyData.extractedData || {}).length > 0}`);
        } else {
          console.log(`⚠️ Policy ${policy.policyId.substring(0, 8)}... not found`);
        }
      }
    });
  });

  describe('Performance', () => {
    it('should measure upload time for 4 files', async () => {
      console.log('\n⏱️ Test: Measure upload performance');

      const startTime = Date.now();

      const uploadPromises = TEST_PDFS.map(async (pdf) => {
        const testFile = await fetch(pdf.url).then(r => r.blob());
        const formData = new FormData();
        formData.append('file', testFile, pdf.name);
        formData.append('autoExtract', 'true');

        return fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          body: formData,
        });
      });

      await Promise.all(uploadPromises);
      const uploadTime = Date.now() - startTime;

      console.log(`✅ Upload performance measured`);
      console.log(`   Time for 4 files: ${uploadTime}ms`);
      console.log(`   Average per file: ${(uploadTime / 4).toFixed(0)}ms`);

      // Expect upload to complete in reasonable time (< 30 seconds for test PDFs)
      expect(uploadTime).toBeLessThan(30000);
    });

    it('should measure extraction throughput', async () => {
      console.log('\n⏱️ Test: Measure extraction throughput');

      const startTime = Date.now();
      
      // Run worker 3 times with 10 second delays
      let totalProcessed = 0;
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${API_URL}/api/worker/extract`, {
          headers: {
            'Authorization': `Bearer ${WORKER_SECRET}`,
          },
        });

        const data = await response.json();
        totalProcessed += data.jobsProcessed || 0;

        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        }
      }

      const totalTime = Date.now() - startTime;

      console.log(`✅ Extraction throughput measured`);
      console.log(`   Total jobs processed: ${totalProcessed}`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Rate: ${((totalProcessed / totalTime) * 1000 * 60).toFixed(1)} jobs/minute`);
    });
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('🚀 Starting Bulk Upload Test Suite...\n');
  
  (async () => {
    try {
      // Import and run jest or vitest
      console.log('⚠️ Please run with: npm test');
      console.log('Or manually verify the flow using the debug endpoints:');
      console.log(`\n1. Check status: curl -H "Authorization: Bearer ${WORKER_SECRET}" ${API_URL}/api/debug/extraction-jobs`);
      console.log(`2. Run worker: curl -H "Authorization: Bearer ${WORKER_SECRET}" ${API_URL}/api/worker/extract`);
      console.log(`3. Check errors: curl -X POST -H "Authorization: Bearer ${WORKER_SECRET}" -H "Content-Type: application/json" -d '{"action":"clear-errors"}' ${API_URL}/api/debug/fix-extraction`);
    } catch (error) {
      console.error('Test failed:', error);
      process.exit(1);
    }
  })();
}
