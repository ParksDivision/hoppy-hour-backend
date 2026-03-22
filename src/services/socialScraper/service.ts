import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';
import {
  SOCIAL_PLATFORM_PATTERNS,
  detectPlatform,
  isValidProfileUrl,
  normalizeSocialUrl,
  findSocialUrlsInText,
  deduplicateByPlatform,
} from './patterns';
import type { ScrapeResult, SocialLinkCandidate, ExtractedSocialLinks } from './types';

const scrapeClient = axios.create({
  timeout: 10000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HoppyHourBot/1.0)',
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  validateStatus: (status) => status < 400,
});

/**
 * Main entry point: scrape a website for social media links.
 * Tries Cheerio first; falls back to Playwright for JS-heavy pages.
 */
export async function scrapeWebsiteForSocialLinks(websiteUrl: string): Promise<ScrapeResult> {
  // Try Cheerio first (fast, lightweight)
  const cheerioResult = await scrapeWithCheerio(websiteUrl);

  // If Cheerio found social links, return immediately
  if (
    cheerioResult.status === 'success' &&
    (cheerioResult.links.facebook || cheerioResult.links.instagram || cheerioResult.links.twitter)
  ) {
    return cheerioResult;
  }

  // If Cheerio failed outright (not timeout), try Playwright
  if (cheerioResult.status === 'failed' || cheerioResult.status === 'no_links') {
    try {
      const playwrightResult = await scrapeWithPlaywright(websiteUrl);
      // If Playwright found links, prefer it
      if (
        playwrightResult.links.facebook ||
        playwrightResult.links.instagram ||
        playwrightResult.links.twitter
      ) {
        return playwrightResult;
      }
      // Neither found links; return Playwright result (has better status info)
      return playwrightResult;
    } catch (error) {
      logger.debug(
        { websiteUrl, error: error instanceof Error ? error.message : String(error) },
        'Playwright fallback failed, returning Cheerio result'
      );
    }
  }

  return cheerioResult;
}

/**
 * Tier 1: Fetch HTML with Axios and parse with Cheerio.
 */
export async function scrapeWithCheerio(websiteUrl: string): Promise<ScrapeResult> {
  const startTime = Date.now();

  try {
    const response = await scrapeClient.get<string>(websiteUrl);
    const html = response.data;
    const $ = cheerio.load(html);

    const links = extractLinksFromHtml(html, $);

    const hasLinks = links.facebook || links.instagram || links.twitter;

    return {
      websiteUrl,
      method: 'cheerio',
      status: hasLinks ? 'success' : 'no_links',
      links,
      errorMessage: undefined,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.message.includes('timeout') || error.message.includes('ECONNABORTED'));

    return {
      websiteUrl,
      method: 'cheerio',
      status: isTimeout ? 'timeout' : 'failed',
      links: { facebook: null, instagram: null, twitter: null, allLinksFound: [] },
      errorMessage: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Tier 2: Use Playwright headless browser for JS-rendered pages.
 */
export async function scrapeWithPlaywright(websiteUrl: string): Promise<ScrapeResult> {
  const startTime = Date.now();

  try {
    // Dynamic import to avoid loading Playwright when not needed
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (compatible; HoppyHourBot/1.0)',
      });
      const page = await context.newPage();
      await page.goto(websiteUrl, { waitUntil: 'networkidle', timeout: 15000 });
      const html = await page.content();
      const $ = cheerio.load(html);

      const links = extractLinksFromHtml(html, $);
      const hasLinks = links.facebook || links.instagram || links.twitter;

      return {
        websiteUrl,
        method: 'playwright',
        status: hasLinks ? 'success' : 'no_links',
        links,
        errorMessage: undefined,
        durationMs: Date.now() - startTime,
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    const isTimeout = error instanceof Error && error.message.includes('Timeout');

    return {
      websiteUrl,
      method: 'playwright',
      status: isTimeout ? 'timeout' : 'failed',
      links: { facebook: null, instagram: null, twitter: null, allLinksFound: [] },
      errorMessage: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Extract social media links from parsed HTML.
 * Searches <a> hrefs, <meta> tags, and inline text.
 */
export function extractLinksFromHtml(html: string, $: cheerio.CheerioAPI): ExtractedSocialLinks {
  const candidates: SocialLinkCandidate[] = [];

  // 1. Search all <a> tag href attributes
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    const platform = detectPlatform(href);
    if (platform && isValidProfileUrl(href)) {
      candidates.push({
        url: normalizeSocialUrl(href),
        platform,
        source: 'href',
      });
    }
  });

  // 2. Search <meta> tags for social links
  const metaSelectors = [
    'meta[property="og:see_also"]',
    'meta[property="og:url"]',
    'meta[name="twitter:site"]',
    'meta[name="twitter:creator"]',
  ];

  for (const selector of metaSelectors) {
    $(selector).each((_i, el) => {
      const content = $(el).attr('content');
      if (!content) return;

      // Handle @username format from twitter meta tags
      if (content.startsWith('@')) {
        candidates.push({
          url: normalizeSocialUrl(`https://x.com/${content.slice(1)}`),
          platform: 'twitter',
          source: 'meta',
        });
        return;
      }

      const platform = detectPlatform(content);
      if (platform && isValidProfileUrl(content)) {
        candidates.push({
          url: normalizeSocialUrl(content),
          platform,
          source: 'meta',
        });
      }
    });
  }

  // 3. Scan raw HTML text for social URLs via regex
  const textCandidates = findSocialUrlsInText(html);
  for (const candidate of textCandidates) {
    // Avoid duplicates already found via href/meta
    const isDuplicate = candidates.some((c) => c.url === candidate.url);
    if (!isDuplicate) {
      candidates.push(candidate);
    }
  }

  return deduplicateByPlatform(candidates);
}
