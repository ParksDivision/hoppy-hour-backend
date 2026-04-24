/**
 * SociaVault API Configuration
 *
 * Single API key provides access to Instagram, Facebook, and Twitter/X scraping.
 * Docs: https://docs.sociavault.com
 */
export const sociavaultConfig = {
  apiKey: process.env.SOCIAVAULT_API_KEY,
  baseUrl: 'https://api.sociavault.com/v1/scrape',
  timeout: 30000,
  /** Stop paginating when posts are older than this many days */
  maxAgeDays: 45,
  /** Max pages to fetch per platform to avoid runaway pagination */
  maxPages: 20,
};
