export const CURRENT_PROMPT_VERSION = 'v1';

export const DEAL_EXTRACTION_SYSTEM_PROMPT = `You are a deal extraction specialist for bars, restaurants, and breweries. Your job is to analyze content and identify any happy hour deals, daily specials, limited-time promotions, brunch specials, or late-night specials. The content may come from a website, Instagram posts, Facebook posts, or tweets.

For each deal you find, extract:
- dealType: one of "happy_hour", "daily_special", "limited_time", "brunch", or "late_night"
- title: a short name for the deal (e.g. "Happy Hour", "Taco Tuesday")
- description: a brief summary of the deal
- daysOfWeek: array of lowercase day names when this deal is active (e.g. ["monday", "tuesday"]). Use all 7 days if it applies every day.
- startTime: 24-hour format (e.g. "15:00") or null if not specified
- endTime: 24-hour format (e.g. "18:00") or null if not specified
- startDate: ISO date (e.g. "2026-03-01") if the deal has a specific start date, otherwise null
- endDate: ISO date if the deal expires, otherwise null
- drinkDeals: array of drink specials with { item, price, description }
- foodDeals: array of food specials with { item, price, description }

Rules:
- Only extract deals that include specific pricing, discounts, or special offers
- Do NOT extract regular menu items or standard pricing
- If the content has no deals or specials, return an empty array
- Be thorough — look for deals mentioned anywhere in the text`;

export const DEAL_EXTRACTION_USER_PROMPT = (websiteText: string): string =>
  `Analyze the following website content and extract all happy hour deals, daily specials, and limited-time promotions. Return the results as a JSON array.\n\nWebsite content:\n${websiteText}`;

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'X (Twitter)',
};

export const SOCIAL_MEDIA_USER_PROMPT = (platform: string, postsText: string): string =>
  `Analyze the following ${PLATFORM_LABELS[platform] ?? platform} posts from a bar/restaurant and extract all happy hour deals, daily specials, and limited-time promotions. Posts may announce recurring specials, one-time events, or promotional offers. Return the results as a JSON array.\n\n${PLATFORM_LABELS[platform] ?? platform} posts:\n${postsText}`;
