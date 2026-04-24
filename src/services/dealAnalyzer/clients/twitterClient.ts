import { sociavaultGet, getCutoffTimestamp } from '../../sociavault/client';
import { sociavaultConfig } from '../../../config/sociavault';
import { extractProfileSlug } from '../../socialScraper/patterns';
import { logger } from '../../../utils/logger';
import { likelyContainsDeal, shortDate } from '../contentFilters';
import type { Tweet } from '../types';

/** SociaVault Twitter profile response shape */
interface SociavaultTwitterProfileResponse {
  success: boolean;
  data: {
    rest_id: string;
    legacy: { screen_name: string; name: string };
  };
  credits_used: number;
}

/** SociaVault Twitter user-tweets-all response shape */
interface SociavaultTwitterTweetsResponse {
  success: boolean;
  data: {
    cursor: { bottom: string; top: string } | null;
    result: {
      timeline: {
        instructions: Array<{
          type: string;
          entries?: Array<{
            content: {
              entryType: string;
              itemContent?: {
                tweet_results?: {
                  result?: {
                    rest_id: string;
                    legacy: {
                      full_text: string;
                      created_at: string;
                      favorite_count: number;
                      retweet_count: number;
                      reply_count: number;
                      quote_count: number;
                      entities?: {
                        media?: Array<{ media_url_https: string; type: string }>;
                      };
                    };
                    views?: { count: string };
                    note_tweet?: {
                      note_tweet_results: {
                        result: { text: string };
                      };
                    };
                  };
                };
              };
            };
          }>;
        }>;
      };
    };
  };
  credits_used: number;
}

/**
 * Extract Twitter/X username from a profile URL.
 */
export function extractTwitterUsername(url: string): string | null {
  return extractProfileSlug(url);
}

/**
 * Parse Twitter's date format "Thu Mar 20 22:00:00 +0000 2026" to milliseconds.
 */
function parseTwitterDate(dateStr: string): number {
  return new Date(dateStr).getTime();
}

/**
 * Extract tweet objects from the deeply nested SociaVault timeline response.
 */
function extractTweetsFromTimeline(
  response: SociavaultTwitterTweetsResponse,
  cutoff: number
): { tweets: Tweet[]; hitCutoff: boolean } {
  const tweets: Tweet[] = [];
  let hitCutoff = false;

  if (!response.data?.result?.timeline?.instructions) {
    logger.warn('SociaVault returned no timeline instructions for Twitter — account may be private or suspended');
    return { tweets: [], hitCutoff: true };
  }
  const instructions = response.data.result.timeline.instructions;
  for (const instruction of instructions) {
    if (instruction.type !== 'TimelineAddEntries' || !instruction.entries) continue;

    for (const entry of instruction.entries) {
      const tweetResult = entry.content?.itemContent?.tweet_results?.result;
      if (!tweetResult?.legacy) continue;

      const createdAtMs = parseTwitterDate(tweetResult.legacy.created_at);

      if (createdAtMs < cutoff) {
        hitCutoff = true;
        break;
      }

      // Prefer note_tweet for full text of long tweets, fall back to legacy.full_text
      const text =
        tweetResult.note_tweet?.note_tweet_results?.result?.text ??
        tweetResult.legacy.full_text;

      tweets.push({
        id: tweetResult.rest_id,
        text,
        createdAt: new Date(createdAtMs).toISOString(),
        createdAtMs,
        likeCount: tweetResult.legacy.favorite_count ?? 0,
        retweetCount: tweetResult.legacy.retweet_count ?? 0,
        replyCount: tweetResult.legacy.reply_count ?? 0,
        viewCount: tweetResult.views?.count ? parseInt(tweetResult.views.count, 10) : null,
        imageUrl: tweetResult.legacy.entities?.media?.[0]?.media_url_https ?? null,
      });
    }

    if (hitCutoff) break;
  }

  return { tweets, hitCutoff };
}

/**
 * Resolve a Twitter username to its numeric user ID via SociaVault profile endpoint.
 */
async function resolveUserId(handle: string): Promise<string> {
  const response = await sociavaultGet<SociavaultTwitterProfileResponse>(
    '/twitter/profile',
    { handle }
  );

  const userId = response.data?.rest_id;
  if (!userId) {
    throw new Error(`Could not resolve Twitter user ID for: @${handle}`);
  }

  return userId;
}

/**
 * Fetch recent tweets for a user via SociaVault.
 * If `since` is provided, only returns tweets newer than that date.
 * Otherwise fetches up to 60 days of history.
 */
export async function fetchTwitterPosts(twitterUrl: string, since?: Date | null): Promise<Tweet[]> {
  const username = extractTwitterUsername(twitterUrl);
  if (!username) {
    throw new Error(`Could not extract Twitter username from URL: ${twitterUrl}`);
  }

  const userId = await resolveUserId(username);
  const cutoff = since ? since.getTime() : getCutoffTimestamp();

  logger.debug({ username, twitterUrl, incremental: !!since }, 'Fetching tweets via SociaVault');
  const allTweets: Tweet[] = [];
  let cursor: string | undefined;
  let page = 0;

  while (page < sociavaultConfig.maxPages) {
    const response = await sociavaultGet<SociavaultTwitterTweetsResponse>(
      '/twitter/user-tweets-all',
      { user_id: userId, cursor }
    );

    const { tweets, hitCutoff } = extractTweetsFromTimeline(response, cutoff);
    allTweets.push(...tweets);

    if (hitCutoff || !response.data.cursor?.bottom) break;

    cursor = response.data.cursor.bottom;
    page++;
  }

  logger.debug({ username, tweetCount: allTweets.length, pages: page + 1 }, 'Fetched tweets');
  return allTweets;
}

/**
 * Format tweets into a text string for Claude analysis.
 */
export function formatTwitterContent(tweets: Tweet[]): string {
  const relevant = tweets.filter((t) => likelyContainsDeal(t.text));

  if (relevant.length === 0) {
    return '';
  }

  const formatted = relevant.map((tweet, i) =>
    `--- Tweet ${i + 1} (${shortDate(tweet.createdAt)}) ---\n${tweet.text}`
  );

  return formatted.join('\n\n');
}
