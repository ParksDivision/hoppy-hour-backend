import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions
const {
  mockAxiosGet,
  mockMessagesCreate,
  mockFetchInstagram,
  mockFormatInstagram,
  mockFetchFacebook,
  mockFormatFacebook,
  mockFetchTwitter,
  mockFormatTwitter,
  mockUpsertInstagramRawData,
  mockUpsertFacebookRawData,
  mockUpsertTwitterRawData,
} = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockMessagesCreate: vi.fn(),
  mockFetchInstagram: vi.fn(),
  mockFormatInstagram: vi.fn(),
  mockFetchFacebook: vi.fn(),
  mockFormatFacebook: vi.fn(),
  mockFetchTwitter: vi.fn(),
  mockFormatTwitter: vi.fn(),
  mockUpsertInstagramRawData: vi.fn(),
  mockUpsertFacebookRawData: vi.fn(),
  mockUpsertTwitterRawData: vi.fn(),
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

// Mock social media clients
vi.mock('../clients/instagramClient', () => ({
  fetchInstagramPosts: mockFetchInstagram,
  formatInstagramContent: mockFormatInstagram,
}));

vi.mock('../clients/facebookClient', () => ({
  fetchFacebookPosts: mockFetchFacebook,
  formatFacebookContent: mockFormatFacebook,
}));

vi.mock('../clients/twitterClient', () => ({
  fetchTwitterPosts: mockFetchTwitter,
  formatTwitterContent: mockFormatTwitter,
}));

// Mock social raw data repository
vi.mock('../../../repositories/socialRawDataRepository', () => ({
  upsertInstagramRawData: mockUpsertInstagramRawData,
  upsertFacebookRawData: mockUpsertFacebookRawData,
  upsertTwitterRawData: mockUpsertTwitterRawData,
}));

import {
  analyzeWebsiteForDeals,
  analyzeInstagramForDeals,
  analyzeFacebookForDeals,
  analyzeTwitterForDeals,
} from '../service';

/** Helper to wrap text in HTML that yields >50 chars after cleaning */
const html = (text: string) => `<html><body><main><p>${text}</p></main></body></html>`;

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
      data: html(
        'Happy Hour Monday through Friday from 3pm to 6pm. Enjoy $3 well drinks and $5 wings all evening long.'
      ),
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
      data: html(
        'Taco Tuesday special every week. Get $2 tacos all day long with our famous salsa.'
      ),
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

describe('analyzeInstagramForDeals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches posts, formats, and analyzes with Claude', async () => {
    mockFetchInstagram.mockResolvedValue([
      {
        caption: 'Happy Hour 3-6pm $3 wells',
        timestamp: '2026-03-20T18:00:00Z',
        mediaType: 'IMAGE',
        permalink: '',
      },
    ]);
    mockFormatInstagram.mockReturnValue(
      '--- Post 1 ---\nHappy Hour 3-6pm $3 wells and half price appetizers every weekday'
    );

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: SAMPLE_DEAL_RESPONSE }],
      usage: { input_tokens: 100, output_tokens: 200 },
    });

    const result = await analyzeInstagramForDeals('https://instagram.com/testbar');

    expect(result.sourceType).toBe('instagram');
    expect(result.status).toBe('success');
    expect(result.deals).toHaveLength(1);
    expect(mockFetchInstagram).toHaveBeenCalledWith('https://instagram.com/testbar');
  });

  it('returns no_deals when no captions have content', async () => {
    mockFetchInstagram.mockResolvedValue([]);
    mockFormatInstagram.mockReturnValue('');

    const result = await analyzeInstagramForDeals('https://instagram.com/imageonlybar');

    expect(result.sourceType).toBe('instagram');
    expect(result.status).toBe('no_deals');
    expect(result.errorMessage).toContain('too short');
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('returns error when fetch fails', async () => {
    mockFetchInstagram.mockRejectedValue(new Error('META_ACCESS_TOKEN is not configured'));

    const result = await analyzeInstagramForDeals('https://instagram.com/bar');

    expect(result.sourceType).toBe('instagram');
    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('META_ACCESS_TOKEN');
  });

  it('saves raw posts to repository when googleRawBusinessId is provided', async () => {
    const posts = [
      { caption: 'Happy Hour 3-6pm $3 wells', timestamp: '2026-03-20T18:00:00Z', mediaType: 'IMAGE', permalink: '' },
    ];
    mockFetchInstagram.mockResolvedValue(posts);
    mockFormatInstagram.mockReturnValue('--- Post 1 ---\nHappy Hour 3-6pm $3 wells every single weekday');
    mockUpsertInstagramRawData.mockResolvedValue({});
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: SAMPLE_DEAL_RESPONSE }],
      usage: { input_tokens: 100, output_tokens: 200 },
    });

    await analyzeInstagramForDeals('https://instagram.com/testbar', {
      googleRawBusinessId: 'biz-1',
      requestedBy: 'pipeline',
    });

    expect(mockUpsertInstagramRawData).toHaveBeenCalledTimes(1);
    const [data, createdBy] = mockUpsertInstagramRawData.mock.calls[0];
    expect(data).toMatchObject({
      googleRawBusinessId: 'biz-1',
      profileUrl: 'https://instagram.com/testbar',
      posts,
      fetchStatus: 'success',
    });
    expect(createdBy).toBe('pipeline');
  });

  it('saves empty fetch status when no posts returned', async () => {
    mockFetchInstagram.mockResolvedValue([]);
    mockFormatInstagram.mockReturnValue('');
    mockUpsertInstagramRawData.mockResolvedValue({});

    await analyzeInstagramForDeals('https://instagram.com/emptybar', {
      googleRawBusinessId: 'biz-2',
    });

    const [data] = mockUpsertInstagramRawData.mock.calls[0];
    expect(data).toMatchObject({ fetchStatus: 'empty', posts: [] });
  });

  it('saves error row to repository when fetch fails', async () => {
    mockFetchInstagram.mockRejectedValue(new Error('META_ACCESS_TOKEN is not configured'));
    mockUpsertInstagramRawData.mockResolvedValue({});

    const result = await analyzeInstagramForDeals('https://instagram.com/bar', {
      googleRawBusinessId: 'biz-3',
      requestedBy: 'system',
    });

    expect(result.status).toBe('error');
    expect(mockUpsertInstagramRawData).toHaveBeenCalledTimes(1);
    const [data] = mockUpsertInstagramRawData.mock.calls[0];
    expect(data).toMatchObject({
      googleRawBusinessId: 'biz-3',
      fetchStatus: 'error',
      errorMessage: 'META_ACCESS_TOKEN is not configured',
      posts: [],
    });
  });

  it('does not save raw data when googleRawBusinessId is omitted', async () => {
    mockFetchInstagram.mockResolvedValue([]);
    mockFormatInstagram.mockReturnValue('');

    await analyzeInstagramForDeals('https://instagram.com/bar');

    expect(mockUpsertInstagramRawData).not.toHaveBeenCalled();
  });

  it('does not mask fetch error when repository upsert also fails', async () => {
    mockFetchInstagram.mockRejectedValue(new Error('Network timeout'));
    mockUpsertInstagramRawData.mockRejectedValue(new Error('DB down'));

    const result = await analyzeInstagramForDeals('https://instagram.com/bar', {
      googleRawBusinessId: 'biz-4',
    });

    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('Network timeout');
  });
});

describe('analyzeFacebookForDeals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches posts, formats, and analyzes with Claude', async () => {
    mockFetchFacebook.mockResolvedValue([
      { message: 'Wings Wednesday half price!', createdTime: '2026-03-19T12:00:00Z' },
    ]);
    mockFormatFacebook.mockReturnValue(
      '--- Post 1 ---\nWings Wednesday half price! Come get your wings and beer specials'
    );

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: SAMPLE_DEAL_RESPONSE }],
      usage: { input_tokens: 100, output_tokens: 200 },
    });

    const result = await analyzeFacebookForDeals('https://facebook.com/testbar');

    expect(result.sourceType).toBe('facebook');
    expect(result.status).toBe('success');
    expect(mockFetchFacebook).toHaveBeenCalledWith('https://facebook.com/testbar');
  });

  it('returns error on API failure', async () => {
    mockFetchFacebook.mockRejectedValue(new Error('Page not found'));

    const result = await analyzeFacebookForDeals('https://facebook.com/nonexistent');

    expect(result.sourceType).toBe('facebook');
    expect(result.status).toBe('error');
  });

  it('saves raw posts to repository when googleRawBusinessId is provided', async () => {
    const posts = [{ message: 'Wings Wednesday half price!', createdTime: '2026-03-19T12:00:00Z' }];
    mockFetchFacebook.mockResolvedValue(posts);
    mockFormatFacebook.mockReturnValue('--- Post 1 ---\nWings Wednesday half price! Come get them');
    mockUpsertFacebookRawData.mockResolvedValue({});
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: SAMPLE_DEAL_RESPONSE }],
      usage: { input_tokens: 100, output_tokens: 200 },
    });

    await analyzeFacebookForDeals('https://facebook.com/testbar', {
      googleRawBusinessId: 'biz-1',
      requestedBy: 'pipeline',
    });

    expect(mockUpsertFacebookRawData).toHaveBeenCalledTimes(1);
    const [data, createdBy] = mockUpsertFacebookRawData.mock.calls[0];
    expect(data).toMatchObject({
      googleRawBusinessId: 'biz-1',
      profileUrl: 'https://facebook.com/testbar',
      posts,
      fetchStatus: 'success',
    });
    expect(createdBy).toBe('pipeline');
  });

  it('saves error row to repository when fetch fails', async () => {
    mockFetchFacebook.mockRejectedValue(new Error('Could not resolve Facebook page ID'));
    mockUpsertFacebookRawData.mockResolvedValue({});

    const result = await analyzeFacebookForDeals('https://facebook.com/bar', {
      googleRawBusinessId: 'biz-2',
    });

    expect(result.status).toBe('error');
    expect(mockUpsertFacebookRawData).toHaveBeenCalledTimes(1);
    const [data] = mockUpsertFacebookRawData.mock.calls[0];
    expect(data).toMatchObject({
      googleRawBusinessId: 'biz-2',
      fetchStatus: 'error',
      errorMessage: 'Could not resolve Facebook page ID',
    });
  });

  it('does not save raw data when googleRawBusinessId is omitted', async () => {
    mockFetchFacebook.mockRejectedValue(new Error('Page not found'));

    await analyzeFacebookForDeals('https://facebook.com/bar');

    expect(mockUpsertFacebookRawData).not.toHaveBeenCalled();
  });
});

describe('analyzeTwitterForDeals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches tweets, formats, and analyzes with Claude', async () => {
    mockFetchTwitter.mockResolvedValue([
      { text: 'Happy Hour starting NOW! $3 wells until 7pm', createdAt: '2026-03-20T22:00:00Z' },
    ]);
    mockFormatTwitter.mockReturnValue(
      '--- Tweet 1 ---\nHappy Hour starting NOW! $3 wells until 7pm every single weekday'
    );

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: SAMPLE_DEAL_RESPONSE }],
      usage: { input_tokens: 100, output_tokens: 200 },
    });

    const result = await analyzeTwitterForDeals('https://x.com/testbar');

    expect(result.sourceType).toBe('twitter');
    expect(result.status).toBe('success');
    expect(mockFetchTwitter).toHaveBeenCalledWith('https://x.com/testbar');
  });

  it('returns error on API failure', async () => {
    mockFetchTwitter.mockRejectedValue(new Error('TWITTER_BEARER_TOKEN is not configured'));

    const result = await analyzeTwitterForDeals('https://x.com/bar');

    expect(result.sourceType).toBe('twitter');
    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('TWITTER_BEARER_TOKEN');
  });

  it('saves raw tweets to repository when googleRawBusinessId is provided', async () => {
    const tweets = [{ text: 'Happy Hour NOW! $3 wells until 7pm', createdAt: '2026-03-20T22:00:00Z' }];
    mockFetchTwitter.mockResolvedValue(tweets);
    mockFormatTwitter.mockReturnValue('--- Tweet 1 ---\nHappy Hour NOW! $3 wells until 7pm every weekday');
    mockUpsertTwitterRawData.mockResolvedValue({});
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: SAMPLE_DEAL_RESPONSE }],
      usage: { input_tokens: 100, output_tokens: 200 },
    });

    await analyzeTwitterForDeals('https://x.com/testbar', {
      googleRawBusinessId: 'biz-1',
      requestedBy: 'pipeline',
    });

    expect(mockUpsertTwitterRawData).toHaveBeenCalledTimes(1);
    const [data, createdBy] = mockUpsertTwitterRawData.mock.calls[0];
    expect(data).toMatchObject({
      googleRawBusinessId: 'biz-1',
      profileUrl: 'https://x.com/testbar',
      tweets,
      fetchStatus: 'success',
    });
    expect(createdBy).toBe('pipeline');
  });

  it('saves error row to repository when fetch fails', async () => {
    mockFetchTwitter.mockRejectedValue(new Error('TWITTER_BEARER_TOKEN is not configured'));
    mockUpsertTwitterRawData.mockResolvedValue({});

    const result = await analyzeTwitterForDeals('https://x.com/bar', {
      googleRawBusinessId: 'biz-2',
    });

    expect(result.status).toBe('error');
    expect(mockUpsertTwitterRawData).toHaveBeenCalledTimes(1);
    const [data] = mockUpsertTwitterRawData.mock.calls[0];
    expect(data).toMatchObject({
      googleRawBusinessId: 'biz-2',
      fetchStatus: 'error',
      errorMessage: 'TWITTER_BEARER_TOKEN is not configured',
      tweets: [],
    });
  });

  it('does not save raw data when googleRawBusinessId is omitted', async () => {
    mockFetchTwitter.mockRejectedValue(new Error('Auth error'));

    await analyzeTwitterForDeals('https://x.com/bar');

    expect(mockUpsertTwitterRawData).not.toHaveBeenCalled();
  });
});
