# Restroex Backend Service

The Restroex backend is a production-oriented Express API foundation built with TypeScript, focusing on scalability, observability, and modularity.

## API Architecture

### 1. Request Lifecycle
Each request follows a strict middleware execution order:
1. **Security**: Helmet, CORS, and Compression.
2. **Identification**: `requestIdMiddleware` generates a unique UUID for every request.
3. **Observability**: `requestLoggerMiddleware` captures method, path, status code, and duration.
4. **Routing**: Versioned routing through `/api/v1/`.
5. **Fallback**: `notFoundMiddleware` catches unmatched paths.
6. **Error Handling**: `errorMiddleware` centralizes all errors and ensures safe production responses.

### 2. API Versioning
All core API endpoints are prefixed with `/api/v1/`.
- Example: `http://localhost:4000/api/v1/health`

### 3. Standardized Responses

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Human readable message",
    "code": "INTERNAL_ERROR",
    "requestId": "uuid",
    "stack": "..." // Only in development
  }
}
```

### 4. Development Utilities
- **`asyncHandler`**: A wrapper to catch async errors automatically. Use it in all route handlers to avoid manual try/catch.
- **`AppError`**: Base class for operational errors. Throw specialized errors like `NotFoundError` or `BadRequestError` for automatic status code mapping.

## Queue Infrastructure (`src/infrastructure/queue/`)

The backend uses **BullMQ** (powered by Redis) for asynchronous task processing.

### 1. Centralized Queue Registry
All queues are managed through the `QueueRegistry`. This ensures consistent initialization and provides a single access point for producers.
Available queues: `whatsapp-incoming`, `ai-processing`, `notifications`, `payment-reconciliation`, `order-events`.

### 2. Standardized Queue Factory
The `QueueFactory` handles the creation of queue instances with production-ready defaults:
- **Retries**: 3 attempts with exponential backoff (starting at 1s).
- **Cleanup**: Automatic removal of old jobs (24h for completed, 7d for failed).
- **Type Safety**: Built-in support for generic job payload typing.

### 3. Worker Lifecycle Utilities
Simple logging utilities to track background worker state:
- **`logWorkerStartup(name)`**: Logs the initialization of a worker.
- **`logWorkerShutdown(name)`**: Logs the graceful stop of a worker.

### 4. Usage Pattern
```typescript
import { queueRegistry, QueueName, WhatsAppJobPayload, workerManager } from '@/infrastructure/queue';

// Producing a job
const whatsappQueue = queueRegistry.getQueue<WhatsAppJobPayload>(QueueName.WHATSAPP_INCOMING);
await whatsappQueue.add('process-message', { ...payload });

// Initializing a worker
const myWorker = new Worker(QueueName.WHATSAPP_INCOMING, async job => { ... });
logWorkerStartup(QueueName.WHATSAPP_INCOMING);

// On shutdown
logWorkerShutdown(QueueName.WHATSAPP_INCOMING);
```

## Local Environment Setup

### 1. Configure Environment Variables
Create a `.env` file in `apps/backend/`:
```bash
PORT=4000
NODE_ENV=development
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 2. Run Development Server
```bash
npm run dev
```
The API foundation will be available at `http://localhost:4000`.

## Directory Structure
- `src/bootstrap/`: Application and server initialization.
- `src/middlewares/`: Global request processing layers.
- `src/routes/`: Centralized route registration and versioning.
- `src/shared/`: Cross-cutting utilities and error classes.
- `src/modules/`: Domain-based business logic (Health, AI, etc).
