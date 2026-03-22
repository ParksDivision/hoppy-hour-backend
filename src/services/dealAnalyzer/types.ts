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
