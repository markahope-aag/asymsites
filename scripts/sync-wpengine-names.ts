import { config } from 'dotenv';
import { syncWPEngineSiteNames } from '../src/lib/utils/sync-wpengine-names';

// Load environment variables
config({ path: '.env.local' });

// Run with: npx tsx scripts/sync-wpengine-names.ts

async function main() {
  try {
    await syncWPEngineSiteNames();
    process.exit(0);
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
}

main();