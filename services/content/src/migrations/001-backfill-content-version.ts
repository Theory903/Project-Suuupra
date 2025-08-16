import mongoose from 'mongoose';
import { Content } from '@/models/Content';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export async function up(): Promise<void> {
  logger.info('Migration 001: Backfilling content.version, etag, and status where missing');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const cursor = Content.find({}).cursor();
    let updated = 0;
    for await (const doc of cursor) {
      let changed = false;
      if (!doc.version) { doc.version = '1.0.0'; changed = true; }
      if (!doc.etag) { doc.etag = uuidv4(); changed = true; }
      if (!doc.status) { (doc as any).status = 'draft'; changed = true; }
      if (changed) { await doc.save({ session }); updated++; }
    }
    await session.commitTransaction();
    logger.info('Migration 001 complete', { updated });
  } catch (e) {
    await session.abortTransaction();
    logger.error('Migration 001 failed', e as Error);
    throw e;
  } finally {
    session.endSession();
  }
}

export async function down(): Promise<void> {
  // noop: irreversible
}

