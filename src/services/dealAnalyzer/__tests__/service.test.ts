import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions
const { mockAxiosGet, mockMessagesCreate } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockMessagesCreate: vi.fn(),
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockAxiosGet,
    })),
  },
}));

// Mock Anthropic SDK
vi.mock('../aiClient', () => ({
  default: {
    messages: {
      create: mockMessagesCreate,
    },
  },
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock config
vi.mock('../../../config/anthropic', () => ({
  anthropicConfig: {
    apiKey: 'test-key',
    defaultModel: 'claude-sonnet-4-6',
    maxTokens: 4096,
    timeout: 60000,
  },
}));

import { analyzeWebsiteForDeals } from '../service';

/** Helper to wrap text in HTML that yields >50 chars after cleaning */
const html = (text: string) =>
  `<html><body><main><p>${text}</p></main></body></html>`;

const SAMPLE_DEAL_RESPONSE = JSON.stringify([
  {
    dealType: 'happy_hour',
    title: 'Happy Hour',
    description: 'Half price drinks and apps',
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    startTime: '15:00',
    endTime: '18:00',
    startDate: null,
    endDate: null,
    drinkDeals: [{ item: 'Well drinks', price: '$3', description: 'Half price' }],
    foodDeals: [{ item: 'Wings', price: '$5', description: 'Half price basket' }],
  },
]);

describe('analyzeWebsiteForDeals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns deals when Claude finds them', async () => {
    mockAxiosGet.mockResolvedValue({
      data: html('Happy Hour Monday through Friday from 3pm to 6pm. Enjoy $3 well drinks and $5 wings all evening long.'),
    });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: SAMPLE_DEAL_RESPONSE }],
      usage: { input_tokens: 100, output_tokens: 200 },
    });

    const result = await analyzeWebsiteForDeals('https://testbar.com');

    expect(result.status).toBe('success');
    expect(result.deals).toHaveLength(1);
    expect(result.deals[0].dealType).toBe('happy_hour');
    expect(result.deals[0].drinkDeals).toHaveLength(1);
    expect(result.deals[0].foodDeals).toHaveLength(1);
    expect(result.aiModel).toBe('claude-sonnet-4-6');
    expect(result.sourceType).toBe('website');
  });

  it('returns no_deals when Claude finds none', async () => {
    mockAxiosGet.mockResolvedValue({
      data: '<html><body><main><p>Welcome to our bar. Check out our menu.</p></main></body></html>',
    });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
      usage: { input_tokens: 50, output_tokens: 10 },
    });

    const result = await analyzeWebsiteForDeals('https://nospecials.com');

    expect(result.status).toBe('no_deals');
    expect(result.deals).toHaveLength(0);
  });

  it('returns no_deals when content is too short', async () => {
    mockAxiosGet.mockResolvedValue({
      data: '<html><body><p>Hi</p></body></html>',
    });

    const result = await analyzeWebsiteForDeals('https://empty.com');

    expect(result.status).toBe('no_deals');
    expect(result.deals).toHaveLength(0);
    expect(result.errorMessage).toContain('too short');
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('handles Claude response wrapped in { deals: [...] }', async () => {
    mockAxiosGet.mockResolvedValue({
      data: html('Taco Tuesday special every week. Get $2 tacos all day long with our famous salsa.'),
    });

    const wrappedResponse = JSON.stringify({
      deals: [
        {
          dealType: 'daily_special',
          title: 'Taco Tuesday',
          description: '$2 tacos all day',
          daysOfWeek: ['tuesday'],
          startTime: null,
          endTime: null,
          startDate: null,
          endDate: null,
          drinkDeals: [],
          foodDeals: [{ item: 'Tacos', price: '$2', description: 'All day' }],
        },
      ],
    });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: wrappedResponse }],
      usage: { input_tokens: 80, output_tokens: 150 },
    });

    const result = await analyzeWebsiteForDeals('https://tacobar.com');

    expect(result.status).toBe('success');
    expect(result.deals).toHaveLength(1);
    expect(result.deals[0].title).toBe('Taco Tuesday');
  });

  it('handles failed JSON parse from Claude', async () => {
    mockAxiosGet.mockResolvedValue({
      data: html('Some content about happy hour specials and daily food and drink deals available'),
    });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Sorry, I could not find any deals on this page.' }],
      usage: { input_tokens: 50, output_tokens: 20 },
    });

    const result = await analyzeWebsiteForDeals('https://badparse.com');

    expect(result.status).toBe('failed');
    expect(result.deals).toHaveLength(0);
    expect(result.errorMessage).toBeDefined();
  });

  it('handles HTTP fetch error', async () => {
    mockAxiosGet.mockRejectedValue(new Error('Connection refused'));

    const result = await analyzeWebsiteForDeals('https://down.com');

    expect(result.status).toBe('error');
    expect(result.deals).toHaveLength(0);
    expect(result.errorMessage).toContain('Connection refused');
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('handles timeout error', async () => {
    mockAxiosGet.mockRejectedValue(new Error('timeout of 10000ms exceeded'));

    const result = await analyzeWebsiteForDeals('https://slow.com');

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('timeout');
  });

  it('handles Claude API error', async () => {
    mockAxiosGet.mockResolvedValue({
      data: '<html><body><main><p>Real content with deals and specials here for analysis</p></main></body></html>',
    });

    mockMessagesCreate.mockRejectedValue(new Error('Rate limit exceeded'));

    const result = await analyzeWebsiteForDeals('https://ratelimited.com');

    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('Rate limit exceeded');
  });

  it('passes correct parameters to Claude API', async () => {
    mockAxiosGet.mockResolvedValue({
      data: '<html><body><main><p>Happy Hour specials Monday through Friday from three to six pm</p></main></body></html>',
    });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
      usage: { input_tokens: 50, output_tokens: 10 },
    });

    await analyzeWebsiteForDeals('https://testbar.com');

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-6');
    expect(callArgs.max_tokens).toBe(4096);
    expect(callArgs.system).toBeDefined();
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0].role).toBe('user');
  });

  it('uses custom model when provided', async () => {
    mockAxiosGet.mockResolvedValue({
      data: '<html><body><main><p>Enough content here to trigger analysis with Claude API model</p></main></body></html>',
    });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
      usage: { input_tokens: 50, output_tokens: 10 },
    });

    const result = await analyzeWebsiteForDeals('https://test.com', {
      model: 'claude-opus-4-6',
    });

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-opus-4-6');
    expect(result.aiModel).toBe('claude-opus-4-6');
  });

  it('tracks duration in result', async () => {
    mockAxiosGet.mockResolvedValue({
      data: '<html><body><main><p>Some content for deal analysis and checking durations</p></main></body></html>',
    });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
      usage: { input_tokens: 50, output_tokens: 10 },
    });

    const result = await analyzeWebsiteForDeals('https://test.com');

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
