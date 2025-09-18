import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

// Create a single shared registry instance
export const registry = new OpenAPIRegistry();

// Export zod for consistent usage
export { z };
