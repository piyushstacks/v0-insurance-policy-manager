#!/usr/bin/env node

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';

async function testUploadAndExtract() {
  console.log('📋 Testing extraction system health...\n');

  try {
    // Check current status
    console.log('1️⃣ Checking current extraction job status...');
    const statusRes = await fetch(`${API_BASE}/api/debug/extraction-jobs`, {
      method: 'GET',
      headers: { 'authorization': 'Bearer test-secret' },
    });

    if (!statusRes.ok) {
      throw new Error(`Status check failed: ${statusRes.status}`);
    }

    const statusData = await statusRes.json();
    console.log('Current Status:', statusData.summary);
    console.log('Total Jobs:', statusData.summary.totalJobs);
    console.log('Completed:', statusData.summary.completedCount);
    console.log('Queued:', statusData.summary.queuedCount);
    console.log('Redis Queue Length:', statusData.redisQueueLength);

    // List recent jobs
    console.log('\n2️⃣ Recent completed extraction jobs:');
    const recentJobs = statusData.jobs?.completed || [];
    for (const job of recentJobs) {
      console.log(`  - Job ${job.id.substring(0, 8)}... (${job.created_at})`);
    }

    // Inspect Redis directly
    console.log('\n3️⃣ Redis queue inspection:');
    const redisRes = await fetch(`${API_BASE}/api/debug/redis-inspect`, {
      method: 'GET',
      headers: { 'authorization': 'Bearer test-secret' },
    });

    if (redisRes.ok) {
      const redisData = await redisRes.json();
      console.log('Redis Queue Length:', redisData.queueLength);
      console.log('Job IDs in queue:', redisData.jobIds.length > 0 ? redisData.jobIds : 'empty');
      
      if (redisData.jobDetails.length > 0) {
        console.log('\nJob Details:');
        for (const job of redisData.jobDetails) {
          console.log(`  - ID: ${job.jobId}`);
          console.log(`    Has Data: ${job.hasData}`);
          if (job.data) {
            console.log(`    Type: ${job.data.type}`);
            console.log(`    DocumentID: ${job.data.payload?.documentId}`);
          }
        }
      }
    }

    // Try running the worker
    console.log('\n4️⃣ Running worker...');
    const workerRes = await fetch(`${API_BASE}/api/worker/extract`, {
      method: 'GET',
      headers: { 'authorization': 'Bearer test-secret' },
    });

    if (workerRes.ok) {
      const workerData = await workerRes.json();
      console.log('Worker Result:', {
        success: workerData.success,
        jobsProcessed: workerData.jobsProcessed,
        jobsSucceeded: workerData.jobsSucceeded,
        jobsFailed: workerData.jobsFailed,
      });
    }

    // Final check
    console.log('\n5️⃣ Final status check...');
    const finalRes = await fetch(`${API_BASE}/api/debug/extraction-jobs`, {
      method: 'GET',
      headers: { 'authorization': 'Bearer test-secret' },
    });

    if (finalRes.ok) {
      const finalData = await finalRes.json();
      console.log('Final Summary:', finalData.summary);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testUploadAndExtract();
