/**
 * X (Twitter) API v2 Configuration
 */
export const twitterConfig = {
  bearerToken: process.env.TWITTER_BEARER_TOKEN,
  apiBaseUrl: 'https://api.x.com',
  tweetsPerRequest: 100,
  timeout: 30000,
};
