import pino from 'pino';
import pretty from 'pino-pretty';

// Create stream for development pretty printing
const devStream = pretty({
  colorize: true,
  ignore: 'pid,hostname',
  translateTime: 'yyyy-mm-dd HH:MM:ss',
  messageFormat: '{msg} {context}',
});

// Custom serializers for better error logging
const customSerializers = {
  err: (error: Error) => ({
    type: error.name,
    message: error.message,
    stack: error.stack,
    ...(error as any), // Capture any custom error properties
  }),
};

const transport = pino.transport({
  targets: [
    {
      target: 'pino/file',
      level: 'info',
      options: { destination: './logs/app.log' },
    },
    // Separate error log file
    {
      target: 'pino/file',
      level: 'error',
      options: { destination: './logs/error.log' },
    },
  ],
});

// Create base logger instance
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  serializers: customSerializers,
  base: {
    env: process.env.NODE_ENV,
  },
  transport: process.env.NODE_ENV === 'production' 
    ? transport 
    : { target: 'pino-pretty', options: { colorize: true } }
}, process.env.NODE_ENV === 'production' ? undefined : devStream);

// Create child loggers for different services
export const createServiceLogger = (service: string) => {
  return logger.child({ service });
};

// Export specific service loggers
export const googlePlacesLogger = createServiceLogger('googlePlaces');
export const yelpLogger = createServiceLogger('yelp');
export const schedulerLogger = createServiceLogger('scheduler');