import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './openapi.registry';

export function generateOpenAPIDocument() {
  // Register security schemes with the registry
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Hoppy Hour API',
      version: '1.0.0',
      description: 'API for Hoppy Hour - data collection and business management',
      contact: {
        name: 'API Support',
        email: 'support@hoppyhour.com',
      },
    },
    servers: [
      {
        url: process.env.API_URL ?? 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://api.hoppyhour.com',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Google Places Collection',
        description: 'Endpoints for collecting data from Google Places API',
      },
      {
        name: 'Businesses',
        description: 'Business management endpoints',
      },
      {
        name: 'Users',
        description: 'User management endpoints',
      },
    ],
  });
}
