/**
 * Normalize a business name for comparison
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remove common business suffixes
    .replace(/\s+(llc|inc|corp|ltd|co|restaurant|bar|pub|grill|lounge|tavern|cafe|bistro)\.?$/i, '')
    // Remove special characters except hyphens and apostrophes
    .replace(/[^\w\s\-']/g, '')
    // Normalize multiple spaces to single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize an address for comparison
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';
  
  let normalized = address
    .toLowerCase()
    .trim()
    // Remove apartment/suite numbers
    .replace(/\s+(apt|apartment|suite|ste|unit|#)\s*[\w\d]+/i, '')
    // Normalize multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Standardize common street abbreviations
  const streetReplacements: Record<string, string> = {
    ' st ': ' street ',
    ' st$': ' street',
    ' ave ': ' avenue ',
    ' ave$': ' avenue',
    ' blvd ': ' boulevard ',
    ' blvd$': ' boulevard',
    ' rd ': ' road ',
    ' rd$': ' road',
    ' dr ': ' drive ',
    ' dr$': ' drive',
    ' ln ': ' lane ',
    ' ln$': ' lane',
    ' ct ': ' court ',
    ' ct$': ' court',
    ' pkwy ': ' parkway ',
    ' pkwy$': ' parkway',
    ' pl ': ' place ',
    ' pl$': ' place',
    ' cir ': ' circle ',
    ' cir$': ' circle'
  };

  for (const [pattern, replacement] of Object.entries(streetReplacements)) {
    const regex = new RegExp(pattern, 'g');
    normalized = normalized.replace(regex, replacement);
  }

  return normalized;
}

/**
 * Normalize a phone number
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Extract only digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle US phone numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // Return digits for other formats
  return digits;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Normalize business categories
 */
export function normalizeCategories(categories: string[]): string[] {
  if (!categories || !Array.isArray(categories)) return [];
  
  return categories
    .map(cat => cat.toLowerCase().trim())
    .filter(cat => cat.length > 0)
    .map(cat => {
      // Standardize common category variations
      const categoryMappings: Record<string, string> = {
        'food': 'restaurant',
        'dining': 'restaurant',
        'eatery': 'restaurant',
        'pub': 'bar',
        'tavern': 'bar',
        'nightclub': 'bar',
        'wine_bar': 'bar',
        'cocktail_bar': 'bar',
        'sports_bar': 'bar',
        'breweries': 'brewery',
        'brewery': 'brewery',
        'coffee': 'cafe',
        'coffee_shop': 'cafe'
      };
      
      return categoryMappings[cat] || cat;
    });
}

/**
 * Clean and validate rating value
 */
export function normalizeRating(rating: any): number | null {
  if (rating === null || rating === undefined) return null;
  
  const numRating = typeof rating === 'string' ? parseFloat(rating) : Number(rating);
  
  if (isNaN(numRating) || numRating < 0 || numRating > 5) {
    return null;
  }
  
  return Math.round(numRating * 10) / 10; // Round to 1 decimal place
}

/**
 * Normalize price level to 1-4 scale
 */
export function normalizePriceLevel(priceLevel: any): number | null {
  if (priceLevel === null || priceLevel === undefined) return null;
  
  // Handle string representations
  if (typeof priceLevel === 'string') {
    const googlePriceLevels: Record<string, number> = {
      'PRICE_LEVEL_FREE': 0,
      'PRICE_LEVEL_INEXPENSIVE': 1,
      'PRICE_LEVEL_MODERATE': 2,
      'PRICE_LEVEL_EXPENSIVE': 3,
      'PRICE_LEVEL_VERY_EXPENSIVE': 4
    };
    
    if (googlePriceLevels.hasOwnProperty(priceLevel)) {
      return googlePriceLevels[priceLevel];
    }
    
    // Handle Yelp-style $ symbols
    const dollarSigns = priceLevel.match(/\$/g);
    if (dollarSigns) {
      return Math.min(dollarSigns.length, 4);
    }
  }
  
  // Handle numeric values
  const numPrice = Number(priceLevel);
  if (!isNaN(numPrice) && numPrice >= 0 && numPrice <= 4) {
    return Math.floor(numPrice);
  }
  
  return null;
}

/**
 * Normalize operating hours to consistent format
 */
export function normalizeOperatingHours(hours: any): string[] {
  if (!hours || !Array.isArray(hours)) return [];
  
  return hours
    .filter(hour => typeof hour === 'string' && hour.trim().length > 0)
    .map(hour => hour.trim())
    .slice(0, 7); // Max 7 days
}

/**
 * Generate a normalized search key for quick lookups
 */
export function generateSearchKey(name: string, latitude: number, longitude: number): string {
  const normalizedName = normalizeName(name);
  const roundedLat = Math.round(latitude * 1000) / 1000; // 3 decimal places
  const roundedLng = Math.round(longitude * 1000) / 1000;
  
  return `${normalizedName}|${roundedLat}|${roundedLng}`;
}