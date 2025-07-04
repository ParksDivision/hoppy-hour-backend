// Event system type definitions
import type { StandardizedBusiness } from '../types/business';

// Base event interface
export interface BaseEvent {
  id: string;
  timestamp: Date;
  source: string;
}

// Business raw data collected event
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

// Business standardized event
export interface BusinessStandardizedEvent extends BaseEvent {
  type: 'business.standardized';
  data: {
    sourceId: string;
    source: 'GOOGLE' | 'YELP' | 'FACEBOOK' | 'MANUAL';
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

// Union of all event types
export type BusinessEvent = 
  | BusinessRawCollectedEvent 
  | BusinessStandardizedEvent 
  | BusinessDeduplicatedEvent;

// Event handler type
export type EventHandler<T extends BusinessEvent> = (event: T) => Promise<void>;

// Event type map for type safety
export interface EventTypeMap {
  'business.raw.collected': BusinessRawCollectedEvent;
  'business.standardized': BusinessStandardizedEvent;
  'business.deduplicated': BusinessDeduplicatedEvent;
}

// Event names
export type EventName = keyof EventTypeMap;