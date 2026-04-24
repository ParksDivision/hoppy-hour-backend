/**
 * Cloudflare R2 Configuration
 *
 * R2 uses the S3-compatible API. Zero egress fees.
 * Used for caching Google Places photos.
 */
export const r2Config = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'hoppyhour',
  get endpoint() {
    return `https://${this.accountId}.r2.cloudflarestorage.com`;
  },
  /** Max photos to cache per business */
  maxPhotosPerBusiness: 10,
};
