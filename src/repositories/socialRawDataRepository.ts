import prisma from '../utils/database';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import type { InstagramPost, FacebookPost, Tweet } from '../services/dealAnalyzer/types';

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
    const posts = (data.posts.length > 0 ? data.posts : Prisma.JsonNull) as Prisma.InputJsonValue;

    const result = await prisma.instagramRawData.upsert({
      where: { googleRawBusinessId: data.googleRawBusinessId },
      create: {
        googleRawBusinessId: data.googleRawBusinessId,
        profileUrl: data.profileUrl,
        username: data.username,
        posts,
        postCount: data.posts.length,
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
        postCount: data.posts.length,
        fetchStatus: data.fetchStatus,
        errorMessage: data.errorMessage ?? null,
        fetchedAt: now,
        updatedOn: now,
        updatedBy: createdBy,
      },
    });

    logger.debug(
      { businessId: data.googleRawBusinessId, postCount: data.posts.length, fetchStatus: data.fetchStatus },
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
    const posts = (data.posts.length > 0 ? data.posts : Prisma.JsonNull) as Prisma.InputJsonValue;

    const result = await prisma.facebookRawData.upsert({
      where: { googleRawBusinessId: data.googleRawBusinessId },
      create: {
        googleRawBusinessId: data.googleRawBusinessId,
        profileUrl: data.profileUrl,
        pageSlug: data.pageSlug,
        posts,
        postCount: data.posts.length,
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
        postCount: data.posts.length,
        fetchStatus: data.fetchStatus,
        errorMessage: data.errorMessage ?? null,
        fetchedAt: now,
        updatedOn: now,
        updatedBy: createdBy,
      },
    });

    logger.debug(
      { businessId: data.googleRawBusinessId, postCount: data.posts.length, fetchStatus: data.fetchStatus },
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
    const tweets = (data.tweets.length > 0 ? data.tweets : Prisma.JsonNull) as Prisma.InputJsonValue;

    const result = await prisma.twitterRawData.upsert({
      where: { googleRawBusinessId: data.googleRawBusinessId },
      create: {
        googleRawBusinessId: data.googleRawBusinessId,
        profileUrl: data.profileUrl,
        username: data.username,
        tweets,
        tweetCount: data.tweets.length,
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
        tweetCount: data.tweets.length,
        fetchStatus: data.fetchStatus,
        errorMessage: data.errorMessage ?? null,
        fetchedAt: now,
        updatedOn: now,
        updatedBy: createdBy,
      },
    });

    logger.debug(
      { businessId: data.googleRawBusinessId, tweetCount: data.tweets.length, fetchStatus: data.fetchStatus },
      'Upserted Twitter raw data'
    );

    return result;
  } catch (error) {
    logger.error({ error, businessId: data.googleRawBusinessId }, 'Failed to upsert Twitter raw data');
    throw error;
  }
};
