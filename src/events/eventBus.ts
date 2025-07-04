import { EventEmitter } from 'events';
import { logger } from '../utils/logger/logger';
import type { 
  BusinessEvent, 
  EventHandler, 
  EventName, 
  EventTypeMap 
} from './eventTypes';

// Custom event emitter with enhanced logging
class BusinessEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Increase max listeners for multiple services
  }
}

// Global event bus instance
const eventBus = new BusinessEventEmitter();

// Event bus metrics
const eventMetrics = {
  published: new Map<EventName, number>(),
  processed: new Map<EventName, number>(),
  failed: new Map<EventName, number>(),
};

// Publish an event
export const publishEvent = <T extends BusinessEvent>(event: T): void => {
  try {
    logger.debug({
      eventId: event.id,
      eventType: event.type,
      source: event.source,
      timestamp: event.timestamp
    }, 'Publishing event');

    // Update metrics
    const currentCount = eventMetrics.published.get(event.type) || 0;
    eventMetrics.published.set(event.type, currentCount + 1);

    // Emit the event
    eventBus.emit(event.type, event);

    logger.info({
      eventId: event.id,
      eventType: event.type,
      source: event.source
    }, 'Event published successfully');

  } catch (error) {
    logger.error({
      err: error,
      eventId: event.id,
      eventType: event.type
    }, 'Failed to publish event');
    throw error;
  }
};

// Subscribe to an event
export const subscribeToEvent = <K extends EventName>(
  eventName: K,
  handler: EventHandler<EventTypeMap[K]>
): void => {
  try {
    const wrappedHandler = async (event: EventTypeMap[K]) => {
      const startTime = Date.now();
      
      try {
        logger.debug({
          eventId: event.id,
          eventType: event.type,
          handlerName: handler.name || 'anonymous'
        }, 'Processing event');

        await handler(event);

        // Update success metrics
        const currentCount = eventMetrics.processed.get(eventName) || 0;
        eventMetrics.processed.set(eventName, currentCount + 1);

        const duration = Date.now() - startTime;
        logger.info({
          eventId: event.id,
          eventType: event.type,
          handlerName: handler.name || 'anonymous',
          duration
        }, 'Event processed successfully');

      } catch (error) {
        // Update failure metrics
        const currentCount = eventMetrics.failed.get(eventName) || 0;
        eventMetrics.failed.set(eventName, currentCount + 1);

        logger.error({
          err: error,
          eventId: event.id,
          eventType: event.type,
          handlerName: handler.name || 'anonymous',
          duration: Date.now() - startTime
        }, 'Event processing failed');

        // Don't re-throw to prevent breaking other handlers
        // Instead, could implement retry logic or dead letter queue
      }
    };

    eventBus.on(eventName, wrappedHandler);

    logger.info({
      eventName,
      handlerName: handler.name || 'anonymous'
    }, 'Event handler registered');

  } catch (error) {
    logger.error({
      err: error,
      eventName,
      handlerName: handler.name || 'anonymous'
    }, 'Failed to register event handler');
    throw error;
  }
};

// Unsubscribe from an event
export const unsubscribeFromEvent = <K extends EventName>(
  eventName: K,
  handler: EventHandler<EventTypeMap[K]>
): void => {
  try {
    eventBus.off(eventName, handler);
    logger.info({
      eventName,
      handlerName: handler.name || 'anonymous'
    }, 'Event handler unregistered');
  } catch (error) {
    logger.error({
      err: error,
      eventName,
      handlerName: handler.name || 'anonymous'
    }, 'Failed to unregister event handler');
  }
};

// Get event metrics
export const getEventMetrics = () => {
  return {
    published: Object.fromEntries(eventMetrics.published),
    processed: Object.fromEntries(eventMetrics.processed),
    failed: Object.fromEntries(eventMetrics.failed),
    listeners: {
      'business.raw.collected': eventBus.listenerCount('business.raw.collected'),
      'business.standardized': eventBus.listenerCount('business.standardized'),
      'business.deduplicated': eventBus.listenerCount('business.deduplicated'),
    }
  };
};

// Clear all event listeners (useful for testing)
export const clearEventListeners = (): void => {
  eventBus.removeAllListeners();
  logger.info('All event listeners cleared');
};

// Get event bus instance for advanced operations
export const getEventBus = (): BusinessEventEmitter => eventBus;

// Graceful shutdown
export const shutdown = async (): Promise<void> => {
  logger.info('Shutting down event bus...');
  eventBus.removeAllListeners();
  logger.info('Event bus shutdown complete');
};