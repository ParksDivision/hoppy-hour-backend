/**
 * Shared utilities for filtering and formatting social media content
 * before sending to Claude. Reduces token usage without losing deal info.
 *
 * IMPORTANT: Cast a WIDE net. Better to send a false positive to Claude
 * (wastes a few tokens) than miss a real deal (lost revenue for the user).
 */

/**
 * Keywords that suggest a post might contain deal information.
 * Case-insensitive matching. Intentionally broad — Claude does the real filtering.
 */
const DEAL_KEYWORDS = [
  // pricing signals
  '\\$', '%', '\\boff\\b', '\\bfree\\b', 'discount', 'half', 'bogo', 'special', 'deal',
  'save', 'reduced', 'clearance',
  // time-based deals
  'happy hour', 'hh', 'brunch', 'late night', 'late-night', 'early bird',
  // day-specific
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  // common deal themes
  'taco', 'wing', 'whiskey', 'margarita', 'marg', 'mimosa', 'bloody mary',
  'burger', 'pizza', 'oyster', 'sushi', 'steak', 'rib',
  // promo language
  'promo', 'promotion', 'limited', 'today only', 'tonight', 'this week',
  'all day', 'all night', 'until', 'starting at', 'from',
  'join us', 'come out', 'don.t miss', 'celebrate',
  // night/event themes
  'ladies night', 'guys night', 'trivia', 'karaoke', 'live music', 'dj',
  'game day', 'watch party', 'theme night',
  // food/drink deal terms
  'bucket', 'pitcher', 'draft', 'well', 'domestic', 'import',
  'appetizer', 'app', 'entree', 'combo', 'platter',
  'cocktail', 'beer', 'wine', 'shot', 'drink',
  // loyalty/reward terms
  'punch card', 'reward', 'loyalty', 'vip', 'member',
  // numbers that suggest pricing
  '\\b\\d+\\.\\d{2}\\b', // "3.50", "12.99"
  '\\b\\d+\\s*(?:dollar|buck)', // "5 dollar", "3 bucks"
  // time patterns that suggest event/deal hours
  '\\b\\d{1,2}(?:am|pm|\\s*-\\s*\\d{1,2}(?:am|pm))', // "4pm", "3-6pm", "3pm - 7pm"
];

const DEAL_PATTERN = new RegExp(DEAL_KEYWORDS.join('|'), 'i');

/**
 * Check if text likely contains deal-related content.
 * Returns true if any deal keyword is found.
 */
export function likelyContainsDeal(text: string | null): boolean {
  if (!text) return false;
  return DEAL_PATTERN.test(text);
}

/**
 * Format a date concisely for Claude prompts. Saves ~30 tokens per post.
 * "2026-03-20T18:00:00Z" → "Mar 20"
 */
export function shortDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
