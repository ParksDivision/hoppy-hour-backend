import { z } from 'zod';
import anthropicClient from './aiClient';
import { anthropicConfig } from '../../config/anthropic';
import {
  DEAL_COMPARISON_SYSTEM_PROMPT,
  DEAL_COMPARISON_USER_PROMPT,
} from './prompts';
import { logger } from '../../utils/logger';
import type { AggregatedDeals, DealSourceType, ExtractedDeal } from './types';

/** Zod schema — reused from service.ts for validation */
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

interface DealDataRow {
  sourceType: string;
  sourceUrl: string | null;
  deals: unknown;
  analysisStatus: string | null;
  analyzedAt: Date | null;
}

const SOCIAL_SOURCES: DealSourceType[] = ['instagram', 'facebook', 'twitter'];

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'X (Twitter)',
};

/**
 * Build a human-readable text block summarizing all deals from all sources,
 * including source type and analysis date for Claude to reason about recency.
 */
function buildComparisonInput(rows: DealDataRow[]): string {
  const sections: string[] = [];

  for (const row of rows) {
    const deals = Array.isArray(row.deals) ? (row.deals as ExtractedDeal[]) : [];
    if (deals.length === 0) continue;

    const label = SOURCE_LABELS[row.sourceType] ?? row.sourceType;
    const date = row.analyzedAt
      ? row.analyzedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'unknown date';

    sections.push(
      `=== Source: ${label} (analyzed ${date}) ===\n` +
      JSON.stringify(deals, null, 2)
    );
  }

  return sections.join('\n\n');
}

/**
 * Determine which source should be labeled as primary based on what has deals.
 * Social sources preferred over website; most recent social source wins.
 */
function determinePrimarySource(rows: DealDataRow[]): DealSourceType {
  const socialWithDeals = rows
    .filter((r) => SOCIAL_SOURCES.includes(r.sourceType as DealSourceType))
    .filter((r) => r.analysisStatus === 'success' && Array.isArray(r.deals) && (r.deals as unknown[]).length > 0)
    .sort((a, b) => (b.analyzedAt?.getTime() ?? 0) - (a.analyzedAt?.getTime() ?? 0));

  if (socialWithDeals.length > 0) {
    return socialWithDeals[0]!.sourceType as DealSourceType;
  }

  return 'website';
}

/**
 * Aggregate deals across all sources for a single business using Claude
 * for semantic deduplication and conflict resolution.
 *
 * Falls back to deterministic merge if Claude call fails.
 */
export async function aggregateBusinessDeals(
  businessId: string,
  rows: DealDataRow[]
): Promise<AggregatedDeals> {
  const sourceBreakdown = rows.map((row) => {
    const deals = Array.isArray(row.deals) ? (row.deals as ExtractedDeal[]) : [];
    return {
      sourceType: row.sourceType as DealSourceType,
      dealCount: deals.length,
      analyzedAt: row.analyzedAt?.toISOString() ?? null,
      status: row.analysisStatus ?? 'unknown',
    };
  });

  // Collect all rows that have deals
  const rowsWithDeals = rows.filter(
    (r) => r.analysisStatus === 'success' && Array.isArray(r.deals) && (r.deals as unknown[]).length > 0
  );

  // No deals from any source
  if (rowsWithDeals.length === 0) {
    return { businessId, primarySource: 'website', deals: [], sourceBreakdown };
  }

  // Only one source has deals — no comparison needed
  if (rowsWithDeals.length === 1) {
    const row = rowsWithDeals[0]!;
    return {
      businessId,
      primarySource: row.sourceType as DealSourceType,
      deals: row.deals as ExtractedDeal[],
      sourceBreakdown,
    };
  }

  const primarySource = determinePrimarySource(rows);

  // Multiple sources have deals — use Claude to compare and merge
  const comparisonInput = buildComparisonInput(rowsWithDeals);

  try {
    const response = await anthropicClient.messages.create({
      model: anthropicConfig.defaultModel,
      max_tokens: anthropicConfig.maxTokens,
      system: DEAL_COMPARISON_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: DEAL_COMPARISON_USER_PROMPT(comparisonInput),
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const rawText = textBlock?.type === 'text' ? textBlock.text : '';

    // Parse Claude's merged deal list
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
    const parsed = JSON.parse(jsonStr);

    const validated = Array.isArray(parsed)
      ? z.array(ExtractedDealSchema).parse(parsed)
      : z.array(ExtractedDealSchema).parse(parsed.deals ?? []);

    logger.info(
      {
        businessId,
        inputSources: rowsWithDeals.length,
        inputDeals: rowsWithDeals.reduce((sum, r) => sum + (r.deals as unknown[]).length, 0),
        outputDeals: validated.length,
      },
      'Claude merged deals across sources'
    );

    return { businessId, primarySource, deals: validated, sourceBreakdown };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { businessId, error: errorMessage },
      'Claude deal comparison failed, falling back to deterministic merge'
    );

    // Fallback: flatten all deals from most recent source first
    return fallbackMerge(businessId, rowsWithDeals, primarySource, sourceBreakdown);
  }
}

/**
 * Deterministic fallback if Claude comparison fails.
 * Takes all deals from all sources, most recent source first, basic title dedup.
 */
function fallbackMerge(
  businessId: string,
  rowsWithDeals: DealDataRow[],
  primarySource: DealSourceType,
  sourceBreakdown: AggregatedDeals['sourceBreakdown']
): AggregatedDeals {
  const sorted = [...rowsWithDeals].sort(
    (a, b) => (b.analyzedAt?.getTime() ?? 0) - (a.analyzedAt?.getTime() ?? 0)
  );

  const seen = new Set<string>();
  const mergedDeals: ExtractedDeal[] = [];

  for (const row of sorted) {
    const deals = row.deals as ExtractedDeal[];
    for (const deal of deals) {
      const key = `${deal.dealType}|${deal.title.toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        mergedDeals.push(deal);
      }
    }
  }

  return { businessId, primarySource, deals: mergedDeals, sourceBreakdown };
}
