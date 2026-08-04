const assert = require('assert');
const { state } = require('./src/shared');
const bootstrap = require('./src/infrastructure/bootstrap');
const FlowRepository = require('./src/adapters/gateways/FlowRepository');
const CreateFlowUseCase = require('./src/use-cases/CreateFlowUseCase');
const UpdateFlowUseCase = require('./src/use-cases/UpdateFlowUseCase');
const DeleteFlowUseCase = require('./src/use-cases/DeleteFlowUseCase');
const TestFlowUseCase = require('./src/use-cases/TestFlowUseCase');
const ExportFlowUseCase = require('./src/use-cases/ExportFlowUseCase');

// Initialize state
state.flowsConfig = { flows: [] };

console.log('🧪 Flow Builder Test Suite\n');

// ============================================
// 1. FlowRepository Tests
// ============================================
console.log('📋 Testing FlowRepository');

const repo = new FlowRepository(null);

// Test 1.1: Create Flow
(async () => {
  try {
    const flow = await repo.create({
      name: 'Test Flow 1',
      keywords: ['test', 'prueba'],
      matchType: 'contains',
      steps: [
        { type: 'text', message: 'Hello!' },
        { type: 'text', message: 'Goodbye!' }
      ]
    });

    assert(flow.id, 'Flow should have ID');
    assert(flow.name === 'Test Flow 1', 'Flow name should match');
    assert(flow.enabled === true, 'Flow should be enabled by default');
    assert(flow.steps.length === 2, 'Flow should have 2 steps');
    console.log('  ✅ Test 1.1: Create flow');
  } catch (e) {
    console.error('  ❌ Test 1.1 FAILED:', e.message);
  }
})();

// Test 1.2: Read Flow
(async () => {
  try {
    const flows = state.flowsConfig.flows;
    if (flows.length === 0) {
      console.log('  ⏭️ Test 1.2: Skipped (no flows)');
      return;
    }

    const flowId = flows[0].id;
    const flow = await repo.read(flowId);

    assert(flow, 'Flow should exist');
    assert(flow.id === flowId, 'Flow ID should match');
    console.log('  ✅ Test 1.2: Read flow');
  } catch (e) {
    console.error('  ❌ Test 1.2 FAILED:', e.message);
  }
})();

// Test 1.3: List Flows
(async () => {
  try {
    const flows = await repo.list();

    assert(Array.isArray(flows), 'Should return array');
    assert(flows.length > 0, 'Should have at least one flow');
    console.log('  ✅ Test 1.3: List flows');
  } catch (e) {
    console.error('  ❌ Test 1.3 FAILED:', e.message);
  }
})();

// Test 1.4: Update Flow
(async () => {
  try {
    const flows = state.flowsConfig.flows;
    if (flows.length === 0) {
      console.log('  ⏭️ Test 1.4: Skipped (no flows)');
      return;
    }

    const flowId = flows[0].id;
    const updated = await repo.update(flowId, {
      name: 'Updated Flow'
    });

    assert(updated.name === 'Updated Flow', 'Flow name should be updated');
    console.log('  ✅ Test 1.4: Update flow');
  } catch (e) {
    console.error('  ❌ Test 1.4 FAILED:', e.message);
  }
})();

// Test 1.5: Search Flows
(async () => {
  try {
    const flows = await repo.search('test');

    assert(Array.isArray(flows), 'Should return array');
    console.log('  ✅ Test 1.5: Search flows');
  } catch (e) {
    console.error('  ❌ Test 1.5 FAILED:', e.message);
  }
})();

// ============================================
// 2. Use Cases Tests
// ============================================
console.log('\n📋 Testing Use Cases\n');

// Test 2.1: CreateFlowUseCase
(async () => {
  try {
    const useCase = new CreateFlowUseCase({ flowRepository: repo });

    const result = await useCase.execute({
      name: 'UseCase Test Flow',
      keywords: ['usecase'],
      matchType: 'exact',
      steps: [{ type: 'text', message: 'Test message' }]
    });

    assert(result.status === 'success', 'Should return success status');
    assert(result.flow, 'Should return created flow');
    assert(result.flow.name === 'UseCase Test Flow', 'Flow name should match');
    console.log('  ✅ Test 2.1: CreateFlowUseCase');
  } catch (e) {
    console.error('  ❌ Test 2.1 FAILED:', e.message);
  }
})();

// Test 2.2: UpdateFlowUseCase
(async () => {
  try {
    const flows = state.flowsConfig.flows;
    if (flows.length === 0) {
      console.log('  ⏭️ Test 2.2: Skipped (no flows)');
      return;
    }

    const flowId = flows[0].id;
    const useCase = new UpdateFlowUseCase({ flowRepository: repo });

    const result = await useCase.execute({
      flowId,
      name: 'Updated via UseCase',
      enabled: false
    });

    assert(result.status === 'success', 'Should return success status');
    assert(result.flow.name === 'Updated via UseCase', 'Flow name should be updated');
    assert(result.flow.enabled === false, 'Flow should be disabled');
    console.log('  ✅ Test 2.2: UpdateFlowUseCase');
  } catch (e) {
    console.error('  ❌ Test 2.2 FAILED:', e.message);
  }
})();

// Test 2.3: DeleteFlowUseCase
(async () => {
  try {
    const flows = state.flowsConfig.flows;
    const initialCount = flows.length;
    if (initialCount === 0) {
      console.log('  ⏭️ Test 2.3: Skipped (no flows)');
      return;
    }

    const flowId = flows[flows.length - 1].id;
    const useCase = new DeleteFlowUseCase({ flowRepository: repo });

    const result = await useCase.execute({ flowId });

    assert(result.status === 'success', 'Should return success status');
    assert(state.flowsConfig.flows.length === initialCount - 1, 'Flow should be deleted');
    console.log('  ✅ Test 2.3: DeleteFlowUseCase');
  } catch (e) {
    console.error('  ❌ Test 2.3 FAILED:', e.message);
  }
})();

// Test 2.4: TestFlowUseCase
(async () => {
  try {
    const flows = state.flowsConfig.flows;
    if (flows.length === 0) {
      console.log('  ⏭️ Test 2.4: Skipped (no flows)');
      return;
    }

    const flowId = flows[0].id;
    const useCase = new TestFlowUseCase({ flowRepository: repo });

    const result = await useCase.execute({
      flowId,
      senderId: '123456789',
      senderName: 'Test User'
    });

    assert(result.status === 'success', 'Should return success status');
    assert(result.flowId, 'Should return flow ID');
    assert(result.stepsCount > 0, 'Should show number of steps');
    console.log('  ✅ Test 2.4: TestFlowUseCase');
  } catch (e) {
    console.error('  ❌ Test 2.4 FAILED:', e.message);
  }
})();

// Test 2.5: ExportFlowUseCase
(async () => {
  try {
    const flows = state.flowsConfig.flows;
    if (flows.length === 0) {
      console.log('  ⏭️ Test 2.5: Skipped (no flows)');
      return;
    }

    const flowId = flows[0].id;
    const useCase = new ExportFlowUseCase({ flowRepository: repo });

    const result = await useCase.execute({
      flowId,
      format: 'json'
    });

    assert(result.status === 'success', 'Should return success status');
    assert(result.format === 'json', 'Should return JSON format');
    assert(result.data, 'Should return data');
    assert(result.filename, 'Should return filename');
    console.log('  ✅ Test 2.5: ExportFlowUseCase');
  } catch (e) {
    console.error('  ❌ Test 2.5 FAILED:', e.message);
  }
})();

// ============================================
// 3. DI Container Tests
// ============================================
console.log('\n📋 Testing DI Container\n');

// Test 3.1: Bootstrap with Flow Use Cases
(async () => {
  try {
    const di = bootstrap({
      state,
      flowsConfig: state.flowsConfig,
      supabaseClient: null,
      broadcastLog: () => {},
      recentReplies: new Set()
    });

    assert(di.createFlow, 'DI should have createFlow');
    assert(di.updateFlow, 'DI should have updateFlow');
    assert(di.deleteFlow, 'DI should have deleteFlow');
    assert(di.testFlow, 'DI should have testFlow');
    assert(di.exportFlow, 'DI should have exportFlow');
    assert(di.gateways.flowRepository, 'DI should have flowRepository gateway');

    console.log('  ✅ Test 3.1: DI Container includes Flow Use Cases');
  } catch (e) {
    console.error('  ❌ Test 3.1 FAILED:', e.message);
  }
})();

// ============================================
// Summary
// ============================================
setTimeout(() => {
  console.log('\n✅ Flow Builder Test Suite Complete');
  console.log(`📊 Total flows in state: ${state.flowsConfig.flows.length}`);
  console.log('\n💡 To test endpoints, start the server:');
  console.log('   npm start');
  console.log('\n📡 Available endpoints:');
  console.log('   POST   /api/flows-builder          - Create flow');
  console.log('   GET    /api/flows-builder          - List flows');
  console.log('   GET    /api/flows-builder/:id      - Get flow');
  console.log('   PUT    /api/flows-builder/:id      - Update flow');
  console.log('   DELETE /api/flows-builder/:id      - Delete flow');
  console.log('   POST   /api/flows-builder/:id/test - Test flow');
  console.log('   POST   /api/flows-builder/:id/export - Export flow');
  console.log('   GET    /api/flows-builder/search/:keyword - Search flows');
}, 100);
