# Nodes Architecture

## Overview

The nodes module implements a **Factory Pattern** and **Strategy Pattern** based architecture for creating and executing different types of flow steps. This follows the design patterns from "Node.js Design Patterns" (Casciaro & Mammino, 2020).

## Structure

### Base Classes
- **BaseNode**: Abstract base class implementing the Template Method pattern
  - Provides structure: `validate()` → `prepare()` → `executeImpl()` → `postProcess()`
  - All node types must extend this class

### Strategies
- **ExecutionStrategy**: Interface for different execution strategies
- **AdTriggerExecutionStrategy**: Implementation for ad trigger nodes
  - Integrates with Meta API
  - Creates Welcome Message Flows
  - Saves metadata to database

### Factories
- **NodeFactory**: Factory pattern implementation
  - Registers node types
  - Creates instances without exposing implementation details
  - Injects dependencies
  
- **NodeRegistry**: Centralized registration of all available node types
  - Called during app initialization
  - Registers: text, buttons, ad_trigger (and future types)

### Implementations
- **TextNode**: Simple text message node
- **ButtonsNode**: Message with buttons node
- **AdTriggerNode**: Ad trigger node (NEW)
  - Creates Welcome Message Flows on Instagram
  - Validates messages and quick replies
  - Enforces Meta API limitations

## Design Patterns Used

### 1. Factory Pattern (Cap. 7)
```javascript
const node = NodeFactory.create('ad_trigger', config);
```
- Create nodes without knowing implementation details
- Easy to add new node types

### 2. Strategy Pattern (Cap. 9)
```javascript
const strategy = new AdTriggerExecutionStrategy(metaService, welcomeFlows);
await strategy.execute(step, context);
```
- Different execution strategies for each node type
- Easy to swap implementations

### 3. Template Method Pattern (BaseNode)
```javascript
async execute(step, context) {
  this.validate(step);
  const prepared = this.prepare(step, context);
  await this.executeImpl(prepared, context);
  await this.postProcess(prepared, context);
}
```
- Define structure in base class
- Let subclasses implement specific behavior

## Usage Example

### Initialize Registry (in app.js)
```javascript
const { initializeNodeRegistry } = require('./src/nodes');
const NodeFactory = require('./src/nodes/factories/NodeFactory');

const nodeDependencies = {
  metaService: meta,
  welcomeFlowsService: welcomeFlows,
  supabase
};

initializeNodeRegistry(nodeDependencies);
```

### Create and Execute a Node
```javascript
const step = {
  type: 'ad_trigger',
  message: 'Welcome to our campaign',
  quick_replies: [
    { title: 'Learn More', payload: 'MORE_INFO' },
    { title: 'Shop Now', payload: 'SHOP' }
  ]
};

const node = NodeFactory.create('ad_trigger', {
  executionStrategy: context.strategies['ad_trigger']
});

await node.execute(step, context);
```

## Adding New Node Types

### 1. Create Implementation
```javascript
// src/nodes/implementations/CustomNode.js
const BaseNode = require('../base/BaseNode');

class CustomNode extends BaseNode {
  constructor(config) {
    super({ type: 'custom', ...config });
  }

  validate(step) {
    super.validate(step);
    // Custom validation
  }

  async executeImpl(step, context) {
    // Implementation
  }
}

module.exports = CustomNode;
```

### 2. Create Strategy (if needed)
```javascript
// src/nodes/strategies/CustomExecutionStrategy.js
const ExecutionStrategy = require('./ExecutionStrategy');

class CustomExecutionStrategy extends ExecutionStrategy {
  async execute(step, context) {
    // Implementation
  }
}

module.exports = CustomExecutionStrategy;
```

### 3. Register in NodeRegistry
```javascript
// src/nodes/factories/NodeRegistry.js
NodeFactory.register('custom', CustomNode, dependencies);
```

## Ad Trigger Node Validation

### Message
- Required: must be non-empty string
- Max length: 2000 characters
- No variables allowed: no `{{}}` or `{username}`

### Quick Replies
- Required: at least 1, max 13 buttons
- Each button must have:
  - `title`: max 20 characters
  - `payload`: max 1000 characters

### Constraints
- Must be first step in flow
- No support for flow variables (Meta API limitation)

## Error Handling

Each strategy implements rollback:
```javascript
async rollback(step, context, error) {
  // Cleanup on failure
  console.error('Error:', error.message);
  context.broadcastLog?.('ERROR', `Error: ${error.message}`);
}
```

## Testing

Tests are located in `test/nodes/` and `test/factories/`:
- **AdTriggerNode.test.js**: Unit tests for ad trigger validation and execution
- **NodeFactory.test.js**: Factory pattern tests
- **CreateFlowUseCase.test.js**: Integration tests with use case

Run tests:
```bash
npm test -- test/nodes/
npm test -- test/factories/
npm test -- test/use-cases/
```

## Performance Considerations

1. **Registry Caching**: Node types are cached in a Map for O(1) lookup
2. **Lazy Loading**: Strategies can be instantiated on demand
3. **Execution Logging**: Optional execution tracking via context.trackExecution
4. **Concurrency**: Use NodeExecutorService for flow orchestration

## Security

1. **Input Validation**: All inputs validated before Meta API calls
2. **Sanitization**: Messages and payloads sanitized before sending to Meta
3. **Access Control**: context.accessToken and context.userId for auth
4. **Audit Trail**: All executions logged with timestamps

## References

- Node.js Design Patterns (Casciaro & Mammino, 2020)
  - Chapter 7: Factory Pattern
  - Chapter 9: Strategy Pattern & Middleware
  - Chapter 3: Observer Pattern & Events
