#!/usr/bin/env node

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';
const EXTRACTION_WORKER_SECRET = 'test-secret';

async function testWorker() {
  console.log('🔧 Testing extraction worker with detailed logging...\n');

  try {
    // 1. Check job status first
    console.log('1️⃣ Checking extraction job status...');
    const statusRes = await fetch(`${API_BASE}/api/debug/extraction-jobs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${EXTRACTION_WORKER_SECRET}`,
      },
    });

    if (!statusRes.ok) {
      throw new Error(`Status check failed: ${statusRes.status}`);
    }

    const statusData = await statusRes.json();
    console.log('Status Summary:', statusData.summary);
    console.log('Redis Queue Length:', statusData.redisQueueLength);
    
    if (statusData.summary.queued === 0 && statusData.redisQueueLength === 0) {
      console.log('❌ No jobs in queue to process');
      return;
    }

    // 2. Call the worker endpoint
    console.log('\n2️⃣ Calling worker endpoint...');
    const workerRes = await fetch(`${API_BASE}/api/worker/extract`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${EXTRACTION_WORKER_SECRET}`,
      },
    });

    console.log('Worker Response Status:', workerRes.status);
    
    const workerData = await workerRes.json();
    console.log('Worker Response:', JSON.stringify(workerData, null, 2));

    if (!workerRes.ok) {
      console.error('❌ Worker failed with status:', workerRes.status);
      console.error('Response:', workerData);
      return;
    }

    if (workerData.success) {
      console.log('✅ Worker processed job successfully');
      console.log('Job ID:', workerData.jobId);
    } else {
      console.error('❌ Worker processing failed:');
      console.error('Error:', workerData.error);
      console.error('Job ID:', workerData.jobId);
    }

    // 3. Check status again
    console.log('\n3️⃣ Checking extraction job status again...');
    const finalStatusRes = await fetch(`${API_BASE}/api/debug/extraction-jobs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${EXTRACTION_WORKER_SECRET}`,
      },
    });

    if (finalStatusRes.ok) {
      const finalStatusData = await finalStatusRes.json();
      console.log('Final Status Summary:', finalStatusData.summary);
      console.log('Redis Queue Length:', finalStatusData.redisQueueLength);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testWorker();
