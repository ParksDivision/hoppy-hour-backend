import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import { r2Config } from '../../config/cloudflareR2';
import { logger } from '../../utils/logger';

const s3 = new S3Client({
  region: 'auto',
  endpoint: r2Config.endpoint,
  credentials: {
    accessKeyId: r2Config.accessKeyId ?? '',
    secretAccessKey: r2Config.secretAccessKey ?? '',
  },
});

const GOOGLE_PHOTO_BASE = 'https://places.googleapis.com/v1';
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

/**
 * Build the R2 storage key for a photo.
 * Format: photos/{placeId}/{index}.jpg
 */
function photoKey(placeId: string, index: number): string {
  return `photos/${placeId}/${index}.jpg`;
}

/**
 * Check if a photo exists in R2 cache.
 */
async function existsInR2(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: r2Config.bucketName, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch a photo from R2 cache. Returns the image buffer + content type, or null if not cached.
 */
export async function getPhotoFromCache(placeId: string, index: number): Promise<{
  body: Buffer;
  contentType: string;
} | null> {
  const key = photoKey(placeId, index);

  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: r2Config.bucketName, Key: key }));

    if (!response.Body) return null;

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return {
      body: Buffer.concat(chunks),
      contentType: response.ContentType ?? 'image/jpeg',
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a photo from Google Places API and cache it in R2.
 * Returns the image buffer + content type.
 */
export async function fetchAndCachePhoto(
  photoName: string,
  placeId: string,
  index: number,
  maxWidthPx: number = 800
): Promise<{ body: Buffer; contentType: string }> {
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured');
  }

  // Fetch from Google Places Photo API
  const url = `${GOOGLE_PHOTO_BASE}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${GOOGLE_API_KEY}`;

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15000,
  });

  const body = Buffer.from(response.data);
  const contentType = response.headers['content-type'] ?? 'image/jpeg';
  const key = photoKey(placeId, index);

  // Store in R2
  await s3.send(new PutObjectCommand({
    Bucket: r2Config.bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  logger.debug({ placeId, index, key, size: body.length }, 'Cached photo to R2');

  return { body, contentType };
}

/**
 * Get a photo — from R2 cache if available, otherwise fetch from Google and cache.
 */
export async function getPhoto(
  photoName: string,
  placeId: string,
  index: number,
  maxWidthPx: number = 800
): Promise<{ body: Buffer; contentType: string }> {
  // Try cache first
  const cached = await getPhotoFromCache(placeId, index);
  if (cached) return cached;

  // Cache miss — fetch from Google and store
  return fetchAndCachePhoto(photoName, placeId, index, maxWidthPx);
}

interface GooglePhoto {
  name: string;
  widthPx?: number;
  heightPx?: number;
}

/**
 * Pre-fetch and cache all photos for a business (up to maxPhotosPerBusiness).
 * Skips photos that are already cached. Called during pipeline ingestion.
 * Returns the count of newly cached photos.
 */
export async function prefetchBusinessPhotos(
  placeId: string,
  photos: GooglePhoto[]
): Promise<number> {
  const toCache = photos.slice(0, r2Config.maxPhotosPerBusiness);
  let newlyCached = 0;

  for (let i = 0; i < toCache.length; i++) {
    const photo = toCache[i]!;
    const key = photoKey(placeId, i);

    // Skip if already cached
    if (await existsInR2(key)) continue;

    try {
      await fetchAndCachePhoto(photo.name, placeId, i);
      newlyCached++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn({ placeId, index: i, error: msg }, 'Failed to cache photo, skipping');
    }
  }

  if (newlyCached > 0) {
    logger.info({ placeId, newlyCached, total: toCache.length }, 'Pre-fetched business photos');
  }

  return newlyCached;
}
