import { z } from 'zod';
import anthropicClient from './aiClient';
import { anthropicConfig } from '../../config/anthropic';
import { fetchAndCleanWebsite } from './htmlCleaner';
import {
  DEAL_EXTRACTION_SYSTEM_PROMPT,
  DEAL_EXTRACTION_USER_PROMPT,
  SOCIAL_MEDIA_USER_PROMPT,
  CURRENT_PROMPT_VERSION,
} from './prompts';
import { logger } from '../../utils/logger';
import { fetchInstagramPosts, formatInstagramContent } from './clients/instagramClient';
import { fetchFacebookPosts, formatFacebookContent } from './clients/facebookClient';
import { fetchTwitterPosts, formatTwitterContent } from './clients/twitterClient';
import {
  upsertInstagramRawData,
  upsertFacebookRawData,
  upsertTwitterRawData,
  getLastFetchedAt,
} from '../../repositories/socialRawDataRepository';
import type { DealAnalysisResult, DealSourceType, ExtractedDeal } from './types';

/** Zod schema for Claude's structured output */
const DealItemSchema = z.object({
  item: z.string(),
  price: z.string().nullable(),
  description: z.string().nullable(),
});

const ExtractedDealSchema = z.object({
  dealType: z.enum(['happy_hour', 'daily_special', 'limited_time', 'brunch', 'late_night']),
  title: z.string(),
  description: z.string(),
  daysOfWeek: z.array(z.string()),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  drinkDeals: z.array(DealItemSchema),
  foodDeals: z.array(DealItemSchema),
});

const DealExtractionResponseSchema = z.object({
  deals: z.array(ExtractedDealSchema),
});

const MIN_CONTENT_LENGTH_WEBSITE = 50;
const MIN_CONTENT_LENGTH_SOCIAL = 15;

/**
 * Shared core: analyze text content for deals using Claude API.
 * Claude only receives text — never external image URLs.
 * Raw social media data (including images) is stored in DB tables separately.
 */
export async function analyzeContentForDeals(
  content: string,
  userPrompt: string,
  sourceType: DealSourceType,
  sourceUrl: string,
  options?: { model?: string; promptVersion?: string }
): Promise<DealAnalysisResult> {
  const startTime = Date.now();
  const model = options?.model ?? anthropicConfig.defaultModel;
  const promptVersion = options?.promptVersion ?? CURRENT_PROMPT_VERSION;

  try {
    const minLength = sourceType === 'website' ? MIN_CONTENT_LENGTH_WEBSITE : MIN_CONTENT_LENGTH_SOCIAL;
    if (content.length < minLength) {
      return {
        sourceUrl,
        sourceType,
        status: 'no_deals',
        deals: [],
        rawAiResponse: null,
        aiModel: model,
        promptVersion,
        errorMessage: 'Content too short for analysis',
        durationMs: Date.now() - startTime,
      };
    }

    const response = await anthropicClient.messages.create({
      model,
      max_tokens: anthropicConfig.maxTokens,
      system: DEAL_EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Parse the response
    const textBlock = response.content.find((block) => block.type === 'text');
    const rawText = textBlock?.type === 'text' ? textBlock.text : '';

    let deals: ExtractedDeal[] = [];
    let parseError: string | undefined;

    try {
      // Try to parse the JSON from Claude's response
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
      const parsed = JSON.parse(jsonStr);

      // Validate with Zod — handle both { deals: [...] } and plain array
      if (Array.isArray(parsed)) {
        const validated = z.array(ExtractedDealSchema).parse(parsed);
        deals = validated;
      } else {
        const validated = DealExtractionResponseSchema.parse(parsed);
        deals = validated.deals;
      }
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
      logger.warn(
        { sourceUrl, sourceType, rawText: rawText.slice(0, 500), error: parseError },
        'Failed to parse Claude deal extraction response'
      );
    }

    const status = parseError ? 'failed' : deals.length > 0 ? 'success' : 'no_deals';

    return {
      sourceUrl,
      sourceType,
      status,
      deals,
      rawAiResponse: { content: rawText, usage: response.usage },
      aiModel: model,
      promptVersion,
      errorMessage: parseError,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout =
      error instanceof Error &&
      (errorMessage.includes('timeout') || errorMessage.includes('ECONNABORTED'));

    logger.error({ sourceUrl, sourceType, error: errorMessage }, 'Deal analysis failed');

    return {
      sourceUrl,
      sourceType,
      status: isTimeout ? 'failed' : 'error',
      deals: [],
      rawAiResponse: null,
      aiModel: model,
      promptVersion,
      errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Analyze a website for happy hour deals and specials.
 */
export async function analyzeWebsiteForDeals(
  websiteUrl: string,
  options?: { model?: string; promptVersion?: string }
): Promise<DealAnalysisResult> {
  const startTime = Date.now();
  const model = options?.model ?? anthropicConfig.defaultModel;
  const promptVersion = options?.promptVersion ?? CURRENT_PROMPT_VERSION;

  try {
    const { cleanedText, originalLength, truncated } = await fetchAndCleanWebsite(websiteUrl);

    logger.debug(
      { websiteUrl, originalLength, truncated, cleanedLength: cleanedText.length },
      'Cleaned website content for deal analysis'
    );

    return analyzeContentForDeals(
      cleanedText,
      DEAL_EXTRACTION_USER_PROMPT(cleanedText),
      'website',
      websiteUrl,
      options
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout =
      error instanceof Error &&
      (errorMessage.includes('timeout') || errorMessage.includes('ECONNABORTED'));

    logger.error({ websiteUrl, error: errorMessage }, 'Website deal analysis failed');

    return {
      sourceUrl: websiteUrl,
      sourceType: 'website',
      status: isTimeout ? 'failed' : 'error',
      deals: [],
      rawAiResponse: null,
      aiModel: model,
      promptVersion,
      errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Analyze Instagram posts for happy hour deals and specials.
 */
export async function analyzeInstagramForDeals(
  instagramUrl: string,
  options?: { model?: string; promptVersion?: string; googleRawBusinessId?: string; requestedBy?: string }
): Promise<DealAnalysisResult> {
  const startTime = Date.now();
  const model = options?.model ?? anthropicConfig.defaultModel;
  const promptVersion = options?.promptVersion ?? CURRENT_PROMPT_VERSION;

  try {
    // Incremental fetch: only get posts newer than last successful fetch
    const since = options?.googleRawBusinessId
      ? await getLastFetchedAt('instagram', options.googleRawBusinessId)
      : null;
    const posts = await fetchInstagramPosts(instagramUrl, since);

    if (options?.googleRawBusinessId) {
      await upsertInstagramRawData(
        {
          googleRawBusinessId: options.googleRawBusinessId,
          profileUrl: instagramUrl,
          username: posts.length > 0 ? instagramUrl.split('/').filter(Boolean).pop() ?? null : null,
          posts,
          fetchStatus: posts.length > 0 ? 'success' : 'empty',
        },
        options.requestedBy ?? 'system'
      );
    }

    const content = formatInstagramContent(posts);

    logger.debug(
      { instagramUrl, postCount: posts.length, contentLength: content.length },
      'Formatted Instagram content for deal analysis'
    );

    return analyzeContentForDeals(
      content,
      SOCIAL_MEDIA_USER_PROMPT('instagram', content),
      'instagram',
      instagramUrl,
      options
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ instagramUrl, error: errorMessage }, 'Instagram deal analysis failed');

    if (options?.googleRawBusinessId) {
      await upsertInstagramRawData(
        {
          googleRawBusinessId: options.googleRawBusinessId,
          profileUrl: instagramUrl,
          username: null,
          posts: [],
          fetchStatus: 'error',
          errorMessage,
        },
        options.requestedBy ?? 'system'
      ).catch(() => {}); // don't mask the original error
    }

    return {
      sourceUrl: instagramUrl,
      sourceType: 'instagram',
      status: 'error',
      deals: [],
      rawAiResponse: null,
      aiModel: model,
      promptVersion,
      errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Analyze Facebook page posts for happy hour deals and specials.
 */
export async function analyzeFacebookForDeals(
  facebookUrl: string,
  options?: { model?: string; promptVersion?: string; googleRawBusinessId?: string; requestedBy?: string }
): Promise<DealAnalysisResult> {
  const startTime = Date.now();
  const model = options?.model ?? anthropicConfig.defaultModel;
  const promptVersion = options?.promptVersion ?? CURRENT_PROMPT_VERSION;

  try {
    const since = options?.googleRawBusinessId
      ? await getLastFetchedAt('facebook', options.googleRawBusinessId)
      : null;
    const posts = await fetchFacebookPosts(facebookUrl, since);

    if (options?.googleRawBusinessId) {
      await upsertFacebookRawData(
        {
          googleRawBusinessId: options.googleRawBusinessId,
          profileUrl: facebookUrl,
          pageSlug: facebookUrl.split('/').filter(Boolean).pop() ?? null,
          posts,
          fetchStatus: posts.length > 0 ? 'success' : 'empty',
        },
        options.requestedBy ?? 'system'
      );
    }

    const content = formatFacebookContent(posts);

    logger.debug(
      { facebookUrl, postCount: posts.length, contentLength: content.length },
      'Formatted Facebook content for deal analysis'
    );

    return analyzeContentForDeals(
      content,
      SOCIAL_MEDIA_USER_PROMPT('facebook', content),
      'facebook',
      facebookUrl,
      options
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ facebookUrl, error: errorMessage }, 'Facebook deal analysis failed');

    if (options?.googleRawBusinessId) {
      await upsertFacebookRawData(
        {
          googleRawBusinessId: options.googleRawBusinessId,
          profileUrl: facebookUrl,
          pageSlug: null,
          posts: [],
          fetchStatus: 'error',
          errorMessage,
        },
        options.requestedBy ?? 'system'
      ).catch(() => {});
    }

    return {
      sourceUrl: facebookUrl,
      sourceType: 'facebook',
      status: 'error',
      deals: [],
      rawAiResponse: null,
      aiModel: model,
      promptVersion,
      errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Analyze tweets for happy hour deals and specials.
 */
export async function analyzeTwitterForDeals(
  twitterUrl: string,
  options?: { model?: string; promptVersion?: string; googleRawBusinessId?: string; requestedBy?: string }
): Promise<DealAnalysisResult> {
  const startTime = Date.now();
  const model = options?.model ?? anthropicConfig.defaultModel;
  const promptVersion = options?.promptVersion ?? CURRENT_PROMPT_VERSION;

  try {
    const since = options?.googleRawBusinessId
      ? await getLastFetchedAt('twitter', options.googleRawBusinessId)
      : null;
    const tweets = await fetchTwitterPosts(twitterUrl, since);

    if (options?.googleRawBusinessId) {
      await upsertTwitterRawData(
        {
          googleRawBusinessId: options.googleRawBusinessId,
          profileUrl: twitterUrl,
          username: twitterUrl.split('/').filter(Boolean).pop() ?? null,
          tweets,
          fetchStatus: tweets.length > 0 ? 'success' : 'empty',
        },
        options.requestedBy ?? 'system'
      );
    }

    const content = formatTwitterContent(tweets);

    logger.debug(
      { twitterUrl, tweetCount: tweets.length, contentLength: content.length },
      'Formatted Twitter content for deal analysis'
    );

    return analyzeContentForDeals(
      content,
      SOCIAL_MEDIA_USER_PROMPT('twitter', content),
      'twitter',
      twitterUrl,
      options
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ twitterUrl, error: errorMessage }, 'Twitter deal analysis failed');

    if (options?.googleRawBusinessId) {
      await upsertTwitterRawData(
        {
          googleRawBusinessId: options.googleRawBusinessId,
          profileUrl: twitterUrl,
          username: null,
          tweets: [],
          fetchStatus: 'error',
          errorMessage,
        },
        options.requestedBy ?? 'system'
      ).catch(() => {});
    }

    return {
      sourceUrl: twitterUrl,
      sourceType: 'twitter',
      status: 'error',
      deals: [],
      rawAiResponse: null,
      aiModel: model,
      promptVersion,
      errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}
