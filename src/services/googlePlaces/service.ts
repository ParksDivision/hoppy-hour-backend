/**
 * Google Places Service Layer
 *
 * Handles Google Places API calls, data transformation, and storage.
 * No Zod validation on responses — Google returns valid JSON, Prisma stores it as-is.
 */

import { Prisma } from '@prisma/client';
import googlePlacesApi from './client';
import { googlePlacesConfig } from '../../config/googlePlaces';
import { logger } from '../../utils/logger';
import type {
  GooglePlacesSearchOptions,
  GoogleRawBusinessData,
  Place,
  NearbySearchRequest,
  NearbySearchResponse,
} from './types';

/**
 * Search for nearby places using Google Places API.
 */
export const searchNearbyPlaces = async (
  latitude: number,
  longitude: number,
  options: GooglePlacesSearchOptions = {},
  pageToken?: string
): Promise<NearbySearchResponse> => {
  const {
    radius = googlePlacesConfig.defaults.radius,
    includedTypes = googlePlacesConfig.defaults.includedTypes,
    excludedTypes,
    maxResultCount = googlePlacesConfig.defaults.maxResultCount,
    rankPreference = 'POPULARITY',
    detailLevel = 'basic', // Use basic for search — full details fetched in refresh step
  } = options;

  const requestBody: NearbySearchRequest = {
    locationRestriction: {
      circle: {
        center: { latitude, longitude },
        radius,
      },
    },
    maxResultCount,
    rankPreference,
  };

  if (includedTypes?.length > 0) requestBody.includedTypes = includedTypes;
  if (excludedTypes && excludedTypes.length > 0) requestBody.excludedTypes = excludedTypes;
  if (pageToken) requestBody.pageToken = pageToken;

  const fieldMask = googlePlacesConfig.defaults.fieldMasks[detailLevel].join(',');

  logger.info({ latitude, longitude, radius, detailLevel }, 'Searching nearby places');

  const response = await googlePlacesApi.post('/places:searchNearby', requestBody, {
    headers: { 'X-Goog-FieldMask': fieldMask },
  });

  const data = response.data as NearbySearchResponse;
  logger.info({ resultsCount: data.places?.length ?? 0 }, 'Google Places search completed');
  return data;
};

/**
 * Get detailed information about a specific place.
 */
export const getPlaceDetails = async (
  placeId: string,
  detailLevel: 'basic' | 'standard' | 'detailed' = 'standard'
): Promise<Place> => {
  const placeName = placeId.startsWith('places/') ? placeId : `places/${placeId}`;

  const fieldMask = googlePlacesConfig.defaults.fieldMasks[detailLevel]
    .join(',')
    .replace(/places\./g, '');

  logger.debug({ placeId, detailLevel }, 'Fetching place details');

  const response = await googlePlacesApi.get(`/${placeName}`, {
    headers: { 'X-Goog-FieldMask': fieldMask },
  });

  const place = response.data as Place;
  logger.debug({ placeId, name: place.displayName?.text }, 'Place details retrieved');
  return place;
};

/**
 * Verify Google Places API is accessible.
 */
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await googlePlacesApi.post(
      '/places:searchNearby',
      {
        locationRestriction: {
          circle: {
            center: { latitude: 37.7749, longitude: -122.4194 },
            radius: 100,
          },
        },
        maxResultCount: 1,
      },
      {
        headers: { 'X-Goog-FieldMask': 'places.id' },
        timeout: 5000,
      }
    );
    return response.status === 200;
  } catch {
    return false;
  }
};

/**
 * Transform Google Places data to database format.
 */
export const transformPlaceToBusinessData = (place: Place): GoogleRawBusinessData => {
  return {
    googlePlaceId: place.id ?? null,
    name: place.displayName?.text ?? null,
    addressFull: place.formattedAddress
      ? { formattedAddress: place.formattedAddress }
      : null,
    location: place.location
      ? { latitude: place.location.latitude, longitude: place.location.longitude }
      : null,
    primaryPhone: place.internationalPhoneNumber ?? null,
    uri: place.websiteUri ?? null,
    data: {
      place: place as unknown as Prisma.JsonValue,
      lastUpdated: new Date().toISOString(),
    } as Prisma.JsonValue,
  };
};
