import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';
import type { CleanedContent } from './types';

const DEFAULT_MAX_LENGTH = 10000;

const fetchClient = axios.create({
  timeout: 10000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HoppyHourBot/1.0)',
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  validateStatus: (status) => status < 400,
});

/** Tags to strip entirely (including their content) */
const STRIP_TAGS = ['script', 'style', 'noscript', 'iframe', 'svg', 'canvas'];

/** Structural tags whose content is usually not deal-related */
const NOISE_TAGS = ['nav', 'header', 'footer'];

/**
 * Clean raw HTML into text suitable for AI analysis.
 * Strips non-content tags, extracts meaningful text, and truncates.
 */
export function cleanHtmlForAnalysis(
  html: string,
  maxLength: number = DEFAULT_MAX_LENGTH
): CleanedContent {
  const $ = cheerio.load(html);

  // Remove tags that contain no useful content
  for (const tag of STRIP_TAGS) {
    $(tag).remove();
  }

  // Remove hidden elements
  $('[style*="display: none"], [style*="display:none"], [aria-hidden="true"]').remove();

  // Remove noise structural tags
  for (const tag of NOISE_TAGS) {
    $(tag).remove();
  }

  // Try to extract from semantic content containers first
  let text = '';
  const contentSelectors = ['main', 'article', '[role="main"]', '.content', '#content'];

  for (const selector of contentSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      text = el.text();
      break;
    }
  }

  // Fall back to body text if no semantic container found
  if (!text.trim()) {
    text = $('body').text() || $.text();
  }

  // Collapse whitespace: multiple spaces/tabs -> single space, multiple newlines -> single newline
  const cleaned = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();

  const originalLength = cleaned.length;
  const truncated = originalLength > maxLength;
  const cleanedText = truncated ? cleaned.slice(0, maxLength) : cleaned;

  return { cleanedText, originalLength, truncated };
}

/**
 * Fetch a website and return cleaned text content.
 */
export async function fetchAndCleanWebsite(
  url: string,
  maxLength: number = DEFAULT_MAX_LENGTH
): Promise<CleanedContent> {
  const response = await fetchClient.get<string>(url);
  const html = response.data;

  logger.debug({ url, htmlLength: html.length }, 'Fetched website HTML for deal analysis');

  return cleanHtmlForAnalysis(html, maxLength);
}
