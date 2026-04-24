import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSociavaultGet, mockGetCutoff } = vi.hoisted(() => ({
  mockSociavaultGet: vi.fn(),
  mockGetCutoff: vi.fn(),
}));

vi.mock('../../sociavault/client', () => ({
  sociavaultGet: mockSociavaultGet,
  getCutoffTimestamp: mockGetCutoff,
}));

vi.mock('../../../config/sociavault', () => ({
  sociavaultConfig: {
    apiKey: 'sk_live_test',
    baseUrl: 'https://api.sociavault.com/v1/scrape',
    timeout: 30000,
    maxAgeDays: 60,
    maxPages: 20,
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  extractFacebookPageSlug,
  fetchFacebookPosts,
  formatFacebookContent,
} from '../clients/facebookClient';
import type { FacebookPost } from '../types';

const CUTOFF = Date.now() - 60 * 24 * 60 * 60 * 1000;

function makePost(overrides: Partial<{ id: string; text: string | null; publishTime: number }> = {}) {
  const publishTime = overrides.publishTime ?? Math.floor(Date.now() / 1000);
  return {
    id: overrides.id ?? 'post-1',
    text: overrides.text !== undefined ? overrides.text : 'Happy Hour starts at 4pm!',
    url: 'https://facebook.com/somebar/posts/123',
    permalink: '/somebar/posts/123',
    author: { name: 'Some Bar', id: '123456' },
    reactionCount: 25,
    commentCount: 3,
    publishTime,
  };
}

function wrapResponse(posts: unknown[], cursor: string | null = null) {
  return {
    success: true,
    data: { posts, cursor },
    credits_used: 1,
  };
}

describe('extractFacebookPageSlug', () => {
  it('extracts page slug from standard URL', () => {
    expect(extractFacebookPageSlug('https://www.facebook.com/somebar')).toBe('somebar');
  });

  it('extracts slug with trailing slash', () => {
    expect(extractFacebookPageSlug('https://facebook.com/somebar/')).toBe('somebar');
  });

  it('returns null for invalid URL', () => {
    expect(extractFacebookPageSlug('not-a-url')).toBeNull();
  });
});

describe('fetchFacebookPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCutoff.mockReturnValue(CUTOFF);
  });

  it('fetches posts from SociaVault and transforms to FacebookPost[]', async () => {
    mockSociavaultGet.mockResolvedValue(
      wrapResponse([
        makePost({ id: 'p1', text: 'Happy Hour 4-7pm!' }),
        makePost({ id: 'p2', text: 'Wings Wednesday!' }),
      ])
    );

    const posts = await fetchFacebookPosts('https://facebook.com/somebar');

    expect(posts).toHaveLength(2);
    expect(posts[0].message).toBe('Happy Hour 4-7pm!');
    expect(posts[0].id).toBe('p1');
    expect(posts[1].message).toBe('Wings Wednesday!');
    expect(mockSociavaultGet).toHaveBeenCalledWith(
      '/facebook/profile/posts',
      { url: 'https://facebook.com/somebar', cursor: undefined }
    );
  });

  it('paginates using cursor until no more pages', async () => {
    mockSociavaultGet
      .mockResolvedValueOnce(wrapResponse([makePost({ id: 'p1' })], 'cursor_abc'))
      .mockResolvedValueOnce(wrapResponse([makePost({ id: 'p2' })]));

    const posts = await fetchFacebookPosts('https://facebook.com/bar');

    expect(posts).toHaveLength(2);
    expect(mockSociavaultGet).toHaveBeenCalledTimes(2);
    expect(mockSociavaultGet.mock.calls[1][1]).toMatchObject({ cursor: 'cursor_abc' });
  });

  it('stops pagination when posts are older than 60 days', async () => {
    const oldTimestamp = Math.floor((CUTOFF - 86400000) / 1000);

    mockSociavaultGet.mockResolvedValue(
      wrapResponse(
        [makePost({ id: 'new' }), makePost({ id: 'old', publishTime: oldTimestamp })],
        'cursor_next'
      )
    );

    const posts = await fetchFacebookPosts('https://facebook.com/bar');

    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe('new');
    expect(mockSociavaultGet).toHaveBeenCalledTimes(1);
  });

  it('handles posts with null text', async () => {
    mockSociavaultGet.mockResolvedValue(
      wrapResponse([makePost({ text: null })])
    );

    const posts = await fetchFacebookPosts('https://facebook.com/bar');
    expect(posts).toHaveLength(1);
    expect(posts[0].message).toBeNull();
  });

  it('returns empty array when no posts', async () => {
    mockSociavaultGet.mockResolvedValue(wrapResponse([]));

    const posts = await fetchFacebookPosts('https://facebook.com/emptybar');
    expect(posts).toHaveLength(0);
  });

  it('throws when page slug cannot be extracted', async () => {
    await expect(fetchFacebookPosts('not-a-url')).rejects.toThrow(
      'Could not extract Facebook page slug'
    );
  });

  it('throws when SociaVault API fails', async () => {
    mockSociavaultGet.mockRejectedValue(new Error('SociaVault /facebook/profile/posts failed (402): Insufficient credits'));

    await expect(fetchFacebookPosts('https://facebook.com/bar')).rejects.toThrow('SociaVault');
  });
});

describe('formatFacebookContent', () => {
  it('formats posts with messages into text', () => {
    const posts: FacebookPost[] = [
      { id: '1', message: 'Happy Hour 4-7pm!', createdTime: '2026-03-20T16:00:00.000Z', publishTime: 0, url: '', reactionCount: 0, commentCount: 0, imageUrl: null },
      { id: '2', message: '$5 margaritas all day', createdTime: '2026-03-19T12:00:00.000Z', publishTime: 0, url: '', reactionCount: 0, commentCount: 0, imageUrl: null },
    ];

    const content = formatFacebookContent(posts);
    expect(content).toContain('Post 1');
    expect(content).toContain('Happy Hour 4-7pm!');
    expect(content).toContain('Post 2');
    expect(content).toContain('$5 margaritas all day');
  });

  it('filters out posts without deal keywords', () => {
    const posts: FacebookPost[] = [
      { id: '1', message: null, createdTime: '2026-03-20T16:00:00.000Z', publishTime: 0, url: '', reactionCount: 0, commentCount: 0, imageUrl: null },
      { id: '2', message: '$3 drafts tonight', createdTime: '2026-03-19T12:00:00.000Z', publishTime: 0, url: '', reactionCount: 0, commentCount: 0, imageUrl: null },
    ];

    const content = formatFacebookContent(posts);
    expect(content).toContain('$3 drafts tonight');
    expect(content).not.toContain('Post 2');
  });

  it('returns empty string when no posts have messages', () => {
    expect(
      formatFacebookContent([{ id: '1', message: null, createdTime: '2026-03-20T16:00:00.000Z', publishTime: 0, url: '', reactionCount: 0, commentCount: 0, imageUrl: null }])
    ).toBe('');
  });
});
