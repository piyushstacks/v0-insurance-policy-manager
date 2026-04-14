#!/usr/bin/env node

/**
 * Manual Test Script for Bulk Upload & Extraction
 * Run: node test-bulk-upload.mjs
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WORKER_SECRET = process.env.EXTRACTION_WORKER_SECRET || 'test-secret';

const tests = {
  passed: 0,
  failed: 0,
  skipped: 0,
};

// Utility functions
async function test(name, fn) {
  try {
    process.stdout.write(`\n  ✓ ${name}... `);
    await fn();
    console.log('PASS');
    tests.passed++;
  } catch (error) {
    console.log('FAIL');
    console.log(`    Error: ${error.message}`);
    tests.failed++;
  }
}

async function step(message) {
  console.log(`\n${message}`);
}

async function checkStatus() {
  const response = await fetch(`${API_URL}/api/debug/extraction-jobs`, {
    headers: {
      'Authorization': `Bearer ${WORKER_SECRET}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Status check failed: ${response.statusText}`);
  }

  return response.json();
}

async function runWorker() {
  const response = await fetch(`${API_URL}/api/worker/extract`, {
    headers: {
      'Authorization': `Bearer ${WORKER_SECRET}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Worker failed: ${response.statusText}`);
  }

  return response.json();
}

// Main test suite
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('   BULK UPLOAD & EXTRACTION TEST SUITE');
  console.log('='.repeat(60));

  // Test 1: Check API connectivity
  await step('\n📡 1. API Connectivity Check');
  await test('API is accessible', async () => {
    const response = await fetch(`${API_URL}/api/policies`);
    if (response.status !== 200 && response.status !== 401) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });

  // Test 2: Check extraction job status
  await step('\n📊 2. Extraction Job Status');
  let jobStatus;
  await test('Can retrieve extraction job status', async () => {
    jobStatus = await checkStatus();
    if (!jobStatus.summary) {
      throw new Error('No summary in response');
    }
  });

  if (jobStatus) {
    console.log(`\n   📈 Status Summary:`);
    console.log(`      Total jobs: ${jobStatus.summary.totalJobs}`);
    console.log(`      Queued: ${jobStatus.summary.queuedCount}`);
    console.log(`      Processing: ${jobStatus.summary.processingCount}`);
    console.log(`      Completed: ${jobStatus.summary.completedCount}`);
    console.log(`      Failed: ${jobStatus.summary.failedCount}`);
    console.log(`      Redis queue: ${jobStatus.summary.redisQueueLength}`);

    if (jobStatus.summary.issue) {
      console.log(`\n      ⚠️  ISSUE DETECTED: ${jobStatus.summary.issue}`);
    }
  }

  // Test 3: Run extraction worker
  await step('\n⚙️  3. Extraction Worker');
  let workerResult;
  await test('Worker can process jobs', async () => {
    workerResult = await runWorker();
    if (workerResult.jobsProcessed === undefined) {
      throw new Error('No jobsProcessed in response');
    }
  });

  if (workerResult) {
    console.log(`\n   ⚙️  Worker Results:`);
    console.log(`      Jobs processed: ${workerResult.jobsProcessed}`);
    console.log(`      Jobs succeeded: ${workerResult.jobsSucceeded || 0}`);
    console.log(`      Jobs failed: ${workerResult.jobsFailed || 0}`);
    console.log(`      Remaining queue: ${workerResult.queueLength || 0}`);
  }

  // Test 4: Check for stuck jobs
  await step('\n🔍 4. Stuck Jobs Detection');
  let hasStuckJobs = false;
  await test('Check for jobs stuck in processing', async () => {
    const status = await checkStatus();
    hasStuckJobs = status.summary.processingCount > 0;
    if (hasStuckJobs) {
      console.log(`\n    ⚠️  Found ${status.summary.processingCount} jobs stuck in processing`);
    }
  });

  if (hasStuckJobs) {
    await step('\n🔧 5. Fix Stuck Jobs');
    await test('Reset stuck jobs', async () => {
      const response = await fetch(`${API_URL}/api/debug/fix-extraction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WORKER_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reset-processing' }),
      });

      if (!response.ok) {
        throw new Error(`Fix failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`\n    ✅ Reset ${result.resetCount} jobs`);
    });
  }

  // Test 5: Check for failed jobs
  await step('\n🔍 6. Failed Jobs Check');
  let failedCount = 0;
  await test('Check for failed extraction jobs', async () => {
    const status = await checkStatus();
    failedCount = status.summary.failedCount;
  });

  if (failedCount > 0) {
    console.log(`\n   ⚠️  Found ${failedCount} failed jobs\n`);

    await test('View failed job details', async () => {
      const response = await fetch(`${API_URL}/api/debug/fix-extraction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WORKER_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'clear-errors' }),
      });

      if (!response.ok) {
        throw new Error(`Could not retrieve errors: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.failedJobs && result.failedJobs.length > 0) {
        console.log(`\n   Failed Job Details:`);
        result.failedJobs.slice(0, 3).forEach((job, idx) => {
          console.log(`\n      Job ${idx + 1}:`);
          console.log(`        ID: ${job.id}`);
          console.log(`        Status: ${job.status}`);
          console.log(`        Error: ${job.error_message || 'Unknown'}`);
        });
      }
    });

    await test('Retry failed jobs', async () => {
      const response = await fetch(`${API_URL}/api/debug/fix-extraction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WORKER_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'retry-failed' }),
      });

      if (!response.ok) {
        throw new Error(`Retry failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`\n    ✅ Retried ${result.retryCount} failed jobs`);
    });
  }

  // Summary
  await step('\n' + '='.repeat(60));
  console.log('   TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`\n  ✓ Passed:  ${tests.passed}`);
  console.log(`  ✗ Failed:  ${tests.failed}`);
  console.log(`  ○ Skipped: ${tests.skipped}`);
  console.log(`\n  Total: ${tests.passed + tests.failed + tests.skipped}\n`);

  // Recommendations
  console.log('📋 RECOMMENDATIONS:\n');

  if (jobStatus?.summary.queuedCount > 5) {
    console.log('  1. ⚠️  Large backlog detected');
    console.log('     → Increase MAX_PARALLEL_EXTRACTIONS');
    console.log('     → Verify cron job is running\n');
  }

  if (jobStatus?.summary.processingCount > 0) {
    console.log('  1. ⚠️  Jobs stuck in processing');
    console.log('     → Worker may have crashed');
    console.log('     → Consider resetting stuck jobs\n');
  }

  if (failedCount > 0) {
    console.log('  1. ⚠️  Failed extractions detected');
    console.log('     → Check API keys (OpenRouter, Gemini)');
    console.log('     → Verify rate limits not exceeded');
    console.log('     → Review error messages above\n');
  }

  if (jobStatus?.summary.redisQueueLength === 0 && jobStatus?.summary.queuedCount > 0) {
    console.log('  1. ⚠️  DB has jobs but Redis queue is empty');
    console.log('     → Redis connection may be broken');
    console.log('     → Check UPSTASH_REDIS credentials\n');
  }

  if (tests.failed === 0) {
    console.log('  ✅ System appears to be functioning normally!\n');
  }

  process.exit(tests.failed > 0 ? 1 : 0);
}

// Run tests
main().catch((error) => {
  console.error('\n❌ Test suite error:', error);
  process.exit(1);
});
