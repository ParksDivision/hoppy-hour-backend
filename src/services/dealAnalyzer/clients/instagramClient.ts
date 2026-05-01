import { sociavaultGet, getCutoffTimestamp } from '../../sociavault/client';
import { sociavaultConfig } from '../../../config/sociavault';
import { extractProfileSlug } from '../../socialScraper/patterns';
import { logger } from '../../../utils/logger';
import { likelyContainsDeal, shortDate } from '../contentFilters';
import type { InstagramPost } from '../types';

/** SociaVault Instagram posts response shape */
interface SociavaultInstagramResponse {
  success: boolean;
  data: {
    next_max_id: string | null;
    more_available: boolean;
    num_results: number;
    user: { pk: string; username: string; full_name: string };
    items: Record<
      string,
      {
        pk: string;
        id: string;
        code: string;
        media_type: number;
        caption: { text: string; created_at_utc: number } | null;
        like_count: number;
        comment_count: number;
        taken_at: number;
        image_versions2?: { candidates: Array<{ url: string; width: number; height: number }> };
      }
    >;
  };
  credits_used: number;
}

/**
 * Extract Instagram username from a profile URL.
 */
export function extractInstagramUsername(url: string): string | null {
  return extractProfileSlug(url);
}

/**
 * Fetch recent Instagram posts for a business via SociaVault.
 * If `since` is provided (from a previous fetch), only returns posts newer than that date.
 * Otherwise fetches up to 60 days of history.
 */
export async function fetchInstagramPosts(instagramUrl: string, since?: Date | null): Promise<InstagramPost[]> {
  const handle = extractInstagramUsername(instagramUrl);
  if (!handle) {
    throw new Error(`Could not extract Instagram username from URL: ${instagramUrl}`);
  }

  // Use the last fetch time if available, otherwise 60-day window
  const cutoff = since ? since.getTime() : getCutoffTimestamp();

  logger.debug({ handle, instagramUrl, incremental: !!since }, 'Fetching Instagram posts via SociaVault');
  const allPosts: InstagramPost[] = [];
  let cursor: string | undefined;
  let page = 0;

  while (page < sociavaultConfig.maxPages) {
    const response = await sociavaultGet<SociavaultInstagramResponse>(
      '/instagram/posts',
      { handle, next_max_id: cursor }
    );

    if (!response.data?.items) {
      logger.warn({ handle }, 'SociaVault returned no items for Instagram — account may be private or not found');
      break;
    }
    const items = Object.values(response.data.items);
    if (items.length === 0) break;

    let hitCutoff = false;

    for (const item of items) {
      const takenAtMs = item.taken_at * 1000;

      if (takenAtMs < cutoff) {
        hitCutoff = true;
        break;
      }

      allPosts.push({
        id: item.id,
        code: item.code,
        caption: item.caption?.text ?? null,
        timestamp: new Date(takenAtMs).toISOString(),
        takenAt: item.taken_at,
        mediaType: item.media_type,
        permalink: `https://www.instagram.com/p/${item.code}/`,
        likeCount: item.like_count ?? 0,
        commentCount: item.comment_count ?? 0,
        imageUrl: item.image_versions2?.candidates?.[0]?.url ?? null,
      });
    }

    if (hitCutoff || !response.data?.more_available || !response.data?.next_max_id) break;

    cursor = response.data.next_max_id;
    page++;
  }

  logger.debug({ handle, postCount: allPosts.length, pages: page + 1 }, 'Fetched Instagram posts');
  return allPosts;
}

/**
 * Format Instagram posts into a text string for Claude analysis.
 */
export function formatInstagramContent(posts: InstagramPost[]): string {
  const withCaptions = posts.filter((p) => p.caption);

  if (withCaptions.length === 0) {
    return '';
  }

  const formatted = withCaptions.map((post, i) =>
    `--- Post ${i + 1} (${shortDate(post.timestamp)}) ---\n${post.caption}`
  );

  return formatted.join('\n\n');
}

