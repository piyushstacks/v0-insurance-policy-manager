/**
 * Triggers the Direct background re-extraction endpoint.
 */

import fs from 'fs';
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
  console.log('🔄 Triggering Direct background re-extraction...');
  console.log(`📡 Host: ${host}/api/debug/re-extract-direct`);
  console.log('--------------------------------------------------');

  const res = await fetch(`${host}/api/debug/re-extract-direct`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`❌ Trigger failed with HTTP ${res.status}:`, errText);
    process.exit(1);
  }

  const data = await res.json();
  console.log('✅ Response:', data.message);
  console.log('--------------------------------------------------');
  console.log('Use control+C to exit this watcher at any time.');
}

run().catch(err => {
  console.error('Trigger script failed:', err);
  process.exit(1);
});
