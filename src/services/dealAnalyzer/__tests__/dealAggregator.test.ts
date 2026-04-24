import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtractedDeal } from '../types';

const { mockMessagesCreate } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
}));

vi.mock('../aiClient', () => ({
  default: {
    messages: {
      create: mockMessagesCreate,
    },
  },
}));

vi.mock('../../../config/anthropic', () => ({
  anthropicConfig: {
    defaultModel: 'claude-sonnet-4-6',
    maxTokens: 4096,
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { aggregateBusinessDeals } from '../dealAggregator';

const HH_DEAL: ExtractedDeal = {
  dealType: 'happy_hour',
  title: 'Happy Hour',
  description: '$3 wells 4-7pm',
  daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  startTime: '16:00',
  endTime: '19:00',
  startDate: null,
  endDate: null,
  drinkDeals: [{ item: 'Well drinks', price: '$3', description: null }],
  foodDeals: [],
};

const TACO_DEAL: ExtractedDeal = {
  dealType: 'daily_special',
  title: 'Taco Tuesday',
  description: '$2 tacos all day',
  daysOfWeek: ['tuesday'],
  startTime: null,
  endTime: null,
  startDate: null,
  endDate: null,
  drinkDeals: [],
  foodDeals: [{ item: 'Tacos', price: '$2', description: null }],
};

function makeRow(overrides: {
  sourceType: string;
  deals?: ExtractedDeal[];
  status?: string;
  analyzedAt?: Date;
}) {
  return {
    sourceType: overrides.sourceType,
    sourceUrl: `https://example.com/${overrides.sourceType}`,
    deals: overrides.deals ?? [],
    analysisStatus: overrides.status ?? 'success',
    analyzedAt: overrides.analyzedAt ?? new Date('2026-03-20T00:00:00Z'),
  };
}

function mockClaudeResponse(deals: ExtractedDeal[]) {
  mockMessagesCreate.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(deals) }],
    usage: { input_tokens: 100, output_tokens: 200 },
  });
}

describe('aggregateBusinessDeals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty deals when no source has deals', async () => {
    const result = await aggregateBusinessDeals('biz-1', [
      makeRow({ sourceType: 'website', deals: [], status: 'no_deals' }),
      makeRow({ sourceType: 'instagram', deals: [], status: 'no_deals' }),
    ]);

    expect(result.deals).toHaveLength(0);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('returns deals directly when only one source has deals (no Claude call)', async () => {
    const result = await aggregateBusinessDeals('biz-1', [
      makeRow({ sourceType: 'instagram', deals: [TACO_DEAL] }),
      makeRow({ sourceType: 'website', deals: [], status: 'no_deals' }),
    ]);

    expect(result.primarySource).toBe('instagram');
    expect(result.deals).toEqual([TACO_DEAL]);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('calls Claude to merge when multiple sources have deals', async () => {
    const mergedDeal = { ...HH_DEAL, description: 'Claude merged version' };
    mockClaudeResponse([mergedDeal, TACO_DEAL]);

    const result = await aggregateBusinessDeals('biz-1', [
      makeRow({ sourceType: 'website', deals: [HH_DEAL] }),
      makeRow({ sourceType: 'instagram', deals: [TACO_DEAL] }),
    ]);

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    expect(result.deals).toHaveLength(2);
    expect(result.deals[0].description).toBe('Claude merged version');
  });

  it('sends source labels and dates in the comparison prompt', async () => {
    mockClaudeResponse([HH_DEAL]);

    await aggregateBusinessDeals('biz-1', [
      makeRow({ sourceType: 'website', deals: [HH_DEAL], analyzedAt: new Date('2026-03-15T00:00:00Z') }),
      makeRow({ sourceType: 'instagram', deals: [HH_DEAL], analyzedAt: new Date('2026-03-20T00:00:00Z') }),
    ]);

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content as string;
    expect(userContent).toContain('Website');
    expect(userContent).toContain('Instagram');
    expect(userContent).toContain('March');
    expect(userContent).toContain('2026');
  });

  it('prefers social source as primarySource when social has deals', async () => {
    mockClaudeResponse([HH_DEAL]);

    const result = await aggregateBusinessDeals('biz-1', [
      makeRow({ sourceType: 'website', deals: [HH_DEAL] }),
      makeRow({ sourceType: 'instagram', deals: [TACO_DEAL], analyzedAt: new Date('2026-03-20T00:00:00Z') }),
    ]);

    expect(result.primarySource).toBe('instagram');
  });

  it('falls back to deterministic merge when Claude fails', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('Rate limit exceeded'));

    const result = await aggregateBusinessDeals('biz-1', [
      makeRow({ sourceType: 'website', deals: [HH_DEAL] }),
      makeRow({ sourceType: 'instagram', deals: [TACO_DEAL] }),
    ]);

    // Fallback should still return deals
    expect(result.deals.length).toBeGreaterThan(0);
    expect(result.deals.map((d) => d.title).sort()).toEqual(['Happy Hour', 'Taco Tuesday']);
  });

  it('includes sourceBreakdown for all sources', async () => {
    mockClaudeResponse([TACO_DEAL]);

    const result = await aggregateBusinessDeals('biz-1', [
      makeRow({ sourceType: 'website', deals: [HH_DEAL] }),
      makeRow({ sourceType: 'instagram', deals: [TACO_DEAL] }),
      makeRow({ sourceType: 'facebook', deals: [], status: 'error' }),
    ]);

    expect(result.sourceBreakdown).toHaveLength(3);
    expect(result.sourceBreakdown.find((s) => s.sourceType === 'facebook')?.status).toBe('error');
  });

  it('handles empty input', async () => {
    const result = await aggregateBusinessDeals('biz-1', []);

    expect(result.deals).toHaveLength(0);
    expect(result.primarySource).toBe('website');
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });
});
