# Shared Layer Boundary Rules

## Purpose
The `shared/` directory is intended for truly reusable, domain-agnostic components that are utilized across multiple modules.

## Permitted Content
- **Global Helpers**: Generic utility functions (e.g., date formatting, string manipulation).
- **Generic Validators**: Reusable validation logic (e.g., email format, phone number regex).
- **Shared Constants**: Global constants (e.g., pagination defaults, HTTP status codes).
- **Shared Types**: Global TypeScript interfaces and types used by more than one module.

## Strict Rules
- **NO Business Logic**: Domain-specific rules and workflows must reside within their respective modules.
- **NO Workflow Rules**: Hidden orchestration logic is prohibited here.
- **NO Domain Logic**: Keep `shared/` lean and independent of the application's business core.

---
*Maintain modular integrity by keeping business logic isolated.*
