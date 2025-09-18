# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Core Commands:**
- `npm run dev` - Start development server with nodemon (auto-restart on changes)
- `npm run build` - Build TypeScript to JavaScript in `dist/` directory
- `npm start` - Start production server (runs compiled JS from dist/)
- `npm test` - No tests currently configured

**Database Commands:**
- `npm run db:migrate` - Run Prisma database migrations
- `npm run db:generate` - Generate Prisma client after schema changes
- `npm run db:studio` - Open Prisma Studio for database management
- `npm run db:reset` - Reset database and run all migrations

**Code Quality Commands:**
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking without emitting files

## Project Architecture

### Core Application Stack
This is an Express.js + TypeScript + Prisma backend with queue-based job processing:

**Technology Stack:**
- **Runtime**: Node.js with TypeScript
- **Web Framework**: Express.js with security middleware (helmet, CORS, rate limiting)
- **Database**: PostgreSQL with Prisma ORM
- **Queue System**: BullMQ + Redis for background job processing
- **Logging**: Pino structured logging with HTTP request/response logging

### Current Implementation Status
The codebase has infrastructure for business data processing but many advanced features mentioned in documentation are planned/incomplete:

**Active Components:**
- Basic user CRUD operations via REST API
- Simple email queue with BullMQ worker
- Google Places and Yelp service structure (clients exist but integration incomplete)
- Queue workers for Google Places and Yelp jobs (structure exists)

**Database Schema:**
- `prisma/schema.prisma` - Currently contains only User model
- Simple schema: User with id, email, name, timestamps
- Additional models for businesses/deals/photos mentioned in docs but not yet implemented

**Queue System:**
- `src/queues/index.ts` - Basic email queue setup with Redis
- Worker processes jobs with simple delay simulation
- Graceful shutdown handling for queue cleanup

### API Structure

**Current Active Routes:**
- `/api/users` - User CRUD operations (POST, GET, GET/:id, PUT/:id, DELETE/:id)
- `/health` - Basic health check endpoint

**Planned/Inactive Routes (structure exists but commented out):**
- Business data and search endpoints
- Yelp API integration endpoints  
- Photo upload and management endpoints
- S3 cost monitoring endpoints

**Security Configuration:**
- CORS with configurable origin (defaults to localhost:3000)
- Rate limiting: 100 req/15min (production), 1000 req/15min (development)
- Helmet security headers
- 10MB JSON payload limit
- Structured request/response logging with Pino

### Service Layer Architecture

**Google Places Integration:**
- `src/services/googlePlaces/client.ts` - HTTP client for Google Places API
- `src/services/googlePlaces/service.ts` - Business logic and data transformation
- `src/services/googlePlaces/types.ts` - TypeScript interfaces for API responses
- `src/queues/jobs/googlePlacesJobs.ts` - Queue job definitions
- `src/queues/workers/googlePlacesWorker.ts` - Background job processing

**Yelp Integration:**
- `src/services/yelp/client.ts` - HTTP client for Yelp API
- `src/services/yelp/service.ts` - Business logic and data transformation  
- `src/services/yelp/types.ts` - TypeScript interfaces for API responses
- `src/queues/jobs/yelpJobs.ts` - Queue job definitions
- `src/queues/workers/yelpWorker.ts` - Background job processing

**Type Definitions:**
- `src/types/master.types.ts` - Comprehensive GooglePlace interface based on official Google Places API documentation

### Configuration & Environment

**Core Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (required)
- `PORT` - Server port (defaults to 3001)
- `NODE_ENV` - Environment mode (affects rate limiting)
- `FRONTEND_URL` - CORS origin allowlist (defaults to localhost:3000)

**Redis Configuration:**
- `REDIS_HOST`, `REDIS_PORT` - Redis connection for BullMQ queues
- Configuration handled in `src/config/redis.ts`

**API Integration (planned):**
- `GOOGLE_PLACES_API_KEY` - For Google Places API integration
- Yelp API credentials (configuration exists in `src/config/yelp.ts`)

**Configuration Files:**
- `tsconfig.json` - TypeScript compilation settings
- `.eslintrc` and `prettier.config` - Code quality tools configuration
- Service-specific config files in `src/config/` directory

### Key Architectural Patterns

**Modular Service Architecture:**
- Services organized by external API (Google Places, Yelp)
- Each service has dedicated client, service layer, types, and queue jobs
- Clean separation between HTTP clients and business logic

**Queue-Based Processing:**
- BullMQ for background job processing with Redis
- Workers handle external API calls asynchronously
- Graceful shutdown handling for queue cleanup

**Type Safety:**
- Comprehensive TypeScript interfaces for external APIs
- Proper type definitions for queue jobs and service responses
- Type checking available via `npm run type-check`

### Development Notes

**Testing:** No test framework currently configured. Consider adding Jest or Vitest when implementing tests.

**Current Implementation State:** This is a foundational backend with user management and queue infrastructure. Business data processing, external API integrations, and advanced features are structured but not fully implemented.

**Server Configuration:** Runs on port 3001 with graceful shutdown handling. Includes comprehensive security middleware and structured logging.