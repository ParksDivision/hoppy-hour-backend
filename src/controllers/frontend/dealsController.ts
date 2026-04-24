import { Request, Response } from 'express';
import {
  findProductionBusinessesWithDeals,
  countProductionBusinesses,
} from '../../repositories/frontendDealsRepository';
import { logger } from '../../utils/logger';

interface GooglePlacesData {
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: {
    periods?: Array<{
      open?: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
  };
  regularOpeningHours?: {
    periods?: Array<{
      open?: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
  };
  dineIn?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  outdoorSeating?: boolean;
  liveMusic?: boolean;
  reservable?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesLunch?: boolean;
  servesDinner?: boolean;
  servesBeer?: boolean;
  servesWine?: boolean;
  servesCocktails?: boolean;
  photos?: Array<{
    name: string;
    widthPx?: number;
    heightPx?: number;
  }>;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatHours(data: GooglePlacesData): Array<{ day: string; open: string; close: string }> | null {
  const periods = data.currentOpeningHours?.periods ?? data.regularOpeningHours?.periods;
  if (!periods || periods.length === 0) return null;

  const hours: Array<{ day: string; open: string; close: string }> = [];

  for (const period of periods) {
    if (!period.open) continue;
    const day = DAY_NAMES[period.open.day] ?? 'unknown';
    const open = `${pad(period.open.hour)}:${pad(period.open.minute)}`;
    const close = period.close
      ? `${pad(period.close.hour)}:${pad(period.close.minute)}`
      : '23:59';
    hours.push({ day, open, close });
  }

  return hours.length > 0 ? hours : null;
}

function transformBusiness(row: {
  id: string;
  googleRawBusinessId: string;
  businessName: string | null;
  primarySource: string | null;
  deals: unknown;
  publishedAt: Date | null;
  googleRawBusiness: {
    id: string;
    googlePlaceId: string | null;
    name: string | null;
    addressFull: unknown;
    location: unknown;
    primaryPhone: string | null;
    uri: string | null;
    data: unknown;
    socialLinks: {
      websiteUrl: string | null;
      facebookUrl: string | null;
      instagramUrl: string | null;
      twitterUrl: string | null;
    } | null;
  };
}) {
  const biz = row.googleRawBusiness;
  // Google Places data is nested under data.place
  const rawData = biz.data as { place?: GooglePlacesData } | null;
  const gData = rawData?.place ?? ({} as GooglePlacesData);
  const loc = biz.location as { latitude: number; longitude: number } | null;

  // displayName is { text: string, languageCode: string }
  const displayName = gData.displayName as { text?: string } | undefined;
  // priceLevel may have PRICE_LEVEL_ prefix from Google API
  const priceLevel = gData.priceLevel?.replace('PRICE_LEVEL_', '') ?? null;

  return {
    id: biz.id,
    name: displayName?.text ?? biz.name ?? row.businessName,
    googlePlaceId: biz.googlePlaceId,

    formattedAddress: gData.formattedAddress ?? null,
    location: loc ?? null,

    phone: gData.nationalPhoneNumber ?? gData.internationalPhoneNumber ?? biz.primaryPhone ?? null,
    websiteUrl: gData.websiteUri ?? biz.uri ?? null,
    googleMapsUrl: gData.googleMapsUri ?? null,
    socialLinks: {
      instagram: biz.socialLinks?.instagramUrl ?? null,
      facebook: biz.socialLinks?.facebookUrl ?? null,
      twitter: biz.socialLinks?.twitterUrl ?? null,
    },

    primaryType: gData.primaryType ?? null,
    rating: gData.rating ?? null,
    reviewCount: gData.userRatingCount ?? null,
    priceLevel,

    hours: formatHours(gData),

    amenities: {
      dineIn: gData.dineIn ?? null,
      takeout: gData.takeout ?? null,
      delivery: gData.delivery ?? null,
      outdoorSeating: gData.outdoorSeating ?? null,
      liveMusic: gData.liveMusic ?? null,
      reservable: gData.reservable ?? null,
      servesBreakfast: gData.servesBreakfast ?? null,
      servesBrunch: gData.servesBrunch ?? null,
      servesLunch: gData.servesLunch ?? null,
      servesDinner: gData.servesDinner ?? null,
      servesBeer: gData.servesBeer ?? null,
      servesWine: gData.servesWine ?? null,
      servesCocktails: gData.servesCocktails ?? null,
    },

    photos: (gData.photos ?? []).slice(0, 10).map((p, i) => ({
      url: `/api/photos/${biz.googlePlaceId}/${i}`,
      widthPx: p.widthPx ?? null,
      heightPx: p.heightPx ?? null,
    })),

    dealSource: row.primarySource,
    dealsPublishedAt: row.publishedAt?.toISOString() ?? null,
    deals: Array.isArray(row.deals) ? row.deals : [],
  };
}

/**
 * GET /api/deals/austin
 * Frontend endpoint: returns all Austin businesses with published production deals,
 * enriched with business details, photos, hours, amenities, and social links.
 */
export const getAustinDeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const [rows, total] = await Promise.all([
      findProductionBusinessesWithDeals({ limit, offset }),
      countProductionBusinesses(),
    ]);

    const businesses = rows.map(transformBusiness);

    res.json({
      city: 'austin',
      count: total,
      limit,
      offset,
      businesses,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch Austin deals');
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
};
