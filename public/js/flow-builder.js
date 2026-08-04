/**
 * Flow Builder Application
 * Complete drag-and-drop flow editor with Drawflow
 */

let editor = null;
let nodeCounter = 0;
let selectedNode = null;
let currentFlowId = null;
const API_SECRET = localStorage.getItem('apiSecret') || '';

// ============================================
// 1. INITIALIZATION
// ============================================
window.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Flow Builder initializing...');
  initializeEditor();
  setupDragDrop();
  setupEventHandlers();
  loadFlowsFromAPI();
  console.log('✅ Flow Builder ready');
});

function initializeEditor() {
  const container = document.getElementById('drawflow');
  editor = new Drawflow(container);
  editor.reroute = true;
  editor.curvature = 0.5;
  editor.start();

  // Wire up node selection
  editor.on('nodeSelected', onNodeSelected);
  editor.on('nodeRemoved', onNodeRemoved);
}

// ============================================
// 2. DRAG AND DROP
// ============================================
function setupDragDrop() {
  const nodeButtons = document.querySelectorAll('.node-button');

  nodeButtons.forEach(btn => {
    btn.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('nodeType', btn.dataset.node);
    });
  });

  const canvas = document.getElementById('drawflow');

  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  canvas.addEventListener('drop', (e) => {
    e.preventDefault();

    const nodeType = e.dataTransfer.getData('nodeType');
    if (!nodeType) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / editor.zoom;
    const y = (e.clientY - rect.top) / editor.zoom;

    addNode(nodeType, x, y);
  });
}

// ============================================
// 3. NODE MANAGEMENT
// ============================================
function addNode(type, x, y) {
  const nodeId = nodeCounter++;
  const nodeKey = `${type}_${nodeId}`;
  const nodeData = getNodeTemplate(type);
  const nodeHTML = generateNodeHTML(type, nodeData);

  editor.addNode(nodeKey, 1, 1, x, y, type, nodeData, nodeHTML);
  showStatus(`✅ ${type} node added`, 'success');
}

function generateNodeHTML(type, data) {
  const icons = {
    trigger: 'play-circle',
    text: 'comment',
    buttons: 'square',
    card: 'rectangle-landscape',
    carousel: 'images',
    condition: 'code-branch',
    input: 'keyboard',
    delay: 'hourglass',
    ai_agent: 'robot',
    action: 'bolt',
    goto: 'arrow-right'
  };

  const icon = icons[type] || 'cube';
  let content = '';

  switch (type) {
    case 'text':
      content = `<div class="node-content">"${data.message.substring(0, 30)}..."</div>`;
      break;
    case 'buttons':
      content = `<div class="node-content">${data.buttons.length} buttons</div>`;
      break;
    case 'card':
      content = `<div class="node-content">${data.title}</div>`;
      break;
    case 'condition':
      content = `<div class="node-content">${data.field} ${data.operator}</div>`;
      break;
    case 'input':
      content = `<div class="node-content">Input: ${data.inputType}</div>`;
      break;
    case 'delay':
      content = `<div class="node-content">${data.seconds}s delay</div>`;
      break;
    case 'ai_agent':
      content = `<div class="node-content">AI Agent</div>`;
      break;
    default:
      content = `<div class="node-content">${type}</div>`;
  }

  return `
    <div class="drawflow-node ${type}">
      <div class="node-header">
        <i class="fas fa-${icon}"></i>
        <span>${type}</span>
      </div>
      ${content}
      <div class="node-label">Click to edit</div>
    </div>
  `;
}

function getNodeTemplate(type) {
  const templates = {
    trigger: {
      type: 'trigger',
      message: 'Flow start'
    },
    text: {
      type: 'text',
      message: 'Hello! 👋'
    },
    buttons: {
      type: 'buttons',
      message: 'Choose one:',
      buttons: [
        { type: 'postback', title: 'Option 1', payload: 'OPT1' },
        { type: 'postback', title: 'Option 2', payload: 'OPT2' }
      ]
    },
    card: {
      type: 'card',
      title: 'Card Title',
      subtitle: 'Card subtitle',
      image_url: 'https://via.placeholder.com/300x200',
      message: 'Check this out!'
    },
    carousel: {
      type: 'carousel',
      elements: [
        {
          title: 'Item 1',
          subtitle: 'Description',
          image_url: 'https://via.placeholder.com/300x200',
          buttons: []
        }
      ]
    },
    condition: {
      type: 'condition',
      field: 'status',
      operator: '==',
      value: 'active',
      truePayload: null,
      falsePayload: null
    },
    input: {
      type: 'input',
      prompt: 'Enter your response:',
      inputType: 'text',
      field: 'response',
      successPayload: null,
      failPayload: null
    },
    delay: {
      type: 'delay',
      seconds: 2
    },
    ai_agent: {
      type: 'ai_agent',
      system_prompt: 'You are a helpful assistant',
      ignore_master_context: false
    },
    action: {
      type: 'action',
      actionType: 'add_tag',
      params: { tag: 'new_tag' }
    },
    goto: {
      type: 'goto',
      flow_id: ''
    }
  };

  return templates[type] || { type };
}

function onNodeSelected(nodeId) {
  selectedNode = nodeId;
  const nodeData = editor.getNodeFromId(nodeId);
  updatePropertiesPanel(nodeData);
}

function onNodeRemoved(nodeId) {
  if (selectedNode === nodeId) {
    selectedNode = null;
    clearPropertiesPanel();
  }
}

// ============================================
// 4. PROPERTIES PANEL
// ============================================
function updatePropertiesPanel(nodeData) {
  const panel = document.getElementById('propertiesContent');

  if (!nodeData || !nodeData.data) {
    clearPropertiesPanel();
    return;
  }

  const data = nodeData.data;
  let html = `
    <div class="property-group">
      <label>Node Type</label>
      <input type="text" readonly value="${data.type}">
    </div>
  `;

  // Type-specific properties
  switch (data.type) {
    case 'text':
      html += `
        <div class="property-group">
          <label>Message</label>
          <textarea id="prop_message">${data.message}</textarea>
        </div>
      `;
      break;

    case 'buttons':
      html += `
        <div class="property-group">
          <label>Message</label>
          <textarea id="prop_message">${data.message}</textarea>
        </div>
        <div class="property-group">
          <label>Number of Buttons</label>
          <input type="number" id="prop_buttons_count" min="1" max="3" value="${data.buttons.length}">
        </div>
      `;
      break;

    case 'card':
      html += `
        <div class="property-group">
          <label>Title</label>
          <input type="text" id="prop_title" value="${data.title}">
        </div>
        <div class="property-group">
          <label>Subtitle</label>
          <input type="text" id="prop_subtitle" value="${data.subtitle}">
        </div>
        <div class="property-group">
          <label>Image URL</label>
          <input type="url" id="prop_image" value="${data.image_url}">
        </div>
      `;
      break;

    case 'condition':
      html += `
        <div class="property-group">
          <label>Field</label>
          <input type="text" id="prop_field" value="${data.field}">
        </div>
        <div class="property-group">
          <label>Operator</label>
          <select id="prop_operator">
            <option value="==" ${data.operator === '==' ? 'selected' : ''}>Equals (==)</option>
            <option value="!=" ${data.operator === '!=' ? 'selected' : ''}>Not Equals (!=)</option>
            <option value=">" ${data.operator === '>' ? 'selected' : ''}>Greater Than (>)</option>
            <option value="<" ${data.operator === '<' ? 'selected' : ''}>Less Than (<)</option>
            <option value="contains" ${data.operator === 'contains' ? 'selected' : ''}>Contains</option>
          </select>
        </div>
        <div class="property-group">
          <label>Value</label>
          <input type="text" id="prop_value" value="${data.value}">
        </div>
      `;
      break;

    case 'input':
      html += `
        <div class="property-group">
          <label>Prompt</label>
          <textarea id="prop_prompt">${data.prompt}</textarea>
        </div>
        <div class="property-group">
          <label>Input Type</label>
          <select id="prop_inputType">
            <option value="text" ${data.inputType === 'text' ? 'selected' : ''}>Text</option>
            <option value="email" ${data.inputType === 'email' ? 'selected' : ''}>Email</option>
            <option value="phone" ${data.inputType === 'phone' ? 'selected' : ''}>Phone</option>
            <option value="number" ${data.inputType === 'number' ? 'selected' : ''}>Number</option>
            <option value="date" ${data.inputType === 'date' ? 'selected' : ''}>Date</option>
          </select>
        </div>
      `;
      break;

    case 'delay':
      html += `
        <div class="property-group">
          <label>Delay (seconds)</label>
          <input type="number" id="prop_seconds" min="1" max="60" value="${data.seconds}">
        </div>
      `;
      break;

    case 'ai_agent':
      html += `
        <div class="property-group">
          <label>System Prompt</label>
          <textarea id="prop_system_prompt">${data.system_prompt}</textarea>
        </div>
        <div class="property-group">
          <label>
            <input type="checkbox" id="prop_ignore_context" ${data.ignore_master_context ? 'checked' : ''}>
            Ignore Master Context
          </label>
        </div>
      `;
      break;

    case 'action':
      html += `
        <div class="property-group">
          <label>Action Type</label>
          <select id="prop_actionType">
            <option value="add_tag" ${data.actionType === 'add_tag' ? 'selected' : ''}>Add Tag</option>
            <option value="remove_tag" ${data.actionType === 'remove_tag' ? 'selected' : ''}>Remove Tag</option>
            <option value="set_field" ${data.actionType === 'set_field' ? 'selected' : ''}>Set Field</option>
            <option value="pause_bot" ${data.actionType === 'pause_bot' ? 'selected' : ''}>Pause Bot</option>
            <option value="resume_bot" ${data.actionType === 'resume_bot' ? 'selected' : ''}>Resume Bot</option>
          </select>
        </div>
        <div class="property-group">
          <label>Parameter</label>
          <input type="text" id="prop_param" value="${JSON.stringify(data.params)}">
        </div>
      `;
      break;
  }

  html += `
    <div class="property-group">
      <button class="btn btn-primary" onclick="saveNodeProperties()">
        <i class="fas fa-save"></i> Save Properties
      </button>
      <button class="btn btn-danger" onclick="deleteSelectedNode()">
        <i class="fas fa-trash"></i> Delete Node
      </button>
    </div>
  `;

  panel.innerHTML = html;
}

function clearPropertiesPanel() {
  const panel = document.getElementById('propertiesContent');
  panel.innerHTML = '<div class="property-group"><p style="color: #999; font-size: 13px;">Select a node to edit properties</p></div>';
}

function saveNodeProperties() {
  if (!selectedNode) return;

  const nodeData = editor.getNodeFromId(selectedNode);
  if (!nodeData) return;

  // Update based on type
  const type = nodeData.data.type;

  switch (type) {
    case 'text':
      nodeData.data.message = document.getElementById('prop_message')?.value || '';
      break;
    case 'card':
      nodeData.data.title = document.getElementById('prop_title')?.value || '';
      nodeData.data.subtitle = document.getElementById('prop_subtitle')?.value || '';
      nodeData.data.image_url = document.getElementById('prop_image')?.value || '';
      break;
    case 'condition':
      nodeData.data.field = document.getElementById('prop_field')?.value || '';
      nodeData.data.operator = document.getElementById('prop_operator')?.value || '==';
      nodeData.data.value = document.getElementById('prop_value')?.value || '';
      break;
    case 'input':
      nodeData.data.prompt = document.getElementById('prop_prompt')?.value || '';
      nodeData.data.inputType = document.getElementById('prop_inputType')?.value || 'text';
      break;
    case 'delay':
      nodeData.data.seconds = parseInt(document.getElementById('prop_seconds')?.value || '2');
      break;
    case 'ai_agent':
      nodeData.data.system_prompt = document.getElementById('prop_system_prompt')?.value || '';
      nodeData.data.ignore_master_context = document.getElementById('prop_ignore_context')?.checked || false;
      break;
  }

  showStatus('✅ Properties saved', 'success');
}

function deleteSelectedNode() {
  if (!selectedNode) return;
  if (confirm('Delete this node?')) {
    editor.removeNodeId(selectedNode);
    selectedNode = null;
    clearPropertiesPanel();
  }
}

// ============================================
// 5. FLOW OPERATIONS
// ============================================
function setupEventHandlers() {
  document.getElementById('btnSave').addEventListener('click', saveFlow);
  document.getElementById('btnClear').addEventListener('click', clearCanvas);
  document.getElementById('btnTest').addEventListener('click', openTestModal);
  document.getElementById('btnLoad').addEventListener('click', openLoadModal);
  document.getElementById('btnExport').addEventListener('click', exportFlow);

  document.getElementById('flowName').addEventListener('change', (e) => {
    // Only update if it's not programmatic
    if (e.target.value && !currentFlowId) {
      currentFlowId = null;
    }
  });
}

function buildFlowData() {
  const flowName = document.getElementById('flowName').value.trim();

  if (!flowName) {
    showStatus('❌ Please enter a flow name', 'error');
    return null;
  }

  if (!editor.nodes || Object.keys(editor.nodes).length === 0) {
    showStatus('❌ Add at least one node to the flow', 'error');
    return null;
  }

  // Convert Drawflow nodes to Flow steps
  const steps = convertNodesToSteps(editor.nodes);

  return {
    name: flowName,
    keywords: flowName.toLowerCase().split(' '),
    matchType: 'contains',
    steps: steps
  };
}

function convertNodesToSteps(nodes) {
  const steps = [];
  const nodesList = Object.values(nodes);

  // Sort by position (top to bottom, left to right)
  nodesList.sort((a, b) => {
    if (a.pos_y !== b.pos_y) return a.pos_y - b.pos_y;
    return a.pos_x - b.pos_x;
  });

  // Convert each node to a step
  nodesList.forEach(node => {
    if (!node.data) return;

    const step = { ...node.data };

    // Ensure required fields
    if (!step.type) {
      console.warn('Node missing type:', node);
      return;
    }

    steps.push(step);
  });

  return steps;
}

async function saveFlow() {
  const flowData = buildFlowData();
  if (!flowData) return;

  try {
    showStatus('💾 Saving flow...', 'success');

    // If updating existing flow, use PUT; otherwise POST for new
    const method = currentFlowId ? 'PUT' : 'POST';
    const url = currentFlowId
      ? `/api/flows-builder/${currentFlowId}`
      : '/api/flows-builder';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_SECRET}`
      },
      body: JSON.stringify(flowData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save');
    }

    const result = await response.json();
    currentFlowId = result.flow.id;

    // Update UI to show saved state
    document.getElementById('flowName').value = result.flow.name;

    showStatus(`✅ Flow "${result.flow.name}" saved!`, 'success');
    console.log('✅ Flow saved:', result.flow);
  } catch (error) {
    showStatus(`❌ Error: ${error.message}`, 'error');
    console.error('Save error:', error);
  }
}

async function loadFlowsFromAPI() {
  try {
    const response = await fetch('/api/flows-builder', {
      headers: {
        'Authorization': `Bearer ${API_SECRET}`
      }
    });

    if (!response.ok) throw new Error('Failed to load');

    const result = await response.json();
    console.log(`✅ Loaded ${result.count} flows from API`);
    return result.flows || [];
  } catch (error) {
    console.warn('⚠️ Could not load flows:', error.message);
    return [];
  }
}

async function loadFlow(flowId) {
  try {
    showStatus('📂 Loading flow...', 'success');

    const response = await fetch(`/api/flows-builder/${flowId}`, {
      headers: {
        'Authorization': `Bearer ${API_SECRET}`
      }
    });

    if (!response.ok) throw new Error('Flow not found');

    const result = await response.json();
    const flow = result.flow;

    // Clear canvas
    editor.clear();
    nodeCounter = 0;

    // Restore flow name
    document.getElementById('flowName').value = flow.name;
    currentFlowId = flow.id;

    // Restore nodes from steps
    restoreNodesFromSteps(flow.steps);

    showStatus(`✅ Flow "${flow.name}" loaded!`, 'success');
    console.log('✅ Flow loaded:', flow);
    return flow;
  } catch (error) {
    showStatus(`❌ Error loading flow: ${error.message}`, 'error');
    console.error('Load error:', error);
  }
}

function restoreNodesFromSteps(steps) {
  if (!steps || !Array.isArray(steps)) return;

  let x = 100;
  let y = 100;

  steps.forEach((stepData) => {
    if (!stepData || !stepData.type) return;

    const nodeId = nodeCounter++;
    const nodeKey = `${stepData.type}_${nodeId}`;
    const nodeHTML = generateNodeHTML(stepData.type, stepData);

    editor.addNode(nodeKey, 1, 1, x, y, stepData.type, stepData, nodeHTML);

    x += 250;
    if (x > 800) {
      x = 100;
      y += 150;
    }
  });

  console.log(`✅ Restored ${steps.length} nodes`);
}

async function exportFlow() {
  if (!currentFlowId) {
    showStatus('❌ Please save flow first', 'error');
    return;
  }

  try {
    showStatus('📥 Exporting flow...', 'success');

    const response = await fetch(`/api/flows-builder/${currentFlowId}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_SECRET}`
      },
      body: JSON.stringify({ format: 'json' })
    });

    if (!response.ok) throw new Error('Export failed');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow_${currentFlowId}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showStatus('✅ Flow exported!', 'success');
  } catch (error) {
    showStatus(`❌ Error: ${error.message}`, 'error');
  }
}

function clearCanvas() {
  if (confirm('Clear all nodes and connections?')) {
    editor.clear();
    nodeCounter = 0;
    selectedNode = null;
    clearPropertiesPanel();
    showStatus('Canvas cleared', 'success');
  }
}

function openTestModal() {
  document.getElementById('testModal').classList.add('active');
}

window.closeTestModal = function() {
  document.getElementById('testModal').classList.remove('active');
};

async function openLoadModal() {
  const modal = document.getElementById('loadModal');
  const listDiv = document.getElementById('flowsList');

  try {
    showStatus('📂 Loading flows...', 'success');
    const flows = await loadFlowsFromAPI();

    if (flows.length === 0) {
      listDiv.innerHTML = '<p style="color: #999; padding: 20px;">No flows found</p>';
      modal.classList.add('active');
      return;
    }

    listDiv.innerHTML = flows.map(flow => `
      <div style="
        padding: 12px;
        margin: 8px 0;
        background: #f5f5f5;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        border-left: 4px solid ${flow.enabled ? '#667eea' : '#ccc'};
      "
      onmouseover="this.style.background='#e9e9e9'"
      onmouseout="this.style.background='#f5f5f5'"
      onclick="loadFlowFromModal('${flow.id}')">
        <strong>${flow.name}</strong><br>
        <small style="color: #999;">
          ${flow.keywords.join(', ')} • ${flow.steps.length} steps
          ${flow.enabled ? '✅' : '⚪'}
        </small>
      </div>
    `).join('');

    modal.classList.add('active');
  } catch (error) {
    showStatus(`❌ Error: ${error.message}`, 'error');
  }
}

window.closeLoadModal = function() {
  document.getElementById('loadModal').classList.remove('active');
};

window.loadFlowFromModal = async function(flowId) {
  await loadFlow(flowId);
  closeLoadModal();
};

window.runTest = async function() {
  const senderId = document.getElementById('testSenderId').value;
  const senderName = document.getElementById('testSenderName').value;

  if (!senderId || !currentFlowId) {
    showStatus('❌ Please enter Sender ID and save flow first', 'error');
    return;
  }

  try {
    showStatus('🧪 Testing flow...', 'success');

    const response = await fetch(`/api/flows-builder/${currentFlowId}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_SECRET}`
      },
      body: JSON.stringify({ senderId, senderName })
    });

    if (!response.ok) throw new Error('Test failed');

    const result = await response.json();
    showStatus(`✅ Flow test successful: ${result.stepsCount} steps`, 'success');
    closeTestModal();
  } catch (error) {
    showStatus(`❌ Test error: ${error.message}`, 'error');
  }
};

// ============================================
// 6. UTILITIES
// ============================================
function showStatus(message, type = 'success') {
  const div = document.createElement('div');
  div.className = `status-message ${type}`;
  div.textContent = message;
  document.body.appendChild(div);

  setTimeout(() => {
    div.remove();
  }, 3000);
}
