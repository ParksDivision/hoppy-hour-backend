// src/services/yelp/api.ts
import axios from 'axios';
import { z } from 'zod';
import { logger } from '../../../utils/logger/logger';
import type { Location } from '../google/enums';

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

const API_CONFIG = {
  baseUrl: 'https://api.yelp.com/v3',
  key: process.env.YELP_API_KEY,
  searchLimit: 50, // Max allowed by Yelp
};

const yelpAxios = axios.create({
  baseURL: API_CONFIG.baseUrl,
  headers: {
    Authorization: `Bearer ${API_CONFIG.key}`,
  },
});

export const searchBusinesses = async (location: Location) => {
  try {
    const response = await yelpAxios.get('/businesses/search', {
      params: {
        latitude: location.lat,
        longitude: location.lng,
        radius: 5000, // 5km
        categories: 'restaurants,bars',
        limit: API_CONFIG.searchLimit,
      },
    });

    return response.data.businesses;
  } catch (error) {
    logger.error(`Error fetching Yelp businesses for ${location.name}:`, error);
    throw error;
  }
};

export const fetchBusinessDetails = async (yelpId: string): Promise<YelpBusiness> => {
  try {
    const response = await yelpAxios.get(`/businesses/${yelpId}`);
    return YelpBusinessSchema.parse(response.data);
  } catch (error) {
    logger.error(`Error fetching Yelp business details for ${yelpId}:`, error);
    throw error;
  }
};