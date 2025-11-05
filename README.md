# Hoppy Hour Backend

A production-ready Express + TypeScript + Prisma backend API with background job processing for collecting and managing business data from Google Places and Yelp APIs.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Web Framework**: Express.js with security middleware (Helmet, CORS, rate limiting)
- **Database**: PostgreSQL with Prisma ORM
- **Queue System**: BullMQ + Redis for background job processing
- **Logging**: Pino structured logging with HTTP request/response tracking
- **API Documentation**: OpenAPI/Swagger UI

## Features

- ✅ User management CRUD operations
- ✅ Google Places API integration with async job processing
- ✅ Background workers for data collection with retry logic
- ✅ Database storage for raw business data
- ✅ RESTful API with comprehensive error handling
- ✅ Auto-generated API documentation
- ✅ Rate limiting and security headers
- ✅ Structured logging for debugging and monitoring

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 15+ ([Download](https://www.postgresql.org/download/))
- **Redis** 5+ (for queue system)
- **Google Places API Key** ([Get one here](https://console.cloud.google.com/))

### Installing Redis

Choose one of the following methods:

**Option 1: Docker (Recommended)**
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

**Option 2: Package Manager**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows
# Download from: https://github.com/tporadowski/redis/releases
# Extract and run: redis-server.exe
```

**Verify Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

## Getting Started

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd hoppy-hour-backend
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/hoppy_hour"

# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# CORS
FRONTEND_URL=http://localhost:3000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Google Places API (REQUIRED)
GOOGLE_PLACES_API_KEY=your_actual_api_key_here

# Bull Dashboard Admin
ADMIN_CREDENTIALS=admin:admin123
```

**Important:** Replace `your_actual_api_key_here` with your real Google Places API key.

### 3. Set Up Database

Create the database:
```bash
createdb hoppy_hour
```

Run migrations and generate Prisma client:
```bash
npm run db:migrate
npm run db:generate
```

### 4. Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:3001`

You should see:
```
🚀 Server running on port 3001
📚 API Documentation: http://localhost:3001/swagger
📋 OpenAPI Spec: http://localhost:3001/openapi.json
✅ BullMQ queue system ready
```

## API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:3001/swagger
- **OpenAPI JSON**: http://localhost:3001/openapi.json

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Users
- `POST /api/users` - Create user
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Google Places Data Collection
- `POST /api/data-collection/google/search` - Trigger nearby business search
- `POST /api/data-collection/google/search/bulk` - Trigger multiple searches
- `GET /api/data-collection/google/businesses` - Get collected businesses (paginated)
- `GET /api/data-collection/google/businesses/:id` - Get specific business
- `GET /api/data-collection/google/businesses/search/name` - Search by name
- `GET /api/data-collection/google/queue/stats` - Queue statistics

### Example: Search Nearby Places

```bash
curl -X POST http://localhost:3001/api/data-collection/google/search \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 30.2672,
    "longitude": -97.7431,
    "radius": 5000,
    "maxResultCount": 20
  }'
```

Response (202 Accepted):
```json
{
  "message": "Search job queued successfully",
  "jobId": "job-id-123",
  "status": "queued",
  "data": {
    "latitude": 30.2672,
    "longitude": -97.7431,
    "radius": 5000
  }
}
```

The job will be processed asynchronously. Data will be saved to the database when complete.

## Available Scripts

### Development
- `npm run dev` - Start development server with hot reload (nodemon)
- `npm run build` - Build TypeScript to JavaScript in `dist/`
- `npm start` - Start production server (runs compiled JS)

### Database
- `npm run db:migrate` - Run Prisma database migrations
- `npm run db:generate` - Generate Prisma client after schema changes
- `npm run db:studio` - Open Prisma Studio for database management
- `npm run db:reset` - Reset database and run all migrations (⚠️ deletes data)

### Code Quality
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting without modifying
- `npm run type-check` - Run TypeScript type checking without emitting files

## Project Structure

```
src/
├── config/              # Environment-based configuration
│   ├── googlePlaces.ts  # Google API settings, field masks, defaults
│   ├── redis.ts         # Redis connection for queues
│   └── openapi.*        # Swagger documentation config
│
├── services/            # External API integrations
│   ├── googlePlaces/
│   │   ├── client.ts    # HTTP client with auth & error handling
│   │   ├── service.ts   # Business logic (search, details, transform)
│   │   └── types.ts     # TypeScript interfaces
│   └── yelp/            # Yelp API integration (structure exists)
│
├── schemas/             # Zod validation schemas
│   └── googlePlaces.schema.ts  # Request/response validation
│
├── queues/              # Background job processing (BullMQ)
│   ├── index.ts         # Queue initialization & shutdown
│   ├── jobs/
│   │   └── googlePlacesJobs.ts  # Job dispatch & management
│   └── workers/
│       └── googlePlacesWorker.ts  # Job processors
│
├── repositories/        # Database access layer (Prisma)
│   └── googleRawBusinessRepository.ts  # CRUD operations
│
├── controllers/         # HTTP request handlers
│   └── data-collection/
│       └── googleController.ts  # Google Places endpoints
│
├── routes/              # Express route definitions
│   ├── googleRoutes.ts  # Mount Google Places endpoints
│   └── userRoutes.ts    # Mount user endpoints
│
├── middleware/          # Express middleware
├── utils/               # Shared utilities (logger, database)
├── validation/          # Additional validation logic
└── index.ts            # Express app setup & server start
```

## Database Schema

### GoogleRawBusiness
Stores raw business data collected from Google Places API:

```typescript
{
  id: UUID
  name: string
  addressFull: JSON
  location: JSON { latitude, longitude }
  primaryPhone: string
  uri: string
  data: JSON  // Complete Google Place object
  createdOn: DateTime
  createdBy: string
  updatedOn: DateTime
  updatedBy: string
}
```

## Background Job Processing

The application uses BullMQ for async job processing:

**Features:**
- ✅ Automatic retries (3 attempts with exponential backoff)
- ✅ Rate limiting (10 jobs/second)
- ✅ Concurrent processing (5 jobs simultaneously)
- ✅ Job progress tracking
- ✅ Dead letter queue for failed jobs
- ✅ Graceful shutdown handling

**Job Flow:**
1. HTTP Request → Controller validates request
2. Job added to Redis queue → Returns 202 Accepted
3. Worker picks up job → Calls Google Places API
4. Response validated with Zod schemas
5. Data transformed to database format
6. Bulk insert to PostgreSQL
7. Job marked complete

## Configuration

### Google Places API

Default search settings in [src/config/googlePlaces.ts](src/config/googlePlaces.ts):

- **Radius**: 10 miles (1694 meters)
- **Max Results**: 500 per search
- **Included Types**: bars, pubs, restaurants, nightclubs, cafes, etc.
- **Field Masks**: basic, standard, detailed presets

### Rate Limiting

- **Production**: 100 requests per 15 minutes
- **Development**: 1000 requests per 15 minutes

### Security

- Helmet.js for security headers
- CORS with configurable origins
- Rate limiting per IP
- 10MB JSON payload limit
- Structured logging with Pino

## Troubleshooting

### Server won't start

**Redis connection error:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
→ Make sure Redis is running: `redis-cli ping`

**Google API key error:**
```
Error: GOOGLE_PLACES_API_KEY environment variable is required
```
→ Add your API key to `.env` file

### Database connection issues

**Connection refused:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
→ Ensure PostgreSQL is running and database exists

**Run migrations:**
```bash
npm run db:migrate
```

### Jobs not processing

Check queue stats:
```bash
curl http://localhost:3001/api/data-collection/google/queue/stats
```

Check logs for worker errors:
```bash
# Logs are output to console in development mode
```

## Development Workflow

1. Make code changes (hot reload enabled with nodemon)
2. Run linter: `npm run lint:fix`
3. Check types: `npm run type-check`
4. Format code: `npm run format`
5. Test API with Swagger UI or curl
6. Check logs in console

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set environment variables:
   ```bash
   NODE_ENV=production
   # Set other production values
   ```

3. Run migrations:
   ```bash
   npm run db:migrate
   ```

4. Start the server:
   ```bash
   npm start
   ```

**Production Recommendations:**
- Use managed Redis (AWS ElastiCache, Google Cloud Memorystore)
- Use managed PostgreSQL (AWS RDS, Google Cloud SQL)
- Set up process manager (PM2, systemd)
- Configure proper logging aggregation
- Set up monitoring and alerting
- Enable database backups
- Use environment secrets management

## Contributing

1. Create a feature branch
2. Make your changes
3. Run linting and type checking
4. Test your changes
5. Submit a pull request

## License

ISC

## Support

For issues or questions, please open an issue in the repository.
