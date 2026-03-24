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

vi.mock('../../../config/twitter', () => ({
  twitterConfig: {
    bearerToken: 'test-bearer-token',
    apiBaseUrl: 'https://api.x.com',
    tweetsPerRequest: 100,
    timeout: 30000,
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  extractTwitterUsername,
  fetchTwitterPosts,
  formatTwitterContent,
} from '../clients/twitterClient';
import type { Tweet } from '../types';

describe('extractTwitterUsername', () => {
  it('extracts username from x.com URL', () => {
    expect(extractTwitterUsername('https://x.com/somebar')).toBe('somebar');
  });

  it('extracts username from twitter.com URL', () => {
    expect(extractTwitterUsername('https://twitter.com/somebar')).toBe('somebar');
  });

  it('returns null for invalid URL', () => {
    expect(extractTwitterUsername('not-a-url')).toBeNull();
  });
});

describe('fetchTwitterPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves user ID then fetches tweets', async () => {
    // First call: resolve user ID
    mockAxiosGet.mockResolvedValueOnce({
      data: { data: { id: '987654321', name: 'Some Bar' } },
    });
    // Second call: fetch tweets
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            text: 'Happy Hour starting NOW! $3 wells until 7pm',
            created_at: '2026-03-20T22:00:00.000Z',
          },
          {
            text: 'Taco Tuesday every week! $2 tacos all day',
            created_at: '2026-03-19T17:00:00.000Z',
          },
        ],
      },
    });

    const tweets = await fetchTwitterPosts('https://x.com/somebar');

    expect(tweets).toHaveLength(2);
    expect(tweets[0].text).toBe('Happy Hour starting NOW! $3 wells until 7pm');
    expect(tweets[1].text).toBe('Taco Tuesday every week! $2 tacos all day');
    expect(mockAxiosGet).toHaveBeenCalledTimes(2);
  });

  it('returns empty array when user has no tweets', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { data: { id: '123' } } });
    mockAxiosGet.mockResolvedValueOnce({ data: {} });

    const tweets = await fetchTwitterPosts('https://x.com/somebar');
    expect(tweets).toHaveLength(0);
  });

  it('throws when username cannot be extracted', async () => {
    await expect(fetchTwitterPosts('not-a-url')).rejects.toThrow(
      'Could not extract Twitter username'
    );
  });

  it('throws when user ID cannot be resolved', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: {} });

    await expect(fetchTwitterPosts('https://x.com/nonexistent')).rejects.toThrow(
      'Could not resolve Twitter user ID'
    );
  });
});

describe('formatTwitterContent', () => {
  it('formats tweets into text', () => {
    const tweets: Tweet[] = [
      { text: 'Happy Hour 4-7pm!', createdAt: '2026-03-20T22:00:00.000Z' },
      { text: '$5 margs today', createdAt: '2026-03-19T17:00:00.000Z' },
    ];

    const content = formatTwitterContent(tweets);
    expect(content).toContain('Tweet 1');
    expect(content).toContain('Happy Hour 4-7pm!');
    expect(content).toContain('Tweet 2');
    expect(content).toContain('$5 margs today');
  });

  it('returns empty string for empty array', () => {
    expect(formatTwitterContent([])).toBe('');
  });
});
