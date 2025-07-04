export interface Location {
  lat: number;
  lng: number;
  name: string;
}

export interface StandardizedBusiness {
  // Core business data
  name: string;
  normalizedName: string;
  address: string;
  normalizedAddress: string;
  latitude: number;
  longitude: number;
  
  // Contact info (normalized)
  phone?: string;
  normalizedPhone?: string;
  website?: string;
  domain?: string;
  
  // Business classification
  isBar: boolean;
  isRestaurant: boolean;
  categories: string[];
  
  // Ratings and business details
  ratingGoogle?: number;
  ratingYelp?: number;
  ratingOverall?: number;
  priceLevel?: number;
  operatingHours: string[];
  
  // Source metadata
  sourceId: string;
  source: string;
}

export interface RawBusinessData {
  sourceId: string;
  source: string;
  data: any; // Raw API response
  fetchedAt: Date;
}

export interface DeduplicationResult {
  action: 'created' | 'merged' | 'updated';
  businessId: string;
  confidence: number;
  matchedWith?: string;
  similarityScores?: {
    name: number;
    location: number;
    phone?: number;
    domain?: number;
  };
}

// Processing context for tracking through the pipeline
export interface ProcessingContext {
  correlationId: string;
  startedAt: Date;
  source: string;
  location?: Location;
  retryCount?: number;
}