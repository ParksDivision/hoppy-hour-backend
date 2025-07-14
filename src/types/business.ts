// src/types/business.ts

// Core business data after standardization
export interface StandardizedBusiness {
  name: string;
  normalizedName: string;
  address: string;
  normalizedAddress: string;
  latitude: number;
  longitude: number;
  phone?: string;
  normalizedPhone?: string;
  website?: string;
  domain?: string;
  isBar: boolean;
  isRestaurant: boolean;
  categories: string[];
  ratingGoogle?: number;
  ratingYelp?: number;
  ratingOverall?: number;
  priceLevel?: number;
  operatingHours: string[];
  sourceId: string;
  source: BusinessSource;
}

// Business source types
export type BusinessSource = 'GOOGLE' | 'YELP' | 'FACEBOOK' | 'MANUAL';

// Photo data structure
export interface PhotoData {
  sourceId: string;
  source: string;
  width?: number;
  height?: number;
  url?: string;
  s3Key?: string;
  s3KeyThumbnail?: string;
  s3KeySmall?: string;
  s3KeyMedium?: string;
  s3KeyLarge?: string;
  mainPhoto: boolean;
  format?: string;
  fileSize?: number;
  lastProcessed?: Date;
  businessId: string;
}

// Deal data structure
export interface DealData {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  title: string;
  description: string;
  extractedBy: string;
  sourceText: string;
  confidence: number;
}

// Event system types
export interface BaseEvent {
  id: string;
  timestamp: Date;
  source: string;
  type: string;
  data: any;
}

// Raw business collected event
export interface BusinessRawCollectedEvent extends BaseEvent {
  type: 'business.raw.collected';
  data: {
    sourceId: string;
    source: BusinessSource;
    rawData: any;
    location?: {
      lat: number;
      lng: number;
      name: string;
    };
  };
}

// Business standardized event
export interface BusinessStandardizedEvent extends BaseEvent {
  type: 'business.standardized';
  data: {
    sourceId: string;
    source: BusinessSource;
    standardizedBusiness: StandardizedBusiness;
  };
}

// Business deduplicated event
export interface BusinessDeduplicatedEvent extends BaseEvent {
  type: 'business.deduplicated';
  data: {
    businessId: string;
    action: 'created' | 'merged' | 'updated';
    confidence: number;
  };
}

// Deal processed event
export interface DealProcessedEvent extends BaseEvent {
  type: 'business.deals.processed';
  data: {
    businessId: string;
    dealsExtracted: number;
    hasActiveDeals: boolean;
  };
}

// Photo processed event
export interface PhotoProcessedEvent extends BaseEvent {
  type: 'business.photos.processed';
  data: {
    businessId: string;
    photosProcessed: number;
    mainPhotoSet: boolean;
    hasS3Storage: boolean;
  };
}

// Union type for all events
export type BusinessEvent = 
  | BusinessRawCollectedEvent
  | BusinessStandardizedEvent
  | BusinessDeduplicatedEvent
  | DealProcessedEvent
  | PhotoProcessedEvent;

// Similarity scoring for deduplication
export interface SimilarityScores {
  name: number;
  location: number;
  phone?: number;
  domain?: number;
  overall: number;
}

export interface MatchCandidate {
  businessId: string;
  scores: SimilarityScores;
  confidence: number;
}

// API response types for frontend
export interface BusinessApiResponse {
  businesses: any[];
  count: number;
  totalCount?: number;
  page?: number;
  totalPages?: number;
  hasMore?: boolean;
  filters?: {
    withPhotosOnly?: boolean;
    withDealsOnly?: boolean;
    limit: number;
    offset: number;
  };
}

export interface SearchApiResponse {
  results: any[];
  count: number;
  searchCriteria: {
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    category?: string;
    withDealsOnly?: boolean;
  };
}

// Cost control types
export interface CostEstimate {
  s3Storage: number;
  s3Requests: number;
  s3DataTransfer: number;
  cloudflareRequests: number;
  cloudflareBandwidth: number;
  total: number;
}

export interface RateLimitConfig {
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  maxMonthlyCost: number;
  emergencyThreshold: number;
}

export interface S3Operation {
  type: 'PUT' | 'GET' | 'DELETE' | 'LIST';
  timestamp: Date;
  cost: number;
  bytes?: number;
}

// Image variant types
export type ImageVariant = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

export interface ImageVariantSettings {
  width: number | null;
  height: number | null;
  quality: number;
}

// CDN configuration
export interface CloudflareConfig {
  zoneId: string;
  apiToken: string;
  baseUrl: string;
  enabled: boolean;
}

// Statistics types
export interface BusinessStats {
  totalBusinesses: number;
  breakdown: {
    bars: number;
    restaurants: number;
    withDeals: number;
    withPhotos: number;
  };
  dealCoverage: string;
  photoCoverage: string;
  averageRating: number;
  sources: {
    google: number;
    yelp: number;
    manual: number;
  };
  costInfo?: {
    currentSpent: number;
    remainingBudget: number;
    emergencyMode: boolean;
    projectedMonthly: number;
  };
  generatedAt: string;
}

export interface DealStats {
  totalBusinesses: number;
  businessesWithDeals: number;
  businessesWithoutDeals: number;
  businessesWithPhotos: number;
  photoCoverage: string;
  dealCoverage: string;
  totalActiveDeals: number;
  averageDealsPerBusiness: string;
  averageRating: number;
  dealsByDay: Record<string, number>;
  note?: string;
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  timestamp: string;
  version: string;
  eventSystem?: string;
  architecture?: string;
  currentFlow?: string;
  services?: Record<string, string>;
  uptime?: number;
}

// Location types for Google Places
export interface Location {
  lat: number;
  lng: number;
  name: string;
}

// Utility types for data processing
export interface ProcessingMetrics {
  processingTime: number;
  uploadTime: number;
  totalTime: number;
  size: number;
  variant: string;
}

export interface CostReport {
  currentMonth: CostEstimate;
  dailyAverage: number;
  projectedMonthly: number;
  remainingBudget: number;
  emergencyMode: boolean;
  cloudflareStats: {
    requestsUsed: number;
    bandwidthUsed: number;
  };
}

// Frontend-specific types (matching VenueCard expectations)
export interface FrontendBusiness {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  phoneNumber?: string | null;
  priceLevel?: number | null;
  isBar?: boolean | null;
  isRestaurant?: boolean | null;
  url?: string | null;
  ratingOverall?: number | null;
  ratingYelp?: number | null;
  ratingGoogle?: number | null;
  operatingHours?: string | null;
  photos: FrontendPhoto[];
  dealInfo: FrontendDeal[];
}

export interface FrontendPhoto {
  id: string;
  businessId: string;
  sourceId: string;
  source: string;
  width?: number | null;
  height?: number | null;
  url?: string | null;
  mainPhoto: boolean;
  s3Key?: string | null;
  s3KeyThumbnail?: string | null;
  s3KeySmall?: string | null;
  s3KeyMedium?: string | null;
  s3KeyLarge?: string | null;
  cdnUrls?: {
    original?: string | null;
    thumbnail?: string | null;
    small?: string | null;
    medium?: string | null;
    large?: string | null;
  };
  fallbackUrl?: string | null;
}

export interface FrontendDeal {
  id: string;
  businessId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  deals: string[];
}

// Service status types
export interface ServiceStatus {
  standardization: 'operational' | 'error' | 'paused';
  deduplication: 'operational' | 'error' | 'paused';
  dealProcessing: 'operational' | 'error' | 'paused';
  photoProcessing: 'operational' | 'error' | 'paused';
}

export interface SystemHealth {
  eventSystem: 'operational' | 'error';
  architecture: string;
  currentFlow: string;
  services: ServiceStatus;
  timestamp: string;
  uptime: number;
}