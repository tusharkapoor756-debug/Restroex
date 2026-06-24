# Events Layer

The Events layer facilitates decoupled communication between modules via an internal asynchronous event bus.

## Purpose
- Enable cross-module notifications without direct coupling.
- Support side effects (e.g., sending a notification after a payment is successful).
- Manage domain-specific events (`ORDER_PAID`, `PAYMENT_FAILED`).

## Architecture
- `event-bus/`: The core dispatcher implementation.
- `*-events/`: Domain-specific handlers that listen for and react to system events.

## Workflow
1. A module (e.g., `payments`) emits an event (`ORDER_PAID`).
2. The `EventBus` notifies all registered subscribers.
3. Subscribed handlers (e.g., in `order-events`) execute the necessary side effects.
