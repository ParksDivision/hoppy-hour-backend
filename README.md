# Hoppy Hour Backend

A modern Express + TypeScript + Prisma backend with User CRUD operations and Bull + Redis queue system.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up Redis server:
   ```bash
   # Install and start Redis (varies by OS)
   # Linux/Mac with Homebrew: brew install redis && redis-server
   # Docker: docker run -d -p 6379:6379 redis:alpine
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database and Redis credentials
   ```

4. Set up database:
   ```bash
   npm run db:migrate
   npm run db:generate
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Users
- `POST /api/users` - Create user
- `GET /api/users` - Get all users  
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Queue Jobs
- `POST /api/queues/jobs/email` - Dispatch email job
- `POST /api/queues/jobs/data-processing` - Dispatch data processing job
- `POST /api/queues/jobs/file-upload` - Dispatch file upload job
- `POST /api/queues/jobs/notification` - Dispatch notification job
- `GET /api/queues/jobs/:jobType/:jobId/status` - Get job status
- `DELETE /api/queues/jobs/:jobType/:jobId` - Cancel job
- `POST /api/queues/jobs/:jobType/:jobId/retry` - Retry job

### Queue Monitoring
- `GET /api/queues/status` - Get all queue statuses
- `GET /api/queues/health` - Queue health check
- `GET /api/queues/stats` - Get queue statistics
- `GET /api/queues/dashboard` - Bull Dashboard (web UI)

### Health Check
- `GET /health` - Server health status

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:generate` - Generate Prisma client
- `npm run db:studio` - Open Prisma Studio
- `npm run db:reset` - Reset database and run migrations
