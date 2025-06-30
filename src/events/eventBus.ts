import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import type { BusinessEvent } from './eventTypes';

const eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(50);

export const publishEvent = (event: BusinessEvent): void => {
  logger.info({
    eventType: event.type,
    eventId: event.id,
    source: event.source
  }, 'Publishing event');

  eventEmitter.emit(event.type, event);
};

export const subscribeToEvent = <T extends BusinessEvent>(
  eventType: T['type'],
  handler: (event: T) => Promise<void> | void
): void => {
  eventEmitter.on(eventType, async (event: T) => {
    try {
      await handler(event);
    } catch (error) {
      logger.error({
        err: error,
        eventType,
        eventId: event.id
      }, 'Error handling event');
    }
  });
};

export const removeEventSubscription = (eventType: string, handler: Function): void => {
  eventEmitter.removeListener(eventType, handler);
};