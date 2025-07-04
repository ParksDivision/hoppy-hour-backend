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
  BusinessCategoryResponse
} from './business';

// Event types
export type {
  BaseEvent,
  BusinessRawCollectedEvent,
  BusinessStandardizedEvent,
  BusinessDeduplicatedEvent,
  BusinessEvent,
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