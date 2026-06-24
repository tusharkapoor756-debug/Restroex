# Database Infrastructure

The database layer provides direct access to the Supabase PostgreSQL instance using the official `@supabase/supabase-js` client.

## Design Decisions
- **No ORM**: We use direct client access to minimize overhead and maintain full control over SQL performance.
- **Singleton Pattern**: A single `DatabaseClient` instance is shared across the application.
- **Service Role**: Authentication is performed using the `service_role` key to allow administrative bypass of Row Level Security (RLS) where necessary for backend operations.
- **No-Fake-Table Policy**: We strictly avoid creating "health check" or placeholder tables. Infrastructure validation must remain independent of the data schema.

## Usage
```typescript
import { db } from '@/infrastructure/database/database.client';

const client = db.getClient();
const { data, error } = await client.from('your_table').select('*');
```

## Node.js Compatibility
We use the `ws` library to provide WebSocket support for Supabase Realtime features in the Node.js environment.

## Connectivity Validation
The database connectivity is validated during startup via the `db.connect()` method.

### Validation Approach
Instead of querying a database table (which would require the table to exist and depend on the schema), we perform a **REST API HEAD request** to the Supabase PostgREST endpoint (`/rest/v1/`).

This approach ensures:
1. **Lightweight Validation**: Minimal networking overhead with no data transfer.
2. **Infrastructure Verification**: Confirms that the `SUPABASE_URL` is reachable and the `SUPABASE_SERVICE_ROLE_KEY` is valid.
3. **Schema Independence**: The backend can start successfully even if the database is empty or the schema is being migrated.
4. **Reliability**: Avoids startup crashes caused by querying non-existent tables like `_health_check`.
