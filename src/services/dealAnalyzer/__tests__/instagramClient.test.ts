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
  extractInstagramUsername,
  fetchInstagramPosts,
  formatInstagramContent,
} from '../clients/instagramClient';
import type { InstagramPost } from '../types';

// Default cutoff: 60 days ago
const CUTOFF = Date.now() - 60 * 24 * 60 * 60 * 1000;

function makeItem(overrides: Partial<{ code: string; caption: string | null; taken_at: number; like_count: number }> = {}) {
  const takenAt = overrides.taken_at ?? Math.floor(Date.now() / 1000);
  return {
    pk: '111',
    id: '111_222',
    code: overrides.code ?? 'ABC123',
    media_type: 1,
    caption: overrides.caption !== undefined
      ? (overrides.caption ? { text: overrides.caption, created_at_utc: takenAt } : null)
      : { text: 'Happy Hour 3-6pm!', created_at_utc: takenAt },
    like_count: overrides.like_count ?? 50,
    comment_count: 5,
    taken_at: takenAt,
  };
}

function wrapResponse(items: unknown[], moreAvailable = false, nextMaxId: string | null = null) {
  const itemsObj: Record<string, unknown> = {};
  items.forEach((item, i) => { itemsObj[String(i)] = item; });
  return {
    success: true,
    data: {
      next_max_id: nextMaxId,
      more_available: moreAvailable,
      num_results: items.length,
      user: { pk: '222', username: 'testbar', full_name: 'Test Bar' },
      items: itemsObj,
    },
    credits_used: 1,
  };
}

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
    mockGetCutoff.mockReturnValue(CUTOFF);
  });

  it('fetches posts from SociaVault and transforms to InstagramPost[]', async () => {
    mockSociavaultGet.mockResolvedValue(
      wrapResponse([
        makeItem({ code: 'ABC', caption: 'Happy Hour today!' }),
        makeItem({ code: 'DEF', caption: 'Taco Tuesday!' }),
      ])
    );

    const posts = await fetchInstagramPosts('https://instagram.com/barname');

    expect(posts).toHaveLength(2);
    expect(posts[0].caption).toBe('Happy Hour today!');
    expect(posts[0].permalink).toBe('https://www.instagram.com/p/ABC/');
    expect(posts[1].caption).toBe('Taco Tuesday!');
    expect(mockSociavaultGet).toHaveBeenCalledWith(
      '/instagram/posts',
      { handle: 'barname', next_max_id: undefined }
    );
  });

  it('paginates until more_available is false', async () => {
    mockSociavaultGet
      .mockResolvedValueOnce(wrapResponse([makeItem({ code: 'P1' })], true, 'cursor_1'))
      .mockResolvedValueOnce(wrapResponse([makeItem({ code: 'P2' })]));

    const posts = await fetchInstagramPosts('https://instagram.com/bar');

    expect(posts).toHaveLength(2);
    expect(mockSociavaultGet).toHaveBeenCalledTimes(2);
    expect(mockSociavaultGet.mock.calls[1][1]).toMatchObject({ next_max_id: 'cursor_1' });
  });

  it('stops pagination when posts are older than 60 days', async () => {
    const oldTimestamp = Math.floor((CUTOFF - 86400000) / 1000); // 61 days ago

    mockSociavaultGet.mockResolvedValue(
      wrapResponse([
        makeItem({ code: 'NEW' }),
        makeItem({ code: 'OLD', taken_at: oldTimestamp }),
      ], true, 'cursor_next')
    );

    const posts = await fetchInstagramPosts('https://instagram.com/bar');

    expect(posts).toHaveLength(1);
    expect(posts[0].code).toBe('NEW');
    expect(mockSociavaultGet).toHaveBeenCalledTimes(1);
  });

  it('handles null captions (image-only posts)', async () => {
    mockSociavaultGet.mockResolvedValue(
      wrapResponse([makeItem({ caption: null })])
    );

    const posts = await fetchInstagramPosts('https://instagram.com/bar');
    expect(posts).toHaveLength(1);
    expect(posts[0].caption).toBeNull();
  });

  it('returns empty array when no items returned', async () => {
    mockSociavaultGet.mockResolvedValue(wrapResponse([]));

    const posts = await fetchInstagramPosts('https://instagram.com/emptybar');
    expect(posts).toHaveLength(0);
  });

  it('throws on invalid URL', async () => {
    await expect(fetchInstagramPosts('not-a-url')).rejects.toThrow(
      'Could not extract Instagram username'
    );
  });

  it('throws when SociaVault API fails', async () => {
    mockSociavaultGet.mockRejectedValue(new Error('SociaVault /instagram/posts failed (401): Invalid API key'));

    await expect(fetchInstagramPosts('https://instagram.com/bar')).rejects.toThrow('SociaVault');
  });
});

describe('formatInstagramContent', () => {
  it('formats posts with captions into text', () => {
    const posts: InstagramPost[] = [
      { id: '1', code: 'A', caption: 'Happy Hour 3-6pm!', timestamp: '2026-03-20T18:00:00.000Z', takenAt: 0, mediaType: 1, permalink: '', likeCount: 0, commentCount: 0, imageUrl: null },
      { id: '2', code: 'B', caption: 'Taco Tuesday $2 tacos', timestamp: '2026-03-19T12:00:00.000Z', takenAt: 0, mediaType: 1, permalink: '', likeCount: 0, commentCount: 0, imageUrl: null },
    ];

    const content = formatInstagramContent(posts);
    expect(content).toContain('Post 1');
    expect(content).toContain('Happy Hour 3-6pm!');
    expect(content).toContain('Post 2');
    expect(content).toContain('Taco Tuesday $2 tacos');
  });

  it('filters out posts without deal keywords', () => {
    const posts: InstagramPost[] = [
      { id: '1', code: 'A', caption: null, timestamp: '2026-03-20T18:00:00.000Z', takenAt: 0, mediaType: 1, permalink: '', likeCount: 0, commentCount: 0, imageUrl: null },
      { id: '2', code: 'B', caption: '$5 wells happy hour', timestamp: '2026-03-19T12:00:00.000Z', takenAt: 0, mediaType: 1, permalink: '', likeCount: 0, commentCount: 0, imageUrl: null },
    ];

    const content = formatInstagramContent(posts);
    expect(content).toContain('$5 wells happy hour');
    expect(content).not.toContain('Post 2');
  });

  it('returns empty string when no posts have captions', () => {
    const posts: InstagramPost[] = [
      { id: '1', code: 'A', caption: null, timestamp: '2026-03-20T18:00:00.000Z', takenAt: 0, mediaType: 1, permalink: '', likeCount: 0, commentCount: 0, imageUrl: null },
    ];
    expect(formatInstagramContent(posts)).toBe('');
  });
});
