import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2Config } from '../../config/cloudflareR2';
import { fetchAndCachePhoto } from './service';
import { logger } from '../../utils/logger';

const s3 = new S3Client({
  region: 'auto',
  endpoint: r2Config.endpoint,
  credentials: {
    accessKeyId: r2Config.accessKeyId ?? '',
    secretAccessKey: r2Config.secretAccessKey ?? '',
  },
});

interface GooglePhoto {
  name: string;
  widthPx?: number;
  heightPx?: number;
}

/**
 * List all photo keys in R2 for a given placeId.
 * Returns set of keys like "photos/ChIJ.../0.jpg"
 */
async function listCachedPhotos(placeId: string): Promise<Set<string>> {
  const prefix = `photos/${placeId}/`;
  const keys = new Set<string>();

  try {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: r2Config.bucketName,
      Prefix: prefix,
    }));

    for (const obj of response.Contents ?? []) {
      if (obj.Key) keys.add(obj.Key);
    }
  } catch {
    // Bucket may not have this prefix yet — that's fine
  }

  return keys;
}

/**
 * Delete a single photo from R2.
 */
async function deleteFromR2(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: r2Config.bucketName, Key: key }));
    logger.debug({ key }, 'Deleted stale photo from R2');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn({ key, error: msg }, 'Failed to delete photo from R2');
  }
}

/**
 * Sync photos for a business: add new, skip unchanged, delete removed.
 *
 * Compares current Google photo refs against what's in R2:
 * - New photo index → fetch from Google and cache
 * - Same index exists in R2 → skip (no Google API call)
 * - R2 has photos beyond current count → delete (business removed photos)
 *
 * Returns stats on what changed.
 */
export async function syncBusinessPhotos(
  placeId: string,
  photos: GooglePhoto[]
): Promise<{ added: number; deleted: number; skipped: number }> {
  const toSync = photos.slice(0, r2Config.maxPhotosPerBusiness);
  const cachedKeys = await listCachedPhotos(placeId);

  let added = 0;
  let skipped = 0;
  let deleted = 0;

  // Sync current photos (add new, skip existing)
  const expectedKeys = new Set<string>();
  for (let i = 0; i < toSync.length; i++) {
    const key = `photos/${placeId}/${i}.jpg`;
    expectedKeys.add(key);

    if (cachedKeys.has(key)) {
      skipped++;
      continue;
    }

    // New photo — fetch and cache
    try {
      await fetchAndCachePhoto(toSync[i]!.name, placeId, i);
      added++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn({ placeId, index: i, error: msg }, 'Failed to sync photo, skipping');
    }
  }

  // Delete photos that no longer exist (business removed them or we reduced maxPhotos)
  for (const cachedKey of cachedKeys) {
    if (!expectedKeys.has(cachedKey)) {
      await deleteFromR2(cachedKey);
      deleted++;
    }
  }

  if (added > 0 || deleted > 0) {
    logger.info({ placeId, added, deleted, skipped }, 'Synced business photos');
  }

  return { added, deleted, skipped };
}
