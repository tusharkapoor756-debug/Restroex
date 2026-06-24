# Conversations Module

The Conversations module is the central workflow engine for the Restroex platform. It functions as a Finite State Machine (FSM) that tracks and progresses customer interactions.

## Purpose
- Track user sessions and context.
- Manage order states (Browsing, Ordering, Payment).
- Handle edge cases like clarifications and recovery.

## Architecture Boundaries
- **Must Control**: Session persistence, state transitions, cart logic during the chat.
- **MUST NOT Control**: Payment processing (delegated to `payments`), Template sending (delegated to `whatsapp`), AI parsing (delegated to `ai`).

## Important Folders
- `engine/`: The core logic that decides the next state.
- `states/`: Definitions of valid conversation states.
- `transitions/`: Logic executed during state changes.
- `cart/`: Temporary cart storage during a session.

## Scaling Notes
Session data is stored in Redis for fast access and persistence across horizontal backend instances.
