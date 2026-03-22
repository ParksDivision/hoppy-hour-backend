import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions and shared state
const {
  workerInstances,
  mockScrapeWebsite,
  mockUpsertSocialLink,
  mockFindWithoutSocialLinks,
  mockAddBulkScrapeJobs,
} = vi.hoisted(() => ({
  workerInstances: [] as Array<{ queueName: string; processor: unknown }>,
  mockScrapeWebsite: vi.fn(),
  mockUpsertSocialLink: vi.fn(),
  mockFindWithoutSocialLinks: vi.fn(),
  mockAddBulkScrapeJobs: vi.fn(),
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
    add = vi.fn();
    addBulk = vi.fn();
    getWaitingCount = vi.fn();
    getActiveCount = vi.fn();
    getCompletedCount = vi.fn();
    getFailedCount = vi.fn();
  }
  class MockFlowProducer {
    add = vi.fn();
  }
  class MockWorker {
    on = vi.fn();
    close = vi.fn();
    constructor(queueName: string, processor: unknown) {
      workerInstances.push({ queueName, processor });
    }
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

// Mock the scraper service
vi.mock('../../services/socialScraper/service', () => ({
  scrapeWebsiteForSocialLinks: (...args: unknown[]) => mockScrapeWebsite(...args),
}));

// Mock the repository
vi.mock('../../repositories/businessSocialLinkRepository', () => ({
  upsertBusinessSocialLink: (...args: unknown[]) => mockUpsertSocialLink(...args),
  findBusinessesWithoutSocialLinks: (...args: unknown[]) => mockFindWithoutSocialLinks(...args),
}));

// Mock the queue jobs
vi.mock('../jobs/socialScraperJobs', () => {
  class MockQueue {
    add = vi.fn();
    addBulk = vi.fn();
    getWaitingCount = vi.fn();
    getActiveCount = vi.fn();
    getCompletedCount = vi.fn();
    getFailedCount = vi.fn();
  }
  class MockFlowProducer {
    add = vi.fn();
  }
  return {
    socialScraperQueue: new MockQueue(),
    socialScraperFlowProducer: new MockFlowProducer(),
    addBulkScrapeJobs: (...args: unknown[]) => mockAddBulkScrapeJobs(...args),
    addScrapeBusinessJob: vi.fn(),
    addCitySearchWithSocialScrapingFlow: vi.fn(),
    getSocialScraperQueueStats: vi.fn(),
  };
});

// Import the worker module to trigger its side effects (Worker instantiation)
import '../workers/socialScraperWorker';

// Get the processor function passed to the Worker constructor
function getWorkerProcessor() {
  const instance = workerInstances.find((w) => w.queueName === 'social-scraper');
  if (!instance) {
    throw new Error('Social scraper worker not found in Worker mock instances');
  }
  return instance.processor as (job: unknown) => Promise<unknown>;
}

function createMockJob(name: string, data: unknown) {
  return {
    id: 'test-job-1',
    name,
    data,
    updateProgress: vi.fn(),
  };
}

describe('socialScraperWorker - triggerSocialScraping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries DB and dispatches scrape jobs', async () => {
    const processor = getWorkerProcessor();

    mockFindWithoutSocialLinks.mockResolvedValue([
      { id: 'biz-1', name: 'Bar 1', uri: 'https://bar1.com' },
      { id: 'biz-2', name: 'Bar 2', uri: 'https://bar2.com' },
    ]);
    mockAddBulkScrapeJobs.mockResolvedValue([{ id: 'j1' }, { id: 'j2' }]);

    const job = createMockJob('triggerSocialScraping', {
      city: 'austin',
      requestedBy: 'test',
    });

    const result = await processor(job);

    expect(mockFindWithoutSocialLinks).toHaveBeenCalledTimes(1);
    expect(mockAddBulkScrapeJobs).toHaveBeenCalledWith([
      {
        googleRawBusinessId: 'biz-1',
        businessName: 'Bar 1',
        websiteUrl: 'https://bar1.com',
        requestedBy: 'test',
      },
      {
        googleRawBusinessId: 'biz-2',
        businessName: 'Bar 2',
        websiteUrl: 'https://bar2.com',
        requestedBy: 'test',
      },
    ]);
    expect(result).toMatchObject({ success: true, count: 2, city: 'austin' });
  });

  it('returns count 0 when no businesses found', async () => {
    const processor = getWorkerProcessor();

    mockFindWithoutSocialLinks.mockResolvedValue([]);

    const job = createMockJob('triggerSocialScraping', {
      city: 'austin',
      requestedBy: 'test',
    });

    const result = await processor(job);

    expect(mockAddBulkScrapeJobs).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, count: 0 });
  });
});

describe('socialScraperWorker - scrapeBusinessLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scrapes website and persists result', async () => {
    const processor = getWorkerProcessor();

    mockScrapeWebsite.mockResolvedValue({
      websiteUrl: 'https://testbar.com',
      method: 'cheerio',
      status: 'success',
      links: {
        facebook: 'https://facebook.com/testbar',
        instagram: 'https://instagram.com/testbar',
        twitter: null,
        allLinksFound: [],
      },
      errorMessage: undefined,
      durationMs: 500,
    });
    mockUpsertSocialLink.mockResolvedValue({});

    const job = createMockJob('scrapeBusinessLinks', {
      googleRawBusinessId: 'biz-1',
      businessName: 'Test Bar',
      websiteUrl: 'https://testbar.com',
      requestedBy: 'test',
    });

    const result = await processor(job);

    expect(mockScrapeWebsite).toHaveBeenCalledWith('https://testbar.com');
    expect(mockUpsertSocialLink).toHaveBeenCalledTimes(1);

    const upsertArgs = mockUpsertSocialLink.mock.calls[0];
    expect(upsertArgs?.[0]).toMatchObject({
      googleRawBusinessId: 'biz-1',
      websiteUrl: 'https://testbar.com',
      facebookUrl: 'https://facebook.com/testbar',
      instagramUrl: 'https://instagram.com/testbar',
      twitterUrl: null,
      scrapeMethod: 'cheerio',
      scrapeStatus: 'success',
    });
    expect(upsertArgs?.[1]).toBe('test');

    expect(result).toMatchObject({
      success: true,
      facebook: 'https://facebook.com/testbar',
      instagram: 'https://instagram.com/testbar',
      twitter: null,
    });
  });

  it('persists failed scrape result', async () => {
    const processor = getWorkerProcessor();

    mockScrapeWebsite.mockResolvedValue({
      websiteUrl: 'https://broken.com',
      method: 'cheerio',
      status: 'failed',
      links: { facebook: null, instagram: null, twitter: null, allLinksFound: [] },
      errorMessage: 'Connection refused',
      durationMs: 100,
    });
    mockUpsertSocialLink.mockResolvedValue({});

    const job = createMockJob('scrapeBusinessLinks', {
      googleRawBusinessId: 'biz-2',
      businessName: 'Broken Bar',
      websiteUrl: 'https://broken.com',
      requestedBy: 'test',
    });

    const result = await processor(job);

    const upsertArgs = mockUpsertSocialLink.mock.calls[0];
    expect(upsertArgs?.[0]).toMatchObject({
      scrapeStatus: 'failed',
      errorMessage: 'Connection refused',
    });

    expect(result).toMatchObject({ success: true, status: 'failed' });
  });
});

describe('socialScraperWorker - unknown job type', () => {
  it('throws error for unknown job name', async () => {
    const processor = getWorkerProcessor();

    const job = createMockJob('unknownJobType', {});

    await expect(processor(job)).rejects.toThrow('Unknown job type: unknownJobType');
  });
});
