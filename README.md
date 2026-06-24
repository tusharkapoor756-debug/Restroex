# Restroex Monorepo

Restroex is a high-performance, transactional workflow engine with AI assistance, designed for modern restaurant operations. This monorepo manages all core services, shared packages, and developer tools.

## Architecture Philosophy
- **Domain-Driven Design (DDD)**: Logic is isolated into feature-based modules.
- **Modular & Scalable**: Clean separation of concerns between business logic, infrastructure, and events.
- **Event-Driven**: Internal domain events facilitate decoupled communication.
- **Direct Database Access**: High-performance direct PostgreSQL/Supabase client architecture.
- **AI-Native**: Built-in AI parsing and confidence scoring for conversational workflows.

## Monorepo Structure

### Applications (`apps/`)
- `dashboard/`: Next.js frontend for administrative and user interfaces.
- `backend/`: Core transactional engine and API (Node.js/Express/TS).
- `worker/`: Background job processing using BullMQ.

### Shared Packages (`packages/`)
- `@restroex/database`: Database schema definitions and client configurations.
- `@restroex/shared`: Truly global utilities, validators, and constants.
- `@restroex/config`: Centralized system configurations (ESLint, TS, etc.).
- `@restroex/types`: Global TypeScript interfaces and definitions.

## Project Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Backend** | Workflow orchestration, state management, API endpoints. |
| **Worker** | Async tasks, image processing, heavy computations. |
| **Dashboard** | Visualization, user management, configuration UI. |
| **Database** | Data persistence, schema integrity (Supabase/PostgreSQL). |

## Getting Started

### Prerequisites
- Node.js (Latest LTS)
- Redis (for Queue/BullMQ)
- Supabase/PostgreSQL instance

### Development Commands
The project uses **Turborepo** for efficient task execution across workspaces.

```bash
# Install dependencies for all apps and packages
npm install

# Run all applications in development mode (parallel)
npm run dev

# Build all applications and packages
npm run build

# Run linting across the entire monorepo
npm run lint

# Format all files using Prettier
npm run format
```

## Workspace Structure
- **apps/**: Main executable applications.
  - `dashboard`: User interface.
  - `backend`: Transactional engine.
  - `worker`: Background task processor.
- **packages/**: Shared logic and configurations.
  - `@restroex/database`: Database client.
  - `@restroex/shared`: Global utilities.
  - `@restroex/config`: Shared tool configurations.
  - `@restroex/types`: TypeScript definitions.

## Local Development Workflow
1. **Initial Setup**: Run `npm install` at the root.
2. **Environment**: Configure `.env` files in each app (see `Environment Requirements`).
3. **Execution**: Use `npm run dev` from the root to start all services. Turborepo will orchestrate the startup of the backend, dashboard, and worker.

## Environment Requirements
The project uses a modular environment configuration. Ensure each application has its own `.env` file based on the provided templates:

### Backend (`apps/backend/.env`)
- `SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Your project's administrative secret key.
- `REDIS_HOST`: Local or remote Redis host.
- `REDIS_PORT`: Redis port (default: 6379).
- `PORT`: API server port (default: 3000).

## Workflow Overview
1. **Request Ingress**: Handled by `apps/backend`.
2. **State Transition**: `conversations` module manages the order/workflow state.
3. **AI Assistance**: `ai` module parses intent and extracts entities.
4. **Action Dispatch**: Events are emitted via `EventBus`.
5. **Async Processing**: `worker` handles background tasks via `infrastructure/queue`.
