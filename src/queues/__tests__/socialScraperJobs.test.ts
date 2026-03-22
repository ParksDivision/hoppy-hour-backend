import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions so they're available in vi.mock factories
const {
  mockQueueAdd,
  mockQueueAddBulk,
  mockQueueGetWaitingCount,
  mockQueueGetActiveCount,
  mockQueueGetCompletedCount,
  mockQueueGetFailedCount,
  mockFlowProducerAdd,
} = vi.hoisted(() => ({
  mockQueueAdd: vi.fn(),
  mockQueueAddBulk: vi.fn(),
  mockQueueGetWaitingCount: vi.fn(),
  mockQueueGetActiveCount: vi.fn(),
  mockQueueGetCompletedCount: vi.fn(),
  mockQueueGetFailedCount: vi.fn(),
  mockFlowProducerAdd: vi.fn(),
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
    add = mockFlowProducerAdd;
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
  addScrapeBusinessJob,
  addBulkScrapeJobs,
  addCitySearchWithSocialScrapingFlow,
  getSocialScraperQueueStats,
} from '../jobs/socialScraperJobs';

describe('addScrapeBusinessJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a job with correct name and data', async () => {
    mockQueueAdd.mockResolvedValue({ id: 'job-1' });

    const data = {
      googleRawBusinessId: 'biz-1',
      businessName: 'Test Bar',
      websiteUrl: 'https://testbar.com',
      requestedBy: 'test',
    };

    const job = await addScrapeBusinessJob(data);

    expect(mockQueueAdd).toHaveBeenCalledWith('scrapeBusinessLinks', data, { priority: 1 });
    expect(job.id).toBe('job-1');
  });
});

describe('addBulkScrapeJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds bulk jobs with staggered delays', async () => {
    mockQueueAddBulk.mockResolvedValue([{ id: 'job-1' }, { id: 'job-2' }, { id: 'job-3' }]);

    const businesses = [
      {
        googleRawBusinessId: 'biz-1',
        businessName: 'Bar 1',
        websiteUrl: 'https://bar1.com',
        requestedBy: undefined,
      },
      {
        googleRawBusinessId: 'biz-2',
        businessName: 'Bar 2',
        websiteUrl: 'https://bar2.com',
        requestedBy: undefined,
      },
      {
        googleRawBusinessId: 'biz-3',
        businessName: 'Bar 3',
        websiteUrl: 'https://bar3.com',
        requestedBy: undefined,
      },
    ];

    const jobs = await addBulkScrapeJobs(businesses);

    expect(mockQueueAddBulk).toHaveBeenCalledTimes(1);
    const bulkArg = mockQueueAddBulk.mock.calls[0]?.[0];
    expect(bulkArg).toHaveLength(3);

    // Verify staggered delays (500ms apart)
    expect(bulkArg[0].opts.delay).toBe(0);
    expect(bulkArg[1].opts.delay).toBe(500);
    expect(bulkArg[2].opts.delay).toBe(1000);

    // Verify all have correct job name
    for (const item of bulkArg) {
      expect(item.name).toBe('scrapeBusinessLinks');
    }

    expect(jobs).toHaveLength(3);
  });
});

describe('addCitySearchWithSocialScrapingFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a FlowProducer flow with correct parent and children', async () => {
    mockFlowProducerAdd.mockResolvedValue({
      job: { id: 'parent-1' },
      children: [{ job: { id: 'child-1' } }, { job: { id: 'child-2' } }],
    });

    const locations = [
      { latitude: 30.27, longitude: -97.74, options: { radius: 1000 } },
      { latitude: 30.25, longitude: -97.75, options: { radius: 1500 } },
    ];

    const flow = await addCitySearchWithSocialScrapingFlow(locations, 'austin', 'test-user');

    expect(mockFlowProducerAdd).toHaveBeenCalledTimes(1);

    const flowArg = mockFlowProducerAdd.mock.calls[0]?.[0];

    // Parent job
    expect(flowArg.name).toBe('triggerSocialScraping');
    expect(flowArg.queueName).toBe('social-scraper');
    expect(flowArg.data).toEqual({
      city: 'austin',
      requestedBy: 'test-user',
    });

    // Children
    expect(flowArg.children).toHaveLength(2);
    expect(flowArg.children[0].name).toBe('searchNearby');
    expect(flowArg.children[0].queueName).toBe('google-places');
    expect(flowArg.children[0].data.latitude).toBe(30.27);
    expect(flowArg.children[0].opts.removeDependencyOnFailure).toBe(true);
    expect(flowArg.children[0].opts.delay).toBe(0);
    expect(flowArg.children[1].opts.delay).toBe(1000);

    expect(flow.job.id).toBe('parent-1');
  });

  it('uses default requestedBy when not provided', async () => {
    mockFlowProducerAdd.mockResolvedValue({
      job: { id: 'parent-1' },
      children: [],
    });

    await addCitySearchWithSocialScrapingFlow([], 'austin');

    const flowArg = mockFlowProducerAdd.mock.calls[0]?.[0];
    expect(flowArg.data.requestedBy).toBe('system');
  });
});

describe('getSocialScraperQueueStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all queue counts', async () => {
    mockQueueGetWaitingCount.mockResolvedValue(5);
    mockQueueGetActiveCount.mockResolvedValue(2);
    mockQueueGetCompletedCount.mockResolvedValue(100);
    mockQueueGetFailedCount.mockResolvedValue(3);

    const stats = await getSocialScraperQueueStats();

    expect(stats).toEqual({
      waiting: 5,
      active: 2,
      completed: 100,
      failed: 3,
    });
  });
});
