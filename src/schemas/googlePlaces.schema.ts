import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

// ============================================
// Base Types with OpenAPI Metadata
// ============================================

export const LatLngSchema = z
  .object({
    latitude: z.number().min(-90).max(90).openapi({
      description: 'Latitude coordinate',
      example: 30.2672,
    }),
    longitude: z.number().min(-180).max(180).openapi({
      description: 'Longitude coordinate',
      example: -97.7431,
    }),
  })
  .openapi({
    description: 'Geographic coordinates',
  });

export const LocalizedTextSchema = z
  .object({
    text: z.string().openapi({
      example: 'The Roosevelt Room',
    }),
    languageCode: z.string().length(2).openapi({
      example: 'en',
      description: 'ISO 639-1 language code',
    }),
  })
  .openapi({
    description: 'Localized text with language code',
  });

// ============================================
// Enums with OpenAPI
// ============================================

export const PriceLevelEnum = z
  .enum([
    'PRICE_LEVEL_UNSPECIFIED',
    'PRICE_LEVEL_FREE',
    'PRICE_LEVEL_INEXPENSIVE',
    'PRICE_LEVEL_MODERATE',
    'PRICE_LEVEL_EXPENSIVE',
    'PRICE_LEVEL_VERY_EXPENSIVE',
  ])
  .openapi({
    description: 'Price level of the establishment',
    example: 'PRICE_LEVEL_MODERATE',
  });

export const BusinessStatusEnum = z
  .enum(['BUSINESS_STATUS_UNSPECIFIED', 'OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'])
  .openapi({
    description: 'Operational status of the business',
    example: 'OPERATIONAL',
  });

export const RankPreferenceEnum = z.enum(['POPULARITY', 'DISTANCE']).openapi({
  description: 'Ranking preference for search results',
  example: 'DISTANCE',
});

export const PlaceTypeEnum = z
  .enum([
    'bar',
    'restaurant',
    'night_club',
    'cafe',
    'brewery',
    'wine_bar',
    'cocktail_bar',
    'pub',
    'food',
    'meal_takeaway',
    'meal_delivery',
    'bakery',
    'liquor_store',
  ])
  .openapi({
    description: 'Type of establishment',
    example: 'bar',
  });

// ============================================
// Place Schema Components
// ============================================

export const PhotoSchema = z
  .object({
    name: z.string().openapi({
      example: 'places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/ATplDJZY',
    }),
    widthPx: z.number().positive().openapi({ example: 4032 }),
    heightPx: z.number().positive().openapi({ example: 3024 }),
    authorAttributions: z
      .array(
        z.object({
          displayName: z.string(),
          uri: z.string().url().optional(),
          photoUri: z.string().url().optional(),
        })
      )
      .default([]),
  })
  .openapi({
    description: 'Photo information',
  });

export const OpeningHoursSchema = z
  .object({
    openNow: z.boolean().optional(),
    periods: z
      .array(
        z.object({
          open: z.object({
            day: z.number().int().min(0).max(6),
            hour: z.number().int().min(0).max(23),
            minute: z.number().int().min(0).max(59),
          }),
          close: z
            .object({
              day: z.number().int().min(0).max(6),
              hour: z.number().int().min(0).max(23),
              minute: z.number().int().min(0).max(59),
            })
            .optional(),
        })
      )
      .optional(),
    weekdayDescriptions: z.array(z.string()).optional(),
  })
  .openapi({
    description: 'Business operating hours',
  });

// ============================================
// Main Place Schema
// ============================================

export const PlaceSchema = z
  .object({
    name: z.string().optional().openapi({
      description: 'Resource name in format: places/PLACE_ID',
      example: 'places/ChIJN1t_tDeuEmsRUsoyG83frY4',
    }),
    id: z.string().optional().openapi({
      description: 'Place ID',
      example: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    }),
    displayName: LocalizedTextSchema.optional(),
    types: z
      .array(z.string())
      .optional()
      .openapi({
        example: ['bar', 'restaurant', 'food', 'point_of_interest'],
      }),
    primaryType: z.string().optional().openapi({ example: 'bar' }),
    formattedAddress: z.string().optional().openapi({
      example: '607 Trinity St, Austin, TX 78701, USA',
    }),
    location: LatLngSchema.optional(),
    rating: z.number().min(1).max(5).optional().openapi({ example: 4.6 }),
    userRatingCount: z.number().int().nonnegative().optional().openapi({ example: 1234 }),
    priceLevel: PriceLevelEnum.optional(),
    businessStatus: BusinessStatusEnum.optional(),
    googleMapsUri: z.string().url().optional().openapi({
      example: 'https://maps.google.com/?cid=12345',
    }),
    websiteUri: z.string().url().optional().openapi({
      example: 'https://www.example-bar.com',
    }),
    internationalPhoneNumber: z.string().optional().openapi({ example: '+1 512-555-0123' }),
    photos: z.array(PhotoSchema).optional(),
    currentOpeningHours: OpeningHoursSchema.optional(),
    regularOpeningHours: OpeningHoursSchema.optional(),

    // Food & Drink attributes
    servesBeer: z.boolean().optional(),
    servesWine: z.boolean().optional(),
    servesCocktails: z.boolean().optional(),
    servesBreakfast: z.boolean().optional(),
    servesBrunch: z.boolean().optional(),
    servesLunch: z.boolean().optional(),
    servesDinner: z.boolean().optional(),

    // Service options
    takeout: z.boolean().optional(),
    delivery: z.boolean().optional(),
    dineIn: z.boolean().optional(),
    reservable: z.boolean().optional(),
    outdoorSeating: z.boolean().optional(),
    liveMusic: z.boolean().optional(),
  })
  .openapi({
    title: 'Place',
    description: 'Google Places API place object',
  });

// ============================================
// Request Schemas
// ============================================

export const NearbySearchRequestSchema = z
  .object({
    locationRestriction: z
      .object({
        circle: z.object({
          center: LatLngSchema,
          radius: z.number().positive().max(50000).default(1694).openapi({
            description: 'Search radius in meters (default: 1694m = ~1 mile)',
            example: 1694,
          }),
        }),
      })
      .openapi({
        description: 'Geographic search area',
      }),
    includedTypes: z
      .array(z.string())
      .max(50)
      .optional()
      .openapi({
        description: 'Place types to include in search',
        example: ['bar', 'restaurant'],
      }),
    excludedTypes: z.array(z.string()).max(50).optional().openapi({
      description: 'Place types to exclude from search',
    }),
    maxResultCount: z.number().int().min(1).max(20).default(20).openapi({
      description: 'Maximum number of results to return',
      example: 10,
    }),
    rankPreference: RankPreferenceEnum.default('POPULARITY').openapi({
      description: 'How to rank the results',
    }),
    languageCode: z.string().length(2).optional().openapi({
      description: 'Language for results',
      example: 'en',
    }),
    regionCode: z.string().length(2).optional().openapi({
      description: 'Region code for result formatting',
      example: 'US',
    }),
  })
  .openapi({
    title: 'NearbySearchRequest',
    description: 'Request body for nearby search',
  });

export const NearbySearchResponseSchema = z
  .object({
    places: z.array(PlaceSchema),
  })
  .openapi({
    title: 'NearbySearchResponse',
    description: 'Response from nearby search',
  });

// ============================================
// Business Collection Request Schemas
// ============================================

export const CollectAreaRequestSchema = z
  .object({
    latitude: z.number().min(-90).max(90).openapi({
      description: 'Center latitude',
      example: 30.2672,
    }),
    longitude: z.number().min(-180).max(180).openapi({
      description: 'Center longitude',
      example: -97.7431,
    }),
    radius: z.number().positive().max(50000).default(1000).openapi({
      description: 'Search radius in meters',
      example: 1000,
    }),
    area: z.string().optional().openapi({
      description: 'Human-readable area name',
      example: 'Downtown Austin',
    }),
    includedTypes: z.array(z.string()).default(['bar', 'restaurant', 'night_club']).openapi({
      description: 'Types of places to collect',
    }),
    maxResultCount: z.number().int().min(1).max(20).default(20),
    detailLevel: z.enum(['basic', 'standard', 'detailed']).default('standard').openapi({
      description: 'Level of detail to retrieve',
    }),
    saveToDatabase: z.boolean().default(false).openapi({
      description: 'Whether to save results to database',
    }),
  })
  .openapi({
    title: 'CollectAreaRequest',
    description: 'Request to collect businesses from an area',
  });

export const CollectAreaResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    businessesFound: z.number(),
    businessesSaved: z.number().optional(),
    places: z.array(PlaceSchema).optional(),
    jobId: z.string().optional(),
    area: z.string().optional(),
  })
  .openapi({
    title: 'CollectAreaResponse',
    description: 'Response from area collection',
  });

export const BatchCollectRequestSchema = z
  .object({
    locations: z
      .array(
        z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          radius: z.number().positive().max(50000).optional(),
          name: z.string().optional(),
        })
      )
      .min(1)
      .max(10)
      .openapi({
        description: 'List of locations to collect from',
      }),
    includedTypes: z.array(z.string()).default(['bar', 'restaurant', 'night_club']),
    maxResultCount: z.number().int().min(1).max(20).default(10),
    detailLevel: z.enum(['basic', 'standard', 'detailed']).default('standard'),
    saveToDatabase: z.boolean().default(false),
    delayMs: z.number().int().min(0).max(5000).default(200).openapi({
      description: 'Delay between location queries in milliseconds',
    }),
  })
  .openapi({
    title: 'BatchCollectRequest',
    description: 'Request to collect from multiple locations',
  });

export const QueueStatusResponseSchema = z
  .object({
    queue: z.string(),
    status: z.object({
      waiting: z.number(),
      active: z.number(),
      completed: z.number(),
      failed: z.number(),
    }),
    activeJobs: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        progress: z.number().optional(),
        processedOn: z.number().optional(),
        data: z.any(),
      })
    ),
    recentFailures: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        failedReason: z.string().optional(),
        finishedOn: z.number().optional(),
      })
    ),
  })
  .openapi({
    title: 'QueueStatusResponse',
    description: 'Status of the collection queue',
  });

// ============================================
// Error Response Schema
// ============================================

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string().optional(),
    statusCode: z.number().optional(),
    details: z.any().optional(),
  })
  .openapi({
    title: 'ErrorResponse',
    description: 'Error response format',
  });

// ============================================
// Google Raw Business Schema (matches Prisma GoogleRawBusiness)
// ============================================

export const GoogleRawBusinessSchema = z
  .object({
    name: z.string().nullable(),
    addressFull: z.any().nullable().openapi({
      description: 'Full address information including components',
    }),
    location: z.any().nullable().openapi({
      description: 'Geographic coordinates (latitude/longitude)',
    }),
    primaryPhone: z.string().nullable(),
    uri: z.string().url().nullable(),
    data: z.any().nullable().openapi({
      description: 'Complete raw Google Places API response data',
    }),
  })
  .openapi({
    title: 'GoogleRawBusiness',
    description: 'Google business data structure for database storage',
  });

// ============================================
// Type Exports
// ============================================

export type LatLng = z.infer<typeof LatLngSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type NearbySearchRequest = z.infer<typeof NearbySearchRequestSchema>;
export type NearbySearchResponse = z.infer<typeof NearbySearchResponseSchema>;
export type CollectAreaRequest = z.infer<typeof CollectAreaRequestSchema>;
export type CollectAreaResponse = z.infer<typeof CollectAreaResponseSchema>;
export type BatchCollectRequest = z.infer<typeof BatchCollectRequestSchema>;
export type QueueStatusResponse = z.infer<typeof QueueStatusResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type GoogleRawBusiness = z.infer<typeof GoogleRawBusinessSchema>;
