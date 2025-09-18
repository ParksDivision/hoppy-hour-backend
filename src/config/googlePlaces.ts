export const googlePlacesConfig = {
  apiKey: process.env.GOOGLE_PLACES_API_KEY,
  baseUrl: 'https://places.googleapis.com/v1',

  // Rate limiting settings
  rateLimit: {
    requestsPerSecond: 10,
    requestsPerDay: 5000,
  },

  // Default search parameters
  defaults: {
    radius: 1694, // 10 miles
    maxResultCount: 500,
    includedTypes: [
      'bar',
      'pub',
      'restaurant',
      'night_club',
      'cafe',
      'movie_theater',
      'dance_hall',
      'bowling_alley',
    ],

    // Field masks for different detail levels. Standard is the default for initial retrieval
    fieldMasks: {
      basic: [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.primaryType',
        'places.types',
      ],
      standard: [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.primaryType',
        'places.types',
        'places.rating',
        'places.userRatingCount',
        'places.priceLevel',
        'places.businessStatus',
        'places.websiteUri',
        'places.photos',
        'places.currentOpeningHours',
        'places.regularOpeningHours',
      ],
      detailed: [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.primaryType',
        'places.primaryTypeDisplayName',
        'places.types',
        'places.rating',
        'places.userRatingCount',
        'places.priceLevel',
        'places.priceRange',
        'places.businessStatus',
        'places.googleMapsUri',
        'places.websiteUri',
        'places.internationalPhoneNumber',
        'places.nationalPhoneNumber',
        'places.photos',
        'places.currentOpeningHours',
        'places.regularOpeningHours',
        'places.editorialSummary',
        'places.reviews',
        'places.servesBeer',
        'places.servesWine',
        'places.servesCocktails',
        'places.servesBreakfast',
        'places.servesBrunch',
        'places.servesLunch',
        'places.servesDinner',
        'places.takeout',
        'places.delivery',
        'places.dineIn',
        'places.curbsidePickup',
        'places.reservable',
        'places.outdoorSeating',
        'places.liveMusic',
        'places.paymentOptions',
        'places.parkingOptions',
        'places.accessibilityOptions',
      ],
    },
  },
};

// Validate API key is present
if (!googlePlacesConfig.apiKey) {
  throw new Error('GOOGLE_PLACES_API_KEY environment variable is required');
}
