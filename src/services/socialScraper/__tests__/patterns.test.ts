import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  normalizeSocialUrl,
  isValidProfileUrl,
  isExcludedPath,
  extractProfileSlug,
  findSocialUrlsInText,
  deduplicateByPlatform,
} from '../patterns';
import type { SocialLinkCandidate } from '../types';

describe('detectPlatform', () => {
  it('detects Facebook URLs', () => {
    expect(detectPlatform('https://facebook.com/somebar')).toBe('facebook');
    expect(detectPlatform('https://www.facebook.com/somebar')).toBe('facebook');
    expect(detectPlatform('https://fb.com/somebar')).toBe('facebook');
    expect(detectPlatform('https://fb.me/somebar')).toBe('facebook');
    expect(detectPlatform('https://m.facebook.com/somebar')).toBe('facebook');
  });

  it('detects Instagram URLs', () => {
    expect(detectPlatform('https://instagram.com/somebar')).toBe('instagram');
    expect(detectPlatform('https://www.instagram.com/somebar')).toBe('instagram');
  });

  it('detects Twitter/X URLs', () => {
    expect(detectPlatform('https://twitter.com/somebar')).toBe('twitter');
    expect(detectPlatform('https://x.com/somebar')).toBe('twitter');
    expect(detectPlatform('https://www.twitter.com/somebar')).toBe('twitter');
    expect(detectPlatform('https://www.x.com/somebar')).toBe('twitter');
  });

  it('returns null for non-social URLs', () => {
    expect(detectPlatform('https://google.com')).toBeNull();
    expect(detectPlatform('https://example.com')).toBeNull();
    expect(detectPlatform('https://yelp.com/biz/bar')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
    expect(detectPlatform('')).toBeNull();
  });
});

describe('normalizeSocialUrl', () => {
  it('converts http to https', () => {
    expect(normalizeSocialUrl('http://facebook.com/bar')).toBe('https://facebook.com/bar');
  });

  it('strips query params and hash', () => {
    expect(normalizeSocialUrl('https://instagram.com/bar?ref=website#section')).toBe(
      'https://instagram.com/bar'
    );
  });

  it('removes trailing slash', () => {
    expect(normalizeSocialUrl('https://instagram.com/bar/')).toBe('https://instagram.com/bar');
  });

  it('normalizes fb.com to facebook.com', () => {
    expect(normalizeSocialUrl('https://fb.com/bar')).toBe('https://www.facebook.com/bar');
  });

  it('normalizes fb.me to facebook.com', () => {
    expect(normalizeSocialUrl('https://fb.me/bar')).toBe('https://www.facebook.com/bar');
  });

  it('normalizes twitter.com to x.com', () => {
    expect(normalizeSocialUrl('https://twitter.com/bar')).toBe('https://x.com/bar');
  });

  it('normalizes www.instagram.com to instagram.com', () => {
    expect(normalizeSocialUrl('https://www.instagram.com/bar')).toBe('https://instagram.com/bar');
  });

  it('normalizes m.facebook.com to www.facebook.com', () => {
    expect(normalizeSocialUrl('https://m.facebook.com/bar')).toBe('https://www.facebook.com/bar');
  });

  it('handles malformed URLs gracefully', () => {
    expect(normalizeSocialUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('isExcludedPath', () => {
  it('identifies excluded paths', () => {
    expect(isExcludedPath('sharer')).toBe(true);
    expect(isExcludedPath('share')).toBe(true);
    expect(isExcludedPath('intent')).toBe(true);
    expect(isExcludedPath('login')).toBe(true);
    expect(isExcludedPath('signup')).toBe(true);
    expect(isExcludedPath('help')).toBe(true);
    expect(isExcludedPath('dialog')).toBe(true);
  });

  it('allows valid profile slugs', () => {
    expect(isExcludedPath('austinbrewery')).toBe(false);
    expect(isExcludedPath('the_bar')).toBe(false);
    expect(isExcludedPath('johndoe')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isExcludedPath('SHARER')).toBe(true);
    expect(isExcludedPath('Login')).toBe(true);
  });
});

describe('extractProfileSlug', () => {
  it('extracts the first path segment', () => {
    expect(extractProfileSlug('https://facebook.com/austinbrewery')).toBe('austinbrewery');
    expect(extractProfileSlug('https://instagram.com/the_bar/posts')).toBe('the_bar');
  });

  it('returns null for URLs with no path', () => {
    expect(extractProfileSlug('https://facebook.com/')).toBeNull();
    expect(extractProfileSlug('https://facebook.com')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(extractProfileSlug('not-a-url')).toBeNull();
  });
});

describe('isValidProfileUrl', () => {
  it('accepts valid profile URLs', () => {
    expect(isValidProfileUrl('https://facebook.com/austinbrewery')).toBe(true);
    expect(isValidProfileUrl('https://instagram.com/the_bar')).toBe(true);
    expect(isValidProfileUrl('https://x.com/coolbar')).toBe(true);
  });

  it('rejects share/intent URLs', () => {
    expect(isValidProfileUrl('https://facebook.com/sharer/sharer.php')).toBe(false);
    expect(isValidProfileUrl('https://twitter.com/intent/tweet')).toBe(false);
  });

  it('rejects generic platform pages', () => {
    expect(isValidProfileUrl('https://facebook.com/login')).toBe(false);
    expect(isValidProfileUrl('https://instagram.com/explore')).toBe(false);
    expect(isValidProfileUrl('https://twitter.com/home')).toBe(false);
  });

  it('rejects single-character slugs', () => {
    expect(isValidProfileUrl('https://facebook.com/x')).toBe(false);
  });

  it('rejects URLs with no path', () => {
    expect(isValidProfileUrl('https://facebook.com/')).toBe(false);
  });
});

describe('findSocialUrlsInText', () => {
  it('finds Facebook URLs in text', () => {
    const text = 'Follow us on https://facebook.com/austinbrewery for updates!';
    const results = findSocialUrlsInText(text);
    expect(results).toHaveLength(1);
    expect(results[0]?.platform).toBe('facebook');
    expect(results[0]?.source).toBe('text');
  });

  it('finds multiple platform URLs in text', () => {
    const text = `
      Facebook: https://facebook.com/mybar
      Instagram: https://instagram.com/mybar
      Twitter: https://x.com/mybar
    `;
    const results = findSocialUrlsInText(text);
    expect(results).toHaveLength(3);
    const platforms = results.map((r) => r.platform);
    expect(platforms).toContain('facebook');
    expect(platforms).toContain('instagram');
    expect(platforms).toContain('twitter');
  });

  it('filters out excluded paths in text URLs', () => {
    const text = 'Share on https://facebook.com/sharer/sharer.php?u=whatever';
    const results = findSocialUrlsInText(text);
    expect(results).toHaveLength(0);
  });

  it('returns empty array when no social URLs found', () => {
    const text = 'Visit us at https://example.com for more info!';
    const results = findSocialUrlsInText(text);
    expect(results).toHaveLength(0);
  });

  it('handles empty string', () => {
    expect(findSocialUrlsInText('')).toHaveLength(0);
  });
});

describe('deduplicateByPlatform', () => {
  it('picks the best URL per platform', () => {
    const candidates: SocialLinkCandidate[] = [
      { url: 'https://www.facebook.com/bar', platform: 'facebook', source: 'href' },
      { url: 'https://www.facebook.com/bar', platform: 'facebook', source: 'text' },
      { url: 'https://instagram.com/bar', platform: 'instagram', source: 'meta' },
    ];

    const result = deduplicateByPlatform(candidates);
    expect(result.facebook).toBe('https://www.facebook.com/bar');
    expect(result.instagram).toBe('https://instagram.com/bar');
    expect(result.twitter).toBeNull();
  });

  it('prioritizes href over meta over text', () => {
    const candidates: SocialLinkCandidate[] = [
      { url: 'https://www.facebook.com/bar-text', platform: 'facebook', source: 'text' },
      { url: 'https://www.facebook.com/bar-meta', platform: 'facebook', source: 'meta' },
      { url: 'https://www.facebook.com/bar-href', platform: 'facebook', source: 'href' },
    ];

    const result = deduplicateByPlatform(candidates);
    expect(result.facebook).toBe('https://www.facebook.com/bar-href');
  });

  it('prefers longer URLs at same priority', () => {
    const candidates: SocialLinkCandidate[] = [
      { url: 'https://www.facebook.com/b', platform: 'facebook', source: 'href' },
      { url: 'https://www.facebook.com/bar-specific-page', platform: 'facebook', source: 'href' },
    ];

    const result = deduplicateByPlatform(candidates);
    expect(result.facebook).toBe('https://www.facebook.com/bar-specific-page');
  });

  it('returns all nulls for empty candidates', () => {
    const result = deduplicateByPlatform([]);
    expect(result.facebook).toBeNull();
    expect(result.instagram).toBeNull();
    expect(result.twitter).toBeNull();
    expect(result.allLinksFound).toHaveLength(0);
  });

  it('preserves allLinksFound for debugging', () => {
    const candidates: SocialLinkCandidate[] = [
      { url: 'https://www.facebook.com/bar1', platform: 'facebook', source: 'href' },
      { url: 'https://www.facebook.com/bar2', platform: 'facebook', source: 'text' },
    ];

    const result = deduplicateByPlatform(candidates);
    expect(result.allLinksFound).toHaveLength(2);
  });
});
