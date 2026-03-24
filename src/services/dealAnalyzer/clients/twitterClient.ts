import axios from 'axios';
import { twitterConfig } from '../../../config/twitter';
import { extractProfileSlug } from '../../socialScraper/patterns';
import { logger } from '../../../utils/logger';
import type { Tweet } from '../types';

const twitterApi = axios.create({
  baseURL: twitterConfig.apiBaseUrl,
  timeout: twitterConfig.timeout,
  headers: {
    Authorization: `Bearer ${twitterConfig.bearerToken}`,
  },
});

/**
 * Extract Twitter/X username from a profile URL.
 * e.g. "https://x.com/somebar" → "somebar"
 */
export function extractTwitterUsername(url: string): string | null {
  return extractProfileSlug(url);
}

/**
 * Resolve a Twitter username to its numeric user ID.
 */
async function resolveUserId(username: string): Promise<string> {
  const response = await twitterApi.get(`/2/users/by/username/${username}`, {
    params: {
      'user.fields': 'id,name',
    },
  });

  const userId = response.data?.data?.id;
  if (!userId) {
    throw new Error(`Could not resolve Twitter user ID for: @${username}`);
  }

  return userId;
}

/**
 * Fetch recent tweets from a user's timeline.
 *
 * Requires TWITTER_BEARER_TOKEN (X API v2 Basic tier or higher for timeline access).
 */
export async function fetchTwitterPosts(twitterUrl: string): Promise<Tweet[]> {
  const username = extractTwitterUsername(twitterUrl);
  if (!username) {
    throw new Error(`Could not extract Twitter username from URL: ${twitterUrl}`);
  }

  if (!twitterConfig.bearerToken) {
    throw new Error('TWITTER_BEARER_TOKEN is not configured');
  }

  logger.debug({ username, twitterUrl }, 'Fetching tweets');

  // Resolve username to user ID
  const userId = await resolveUserId(username);

  // Fetch tweets
  const response = await twitterApi.get(`/2/users/${userId}/tweets`, {
    params: {
      max_results: twitterConfig.tweetsPerRequest,
      'tweet.fields': 'created_at,text',
    },
  });

  const tweetsData = response.data?.data ?? [];

  const tweets: Tweet[] = tweetsData.map((tweet: Record<string, unknown>) => ({
    text: tweet.text as string,
    createdAt: tweet.created_at as string,
  }));

  logger.debug({ username, tweetCount: tweets.length }, 'Fetched tweets');
  return tweets;
}

/**
 * Format tweets into a text string for Claude analysis.
 */
export function formatTwitterContent(tweets: Tweet[]): string {
  if (tweets.length === 0) {
    return '';
  }

  const formatted = tweets.map((tweet, i) => {
    const date = new Date(tweet.createdAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `--- Tweet ${i + 1} (${date}) ---\n${tweet.text}`;
  });

  return formatted.join('\n\n');
}
