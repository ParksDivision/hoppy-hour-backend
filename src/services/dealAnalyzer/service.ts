import { z } from 'zod';
import anthropicClient from './aiClient';
import { anthropicConfig } from '../../config/anthropic';
import { fetchAndCleanWebsite } from './htmlCleaner';
import {
  DEAL_EXTRACTION_SYSTEM_PROMPT,
  DEAL_EXTRACTION_USER_PROMPT,
  CURRENT_PROMPT_VERSION,
} from './prompts';
import { logger } from '../../utils/logger';
import type { DealAnalysisResult, ExtractedDeal } from './types';

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

const MIN_CONTENT_LENGTH = 50;

/**
 * Analyze a website for happy hour deals and specials using Claude API.
 */
export async function analyzeWebsiteForDeals(
  websiteUrl: string,
  options?: { model?: string; promptVersion?: string }
): Promise<DealAnalysisResult> {
  const startTime = Date.now();
  const model = options?.model ?? anthropicConfig.defaultModel;
  const promptVersion = options?.promptVersion ?? CURRENT_PROMPT_VERSION;

  try {
    // Step 1: Fetch and clean website content
    const { cleanedText, originalLength, truncated } = await fetchAndCleanWebsite(websiteUrl);

    logger.debug(
      { websiteUrl, originalLength, truncated, cleanedLength: cleanedText.length },
      'Cleaned website content for deal analysis'
    );

    // Step 2: Check if content is too short to be meaningful
    if (cleanedText.length < MIN_CONTENT_LENGTH) {
      return {
        sourceUrl: websiteUrl,
        sourceType: 'website',
        status: 'no_deals',
        deals: [],
        rawAiResponse: null,
        aiModel: model,
        promptVersion,
        errorMessage: 'Content too short for analysis',
        durationMs: Date.now() - startTime,
      };
    }

    // Step 3: Call Claude API with structured output
    const response = await anthropicClient.messages.create({
      model,
      max_tokens: anthropicConfig.maxTokens,
      system: DEAL_EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: DEAL_EXTRACTION_USER_PROMPT(cleanedText),
        },
      ],
    });

    // Step 4: Parse the response
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
        { websiteUrl, rawText: rawText.slice(0, 500), error: parseError },
        'Failed to parse Claude deal extraction response'
      );
    }

    const status = parseError ? 'failed' : deals.length > 0 ? 'success' : 'no_deals';

    return {
      sourceUrl: websiteUrl,
      sourceType: 'website',
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

    logger.error({ websiteUrl, error: errorMessage }, 'Deal analysis failed');

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
