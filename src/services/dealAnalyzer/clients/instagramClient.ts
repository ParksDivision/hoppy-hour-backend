import axios from 'axios';
import { metaConfig } from '../../../config/meta';
import { extractProfileSlug } from '../../socialScraper/patterns';
import { logger } from '../../../utils/logger';
import type { InstagramPost } from '../types';

const graphApi = axios.create({
  baseURL: `${metaConfig.graphApiBaseUrl}/${metaConfig.graphApiVersion}`,
  timeout: metaConfig.timeout,
});

/**
 * Extract Instagram username from a profile URL.
 * e.g. "https://www.instagram.com/barname/" → "barname"
 */
export function extractInstagramUsername(url: string): string | null {
  return extractProfileSlug(url);
}

/**
 * Fetch recent Instagram posts for a business via the Business Discovery API.
 *
 * Requires:
 * - META_ACCESS_TOKEN: a long-lived Meta User Access Token
 * - INSTAGRAM_BUSINESS_ACCOUNT_ID: your own IG Business Account ID
 */
export async function fetchInstagramPosts(instagramUrl: string): Promise<InstagramPost[]> {
  const username = extractInstagramUsername(instagramUrl);
  if (!username) {
    throw new Error(`Could not extract Instagram username from URL: ${instagramUrl}`);
  }

  if (!metaConfig.accessToken) {
    throw new Error('META_ACCESS_TOKEN is not configured');
  }

  if (!metaConfig.instagramBusinessAccountId) {
    throw new Error('INSTAGRAM_BUSINESS_ACCOUNT_ID is not configured');
  }

  logger.debug({ username, instagramUrl }, 'Fetching Instagram posts via Business Discovery');

  const response = await graphApi.get(`/${metaConfig.instagramBusinessAccountId}`, {
    params: {
      fields: `business_discovery.fields(username,name,media.limit(${metaConfig.postsPerRequest}){caption,timestamp,media_type,permalink})`,
      access_token: metaConfig.accessToken,
    },
    // The username is passed as part of the fields query via business_discovery
    // We need to add username filter — the API uses this format:
    // /{ig-user-id}?fields=business_discovery.fields(...)&access_token=...
    // with the target username embedded in the endpoint
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // The Business Discovery API nests the response:
  // response.data.business_discovery.media.data = [...]
  const businessDiscovery = response.data?.business_discovery;
  if (!businessDiscovery) {
    logger.warn(
      { username },
      'No business discovery data returned — account may be private or not a business account'
    );
    return [];
  }

  const mediaData = businessDiscovery.media?.data ?? [];

  const posts: InstagramPost[] = mediaData.map((post: Record<string, unknown>) => ({
    caption: (post.caption as string) ?? null,
    timestamp: post.timestamp as string,
    mediaType: post.media_type as string,
    permalink: post.permalink as string,
  }));

  logger.debug({ username, postCount: posts.length }, 'Fetched Instagram posts');
  return posts;
}

/**
 * Format Instagram posts into a text string for Claude analysis.
 */
export function formatInstagramContent(posts: InstagramPost[]): string {
  const postsWithCaptions = posts.filter((p) => p.caption);

  if (postsWithCaptions.length === 0) {
    return '';
  }

  const formatted = postsWithCaptions.map((post, i) => {
    const date = new Date(post.timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `--- Post ${i + 1} (${date}) ---\n${post.caption}`;
  });

  return formatted.join('\n\n');
}
