jest.mock('../../../src/utils/metrics', () => ({
  recordIndexingDLQ: jest.fn()
}));

import { ElasticsearchSyncWorker } from '../../../src/workers/elasticsearch-sync';
import { recordIndexingDLQ } from '../../../src/utils/metrics';

describe('ElasticsearchSyncWorker - DLQ metrics', () => {
  it('increments DLQ metric when adding to DLQ', async () => {
    const redis = {
      lpush: jest.fn().mockResolvedValue(1),
      ltrim: jest.fn().mockResolvedValue(1)
    } as any;
    const es = {} as any;
    const worker: any = new ElasticsearchSyncWorker(redis, es);

    const change: any = {
      fullDocument: { tenantId: 't1' },
      _id: { ts: 1 }
    };
    const err = new Error('test');
    await worker.addToDeadLetterQueue(change, err);

    expect(redis.lpush).toHaveBeenCalled();
    expect(recordIndexingDLQ).toHaveBeenCalledWith('t1');
  });
});

