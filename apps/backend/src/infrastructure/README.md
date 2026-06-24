# Infrastructure Layer

The Infrastructure layer contains the technical implementations and clients required to support the application's domain logic.

## Components

### Database (`database/`)
Direct PostgreSQL/Supabase client implementation.
- Avoids ORM overhead.
- Manages connection pooling.

### Redis (`redis/`)
Shared caching layer.
- Used for session persistence and queue management.

### Queue (`queue/`)
Asynchronous job processing using BullMQ.
- `producers/`: Logic to emit jobs into the queue.
- `consumers/`: Logic to process jobs from the queue.

### Logger (`logger/`)
Structured logging implementation for production observability.

### Monitoring (`monitoring/`)
Integration with external monitoring and alerting services.

## Rules
- Infrastructure code must remain generic and decoupled from business logic.
- Domain modules should interact with infrastructure through well-defined clients.
