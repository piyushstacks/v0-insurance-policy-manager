import { generateExpiryReminders } from './services/reminders';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const res = await generateExpiryReminders(365);
  console.log('Result:', res);
}
main();
