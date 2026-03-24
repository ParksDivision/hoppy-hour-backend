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
  extractInstagramUsername,
  fetchInstagramPosts,
  formatInstagramContent,
} from '../clients/instagramClient';
import type { InstagramPost } from '../types';

describe('extractInstagramUsername', () => {
  it('extracts username from standard URL', () => {
    expect(extractInstagramUsername('https://www.instagram.com/barname/')).toBe('barname');
  });

  it('extracts username from URL without www', () => {
    expect(extractInstagramUsername('https://instagram.com/barname')).toBe('barname');
  });

  it('returns null for invalid URL', () => {
    expect(extractInstagramUsername('not-a-url')).toBeNull();
  });
});

describe('fetchInstagramPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches posts via Business Discovery API', async () => {
    mockAxiosGet.mockResolvedValue({
      data: {
        business_discovery: {
          username: 'barname',
          media: {
            data: [
              {
                caption: 'Happy Hour today! $3 wells',
                timestamp: '2026-03-20T18:00:00+0000',
                media_type: 'IMAGE',
                permalink: 'https://www.instagram.com/p/abc123/',
              },
              {
                caption: 'Taco Tuesday is back!',
                timestamp: '2026-03-19T12:00:00+0000',
                media_type: 'CAROUSEL_ALBUM',
                permalink: 'https://www.instagram.com/p/def456/',
              },
            ],
          },
        },
      },
    });

    const posts = await fetchInstagramPosts('https://instagram.com/barname');

    expect(posts).toHaveLength(2);
    expect(posts[0].caption).toBe('Happy Hour today! $3 wells');
    expect(posts[0].mediaType).toBe('IMAGE');
    expect(posts[1].caption).toBe('Taco Tuesday is back!');
  });

  it('returns empty array when account has no business discovery data', async () => {
    mockAxiosGet.mockResolvedValue({ data: {} });

    const posts = await fetchInstagramPosts('https://instagram.com/privateaccount');
    expect(posts).toHaveLength(0);
  });

  it('handles null captions (image-only posts)', async () => {
    mockAxiosGet.mockResolvedValue({
      data: {
        business_discovery: {
          media: {
            data: [
              {
                caption: null,
                timestamp: '2026-03-20T18:00:00+0000',
                media_type: 'IMAGE',
                permalink: 'https://instagram.com/p/x',
              },
            ],
          },
        },
      },
    });

    const posts = await fetchInstagramPosts('https://instagram.com/barname');
    expect(posts).toHaveLength(1);
    expect(posts[0].caption).toBeNull();
  });

  it('throws on invalid URL', async () => {
    await expect(fetchInstagramPosts('not-a-url')).rejects.toThrow(
      'Could not extract Instagram username'
    );
  });
});

describe('formatInstagramContent', () => {
  it('formats posts with captions into text', () => {
    const posts: InstagramPost[] = [
      {
        caption: 'Happy Hour 3-6pm!',
        timestamp: '2026-03-20T18:00:00+0000',
        mediaType: 'IMAGE',
        permalink: '',
      },
      {
        caption: 'Taco Tuesday $2 tacos',
        timestamp: '2026-03-19T12:00:00+0000',
        mediaType: 'IMAGE',
        permalink: '',
      },
    ];

    const content = formatInstagramContent(posts);
    expect(content).toContain('Post 1');
    expect(content).toContain('Happy Hour 3-6pm!');
    expect(content).toContain('Post 2');
    expect(content).toContain('Taco Tuesday $2 tacos');
  });

  it('filters out posts without captions', () => {
    const posts: InstagramPost[] = [
      { caption: null, timestamp: '2026-03-20T18:00:00+0000', mediaType: 'IMAGE', permalink: '' },
      {
        caption: 'Has a caption',
        timestamp: '2026-03-19T12:00:00+0000',
        mediaType: 'IMAGE',
        permalink: '',
      },
    ];

    const content = formatInstagramContent(posts);
    expect(content).toContain('Has a caption');
    expect(content).not.toContain('Post 2');
  });

  it('returns empty string when no posts have captions', () => {
    const posts: InstagramPost[] = [
      { caption: null, timestamp: '2026-03-20T18:00:00+0000', mediaType: 'IMAGE', permalink: '' },
    ];

    expect(formatInstagramContent(posts)).toBe('');
  });
});
