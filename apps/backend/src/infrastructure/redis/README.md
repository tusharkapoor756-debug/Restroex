# Redis Infrastructure

The Redis layer provides high-performance caching and messaging capabilities using the `ioredis` client.

## Design Decisions
- **Singleton Pattern**: Managed via `RedisClient` to ensure a single connection pool is maintained.
- **Retry Strategy**: Implements an exponential backoff retry strategy for transient connection failures.
- **Graceful Shutdown**: The client supports clean disconnection during application termination.

## Usage
```typescript
import { redis } from '@/infrastructure/redis/redis.client';

const client = redis.getClient();
await client.set('key', 'value');
```

## Monitoring
The Redis connection state is exposed via the `/health` endpoint and logged during the bootstrap sequence.
