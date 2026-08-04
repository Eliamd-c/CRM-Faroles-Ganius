# CRM 2.0 Builder - Complete API Reference

**Version:** 1.0  
**Date:** 2026-08-04  
**Status:** Production-Ready

---

## Table of Contents

1. [Node Registry API](#node-registry-api)
2. [State Management API](#state-management-api)
3. [Error Handler API](#error-handler-api)
4. [Logger API](#logger-api)
5. [API Client](#api-client)
6. [Node Configuration](#node-configuration)
7. [Error Codes](#error-codes)

---

## Node Registry API

### Overview

The Node Registry is a singleton that manages all node type registrations and provides methods to render nodes and get their configuration.

### Imports

```javascript
import { getNodeRegistry } from './public/builder-new/nodes/index.js';
const registry = getNodeRegistry();
```

### Methods

#### `getTypes(): string[]`

Returns array of all registered node types.

**Parameters:** None

**Returns:** `string[]` - Array of node type names

**Example:**
```javascript
const types = registry.getTypes();
// ['trigger', 'message', 'action', 'input', 'condition', ...]
```

---

#### `exists(type: string): boolean`

Checks if a node type is registered.

**Parameters:**
- `type` (string, required) - Node type identifier

**Returns:** `boolean` - True if node type exists

**Example:**
```javascript
if (registry.exists('message')) {
  // Node type is available
}
```

---

#### `get(type: string): NodeConfig | null`

Gets the configuration object for a node type.

**Parameters:**
- `type` (string, required) - Node type identifier

**Returns:** `NodeConfig | null` - Node configuration or null

**NodeConfig Structure:**
```javascript
{
  type: string,                 // 'trigger', 'message', etc.
  label: string,                // Display name
  icon: string,                 // Emoji icon
  inputs: number,               // Number of input connections
  outputs: number,              // Number of output connections
  html: string,                 // HTML template
  render: Function,             // Render preview function
  inspector: Function           // Inspector UI function
}
```

**Example:**
```javascript
const config = registry.get('message');
console.log(config.label);   // 'Enviar mensaje'
console.log(config.inputs);  // 1
console.log(config.outputs); // 1
```

---

#### `renderPreview(type: string, nodeId: string, nodeData: object): string`

Renders the visual preview HTML for a node.

**Parameters:**
- `type` (string, required) - Node type
- `nodeId` (string, required) - Unique node identifier
- `nodeData` (object, optional) - Node configuration data

**Returns:** `string` - HTML preview

**Example:**
```javascript
const preview = registry.renderPreview('trigger', 'node_1', {
  type: 'message',
  keyword: 'hello'
});
// Returns: '<div class="preview">🔔 Message trigger: hello</div>'
```

---

#### `getInspector(type: string, nodeId: string, nodeData: object): InspectorConfig`

Gets the inspector configuration panel for a node.

**Parameters:**
- `type` (string, required) - Node type
- `nodeId` (string, required) - Unique node identifier
- `nodeData` (object, optional) - Node configuration data

**Returns:** `InspectorConfig` - Inspector configuration

**InspectorConfig Structure:**
```javascript
{
  title: string,     // Panel title
  html: string       // HTML for configuration UI
}
```

**Example:**
```javascript
const inspector = registry.getInspector('message', 'node_1', {
  blocks: []
});
console.log(inspector.title); // 'Enviar mensaje'
```

---

#### `register(type: string, config: NodeConfig): void`

Registers a new node type (primarily for internal use).

**Parameters:**
- `type` (string, required) - Node type identifier
- `config` (NodeConfig, required) - Node configuration

**Example:**
```javascript
registry.register('mynodetype', {
  type: 'mynodetype',
  label: 'My Node',
  icon: '🎯',
  inputs: 1,
  outputs: 1,
  html: '<div>...</div>',
  render: (nodeId, data) => '<div>Preview</div>',
  inspector: (nodeId, data) => ({ title: 'Config', html: '...' })
});
```

---

## State Management API

### Overview

State management provides immutable state mutations with history tracking for undo/redo capability.

### Imports

```javascript
import {
  createInitialState,
  addNode,
  deleteNode,
  updateNode,
  addConnection,
  deleteConnection,
  setSelectedNode,
  markDirty,
  pushHistory,
  undo,
  redo,
  setValidationErrors,
  addNotification,
  getNode,
  getNodes,
  getConnections,
  getSelectedNode,
  isDirty,
  canUndo,
  canRedo,
  cloneState
} from './public/builder-new/state/index.js';
```

### Types

#### State

```javascript
{
  nodes: Map<string, NodeData>,
  connections: Connection[],
  selectedNode: string | null,
  history: StateSnapshot[],
  historyPointer: number,
  isDirty: boolean,
  validationErrors: ValidationError[],
  notifications: Notification[]
}
```

#### NodeData

```javascript
{
  id: string,
  type: string,
  data: object,
  inputs: number[],
  outputs: number[]
}
```

#### Connection

```javascript
{
  from: string,
  fromOutput: number,
  to: string,
  toInput: number
}
```

### Functions

#### `createInitialState(): State`

Creates a new initial state.

**Parameters:** None

**Returns:** `State` - New empty state

**Example:**
```javascript
const state = createInitialState();
```

---

#### `addNode(state: State, nodeId: string, type: string, data?: object): NodeData`

Adds a node to the state.

**Parameters:**
- `state` (State, required) - Current state
- `nodeId` (string, required) - Unique node ID
- `type` (string, required) - Node type (e.g., 'trigger', 'message')
- `data` (object, optional) - Node configuration data

**Returns:** `NodeData` - Created node

**Example:**
```javascript
const node = addNode(state, 'node_1', 'trigger', {
  type: 'message',
  keyword: 'hello'
});
```

---

#### `deleteNode(state: State, nodeId: string): void`

Deletes a node and all its connections.

**Parameters:**
- `state` (State, required) - Current state
- `nodeId` (string, required) - Node to delete

**Returns:** `void`

**Example:**
```javascript
deleteNode(state, 'node_1');
```

---

#### `updateNode(state: State, nodeId: string, data: object): NodeData | null`

Updates node configuration data.

**Parameters:**
- `state` (State, required) - Current state
- `nodeId` (string, required) - Node to update
- `data` (object, required) - New configuration data

**Returns:** `NodeData | null` - Updated node or null if not found

**Example:**
```javascript
updateNode(state, 'node_1', { type: 'comment', keyword: 'feedback' });
```

---

#### `addConnection(state: State, from: string, fromOutput: number, to: string, toInput: number): Connection`

Creates a connection between two nodes.

**Parameters:**
- `state` (State, required) - Current state
- `from` (string, required) - Source node ID
- `fromOutput` (number, required) - Output index (0-based)
- `to` (string, required) - Target node ID
- `toInput` (number, required) - Input index (0-based)

**Returns:** `Connection` - Created connection

**Example:**
```javascript
addConnection(state, 'node_1', 0, 'node_2', 0);
```

---

#### `deleteConnection(state: State, from: string, to: string): void`

Removes a connection between nodes.

**Parameters:**
- `state` (State, required) - Current state
- `from` (string, required) - Source node ID
- `to` (string, required) - Target node ID

**Returns:** `void`

**Example:**
```javascript
deleteConnection(state, 'node_1', 'node_2');
```

---

#### `setSelectedNode(state: State, nodeId: string | null): void`

Sets the currently selected node.

**Parameters:**
- `state` (State, required) - Current state
- `nodeId` (string | null, required) - Node to select or null

**Returns:** `void`

**Example:**
```javascript
setSelectedNode(state, 'node_1');
setSelectedNode(state, null); // Deselect
```

---

#### `markDirty(state: State): void`

Marks the state as having unsaved changes.

**Parameters:**
- `state` (State, required) - Current state

**Returns:** `void`

**Example:**
```javascript
markDirty(state);
```

---

#### `pushHistory(state: State): void`

Creates a snapshot in history for undo/redo.

**Parameters:**
- `state` (State, required) - Current state

**Returns:** `void`

**Example:**
```javascript
addNode(state, 'node_1', 'trigger');
pushHistory(state); // Enable undo
```

---

#### `undo(state: State): boolean`

Reverts to the previous state snapshot.

**Parameters:**
- `state` (State, required) - Current state

**Returns:** `boolean` - True if undo was successful

**Example:**
```javascript
if (canUndo(state)) {
  undo(state);
}
```

---

#### `redo(state: State): boolean`

Restores the next state snapshot.

**Parameters:**
- `state` (State, required) - Current state

**Returns:** `boolean` - True if redo was successful

**Example:**
```javascript
if (canRedo(state)) {
  redo(state);
}
```

---

#### `canUndo(state: State): boolean`

Checks if undo is available.

**Parameters:**
- `state` (State, required) - Current state

**Returns:** `boolean` - True if undo is available

---

#### `canRedo(state: State): boolean`

Checks if redo is available.

**Parameters:**
- `state` (State, required) - Current state

**Returns:** `boolean` - True if redo is available

---

#### `getNode(state: State, nodeId: string): NodeData | null`

Retrieves a node by ID.

**Parameters:**
- `state` (State, required) - Current state
- `nodeId` (string, required) - Node ID

**Returns:** `NodeData | null` - Node or null if not found

---

#### `getNodes(state: State): NodeData[]`

Gets all nodes in the state.

**Parameters:**
- `state` (State, required) - Current state

**Returns:** `NodeData[]` - Array of all nodes

---

#### `getConnections(state: State): Connection[]`

Gets all connections in the state.

**Parameters:**
- `state` (State, required) - Current state

**Returns:** `Connection[]` - Array of all connections

---

#### `getSelectedNode(state: State): string | null`

Gets the currently selected node ID.

**Parameters:**
- `state` (State, required) - Current state

**Returns:** `string | null` - Selected node ID or null

---

#### `setValidationErrors(state: State, errors: ValidationError[]): void`

Sets validation errors for the flow.

**Parameters:**
- `state` (State, required) - Current state
- `errors` (ValidationError[], required) - Array of validation errors

**Returns:** `void`

---

#### `addNotification(state: State, type: string, message: string): void`

Adds a notification.

**Parameters:**
- `state` (State, required) - Current state
- `type` (string, required) - 'success', 'error', 'warning', 'info'
- `message` (string, required) - Notification message

**Returns:** `void`

---

## Error Handler API

### Overview

Centralizes error handling, categorization, recovery strategies, and logging.

### Imports

```javascript
import ErrorHandler from './public/builder-new/services/error-handler.js';
```

### Methods

#### `handle(error: Error, context?: object): string`

Handles an error, categorizes it, and logs it.

**Parameters:**
- `error` (Error, required) - Error object
- `context` (object, optional) - Additional context

**Returns:** `string` - Error category

**Error Categories:**
- `validation` - Data validation failure
- `network` - Network connectivity issue
- `server` - Server error (5xx)
- `client` - Client error (4xx)
- `api` - API-specific error
- `auth` - Authentication/authorization
- `flow` - Flow execution error
- `unknown` - Unknown error type

**Example:**
```javascript
try {
  await saveFlow(flow);
} catch (error) {
  const category = errorHandler.handle(error, {
    nodeId: 'node_1',
    action: 'save'
  });
}
```

---

#### `getError(category: string): ErrorInfo`

Gets error information for a category.

**Parameters:**
- `category` (string, required) - Error category

**Returns:** `ErrorInfo` - Error information

**ErrorInfo Structure:**
```javascript
{
  title: string,              // User-friendly title
  message: string,            // Error message
  action: string,             // Suggested action
  recoveryStrategy: string    // Recovery strategy
}
```

---

#### `getErrorStats(): ErrorStats`

Gets error statistics.

**Parameters:** None

**Returns:** `ErrorStats` - Error statistics

**ErrorStats Structure:**
```javascript
{
  total: number,              // Total errors
  byType: { [type]: number }, // Errors by category
  recoveries: number,         // Successful recoveries
  frequency: { [type]: number } // Error frequency
}
```

---

#### `clearErrors(): void`

Clears error history.

**Parameters:** None

**Returns:** `void`

---

## Logger API

### Overview

Logs messages and errors with queuing for backend transmission.

### Imports

```javascript
import { Logger } from './public/builder-new/utils/logger.js';
const logger = new Logger('builder');
```

### Methods

#### `debug(message: string): void`

Logs a debug message.

**Parameters:**
- `message` (string, required) - Debug message

**Returns:** `void`

---

#### `info(message: string): void`

Logs an info message.

**Parameters:**
- `message` (string, required) - Info message

**Returns:** `void`

---

#### `warn(message: string): void`

Logs a warning message.

**Parameters:**
- `message` (string, required) - Warning message

**Returns:** `void`

---

#### `error(message: string, error?: Error): void`

Logs an error message.

**Parameters:**
- `message` (string, required) - Error message
- `error` (Error, optional) - Error object

**Returns:** `void`

---

#### `sendErrorLog(errors: Error[]): Promise<void>`

Sends queued logs to the backend.

**Parameters:**
- `errors` (Error[], required) - Errors to send

**Returns:** `Promise<void>`

**Example:**
```javascript
try {
  // Operation
} catch (error) {
  logger.error('Operation failed', error);
  await logger.sendErrorLog([error]);
}
```

---

#### `getQueuedLogs(): object[]`

Gets queued log entries.

**Parameters:** None

**Returns:** `object[]` - Queued log entries

---

#### `clearQueue(): void`

Clears the log queue.

**Parameters:** None

**Returns:** `void`

---

## API Client

### Overview

Handles communication with the backend API.

### Imports

```javascript
import ApiClient from './public/builder-new/adapters/api.js';
const client = new ApiClient(logger, httpClient);
```

### Methods

#### `saveFlow(flowId: string, flowData: object): Promise<object>`

Saves a flow to the backend.

**Parameters:**
- `flowId` (string, required) - Flow identifier
- `flowData` (object, required) - Flow data

**Returns:** `Promise<object>` - Save response

**Example:**
```javascript
const result = await client.saveFlow('flow_1', {
  nodes: [...],
  connections: [...]
});
```

---

#### `loadFlow(flowId: string): Promise<object>`

Loads a flow from the backend.

**Parameters:**
- `flowId` (string, required) - Flow identifier

**Returns:** `Promise<object>` - Flow data

---

#### `publishFlow(flowId: string): Promise<void>`

Publishes a flow.

**Parameters:**
- `flowId` (string, required) - Flow identifier

**Returns:** `Promise<void>`

---

#### `deleteFlow(flowId: string): Promise<void>`

Deletes a flow.

**Parameters:**
- `flowId` (string, required) - Flow identifier

**Returns:** `Promise<void>`

---

#### `listFlows(): Promise<object[]>`

Lists all flows.

**Parameters:** None

**Returns:** `Promise<object[]>` - Array of flows

---

#### `validateFlow(flowData: object): Promise<object>`

Validates flow structure and content.

**Parameters:**
- `flowData` (object, required) - Flow data

**Returns:** `Promise<object>` - Validation result

---

#### `generateFlowFromAI(prompt: string): Promise<object>`

Generates a flow from an AI prompt.

**Parameters:**
- `prompt` (string, required) - Prompt/description

**Returns:** `Promise<object>` - Generated flow

---

## Node Configuration

### Node Config Structure

Every node exports a configuration object:

```javascript
export const NodeConfig = {
  type: 'nodetype',           // Unique identifier
  label: 'Display Name',      // User-visible label
  icon: '🎯',                 // Emoji icon
  inputs: 1,                  // Number of input connections
  outputs: 1,                 // Number of output connections
  html: '<div>...</div>',     // HTML template
  render: renderFunction,     // Preview render function
  inspector: inspectorFunction // Inspector UI function
};
```

### Available Node Types

| Type | Inputs | Outputs | Purpose |
|------|--------|---------|---------|
| trigger | 0 | 1 | Flow entry point |
| message | 1 | 1 | Send message blocks |
| action | 1 | 1 | Execute contact/automation actions |
| input | 1 | 2 | Collect user input |
| condition | 1 | 2 | Branch based on condition |
| randomizer | 1 | 2-10 | A/B testing |
| carousel | 1 | 1 | Card collections |
| gallery | 1 | 1 | Image collections |
| audio | 1 | 1 | Audio playback |
| video | 1 | 1 | Video playback |
| file | 1 | 1 | File download |
| delay | 1 | 1 | Pause execution |
| goto | 1 | 0 | Redirect flow |
| ai_agent | 1 | 1 | AI responses |

---

## Error Codes

### HTTP Status Mapping

| Status | Error Code | Retryable | Category |
|--------|-----------|-----------|----------|
| 400 | VALIDATION_ERROR | No | validation |
| 401 | AUTH_ERROR | No | auth |
| 403 | PERMISSION_ERROR | No | auth |
| 404 | NOT_FOUND | No | client |
| 408 | REQUEST_TIMEOUT | Yes | network |
| 429 | RATE_LIMITED | Yes | server |
| 500 | SERVER_ERROR | Yes | server |
| 502 | BAD_GATEWAY | Yes | server |
| 503 | SERVICE_UNAVAILABLE | Yes | server |
| 504 | GATEWAY_TIMEOUT | Yes | server |

### Retry Strategy

```
Max Retries: 3
Initial Delay: 1000ms
Backoff Formula: 2^attempt * 1000ms

Retry 1: 2000ms
Retry 2: 4000ms
Retry 3: 8000ms
```

### Error Recovery

| Error Type | Recovery Strategy | User Action |
|-----------|------------------|------------|
| Network | Automatic retry with backoff | Wait or retry |
| Validation | User correction | Fix and retry |
| Auth | Reauthenticate | Login again |
| Rate limit | Exponential backoff | Wait |
| Server | Retry | Automatic retry |
| Unknown | Manual intervention | Contact support |

---

**API Version:** 1.0  
**Last Updated:** 2026-08-04  
**Status:** Production-Ready
