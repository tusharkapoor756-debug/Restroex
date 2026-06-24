# Health Module

Provides system diagnostics and health check endpoints for monitoring and orchestration.

## Purpose
- Verify database connectivity.
- Verify Redis/Cache availability.
- Verify Queue/Worker status.
- Provide a ping endpoint for load balancers.

## Important Routes
- `GET /health`: Returns full system health status including:
  - `status`: Overall system state (`UP` or `DOWN`).
  - `uptime`: Process uptime in seconds.
  - `checks.database`: Connectivity to Supabase (`CONNECTED` or `DISCONNECTED`).
  - `checks.redis`: Connectivity to Redis (`CONNECTED` or `DISCONNECTED`).

## Architecture Boundaries
- **Must Control**: Connection heartbeats, diagnostic logic, infrastructure status reporting.
- **MUST NOT Control**: Any business-level health status (e.g., "is the restaurant open").
