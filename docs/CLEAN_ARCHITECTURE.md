# Clean Architecture: CRM 2.0

## Overview

CRM 2.0 implements **Clean Architecture** with layered separation of concerns.

### Architecture Layers

```
HTTP Layer (Express/app.js)
    ↓
Infrastructure (Bootstrap/DI)
    ↓
Adapters (Gateways: Meta, OpenAI, Flow, Supabase)
    ↓
Application (Use Cases: 5 use-cases)
    ↓
Domain (Entities: Contact, Message)
```

## Components

### Domain Layer

**Entities:**
- `Contact` - Customer/user with state machine (active, ai_agent, awaiting_input)
- `Message` - Conversation messages with attachment support

### Adapter Layer

**Gateways** (abstract external services):
- `MetaGateway` (17 methods) - Instagram/Meta API
- `OpenAiGateway` (11 methods) - AI agent logic
- `FlowGateway` (6 methods) - Flow engine
- `SupabaseGateway` (18 methods) - Database operations

### Application Layer

**Use Cases** (business orchestration):
- `HandleIncomingMessageUseCase` - Main DM handler (247 lines, BUG FIXES)
- `HandleCommentUseCase` - Instagram comments
- `HandlePostbackUseCase` - Button clicks
- `HandleMentionUseCase` - Mentions/tags
- `HandleAttachmentsUseCase` - File uploads

### Infrastructure Layer

**Bootstrap/DI** (`src/infrastructure/bootstrap.js`):
- Instantiates all gateways
- Instantiates all use-cases
- Injects dependencies
- Returns DI container

## Bug Fixes

✅ **Bug #1: Guard Condition Removed**
- ai_agent and awaiting_input states now reachable

✅ **Bug #2: Regex Matching Fixed**
- Each matchType is independent (contains, exact, starts_with, regex)

✅ **Bug #3: Awaiting Input Implemented**
- Full validation + retry logic (max 3 retries)

## Testing

### Unit Tests (14 tests)
```bash
node test_unit.js
```

### Integration Tests (6 tests)
```bash
node test_integration.js
```

## Adding Features

### New Use Case

1. Create `src/use-cases/HandleEventUseCase.js`
2. Inject gateways in constructor
3. Implement `async execute(inputData)` method
4. Export from `src/use-cases/index.js`
5. Add to bootstrap.js
6. Use in app.js via DI container

### New Gateway

1. Create `src/adapters/gateways/ServiceGateway.js`
2. Wrap external service
3. Export methods matching interface
4. Add to bootstrap.js
5. Inject into use-cases

## Files Added

```
src/domain/entities/
  - Contact.js
  - Message.js

src/adapters/gateways/
  - MetaGateway.js
  - OpenAiGateway.js
  - FlowGateway.js
  - SupabaseGateway.js

src/use-cases/
  - HandleIncomingMessageUseCase.js
  - HandleCommentUseCase.js
  - HandlePostbackUseCase.js
  - HandleMentionUseCase.js
  - HandleAttachmentsUseCase.js

src/infrastructure/
  - bootstrap.js

test_unit.js
test_integration.js
docs/CLEAN_ARCHITECTURE.md
```

## Migration Strategy

### Phase 1: Parallel Execution (CURRENT)
- Old handlers: Active
- New use-cases: Run alongside
- Both: Process same events

### Phase 2: Gradual Deprecation
- Use-cases become primary
- Handlers become fallback
- Monitor for stability

### Phase 3: Full Cleanup
- Remove old handlers
- Clean architecture complete
- Single source of truth

## Design Principles

1. **Single Responsibility** - One reason to change per class
2. **Dependency Injection** - Dependencies injected, not created
3. **Encapsulation** - Private implementation, public interface
4. **Testability** - Mock-friendly, fully testable
5. **Separation of Concerns** - Domain isolated from infrastructure

## Status

✅ Domain Layer: Complete
✅ Adapter Layer: Complete
✅ Application Layer: Complete
✅ Infrastructure: Complete
✅ Tests: 20/20 passing (14 unit + 6 integration)
✅ Dual Execution: Active (safe, reversible)

**Next:** Phase 4 cleanup and production validation
