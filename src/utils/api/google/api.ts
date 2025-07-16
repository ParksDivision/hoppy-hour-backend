import dotenv from 'dotenv';
dotenv.config();
/* -------------------------IMPORTS------------------------- */
import axios from 'axios';
import { z } from 'zod';
import { googlePlacesLogger as logger } from '../../../utils/logger/logger';
import { PlaceDetailsSchema } from './enums';

/* -------------------------TYPES AND SCHEMAS------------------------- */
export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  name: z.string(),
});

export type Location = z.infer<typeof LocationSchema>;

export type PlaceDetails = z.infer<typeof PlaceDetailsSchema>;

// GooglePlaces API Configuration
const API_CONFIG = {
  baseUrl: 'https://places.googleapis.com/v1/places',
  key: process.env.GOOGLE_PLACES_API_KEY,
  searchRadius: 4828,
};

// search param interface for location input to build query
interface SearchParams {
  latitude: number;
  longitude: number;
  radius: number;
  types?: string[];
  pagetoken?: string;
}

/* -------------------------FUNCTIONS------------------------- */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createPlacesRequest = (endpoint: string, params: SearchParams) => {
  return {
    url: `${API_CONFIG.baseUrl}:${endpoint}`,
    config: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_CONFIG.key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.types,places.nationalPhoneNumber,places.websiteUri,places.photos'
      },
      data: {
        locationRestriction: {
          circle: {
            center: {
              latitude: params.latitude,
              longitude: params.longitude
            },
            radius: params.radius
          }
        },
        ...(params.types && { includedTypes: params.types }),
        ...(params.pagetoken && { pagetoken: params.pagetoken })
      }
    }
  };
};

// API Functions
export const fetchNearbyBusinesses = async (location: Location) => {
  const logContext = { location: location.name };
  let businesses: any[] = [];
  let pagetoken: string | undefined;

  logger.debug(logContext, 'Starting nearby business search');

  do {
    try {
      if (pagetoken) {
        await delay(6000); // Required delay for pagination
        logger.debug({ pagetoken }, 'Fetching next page of results');
      }

      const { url, config } = createPlacesRequest('searchNearby', {
        latitude: location.lat,
        longitude: location.lng,
        radius: API_CONFIG.searchRadius,
        types: ['bar',
          'bar_and_grill',
          'fine_dining_restaurant',
          'pub',
          'restaurant',
          'wine_bar'],
        pagetoken,
      });

      const response = await axios({
        method: 'POST',
        url: url,
        headers: config.headers,
        data: config.data
      });
      
      if (response.data.places) {
        businesses.push(...response.data.places);
        logger.debug(
          { count: response.data.places.length, total: businesses.length },
          'Fetched batch of businesses'
        );
      }
      // logger.info(response.data);
      pagetoken = response.data.next_page_token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          logger.error(logContext, 'Google Places API quota exceeded');
          throw new Error('API quota exceeded');
        }
        logger.error({ 
          ...logContext, 
          status: error.response?.status,
          message: error.response?.data?.error?.message 
        }, 'Google Places API error');
        throw new Error(`API error: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  } while (pagetoken);

  logger.info(
    { ...logContext, totalFetched: businesses.length },
    'Completed nearby business search'
  );

  return businesses;
};

// TODO: fix this place detail retrieval function
// export const fetchPlaceDetails = async (placeId: string): Promise<PlaceDetails> => {
//   const logContext = { placeId };
  
//   try {
//     logger.debug(logContext, 'Fetching place details');

//     const url = createUrlWithParams('details/json', {
//       place_id: placeId,
//       fields: [
//         'name',
//         'formatted_address',
//         'geometry',
//         'rating',
//         'price_level',
//         'opening_hours',
//         'website',
//         'formatted_phone_number',
//         'types',
//       ].join(','),
//     });

//     const response = await axios.get(url);

//     if (response.data.status === 'OVER_QUERY_LIMIT') {
//       logger.error(logContext, 'Google Places API quota exceeded');
//       throw new Error('API quota exceeded');
//     }

//     if (response.data.status !== 'OK') {
//       logger.error({ ...logContext, status: response.data.status }, 'Failed to fetch place details');
//       throw new Error(`API error: ${response.data.status}`);
//     }

//     // Validate the response data against our schema
//     try {
//       const details = PlaceDetailsSchema.parse(response.data.result);
//       logger.debug({ ...logContext, name: details.name }, 'Successfully fetched place details');
//       return details;
//     } catch (error) {
//       logger.error(
//         { err: error, ...logContext, data: response.data.result },
//         'Invalid place details data received'
//       );
//       throw new Error('Invalid place details data');
//     }
//   } catch (error) {
//     logger.error({ err: error, ...logContext }, 'Failed to fetch place details');
//     throw error;
//   }
// };

/* -------------------------ERROR HANDLING------------------------- */
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

/* -------------------------RATE LIMITING------------------------- */
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