export interface BaseEvent {
  id: string;
  timestamp: Date;
  source: string;
}

export interface BusinessRawCollectedEvent extends BaseEvent {
  type: 'business.raw.collected';
  data: {
    sourceId: string;
    source: string;
    rawData: any;
    location: Location;
  };
}

export interface BusinessStandardizedEvent extends BaseEvent {
  type: 'business.standardized';
  data: {
    sourceId: string;
    source: string;
    standardizedBusiness: StandardizedBusiness;
  };
}

export interface BusinessDeduplicatedEvent extends BaseEvent {
  type: 'business.deduplicated';
  data: {
    businessId: string;
    action: 'created' | 'merged' | 'updated';
    confidence: number;
  };
}

export type BusinessEvent = 
  | BusinessRawCollectedEvent 
  | BusinessStandardizedEvent 
  | BusinessDeduplicatedEvent;