# Payments Module

The Payments module handles all financial transactions, provider integrations, and payment reconciliation.

## Responsibilities
- Integration with payment gateways (Razorpay).
- Webhook handling for asynchronous payment updates.
- Transaction reconciliation and idempotency management.
- Refund processing.

## Architecture Boundaries
- **Must Control**: Payment lifecycle, gateway communication, transaction logs.
- **MUST NOT Control**: Order business logic (delegated to `orders`), User management (delegated to `users`).

## Critical Files
- `razorpay.service.ts`: Primary provider integration.
- `payment.webhook.ts`: Entry point for external provider notifications.
- `payment.idempotency.ts`: Ensures transactions are only processed once.

## Security
All webhooks must be verified using the provider's signature before processing.
