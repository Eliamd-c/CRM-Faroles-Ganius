# Builder Refactoring - Phase 1 (Critical)

**Duration:** 2 weeks (80 working hours)
**Goal:** Transform 3,054-line monolith into modular, maintainable architecture
**Status:** Planning → In Progress

---

## Phase 1 Breakdown

### WEEK 1: Modularization & Foundation

#### Step 1.1: Create Module Structure (6 hours)
**Objective:** Set up new directory structure without breaking current code

```
public/
├── builder.js                    (CURRENT - keep as is for now)
├── builder-new/                  (NEW)
│   ├── index.js                  (Entry point, coordinates modules)
│   ├── config.js                 (Constants, magic numbers)
│   ├── state/
│   │   ├── index.js              (Unified state management)
│   │   ├── schema.js             (State validation)
│   │   ├── actions.js            (State mutations)
│   │   └── selectors.js          (State queries)
│   ├── adapters/
│   │   ├── drawflow.js           (Drawflow adapter/facade)
│   │   ├── api.js                (Backend API client)
│   │   └── storage.js            (Local storage)
│   ├── nodes/
│   │   ├── node-factory.js       (Create node instances)
│   │   ├── node-renderer.js      (Render node visuals)
│   │   ├── node-config.js        (Node configuration)
│   │   └── nodes/
│   │       ├── message.js
│   │       ├── trigger.js
│   │       ├── condition.js
│   │       ├── action.js
│   │       └── ... (other node types)
│   ├── ui/
│   │   ├── inspector.js          (Config panel)
│   │   ├── modals.js             (Modal dialogs)
│   │   ├── toolbar.js            (Header toolbar)
│   │   └── canvas.js             (Canvas controls)
│   ├── services/
│   │   ├── flow.js               (Flow operations)
│   │   ├── undo-redo.js          (History management)
│   │   ├── validation.js         (Flow validation)
│   │   └── ai-generator.js       (AI flow generation)
│   └── utils/
│       ├── errors.js             (Error handling)
│       ├── logger.js             (Logging)
│       └── helpers.js            (Utility functions)
```

**Deliverables:**
- [ ] Create directory structure
- [ ] Create index.js (empty entry point)
- [ ] Create config.js with all magic numbers extracted
- [ ] Document module responsibilities
- [ ] Verify no build errors

**Validation:**
```bash
# Verify directory structure
ls -R public/builder-new/
# Should show all directories created
```

---

#### Step 1.2: Extract Constants & Configuration (3 hours)
**Objective:** Remove magic numbers from builder.js

**From builder.js, extract to config.js:**
- Z-index values (9000, 9999, 10000)
- Debounce timeouts (50, 100, 150, 200, 500ms)
- Node position offsets (350, 380)
- History limits (MAX_HISTORY = 50)
- Notification limits (MAX_NOTIFICATIONS = 4)
- All hardcoded strings (error messages, labels)

**Deliverables:**
- [ ] Create config.js with 50+ constants organized by category
- [ ] Replace all magic numbers in builder.js with config.XXX references
- [ ] Document each constant
- [ ] Add config validation (typeof checks)

**Validation:**
```bash
# Verify no magic numbers in builder.js remain
grep -n "^\s*[0-9]\{3,\}" public/builder.js
# Should return only line numbers, no values
```

---

#### Step 1.3: Build Unified State Management (8 hours)
**Objective:** Replace 15 parallel state objects with single source of truth

**Current state objects to consolidate:**
- nodeBlocksState
- nodeActionsState
- nodeInputState
- nodeConditionState
- nodeRandomizerState
- nodeCarouselState
- nodeGalleryState
- nodeAudioState
- nodeVideoState
- nodeFileState
- nodeDelayState
- nodeGotoState
- nodeAiAgentState

**New state structure (builder-new/state/index.js):**
```javascript
const flowState = {
  flowId: null,
  flowName: 'Untitled Flow',
  flowStatus: 'draft',
  isDirty: false,
  nodes: {
    'node-1': {
      id: 'node-1',
      type: 'message',
      name: 'Message 1',
      position: { x: 100, y: 100 },
      data: {
        _blocks: [...],     // Message-specific
        _action: {...},     // Action-specific
        _input: {...},      // Input-specific
        _condition: {...},  // Condition-specific
        // ... other node-type-specific data
      }
    },
    // ... more nodes
  },
  connections: {
    'conn-1': {
      id: 'conn-1',
      from: 'node-1',
      output: 1,
      to: 'node-2',
      input: 'in'
    }
  },
  ui: {
    selectedNodeId: null,
    zoomLevel: 1,
    panX: 0,
    panY: 0,
    sidebarCollapsed: false
  },
  undo: {
    past: [],
    future: [],
    MAX_HISTORY: 50
  }
}
```

**Deliverables:**
- [ ] Create state/index.js with flowState initializer
- [ ] Create state/schema.js with validation rules
- [ ] Create state/actions.js with mutation functions:
  - addNode(type, position)
  - deleteNode(nodeId)
  - updateNode(nodeId, data)
  - addConnection(from, to)
  - deleteConnection(connId)
  - setSelectedNode(nodeId)
  - markDirty()
  - pushHistory(snapshot)
  - undo()
  - redo()
- [ ] Create state/selectors.js for read-only queries:
  - getNode(nodeId)
  - getNodes()
  - getConnections()
  - getSelectedNode()
  - isDirty()
  - canUndo()
  - canRedo()
- [ ] Write 10+ unit tests for state mutations
- [ ] Verify state immutability (no direct mutations)

**Validation:**
```javascript
// state/index.js should export:
export { createInitialState, flowStateSchema, stateActions, stateSelectors }

// Usage:
const state = createInitialState();
state = stateActions.addNode(state, 'message', {x: 100, y: 100});
const selectedNode = stateSelectors.getSelectedNode(state);
```

---

#### Step 1.4: Build Drawflow Adapter (6 hours)
**Objective:** Isolate all Drawflow API calls behind a clean interface

**Create adapters/drawflow.js:**
```javascript
class DrawflowAdapter {
  constructor(containerId) {
    this.editor = new Drawflow(document.getElementById(containerId));
    this.editor.start();
  }

  // Node operations
  addNode(nodeId, nodeType, position, data) { /* ... */ }
  removeNode(nodeId) { /* ... */ }
  updateNode(nodeId, data) { /* ... */ }
  
  // Connection operations
  addConnection(fromId, fromOutput, toId, toInput) { /* ... */ }
  removeConnection(connId) { /* ... */ }
  
  // Layout operations
  zoomIn() { /* ... */ }
  zoomOut() { /* ... */ }
  fit() { /* ... */ }
  
  // Import/Export (with error handling)
  exportFlow() { /* returns clean JSON */ }
  importFlow(json) { /* validates before import */ }
  
  // Events (with consistent API)
  on(event, callback) { /* ... */ }
  off(event, callback) { /* ... */ }
  
  // Cleanup
  destroy() { /* cleanup listeners */ }
}

export default DrawflowAdapter;
```

**Deliverables:**
- [ ] Create adapters/drawflow.js with complete API coverage
- [ ] Wrap all Drawflow methods with error handling
- [ ] Add type validation for inputs
- [ ] Document all methods with JSDoc
- [ ] Create 5+ unit tests (mocking Drawflow)

**Validation:**
```javascript
// No builder code should call editor.addNode() directly
// All calls should go through adapter
grep -r "editor\.addNode\|editor\.import\|editor\.export" public/builder.js
# Should return 0 matches after refactor
```

---

#### Step 1.5: Build API Client (4 hours)
**Objective:** Centralize all backend communication with error handling

**Create adapters/api.js:**
```javascript
class ApiClient {
  constructor(authToken) {
    this.token = authToken;
    this.baseUrl = '/api';
  }

  // Flow operations
  async saveFlow(flowData) { /* POST /api/flows */ }
  async loadFlow(flowId) { /* GET /api/flows/:id */ }
  async publishFlow(flowId) { /* POST /api/flows/:id/publish */ }
  async deleteFlow(flowId) { /* DELETE /api/flows/:id */ }
  async listFlows() { /* GET /api/flows */ }
  
  // AI operations
  async generateFlowFromAI(prompt) { /* POST /api/ai/generate */ }
  
  // Validation
  async validateFlow(flowData) { /* POST /api/flows/validate */ }
  
  // Internal error handling
  async _fetch(method, endpoint, body) {
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: body ? JSON.stringify(body) : undefined
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new ApiError(error.message, res.status, error.code);
      }
      
      return await res.json();
    } catch (e) {
      logger.error('API call failed', { method, endpoint, error: e });
      throw e;
    }
  }
}

export default ApiClient;
```

**Deliverables:**
- [ ] Create adapters/api.js with all endpoints
- [ ] Create utils/errors.js with ApiError, ValidationError classes
- [ ] Add retry logic for network failures
- [ ] Add request timeout (5s default)
- [ ] Create 8+ unit tests (mocking fetch)

**Validation:**
```bash
# Verify all fetch() calls in builder.js will be replaced
grep -n "fetch(" public/builder.js | wc -l
# Count should match number of API methods created
```

---

### WEEK 2: Error Handling & Integration Testing

#### Step 2.1: Implement Error Handling Layer (6 hours)
**Objective:** Catch and report all errors to user appropriately

**Create utils/errors.js:**
```javascript
class AppError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
  }
}

class ApiError extends AppError {
  constructor(message, status, code) {
    super(message, code, { status });
    this.status = status;
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 'VALIDATION_ERROR', { errors });
    this.errors = errors;
  }
}

// Error handler
function handleError(error) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      // Auth expired
      Toast.error('Tu sesión expiró. Por favor, vuelve a ingresar.');
      redirectToLogin();
    } else if (error.status === 500) {
      Toast.error('Error en el servidor. Intenta más tarde.');
    } else {
      Toast.error(error.message);
    }
  } else if (error instanceof ValidationError) {
    Toast.error(`Validación fallida: ${error.message}`);
    showValidationErrors(error.errors);
  } else {
    Toast.error('Algo salió mal. Intenta nuevamente.');
  }
  
  // Log to backend for monitoring
  logger.error('Unhandled error', { error });
}

export { AppError, ApiError, ValidationError, handleError };
```

**Create utils/logger.js:**
```javascript
class Logger {
  log(level, message, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userAgent: navigator.userAgent
    };
    
    console[level === 'error' ? 'error' : 'log'](message, context);
    
    // Send to backend (async, non-blocking)
    if (level === 'error' || level === 'warn') {
      fetch('/api/logs', {
        method: 'POST',
        body: JSON.stringify(entry)
      }).catch(() => {}); // Silently ignore log failures
    }
  }

  error(message, context) { this.log('error', message, context); }
  warn(message, context) { this.log('warn', message, context); }
  info(message, context) { this.log('info', message, context); }
}

export default new Logger();
```

**Deliverables:**
- [ ] Create utils/errors.js with error classes
- [ ] Create utils/logger.js with logging
- [ ] Wrap all async operations in try-catch
- [ ] Add error toast notifications
- [ ] Create 6+ error handling tests

**Validation:**
```bash
# Verify try-catch coverage
grep -n "try\|catch" public/builder-new/**/*.js | wc -l
# Should have at least 15+ try-catch blocks
```

---

#### Step 2.2: Migrate Existing Features (10 hours)
**Objective:** Port existing builder.js logic into new modules incrementally

**Migrate in this order (dependency chain):**

1. **Trigger node (2h)** - Simplest, no dependencies
   - Create nodes/nodes/trigger.js
   - Implement renderTriggerNode() using new pattern
   - Add to node registry

2. **Message node (2h)** - Depends on block system
   - Create nodes/nodes/message.js
   - Implement block management (add, delete, update)
   - Implement renderBlocksInNode()

3. **Action node (1.5h)** - Depends on ACTION_CATALOG
   - Create nodes/nodes/action.js
   - Move ACTION_CATALOG to nodes/action-catalog.js
   - Implement renderActionNode()

4. **Remaining nodes (4.5h)**
   - Input, Condition, Randomizer, Carousel, etc.
   - Same pattern: render + config
   - Port 1 node per hour

**Deliverables:**
- [ ] Port 8 node types to new modules
- [ ] Ensure each node renders identically to old code
- [ ] Add unit test for each node type
- [ ] Document node creation/update pattern
- [ ] Verify no regressions in UI

**Validation:**
```bash
# Compare old vs new rendering
# Open builder with ?debug=true flag
# Visually inspect nodes look identical
# Run automated screenshot comparison (if possible)
```

---

#### Step 2.3: Build Integration Tests (8 hours)
**Objective:** Verify entire flow works end-to-end

**Create test_phase1_integration.js:**
```javascript
describe('Phase 1 Integration Tests', () => {
  let state, adapter, api, flowApp;

  beforeEach(async () => {
    // Initialize new modules
    state = createInitialState();
    adapter = new DrawflowAdapter('drawflow');
    api = new ApiClient(getAuthToken());
    flowApp = new FlowBuilder({ state, adapter, api });
  });

  describe('Flow Creation', () => {
    test('Create empty flow', () => {
      const newState = stateActions.initializeFlow(state, 'My Flow');
      expect(newState.flowName).toBe('My Flow');
      expect(newState.nodes).toEqual({});
    });

    test('Add trigger node', () => {
      state = stateActions.addNode(state, 'trigger', {x: 100, y: 100});
      expect(Object.keys(state.nodes)).toHaveLength(1);
    });

    test('Add message node', () => {
      state = stateActions.addNode(state, 'message', {x: 200, y: 100});
      expect(state.nodes['node-2'].type).toBe('message');
    });

    test('Connect trigger to message', () => {
      const node1 = Object.keys(state.nodes)[0];
      const node2 = Object.keys(state.nodes)[1];
      state = stateActions.addConnection(state, node1, 1, node2, 'in');
      expect(state.connections).toHaveLength(1);
    });
  });

  describe('State Persistence', () => {
    test('Save flow to backend', async () => {
      state = stateActions.markDirty(state, true);
      const result = await api.saveFlow(state);
      expect(result.flowId).toBeDefined();
    });

    test('Load flow from backend', async () => {
      const loaded = await api.loadFlow('flow-123');
      expect(loaded.flowName).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('Handle API errors gracefully', async () => {
      const result = await flowApp.saveFlow();
      // Should show error toast, not crash
      expect(Toast.lastError).toBeDefined();
    });

    test('Undo/Redo work after errors', () => {
      state = stateActions.addNode(state, 'message', {x: 100, y: 100});
      state = stateActions.pushHistory(state);
      state = stateActions.addNode(state, 'action', {x: 200, y: 100});
      state = stateActions.undo(state);
      expect(Object.keys(state.nodes)).toHaveLength(1);
    });
  });
});
```

**Deliverables:**
- [ ] Create test_phase1_integration.js with 15+ test cases
- [ ] Test all happy paths
- [ ] Test error scenarios
- [ ] Test undo/redo
- [ ] Test state persistence
- [ ] All tests pass (15/15 green)

**Validation:**
```bash
node test_phase1_integration.js
# Expected output:
# ✓ Create empty flow
# ✓ Add trigger node
# ✓ Add message node
# ✓ Connect nodes
# ✓ Save flow
# ✓ Load flow
# ✓ Handle API errors
# ✓ Undo/Redo work
# ... (15 tests total)
# 15/15 passing
```

---

#### Step 2.4: Documentation & Handoff (3 hours)
**Objective:** Document new architecture for team

**Create docs/BUILDER_PHASE1.md:**
- Module structure diagram
- Data flow diagram
- How to add new node type
- How to add new API endpoint
- How to handle errors
- Common patterns & pitfalls
- Troubleshooting guide

**Deliverables:**
- [ ] Complete architecture documentation
- [ ] Code examples for common tasks
- [ ] Module dependencies diagram
- [ ] State flow diagram
- [ ] Review by supervisor

---

## Validation Checklist

### Code Quality
- [ ] No `grep -r "editor\." outside adapters/drawflow.js`
- [ ] No magic numbers in code (all in config.js)
- [ ] All new functions have JSDoc comments
- [ ] No console.log() statements (use logger.js)
- [ ] No try-catch blocks that silently fail (all have error handling)

### Tests
- [ ] Unit tests: 40+ passing (state, adapter, api, errors)
- [ ] Integration tests: 15+ passing (flows)
- [ ] Coverage: 85%+ for critical paths
- [ ] No flaky tests (run 3x, all pass)

### Performance
- [ ] No memory leaks (check with DevTools)
- [ ] Render time < 100ms for 50-node flow
- [ ] Save/load < 500ms
- [ ] No excessive re-renders (check React DevTools)

### UX
- [ ] All error messages user-friendly
- [ ] All toast notifications work
- [ ] Undo/Redo buttons enable/disable correctly
- [ ] Dirty indicator shows on unsaved changes

### Security
- [ ] No auth tokens logged to console
- [ ] All API calls include auth header
- [ ] No XSS vulnerabilities in dynamic HTML
- [ ] Input validation on all user inputs

---

## Success Criteria

✅ **Phase 1 Complete when:**
1. All 8 node types render identically to old code
2. State management is unified (no 15 parallel objects)
3. All errors are handled gracefully
4. 40+ unit tests passing
5. 15+ integration tests passing
6. 0 console errors
7. Code review approved by supervisor
8. Documentation complete

---

## Timeline

| Week | Days | Task | Hours | Status |
|------|------|------|-------|--------|
| 1 | Mon-Tue | Module Structure + Config | 9 | 🟡 |
| 1 | Wed-Thu | State Management | 8 | ⏳ |
| 1 | Fri | Drawflow Adapter | 6 | ⏳ |
| 1 | Sat | API Client | 4 | ⏳ |
| 2 | Mon-Tue | Error Handling | 6 | ⏳ |
| 2 | Wed-Thu | Migrate Features | 10 | ⏳ |
| 2 | Fri-Sat | Integration Tests | 8 | ⏳ |
| 2 | Sat | Documentation | 3 | ⏳ |
| **TOTAL** | **2 weeks** | **Refactoring** | **54h** | 🟡 |

---

## Supervisor Responsibilities

1. **Daily standup** - Review progress, unblock issues
2. **Code reviews** - Each module reviewed before integration
3. **Test validation** - Verify test quality and coverage
4. **Performance check** - Monitor memory/CPU during development
5. **Risk assessment** - Identify issues early
6. **Go/No-go decision** - Approve phase completion

