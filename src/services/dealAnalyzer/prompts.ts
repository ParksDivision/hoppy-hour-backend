export const CURRENT_PROMPT_VERSION = 'v3';

function todayFormatted(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Layer 1: Deal Extraction ─────────────────────────────────────────────────

export const DEAL_EXTRACTION_SYSTEM_PROMPT = `You extract currently active deals from bars/restaurants/breweries. Today is ${todayFormatted()}.

Output schema per deal:
- dealType: "happy_hour" | "daily_special" | "limited_time" | "brunch" | "late_night"
- title: short name (e.g. "Happy Hour", "Taco Tuesday")
- description: brief summary
- daysOfWeek: lowercase day names array. All 7 if daily.
- startTime/endTime: "HH:MM" 24hr or null
- startDate/endDate: ISO date or null
- drinkDeals: [{ item, price, description }]
- foodDeals: [{ item, price, description }]

EXTRACT: recurring weekly deals, ongoing promotions, active limited-time offers, brunch/late-night specials.

SKIP: regular menu items, past one-time events (holidays, game days), expired promos, vague mentions without pricing, seasonal specials out of season, one-off social posts older than 3 weeks.

For social media: post dates are shown. Recurring deals from old posts are valid. One-time events from old posts are not. Newer posts override older versions of the same deal.

Return a JSON array. Empty array if no active deals found.`;

export const DEAL_EXTRACTION_USER_PROMPT = (websiteText: string): string =>
  `Extract active deals from this website. Today is ${todayFormatted()}. Return JSON array.\n\n${websiteText}`;

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'X (Twitter)',
};

export const SOCIAL_MEDIA_USER_PROMPT = (platform: string, postsText: string): string =>
  `Extract active deals from these ${PLATFORM_LABELS[platform] ?? platform} posts. Today is ${todayFormatted()}. Skip expired events. Use most recent version of duplicated deals. Return JSON array.\n\n${postsText}`;

// ─── Layer 2: Deal Comparison & Prioritization ────────────────────────────────

export const DEAL_COMPARISON_SYSTEM_PROMPT = `You merge and deduplicate deals from multiple sources (website, Instagram, Facebook, Twitter) for ONE business. Today is ${todayFormatted()}.

Rules:
- Same promotion worded differently across sources = duplicate. Keep the most recent version.
- Recent social posts (< 2 weeks) override website when conflicting (price, hours).
- Website is the baseline. Social adds to or overrides it.
- DROP: past events, expired promos, one-off social posts > 3 weeks old, deals without pricing.
- KEEP: recurring weekly deals even from older posts, ongoing promos.
- Consolidate overlapping deals into one clean entry.

Output same schema per deal. Return JSON array. Empty array if nothing survives.`;

export const DEAL_COMPARISON_USER_PROMPT = (sourceSections: string): string =>
  `Merge and deduplicate these deals. Today is ${todayFormatted()}. Remove stale/expired. Return JSON array.\n\n${sourceSections}`;
