# Restroex Worker

The Restroex Worker is a dedicated service for processing asynchronous background jobs and long-running tasks.

## Purpose
- Offload heavy computations from the main API (backend).
- Handle third-party integrations (Email, WhatsApp, Push Notifications).
- Perform periodic data maintenance and analytics aggregation.
- Image processing and document generation.

## Queue Architecture (Future)
- **Engine**: Powered by **BullMQ** and **Redis**.
- **Reliability**: Jobs are persisted in Redis and support automatic retries with exponential backoff.
- **Concurrency**: Scalable horizontally by adding more worker instances.

## Runtime Startup
To run the worker locally:
```bash
# From the project root
npm run dev --filter worker

# Or directly in this directory
npm run dev
```

## Important Rules
- **No Direct API Access**: The worker should interact with the database directly or via events, but should not expose its own API endpoints.
- **Graceful Shutdown**: Always handle `SIGTERM` and `SIGINT` to ensure active jobs are not abandoned.
- **Idempotency**: All jobs must be designed to be idempotent to handle retries safely.
