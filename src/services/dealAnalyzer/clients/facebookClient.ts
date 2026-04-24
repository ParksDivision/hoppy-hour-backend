import { sociavaultGet, getCutoffTimestamp } from '../../sociavault/client';
import { sociavaultConfig } from '../../../config/sociavault';
import { extractProfileSlug } from '../../socialScraper/patterns';
import { logger } from '../../../utils/logger';
import { likelyContainsDeal, shortDate } from '../contentFilters';
import type { FacebookPost } from '../types';

/** SociaVault Facebook profile-posts response shape */
interface SociavaultFacebookResponse {
  success: boolean;
  data: {
    posts: Array<{
      id: string;
      text: string | null;
      url: string;
      permalink: string;
      author: { name: string; id: string };
      reactionCount: number;
      commentCount: number;
      publishTime: number;
      image: string | null;
    }>;
    cursor: string | null;
  };
  credits_used: number;
}

/**
 * Extract Facebook page slug from a profile URL.
 */
/** Facebook paths that are not business pages — skip these */
const EXCLUDED_FB_PATHS = [
  'tr', 'sharer', 'share', 'dialog', 'login', 'watch', 'groups',
  'marketplace', 'gaming', 'events', 'help', 'settings', 'policies',
  'privacy', 'terms', 'ads', 'business', 'developers', 'pages',
  'flx', 'hashtag', 'stories', 'reel', 'photo', 'video',
];

export function extractFacebookPageSlug(url: string): string | null {
  const slug = extractProfileSlug(url);
  if (!slug) return null;
  if (EXCLUDED_FB_PATHS.includes(slug.toLowerCase())) return null;
  // Skip numeric-only slugs that are too short (tracking IDs, not page IDs)
  if (/^\d+$/.test(slug) && slug.length < 6) return null;
  return slug;
}

/**
 * Fetch recent Facebook page posts (up to 60 days) via SociaVault.
 * Paginates automatically until the cutoff date or max pages is reached.
 */
export async function fetchFacebookPosts(facebookUrl: string, since?: Date | null): Promise<FacebookPost[]> {
  const pageSlug = extractFacebookPageSlug(facebookUrl);
  if (!pageSlug) {
    throw new Error(`Could not extract Facebook page slug from URL: ${facebookUrl}`);
  }

  const cutoff = since ? since.getTime() : getCutoffTimestamp();

  logger.debug({ pageSlug, facebookUrl, incremental: !!since }, 'Fetching Facebook page posts via SociaVault');
  const allPosts: FacebookPost[] = [];
  let cursor: string | undefined;
  let page = 0;

  while (page < sociavaultConfig.maxPages) {
    const response = await sociavaultGet<SociavaultFacebookResponse>(
      '/facebook/profile/posts',
      { url: facebookUrl, cursor }
    );

    const posts = Array.isArray(response.data?.posts) ? response.data.posts : [];
    if (posts.length === 0) break;

    let hitCutoff = false;

    for (const post of posts) {
      const publishTimeMs = post.publishTime * 1000;

      if (publishTimeMs < cutoff) {
        hitCutoff = true;
        break;
      }

      allPosts.push({
        id: post.id,
        message: post.text ?? null,
        createdTime: new Date(publishTimeMs).toISOString(),
        publishTime: post.publishTime,
        url: post.url || post.permalink,
        reactionCount: post.reactionCount ?? 0,
        commentCount: post.commentCount ?? 0,
        imageUrl: post.image ?? null,
      });
    }

    if (hitCutoff || !response.data?.cursor) break;

    cursor = response.data.cursor;
    page++;
  }

  logger.debug({ pageSlug, postCount: allPosts.length, pages: page + 1 }, 'Fetched Facebook posts');
  return allPosts;
}

/**
 * Format Facebook posts into a text string for Claude analysis.
 */
export function formatFacebookContent(posts: FacebookPost[]): string {
  const relevant = posts.filter((p) => likelyContainsDeal(p.message));

  if (relevant.length === 0) {
    return '';
  }

  const formatted = relevant.map((post, i) =>
    `--- Post ${i + 1} (${shortDate(post.createdTime)}) ---\n${post.message}`
  );

  return formatted.join('\n\n');
}

