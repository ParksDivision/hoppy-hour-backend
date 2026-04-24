import { Prisma } from '@prisma/client';

export interface GooglePlacesSearchOptions {
  radius?: number;
  includedTypes?: string[];
  excludedTypes?: string[];
  maxResultCount?: number;
  rankPreference?: 'POPULARITY' | 'DISTANCE';
  detailLevel?: 'basic' | 'standard' | 'detailed';
}

export interface GoogleRawBusinessData {
  googlePlaceId: string | null;
  name: string | null;
  addressFull: Prisma.JsonValue | null;
  location: Prisma.JsonValue | null;
  primaryPhone: string | null;
  uri: string | null;
  data: Prisma.JsonValue | null;
}

/** Google Places API place object — loosely typed, stored as JSON */
export interface Place {
  name?: string;
  id?: string;
  displayName?: { text: string; languageCode?: string };
  types?: string[];
  primaryType?: string;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  businessStatus?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  photos?: Array<{ name: string; widthPx?: number; heightPx?: number; [key: string]: unknown }>;
  currentOpeningHours?: Record<string, unknown>;
  regularOpeningHours?: Record<string, unknown>;
  editorialSummary?: { text: string; languageCode?: string };
  reviews?: unknown[];
  servesBeer?: boolean;
  servesWine?: boolean;
  servesCocktails?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesLunch?: boolean;
  servesDinner?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  dineIn?: boolean;
  curbsidePickup?: boolean;
  reservable?: boolean;
  outdoorSeating?: boolean;
  liveMusic?: boolean;
  paymentOptions?: Record<string, unknown>;
  parkingOptions?: Record<string, unknown>;
  accessibilityOptions?: Record<string, unknown>;
  [key: string]: unknown; // Accept any additional fields Google returns
}

export interface NearbySearchRequest {
  locationRestriction: {
    circle: {
      center: { latitude: number; longitude: number };
      radius: number;
    };
  };
  maxResultCount?: number;
  rankPreference?: string;
  includedTypes?: string[];
  excludedTypes?: string[];
  pageToken?: string;
}

export interface NearbySearchResponse {
  places?: Place[];
  nextPageToken?: string;
}
