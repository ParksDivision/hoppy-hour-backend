import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('../../utils/database', () => ({
  default: {
    websiteDealData: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    businessSocialLink: {
      findMany: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import prisma from '../../utils/database';
import {
  upsertWebsiteDealData,
  findBusinessesWithoutDealAnalysis,
  findDealsByBusinessId,
  getDealAnalysisStats,
} from '../websiteDealDataRepository';

describe('upsertWebsiteDealData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls prisma.upsert with correct create data', async () => {
    const mockResult = { id: 'deal-1', googleRawBusinessId: 'biz-1' };
    vi.mocked(prisma.websiteDealData.upsert).mockResolvedValue(mockResult as never);

    const data = {
      googleRawBusinessId: 'biz-1',
      sourceType: 'website' as const,
      sourceUrl: 'https://example.com',
      deals: [{ dealType: 'happy_hour', title: 'HH' }],
      rawAiResponse: { content: 'test' },
      aiModel: 'claude-sonnet-4-6',
      aiPromptVersion: 'v1',
      analysisStatus: 'success',
      errorMessage: null,
      analyzedAt: new Date('2026-03-22T00:00:00Z'),
    };

    await upsertWebsiteDealData(data, 'test-user');

    expect(prisma.websiteDealData.upsert).toHaveBeenCalledTimes(1);

    const call = vi.mocked(prisma.websiteDealData.upsert).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call?.where).toEqual({
      googleRawBusinessId_sourceType: {
        googleRawBusinessId: 'biz-1',
        sourceType: 'website',
      },
    });
    expect(call?.create).toMatchObject({
      googleRawBusinessId: 'biz-1',
      sourceType: 'website',
      sourceUrl: 'https://example.com',
      aiModel: 'claude-sonnet-4-6',
      analysisStatus: 'success',
      createdBy: 'test-user',
      updatedBy: 'test-user',
    });
    expect(call?.create.createdOn).toBeDefined();
    expect(call?.create.updatedOn).toBeDefined();
  });

  it('calls prisma.upsert with correct update data (no createdOn/createdBy)', async () => {
    const mockResult = { id: 'deal-1', googleRawBusinessId: 'biz-1' };
    vi.mocked(prisma.websiteDealData.upsert).mockResolvedValue(mockResult as never);

    const data = {
      googleRawBusinessId: 'biz-1',
      sourceType: 'website' as const,
      sourceUrl: 'https://example.com',
      deals: [],
      rawAiResponse: null,
      aiModel: 'claude-sonnet-4-6',
      aiPromptVersion: 'v1',
      analysisStatus: 'no_deals',
      errorMessage: null,
      analyzedAt: new Date(),
    };

    await upsertWebsiteDealData(data);

    const call = vi.mocked(prisma.websiteDealData.upsert).mock.calls[0]?.[0];
    expect(call?.update).toBeDefined();
    expect(call?.update).not.toHaveProperty('createdOn');
    expect(call?.update).not.toHaveProperty('createdBy');
    expect(call?.update).toHaveProperty('updatedOn');
    expect(call?.update).toHaveProperty('updatedBy');
  });

  it('handles null errorMessage from undefined', async () => {
    vi.mocked(prisma.websiteDealData.upsert).mockResolvedValue({} as never);

    const data = {
      googleRawBusinessId: 'biz-1',
      sourceType: 'website' as const,
      sourceUrl: 'https://example.com',
      deals: null,
      rawAiResponse: null,
      aiModel: 'claude-sonnet-4-6',
      aiPromptVersion: 'v1',
      analysisStatus: 'failed',
      errorMessage: undefined,
      analyzedAt: new Date(),
    };

    await upsertWebsiteDealData(data);

    const call = vi.mocked(prisma.websiteDealData.upsert).mock.calls[0]?.[0];
    expect(call?.create.errorMessage).toBeNull();
    expect(call?.update.errorMessage).toBeNull();
  });

  it('throws on prisma error', async () => {
    vi.mocked(prisma.websiteDealData.upsert).mockRejectedValue(new Error('DB error'));

    const data = {
      googleRawBusinessId: 'biz-1',
      sourceType: 'website' as const,
      sourceUrl: 'https://example.com',
      deals: null,
      rawAiResponse: null,
      aiModel: 'claude-sonnet-4-6',
      aiPromptVersion: 'v1',
      analysisStatus: 'error',
      errorMessage: 'test',
      analyzedAt: new Date(),
    };

    await expect(upsertWebsiteDealData(data)).rejects.toThrow('DB error');
  });
});

describe('findBusinessesWithoutDealAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries businesses with successful social scrape but no deal analysis', async () => {
    const mockResults = [
      {
        id: 'link-1',
        websiteUrl: 'https://bar1.com',
        googleRawBusiness: { id: 'biz-1', name: 'Bar 1', uri: 'https://bar1.com' },
      },
    ];
    vi.mocked(prisma.businessSocialLink.findMany).mockResolvedValue(mockResults as never);

    const result = await findBusinessesWithoutDealAnalysis();

    expect(prisma.businessSocialLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          websiteUrl: { not: null },
          scrapeStatus: 'success',
        }),
        take: 1000,
      })
    );
    expect(result).toHaveLength(1);
  });

  it('respects custom limit', async () => {
    vi.mocked(prisma.businessSocialLink.findMany).mockResolvedValue([] as never);

    await findBusinessesWithoutDealAnalysis('website', 50);

    expect(prisma.businessSocialLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });

  it('filters by instagramUrl for instagram sourceType', async () => {
    vi.mocked(prisma.businessSocialLink.findMany).mockResolvedValue([] as never);

    await findBusinessesWithoutDealAnalysis('instagram');

    expect(prisma.businessSocialLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          instagramUrl: { not: null },
          scrapeStatus: 'success',
        }),
      })
    );
  });

  it('filters by facebookUrl for facebook sourceType', async () => {
    vi.mocked(prisma.businessSocialLink.findMany).mockResolvedValue([] as never);

    await findBusinessesWithoutDealAnalysis('facebook');

    expect(prisma.businessSocialLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          facebookUrl: { not: null },
          scrapeStatus: 'success',
        }),
      })
    );
  });

  it('filters by twitterUrl for twitter sourceType', async () => {
    vi.mocked(prisma.businessSocialLink.findMany).mockResolvedValue([] as never);

    await findBusinessesWithoutDealAnalysis('twitter');

    expect(prisma.businessSocialLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          twitterUrl: { not: null },
          scrapeStatus: 'success',
        }),
      })
    );
  });
});

describe('findDealsByBusinessId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls findMany with correct googleRawBusinessId', async () => {
    const mockDeals = [{ id: 'deal-1', googleRawBusinessId: 'biz-1', sourceType: 'website' }];
    vi.mocked(prisma.websiteDealData.findMany).mockResolvedValue(mockDeals as never);

    const result = await findDealsByBusinessId('biz-1');

    expect(prisma.websiteDealData.findMany).toHaveBeenCalledWith({
      where: { googleRawBusinessId: 'biz-1' },
    });
    expect(result).toEqual(mockDeals);
  });

  it('returns empty array when not found', async () => {
    vi.mocked(prisma.websiteDealData.findMany).mockResolvedValue([]);

    const result = await findDealsByBusinessId('nonexistent');
    expect(result).toEqual([]);
  });
});

describe('getDealAnalysisStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns aggregated stats', async () => {
    vi.mocked(prisma.websiteDealData.groupBy).mockResolvedValue([
      { analysisStatus: 'success', _count: { _all: 30 } },
      { analysisStatus: 'no_deals', _count: { _all: 50 } },
      { analysisStatus: 'failed', _count: { _all: 5 } },
    ] as never);
    vi.mocked(prisma.websiteDealData.count)
      .mockResolvedValueOnce(85) // total
      .mockResolvedValueOnce(30); // withDeals

    const stats = await getDealAnalysisStats();

    expect(stats.total).toBe(85);
    expect(stats.withDeals).toBe(30);
    expect(stats.byStatus).toHaveLength(3);
  });
});
