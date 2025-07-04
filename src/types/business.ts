// Business type definitions

// Standardized business data structure
export interface StandardizedBusiness {
  // Basic info
  name: string;
  normalizedName: string;
  address: string;
  normalizedAddress: string;
  
  // Location
  latitude: number;
  longitude: number;
  
  // Contact info
  phone?: string;
  normalizedPhone?: string;
  website?: string;
  domain?: string;
  
  // Business classification
  isBar?: boolean;
  isRestaurant?: boolean;
  categories: string[];
  
  // Ratings
  ratingGoogle?: number;
  ratingYelp?: number;
  ratingOverall?: number;
  priceLevel?: number;
  
  // Operating info
  operatingHours: string[];
  
  // Source tracking
  sourceId: string;
  source: 'GOOGLE' | 'YELP' | 'FACEBOOK' | 'MANUAL';
}

// Business search criteria
export interface BusinessSearchCriteria {
  name?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  isBar?: boolean;
  isRestaurant?: boolean;
  categories?: string[];
  minRating?: number;
  maxRating?: number;
  minPriceLevel?: number;
  maxPriceLevel?: number;
  limit?: number;
  offset?: number;
}

// Business creation input
export interface BusinessCreateInput {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
  isBar?: boolean;
  isRestaurant?: boolean;
  categories?: string[];
  priceLevel?: number;
  operatingHours?: string[];
}

// Business update input
export interface BusinessUpdateInput {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  isBar?: boolean;
  isRestaurant?: boolean;
  categories?: string[];
  ratingGoogle?: number;
  ratingYelp?: number;
  ratingOverall?: number;
  priceLevel?: number;
  operatingHours?: string[];
}

// Business with relationships
export interface BusinessWithRelations {
  id: string;
  
  // External source IDs
  placeId?: string | null;
  yelpId?: string | null;
  userId?: string | null;
  
  // Core business data
  name: string;
  normalizedName?: string | null;
  address: string;
  normalizedAddress?: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
  website?: string | null;
  domain?: string | null;
  
  // Geographic data
  latitude: number;
  longitude: number;
  
  // Business classification
  isBar?: boolean | null;
  isRestaurant?: boolean | null;
  categories: string[];
  
  // Ratings and aggregated data
  ratingGoogle?: number | null;
  ratingYelp?: number | null;
  ratingOverall?: number | null;
  priceLevel?: number | null;
  operatingHours: string[];
  
  // Deduplication metadata
  confidence: number;
  lastAnalyzed?: Date | null;
  
  // Relationships
  photos?: BusinessPhoto[];
  deals?: BusinessDeal[];
  sourceBusinesses?: SourceBusiness[];
  
  // Audit fields
  createdOn: Date;
  createdBy?: number | null;
  updatedOn?: Date | null;
  updatedBy?: number | null;
  deletedOn?: Date | null;
  deletedBy?: number | null;
}

// Business photo
export interface BusinessPhoto {
  id: string;
  businessId: string;
  sourceId: string;
  source: string;
  width?: number;
  height?: number;
  url?: string;
  mainPhoto: boolean;
  
  // S3 storage
  s3Key?: string;
  s3KeyThumbnail?: string;
  s3KeySmall?: string;
  s3KeyMedium?: string;
  s3KeyLarge?: string;
  format?: string;
  processingTime?: number;
  fileSize?: number;
  lastProcessed?: Date;
  
  createdOn: Date;
  lastFetched?: Date;
}

// Business deal
export interface BusinessDeal {
  id: string;
  businessId: string;
  title: string;
  description: string;
  
  // Timing
  dayOfWeek?: number; // 0-6, null for daily deals
  startTime?: string; // "16:00"
  endTime?: string; // "19:00"
  validFrom?: Date;
  validUntil?: Date;
  
  // AI analysis metadata
  extractedBy: 'AI' | 'MANUAL' | 'API';
  confidence: number;
  sourceText?: string;
  
  // Status
  isActive: boolean;
  isVerified: boolean;
  
  createdOn: Date;
  updatedOn?: Date;
}

// Source business data
export interface SourceBusiness {
  id: string;
  businessId: string;
  source: string;
  sourceId: string;
  rawData: any;
  lastFetched: Date;
  createdOn: Date;
  updatedOn?: Date;
}

// Business statistics
export interface BusinessStats {
  totalBusinesses: number;
  breakdown: {
    bars: number;
    restaurants: number;
    withPhotos: number;
  };
  averageRating: number;
  sources: {
    google: number;
    yelp: number;
    manual: number;
  };
  generatedAt: string;
}

// Location type
export interface Location {
  lat: number;
  lng: number;
  name: string;
}

// API response types
export interface BusinessSearchResponse {
  results: BusinessWithRelations[];
  count: number;
  searchCriteria?: BusinessSearchCriteria;
  totalPages?: number;
  currentPage?: number;
}

export interface BusinessLocationSearchResponse {
  results: BusinessWithRelations[];
  count: number;
  searchCriteria: {
    latitude: number;
    longitude: number;
    radiusKm: number;
  };
}

export interface BusinessCategoryResponse {
  results: BusinessWithRelations[];
  count: number;
  category: string;
  filters: {
    isBar?: string;
    isRestaurant?: string;
  };
}