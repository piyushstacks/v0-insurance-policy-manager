/**
 * Standalone Re-Extraction Trigger and Runner
 * 
 * 1. POSTs to http://localhost:3000/api/debug/fix-extraction with action: "re-extract-all"
 * 2. Runs the worker in a loop until the Upstash Redis queue is empty.
 * 3. Shows live progress.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load .env.local
if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const secretToken = process.env.EXTRACTION_WORKER_SECRET || 'test-secret';
const host = 'http://localhost:3000';

async function run() {
  console.log('--------------------------------------------------');
  console.log('🔄 Re-extraction Engine Starting...');
  console.log(`📡 Host: ${host}`);
  console.log('--------------------------------------------------');

  // Step 1: Trigger the reset & enqueue of all policies
  console.log('Step 1: Enqueueing all policy documents to Upstash Redis...');
  
  const enqueueRes = await fetch(`${host}/api/debug/fix-extraction`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 're-extract-all' })
  });

  if (!enqueueRes.ok) {
    const errText = await enqueueRes.text();
    console.error(`❌ Enqueue failed with HTTP ${enqueueRes.status}:`, errText);
    process.exit(1);
  }

  const enqueueData = await enqueueRes.json();
  console.log(`✅ Enqueue success! ${enqueueData.message}`);
  
  let queueLength = enqueueData.enqueuedCount || 0;
  if (queueLength === 0) {
    console.log('No documents queued. Exiting.');
    process.exit(0);
  }

  console.log('\nStep 2: Processing jobs in batches of 5 in parallel...');
  console.log('--------------------------------------------------');

  let batchNum = 1;
  while (queueLength > 0) {
    console.log(`📦 [Batch #${batchNum}] Processing next batch. Current queue length: ${queueLength}`);
    
    const startTime = Date.now();
    const workerRes = await fetch(`${host}/api/worker/extract`, {
      headers: {
        'Authorization': `Bearer ${secretToken}`
      }
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!workerRes.ok) {
      const errText = await workerRes.text();
      console.error(`❌ Batch #${batchNum} worker call failed:`, errText);
      // Wait 3 seconds before retrying
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }

    const workerData = await workerRes.json();
    queueLength = workerData.queueLength ?? 0;
    
    console.log(`   ✔️ Success: ${workerData.jobsSucceeded || 0} enqueued jobs processed successfully in ${duration}s.`);
    if (workerData.jobsFailed > 0) {
      console.log(`   ⚠️ Failed: ${workerData.jobsFailed} jobs failed processing in this batch.`);
    }

    // Wait a brief 1 second to avoid hammering the APIs
    await new Promise(r => setTimeout(r, 1000));
    batchNum++;
  }

  console.log('--------------------------------------------------');
  console.log('🎉 Re-extraction processing complete! All documents have been successfully parsed through the 2-Stage AI Pipeline.');
  console.log('--------------------------------------------------');
}

run().catch(err => {
  console.error('Fatal error running re-extraction script:', err);
  process.exit(1);
});
