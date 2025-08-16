import { DatabaseManager } from '@/models';
import { logger } from '@/utils/logger';

async function main() {
  try {
    const db = DatabaseManager.getInstance();
    await db.connect();

    // Run migrations sequentially
    const migrations = [
      () => import('./001-backfill-content-version').then(m => m.up())
    ];

    for (const run of migrations) {
      await run();
    }

    await db.disconnect();
    logger.info('Migrations completed successfully');
    process.exit(0);
  } catch (e) {
    logger.error('Migration runner failed', e as Error);
    process.exit(1);
  }
}

main();

