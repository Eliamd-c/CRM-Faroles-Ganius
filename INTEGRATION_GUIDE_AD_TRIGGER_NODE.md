# Integration Guide: Ad Trigger Node

This guide explains how to integrate the newly implemented Ad Trigger Node into your existing application.

## Table of Contents
1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Step-by-Step Integration](#step-by-step-integration)
4. [Testing](#testing)
5. [Database Migration](#database-migration)
6. [Deployment](#deployment)

## Overview

The Ad Trigger Node system consists of:
- **BaseNode**: Abstract base class for all nodes (Template Method pattern)
- **ExecutionStrategy**: Interface for different execution strategies (Strategy pattern)
- **NodeFactory**: Factory for creating nodes without exposing implementation (Factory pattern)
- **AdTriggerNode**: Concrete implementation for ad triggers
- **NodeExecutorService**: Orchestrator for executing flows
- **UpdatedCreateFlowUseCase**: Enhanced use case with ad_trigger support

## File Structure

```
src/
├── nodes/                                    (NEW)
│   ├── base/
│   │   └── BaseNode.js
│   ├── strategies/
│   │   ├── ExecutionStrategy.js
│   │   └── AdTriggerExecutionStrategy.js
│   ├── factories/
│   │   ├── NodeFactory.js
│   │   └── NodeRegistry.js
│   ├── implementations/
│   │   ├── TextNode.js
│   │   ├── ButtonsNode.js
│   │   └── AdTriggerNode.js
│   ├── index.js
│   └── README.md
├── services/
│   ├── flow.service.js                      (EXISTING)
│   ├── meta.service.js                      (EXISTING)
│   └── node-executor.service.js             (NEW)
└── use-cases/
    └── CreateFlowUseCase.js                 (UPDATED)

test/
├── nodes/
│   └── AdTriggerNode.test.js
├── factories/
│   └── NodeFactory.test.js
├── use-cases/
│   └── CreateFlowUseCase.test.js
└── mocks/
    └── MockAdTriggerStrategy.js
```

## Step-by-Step Integration

### 1. Initialize Node Registry in app.js

Add this to your `app.js` file after connecting to Meta service and Supabase:

```javascript
// At the top of app.js
const { initializeNodeRegistry } = require('./src/nodes/factories/NodeRegistry');
const NodeFactory = require('./src/nodes/factories/NodeFactory');
const NodeExecutorService = require('./src/services/node-executor.service.js');
const AdTriggerExecutionStrategy = require('./src/nodes/strategies/AdTriggerExecutionStrategy');

// ... existing imports ...

// After initializing meta service, supabase, and other services
// Around the initialization section:

// Create execution strategies
const adTriggerStrategy = new AdTriggerExecutionStrategy(meta, welcomeFlows);

// Prepare node dependencies
const nodeDependencies = {
  metaService: meta,
  welcomeFlowsService: welcomeFlows,
  supabase,
  broadcastLog: (type, message) => {
    // Your logging implementation
    if (global.clients) {
      global.clients.forEach(client => {
        client.send(JSON.stringify({ type, message }));
      });
    }
  },
  accessToken: state.ACCESS_TOKEN,
  userId: state.USER_ID || 'admin'
};

// Initialize registry with all available strategies
const registryDependencies = {
  ...nodeDependencies,
  executionStrategy: adTriggerStrategy
};

initializeNodeRegistry(registryDependencies);

// Create the node executor service
const nodeExecutor = new NodeExecutorService(NodeFactory, console);

// Store in global state for use in handlers
state.nodeFactory = NodeFactory;
state.nodeExecutor = nodeExecutor;
```

### 2. Update Route Handler for Flow Creation

In your route handler for creating flows (typically in `handlers/` or `routes/`):

```javascript
// Example: POST /api/flows
const CreateFlowUseCase = require('../src/use-cases/CreateFlowUseCase');

app.post('/api/flows', async (req, res) => {
  try {
    const { name, keywords, matchType, steps } = req.body;

    const flowRepository = {
      create: async (flowData) => {
        // Save to Supabase
        const { data, error } = await supabase
          .from('app_flows')
          .insert([{
            name: flowData.name,
            keywords: flowData.keywords,
            match_type: flowData.matchType,
            steps: flowData.steps,
            is_ad_flow: flowData.isAdFlow,
            created_at: new Date().toISOString()
          }])
          .select();

        if (error) throw error;
        return data[0];
      }
    };

    const useCase = new CreateFlowUseCase({ flowRepository });
    const result = await useCase.execute({
      name,
      keywords,
      matchType,
      steps
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### 3. Using NodeExecutor in Webhook Handlers

When a user triggers a flow step (e.g., via webhook):

```javascript
// Example: Handling a user message that triggers a flow
async function handleUserFlow(userId, flowId, message) {
  try {
    // Fetch flow from database
    const { data: flow } = await supabase
      .from('app_flows')
      .select('*')
      .eq('id', flowId)
      .single();

    if (!flow) throw new Error('Flow not found');

    // Prepare execution context
    const context = {
      userId,
      flowId,
      message,
      accessToken: state.ACCESS_TOKEN,
      supabase,
      strategies: {
        ad_trigger: new AdTriggerExecutionStrategy(meta, welcomeFlows),
        text: new TextExecutionStrategy(),
        buttons: new ButtonsExecutionStrategy()
        // Add more strategies as needed
      },
      broadcastLog: (type, msg) => {
        // Send to WebSocket clients
        broadcastToClients(userId, { type, message: msg });
      }
    };

    // Execute the flow
    const executionLog = await state.nodeExecutor.executeFlow(
      flow.steps,
      context
    );

    return executionLog;
  } catch (error) {
    console.error('Flow execution error:', error);
    throw error;
  }
}
```

### 4. Update Your Meta Service Integration

Ensure your `meta.service.js` or similar has the necessary method for Welcome Flows:

```javascript
// In meta.service.js
class MetaService {
  async createWelcomeMessageFlow(payload, accessToken) {
    const response = await axios.post(
      `https://graph.instagram.com/v26.0/me/welcome_message_flows`,
      payload,
      { params: { access_token: accessToken } }
    );
    return response.data;
  }

  // ... other methods ...
}
```

### 5. Database Setup

Create the `welcome_ad_flows` table if it doesn't exist:

```sql
CREATE TABLE IF NOT EXISTS welcome_ad_flows (
  id BIGSERIAL PRIMARY KEY,
  flow_id UUID NOT NULL UNIQUE,
  meta_flow_id TEXT NOT NULL UNIQUE,
  flow_name TEXT NOT NULL,
  message TEXT NOT NULL,
  quick_replies JSONB NOT NULL,
  linked_flow_id UUID NOT NULL REFERENCES app_flows(id),
  
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  status TEXT DEFAULT 'active',
  is_used_in_ad BOOLEAN DEFAULT FALSE,
  
  total_clicks BIGINT DEFAULT 0,
  last_clicked_at TIMESTAMP,
  
  CONSTRAINT message_length CHECK (length(message) <= 2000),
  CONSTRAINT min_buttons CHECK (jsonb_array_length(quick_replies) >= 1),
  CONSTRAINT max_buttons CHECK (jsonb_array_length(quick_replies) <= 13)
);

CREATE INDEX idx_welcome_ad_flows_flow_id ON welcome_ad_flows(flow_id);
CREATE INDEX idx_welcome_ad_flows_linked_flow_id ON welcome_ad_flows(linked_flow_id);

-- Add is_ad_flow column to app_flows if it doesn't exist
ALTER TABLE app_flows ADD COLUMN IF NOT EXISTS is_ad_flow BOOLEAN DEFAULT FALSE;
CREATE INDEX idx_app_flows_is_ad_flow ON app_flows(is_ad_flow) WHERE is_ad_flow = TRUE;
```

### 6. Update Flow Service (Optional)

Update `src/services/flow.service.js` to use NodeExecutor for new flows:

```javascript
// In flow.service.js
class FlowService {
  constructor(nodeExecutor, nodeFactory) {
    this.nodeExecutor = nodeExecutor;
    this.nodeFactory = nodeFactory;
  }

  async executeFlow(flow, context) {
    // Use new node-based execution
    return await this.nodeExecutor.executeFlow(flow.steps, context);
  }

  // Keep existing processFlowSteps() as fallback for backward compatibility
  async processFlowSteps(steps, context) {
    // Existing implementation for backward compatibility
  }
}
```

## Testing

### Run Unit Tests

```bash
# Test Ad Trigger Node
npm test -- test/nodes/AdTriggerNode.test.js

# Test Node Factory
npm test -- test/factories/NodeFactory.test.js

# Test Create Flow Use Case
npm test -- test/use-cases/CreateFlowUseCase.test.js

# Run all tests
npm test
```

### Manual Testing

1. **Create an Ad Flow via API:**
```bash
curl -X POST http://localhost:3000/api/flows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Ad Campaign",
    "keywords": ["ad", "campaign"],
    "steps": [{
      "type": "ad_trigger",
      "message": "Welcome to our campaign!",
      "quick_replies": [
        { "title": "Learn More", "payload": "LEARN" },
        { "title": "Shop Now", "payload": "SHOP" }
      ],
      "flowName": "Test Flow",
      "linkedFlowId": "flow_123"
    }]
  }'
```

2. **Verify in database:**
```sql
SELECT * FROM welcome_ad_flows ORDER BY created_at DESC LIMIT 1;
SELECT * FROM app_flows WHERE is_ad_flow = TRUE ORDER BY created_at DESC;
```

## Deployment

### Pre-Deployment Checklist

- [ ] All unit tests passing
- [ ] No console errors or warnings
- [ ] CreateFlowUseCase properly updated
- [ ] NodeRegistry initialized in app.js
- [ ] Database migrations applied
- [ ] Meta API credentials configured
- [ ] Supabase connection verified
- [ ] Backward compatibility tested with existing flows

### Deployment Steps

1. **Backup database:**
```bash
pg_dump -U postgres crm_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Run migrations:**
```bash
# Apply the SQL script for welcome_ad_flows table
psql -U postgres -d crm_db -f migrations/create_welcome_ad_flows.sql
```

3. **Deploy code:**
```bash
git push origin main
# or your deployment process (PM2, Docker, etc.)
```

4. **Restart application:**
```bash
pm2 restart app
# or your restart process
```

5. **Verify deployment:**
```bash
# Check logs for "Node Registry inicializado"
tail -f logs/app.log | grep "Node Registry"

# Test API endpoint
curl http://localhost:3000/api/flows \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","steps":[{"type":"ad_trigger","message":"Test","quick_replies":[{"title":"Ok","payload":"OK"}]}]}'
```

### Rollback Plan

If issues occur:

1. **Revert database:**
```bash
psql -U postgres -d crm_db -f backup_YYYYMMDD_HHMMSS.sql
```

2. **Revert code:**
```bash
git revert <commit-hash>
git push origin main
pm2 restart app
```

3. **Verify:**
```bash
# Check that old flows still work
# Test non-ad flows creation
```

## Monitoring

### Key Metrics to Monitor

1. **Flow Creation:**
   - Count of ad flows created
   - Count of regular flows created
   - Validation error rate

2. **Node Execution:**
   - Execution success rate
   - Average execution time per step
   - Failed step count

3. **Meta API:**
   - Welcome Flow creation success rate
   - API response times
   - Error rates by type

### Logging

Add logging to track operations:

```javascript
// In node-executor.service.js or your logging middleware
console.log({
  timestamp: new Date().toISOString(),
  flowId: context.flowId,
  stepType: step.type,
  stepId: step.id,
  status: 'executing',
  message: `Starting execution of ${step.type} step`
});
```

## Troubleshooting

### Issue: "Tipo de nodo no registrado"

**Cause:** NodeRegistry not initialized  
**Solution:** Ensure `initializeNodeRegistry()` is called in app.js before using flows

### Issue: "No se permiten variables en el mensaje"

**Cause:** Message contains `{{}}` or `{username}` pattern  
**Solution:** Remove variables from message - Meta doesn't support them in welcome flows

### Issue: "Máximo 13 botones permitidos"

**Cause:** More than 13 quick replies in step  
**Solution:** Reduce quick_replies array to 13 or fewer items

### Issue: "Ad Trigger debe ser el primer paso del flujo"

**Cause:** ad_trigger step is not at index 0  
**Solution:** Move ad_trigger to be the first step in the steps array

## Support

For questions or issues:
1. Check the IMPLEMENTATION_PLAN_AD_TRIGGER_NODE.md
2. Review test cases in test/nodes/AdTriggerNode.test.js
3. Check src/nodes/README.md for architecture details
4. Review integration examples in this guide
