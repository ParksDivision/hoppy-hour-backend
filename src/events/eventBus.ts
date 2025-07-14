// src/events/eventBus.ts
import { EventEmitter } from 'events';
import { logger } from '../utils/logger/logger';
import type { BusinessEvent } from '../types/business';

// Create a singleton event emitter
class EventBus extends EventEmitter {
  private static instance: EventBus;
  private eventHistory: BusinessEvent[] = [];
  private maxHistorySize = 1000;

  private constructor() {
    super();
    this.setMaxListeners(50); // Increase max listeners for multiple services
    
    // Log all events for debugging
    this.onAny((eventType: string, event: BusinessEvent) => {
      logger.debug({
        eventType,
        eventId: event.id,
        source: event.source,
        timestamp: event.timestamp
      }, 'Event emitted');
      
      // Store in history (keep last 1000 events)
      this.eventHistory.push(event);
      if (this.eventHistory.length > this.maxHistorySize) {
        this.eventHistory.shift();
      }
    });
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  // Helper method to listen to any event
  private onAny(listener: (eventType: string, event: BusinessEvent) => void): void {
    const originalEmit = this.emit;
    this.emit = function(eventType: string | symbol, ...args: any[]): boolean {
      if (typeof eventType === 'string' && args[0] && typeof args[0] === 'object') {
        listener(eventType, args[0]);
      }
      return originalEmit.apply(this, [eventType, ...args]);
    };
  }

  // Get event history for debugging
  getEventHistory(limit?: number): BusinessEvent[] {
    return limit ? this.eventHistory.slice(-limit) : [...this.eventHistory];
  }

  // Get events by type
  getEventsByType(type: string, limit: number = 50): BusinessEvent[] {
    return this.eventHistory
      .filter(event => event.type === type)
      .slice(-limit);
  }

  // Clear event history
  clearHistory(): void {
    this.eventHistory = [];
  }

  // Get listener count for debugging
  getListenerStats(): Record<string, number> {
    const events = this.eventNames();
    const stats: Record<string, number> = {};
    
    events.forEach(event => {
      if (typeof event === 'string') {
        stats[event] = this.listenerCount(event);
      }
    });
    
    return stats;
  }
}

// Get the singleton instance
const eventBus = EventBus.getInstance();

// Type-safe event publishing
export const publishEvent = (event: BusinessEvent): void => {
  try {
    logger.info({
      eventId: event.id,
      eventType: event.type,
      source: event.source,
      timestamp: event.timestamp
    }, `Publishing event: ${event.type}`);
    
    eventBus.emit(event.type, event);
    
    // Emit a generic event for monitoring
    eventBus.emit('any-event', event);
    
  } catch (error) {
    logger.error({
      err: error,
      eventId: event.id,
      eventType: event.type
    }, 'Failed to publish event');
  }
};

// Type-safe event subscription
export const subscribeToEvent = <T extends BusinessEvent>(
  eventType: T['type'],
  handler: (event: T) => Promise<void>
): void => {
  try {
    const wrappedHandler = async (event: T) => {
      const startTime = Date.now();
      
      try {
        logger.debug({
          eventId: event.id,
          eventType: event.type,
          handlerName: handler.name || 'anonymous'
        }, `Processing event: ${event.type}`);
        
        await handler(event);
        
        const duration = Date.now() - startTime;
        logger.debug({
          eventId: event.id,
          eventType: event.type,
          duration,
          handlerName: handler.name || 'anonymous'
        }, `Successfully processed event: ${event.type}`);
        
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error({
          err: error,
          eventId: event.id,
          eventType: event.type,
          duration,
          handlerName: handler.name || 'anonymous'
        }, `Failed to process event: ${event.type}`);
        
        // Re-throw error to maintain error handling chain
        throw error;
      }
    };

    eventBus.on(eventType, wrappedHandler);
    
    logger.info({
      eventType,
      handlerName: handler.name || 'anonymous',
      totalListeners: eventBus.listenerCount(eventType)
    }, `Subscribed to event: ${eventType}`);
    
  } catch (error) {
    logger.error({
      err: error,
      eventType,
      handlerName: handler.name || 'anonymous'
    }, `Failed to subscribe to event: ${eventType}`);
  }
};

// Unsubscribe from events
export const unsubscribeFromEvent = (
  eventType: string,
  handler: (...args: any[]) => void
): void => {
  eventBus.off(eventType, handler);
  logger.info({
    eventType,
    handlerName: handler.name || 'anonymous',
    remainingListeners: eventBus.listenerCount(eventType)
  }, `Unsubscribed from event: ${eventType}`);
};

// Wait for a specific event (useful for testing)
export const waitForEvent = <T extends BusinessEvent>(
  eventType: T['type'],
  timeout: number = 10000,
  filter?: (event: T) => boolean
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Event ${eventType} not received within ${timeout}ms`));
    }, timeout);

    const handler = async (event: T) => {
      if (!filter || filter(event)) {
        cleanup();
        resolve(event);
      }
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      unsubscribeFromEvent(eventType, handler);
    };

    subscribeToEvent(eventType, handler);
  });
};

// Event monitoring utilities
export const getEventStats = () => {
  return {
    totalEvents: eventBus.getEventHistory().length,
    listenerStats: eventBus.getListenerStats(),
    recentEvents: eventBus.getEventHistory(10).map(event => ({
      id: event.id,
      type: event.type,
      source: event.source,
      timestamp: event.timestamp
    })),
    eventsByType: {
      'business.raw.collected': eventBus.getEventsByType('business.raw.collected', 10).length,
      'business.standardized': eventBus.getEventsByType('business.standardized', 10).length,
      'business.deduplicated': eventBus.getEventsByType('business.deduplicated', 10).length,
      'business.photos.processed': eventBus.getEventsByType('business.photos.processed', 10).length,
      'business.deals.processed': eventBus.getEventsByType('business.deals.processed', 10).length
    }
  };
};

// Clear all listeners (useful for testing)
export const clearAllListeners = (): void => {
  eventBus.removeAllListeners();
  logger.info('Cleared all event listeners');
};

// Export the event bus instance for advanced usage
export { eventBus };

// Event system health check
export const isEventSystemHealthy = (): boolean => {
  try {
    const stats = eventBus.getListenerStats();
    const hasListeners = Object.keys(stats).length > 0;
    const hasRecentActivity = eventBus.getEventHistory(1).length > 0;
    
    return hasListeners; // At minimum, should have listeners registered
  } catch (error) {
    logger.error({ err: error }, 'Event system health check failed');
    return false;
  }
};