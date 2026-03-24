import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions and shared state
const {
  workerInstances,
  mockAnalyzeWebsite,
  mockAnalyzeInstagram,
  mockAnalyzeFacebook,
  mockAnalyzeTwitter,
  mockUpsertDealData,
  mockFindWithoutAnalysis,
  mockAddBulkAnalyzeJobs,
} = vi.hoisted(() => ({
  workerInstances: [] as Array<{ queueName: string; processor: unknown }>,
  mockAnalyzeWebsite: vi.fn(),
  mockAnalyzeInstagram: vi.fn(),
  mockAnalyzeFacebook: vi.fn(),
  mockAnalyzeTwitter: vi.fn(),
  mockUpsertDealData: vi.fn(),
  mockFindWithoutAnalysis: vi.fn(),
  mockAddBulkAnalyzeJobs: vi.fn(),
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

// Mock the analyzer service
vi.mock('../../services/dealAnalyzer/service', () => ({
  analyzeWebsiteForDeals: (...args: unknown[]) => mockAnalyzeWebsite(...args),
  analyzeInstagramForDeals: (...args: unknown[]) => mockAnalyzeInstagram(...args),
  analyzeFacebookForDeals: (...args: unknown[]) => mockAnalyzeFacebook(...args),
  analyzeTwitterForDeals: (...args: unknown[]) => mockAnalyzeTwitter(...args),
}));

// Mock the repository
vi.mock('../../repositories/websiteDealDataRepository', () => ({
  upsertWebsiteDealData: (...args: unknown[]) => mockUpsertDealData(...args),
  findBusinessesWithoutDealAnalysis: (...args: unknown[]) => mockFindWithoutAnalysis(...args),
}));

// Mock the queue jobs
vi.mock('../jobs/dealAnalyzerJobs', () => {
  class MockQueue {
    add = vi.fn();
    addBulk = vi.fn();
    getWaitingCount = vi.fn();
    getActiveCount = vi.fn();
    getCompletedCount = vi.fn();
    getFailedCount = vi.fn();
  }
  return {
    dealAnalyzerQueue: new MockQueue(),
    addAnalyzeBusinessJob: vi.fn(),
    addBulkAnalyzeJobs: (...args: unknown[]) => mockAddBulkAnalyzeJobs(...args),
    getDealAnalyzerQueueStats: vi.fn(),
  };
});

// Import the worker module to trigger its side effects (Worker instantiation)
import '../workers/dealAnalyzerWorker';

// Get the processor function passed to the Worker constructor
function getWorkerProcessor() {
  const instance = workerInstances.find((w) => w.queueName === 'deal-analyzer');
  if (!instance) {
    throw new Error('Deal analyzer worker not found in Worker mock instances');
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

describe('dealAnalyzerWorker - triggerDealAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries DB and dispatches analyze jobs', async () => {
    const processor = getWorkerProcessor();

    mockFindWithoutAnalysis.mockResolvedValue([
      {
        id: 'link-1',
        websiteUrl: 'https://bar1.com',
        googleRawBusiness: { id: 'biz-1', name: 'Bar 1', uri: 'https://bar1.com' },
      },
      {
        id: 'link-2',
        websiteUrl: 'https://bar2.com',
        googleRawBusiness: { id: 'biz-2', name: 'Bar 2', uri: 'https://bar2.com' },
      },
    ]);
    mockAddBulkAnalyzeJobs.mockResolvedValue([{ id: 'j1' }, { id: 'j2' }]);

    const job = createMockJob('triggerDealAnalysis', {
      sourceType: 'website',
      requestedBy: 'test',
    });

    const result = await processor(job);

    expect(mockFindWithoutAnalysis).toHaveBeenCalledTimes(1);
    expect(mockAddBulkAnalyzeJobs).toHaveBeenCalledWith([
      {
        googleRawBusinessId: 'biz-1',
        businessName: 'Bar 1',
        sourceUrl: 'https://bar1.com',
        sourceType: 'website',
        requestedBy: 'test',
      },
      {
        googleRawBusinessId: 'biz-2',
        businessName: 'Bar 2',
        sourceUrl: 'https://bar2.com',
        sourceType: 'website',
        requestedBy: 'test',
      },
    ]);
    expect(result).toMatchObject({ success: true, count: 2, sourceType: 'website' });
  });

  it('returns count 0 when no businesses found', async () => {
    const processor = getWorkerProcessor();

    mockFindWithoutAnalysis.mockResolvedValue([]);

    const job = createMockJob('triggerDealAnalysis', {
      sourceType: 'website',
      requestedBy: 'test',
    });

    const result = await processor(job);

    expect(mockAddBulkAnalyzeJobs).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, count: 0 });
  });
});

describe('dealAnalyzerWorker - analyzeBusinessDeals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('analyzes website and persists result', async () => {
    const processor = getWorkerProcessor();

    mockAnalyzeWebsite.mockResolvedValue({
      sourceUrl: 'https://testbar.com',
      sourceType: 'website',
      status: 'success',
      deals: [{ dealType: 'happy_hour', title: 'HH' }],
      rawAiResponse: { content: 'test' },
      aiModel: 'claude-sonnet-4-6',
      promptVersion: 'v1',
      durationMs: 2000,
    });
    mockUpsertDealData.mockResolvedValue({});

    const job = createMockJob('analyzeBusinessDeals', {
      googleRawBusinessId: 'biz-1',
      businessName: 'Test Bar',
      sourceUrl: 'https://testbar.com',
      sourceType: 'website',
      requestedBy: 'test',
    });

    const result = await processor(job);

    expect(mockAnalyzeWebsite).toHaveBeenCalledWith('https://testbar.com');
    expect(mockUpsertDealData).toHaveBeenCalledTimes(1);

    const upsertArgs = mockUpsertDealData.mock.calls[0];
    expect(upsertArgs?.[0]).toMatchObject({
      googleRawBusinessId: 'biz-1',
      sourceType: 'website',
      sourceUrl: 'https://testbar.com',
      aiModel: 'claude-sonnet-4-6',
      analysisStatus: 'success',
    });
    expect(upsertArgs?.[1]).toBe('test');

    expect(result).toMatchObject({
      success: true,
      dealCount: 1,
      status: 'success',
    });
  });

  it('persists no_deals result', async () => {
    const processor = getWorkerProcessor();

    mockAnalyzeWebsite.mockResolvedValue({
      sourceUrl: 'https://nospecials.com',
      sourceType: 'website',
      status: 'no_deals',
      deals: [],
      rawAiResponse: { content: '[]' },
      aiModel: 'claude-sonnet-4-6',
      promptVersion: 'v1',
      durationMs: 1500,
    });
    mockUpsertDealData.mockResolvedValue({});

    const job = createMockJob('analyzeBusinessDeals', {
      googleRawBusinessId: 'biz-2',
      businessName: 'No Specials Bar',
      sourceUrl: 'https://nospecials.com',
      sourceType: 'website',
      requestedBy: 'test',
    });

    const result = await processor(job);

    const upsertArgs = mockUpsertDealData.mock.calls[0];
    expect(upsertArgs?.[0]).toMatchObject({
      analysisStatus: 'no_deals',
    });

    expect(result).toMatchObject({ success: true, dealCount: 0 });
  });
});

describe('dealAnalyzerWorker - analyzeBusinessDeals (social media routing)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes instagram sourceType to analyzeInstagramForDeals', async () => {
    const processor = getWorkerProcessor();

    mockAnalyzeInstagram.mockResolvedValue({
      sourceUrl: 'https://instagram.com/testbar',
      sourceType: 'instagram',
      status: 'success',
      deals: [{ dealType: 'happy_hour', title: 'IG Happy Hour' }],
      rawAiResponse: { content: 'test' },
      aiModel: 'claude-sonnet-4-6',
      promptVersion: 'v1',
      durationMs: 3000,
    });
    mockUpsertDealData.mockResolvedValue({});

    const job = createMockJob('analyzeBusinessDeals', {
      googleRawBusinessId: 'biz-3',
      businessName: 'IG Bar',
      sourceUrl: 'https://instagram.com/testbar',
      sourceType: 'instagram',
      requestedBy: 'test',
    });

    const result = await processor(job);

    expect(mockAnalyzeInstagram).toHaveBeenCalledWith(
      'https://instagram.com/testbar',
      { googleRawBusinessId: 'biz-3', requestedBy: 'test' }
    );
    expect(mockAnalyzeWebsite).not.toHaveBeenCalled();
    expect(mockUpsertDealData).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: true, dealCount: 1, status: 'success' });
  });

  it('routes facebook sourceType to analyzeFacebookForDeals', async () => {
    const processor = getWorkerProcessor();

    mockAnalyzeFacebook.mockResolvedValue({
      sourceUrl: 'https://facebook.com/testbar',
      sourceType: 'facebook',
      status: 'no_deals',
      deals: [],
      rawAiResponse: { content: '[]' },
      aiModel: 'claude-sonnet-4-6',
      promptVersion: 'v1',
      durationMs: 2500,
    });
    mockUpsertDealData.mockResolvedValue({});

    const job = createMockJob('analyzeBusinessDeals', {
      googleRawBusinessId: 'biz-4',
      businessName: 'FB Bar',
      sourceUrl: 'https://facebook.com/testbar',
      sourceType: 'facebook',
      requestedBy: 'test',
    });

    const result = await processor(job);

    expect(mockAnalyzeFacebook).toHaveBeenCalledWith(
      'https://facebook.com/testbar',
      { googleRawBusinessId: 'biz-4', requestedBy: 'test' }
    );
    expect(mockAnalyzeWebsite).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, dealCount: 0, status: 'no_deals' });
  });

  it('routes twitter sourceType to analyzeTwitterForDeals', async () => {
    const processor = getWorkerProcessor();

    mockAnalyzeTwitter.mockResolvedValue({
      sourceUrl: 'https://x.com/testbar',
      sourceType: 'twitter',
      status: 'success',
      deals: [{ dealType: 'daily_special', title: 'Tweet Special' }],
      rawAiResponse: { content: 'test' },
      aiModel: 'claude-sonnet-4-6',
      promptVersion: 'v1',
      durationMs: 2000,
    });
    mockUpsertDealData.mockResolvedValue({});

    const job = createMockJob('analyzeBusinessDeals', {
      googleRawBusinessId: 'biz-5',
      businessName: 'X Bar',
      sourceUrl: 'https://x.com/testbar',
      sourceType: 'twitter',
      requestedBy: 'test',
    });

    const result = await processor(job);

    expect(mockAnalyzeTwitter).toHaveBeenCalledWith(
      'https://x.com/testbar',
      { googleRawBusinessId: 'biz-5', requestedBy: 'test' }
    );
    expect(mockAnalyzeWebsite).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, dealCount: 1, status: 'success' });
  });
});

describe('dealAnalyzerWorker - triggerDealAnalysis (social media)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses instagramUrl field for instagram sourceType', async () => {
    const processor = getWorkerProcessor();

    mockFindWithoutAnalysis.mockResolvedValue([
      {
        id: 'link-1',
        instagramUrl: 'https://instagram.com/bar1',
        googleRawBusiness: { id: 'biz-1', name: 'Bar 1' },
      },
    ]);
    mockAddBulkAnalyzeJobs.mockResolvedValue([{ id: 'j1' }]);

    const job = createMockJob('triggerDealAnalysis', {
      sourceType: 'instagram',
      requestedBy: 'test',
    });

    const result = await processor(job);

    expect(mockFindWithoutAnalysis).toHaveBeenCalledWith('instagram');
    expect(mockAddBulkAnalyzeJobs).toHaveBeenCalledWith([
      expect.objectContaining({
        sourceUrl: 'https://instagram.com/bar1',
        sourceType: 'instagram',
      }),
    ]);
    expect(result).toMatchObject({ success: true, count: 1, sourceType: 'instagram' });
  });
});

describe('dealAnalyzerWorker - unknown job type', () => {
  it('throws error for unknown job name', async () => {
    const processor = getWorkerProcessor();

    const job = createMockJob('unknownJobType', {});

    await expect(processor(job)).rejects.toThrow('Unknown job type: unknownJobType');
  });
});
