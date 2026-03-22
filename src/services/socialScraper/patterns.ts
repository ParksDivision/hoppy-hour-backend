import type { SocialPlatform, SocialLinkCandidate, ExtractedSocialLinks } from './types';

export interface PlatformPattern {
  platform: SocialPlatform;
  urlPatterns: RegExp[];
  domains: string[];
}

export const SOCIAL_PLATFORM_PATTERNS: PlatformPattern[] = [
  {
    platform: 'facebook',
    urlPatterns: [/https?:\/\/(www\.)?(facebook\.com|fb\.com|fb\.me)\/[^\s"'<>]+/gi],
    domains: ['facebook.com', 'fb.com', 'fb.me', 'www.facebook.com', 'm.facebook.com'],
  },
  {
    platform: 'instagram',
    urlPatterns: [/https?:\/\/(www\.)?instagram\.com\/[^\s"'<>]+/gi],
    domains: ['instagram.com', 'www.instagram.com'],
  },
  {
    platform: 'twitter',
    urlPatterns: [/https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^\s"'<>]+/gi],
    domains: ['twitter.com', 'x.com', 'www.twitter.com', 'www.x.com'],
  },
];

/**
 * Path segments that indicate a generic platform page, not a business profile.
 */
export const EXCLUDED_PATHS: string[] = [
  'sharer',
  'share',
  'intent',
  'login',
  'signup',
  'help',
  'about',
  'policies',
  'privacy',
  'terms',
  'settings',
  'hashtag',
  'search',
  'explore',
  'home',
  'dialog',
  'oauth',
  'api',
  'developers',
  'business',
  'ads',
  'pages',
];

/**
 * Check if a URL path segment is a generic platform page (not a profile).
 */
export function isExcludedPath(pathSegment: string): boolean {
  return EXCLUDED_PATHS.includes(pathSegment.toLowerCase());
}

/**
 * Extract the first path segment (profile slug) from a social media URL.
 */
export function extractProfileSlug(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter((s) => s.length > 0);
    return segments[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Normalize a social media URL: https, strip query/hash, remove trailing slash.
 */
export function normalizeSocialUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.protocol = 'https:';
    parsed.search = '';
    parsed.hash = '';

    // Normalize fb.com and fb.me to facebook.com
    if (parsed.hostname === 'fb.com' || parsed.hostname === 'fb.me') {
      parsed.hostname = 'www.facebook.com';
    }

    // Normalize x.com to x.com (keep as-is, it's the canonical now)
    // Normalize twitter.com to x.com
    if (parsed.hostname === 'twitter.com' || parsed.hostname === 'www.twitter.com') {
      parsed.hostname = 'x.com';
    }

    // Remove www. from instagram
    if (parsed.hostname === 'www.instagram.com') {
      parsed.hostname = 'instagram.com';
    }

    // Remove m. prefix (mobile)
    if (parsed.hostname === 'm.facebook.com') {
      parsed.hostname = 'www.facebook.com';
    }

    let normalized = parsed.toString();
    // Remove trailing slash
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Determine which social platform a URL belongs to, if any.
 */
export function detectPlatform(url: string): SocialPlatform | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    for (const pattern of SOCIAL_PLATFORM_PATTERNS) {
      if (pattern.domains.includes(hostname)) {
        return pattern.platform;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a URL is a valid social profile link (not a generic page).
 */
export function isValidProfileUrl(url: string): boolean {
  const slug = extractProfileSlug(url);
  if (!slug) return false;
  if (isExcludedPath(slug)) return false;
  // Filter out very short slugs (likely not profile pages)
  if (slug.length < 2) return false;
  return true;
}

/**
 * Scan raw text content for social media URLs using regex.
 */
export function findSocialUrlsInText(text: string): SocialLinkCandidate[] {
  const candidates: SocialLinkCandidate[] = [];

  for (const pattern of SOCIAL_PLATFORM_PATTERNS) {
    for (const regex of pattern.urlPatterns) {
      // Reset regex state for global patterns
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const url = match[0];
        if (url && isValidProfileUrl(url)) {
          candidates.push({
            url: normalizeSocialUrl(url),
            platform: pattern.platform,
            source: 'text',
          });
        }
      }
    }
  }

  return candidates;
}

/**
 * Deduplicate candidates and pick the best URL per platform.
 * Priority: href > meta > text. Among same source, prefer longer paths (more specific).
 */
export function deduplicateByPlatform(candidates: SocialLinkCandidate[]): ExtractedSocialLinks {
  const sourcePriority: Record<string, number> = { href: 3, meta: 2, text: 1 };

  const bestByPlatform = new Map<SocialPlatform, SocialLinkCandidate>();

  for (const candidate of candidates) {
    const existing = bestByPlatform.get(candidate.platform);
    if (!existing) {
      bestByPlatform.set(candidate.platform, candidate);
      continue;
    }

    const existingPriority = sourcePriority[existing.source] ?? 0;
    const candidatePriority = sourcePriority[candidate.source] ?? 0;

    // Higher source priority wins
    if (candidatePriority > existingPriority) {
      bestByPlatform.set(candidate.platform, candidate);
    } else if (candidatePriority === existingPriority) {
      // Same priority: prefer longer URL (more specific profile path)
      if (candidate.url.length > existing.url.length) {
        bestByPlatform.set(candidate.platform, candidate);
      }
    }
  }

  return {
    facebook: bestByPlatform.get('facebook')?.url ?? null,
    instagram: bestByPlatform.get('instagram')?.url ?? null,
    twitter: bestByPlatform.get('twitter')?.url ?? null,
    allLinksFound: candidates,
  };
}
