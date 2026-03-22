import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('../../utils/database', () => ({
  default: {
    businessSocialLink: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    googleRawBusiness: {
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
  upsertBusinessSocialLink,
  findBusinessesWithoutSocialLinks,
  findSocialLinksByBusinessId,
  getSocialLinkStats,
} from '../businessSocialLinkRepository';

describe('upsertBusinessSocialLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls prisma.upsert with correct create data', async () => {
    const mockResult = { id: 'link-1', googleRawBusinessId: 'biz-1' };
    vi.mocked(prisma.businessSocialLink.upsert).mockResolvedValue(mockResult as never);

    const data = {
      googleRawBusinessId: 'biz-1',
      websiteUrl: 'https://example.com',
      facebookUrl: 'https://www.facebook.com/bar',
      instagramUrl: 'https://instagram.com/bar',
      twitterUrl: null,
      scrapedAt: new Date('2026-03-22T00:00:00Z'),
      scrapeMethod: 'cheerio',
      scrapeStatus: 'success',
      errorMessage: null,
      rawLinksFound: [],
    };

    await upsertBusinessSocialLink(data, 'test-user');

    expect(prisma.businessSocialLink.upsert).toHaveBeenCalledTimes(1);

    const call = vi.mocked(prisma.businessSocialLink.upsert).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call?.where).toEqual({ googleRawBusinessId: 'biz-1' });
    expect(call?.create).toMatchObject({
      googleRawBusinessId: 'biz-1',
      websiteUrl: 'https://example.com',
      facebookUrl: 'https://www.facebook.com/bar',
      instagramUrl: 'https://instagram.com/bar',
      twitterUrl: null,
      scrapeMethod: 'cheerio',
      scrapeStatus: 'success',
      createdBy: 'test-user',
      updatedBy: 'test-user',
    });
    expect(call?.create.createdOn).toBeDefined();
    expect(call?.create.updatedOn).toBeDefined();
  });

  it('calls prisma.upsert with correct update data (no createdOn/createdBy)', async () => {
    const mockResult = { id: 'link-1', googleRawBusinessId: 'biz-1' };
    vi.mocked(prisma.businessSocialLink.upsert).mockResolvedValue(mockResult as never);

    const data = {
      googleRawBusinessId: 'biz-1',
      websiteUrl: 'https://example.com',
      facebookUrl: null,
      instagramUrl: null,
      twitterUrl: 'https://x.com/bar',
      scrapedAt: new Date(),
      scrapeMethod: 'playwright',
      scrapeStatus: 'success',
      errorMessage: null,
      rawLinksFound: [],
    };

    await upsertBusinessSocialLink(data);

    const call = vi.mocked(prisma.businessSocialLink.upsert).mock.calls[0]?.[0];
    expect(call?.update).toBeDefined();
    expect(call?.update).not.toHaveProperty('createdOn');
    expect(call?.update).not.toHaveProperty('createdBy');
    expect(call?.update).toHaveProperty('updatedOn');
    expect(call?.update).toHaveProperty('updatedBy');
  });

  it('handles null errorMessage from undefined', async () => {
    vi.mocked(prisma.businessSocialLink.upsert).mockResolvedValue({} as never);

    const data = {
      googleRawBusinessId: 'biz-1',
      websiteUrl: 'https://example.com',
      facebookUrl: null,
      instagramUrl: null,
      twitterUrl: null,
      scrapedAt: new Date(),
      scrapeMethod: 'cheerio',
      scrapeStatus: 'failed',
      errorMessage: undefined,
      rawLinksFound: [],
    };

    await upsertBusinessSocialLink(data);

    const call = vi.mocked(prisma.businessSocialLink.upsert).mock.calls[0]?.[0];
    expect(call?.create.errorMessage).toBeNull();
    expect(call?.update.errorMessage).toBeNull();
  });

  it('throws on prisma error', async () => {
    vi.mocked(prisma.businessSocialLink.upsert).mockRejectedValue(new Error('DB error'));

    const data = {
      googleRawBusinessId: 'biz-1',
      websiteUrl: 'https://example.com',
      facebookUrl: null,
      instagramUrl: null,
      twitterUrl: null,
      scrapedAt: new Date(),
      scrapeMethod: 'cheerio',
      scrapeStatus: 'failed',
      errorMessage: 'test',
      rawLinksFound: [],
    };

    await expect(upsertBusinessSocialLink(data)).rejects.toThrow('DB error');
  });
});

describe('findBusinessesWithoutSocialLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries businesses with uri NOT NULL and no social links', async () => {
    const mockBusinesses = [
      { id: 'biz-1', name: 'Bar 1', uri: 'https://bar1.com' },
      { id: 'biz-2', name: 'Bar 2', uri: 'https://bar2.com' },
    ];
    vi.mocked(prisma.googleRawBusiness.findMany).mockResolvedValue(mockBusinesses as never);

    const result = await findBusinessesWithoutSocialLinks();

    expect(prisma.googleRawBusiness.findMany).toHaveBeenCalledWith({
      where: {
        uri: { not: null },
        socialLinks: null,
      },
      take: 1000,
      orderBy: { createdOn: 'desc' },
    });
    expect(result).toHaveLength(2);
  });

  it('respects custom limit', async () => {
    vi.mocked(prisma.googleRawBusiness.findMany).mockResolvedValue([] as never);

    await findBusinessesWithoutSocialLinks(50);

    expect(prisma.googleRawBusiness.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });
});

describe('findSocialLinksByBusinessId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls findUnique with correct googleRawBusinessId', async () => {
    const mockLink = {
      id: 'link-1',
      googleRawBusinessId: 'biz-1',
      facebookUrl: 'https://www.facebook.com/bar',
    };
    vi.mocked(prisma.businessSocialLink.findUnique).mockResolvedValue(mockLink as never);

    const result = await findSocialLinksByBusinessId('biz-1');

    expect(prisma.businessSocialLink.findUnique).toHaveBeenCalledWith({
      where: { googleRawBusinessId: 'biz-1' },
    });
    expect(result).toEqual(mockLink);
  });

  it('returns null when not found', async () => {
    vi.mocked(prisma.businessSocialLink.findUnique).mockResolvedValue(null);

    const result = await findSocialLinksByBusinessId('nonexistent');
    expect(result).toBeNull();
  });
});

describe('getSocialLinkStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns aggregated stats', async () => {
    vi.mocked(prisma.businessSocialLink.groupBy).mockResolvedValue([
      { scrapeStatus: 'success', _count: { _all: 50 } },
      { scrapeStatus: 'failed', _count: { _all: 10 } },
      { scrapeStatus: 'no_links', _count: { _all: 30 } },
    ] as never);
    vi.mocked(prisma.businessSocialLink.count)
      .mockResolvedValueOnce(90) // total
      .mockResolvedValueOnce(40) // withFacebook
      .mockResolvedValueOnce(35) // withInstagram
      .mockResolvedValueOnce(20); // withTwitter

    const stats = await getSocialLinkStats();

    expect(stats.total).toBe(90);
    expect(stats.withFacebook).toBe(40);
    expect(stats.withInstagram).toBe(35);
    expect(stats.withTwitter).toBe(20);
    expect(stats.byStatus).toHaveLength(3);
  });
});
