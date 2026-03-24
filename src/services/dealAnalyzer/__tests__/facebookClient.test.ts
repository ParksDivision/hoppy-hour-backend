import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxiosGet } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockAxiosGet,
    })),
  },
}));

vi.mock('../../../config/meta', () => ({
  metaConfig: {
    accessToken: 'test-meta-token',
    instagramBusinessAccountId: 'test-ig-account-id',
    graphApiVersion: 'v21.0',
    graphApiBaseUrl: 'https://graph.facebook.com',
    postsPerRequest: 100,
    timeout: 30000,
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
  });

  it('resolves page ID then fetches posts', async () => {
    // First call: resolve page ID
    mockAxiosGet.mockResolvedValueOnce({
      data: { id: '123456789', name: 'Some Bar' },
    });
    // Second call: fetch posts
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        data: [
          { message: 'Happy Hour starts at 4pm!', created_time: '2026-03-20T16:00:00+0000' },
          { message: 'Wings Wednesday - half price!', created_time: '2026-03-19T12:00:00+0000' },
        ],
      },
    });

    const posts = await fetchFacebookPosts('https://facebook.com/somebar');

    expect(posts).toHaveLength(2);
    expect(posts[0].message).toBe('Happy Hour starts at 4pm!');
    expect(posts[1].message).toBe('Wings Wednesday - half price!');
    expect(mockAxiosGet).toHaveBeenCalledTimes(2);
  });

  it('handles posts with null messages', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { id: '123' } });
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        data: [{ message: null, created_time: '2026-03-20T16:00:00+0000' }],
      },
    });

    const posts = await fetchFacebookPosts('https://facebook.com/somebar');
    expect(posts).toHaveLength(1);
    expect(posts[0].message).toBeNull();
  });

  it('throws when page slug cannot be extracted', async () => {
    await expect(fetchFacebookPosts('not-a-url')).rejects.toThrow(
      'Could not extract Facebook page slug'
    );
  });

  it('throws when page ID cannot be resolved', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: {} });

    await expect(fetchFacebookPosts('https://facebook.com/nonexistent')).rejects.toThrow(
      'Could not resolve Facebook page ID'
    );
  });
});

describe('formatFacebookContent', () => {
  it('formats posts with messages into text', () => {
    const posts: FacebookPost[] = [
      { message: 'Happy Hour 4-7pm!', createdTime: '2026-03-20T16:00:00+0000' },
      { message: '$5 margaritas all day', createdTime: '2026-03-19T12:00:00+0000' },
    ];

    const content = formatFacebookContent(posts);
    expect(content).toContain('Post 1');
    expect(content).toContain('Happy Hour 4-7pm!');
    expect(content).toContain('Post 2');
    expect(content).toContain('$5 margaritas all day');
  });

  it('filters out posts without messages', () => {
    const posts: FacebookPost[] = [
      { message: null, createdTime: '2026-03-20T16:00:00+0000' },
      { message: 'Has a message', createdTime: '2026-03-19T12:00:00+0000' },
    ];

    const content = formatFacebookContent(posts);
    expect(content).toContain('Has a message');
    expect(content).not.toContain('Post 2');
  });

  it('returns empty string when no posts have messages', () => {
    expect(
      formatFacebookContent([{ message: null, createdTime: '2026-03-20T16:00:00+0000' }])
    ).toBe('');
  });
});
