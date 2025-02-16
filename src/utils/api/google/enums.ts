import { z } from "zod";

export interface Location {
    lat: number;
    lng: number;
    name: string;
  }
  
  export const AUSTIN_LOCATIONS: Location[] = [
    // Central Austin
    { lat: 30.2672, lng: -97.7431, name: 'Downtown Austin' },
    { lat: 30.2983, lng: -97.7448, name: 'Hyde Park' },
    { lat: 30.2915, lng: -97.7688, name: 'Clarksville' },
    { lat: 30.2773, lng: -97.7574, name: 'West Campus' },
    { lat: 30.2942, lng: -97.7384, name: 'North University' },
    
    // South Austin
    { lat: 30.2270, lng: -97.7432, name: 'South Congress (SoCo)' },
    { lat: 30.2336, lng: -97.7667, name: 'Zilker' },
    { lat: 30.2451, lng: -97.7714, name: 'Barton Hills' },
    { lat: 30.2158, lng: -97.7549, name: '78704 District' },
    { lat: 30.2106, lng: -97.7689, name: 'South Lamar' },
    { lat: 30.2179, lng: -97.7851, name: 'Sunset Valley' },
    
    // East Austin
    { lat: 30.2667, lng: -97.7184, name: 'East Austin (Historic)' },
    { lat: 30.2765, lng: -97.7179, name: 'Holly' },
    { lat: 30.2644, lng: -97.7177, name: 'East Cesar Chavez' },
    { lat: 30.2854, lng: -97.7074, name: 'Mueller' },
    { lat: 30.3033, lng: -97.7049, name: 'Windsor Park' },
    { lat: 30.2845, lng: -97.6914, name: 'Johnston Terrace' },
    
    // North Austin
    { lat: 30.3356, lng: -97.7192, name: 'North Loop' },
    { lat: 30.3529, lng: -97.7327, name: 'Crestview' },
    { lat: 30.3631, lng: -97.7169, name: 'Wooten' },
    { lat: 30.3842, lng: -97.7213, name: 'North Burnet' },
    { lat: 30.4057, lng: -97.7233, name: 'The Domain' },
    { lat: 30.3583, lng: -97.7019, name: 'Highland' },
    
    // Northwest Austin
    { lat: 30.3541, lng: -97.7621, name: 'Allandale' },
    { lat: 30.3595, lng: -97.7452, name: 'Brentwood' },
    { lat: 30.3697, lng: -97.7489, name: 'Rosedale' },
    { lat: 30.3932, lng: -97.7665, name: 'Northwest Hills' },
    { lat: 30.4197, lng: -97.7479, name: 'Great Hills' },
    { lat: 30.4382, lng: -97.7740, name: 'Anderson Mill' },
    
    // Southwest Austin
    { lat: 30.2352, lng: -97.8026, name: 'Oak Hill' },
    { lat: 30.2154, lng: -97.8011, name: 'Circle C Ranch' },
    { lat: 30.2367, lng: -97.7902, name: 'Westlake Hills' },
    { lat: 30.2556, lng: -97.8026, name: 'Rollingwood' },
    { lat: 30.2431, lng: -97.8129, name: 'Barton Creek' },
    { lat: 30.2089, lng: -97.8507, name: 'Lost Creek' },
    
    // Southeast Austin
    { lat: 30.2278, lng: -97.7074, name: 'Montopolis' },
    { lat: 30.2132, lng: -97.7237, name: 'Pleasant Valley' },
    { lat: 30.2267, lng: -97.6937, name: 'Riverside' },
    { lat: 30.1995, lng: -97.7138, name: 'McKinney' },
    { lat: 30.1877, lng: -97.7366, name: 'Onion Creek' },
    { lat: 30.2056, lng: -97.6883, name: 'Del Valle' }
];

  /* ----------------------------ZOD SCHEMAS-------------------------------- */
  export const PlaceDetailsSchema = z.object({
    name: z.string(),
    id: z.string(),
    types: z.array(z.string()),
    nationalPhoneNumber: z.string().optional(),
    internationalPhoneNumber: z.string().optional(),
    formattedAddress: z.string(),
    addressComponents: z.array(z.object({
      longText: z.string(),
      shortText: z.string(),
      types: z.array(z.string()),
      languageCode: z.string()
    })),
    location: z.object({
      latitude: z.number(),
      longitude: z.number()
    }),
    viewport: z.object({
      low: z.object({
        latitude: z.number(),
        longitude: z.number()
      }),
      high: z.object({
        latitude: z.number(),
        longitude: z.number()
      })
    }),
    rating: z.number().optional(),
    googleMapsUri: z.string(),
    websiteUri: z.string().optional(),
    regularOpeningHours: z.object({
      openNow: z.boolean(),
      periods: z.array(z.object({
        open: z.object({
          day: z.number(),
          hour: z.number(),
          minute: z.number(),
          date: z.object({
            year: z.number(),
            month: z.number(),
            day: z.number()
          }).optional()
        }),
        close: z.object({
          day: z.number(),
          hour: z.number(),
          minute: z.number(),
          date: z.object({
            year: z.number(),
            month: z.number(),
            day: z.number()
          }).optional()
        })
      })),
      weekdayDescriptions: z.array(z.string()),
      nextCloseTime: z.string()
    }).optional(),
    currentOpeningHours: z.object({
      openNow: z.boolean(),
      periods: z.array(z.object({
        open: z.object({
          day: z.number(),
          hour: z.number(),
          minute: z.number(),
          date: z.object({
            year: z.number(),
            month: z.number(),
            day: z.number()
          }).optional()
        }),
        close: z.object({
          day: z.number(),
          hour: z.number(),
          minute: z.number(),
          date: z.object({
            year: z.number(),
            month: z.number(),
            day: z.number()
          }).optional()
        })
      })),
      weekdayDescriptions: z.array(z.string()),
      nextCloseTime: z.string()
    }).optional(),
    utcOffsetMinutes: z.number(),
    businessStatus: z.string(),
    priceLevel: z.string().optional(),
    userRatingCount: z.number().optional(),
    displayName: z.object({
      text: z.string(),
      languageCode: z.string()
    }),
    photos: z.array(z.object({
      name: z.string(),
      widthPx: z.number(),
      heightPx: z.number(),
      authorAttributions: z.array(z.object({
        displayName: z.string(),
        uri: z.string(),
        photoUri: z.string()
      })),
      flagContentUri: z.string(),
      googleMapsUri: z.string()
    })).optional(),
    reviews: z.array(z.object({
      name: z.string(),
      relativePublishTimeDescription: z.string(),
      rating: z.number(),
      text: z.object({
        text: z.string(),
        languageCode: z.string()
      }),
      originalText: z.object({
        text: z.string(),
        languageCode: z.string()
      }),
      authorAttribution: z.object({
        displayName: z.string(),
        uri: z.string(),
        photoUri: z.string()
      }),
      publishTime: z.string(),
      flagContentUri: z.string(),
      googleMapsUri: z.string()
    })).optional(),
    takeout: z.boolean().optional(),
    delivery: z.boolean().optional(),
    dineIn: z.boolean().optional(),
    reservable: z.boolean().optional(),
    servesBreakfast: z.boolean().optional(),
    servesLunch: z.boolean().optional(),
    servesDinner: z.boolean().optional(),
    servesBeer: z.boolean().optional(),
    servesWine: z.boolean().optional(),
    paymentOptions: z.object({
      acceptsCreditCards: z.boolean(),
      acceptsDebitCards: z.boolean(),
      acceptsCashOnly: z.boolean(),
      acceptsNfc: z.boolean()
    }).optional(),
    accessibilityOptions: z.object({
      wheelchairAccessibleParking: z.boolean(),
      wheelchairAccessibleEntrance: z.boolean(),
      wheelchairAccessibleRestroom: z.boolean(),
      wheelchairAccessibleSeating: z.boolean()
    }).optional()
  });