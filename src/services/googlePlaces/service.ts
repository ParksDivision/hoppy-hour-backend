/**
 * Google Places Service Layer
 *
 * This file contains the main business logic for interacting with the Google Places API.
 * It provides high-level functions that abstract away the complexity of the Google Places API,
 * handling request building, validation, error handling, and data transformation.
 *
 * Key responsibilities:
 * - Build and validate Google Places API requests
 * - Make API calls using the configured HTTP client
 * - Transform raw API responses into our application's data structures
 * - Provide utility function for health check
 */

import { z } from 'zod';
import googlePlacesApi from './client';
import { googlePlacesConfig } from '../../config/googlePlaces';
import { logger } from '../../utils/logger';
import {
  NearbySearchRequestSchema,
  NearbySearchResponseSchema,
  PlaceSchema,
} from '../../schemas/googlePlaces.schema';
import type {
  GooglePlacesSearchOptions,
  GoogleRawBusinessData,
  Place,
  NearbySearchRequest,
  NearbySearchResponse,
} from './types';

/**
 * MAIN SERVICE FUNCTION: Search for nearby places using Google Places API
 *
 * @param latitude - Center point latitude for search
 * @param longitude - Center point longitude for search
 * @param options - Optional search configuration (radius, types, etc.)
 * @param pageToken - Optional token for fetching next page of results
 * @returns Promise resolving to validated places data
 */
export const searchNearbyPlaces = async (
  latitude: number,
  longitude: number,
  options: GooglePlacesSearchOptions = {},
  pageToken?: string
): Promise<NearbySearchResponse> => {
  try {
    // define options
    const {
      radius = googlePlacesConfig.defaults.radius,
      includedTypes = googlePlacesConfig.defaults.includedTypes,
      excludedTypes,
      maxResultCount = googlePlacesConfig.defaults.maxResultCount,
      rankPreference = 'POPULARITY',
      detailLevel = 'standard',
    } = options;

    // create request body
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

    // add optional fields if provided
    if (includedTypes?.length > 0) {
      requestBody.includedTypes = includedTypes;
    }
    if (excludedTypes && excludedTypes.length > 0) {
      requestBody.excludedTypes = excludedTypes;
    }
    if (pageToken) {
      requestBody.pageToken = pageToken;
    }

    // validate request body
    const validatedRequest = NearbySearchRequestSchema.parse(requestBody);

    // list which fields to request from google places api
    const fieldMask = googlePlacesConfig.defaults.fieldMasks[detailLevel].join(',');

    // log the search start for debugging and progress tracking
    logger.info(
      {
        latitude,
        longitude,
        radius,
        detailLevel,
      },
      'Searching nearby places'
    );

    // api call to google places
    const response = await googlePlacesApi.post('/places:searchNearby', validatedRequest, {
      headers: {
        'X-Goog-FieldMask': fieldMask,
      },
    });

    // validate response
    const validatedResponse = NearbySearchResponseSchema.parse(response.data);

    // log completion
    logger.info(
      {
        resultsCount: validatedResponse.places?.length ?? 0,
      },
      'Google Places search completed'
    );

    return validatedResponse;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error({ error: error.issues }, 'Response validation failed');
      throw new Error('Invalid response from Google Places API');
    }
    throw new Error(`Error: ${error}`);
  }
};

/**
 * PLACE DETAILS FUNCTION: Get comprehensive information about a specific place
 *
 * @param placeId - Google Place ID (with or without 'places/' prefix)
 * @param detailLevel - How much information to fetch (basic/standard/detailed)
 * @returns Promise resolving to detailed place information
 */
export const getPlaceDetails = async (
  placeId: string,
  detailLevel: 'basic' | 'standard' | 'detailed' = 'standard'
): Promise<Place> => {
  try {
    // normalize place id
    const placeName = placeId.startsWith('places/') ? placeId : `places/${placeId}`;

    // build field mask, removing /places prefix for this endpoint structure
    const fieldMask = googlePlacesConfig.defaults.fieldMasks[detailLevel]
      .join(',')
      .replace(/places\./g, '');

    // log fetch start
    logger.debug({ placeId, detailLevel }, 'Fetching place details');

    // api call
    const response = await googlePlacesApi.get(`/${placeName}`, {
      headers: {
        'X-Goog-FieldMask': fieldMask,
      },
    });

    // validate response
    const validatedPlace = PlaceSchema.parse(response.data);

    // log data retrieval
    logger.debug(
      {
        placeId,
        placeName: validatedPlace.displayName?.text,
      },
      'Place details retrieved'
    );

    return validatedPlace;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error({ error: error.issues, placeId }, 'Response validation failed');
      throw new Error('Invalid place details from Google Places API');
    }
    throw new Error(`Error: ${error}`);
  }
};

/**
 * HEALTH CHECK FUNCTION: Verify Google Places API is accessible
 *
 * @returns Promise resolving to true if API is healthy, false otherwise
 */
export const checkHealth = async (): Promise<boolean> => {
  try {
    /// minimal search to check availability of api
    const response = await googlePlacesApi.post(
      '/places:searchNearby',
      {
        locationRestriction: {
          circle: {
            center: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
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

    // If we get a 200 response, the API is working
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

/**
 * DATA TRANSFORMATION FUNCTION: Convert Google Places data to our database format
 *
 * @param place - Raw place object from Google Places API
 * @returns Transformed data ready for database storage
 */
export const transformPlaceToBusinessData = (place: Place): GoogleRawBusinessData => {
  return {
    // extract Google Place ID for deduplication
    googlePlaceId: place.id ?? null,

    // extract name
    name: place.displayName?.text ?? null,

    // extract formatted address
    addressFull: place.formattedAddress
      ? {
          formattedAddress: place.formattedAddress,
        }
      : null,

    // separate location data
    location: place.location
      ? {
          latitude: place.location.latitude,
          longitude: place.location.longitude,
        }
      : null,

    // extract phone and uri
    primaryPhone: place.internationalPhoneNumber ?? null,
    uri: place.websiteUri ?? null,

    // store raw place data in data field
    data: {
      place, // Complete Google Places object
      lastUpdated: new Date().toISOString(), // When we fetched this data
    },
  };
};
