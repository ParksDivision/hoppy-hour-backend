import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions so they're available in vi.mock factories
const {
  mockQueueAdd,
  mockQueueAddBulk,
  mockQueueGetWaitingCount,
  mockQueueGetActiveCount,
  mockQueueGetCompletedCount,
  mockQueueGetFailedCount,
} = vi.hoisted(() => ({
  mockQueueAdd: vi.fn(),
  mockQueueAddBulk: vi.fn(),
  mockQueueGetWaitingCount: vi.fn(),
  mockQueueGetActiveCount: vi.fn(),
  mockQueueGetCompletedCount: vi.fn(),
  mockQueueGetFailedCount: vi.fn(),
}));

// Mock Redis connection
vi.mock('../../config/redis', () => ({
  createRedisConnection: vi.fn(() => ({
    on: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

// Mock BullMQ with class constructors
vi.mock('bullmq', () => {
  class MockQueue {
    add = mockQueueAdd;
    addBulk = mockQueueAddBulk;
    getWaitingCount = mockQueueGetWaitingCount;
    getActiveCount = mockQueueGetActiveCount;
    getCompletedCount = mockQueueGetCompletedCount;
    getFailedCount = mockQueueGetFailedCount;
  }
  class MockFlowProducer {
    add = vi.fn();
  }
  class MockWorker {
    on = vi.fn();
    close = vi.fn();
  }
  return { Queue: MockQueue, FlowProducer: MockFlowProducer, Worker: MockWorker };
});

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  addAnalyzeBusinessJob,
  addBulkAnalyzeJobs,
  getDealAnalyzerQueueStats,
} from '../jobs/dealAnalyzerJobs';

describe('addAnalyzeBusinessJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a job with correct name and data', async () => {
    mockQueueAdd.mockResolvedValue({ id: 'job-1' });

    const data = {
      googleRawBusinessId: 'biz-1',
      businessName: 'Test Bar',
      sourceUrl: 'https://testbar.com',
      sourceType: 'website' as const,
      requestedBy: 'test',
    };

    const job = await addAnalyzeBusinessJob(data);

    expect(mockQueueAdd).toHaveBeenCalledWith('analyzeBusinessDeals', data, { priority: 1 });
    expect(job.id).toBe('job-1');
  });
});

describe('addBulkAnalyzeJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds bulk jobs with staggered delays', async () => {
    mockQueueAddBulk.mockResolvedValue([{ id: 'job-1' }, { id: 'job-2' }, { id: 'job-3' }]);

    const businesses = [
      {
        googleRawBusinessId: 'biz-1',
        businessName: 'Bar 1',
        sourceUrl: 'https://bar1.com',
        sourceType: 'website' as const,
        requestedBy: undefined,
      },
      {
        googleRawBusinessId: 'biz-2',
        businessName: 'Bar 2',
        sourceUrl: 'https://bar2.com',
        sourceType: 'website' as const,
        requestedBy: undefined,
      },
      {
        googleRawBusinessId: 'biz-3',
        businessName: 'Bar 3',
        sourceUrl: 'https://bar3.com',
        sourceType: 'website' as const,
        requestedBy: undefined,
      },
    ];

    const jobs = await addBulkAnalyzeJobs(businesses);

    expect(mockQueueAddBulk).toHaveBeenCalledTimes(1);
    const bulkArg = mockQueueAddBulk.mock.calls[0]?.[0];
    expect(bulkArg).toHaveLength(3);

    // Verify staggered delays (1s apart)
    expect(bulkArg[0].opts.delay).toBe(0);
    expect(bulkArg[1].opts.delay).toBe(1000);
    expect(bulkArg[2].opts.delay).toBe(2000);

    // Verify all have correct job name
    for (const item of bulkArg) {
      expect(item.name).toBe('analyzeBusinessDeals');
    }

    expect(jobs).toHaveLength(3);
  });
});

describe('getDealAnalyzerQueueStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all queue counts', async () => {
    mockQueueGetWaitingCount.mockResolvedValue(10);
    mockQueueGetActiveCount.mockResolvedValue(2);
    mockQueueGetCompletedCount.mockResolvedValue(200);
    mockQueueGetFailedCount.mockResolvedValue(5);

    const stats = await getDealAnalyzerQueueStats();

    expect(stats).toEqual({
      waiting: 10,
      active: 2,
      completed: 200,
      failed: 5,
    });
  });
});
