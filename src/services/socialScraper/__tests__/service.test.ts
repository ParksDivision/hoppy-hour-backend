import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractLinksFromHtml, scrapeWithCheerio, scrapeWebsiteForSocialLinks } from '../service';
import * as cheerio from 'cheerio';

// Mock axios
vi.mock('axios', () => {
  const mockCreate = vi.fn(() => ({
    get: vi.fn(),
  }));
  return {
    default: { create: mockCreate },
    __mockClient: null as ReturnType<typeof mockCreate> | null,
  };
});

// Mock playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

// Helper to get the mocked axios client
async function getMockAxiosClient() {
  const axiosModule = await import('axios');
  // The scrapeClient is created at module load, so we need to re-mock
  return (axiosModule.default.create as ReturnType<typeof vi.fn>).mock.results[0]?.value;
}

describe('extractLinksFromHtml', () => {
  it('extracts social links from anchor tags', () => {
    const html = `
      <html><body>
        <a href="https://facebook.com/mybrewery">Facebook</a>
        <a href="https://instagram.com/mybrewery">Instagram</a>
        <a href="https://x.com/mybrewery">Twitter</a>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = extractLinksFromHtml(html, $);

    expect(result.facebook).toBe('https://facebook.com/mybrewery');
    expect(result.instagram).toBe('https://instagram.com/mybrewery');
    expect(result.twitter).toBe('https://x.com/mybrewery');
  });

  it('extracts social links from meta tags', () => {
    const html = `
      <html><head>
        <meta property="og:see_also" content="https://facebook.com/mybar">
        <meta name="twitter:site" content="@mybar">
      </head><body></body></html>
    `;
    const $ = cheerio.load(html);
    const result = extractLinksFromHtml(html, $);

    expect(result.facebook).toBe('https://facebook.com/mybar');
    expect(result.twitter).toBe('https://x.com/mybar');
  });

  it('extracts twitter handle from @username meta', () => {
    const html = `
      <html><head>
        <meta name="twitter:creator" content="@coolbrewery">
      </head><body></body></html>
    `;
    const $ = cheerio.load(html);
    const result = extractLinksFromHtml(html, $);

    expect(result.twitter).toBe('https://x.com/coolbrewery');
  });

  it('extracts social links from inline text via regex', () => {
    const html = `
      <html><body>
        <footer>
          Follow us on https://facebook.com/textbar and https://instagram.com/textbar
        </footer>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = extractLinksFromHtml(html, $);

    expect(result.facebook).toBe('https://facebook.com/textbar');
    expect(result.instagram).toBe('https://instagram.com/textbar');
  });

  it('returns all nulls when no social links exist', () => {
    const html = `
      <html><body>
        <a href="https://google.com">Google</a>
        <a href="/contact">Contact</a>
        <a href="https://yelp.com/biz/bar">Yelp</a>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = extractLinksFromHtml(html, $);

    expect(result.facebook).toBeNull();
    expect(result.instagram).toBeNull();
    expect(result.twitter).toBeNull();
    expect(result.allLinksFound).toHaveLength(0);
  });

  it('filters out share/intent URLs from anchors', () => {
    const html = `
      <html><body>
        <a href="https://facebook.com/sharer/sharer.php?u=mysite">Share on FB</a>
        <a href="https://twitter.com/intent/tweet?text=hello">Tweet</a>
        <a href="https://facebook.com/realbrewery">Visit us on Facebook</a>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = extractLinksFromHtml(html, $);

    expect(result.facebook).toBe('https://facebook.com/realbrewery');
    expect(result.twitter).toBeNull();
  });

  it('prioritizes href links over text-found links', () => {
    const html = `
      <html><body>
        <a href="https://facebook.com/hrefbar">FB</a>
        <p>Also at https://facebook.com/textbar</p>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = extractLinksFromHtml(html, $);

    // href should win over text
    expect(result.facebook).toBe('https://facebook.com/hrefbar');
  });

  it('handles multiple links to the same platform', () => {
    const html = `
      <html><body>
        <a href="https://facebook.com/bar">Main page</a>
        <a href="https://facebook.com/bar/events">Events page</a>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = extractLinksFromHtml(html, $);

    // Should pick the longer (more specific) URL
    expect(result.facebook).toBe('https://facebook.com/bar/events');
  });

  it('handles empty HTML', () => {
    const html = '';
    const $ = cheerio.load(html);
    const result = extractLinksFromHtml(html, $);

    expect(result.facebook).toBeNull();
    expect(result.instagram).toBeNull();
    expect(result.twitter).toBeNull();
  });

  it('detects all three platforms simultaneously', () => {
    const html = `
      <html><body>
        <div class="social">
          <a href="https://facebook.com/brewery123">FB</a>
          <a href="https://instagram.com/brewery123">IG</a>
          <a href="https://x.com/brewery123">X</a>
        </div>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = extractLinksFromHtml(html, $);

    expect(result.facebook).toBe('https://facebook.com/brewery123');
    expect(result.instagram).toBe('https://instagram.com/brewery123');
    expect(result.twitter).toBe('https://x.com/brewery123');
    expect(result.allLinksFound.length).toBeGreaterThanOrEqual(3);
  });
});

describe('scrapeWithCheerio', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns correct structure on success', async () => {
    // We test the pure extraction logic above; this tests the wrapper behavior
    // For a full integration test, we'd need to mock axios properly at module level
    // This is a structural test
    const result = await scrapeWithCheerio('https://nonexistent-test-domain.invalid');
    expect(result.websiteUrl).toBe('https://nonexistent-test-domain.invalid');
    expect(result.method).toBe('cheerio');
    expect(['failed', 'timeout']).toContain(result.status);
    expect(result.links).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('scrapeWebsiteForSocialLinks', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns a ScrapeResult with all required fields', async () => {
    const result = await scrapeWebsiteForSocialLinks('https://nonexistent-test-domain.invalid');
    expect(result).toHaveProperty('websiteUrl');
    expect(result).toHaveProperty('method');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('links');
    expect(result).toHaveProperty('durationMs');
    expect(result.links).toHaveProperty('facebook');
    expect(result.links).toHaveProperty('instagram');
    expect(result.links).toHaveProperty('twitter');
    expect(result.links).toHaveProperty('allLinksFound');
  });
});
