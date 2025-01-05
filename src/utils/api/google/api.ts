// src/services/googlePlaces/api.ts
import axios from 'axios';
import { z } from 'zod';
import { googlePlacesLogger as logger } from '../../../lib/logger';

// Types and Schemas
export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  name: z.string(),
});

export type Location = z.infer<typeof LocationSchema>;

export const PlaceDetailsSchema = z.object({
  place_id: z.string(),
  name: z.string(),
  formatted_address: z.string(),
  geometry: z.object({
    location: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
  }),
  rating: z.number().optional(),
  price_level: z.number().optional(),
  website: z.string().url().optional(),
  formatted_phone_number: z.string().optional(),
  types: z.array(z.string()),
  opening_hours: z.object({
    weekday_text: z.array(z.string()),
  }).optional(),
});

export type PlaceDetails = z.infer<typeof PlaceDetailsSchema>;

// Configuration
const API_CONFIG = {
  baseUrl: 'https://maps.googleapis.com/maps/api/place',
  key: process.env.GOOGLE_PLACES_API_KEY,
  searchRadius: 5000, // 5km radius
};

// Utility functions
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createUrlWithParams = (endpoint: string, params: Record<string, string>) => {
  const searchParams = new URLSearchParams({
    key: API_CONFIG.key!,
    ...params,
  });
  return `${API_CONFIG.baseUrl}/${endpoint}?${searchParams.toString()}`;
};

// API Functions
export const fetchNearbyBusinesses = async (location: Location) => {
  const logContext = { location: location.name };
  let businesses = [];
  let pageToken: string | undefined;

  logger.debug(logContext, 'Starting nearby business search');

  do {
    try {
      if (pageToken) {
        await delay(2000); // Required delay for pagination
        logger.debug({ pageToken }, 'Fetching next page of results');
      }

      const url = createUrlWithParams('nearbysearch/json', {
        location: `${location.lat},${location.lng}`,
        radius: API_CONFIG.searchRadius.toString(),
        type: 'restaurant|bar',
        ...(pageToken && { pagetoken: pageToken }),
      });

      const response = await axios.get(url);
      
      if (response.data.status === 'OVER_QUERY_LIMIT') {
        logger.error(logContext, 'Google Places API quota exceeded');
        throw new Error('API quota exceeded');
      }

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        logger.error({ ...logContext, status: response.data.status }, 'Google Places API error');
        throw new Error(`API error: ${response.data.status}`);
      }
      
      if (response.data.results) {
        businesses.push(...response.data.results);
        logger.debug(
          { count: response.data.results.length, total: businesses.length },
          'Fetched batch of businesses'
        );
      }

      pageToken = response.data.next_page_token;
    } catch (error) {
      logger.error(
        { err: error, location: location.name },
        'Failed to fetch nearby businesses'
      );
      throw error;
    }
  } while (pageToken);

  logger.info(
    { ...logContext, totalFetched: businesses.length },
    'Completed nearby business search'
  );

  return businesses;
};

export const fetchPlaceDetails = async (placeId: string): Promise<PlaceDetails> => {
  const logContext = { placeId };
  
  try {
    logger.debug(logContext, 'Fetching place details');

    const url = createUrlWithParams('details/json', {
      place_id: placeId,
      fields: [
        'name',
        'formatted_address',
        'geometry',
        'rating',
        'price_level',
        'opening_hours',
        'website',
        'formatted_phone_number',
        'types',
      ].join(','),
    });

    const response = await axios.get(url);

    if (response.data.status === 'OVER_QUERY_LIMIT') {
      logger.error(logContext, 'Google Places API quota exceeded');
      throw new Error('API quota exceeded');
    }

    if (response.data.status !== 'OK') {
      logger.error({ ...logContext, status: response.data.status }, 'Failed to fetch place details');
      throw new Error(`API error: ${response.data.status}`);
    }

    // Validate the response data against our schema
    try {
      const details = PlaceDetailsSchema.parse(response.data.result);
      logger.debug({ ...logContext, name: details.name }, 'Successfully fetched place details');
      return details;
    } catch (error) {
      logger.error(
        { err: error, ...logContext, data: response.data.result },
        'Invalid place details data received'
      );
      throw new Error('Invalid place details data');
    }
  } catch (error) {
    logger.error({ err: error, ...logContext }, 'Failed to fetch place details');
    throw error;
  }
};

// Error handling utilities
export class GooglePlacesError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'GooglePlacesError';
  }
}

// Rate limiting utilities
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // Minimum 100ms between requests

const enforceRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }
  
  lastRequestTime = Date.now();
};