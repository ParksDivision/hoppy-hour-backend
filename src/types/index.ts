// Central type exports for the application

// Business types
export type {
  StandardizedBusiness,
  BusinessSearchCriteria,
  BusinessCreateInput,
  BusinessUpdateInput,
  BusinessWithRelations,
  BusinessPhoto,
  BusinessDeal,
  SourceBusiness,
  BusinessStats,
  Location,
  BusinessSearchResponse,
  BusinessLocationSearchResponse,
  BusinessCategoryResponse,
  // Additional business types that were missing
  FrontendBusiness,
  FrontendPhoto,
  FrontendDeal,
  BusinessApiResponse,
  SearchApiResponse,
  CostReport,
  CostEstimate,
  RateLimitConfig,
  S3Operation,
  ImageVariant,
  ImageVariantSettings,
  CloudflareConfig,
  DealStats,
  ProcessingMetrics,
  ServiceStatus,
  SystemHealth,
  HealthCheckResponse,
  MatchCandidate,
  SimilarityScores
} from './business';

// Event types - Fixed missing exports
export type {
  BaseEvent,
  BusinessRawCollectedEvent,
  BusinessStandardizedEvent,
  BusinessDeduplicatedEvent,
  DealProcessedEvent,
  PhotoProcessedEvent,
  BusinessEvent,
  DomainEvent,
  EventHandler,
  EventTypeMap,
  EventName
} from '../events/eventTypes';

// Utility types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

// Common database audit fields
export interface AuditFields {
  createdOn: Date;
  createdBy?: number;
  updatedOn?: Date;
  updatedBy?: number;
  deletedOn?: Date;
  deletedBy?: number;
}

// API Error type (was missing)
export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: any;
  timestamp: string;
}