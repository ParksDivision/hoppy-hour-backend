import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger/logger';
import { publishEvent, subscribeToEvent } from '../events/eventBus';
import type { BusinessRawCollectedEvent, BusinessStandardizedEvent } from '../events/eventTypes';
import type { StandardizedBusiness } from '../types/business';

// Business name standardization patterns
const NAME_PATTERNS = {
  // Remove common business suffixes for normalization
  suffixes: /\s+(LLC|Inc|Corp|Ltd|Co|Restaurant|Bar|Pub|Grill|Lounge|Tavern|Cafe|Bistro)\.?$/i,
  // Replace multiple spaces with single space
  spaces: /\s+/g,
  // Remove special characters except hyphens and apostrophes
  specialChars: /[^\w\s\-']/g
};

const ADDRESS_PATTERNS = {
  // Standardize street types
  streetTypes: new Map([
    ['st', 'street'], ['ave', 'avenue'], ['blvd', 'boulevard'],
    ['rd', 'road'], ['dr', 'drive'], ['ln', 'lane'], ['ct', 'court'],
    ['pkwy', 'parkway'], ['pl', 'place'], ['cir', 'circle']
  ]),
  // Remove apartment/suite numbers for normalization
  suiteNumbers: /\s+(apt|apartment|suite|ste|unit|#)\s*[\w\d]+/i
};

// Pure functions for data transformation
const normalizeName = (name: string): string => {
  return name
    .replace(NAME_PATTERNS.suffixes, '') // Remove business suffixes
    .replace(NAME_PATTERNS.specialChars, '') // Remove special characters
    .replace(NAME_PATTERNS.spaces, ' ') // Normalize spaces
    .trim()
    .toLowerCase();
};

const normalizeAddress = (address: string): string => {
  let normalized = address.toLowerCase()
    .replace(ADDRESS_PATTERNS.suiteNumbers, '') // Remove suite numbers
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  // Standardize street types
  ADDRESS_PATTERNS.streetTypes.forEach((full, abbrev) => {
    const pattern = new RegExp(`\\b${abbrev}\\b`, 'g');
    normalized = normalized.replace(pattern, full);
  });

  return normalized;
};

const normalizePhone = (phone: string): string => {
  // Extract only digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle US phone numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  return digits;
};

const extractDomain = (url: string): string | undefined => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
};

const determineIsBar = (categories: string[]): boolean => {
  const barKeywords = ['bar', 'pub', 'tavern', 'lounge', 'wine_bar', 'breweries', 'cocktail'];
  return categories.some(cat => 
    barKeywords.some(keyword => cat.toLowerCase().includes(keyword))
  );
};

const determineIsRestaurant = (categories: string[]): boolean => {
  const restaurantKeywords = ['restaurant', 'food', 'dining', 'eatery', 'cafe', 'bistro'];
  return categories.some(cat => 
    restaurantKeywords.some(keyword => cat.toLowerCase().includes(keyword))
  );
};

const convertGooglePriceLevel = (priceLevel?: string): number | undefined => {
  const levelMap: Record<string, number> = {
    'PRICE_LEVEL_INEXPENSIVE': 1,
    'PRICE_LEVEL_MODERATE': 2,
    'PRICE_LEVEL_EXPENSIVE': 3,
    'PRICE_LEVEL_VERY_EXPENSIVE': 4
  };
  return priceLevel ? levelMap[priceLevel] : undefined;
};

const formatYelpAddress = (location: any): string => {
  if (!location) return 'Unknown Address';
  
  const parts = [
    location.address1,
    location.city,
    location.state,
    location.zip_code
  ].filter(Boolean);
  
  return parts.join(', ');
};

const formatTime = (time: string): string => {
  if (time.length !== 4) return time;
  const hours = parseInt(time.substring(0, 2));
  const minutes = time.substring(2);
  const ampm = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes}${ampm}`;
};

const formatYelpHours = (hours: any[]): string[] => {
  if (!hours || !hours[0]?.open) return [];
  
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return hours[0].open.map((period: any) => {
    const day = days[period.day];
    const start = formatTime(period.start);
    const end = formatTime(period.end);
    return `${day}: ${start}-${end}`;
  });
};

// Data extraction functions
const extractGoogleData = (data: any): any => ({
  name: data.displayName?.text || data.name || 'Unknown Business',
  address: data.formattedAddress || 'Unknown Address',
  latitude: data.location?.latitude || 0,
  longitude: data.location?.longitude || 0,
  phone: data.nationalPhoneNumber || data.internationalPhoneNumber,
  website: data.websiteUri,
  rating: data.rating,
  priceLevel: convertGooglePriceLevel(data.priceLevel),
  categories: data.types || [],
  operatingHours: data.regularOpeningHours?.weekdayDescriptions || []
});

const extractYelpData = (data: any): any => ({
  name: data.name || 'Unknown Business',
  address: formatYelpAddress(data.location),
  latitude: data.coordinates?.latitude || 0,
  longitude: data.coordinates?.longitude || 0,
  phone: data.phone,
  website: data.url,
  rating: data.rating,
  priceLevel: data.price ? data.price.length : undefined,
  categories: data.categories?.map((cat: any) => cat.alias) || [],
  operatingHours: formatYelpHours(data.hours)
});

type BusinessSource = 'GOOGLE' | 'YELP' | 'FACEBOOK' | 'MANUAL';

const extractDataBySource = (rawData: any, source: BusinessSource): any => {
  switch (source) {
    case 'GOOGLE':
      return extractGoogleData(rawData);
    case 'YELP':
      return extractYelpData(rawData);
    default:
      throw new Error(`Unsupported data source: ${source}`);
  }
};

// Main standardization function
const standardizeBusinessData = async (
  rawData: any,
  sourceId: string,
  source: BusinessSource
): Promise<StandardizedBusiness> => {
  const extracted = extractDataBySource(rawData, source);
  
  return {
    name: extracted.name,
    normalizedName: normalizeName(extracted.name),
    address: extracted.address,
    normalizedAddress: normalizeAddress(extracted.address),
    latitude: extracted.latitude,
    longitude: extracted.longitude,
    phone: extracted.phone,
    normalizedPhone: extracted.phone ? normalizePhone(extracted.phone) : undefined,
    website: extracted.website,
    domain: extracted.website ? extractDomain(extracted.website) : undefined,
    isBar: determineIsBar(extracted.categories),
    isRestaurant: determineIsRestaurant(extracted.categories),
    categories: extracted.categories,
    ratingGoogle: source === 'GOOGLE' ? extracted.rating : undefined,
    ratingYelp: source === 'YELP' ? extracted.rating : undefined,
    ratingOverall: extracted.rating,
    priceLevel: extracted.priceLevel,
    operatingHours: extracted.operatingHours || [],
    sourceId,
    source
  };
};

// Event handler function
const handleRawBusinessEvent = async (event: BusinessRawCollectedEvent): Promise<void> => {
  try {
    logger.info({
      eventId: event.id,
      sourceId: event.data.sourceId,
      source: event.data.source
    }, 'Processing raw business data for standardization');

    const standardizedBusiness = await standardizeBusinessData(
      event.data.rawData,
      event.data.sourceId,
      event.data.source
    );

    // Publish standardized event
    const standardizedEvent: BusinessStandardizedEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      source: 'standardization-service',
      type: 'business.standardized',
      data: {
        sourceId: event.data.sourceId,
        source: event.data.source,
        standardizedBusiness
      }
    };

    publishEvent(standardizedEvent);

    logger.info({
      originalEventId: event.id,
      newEventId: standardizedEvent.id,
      businessName: standardizedBusiness.name
    }, 'Business data standardized successfully');

  } catch (error) {
    logger.error({
      err: error,
      eventId: event.id,
      sourceId: event.data.sourceId
    }, 'Failed to standardize business data');
    throw error;
  }
};

// Initialization function
export const initializeStandardizationService = (): void => {
  subscribeToEvent('business.raw.collected', handleRawBusinessEvent);
  logger.info('StandardizationService event listeners registered');
};

// Export individual functions for testing
export {
  normalizeName,
  normalizeAddress,
  normalizePhone,
  extractDomain,
  determineIsBar,
  determineIsRestaurant,
  standardizeBusinessData,
  handleRawBusinessEvent
};