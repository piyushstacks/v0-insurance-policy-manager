import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Mock Jest globals
(global as any).describe = (name: string, fn: () => void) => {
  console.log(`\nSuite: ${name}`);
  fn();
};
(global as any).test = async (name: string, fn: () => Promise<void> | void) => {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${e.message}`);
  }
};
(global as any).expect = (received: any) => ({
  toBe: (expected: any) => {
    if (received !== expected) throw new Error(`Expected ${expected}, received ${received}`);
  },
  toBeGreaterThan: (expected: any) => {
    if (received <= expected) throw new Error(`Expected > ${expected}, received ${received}`);
  },
  toBeLessThan: (expected: any) => {
    if (received >= expected) throw new Error(`Expected < ${expected}, received ${received}`);
  },
  toContain: (expected: any) => {
    if (!received?.includes?.(expected)) throw new Error(`Expected to contain ${expected}, received ${received}`);
  },
  toBeDefined: () => {
    if (received === undefined) throw new Error(`Expected to be defined`);
  },
  toBeLessThanOrEqual: (expected: any) => {
    if (received > expected) throw new Error(`Expected <= ${expected}, received ${received}`);
  },
});

console.log('🚀 Starting Extraction Service Tests (Custom Runner)');

// Set up Supabase environment
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Run the tests
async function run() {
  try {
    // @ts-ignore
    await import('../__tests__/extraction-service.test.ts');
  } catch (error) {
    console.error('Failed to load test file:', error);
  }
}

run();
