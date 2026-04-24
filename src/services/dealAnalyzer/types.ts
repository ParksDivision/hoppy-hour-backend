export type DealSourceType = 'website' | 'facebook' | 'instagram' | 'twitter';

export type AnalysisStatus = 'success' | 'no_deals' | 'failed' | 'error';

export interface DealItem {
  item: string;
  price: string | null;
  description: string | null;
}

export interface ExtractedDeal {
  dealType: 'happy_hour' | 'daily_special' | 'limited_time' | 'brunch' | 'late_night';
  title: string;
  description: string;
  daysOfWeek: string[];
  startTime: string | null;
  endTime: string | null;
  startDate: string | null;
  endDate: string | null;
  drinkDeals: DealItem[];
  foodDeals: DealItem[];
}

export interface DealAnalysisResult {
  sourceUrl: string;
  sourceType: DealSourceType;
  status: AnalysisStatus;
  deals: ExtractedDeal[];
  rawAiResponse: unknown;
  aiModel: string;
  promptVersion: string;
  errorMessage?: string | undefined;
  durationMs: number;
}

export interface CleanedContent {
  cleanedText: string;
  originalLength: number;
  truncated: boolean;
}

export interface AnalyzeBusinessJobData {
  googleRawBusinessId: string;
  businessName: string | null;
  sourceUrl: string;
  sourceType: DealSourceType;
  requestedBy?: string;
}

export interface TriggerDealAnalysisJobData {
  sourceType: DealSourceType;
  requestedBy?: string;
}

export interface PublishDealJobData {
  googleRawBusinessId: string;
  published: boolean;
  publishedBy: string;
}

/** Claude multimodal content block */
export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'url'; url: string } };

/** Instagram post (via SociaVault) */
export interface InstagramPost {
  id: string;
  code: string;
  caption: string | null;
  timestamp: string;
  takenAt: number;
  mediaType: number;
  permalink: string;
  likeCount: number;
  commentCount: number;
  imageUrl: string | null;
}

/** Facebook page post (via SociaVault) */
export interface FacebookPost {
  id: string;
  message: string | null;
  createdTime: string;
  publishTime: number;
  url: string;
  reactionCount: number;
  commentCount: number;
  imageUrl: string | null;
}

/** X/Twitter tweet (via SociaVault) */
export interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  createdAtMs: number;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  viewCount: number | null;
  imageUrl: string | null;
}

/** Aggregated deals for a business, prioritized across sources */
export interface AggregatedDeals {
  businessId: string;
  primarySource: DealSourceType;
  deals: ExtractedDeal[];
  sourceBreakdown: Array<{
    sourceType: DealSourceType;
    dealCount: number;
    analyzedAt: string | null;
    status: string;
  }>;
}
