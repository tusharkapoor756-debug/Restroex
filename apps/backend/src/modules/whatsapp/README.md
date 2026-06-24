# WhatsApp Module

Handles all incoming and outgoing communication with the WhatsApp Business API.

## Responsibilities
- Webhook reception and deduplication.
- Message sending (Text, Templates, Media).
- Retry logic for failed message deliveries.
- Template management.

## Architecture Boundaries
- **Must Control**: API communication, message formatting, delivery tracking.
- **MUST NOT Control**: Business logic, workflow state, user authentication.

## Key Files
- `webhook.controller.ts`: Entry point for all incoming messages.
- `message.service.ts`: Outbound message orchestration.
- `webhook.retry.ts`: Automated retry handling for transient failures.

## Reliability
Uses a deduplication layer to ensure the same WhatsApp message isn't processed multiple times by the backend.
