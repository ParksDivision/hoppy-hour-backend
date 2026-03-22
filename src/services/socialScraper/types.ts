export type SocialPlatform = 'facebook' | 'instagram' | 'twitter';

export type ScrapeMethod = 'cheerio' | 'playwright';

export type ScrapeStatus = 'success' | 'failed' | 'no_links' | 'timeout';

export interface SocialLinkCandidate {
  url: string;
  platform: SocialPlatform;
  source: 'href' | 'meta' | 'text';
}

export interface ExtractedSocialLinks {
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  allLinksFound: SocialLinkCandidate[];
}

export interface ScrapeResult {
  websiteUrl: string;
  method: ScrapeMethod;
  status: ScrapeStatus;
  links: ExtractedSocialLinks;
  errorMessage: string | undefined;
  durationMs: number;
}

export interface ScrapeBusinessJobData {
  googleRawBusinessId: string;
  businessName: string | null;
  websiteUrl: string;
  requestedBy: string | undefined;
}

export interface TriggerSocialScrapingJobData {
  city: string;
  requestedBy: string | undefined;
}
