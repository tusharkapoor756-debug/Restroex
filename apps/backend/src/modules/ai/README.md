# AI Module

The AI module provides natural language understanding capabilities, isolated from the rest of the business logic.

## Purpose
- Parse user intent from unstructured text.
- Extract entities (items, quantities, preferences).
- Provide confidence scores for interpretations.
- Manage fallbacks for low-confidence scenarios.

## Architecture Boundaries
- **Must Control**: Prompt engineering, LLM communication, data sanitization.
- **MUST NOT Control**: Database updates, state transitions, message sending.

## Important Components
- `parser/`: Core intent and entity extraction logic.
- `confidence/`: Scoring system to determine if a human takeover is needed.
- `fallbacks/`: Strategies for when AI cannot reliably understand the user.

## Design Rule
AI results are always validated by the `AIValidation` service before being passed back to the `conversations` engine.
