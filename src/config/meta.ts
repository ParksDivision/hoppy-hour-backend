/**
 * Meta Platform API Configuration (Instagram + Facebook)
 *
 * Both Instagram Graph API and Facebook Graph API use the same
 * Meta access token and base URL.
 */
export const metaConfig = {
  accessToken: process.env.META_ACCESS_TOKEN,
  instagramBusinessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
  graphApiVersion: 'v21.0',
  graphApiBaseUrl: 'https://graph.facebook.com',
  postsPerRequest: 100,
  timeout: 30000,
};
