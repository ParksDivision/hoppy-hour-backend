import type { StandardizedBusiness } from '../types/business';

// Base event interface
export interface BaseEvent {
  id: string;
  timestamp: Date;
  source: string;
}

// Raw business data collection event
export interface BusinessRawCollectedEvent extends BaseEvent {
  type: 'business.raw.collected';
  data: {
    sourceId: string;
    source: 'GOOGLE' | 'YELP' | 'FACEBOOK' | 'MANUAL';
    rawData: any;
    location: {
      lat: number;
      lng: number;
      name: string;
    };
  };
}

// Business data standardization completion event
export interface BusinessStandardizedEvent extends BaseEvent {
  type: 'business.standardized';
  data: {
    sourceId: string;
    source: 'GOOGLE' | 'YELP' | 'FACEBOOK' | 'MANUAL';
    standardizedBusiness: StandardizedBusiness;
  };
}

// Business deduplication completion event
export interface BusinessDeduplicatedEvent extends BaseEvent {
  type: 'business.deduplicated';
  data: {
    businessId: string;
    action: 'created' | 'merged' | 'updated';
    confidence: number;
  };
}

// Deal processing completion event - NEW
export interface DealProcessedEvent extends BaseEvent {
  type: 'business.deals.processed';
  data: {
    businessId: string;
    dealsExtracted: number;
    hasActiveDeals: boolean;
  };
}

// Photo processing completion event
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
export type DomainEvent = 
  | BusinessRawCollectedEvent 
  | BusinessStandardizedEvent 
  | BusinessDeduplicatedEvent
  | DealProcessedEvent           // NEW
  | PhotoProcessedEvent;

// MISSING TYPES that your types/index.ts needs:

// Generic business event type (alias for DomainEvent)
export type BusinessEvent = DomainEvent;

// Event handler function type
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void> | void;

// Event type mapping
export type EventTypeMap = {
  'business.raw.collected': BusinessRawCollectedEvent;
  'business.standardized': BusinessStandardizedEvent;
  'business.deduplicated': BusinessDeduplicatedEvent;
  'business.deals.processed': DealProcessedEvent;
  'business.photos.processed': PhotoProcessedEvent;
};

// Event name type
export type EventName = keyof EventTypeMap;

// Type guard functions
export const isBusinessRawCollectedEvent = (event: DomainEvent): event is BusinessRawCollectedEvent => {
  return event.type === 'business.raw.collected';
};

export const isBusinessStandardizedEvent = (event: DomainEvent): event is BusinessStandardizedEvent => {
  return event.type === 'business.standardized';
};

export const isBusinessDeduplicatedEvent = (event: DomainEvent): event is BusinessDeduplicatedEvent => {
  return event.type === 'business.deduplicated';
};

export const isDealProcessedEvent = (event: DomainEvent): event is DealProcessedEvent => {
  return event.type === 'business.deals.processed';
};

export const isPhotoProcessedEvent = (event: DomainEvent): event is PhotoProcessedEvent => {
  return event.type === 'business.photos.processed';
};