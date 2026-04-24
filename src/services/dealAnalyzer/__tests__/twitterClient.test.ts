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
  extractTwitterUsername,
  fetchTwitterPosts,
  formatTwitterContent,
} from '../clients/twitterClient';
import type { Tweet } from '../types';

const CUTOFF = Date.now() - 60 * 24 * 60 * 60 * 1000;
const RECENT_DATE = 'Mon Mar 23 18:00:00 +0000 2026';
const OLD_DATE = 'Mon Jan 01 00:00:00 +0000 2026';

function makeProfileResponse(restId = '12345') {
  return {
    success: true,
    data: { rest_id: restId, legacy: { screen_name: 'testbar', name: 'Test Bar' } },
    credits_used: 1,
  };
}

function makeTweetEntry(overrides: Partial<{ id: string; text: string; createdAt: string; likeCount: number; noteText: string }> = {}) {
  return {
    content: {
      entryType: 'TimelineTimelineItem',
      itemContent: {
        tweet_results: {
          result: {
            rest_id: overrides.id ?? 'tweet-1',
            legacy: {
              full_text: overrides.text ?? 'Happy Hour NOW! $3 wells until 7pm',
              created_at: overrides.createdAt ?? RECENT_DATE,
              favorite_count: overrides.likeCount ?? 100,
              retweet_count: 10,
              reply_count: 5,
              quote_count: 2,
            },
            views: { count: '5000' },
            ...(overrides.noteText
              ? { note_tweet: { note_tweet_results: { result: { text: overrides.noteText } } } }
              : {}),
          },
        },
      },
    },
  };
}

function wrapTweetsResponse(entries: unknown[], cursorBottom: string | null = null) {
  return {
    success: true,
    data: {
      cursor: cursorBottom ? { bottom: cursorBottom, top: 'top_cursor' } : null,
      result: {
        timeline: {
          instructions: [
            {
              type: 'TimelineAddEntries',
              entries,
            },
          ],
        },
      },
    },
    credits_used: 1,
  };
}

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
    mockGetCutoff.mockReturnValue(CUTOFF);
  });

  it('resolves user ID then fetches tweets', async () => {
    mockSociavaultGet
      .mockResolvedValueOnce(makeProfileResponse('99999'))
      .mockResolvedValueOnce(wrapTweetsResponse([
        makeTweetEntry({ id: 't1', text: 'Happy Hour special!' }),
        makeTweetEntry({ id: 't2', text: 'Taco Tuesday!' }),
      ]));

    const tweets = await fetchTwitterPosts('https://x.com/somebar');

    expect(tweets).toHaveLength(2);
    expect(tweets[0].text).toBe('Happy Hour special!');
    expect(tweets[0].likeCount).toBe(100);
    expect(tweets[0].viewCount).toBe(5000);
    expect(tweets[1].text).toBe('Taco Tuesday!');

    // First call: resolve handle → user_id
    expect(mockSociavaultGet.mock.calls[0]).toEqual(['/twitter/profile', { handle: 'somebar' }]);
    // Second call: fetch tweets with user_id
    expect(mockSociavaultGet.mock.calls[1][0]).toBe('/twitter/user-tweets-all');
    expect(mockSociavaultGet.mock.calls[1][1]).toMatchObject({ user_id: '99999' });
  });

  it('prefers note_tweet for long tweet text', async () => {
    mockSociavaultGet
      .mockResolvedValueOnce(makeProfileResponse())
      .mockResolvedValueOnce(wrapTweetsResponse([
        makeTweetEntry({ text: 'Truncated...', noteText: 'This is the full untruncated long tweet text with all the details' }),
      ]));

    const tweets = await fetchTwitterPosts('https://x.com/bar');

    expect(tweets[0].text).toBe('This is the full untruncated long tweet text with all the details');
  });

  it('paginates using cursor.bottom', async () => {
    mockSociavaultGet
      .mockResolvedValueOnce(makeProfileResponse())
      .mockResolvedValueOnce(wrapTweetsResponse([makeTweetEntry({ id: 't1' })], 'cursor_page2'))
      .mockResolvedValueOnce(wrapTweetsResponse([makeTweetEntry({ id: 't2' })]));

    const tweets = await fetchTwitterPosts('https://x.com/bar');

    expect(tweets).toHaveLength(2);
    expect(mockSociavaultGet).toHaveBeenCalledTimes(3); // profile + 2 tweet pages
    expect(mockSociavaultGet.mock.calls[2][1]).toMatchObject({ cursor: 'cursor_page2' });
  });

  it('stops pagination when tweets are older than 60 days', async () => {
    mockSociavaultGet
      .mockResolvedValueOnce(makeProfileResponse())
      .mockResolvedValueOnce(wrapTweetsResponse(
        [
          makeTweetEntry({ id: 'recent', createdAt: RECENT_DATE }),
          makeTweetEntry({ id: 'old', createdAt: OLD_DATE }),
        ],
        'cursor_next'
      ));

    const tweets = await fetchTwitterPosts('https://x.com/bar');

    expect(tweets).toHaveLength(1);
    expect(tweets[0].id).toBe('recent');
    // Should NOT make a third call because we hit the cutoff
    expect(mockSociavaultGet).toHaveBeenCalledTimes(2);
  });

  it('returns empty array when user has no tweets', async () => {
    mockSociavaultGet
      .mockResolvedValueOnce(makeProfileResponse())
      .mockResolvedValueOnce(wrapTweetsResponse([]));

    const tweets = await fetchTwitterPosts('https://x.com/emptybar');
    expect(tweets).toHaveLength(0);
  });

  it('throws when username cannot be extracted', async () => {
    await expect(fetchTwitterPosts('not-a-url')).rejects.toThrow(
      'Could not extract Twitter username'
    );
  });

  it('throws when user ID cannot be resolved', async () => {
    mockSociavaultGet.mockResolvedValueOnce({
      success: true,
      data: { rest_id: undefined },
      credits_used: 1,
    });

    await expect(fetchTwitterPosts('https://x.com/nonexistent')).rejects.toThrow(
      'Could not resolve Twitter user ID'
    );
  });

  it('throws when SociaVault API fails', async () => {
    mockSociavaultGet.mockRejectedValue(new Error('SociaVault /twitter/profile failed (401): Invalid API key'));

    await expect(fetchTwitterPosts('https://x.com/bar')).rejects.toThrow('SociaVault');
  });
});

describe('formatTwitterContent', () => {
  it('formats tweets into text', () => {
    const tweets: Tweet[] = [
      { id: '1', text: 'Happy Hour 4-7pm!', createdAt: '2026-03-20T22:00:00.000Z', createdAtMs: 0, likeCount: 0, retweetCount: 0, replyCount: 0, viewCount: null },
      { id: '2', text: '$5 margs today', createdAt: '2026-03-19T17:00:00.000Z', createdAtMs: 0, likeCount: 0, retweetCount: 0, replyCount: 0, viewCount: null },
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
