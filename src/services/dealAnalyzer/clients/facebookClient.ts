import axios from 'axios';
import { metaConfig } from '../../../config/meta';
import { extractProfileSlug } from '../../socialScraper/patterns';
import { logger } from '../../../utils/logger';
import type { FacebookPost } from '../types';

const graphApi = axios.create({
  baseURL: `${metaConfig.graphApiBaseUrl}/${metaConfig.graphApiVersion}`,
  timeout: metaConfig.timeout,
});

/**
 * Extract Facebook page slug from a profile URL.
 * e.g. "https://www.facebook.com/somebar/" → "somebar"
 */
export function extractFacebookPageSlug(url: string): string | null {
  return extractProfileSlug(url);
}

/**
 * Resolve a Facebook page slug to its numeric page ID.
 */
async function resolvePageId(pageSlug: string): Promise<string> {
  if (!metaConfig.accessToken) {
    throw new Error('META_ACCESS_TOKEN is not configured');
  }

  const response = await graphApi.get(`/${pageSlug}`, {
    params: {
      fields: 'id,name',
      access_token: metaConfig.accessToken,
    },
  });

  const pageId = response.data?.id;
  if (!pageId) {
    throw new Error(`Could not resolve Facebook page ID for: ${pageSlug}`);
  }

  return pageId;
}

/**
 * Fetch recent Facebook page posts.
 *
 * Requires META_ACCESS_TOKEN with pages_read_engagement permission.
 */
export async function fetchFacebookPosts(facebookUrl: string): Promise<FacebookPost[]> {
  const pageSlug = extractFacebookPageSlug(facebookUrl);
  if (!pageSlug) {
    throw new Error(`Could not extract Facebook page slug from URL: ${facebookUrl}`);
  }

  if (!metaConfig.accessToken) {
    throw new Error('META_ACCESS_TOKEN is not configured');
  }

  logger.debug({ pageSlug, facebookUrl }, 'Fetching Facebook page posts');

  // Resolve page slug to ID
  const pageId = await resolvePageId(pageSlug);

  // Fetch posts
  const response = await graphApi.get(`/${pageId}/posts`, {
    params: {
      fields: 'message,created_time',
      limit: metaConfig.postsPerRequest,
      access_token: metaConfig.accessToken,
    },
  });

  const postsData = response.data?.data ?? [];

  const posts: FacebookPost[] = postsData.map((post: Record<string, unknown>) => ({
    message: (post.message as string) ?? null,
    createdTime: post.created_time as string,
  }));

  logger.debug({ pageSlug, postCount: posts.length }, 'Fetched Facebook posts');
  return posts;
}

/**
 * Format Facebook posts into a text string for Claude analysis.
 */
export function formatFacebookContent(posts: FacebookPost[]): string {
  const postsWithMessage = posts.filter((p) => p.message);

  if (postsWithMessage.length === 0) {
    return '';
  }

  const formatted = postsWithMessage.map((post, i) => {
    const date = new Date(post.createdTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `--- Post ${i + 1} (${date}) ---\n${post.message}`;
  });

  return formatted.join('\n\n');
}
