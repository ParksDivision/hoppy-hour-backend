import prisma from '../utils/database';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import type { InstagramPost, FacebookPost, Tweet } from '../services/dealAnalyzer/types';

/**
 * Get the last successful fetch timestamp for a platform + business.
 * Returns null if never fetched before (triggers full 45-day fetch).
 */
export const getLastFetchedAt = async (
  platform: 'instagram' | 'facebook' | 'twitter',
  googleRawBusinessId: string
): Promise<Date | null> => {
  try {
    const model = platform === 'instagram'
      ? prisma.instagramRawData
      : platform === 'facebook'
        ? prisma.facebookRawData
        : prisma.twitterRawData;

    const row = await (model as typeof prisma.instagramRawData).findUnique({
      where: { googleRawBusinessId },
      select: { fetchedAt: true, fetchStatus: true },
    });

    if (row?.fetchStatus === 'success' && row.fetchedAt) {
      return row.fetchedAt;
    }
    return null;
  } catch (error) {
    logger.error({ error, platform, googleRawBusinessId }, 'Failed to get last fetchedAt');
    return null;
  }
};

/**
 * Merge new posts with existing posts, deduplicating by ID.
 * Keeps new posts when IDs collide (most recent data wins).
 */
function mergePostsById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const post of existing) map.set(post.id, post);
  for (const post of incoming) map.set(post.id, post); // incoming overwrites
  return Array.from(map.values());
}

export const upsertInstagramRawData = async (
  data: {
    googleRawBusinessId: string;
    profileUrl: string;
    username: string | null;
    posts: InstagramPost[];
    fetchStatus: 'success' | 'error' | 'empty';
    errorMessage?: string | null;
  },
  createdBy: string = 'system'
) => {
  try {
    const now = new Date();

    // Merge with existing posts to avoid losing historical data on incremental fetches
    const existing = await prisma.instagramRawData.findUnique({
      where: { googleRawBusinessId: data.googleRawBusinessId },
      select: { posts: true },
    });
    const existingPosts = Array.isArray(existing?.posts) ? (existing.posts as unknown as InstagramPost[]) : [];
    const mergedPosts = data.posts.length > 0 ? mergePostsById(existingPosts, data.posts) : existingPosts;
    const posts = (mergedPosts.length > 0 ? mergedPosts : Prisma.JsonNull) as unknown as Prisma.InputJsonValue;

    const result = await prisma.instagramRawData.upsert({
      where: { googleRawBusinessId: data.googleRawBusinessId },
      create: {
        googleRawBusinessId: data.googleRawBusinessId,
        profileUrl: data.profileUrl,
        username: data.username,
        posts,
        postCount: mergedPosts.length,
        fetchStatus: data.fetchStatus,
        errorMessage: data.errorMessage ?? null,
        fetchedAt: now,
        createdOn: now,
        createdBy,
        updatedOn: now,
        updatedBy: createdBy,
      },
      update: {
        profileUrl: data.profileUrl,
        username: data.username,
        posts,
        postCount: mergedPosts.length,
        fetchStatus: data.fetchStatus,
        errorMessage: data.errorMessage ?? null,
        fetchedAt: now,
        updatedOn: now,
        updatedBy: createdBy,
      },
    });

    logger.debug(
      { businessId: data.googleRawBusinessId, newPosts: data.posts.length, totalPosts: mergedPosts.length, fetchStatus: data.fetchStatus },
      'Upserted Instagram raw data'
    );

    return result;
  } catch (error) {
    logger.error({ error, businessId: data.googleRawBusinessId }, 'Failed to upsert Instagram raw data');
    throw error;
  }
};

export const upsertFacebookRawData = async (
  data: {
    googleRawBusinessId: string;
    profileUrl: string;
    pageSlug: string | null;
    posts: FacebookPost[];
    fetchStatus: 'success' | 'error' | 'empty';
    errorMessage?: string | null;
  },
  createdBy: string = 'system'
) => {
  try {
    const now = new Date();

    const existing = await prisma.facebookRawData.findUnique({
      where: { googleRawBusinessId: data.googleRawBusinessId },
      select: { posts: true },
    });
    const existingPosts = Array.isArray(existing?.posts) ? (existing.posts as unknown as FacebookPost[]) : [];
    const mergedPosts = data.posts.length > 0 ? mergePostsById(existingPosts, data.posts) : existingPosts;
    const posts = (mergedPosts.length > 0 ? mergedPosts : Prisma.JsonNull) as unknown as Prisma.InputJsonValue;

    const result = await prisma.facebookRawData.upsert({
      where: { googleRawBusinessId: data.googleRawBusinessId },
      create: {
        googleRawBusinessId: data.googleRawBusinessId,
        profileUrl: data.profileUrl,
        pageSlug: data.pageSlug,
        posts,
        postCount: mergedPosts.length,
        fetchStatus: data.fetchStatus,
        errorMessage: data.errorMessage ?? null,
        fetchedAt: now,
        createdOn: now,
        createdBy,
        updatedOn: now,
        updatedBy: createdBy,
      },
      update: {
        profileUrl: data.profileUrl,
        pageSlug: data.pageSlug,
        posts,
        postCount: mergedPosts.length,
        fetchStatus: data.fetchStatus,
        errorMessage: data.errorMessage ?? null,
        fetchedAt: now,
        updatedOn: now,
        updatedBy: createdBy,
      },
    });

    logger.debug(
      { businessId: data.googleRawBusinessId, newPosts: data.posts.length, totalPosts: mergedPosts.length, fetchStatus: data.fetchStatus },
      'Upserted Facebook raw data'
    );

    return result;
  } catch (error) {
    logger.error({ error, businessId: data.googleRawBusinessId }, 'Failed to upsert Facebook raw data');
    throw error;
  }
};

export const upsertTwitterRawData = async (
  data: {
    googleRawBusinessId: string;
    profileUrl: string;
    username: string | null;
    tweets: Tweet[];
    fetchStatus: 'success' | 'error' | 'empty';
    errorMessage?: string | null;
  },
  createdBy: string = 'system'
) => {
  try {
    const now = new Date();

    const existing = await prisma.twitterRawData.findUnique({
      where: { googleRawBusinessId: data.googleRawBusinessId },
      select: { tweets: true },
    });
    const existingTweets = Array.isArray(existing?.tweets) ? (existing.tweets as unknown as Tweet[]) : [];
    const mergedTweets = data.tweets.length > 0 ? mergePostsById(existingTweets, data.tweets) : existingTweets;
    const tweets = (mergedTweets.length > 0 ? mergedTweets : Prisma.JsonNull) as unknown as Prisma.InputJsonValue;

    const result = await prisma.twitterRawData.upsert({
      where: { googleRawBusinessId: data.googleRawBusinessId },
      create: {
        googleRawBusinessId: data.googleRawBusinessId,
        profileUrl: data.profileUrl,
        username: data.username,
        tweets,
        tweetCount: mergedTweets.length,
        fetchStatus: data.fetchStatus,
        errorMessage: data.errorMessage ?? null,
        fetchedAt: now,
        createdOn: now,
        createdBy,
        updatedOn: now,
        updatedBy: createdBy,
      },
      update: {
        profileUrl: data.profileUrl,
        username: data.username,
        tweets,
        tweetCount: mergedTweets.length,
        fetchStatus: data.fetchStatus,
        errorMessage: data.errorMessage ?? null,
        fetchedAt: now,
        updatedOn: now,
        updatedBy: createdBy,
      },
    });

    logger.debug(
      { businessId: data.googleRawBusinessId, newTweets: data.tweets.length, totalTweets: mergedTweets.length, fetchStatus: data.fetchStatus },
      'Upserted Twitter raw data'
    );

    return result;
  } catch (error) {
    logger.error({ error, businessId: data.googleRawBusinessId }, 'Failed to upsert Twitter raw data');
    throw error;
  }
};
