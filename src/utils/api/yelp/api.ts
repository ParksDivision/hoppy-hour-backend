// src/services/yelp/api.ts
import axios from 'axios';
import { z } from 'zod';
import { yelpLogger as logger } from '../../../lib/logger';
import type { Location } from '../google/api';

// Types and Schemas
export const YelpBusinessSchema = z.object({
  id: z.string(),
  name: z.string(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  location: z.object({
    address1: z.string(),
    city: z.string(),
    state: z.string(),
    zip_code: z.string(),
  }),
  phone: z.string().optional(),
  rating: z.number().optional(),
  price: z.string().optional(),
  url: z.string().url(),
  categories: z.array(z.object({
    alias: z.string(),
    title: z.string(),
  })),
  hours: z.array(z.object({
    open: z.array(z.object({
      start: z.string(),
      end: z.string(),
      day: z.number(),
    })),
  })).optional(),
});

export type YelpBusiness = z.infer<typeof YelpBusinessSchema>;

// Configuration
const API_CONFIG = {
  baseUrl: 'https://api.yelp.com/v3',
  key: process.env.YELP_API_KEY,
  searchLimit: 50, // Maximum allowed by Yelp
  searchRadius: 5000, // 5km in meters
};

// Create axios instance with authentication
const yelpAxios = axios.create({
  baseURL: API_CONFIG.baseUrl,
  headers: {
    Authorization: `Bearer ${API_CONFIG.key}`,
  },
});

// Rate limiting utilities
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // Minimum 100ms between requests

const enforceRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
};

// API Functions
export const searchBusinesses = async (location: Location) => {
  const logContext = { location: location.name };
  
  try {
    logger.debug(logContext, 'Starting Yelp business search');
    await enforceRateLimit();

    const response = await yelpAxios.get('/businesses/search', {
      params: {
        latitude: location.lat,
        longitude: location.lng,
        radius: API_CONFIG.searchRadius,
        categories: 'restaurants,bars',
        limit: API_CONFIG.searchLimit,
      },
    });

    const totalResults = response.data.total;
    const businesses = response.data.businesses;

    logger.info(
      { ...logContext, found: totalResults, retrieved: businesses.length },
      'Successfully retrieved Yelp businesses'
    );

    return businesses;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      logger.error(
        { 
          err: error,
          ...logContext,
          status: error.response.status,
          data: error.response.data
        },
        'Yelp API error'
      );
    } else {
      logger.error(
        { err: error, ...logContext },
        'Failed to fetch Yelp businesses'
      );
    }
    throw error;
  }
};

export const fetchBusinessDetails = async (yelpId: string): Promise<YelpBusiness> => {
  const logContext = { businessId: yelpId };
  
  try {
    logger.debug(logContext, 'Fetching Yelp business details');
    await enforceRateLimit();

    const response = await yelpAxios.get(`/businesses/${yelpId}`);
    
    // Validate response data
    try {
      const business = YelpBusinessSchema.parse(response.data);
      logger.debug(
        { ...logContext, name: business.name },
        'Successfully fetched business details'
      );
      return business;
    } catch (error) {
      logger.error(
        { err: error, ...logContext, data: response.data },
        'Invalid business data received from Yelp'
      );
      throw new YelpError('Invalid business data', 'VALIDATION_ERROR', { error });
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      logger.error(
        { 
          err: error,
          ...logContext,
          status: error.response.status,
          data: error.response.data
        },
        'Yelp API error'
      );
    } else {
      logger.error(
        { err: error, ...logContext },
        'Failed to fetch business details'
      );
    }
    throw error;
  }
};

// Custom error class
export class YelpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'YelpError';
  }
}