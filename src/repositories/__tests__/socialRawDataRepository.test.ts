import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// Mock Prisma
vi.mock('../../utils/database', () => ({
  default: {
    instagramRawData: {
      upsert: vi.fn(),
    },
    facebookRawData: {
      upsert: vi.fn(),
    },
    twitterRawData: {
      upsert: vi.fn(),
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
  upsertInstagramRawData,
  upsertFacebookRawData,
  upsertTwitterRawData,
} from '../socialRawDataRepository';

// ─── Instagram ────────────────────────────────────────────────────────────────

describe('upsertInstagramRawData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts with correct create data on success', async () => {
    const mockResult = { id: 'ig-1', googleRawBusinessId: 'biz-1' };
    vi.mocked(prisma.instagramRawData.upsert).mockResolvedValue(mockResult as never);

    const posts = [
      { caption: 'Happy Hour 3-6pm!', timestamp: '2026-03-20T18:00:00Z', mediaType: 'IMAGE', permalink: 'https://instagram.com/p/abc' },
      { caption: 'Taco Tuesday!', timestamp: '2026-03-19T12:00:00Z', mediaType: 'IMAGE', permalink: 'https://instagram.com/p/def' },
    ];

    await upsertInstagramRawData(
      {
        googleRawBusinessId: 'biz-1',
        profileUrl: 'https://instagram.com/testbar',
        username: 'testbar',
        posts,
        fetchStatus: 'success',
      },
      'system'
    );

    expect(prisma.instagramRawData.upsert).toHaveBeenCalledTimes(1);

    const call = vi.mocked(prisma.instagramRawData.upsert).mock.calls[0]?.[0];
    expect(call?.where).toEqual({ googleRawBusinessId: 'biz-1' });
    expect(call?.create).toMatchObject({
      googleRawBusinessId: 'biz-1',
      profileUrl: 'https://instagram.com/testbar',
      username: 'testbar',
      postCount: 2,
      fetchStatus: 'success',
      createdBy: 'system',
      updatedBy: 'system',
    });
    expect(call?.create.createdOn).toBeDefined();
    expect(call?.create.updatedOn).toBeDefined();
    expect(call?.create.fetchedAt).toBeDefined();
    expect(call?.create.posts).toEqual(posts);
  });

  it('update payload does not include createdOn/createdBy', async () => {
    vi.mocked(prisma.instagramRawData.upsert).mockResolvedValue({} as never);

    await upsertInstagramRawData({
      googleRawBusinessId: 'biz-1',
      profileUrl: 'https://instagram.com/testbar',
      username: 'testbar',
      posts: [],
      fetchStatus: 'empty',
    });

    const call = vi.mocked(prisma.instagramRawData.upsert).mock.calls[0]?.[0];
    expect(call?.update).not.toHaveProperty('createdOn');
    expect(call?.update).not.toHaveProperty('createdBy');
    expect(call?.update).toHaveProperty('updatedOn');
    expect(call?.update).toHaveProperty('updatedBy');
  });

  it('stores Prisma.JsonNull when posts array is empty', async () => {
    vi.mocked(prisma.instagramRawData.upsert).mockResolvedValue({} as never);

    await upsertInstagramRawData({
      googleRawBusinessId: 'biz-1',
      profileUrl: 'https://instagram.com/testbar',
      username: null,
      posts: [],
      fetchStatus: 'empty',
    });

    const call = vi.mocked(prisma.instagramRawData.upsert).mock.calls[0]?.[0];
    expect(call?.create.posts).toBe(Prisma.JsonNull);
    expect(call?.create.postCount).toBe(0);
  });

  it('saves error status and message on failed fetch', async () => {
    vi.mocked(prisma.instagramRawData.upsert).mockResolvedValue({} as never);

    await upsertInstagramRawData({
      googleRawBusinessId: 'biz-1',
      profileUrl: 'https://instagram.com/testbar',
      username: null,
      posts: [],
      fetchStatus: 'error',
      errorMessage: 'META_ACCESS_TOKEN is not configured',
    });

    const call = vi.mocked(prisma.instagramRawData.upsert).mock.calls[0]?.[0];
    expect(call?.create).toMatchObject({
      fetchStatus: 'error',
      errorMessage: 'META_ACCESS_TOKEN is not configured',
      postCount: 0,
    });
  });

  it('defaults createdBy to system when not provided', async () => {
    vi.mocked(prisma.instagramRawData.upsert).mockResolvedValue({} as never);

    await upsertInstagramRawData({
      googleRawBusinessId: 'biz-1',
      profileUrl: 'https://instagram.com/bar',
      username: 'bar',
      posts: [],
      fetchStatus: 'empty',
    });

    const call = vi.mocked(prisma.instagramRawData.upsert).mock.calls[0]?.[0];
    expect(call?.create.createdBy).toBe('system');
    expect(call?.create.updatedBy).toBe('system');
  });

  it('throws on Prisma error', async () => {
    vi.mocked(prisma.instagramRawData.upsert).mockRejectedValue(new Error('DB connection failed'));

    await expect(
      upsertInstagramRawData({
        googleRawBusinessId: 'biz-1',
        profileUrl: 'https://instagram.com/bar',
        username: null,
        posts: [],
        fetchStatus: 'error',
      })
    ).rejects.toThrow('DB connection failed');
  });
});

// ─── Facebook ─────────────────────────────────────────────────────────────────

describe('upsertFacebookRawData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts with correct create data on success', async () => {
    vi.mocked(prisma.facebookRawData.upsert).mockResolvedValue({} as never);

    const posts = [
      { message: 'Happy Hour today 4-7pm!', createdTime: '2026-03-20T16:00:00Z' },
    ];

    await upsertFacebookRawData(
      {
        googleRawBusinessId: 'biz-2',
        profileUrl: 'https://facebook.com/testbar',
        pageSlug: 'testbar',
        posts,
        fetchStatus: 'success',
      },
      'pipeline'
    );

    expect(prisma.facebookRawData.upsert).toHaveBeenCalledTimes(1);

    const call = vi.mocked(prisma.facebookRawData.upsert).mock.calls[0]?.[0];
    expect(call?.where).toEqual({ googleRawBusinessId: 'biz-2' });
    expect(call?.create).toMatchObject({
      googleRawBusinessId: 'biz-2',
      profileUrl: 'https://facebook.com/testbar',
      pageSlug: 'testbar',
      postCount: 1,
      fetchStatus: 'success',
      createdBy: 'pipeline',
      updatedBy: 'pipeline',
    });
    expect(call?.create.posts).toEqual(posts);
    expect(call?.create.fetchedAt).toBeDefined();
  });

  it('update payload does not include createdOn/createdBy', async () => {
    vi.mocked(prisma.facebookRawData.upsert).mockResolvedValue({} as never);

    await upsertFacebookRawData({
      googleRawBusinessId: 'biz-2',
      profileUrl: 'https://facebook.com/bar',
      pageSlug: null,
      posts: [],
      fetchStatus: 'empty',
    });

    const call = vi.mocked(prisma.facebookRawData.upsert).mock.calls[0]?.[0];
    expect(call?.update).not.toHaveProperty('createdOn');
    expect(call?.update).not.toHaveProperty('createdBy');
    expect(call?.update).toHaveProperty('updatedOn');
  });

  it('stores Prisma.JsonNull when posts array is empty', async () => {
    vi.mocked(prisma.facebookRawData.upsert).mockResolvedValue({} as never);

    await upsertFacebookRawData({
      googleRawBusinessId: 'biz-2',
      profileUrl: 'https://facebook.com/bar',
      pageSlug: 'bar',
      posts: [],
      fetchStatus: 'empty',
    });

    const call = vi.mocked(prisma.facebookRawData.upsert).mock.calls[0]?.[0];
    expect(call?.create.posts).toBe(Prisma.JsonNull);
  });

  it('saves error status and message on failed fetch', async () => {
    vi.mocked(prisma.facebookRawData.upsert).mockResolvedValue({} as never);

    await upsertFacebookRawData({
      googleRawBusinessId: 'biz-2',
      profileUrl: 'https://facebook.com/bar',
      pageSlug: null,
      posts: [],
      fetchStatus: 'error',
      errorMessage: 'Could not resolve Facebook page ID',
    });

    const call = vi.mocked(prisma.facebookRawData.upsert).mock.calls[0]?.[0];
    expect(call?.create).toMatchObject({
      fetchStatus: 'error',
      errorMessage: 'Could not resolve Facebook page ID',
    });
  });

  it('throws on Prisma error', async () => {
    vi.mocked(prisma.facebookRawData.upsert).mockRejectedValue(new Error('Unique constraint failed'));

    await expect(
      upsertFacebookRawData({
        googleRawBusinessId: 'biz-2',
        profileUrl: 'https://facebook.com/bar',
        pageSlug: null,
        posts: [],
        fetchStatus: 'error',
      })
    ).rejects.toThrow('Unique constraint failed');
  });
});

// ─── Twitter ──────────────────────────────────────────────────────────────────

describe('upsertTwitterRawData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts with correct create data on success', async () => {
    vi.mocked(prisma.twitterRawData.upsert).mockResolvedValue({} as never);

    const tweets = [
      { text: 'Happy Hour NOW! $3 wells until 7pm', createdAt: '2026-03-20T22:00:00Z' },
      { text: 'Taco Tuesday $2 tacos all day!', createdAt: '2026-03-19T17:00:00Z' },
    ];

    await upsertTwitterRawData(
      {
        googleRawBusinessId: 'biz-3',
        profileUrl: 'https://x.com/testbar',
        username: 'testbar',
        tweets,
        fetchStatus: 'success',
      },
      'system'
    );

    expect(prisma.twitterRawData.upsert).toHaveBeenCalledTimes(1);

    const call = vi.mocked(prisma.twitterRawData.upsert).mock.calls[0]?.[0];
    expect(call?.where).toEqual({ googleRawBusinessId: 'biz-3' });
    expect(call?.create).toMatchObject({
      googleRawBusinessId: 'biz-3',
      profileUrl: 'https://x.com/testbar',
      username: 'testbar',
      tweetCount: 2,
      fetchStatus: 'success',
      createdBy: 'system',
    });
    expect(call?.create.tweets).toEqual(tweets);
    expect(call?.create.fetchedAt).toBeDefined();
  });

  it('update payload does not include createdOn/createdBy', async () => {
    vi.mocked(prisma.twitterRawData.upsert).mockResolvedValue({} as never);

    await upsertTwitterRawData({
      googleRawBusinessId: 'biz-3',
      profileUrl: 'https://x.com/bar',
      username: 'bar',
      tweets: [],
      fetchStatus: 'empty',
    });

    const call = vi.mocked(prisma.twitterRawData.upsert).mock.calls[0]?.[0];
    expect(call?.update).not.toHaveProperty('createdOn');
    expect(call?.update).not.toHaveProperty('createdBy');
    expect(call?.update).toHaveProperty('updatedOn');
    expect(call?.update).toHaveProperty('updatedBy');
  });

  it('stores Prisma.JsonNull when tweets array is empty', async () => {
    vi.mocked(prisma.twitterRawData.upsert).mockResolvedValue({} as never);

    await upsertTwitterRawData({
      googleRawBusinessId: 'biz-3',
      profileUrl: 'https://x.com/bar',
      username: null,
      tweets: [],
      fetchStatus: 'empty',
    });

    const call = vi.mocked(prisma.twitterRawData.upsert).mock.calls[0]?.[0];
    expect(call?.create.tweets).toBe(Prisma.JsonNull);
    expect(call?.create.tweetCount).toBe(0);
  });

  it('saves error status and message on failed fetch', async () => {
    vi.mocked(prisma.twitterRawData.upsert).mockResolvedValue({} as never);

    await upsertTwitterRawData({
      googleRawBusinessId: 'biz-3',
      profileUrl: 'https://x.com/bar',
      username: null,
      tweets: [],
      fetchStatus: 'error',
      errorMessage: 'TWITTER_BEARER_TOKEN is not configured',
    });

    const call = vi.mocked(prisma.twitterRawData.upsert).mock.calls[0]?.[0];
    expect(call?.create).toMatchObject({
      fetchStatus: 'error',
      errorMessage: 'TWITTER_BEARER_TOKEN is not configured',
      tweetCount: 0,
    });
  });

  it('throws on Prisma error', async () => {
    vi.mocked(prisma.twitterRawData.upsert).mockRejectedValue(new Error('DB error'));

    await expect(
      upsertTwitterRawData({
        googleRawBusinessId: 'biz-3',
        profileUrl: 'https://x.com/bar',
        username: null,
        tweets: [],
        fetchStatus: 'error',
      })
    ).rejects.toThrow('DB error');
  });
});
