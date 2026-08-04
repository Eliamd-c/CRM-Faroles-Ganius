// ─────────────────────────────────────────────
// Autenticación del Builder
// ─────────────────────────────────────────────
function getAuthToken() {
  let token = localStorage.getItem('builder_auth_token');
  if (!token) {
    token = prompt('🔐 Ingresa el token de seguridad del Builder (puedes obtenerlo del administrador):');
    if (token) {
      localStorage.setItem('builder_auth_token', token.trim());
    }
  }
  return token;
}

function getAuthHeader() {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Verificar token antes de iniciar
const authToken = getAuthToken();
if (!authToken) {
  alert('❌ Token requerido. Sin token no puedes guardar cambios.');
}

const id = document.getElementById("drawflow");
const editor = new Drawflow(id);
editor.reroute = true;
editor.curvature = 0.5;
editor.start();

// ─────────────────────────────────────────────
// Inicialización de IA
// ─────────────────────────────────────────────
window.AI_ENABLED = true;
(async function initAI() {
  try {
    const res = await fetch('/api/ai/status');
    const data = await res.json();
    window.AI_ENABLED = data.configured;
    if (!window.AI_ENABLED) {
      const btnGenerate = document.getElementById('btn-ai-generate');
      if (btnGenerate) btnGenerate.style.display = 'none';
      const nodeBtn = document.querySelector('[data-node="ai_agent"]');
      if (nodeBtn) nodeBtn.style.display = 'none';
    }
  } catch(e) {}
})();

// ─────────────────────────────────────────────
// Estado global
// ─────────────────────────────────────────────
let currentLoadedFlowId = null; // ID del flujo cargado via ?flowId=
const nodeBlocksState = {}; // { nodeId: [ { id: 'b1', type: 'text', content: '', url: '', buttons: [] } ] }
const nodeActionsState  = {}; // { nodeId: { type: 'add_tag', params: {} } }
const nodeInputState = {}; // { nodeId: { type: 'email', field: 'email', prompt: '', retry: '' } }
const nodeConditionState = {}; // { nodeId: { field: '', operator: '', value: '' } }
const nodeRandomizerState = {}; // { nodeId: { paths: 2 } }
const nodeCarouselState = {}; // { nodeId: { elements: [{title,subtitle,image_url,buttons:[]}] } }
const nodeGalleryState = {};  // { nodeId: { images: [{url}], delay_between_ms: 300 } }
const nodeAudioState = {};    // { nodeId: { audio_url: '' } }
const nodeVideoState = {};    // { nodeId: { video_url: '' } }
const nodeFileState = {};     // { nodeId: { file_url: '' } }
const nodeDelayState = {};    // { nodeId: { seconds: 5 } }
const nodeGotoState = {};     // { nodeId: { flow_id: '' } }
const nodeAiAgentState = {};  // { nodeId: { system_prompt: '' } }

// ─────────────────────────────────────────────
// Helpers: Sync / Rehydrate de estado de nodos
// Usados por "Guardar" y por el sistema de Undo/Redo.
// ─────────────────────────────────────────────

// Vuelca los estados JS paralelos (nodeBlocksState, nodeActionsState, etc.)
// dentro de editor.drawflow para que editor.export() los incluya.
// (condition/randomizer/ai_agent ya se escriben directo en node.data al guardar su config)
function syncAllNodeStateToDrawflow() {
  const data = editor.drawflow.drawflow.Home.data;
  const stateMap = {
    _blocks: nodeBlocksState,
    _action: nodeActionsState,
    _input: nodeInputState,
    _carousel: nodeCarouselState,
    _gallery: nodeGalleryState,
    _audio: nodeAudioState,
    _video: nodeVideoState,
    _file: nodeFileState,
    _delay: nodeDelayState,
    _goto: nodeGotoState
  };
  for (const key in stateMap) {
    const store = stateMap[key];
    for (const nodeId in store) {
      if (data[nodeId] && store[nodeId] !== undefined && store[nodeId] !== null) {
        data[nodeId].data[key] = JSON.stringify(store[nodeId]);
      }
    }
  }
}

// Recorre todos los nodos actuales de Drawflow, repobla los estados JS
// paralelos desde node.data y vuelve a renderizar el contenido visual de cada nodo.
// Se usa después de editor.import() (undo/redo, carga de flujo).
function rehydrateAllNodeVisuals() {
  const data = editor.drawflow.drawflow.Home.data;
  for (const nodeId in data) {
    const node = data[nodeId];
    if (!node) continue;
    try {
      if (node.name === 'trigger') { renderTriggerNode(nodeId); }
      else if (node.name === 'message' && node.data._blocks) { nodeBlocksState[nodeId] = JSON.parse(node.data._blocks); renderBlocksInNode(nodeId); }
      else if (node.name === 'action' && node.data._action) { nodeActionsState[nodeId] = JSON.parse(node.data._action); renderActionNode(nodeId); }
      else if (node.name === 'input' && node.data._input) { nodeInputState[nodeId] = JSON.parse(node.data._input); renderInputNode(nodeId); }
      else if (node.name === 'condition' && node.data._condition) { nodeConditionState[nodeId] = JSON.parse(node.data._condition); renderConditionNode(nodeId); }
      else if (node.name === 'randomizer' && node.data._randomizer) { nodeRandomizerState[nodeId] = JSON.parse(node.data._randomizer); renderRandomizerNode(nodeId); }
      else if (node.name === 'carousel' && node.data._carousel) { nodeCarouselState[nodeId] = JSON.parse(node.data._carousel); renderCarouselNode(nodeId); }
      else if (node.name === 'gallery' && node.data._gallery) { nodeGalleryState[nodeId] = JSON.parse(node.data._gallery); renderGalleryNode(nodeId); }
      else if (node.name === 'audio' && node.data._audio) { nodeAudioState[nodeId] = JSON.parse(node.data._audio); renderAudioNode(nodeId); }
      else if (node.name === 'video' && node.data._video) { nodeVideoState[nodeId] = JSON.parse(node.data._video); renderVideoNode(nodeId); }
      else if (node.name === 'file' && node.data._file) { nodeFileState[nodeId] = JSON.parse(node.data._file); renderFileNode(nodeId); }
      else if (node.name === 'delay' && node.data._delay) { nodeDelayState[nodeId] = JSON.parse(node.data._delay); renderDelayNode(nodeId); }
      else if (node.name === 'goto' && node.data._goto) { nodeGotoState[nodeId] = JSON.parse(node.data._goto); renderGotoNode(nodeId); }
      else if (node.name === 'ai_agent' && node.data._ai) { nodeAiAgentState[nodeId] = JSON.parse(node.data._ai); renderAiAgentNode(nodeId); }
    } catch (e) { console.warn('rehydrate: error en nodo', nodeId, e); }
  }
}

// ─────────────────────────────────────────────
// Catálogo de Acciones (C.1)
// ─────────────────────────────────────────────
const ACTION_CATALOG = {
  contact: {
    label: '📋 Datos de contacto',
    desc: 'Gestiona etiquetas, campos y estados del contacto',
    actions: [
      { id: 'add_tag',        icon: '➕', label: 'Añadir etiqueta',          desc: 'Etiqueta el contacto para segmentarlo',             params: [{ key: 'tag',   label: 'Nombre de la etiqueta', placeholder: 'ej: interesado_rustico' }] },
      { id: 'remove_tag',     icon: '➖', label: 'Eliminar etiqueta',         desc: 'Quita una etiqueta del contacto',                  params: [{ key: 'tag',   label: 'Etiqueta a eliminar',   placeholder: 'ej: interesado_rustico' }] },
      { id: 'set_field',      icon: '📝', label: 'Establecer campo',          desc: 'Guarda un dato personalizado del contacto',        params: [{ key: 'field', label: 'Nombre del campo',     placeholder: 'ej: ciudad' }, { key: 'value', label: 'Valor', placeholder: 'ej: Bogotá' }] },
      { id: 'clear_field',    icon: '🗑️', label: 'Borrar campo',              desc: 'Elimina un campo guardado del contacto',           params: [{ key: 'field', label: 'Campo a borrar',       placeholder: 'ej: ciudad' }] },
      { id: 'delete_contact', icon: '🚫', label: 'Eliminar contacto',         desc: 'Elimina el contacto del CRM permanentemente',      params: [] },
    ]
  },
  automation: {
    label: '⚙️ Automatización',
    desc: 'Controla el flujo de automatización del contacto',
    actions: [
      { id: 'pause_bot',      icon: '⏸️', label: 'Pausar automatizaciones',   desc: 'El bot no responderá más a este contacto',         params: [] },
      { id: 'resume_bot',     icon: '▶️', label: 'Reanudar automatizaciones', desc: 'Reactiva el bot para este contacto',               params: [] },
      { id: 'subscribe_sequence',   icon: '📬', label: 'Suscribir a secuencia',   desc: 'Inicia una secuencia/drip para este contacto',  params: [{ key: 'sequence_id', label: 'ID de la secuencia', placeholder: 'ej: seq_welcome' }] },
      { id: 'unsubscribe_sequence', icon: '🚫', label: 'Desuscribir secuencia',   desc: 'Detiene una secuencia activa del contacto',     params: [{ key: 'sequence_id', label: 'ID de la secuencia', placeholder: 'ej: seq_welcome' }] },
    ]
  },
  inbox: {
    label: '📥 Bandeja de entrada',
    desc: 'Gestiona el estado de la conversación',
    actions: [
      { id: 'mark_open',      icon: '🟢', label: 'Marcar como Abierta',       desc: 'Marca la conversación como activa',                params: [] },
      { id: 'mark_closed',    icon: '🔴', label: 'Marcar como Cerrada',       desc: 'Marca la conversación como resuelta',              params: [] },
    ]
  }
};

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// ─────────────────────────────────────────────
// Renderizadores Visuales (Dentro del Nodo)
// ─────────────────────────────────────────────
function renderBlocksInNode(nodeId) {
  let container = document.querySelector(`#node-${nodeId} .node-blocks-container`);
  if (!container) {
    container = document.querySelector(`#node-${nodeId} .box`);
  }
  if (!container) return;
  const blocks = nodeBlocksState[nodeId] || [];
  
  let html = '';
  blocks.forEach(block => {
    // Bloque de texto: texto plano, sin burbuja
    if (block.type === 'text') {
      html += `<div class="nd-text-block">${block.content || '<span class="nd-placeholder">Escribe algo...</span>'}</div>`;
    }
    // Bloque de imagen
    else if (block.type === 'image') {
      html += `<div class="nd-image-block">${block.url ? `<img src="${block.url}" />` : '<div class="nd-placeholder" style="padding:16px; text-align:center;">📷 Sin imagen</div>'}</div>`;
    }
    
    // Botones como filas de "keyboard"
    if (block.buttons && block.buttons.length > 0) {
      html += `<div class="nd-keyboard">`;
      block.buttons.forEach(btn => {
        html += `<div class="nd-kb-btn">${btn.title || 'Nuevo Botón'}</div>`;
      });
      html += `</div>`;
    }
  });

  if (blocks.length === 0) {
    html = `<div class="nd-placeholder" style="padding:16px; text-align:center;">Vacío — añade bloques en el Inspector</div>`;
  }

  container.innerHTML = html;
  
  // Call repositionOutputs to align ports to buttons
  setTimeout(() => {
    repositionOutputs(nodeId);
  }, 10);
}


function repositionOutputs(nodeId) {
  const nodeEl = document.querySelector(`#node-${nodeId}`);
  if (!nodeEl) return;
  
  // Ocultar todas las salidas mayores a 1 primero
  for(let i=2; i<=20; i++) {
    const out = nodeEl.querySelector(`.output_${i}`);
    if(out) out.style.display = 'none';
  }

  // Posicionar la salida general (Next Step)
  const out1 = nodeEl.querySelector('.output_1');
  if (out1) {
    out1.style.position = 'absolute';
    out1.style.top = (nodeEl.offsetHeight - 12) + 'px';
    out1.style.right = '-8px';
    out1.style.display = 'block';
  }

  // Posicionar las salidas de los botones
  const btnRows = nodeEl.querySelectorAll('.nd-kb-btn');
  const blocks = nodeBlocksState[nodeId] || [];
  let btnIndex = 0;
  
  blocks.forEach(block => {
    (block.buttons || []).forEach(btn => {
      const outId = btnIndex + 2;
      const out = nodeEl.querySelector(`.output_${outId}`);
      const btnEl = btnRows[btnIndex];
      if (out && btnEl) {
        const btnRect = btnEl.getBoundingClientRect();
        const nodeRect = nodeEl.getBoundingClientRect();
        const relTop = (btnRect.top - nodeRect.top) + btnRect.height / 2;
        out.style.position = 'absolute';
        out.style.top = relTop + 'px';
        out.style.right = '-8px';
        out.style.display = 'block';
      }
      btnIndex++;
    });
  });
  
  editor.updateConnectionNodes('node-' + nodeId);
}

function renderActionNode(nodeId) {
  const nodeEl = document.querySelector(`#node-${nodeId}`);
  if (!nodeEl) return;
  const preview = nodeEl.querySelector('.action-node-preview');
  if (!preview) return;

  const config = nodeActionsState[nodeId];
  if (!config) {
    preview.innerHTML = `<span class="anp-empty">Selecciona este nodo para configurar</span>`;
    return;
  }

  let actionDef = null;
  for (const cat of Object.values(ACTION_CATALOG)) {
    actionDef = cat.actions.find(a => a.id === config.type);
    if (actionDef) break;
  }
  if (!actionDef) return;

  const paramText = Object.values(config.params).filter(Boolean).join(' · ');
  preview.innerHTML = `
    <span class="anp-icon">${actionDef.icon}</span>
    <div class="anp-info">
      <strong>${actionDef.label}</strong>
      ${paramText ? `<span class="anp-params">${paramText}</span>` : ''}
    </div>
  `;
}

function renderInputNode(nodeId) {
  const nodeEl = document.querySelector(`#node-${nodeId}`);
  if (!nodeEl) return;
  const preview = nodeEl.querySelector('.input-node-preview');
  if (!preview) return;

  const config = nodeInputState[nodeId];
  if (!config) {
    preview.innerHTML = `<span class="anp-empty" style="font-size:12px; color:#9ca3af;">Selecciona para configurar</span>`;
    return;
  }

  const typeLabels = { email: '✉️ Email', phone: '📱 Teléfono', text: '📝 Texto Libre' };
  preview.innerHTML = `
    <div style="font-size:12px; font-weight:600; color:#374151; margin-bottom:4px;">Pedir: ${typeLabels[config.type] || config.type}</div>
    <div style="font-size:11px; color:#6b7280; margin-bottom:4px;">Guardar en: <span style="background:#e5e7eb; padding:2px 4px; border-radius:4px;">${config.field || 'N/A'}</span></div>
    <div style="font-size:11px; color:#6b7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">"${config.prompt || 'Sin mensaje'}"</div>
  `;
}

// ─────────────────────────────────────────────
// Definición de Nodos HTML
// ─────────────────────────────────────────────
const htmlTrigger = `
  <div class="mc-node mc-trigger">
    <div class="mc-header"><span>⚡</span> Cuando...</div>
    <div class="box trigger-node-preview">
      <div style="border: 2px dashed #0084ff; border-radius: 8px; padding: 12px; text-align: center; color: #0084ff; font-weight: 600; font-size: 14px; cursor: pointer;">
        + Elegir disparador
      </div>
    </div>
  </div>
`;

// Nodo Legacy de Tarjeta (para compatibilidad)
const htmlCard = `
  <div class="mc-node mc-content">
    <div class="mc-header"><span>🖼️</span> Tarjeta (Legacy)</div>
    <div class="box">
      <p style="font-size:11px; color:#888;">Nodo antiguo, por favor usa el Inspector.</p>
    </div>
  </div>
`;

const htmlCondition = `
  <div class="mc-node mc-logic">
    <div class="mc-header"><span>🔀</span> Condition</div>
    <div class="box condition-node-preview">
      <em style="color:#8492a6; font-size:11px;">Configura en el panel...</em>
    </div>
  </div>
`;

const htmlRandomizer = `
  <div class="mc-node mc-logic">
    <div class="mc-header"><span>🎲</span> Randomizer</div>
    <div class="box randomizer-node-preview">
      <em style="color:#8492a6; font-size:11px;">Configura salidas en el panel...</em>
    </div>
  </div>
`;

const htmlAction = `
  <div class="mc-node mc-action">
    <div class="mc-header"><span>⚡</span> Action</div>
    <div class="box action-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin configurar</em>
    </div>
  </div>
`;

const htmlInput = `
  <div class="mc-node mc-action">
    <div class="mc-header"><span>📥</span> User Input</div>
    <div class="box input-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin configurar</em>
    </div>
  </div>
`;

const htmlCarousel = `
  <div class="mc-node mc-content">
    <div class="mc-header"><span>🖼️</span> Carrusel</div>
    <div class="box carousel-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin tarjetas configuradas</em>
    </div>
  </div>
`;

const htmlGallery = `
  <div class="mc-node mc-content">
    <div class="mc-header"><span>📸</span> Galería</div>
    <div class="box gallery-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin imágenes</em>
    </div>
  </div>
`;

const htmlAudio = `
  <div class="mc-node mc-content">
    <div class="mc-header"><span>🎵</span> Audio</div>
    <div class="box audio-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin audio configurado</em>
    </div>
  </div>
`;

const htmlVideo = `
  <div class="mc-node mc-content">
    <div class="mc-header"><span>🎥</span> Video</div>
    <div class="box video-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin video configurado</em>
    </div>
  </div>
`;

const htmlFile = `
  <div class="mc-node mc-content">
    <div class="mc-header"><span>📄</span> Archivo / PDF</div>
    <div class="box file-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin archivo configurado</em>
    </div>
  </div>
`;

const htmlDelay = `
  <div class="mc-node mc-action">
    <div class="mc-header"><span>⏱</span> Espera</div>
    <div class="box delay-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin duración</em>
    </div>
  </div>
`;

const htmlGoto = `
  <div class="mc-node mc-logic">
    <div class="mc-header"><span>↗️</span> Goto / Saltar</div>
    <div class="box goto-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin destino</em>
    </div>
  </div>
`;

const htmlAiAgent = `
  <div class="mc-node mc-ai">
    <div class="mc-header"><span>🧠</span> Agente IA</div>
    <div class="box ai-agent-node-preview" style="padding: 12px; background: #f8fafc; text-align: center; border-radius: 6px;">
      <em style="color:#64748b; font-size:11px;">Sin Prompt Configurado</em>
    </div>
  </div>
`;

// Registrar nodos estáticos
editor.registerNode('trigger', htmlTrigger);
editor.registerNode('card', htmlCard);
editor.registerNode('action', htmlAction);
editor.registerNode('input', htmlInput);
editor.registerNode('carousel', htmlCarousel);
editor.registerNode('gallery', htmlGallery);
editor.registerNode('audio', htmlAudio);
editor.registerNode('video', htmlVideo);
editor.registerNode('file', htmlFile);
editor.registerNode('delay', htmlDelay);
editor.registerNode('goto', htmlGoto);
editor.registerNode('ai_agent', htmlAiAgent);

// ─────────────────────────────────────────────
// Agregar nodo Mensaje (dinámico, soporta hasta 20 botones)
// ─────────────────────────────────────────────
function addMessageNode(posX, posY) {
  const tempHtml = `<div class="mc-node mc-content"><div class="mc-header"><span>💬</span> Send Message</div><div class="box node-blocks-container"></div></div>`;
  const nodeId = editor.addNode('message', 1, 10, posX, posY, 'message', { _blocks: '[]' }, tempHtml);
  
  nodeBlocksState[nodeId] = [
    { id: generateId(), type: 'text', content: '¡Hola! Escribe aquí...', buttons: [] }
  ];
  
  setTimeout(() => renderBlocksInNode(nodeId), 50);
  return nodeId;
}

// ─────────────────────────────────────────────
// Drag & Drop
// ─────────────────────────────────────────────
const elements = document.querySelectorAll('.drag-item');
elements.forEach(el => {
  el.addEventListener('dragstart', e => {
    e.dataTransfer.setData('node', e.target.getAttribute('data-node'));
  });
});

id.addEventListener('dragover', e => e.preventDefault());
id.addEventListener('drop', e => {
  e.preventDefault();
  const type = e.dataTransfer.getData('node');
  const rect = id.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const posX = x * (editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)) - (editor.precanvas.getBoundingClientRect().x * (editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)));
  const posY = y * (editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)) - (editor.precanvas.getBoundingClientRect().y * (editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)));

  if (type === 'trigger') {
    const newTriggerId = editor.addNode('trigger', 0, 1, posX, posY, 'trigger', { keywords: '', triggerType: null }, htmlTrigger);
    setTimeout(() => openTriggerPicker(newTriggerId), 100);
  } else if (type === 'message') {
    addMessageNode(posX, posY);
  } else if (type === 'action') {
    const nodeId = editor.addNode('action', 1, 1, posX, posY, 'action', { _action: '{}' }, htmlAction);
    nodeActionsState[nodeId] = null;
    setTimeout(() => renderActionNode(nodeId), 50);
  } else if (type === 'input') {
    const nodeId = editor.addNode('input', 1, 2, posX, posY, 'input', { _input: '{}' }, htmlInput);
    nodeInputState[nodeId] = { type: 'email', field: 'email', prompt: 'Por favor ingresa tu email:', retry: 'Ese correo no es válido. Intenta de nuevo:' };
    setTimeout(() => renderInputNode(nodeId), 50);
  } else if (type === 'condition') {
    const nodeId = editor.addNode('condition', 1, 2, posX, posY, 'condition', { _condition: '{}' }, htmlCondition);
    nodeConditionState[nodeId] = { field: 'email', operator: 'contains', value: '@' };
    setTimeout(() => renderConditionNode(nodeId), 50);
  } else if (type === 'randomizer') {
    const nodeId = editor.addNode('randomizer', 1, 2, posX, posY, 'randomizer', { _randomizer: '{}' }, htmlRandomizer);
    nodeRandomizerState[nodeId] = { paths: 2 };
    setTimeout(() => renderRandomizerNode(nodeId), 50);
  } else if (type === 'carousel') {
    const nodeId = editor.addNode('carousel', 1, 1, posX, posY, 'carousel', { _carousel: '{}' }, htmlCarousel);
    nodeCarouselState[nodeId] = { elements: [] };
    setTimeout(() => renderCarouselNode(nodeId), 50);
  } else if (type === 'gallery') {
    const nodeId = editor.addNode('gallery', 1, 1, posX, posY, 'gallery', { _gallery: '{}' }, htmlGallery);
    nodeGalleryState[nodeId] = { images: [], delay_between_ms: 300 };
    setTimeout(() => renderGalleryNode(nodeId), 50);
  } else if (type === 'audio') {
    const nodeId = editor.addNode('audio', 1, 1, posX, posY, 'audio', { _audio: '{}' }, htmlAudio);
    nodeAudioState[nodeId] = { audio_url: '' };
    setTimeout(() => renderAudioNode(nodeId), 50);
  } else if (type === 'video') {
    const nodeId = editor.addNode('video', 1, 1, posX, posY, 'video', { _video: '{}' }, htmlVideo);
    nodeVideoState[nodeId] = { video_url: '' };
    setTimeout(() => renderVideoNode(nodeId), 50);
  } else if (type === 'file') {
    const nodeId = editor.addNode('file', 1, 1, posX, posY, 'file', { _file: '{}' }, htmlFile);
    nodeFileState[nodeId] = { file_url: '' };
    setTimeout(() => renderFileNode(nodeId), 50);
  } else if (type === 'delay') {
    const nodeId = editor.addNode('delay', 1, 1, posX, posY, 'delay', { _delay: '{}' }, htmlDelay);
    nodeDelayState[nodeId] = { seconds: 5 };
    setTimeout(() => renderDelayNode(nodeId), 50);
  } else if (type === 'goto') {
    const nodeId = editor.addNode('goto', 1, 0, posX, posY, 'goto', { _goto: '{}' }, htmlGoto);
    nodeGotoState[nodeId] = { flow_id: '' };
    setTimeout(() => renderGotoNode(nodeId), 50);
  } else if (type === 'ai_agent') {
    const nodeId = editor.addNode('ai_agent', 1, 1, posX, posY, 'ai_agent', { _ai: '{}' }, htmlAiAgent);
    nodeAiAgentState[nodeId] = { system_prompt: 'Eres un asistente útil y amigable. Ayuda al usuario a resolver sus dudas basándote en la información de la tienda.' };
    setTimeout(() => renderAiAgentNode(nodeId), 50);
  }
});

// ─────────────────────────────────────────────
// Panel Inspector (D.2 UX)
// ─────────────────────────────────────────────
let selectedNodeId = null;

const NODE_META = {
  trigger:    { icon: '⚡', cls: 'type-trigger' },
  message:    { icon: '💬', cls: 'type-message' },
  action:     { icon: '⚡', cls: 'type-action' },
  input:      { icon: '📥', cls: 'type-input' },
  condition:  { icon: '🔀', cls: 'type-condition' },
  randomizer: { icon: '🎲', cls: 'type-randomizer' },
  carousel:   { icon: '🖼️', cls: 'type-carousel' },
  gallery:    { icon: '📸', cls: 'type-gallery' },
  audio:      { icon: '🎵', cls: 'type-audio' },
  video:      { icon: '🎥', cls: 'type-video' },
  delay:      { icon: '⏱', cls: 'type-delay' },
  goto:       { icon: '↗️', cls: 'type-goto' },
  file:       { icon: '📄', cls: 'type-file' },
  ai_agent:   { icon: '🧠', cls: 'type-ai' },
};

function openInspector(nodeId) {
  selectedNodeId = nodeId;
  const node = editor.getNodeFromId(nodeId);
  const panel = document.getElementById('config-panel');
  panel.classList.remove('hidden');

  // Color del header por tipo
  const header = document.getElementById('config-header');
  const iconEl = document.getElementById('config-header-icon');
  if (header) {
    header.className = 'config-header';
    const meta = NODE_META[node.name];
    if (meta) header.classList.add(meta.cls);
    if (iconEl) iconEl.textContent = meta?.icon || '';
  }

  if (node.name === 'trigger') {
    const tData = editor.drawflow.drawflow.Home.data[nodeId]?.data || {};
    if (!tData.triggerType) {
      openTriggerPicker(nodeId);
      return;
    }
    renderTriggerInspector(nodeId);
  } else if (node.name === 'message') {
    renderMessageInspector(nodeId);
  } else if (node.name === 'action') {
    renderActionInspector(nodeId);
  } else if (node.name === 'input') {
    renderInputInspector(nodeId);
  } else if (node.name === 'condition') {
    renderConditionInspector(nodeId);
  } else if (node.name === 'randomizer') {
    renderRandomizerInspector(nodeId);
  } else if (node.name === 'carousel') {
    renderCarouselInspector(nodeId);
  } else if (node.name === 'gallery') {
    renderGalleryInspector(nodeId);
  } else if (node.name === 'audio') {
    renderAudioInspector(nodeId);
  } else if (node.name === 'video') {
    renderVideoInspector(nodeId);
  } else if (node.name === 'file') {
    renderFileInspector(nodeId);
  } else if (node.name === 'delay') {
    renderDelayInspector(nodeId);
  } else if (node.name === 'goto') {
    renderGotoInspector(nodeId);
  } else if (node.name === 'ai_agent') {
    renderAiAgentInspector(nodeId);
  } else {
    document.getElementById('config-title').innerText = 'Inspector';
    document.getElementById('config-body').innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No hay configuraciones extra para este nodo.</p>';
  }
}

function closeInspector() {
  selectedNodeId = null;
  document.getElementById('config-panel').classList.add('hidden');
}

editor.on('nodeSelected', openInspector);
editor.on('nodeUnselected', closeInspector);
document.getElementById('close-config').addEventListener('click', closeInspector);

// ─────────────────────────────────────────────
// Inspector: Mensaje (Bloques)
// ─────────────────────────────────────────────
function renderMessageInspector(nodeId) {
  document.getElementById('config-title').innerText = 'Enviar mensaje';
  const blocks = nodeBlocksState[nodeId] || [];
  let html = '<div class="insp-blocks-list" id="insp-blocks-list">';
  
  blocks.forEach((block, idx) => {
    html += `
      <div class="ms-block-wrapper" style="margin-bottom: 24px; position: relative;">
        <!-- Botón para eliminar bloque -->
        <button onclick="deleteBlock('${nodeId}', ${idx})" style="position: absolute; top: -10px; right: -10px; background: white; border: 1px solid #ef4444; color: #ef4444; width: 24px; height: 24px; border-radius: 50%; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" title="Eliminar bloque"><i class="fa-solid fa-times"></i></button>
    `;
      
    if (block.type === 'text') {
      html += `
        <div style="background: #f1f2f6; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <textarea id="text-block-${nodeId}-${idx}" class="cfg-input" style="width: 100%; border: none; background: transparent; outline: none; resize: none; min-height: 80px; font-size: 13px; font-family: inherit; color: #1c1e21;" oninput="updateBlockContent('${nodeId}', ${idx}, this.value)" placeholder="Introduce tu texto...">${block.content}</textarea>
          <div style="display: ${window.AI_ENABLED ? 'flex' : 'none'}; justify-content: flex-end;">
            <button onclick="improveTextWithAI('${nodeId}', ${idx})" style="background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(236, 72, 153, 0.2); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
              <span id="ai-icon-${nodeId}-${idx}">✨</span> <span id="ai-text-${nodeId}-${idx}">Mejorar con IA</span>
            </button>
          </div>
      `;
    } else if (block.type === 'image') {
      html += `
        <div style="background: #f1f2f6; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <label class="cfg-label"><i class="fa-solid fa-image"></i> URL de la Imagen o Subir archivo</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input id="img-url-${nodeId}-${idx}" class="cfg-input" type="text" style="margin-bottom:0;" value="${block.url || ''}" oninput="updateBlockUrl('${nodeId}', ${idx}, this.value)" placeholder="https://..." />
            <label style="cursor: pointer; background: #ffffff; padding: 8px; border-radius: 6px; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; flex-shrink: 0; border: 1px solid #cbd5e1; color: var(--primary);" title="Subir imagen desde tu PC">
              <input type="file" accept="image/*" style="display: none;" onchange="uploadBlockImage(this, '${nodeId}', ${idx})" />
              <i class="fa-solid fa-upload"></i>
            </label>
          </div>
          <div id="upload-progress-${nodeId}-${idx}" style="font-size: 11px; color: var(--color-primary); display: none; margin-top: 4px;">Subiendo imagen...</div>
      `;
    }

    // Botones (compartidos por texto e imagen)
    html += `<div class="ms-btns-container" style="display: flex; flex-direction: column; gap: 4px;">`;
    (block.buttons || []).forEach((btn, bIdx) => {
      html += `
        <div class="ms-btn" onclick="openButtonEditor('${nodeId}', ${idx}, ${bIdx})" style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; text-align: center; font-size: 13px; font-weight: 600; color: #0084ff; cursor: pointer; display: flex; justify-content: center; align-items: center; position: relative; transition: border-color 0.15s;">
          ${btn.title || 'New Button'}
          <div style="position: absolute; right: 10px; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #d1d5db;"></div>
        </div>`;
    });
    html += `</div>`; // fin .ms-btns-container
    
    html += `</div>`; // fin bloque gris (#f1f2f6)

    // Botón "+ Añadir botón" fuera del bloque gris (como respuesta rápida o botón extra)
    if ((block.buttons || []).length < 3) {
      html += `<div onclick="addButton('${nodeId}', ${idx})" style="border: 1px dashed var(--primary); background: rgba(37,99,235,0.05); border-radius: 20px; padding: 10px; text-align: center; font-size: 13px; font-weight: 600; color: var(--primary); cursor: pointer; margin-top: 10px; transition: all 0.2s;"><i class="fa-solid fa-plus"></i> Añadir botón</div>`;
    }
    
    html += `</div>`; // fin .ms-block-wrapper
  });
  
  html += `</div>`; // .insp-blocks-list
  
  html += `
    <div style="margin-top:20px;">
      <label class="cfg-label" style="margin-bottom:8px; display:block;">Añadir bloque</label>
      <div class="block-palette">
        <div class="block-palette-item" onclick="addBlock('${nodeId}', 'text')">
          <span class="bpi-icon">📝</span>Texto
        </div>
        <div class="block-palette-item" onclick="addBlock('${nodeId}', 'image')">
          <span class="bpi-icon">🖼️</span>Imagen
        </div>
        <div class="block-palette-item" onclick="addBlockNode('${nodeId}', 'audio')">
          <span class="bpi-icon">🎵</span>Audio
        </div>
        <div class="block-palette-item" onclick="addBlockNode('${nodeId}', 'video')">
          <span class="bpi-icon">🎥</span>Video
        </div>
        <div class="block-palette-item" onclick="addBlockNode('${nodeId}', 'file')">
          <span class="bpi-icon">📄</span>Archivo
        </div>
        <div class="block-palette-item" onclick="addBlockNode('${nodeId}', 'delay')">
          <span class="bpi-icon">⏱️</span>Espera
        </div>
      </div>
    </div>
  `;
  document.getElementById('config-body').innerHTML = html;
}

// Modal for editing buttons
function openButtonEditor(nodeId, idx, bIdx) {
  let modal = document.getElementById('btn-edit-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'btn-edit-modal';
    modal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#fff; width:340px; border-radius:12px; box-shadow:0 20px 40px rgba(0,0,0,0.15); z-index:10000; display:flex; flex-direction:column; overflow:hidden; font-family:Inter,sans-serif; border: 1px solid #e5e7eb;';
    document.body.appendChild(modal);
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'btn-edit-backdrop';
    backdrop.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.3); z-index:9999;';
    backdrop.onclick = () => closeButtonEditor();
    document.body.appendChild(backdrop);
  }

  const btn = nodeBlocksState[nodeId][idx].buttons[bIdx];
  
  // Guardar posición de scroll si ya estaba abierto
  let scrollTop = 0;
  const scrollContainer = modal.querySelector('.modal-scroll-container');
  if (scrollContainer) {
    scrollTop = scrollContainer.scrollTop;
  }
  
  modal.innerHTML = `
    <div style="display:flex; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #f3f4f6;">
      <h3 style="margin:0; font-size:16px; color:#1c1e21;">Editar botón</h3>
      <button onclick="closeButtonEditor()" style="background:none; border:none; font-size:18px; cursor:pointer; color:#6b7280;">×</button>
    </div>
    <div class="modal-scroll-container" style="padding:20px; overflow-y:auto; max-height:450px;">
      <label style="font-size:12px; color:#6b7280; font-weight:500; display:block; margin-bottom:8px;">Título del botón</label>
      <input type="text" value="${btn.title}" oninput="updateBtnTitle('${nodeId}', ${idx}, ${bIdx}, this.value)" style="width:100%; padding:10px 12px; border:2px solid #0084ff; border-radius:8px; font-size:14px; outline:none; margin-bottom:20px; font-weight:600; color:#0084ff;" />
      
      <label style="font-size:12px; color:#6b7280; font-weight:500; display:block; margin-bottom:8px;">Cuando se presiona este botón</label>
      
      <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:20px;">
        
        <!-- Instagram (Mensaje) -->
        <div onclick="updateBtnType('${nodeId}', ${idx}, ${bIdx}, 'instagram')" style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid ${btn.type === 'postback' || btn.type === 'instagram' ? '#0084ff' : '#d1d5db'}; background:${btn.type === 'postback' || btn.type === 'instagram' ? '#f0f7ff' : '#ffffff'}; border-radius:8px; cursor:pointer; transition: 0.2s;">
          <div style="width:24px; height:24px; border-radius:50%; background:linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); display:flex; align-items:center; justify-content:center; color:white; font-size:14px;">📷</div>
          <span style="font-size:14px; font-weight:500; color:#1c1e21;">Instagram</span>
        </div>
        
        <!-- AI Step -->
        <div onclick="updateBtnType('${nodeId}', ${idx}, ${bIdx}, 'ai_step')" style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid ${btn.type === 'ai_step' ? '#0084ff' : '#d1d5db'}; background:${btn.type === 'ai_step' ? '#f0f7ff' : '#ffffff'}; border-radius:8px; cursor:pointer; transition: 0.2s;">
          <span style="font-size:18px;">✨</span>
          <span style="font-size:14px; font-weight:500; color:#1c1e21;">AI Step</span>
        </div>

        <!-- Abrir sitio web -->
        <div onclick="updateBtnType('${nodeId}', ${idx}, ${bIdx}, 'web_url')" style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid ${btn.type === 'web_url' ? '#0084ff' : '#d1d5db'}; background:${btn.type === 'web_url' ? '#f0f7ff' : '#ffffff'}; border-radius:8px; cursor:pointer; transition: 0.2s;">
          <span style="font-size:18px;">🔗</span>
          <span style="font-size:14px; font-weight:500; color:#1c1e21;">Abrir sitio web</span>
        </div>

        <!-- Realizar acciones -->
        <div onclick="updateBtnType('${nodeId}', ${idx}, ${bIdx}, 'action')" style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid ${btn.type === 'action' ? '#0084ff' : '#d1d5db'}; background:${btn.type === 'action' ? '#f0f7ff' : '#ffffff'}; border-radius:8px; cursor:pointer; transition: 0.2s;">
          <span style="font-size:18px; color:#f59e0b;">⚡</span>
          <span style="font-size:14px; font-weight:500; color:#1c1e21;">Realizar acciones</span>
        </div>

        <!-- Condición -->
        <div onclick="updateBtnType('${nodeId}', ${idx}, ${bIdx}, 'condition')" style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid ${btn.type === 'condition' ? '#0084ff' : '#d1d5db'}; background:${btn.type === 'condition' ? '#f0f7ff' : '#ffffff'}; border-radius:8px; cursor:pointer; transition: 0.2s;">
          <span style="font-size:18px; color:#0ea5e9;">🔀</span>
          <span style="font-size:14px; font-weight:500; color:#1c1e21; flex:1;">Condición</span>
          <span style="background:#2563eb; color:white; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:bold;">UPGRADE</span>
        </div>

        <!-- Aleatorizador -->
        <div onclick="updateBtnType('${nodeId}', ${idx}, ${bIdx}, 'randomizer')" style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid ${btn.type === 'randomizer' ? '#0084ff' : '#d1d5db'}; background:${btn.type === 'randomizer' ? '#f0f7ff' : '#ffffff'}; border-radius:8px; cursor:pointer; transition: 0.2s;">
          <span style="font-size:18px; color:#8b5cf6;">🎲</span>
          <span style="font-size:14px; font-weight:500; color:#1c1e21; flex:1;">Aleatorizador</span>
          <span style="background:#2563eb; color:white; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:bold;">UPGRADE</span>
        </div>
        
        <!-- Pausa inteligente -->
        <div onclick="updateBtnType('${nodeId}', ${idx}, ${bIdx}, 'smart_delay')" style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid ${btn.type === 'smart_delay' ? '#0084ff' : '#d1d5db'}; background:${btn.type === 'smart_delay' ? '#f0f7ff' : '#ffffff'}; border-radius:8px; cursor:pointer; transition: 0.2s;">
          <span style="font-size:18px; color:#ef4444;">🕒</span>
          <span style="font-size:14px; font-weight:500; color:#1c1e21; flex:1;">Pausa inteligente</span>
          <span style="background:#2563eb; color:white; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:bold;">UPGRADE</span>
        </div>
      </div>

      ${btn.type === 'web_url' ? `
        <label style="font-size:12px; color:#6b7280; font-weight:500; display:block; margin-bottom:8px;">Dirección del sitio web</label>
        <input type="text" value="${btn.url||''}" oninput="updateBtnUrl('${nodeId}', ${idx}, ${bIdx}, this.value)" placeholder="https://..." style="width:100%; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:13px; outline:none; margin-bottom:20px;" />
      ` : ''}
    </div>
    <div style="display:flex; justify-content:space-between; padding:16px 20px; border-top:1px solid #f3f4f6; background:#f9fafb;">
      <button onclick="deleteButton('${nodeId}', ${idx}, ${bIdx}); closeButtonEditor();" style="background:none; border:none; color:#ef4444; font-size:13px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:4px;">🗑️ Botón Eliminar</button>
      <button onclick="closeButtonEditor()" style="background:#0084ff; color:white; border:none; border-radius:8px; padding:8px 24px; font-size:14px; font-weight:600; cursor:pointer;">Listo</button>
    </div>
  `;
  
  modal.style.display = 'flex';
  document.getElementById('btn-edit-backdrop').style.display = 'block';

  // Restaurar scroll
  const newScrollContainer = modal.querySelector('.modal-scroll-container');
  if (newScrollContainer && scrollTop > 0) {
    newScrollContainer.scrollTop = scrollTop;
  }
}

function closeButtonEditor() {
  const modal = document.getElementById('btn-edit-modal');
  const backdrop = document.getElementById('btn-edit-backdrop');
  if (modal) modal.style.display = 'none';
  if (backdrop) backdrop.style.display = 'none';
}

function getGlobalButtonIndex(nodeId, blockIdx, btnIdx) {
  const blocks = nodeBlocksState[nodeId] || [];
  let index = 0;
  for (let i = 0; i < blocks.length; i++) {
    if (i === blockIdx) {
      return index + btnIdx;
    }
    index += (blocks[i].buttons || []).length;
  }
  return index;
}

function spawnNodeForButton(sourceNodeId, globalBtnIdx, type) {
  const nodeEl = document.getElementById('node-' + sourceNodeId);
  const posX = (nodeEl ? parseFloat(nodeEl.style.left) : 0) + 380;
  const posY = (nodeEl ? parseFloat(nodeEl.style.top) : 0) + (globalBtnIdx * 60);

  const outPort = 'output_' + (globalBtnIdx + 2);

  // Intentar eliminar conexiones existentes en este puerto
  const nodeData = editor.drawflow.drawflow.Home.data[sourceNodeId];
  if (nodeData && nodeData.outputs[outPort]) {
     const connections = nodeData.outputs[outPort].connections;
     // Hacemos una copia para evitar problemas al iterar y borrar
     const connsToDrop = [...connections];
     connsToDrop.forEach(c => {
       editor.removeSingleConnection(sourceNodeId, c.node, outPort, c.output);
     });
  }

  let newNodeId = null;
  if (type === 'action') {
    newNodeId = editor.addNode('action', 1, 1, posX, posY, 'action', { _action: '{}' }, htmlAction);
    nodeActionsState[newNodeId] = null;
    setTimeout(() => renderActionNode(newNodeId), 50);
  } else if (type === 'condition') {
    newNodeId = editor.addNode('condition', 1, 2, posX, posY, 'condition', { _condition: '{}' }, htmlCondition);
    nodeConditionState[newNodeId] = { field: 'email', operator: 'contains', value: '@' };
    setTimeout(() => renderConditionNode(newNodeId), 50);
  } else if (type === 'randomizer') {
    newNodeId = editor.addNode('randomizer', 1, 2, posX, posY, 'randomizer', { _randomizer: '{}' }, htmlRandomizer);
    nodeRandomizerState[newNodeId] = { paths: 2 };
    setTimeout(() => renderRandomizerNode(newNodeId), 50);
  } else if (type === 'instagram' || type === 'postback' || type === 'ai_step' || type === 'smart_delay') {
    newNodeId = addMessageNode(posX, posY);
  }

  if (newNodeId) {
    setTimeout(() => {
      editor.addConnection(sourceNodeId, newNodeId, outPort, 'input_1');
    }, 150); // Dar tiempo al DOM de crearse
  }
}

// Global window functions for the generated HTML
window.addBlockNode = function(sourceNodeId, type) {
  const nodeEl = document.getElementById('node-' + sourceNodeId);
  const posX = (nodeEl ? parseFloat(nodeEl.style.left) : 200) + 350;
  const posY = nodeEl ? parseFloat(nodeEl.style.top) : 200;
  let newId = null;
  if (type === 'audio') {
    newId = editor.addNode('audio', 1, 1, posX, posY, 'audio', { _audio: '{}' }, htmlAudio);
    nodeAudioState[newId] = { audio_url: '' };
    setTimeout(() => renderAudioNode(newId), 50);
  } else if (type === 'video') {
    newId = editor.addNode('video', 1, 1, posX, posY, 'video', { _video: '{}' }, htmlVideo);
    nodeVideoState[newId] = { video_url: '' };
    setTimeout(() => renderVideoNode(newId), 50);
  } else if (type === 'file') {
    newId = editor.addNode('file', 1, 1, posX, posY, 'file', { _file: '{}' }, htmlFile);
    nodeFileState[newId] = { file_url: '' };
    setTimeout(() => renderFileNode(newId), 50);
  } else if (type === 'delay') {
    newId = editor.addNode('delay', 1, 1, posX, posY, 'delay', { _delay: '{}' }, htmlDelay);
    nodeDelayState[newId] = { seconds: 5 };
    setTimeout(() => renderDelayNode(newId), 50);
  }
  if (newId) {
    setTimeout(() => editor.addConnection(sourceNodeId, newId, 'output_1', 'input_1'), 100);
  }
};

window.updateBlockContent = (nodeId, idx, val) => { nodeBlocksState[nodeId][idx].content = val; renderBlocksInNode(nodeId); };

window.improveTextWithAI = async (nodeId, idx) => {
  const textarea = document.getElementById(`text-block-${nodeId}-${idx}`);
  const icon = document.getElementById(`ai-icon-${nodeId}-${idx}`);
  const btnText = document.getElementById(`ai-text-${nodeId}-${idx}`);
  
  if (!textarea || !textarea.value.trim()) {
    if (typeof Toast !== 'undefined') Toast.warning('Escribe algo primero para que la IA lo mejore');
    return;
  }

  const originalText = textarea.value;
  icon.innerText = '⏳';
  btnText.innerText = 'Pensando...';
  
  try {
    const res = await fetch('/api/ai/improve-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: originalText })
    });
    
    const data = await res.json();
    if (res.ok && data.text) {
      textarea.value = data.text;
      window.updateBlockContent(nodeId, idx, data.text);
      if (typeof Toast !== 'undefined') Toast.success('Texto mejorado con IA ✨');
    } else {
      if (typeof Toast !== 'undefined') Toast.error(data.error || 'Error de IA');
    }
  } catch (err) {
    console.error('Error IA:', err);
    if (typeof Toast !== 'undefined') Toast.error('Error de conexión con la IA');
  } finally {
    icon.innerText = '✨';
    btnText.innerText = 'Mejorar con IA';
  }
};
window.updateBlockUrl = (nodeId, idx, val) => { nodeBlocksState[nodeId][idx].url = val; renderBlocksInNode(nodeId); };
window.uploadBlockImage = async (input, nodeId, idx) => {
  const file = input.files[0];
  if (!file) return;
  const progressEl = document.getElementById(`upload-progress-${nodeId}-${idx}`);
  if (progressEl) progressEl.style.display = 'block';
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok && data.url) {
      window.updateBlockUrl(nodeId, idx, data.url);
      const urlInput = document.getElementById(`img-url-${nodeId}-${idx}`);
      if (urlInput) urlInput.value = data.url;
      if (typeof Toast !== 'undefined') Toast.success('Imagen subida correctamente');
    } else {
      if (typeof Toast !== 'undefined') Toast.error(data.error || 'Error al subir');
    }
  } catch (err) {
    if (typeof Toast !== 'undefined') Toast.error('Error de conexión');
  } finally {
    if (progressEl) progressEl.style.display = 'none';
    input.value = '';
  }
};
window.deleteBlock = (nodeId, idx) => { nodeBlocksState[nodeId].splice(idx, 1); renderBlocksInNode(nodeId); renderMessageInspector(nodeId); };
window.addBlock = (nodeId, type) => { nodeBlocksState[nodeId].push({id: generateId(), type, content: type==='text'?'Nuevo texto':'', url:'', buttons:[]}); renderBlocksInNode(nodeId); renderMessageInspector(nodeId); };
window.addButton = (nodeId, idx) => { nodeBlocksState[nodeId][idx].buttons.push({title:'New Button', type:'postback', url:''}); renderBlocksInNode(nodeId); renderMessageInspector(nodeId); };
window.deleteButton = (nodeId, idx, bIdx) => { nodeBlocksState[nodeId][idx].buttons.splice(bIdx, 1); renderBlocksInNode(nodeId); renderMessageInspector(nodeId); };
window.updateBtnTitle = (nodeId, idx, bIdx, val) => { nodeBlocksState[nodeId][idx].buttons[bIdx].title = val; renderBlocksInNode(nodeId); renderMessageInspector(nodeId); };

window.updateBtnType = (nodeId, idx, bIdx, val) => { 
  const oldType = nodeBlocksState[nodeId][idx].buttons[bIdx].type;
  nodeBlocksState[nodeId][idx].buttons[bIdx].type = val; 
  
  // Si cambia de tipo y es un nodo que se deba spawnear
  if (val !== 'web_url' && oldType !== val) {
    const globalIdx = getGlobalButtonIndex(nodeId, idx, bIdx);
    spawnNodeForButton(nodeId, globalIdx, val);
    closeButtonEditor();
  } else {
    // Si es web_url o el mismo tipo, mantener el modal abierto
    openButtonEditor(nodeId, idx, bIdx);
  }
  
  renderBlocksInNode(nodeId); 
};

window.updateBtnUrl = (nodeId, idx, bIdx, val) => { nodeBlocksState[nodeId][idx].buttons[bIdx].url = val; };
window.openButtonEditor = openButtonEditor;
window.closeButtonEditor = closeButtonEditor;

// ─────────────────────────────────────────────
// Inspector: Acción
// ─────────────────────────────────────────────
function renderActionInspector(nodeId) {
  const currentConfig = nodeActionsState[nodeId] || null;
  let selectedCat = 'contact';
  let selectedAction = null;
  
  if (currentConfig) {
    for (const [catKey, cat] of Object.entries(ACTION_CATALOG)) {
      const found = cat.actions.find(a => a.id === currentConfig.type);
      if (found) { selectedCat = catKey; selectedAction = found; break; }
    }
  }

  function _render() {
    document.getElementById('config-title').innerText = 'Inspector de Acción';
    const catTabs = Object.entries(ACTION_CATALOG).map(([key, cat]) =>
      `<div class="cfg-cat-tab ${key === selectedCat ? 'active' : ''}" data-cat="${key}">${cat.label}</div>`
    ).join('');

    const cat = ACTION_CATALOG[selectedCat];
    const actionItems = cat.actions.map(a =>
      `<div class="cfg-action-item ${selectedAction?.id === a.id ? 'active' : ''}" data-action="${a.id}" data-cat="${selectedCat}">
        <span class="cfg-action-icon">${a.icon}</span>
        <div class="cfg-action-info">
          <strong>${a.label}</strong>
          <p>${a.desc}</p>
        </div>
      </div>`
    ).join('');

    let paramsHtml = '';
    if (selectedAction && selectedAction.params.length > 0) {
      const savedParams = (currentConfig?.type === selectedAction.id) ? currentConfig.params : {};
      paramsHtml = `
        <hr style="border:0; border-top:1px solid #e5e7eb; margin:15px 0;">
        <label class="cfg-label">Parámetros</label>
        ${selectedAction.params.map(p => `
          <label class="cfg-label" style="margin-top:10px; font-weight:normal;">${p.label}</label>
          <input class="cfg-input cfg-action-param" data-key="${p.key}" type="text"
            value="${savedParams[p.key] || ''}" placeholder="${p.placeholder || ''}" />
        `).join('')}
      `;
    }

    const saveBtn = selectedAction ? `<button id="cfg-action-save" class="btn-primary" style="width:100%; margin-top:15px; padding:10px;">Aplicar Configuración</button>` : '';

    document.getElementById('config-body').innerHTML = `
      <div class="cfg-cat-tabs">${catTabs}</div>
      <div class="cfg-actions-list">${actionItems}</div>
      ${paramsHtml}
      ${saveBtn}
    `;

    document.querySelectorAll('.cfg-cat-tab').forEach(tab => {
      tab.addEventListener('click', () => { selectedCat = tab.dataset.cat; selectedAction = null; _render(); });
    });
    document.querySelectorAll('.cfg-action-item').forEach(item => {
      item.addEventListener('click', () => {
        selectedCat = item.dataset.cat;
        selectedAction = ACTION_CATALOG[selectedCat].actions.find(a => a.id === item.dataset.action);
        _render();
      });
    });
    document.getElementById('cfg-action-save')?.addEventListener('click', () => {
      if (!selectedAction) return;
      const params = {};
      document.querySelectorAll('.cfg-action-param').forEach(input => { params[input.dataset.key] = input.value.trim(); });
      nodeActionsState[nodeId] = { type: selectedAction.id, params };
      if (editor.drawflow.drawflow.Home.data[nodeId]) {
        editor.drawflow.drawflow.Home.data[nodeId].data._action = JSON.stringify(nodeActionsState[nodeId]);
      }
      renderActionNode(nodeId);
      closeInspector(); // Opcional: auto-cerrar tras guardar
    });
  }
  _render();
}

// ─────────────────────────────────────────────
// Inspector: Pedir Dato (Input)
// ─────────────────────────────────────────────
function renderInputInspector(nodeId) {
  const config = nodeInputState[nodeId] || { type: 'text', field: 'custom_field', prompt: '', retry: '' };
  
  function _render() {
    document.getElementById('config-title').innerText = 'Inspector: Pedir Dato';
    
    document.getElementById('config-body').innerHTML = `
      <label class="cfg-label" style="margin-top:10px;">¿Qué dato vamos a pedir?</label>
      <select id="cfg-input-type" class="cfg-input">
        <option value="text" ${config.type==='text'?'selected':''}>Texto Libre</option>
        <option value="email" ${config.type==='email'?'selected':''}>Correo Electrónico (Email)</option>
        <option value="phone" ${config.type==='phone'?'selected':''}>Teléfono (Números)</option>
        <option value="number" ${config.type==='number'?'selected':''}>Número</option>
        <option value="url" ${config.type==='url'?'selected':''}>URL / Enlace</option>
        <option value="date" ${config.type==='date'?'selected':''}>Fecha</option>
        <option value="choice" ${config.type==='choice'?'selected':''}>Opción Múltiple</option>
      </select>

      ${config.type === 'choice' ? `<label class="cfg-label" style="margin-top:10px;">Opciones válidas (separadas por coma):</label>
      <input id="cfg-input-choices" class="cfg-input" type="text" value="${config.choices || ''}" placeholder="ej: si, no, tal vez" />` : ''}
      
      <label class="cfg-label" style="margin-top:10px;">Guardar respuesta en campo:</label>
      <input id="cfg-input-field" class="cfg-input" type="text" value="${config.field}" placeholder="ej: email, telefono, ciudad" />
      
      <hr style="border:0; border-top:1px solid #e5e7eb; margin:15px 0;">
      
      <label class="cfg-label">Mensaje para pedir el dato:</label>
      <textarea id="cfg-input-prompt" class="cfg-input" style="min-height:60px;" placeholder="Ej: Por favor escribe tu correo...">${config.prompt}</textarea>
      
      <label class="cfg-label" style="margin-top:10px;">Mensaje si el usuario se equivoca (Reintento):</label>
      <textarea id="cfg-input-retry" class="cfg-input" style="min-height:60px;" placeholder="Ej: Ese formato no es válido. Intenta de nuevo...">${config.retry}</textarea>
      
      <button id="cfg-input-save" class="btn-primary" style="width:100%; margin-top:15px; padding:10px;">Aplicar Configuración</button>
    `;

    document.getElementById('cfg-input-save').addEventListener('click', () => {
      const inputState = {
        type: document.getElementById('cfg-input-type').value,
        field: document.getElementById('cfg-input-field').value.trim(),
        prompt: document.getElementById('cfg-input-prompt').value.trim(),
        retry: document.getElementById('cfg-input-retry').value.trim()
      };
      const choicesEl = document.getElementById('cfg-input-choices');
      if (choicesEl) inputState.choices = choicesEl.value.trim();
      nodeInputState[nodeId] = inputState;
      if (editor.drawflow.drawflow.Home.data[nodeId]) {
        editor.drawflow.drawflow.Home.data[nodeId].data._input = JSON.stringify(nodeInputState[nodeId]);
      }
      renderInputNode(nodeId);
      closeInspector();
    });
  }
  _render();
}

// ─────────────────────────────────────────────
// buildStepsFromNode (recursivo - Convertir a formato backend)
// ─────────────────────────────────────────────
function buildStepsFromNode(nodeId, nodes, flowsConfig) {
  let steps = [];
  let currentId = nodeId;

  while (currentId) {
    const node = nodes[currentId];
    if (!node) break;

    if (node.name === 'message') {
      const blocks = nodeBlocksState[currentId] || JSON.parse(node.data._blocks || '[]');
      let btnIndex = 0;

      blocks.forEach(block => {
        if (block.type === 'text') {
          if (!block.buttons || block.buttons.length === 0) {
            steps.push({ type: 'text', message: block.content });
          } else {
            const templateBtns = block.buttons.map(btn => {
              if (btn.type === 'web_url') return { type: 'web_url', title: btn.title, url: btn.url };
              const payload = `POSTBACK_${currentId}_BTN${btnIndex}`;
              const connectedNodeId = node.outputs[`output_${btnIndex + 2}`]?.connections[0]?.node;
              if (connectedNodeId) {
                const hiddenSteps = buildStepsFromNode(connectedNodeId, nodes, flowsConfig);
                if (hiddenSteps.length > 0) flowsConfig.flows.push({ id: `flow_${payload}`, name: `Ruta Botón`, keywords: [payload], matchType: 'contains', steps: hiddenSteps });
              }
              btnIndex++;
              return { type: 'postback', title: btn.title, payload };
            });
            steps.push({ type: 'template', message: block.content, buttons: templateBtns });
          }
        } else if (block.type === 'image') {
          const cardData = { image_url: block.url, title: 'Adjunto', subtitle: '', btn_type: 'postback', btn_title: '', btn_url: '' };
          if (block.buttons && block.buttons.length > 0) {
             const btn = block.buttons[0]; // Card solo soporta 1 botón bien en FB/IG
             cardData.btn_title = btn.title;
             cardData.btn_type = btn.type;
             cardData.btn_url = btn.url;
             if (btn.type === 'postback') {
                const payload = `POSTBACK_${currentId}_BTN${btnIndex}`;
                cardData.btn_payload = payload;
                const connectedNodeId = node.outputs[`output_${btnIndex + 2}`]?.connections[0]?.node;
                if (connectedNodeId) {
                  const hiddenSteps = buildStepsFromNode(connectedNodeId, nodes, flowsConfig);
                  if (hiddenSteps.length > 0) flowsConfig.flows.push({ id: `flow_${payload}`, name: `Ruta Botón`, keywords: [payload], matchType: 'contains', steps: hiddenSteps });
                }
                btnIndex++;
             }
          }
          steps.push({ type: 'card', message: '', card: cardData });
        }
      });
      currentId = node.outputs.output_1?.connections[0]?.node;
    }
    else if (node.name === 'card') {
      // Legacy support
      const cardData = { image_url: node.data.image_url||'', title: node.data.title||'', subtitle: node.data.subtitle||'', btn_title: node.data.btn_title||'', btn_type: node.data.btn_type, btn_url: node.data.btn_url||'' };
      if (cardData.btn_type === 'postback') {
        const payload = `POSTBACK_${currentId}_CARD`;
        cardData.btn_payload = payload;
        const connectedNodeId = node.outputs.output_1?.connections[0]?.node;
        if (connectedNodeId) {
          const hiddenSteps = buildStepsFromNode(connectedNodeId, nodes, flowsConfig);
          if (hiddenSteps.length > 0) flowsConfig.flows.push({ id: `flow_${payload}`, name: `Ruta Tarjeta`, keywords: [payload], matchType: 'contains', steps: hiddenSteps });
        }
      }
      steps.push({ type: 'card', message: '', card: cardData });
      currentId = null;
    }
    else if (node.name === 'action') {
      const config = nodeActionsState[currentId] || JSON.parse(node.data._action || 'null');
      if (config) steps.push({ type: 'action', actionType: config.type, params: config.params });
      currentId = node.outputs.output_1?.connections[0]?.node;
    }
    else if (node.name === 'input') {
      const config = nodeInputState[currentId] || JSON.parse(node.data._input || 'null');
      if (config) {
        const step = {
          type: 'input',
          inputType: config.type,
          field: config.field,
          prompt: config.prompt,
          retryMessage: config.retry
        };
        // Salida 1: Éxito
        const successNodeId = node.outputs.output_1?.connections[0]?.node;
        if (successNodeId) {
          const payloadSuccess = `INPUT_${currentId}_SUCCESS`;
          step.successPayload = payloadSuccess;
          const successSteps = buildStepsFromNode(successNodeId, nodes, flowsConfig);
          if (successSteps.length > 0) flowsConfig.flows.push({ id: `flow_${payloadSuccess}`, name: `Ruta Input Exito`, keywords: [payloadSuccess], matchType: 'contains', steps: successSteps });
        }
        
        // Salida 2: Fallo
        const failNodeId = node.outputs.output_2?.connections[0]?.node;
        if (failNodeId) {
          const payloadFail = `INPUT_${currentId}_FAIL`;
          step.failPayload = payloadFail;
          const failSteps = buildStepsFromNode(failNodeId, nodes, flowsConfig);
          if (failSteps.length > 0) flowsConfig.flows.push({ id: `flow_${payloadFail}`, name: `Ruta Input Fallo`, keywords: [payloadFail], matchType: 'contains', steps: failSteps });
        }
        
        steps.push(step);
      }
      currentId = null; // Detenemos la travesía lineal principal porque el Input genera flujos desvinculados basados en los outputs (como los botones)
    }
    else if (node.name === 'carousel') {
      const conf = nodeCarouselState[currentId] || JSON.parse(node.data._carousel || '{}');
      if (conf && conf.elements && conf.elements.length > 0) {
        steps.push({ type: 'carousel', elements: conf.elements });
      }
      currentId = node.outputs.output_1?.connections[0]?.node;
    }
    else if (node.name === 'gallery') {
      const conf = nodeGalleryState[currentId] || JSON.parse(node.data._gallery || '{}');
      if (conf && conf.images && conf.images.length > 0) {
        steps.push({ type: 'gallery', images: conf.images, delay_between_ms: conf.delay_between_ms || 300 });
      }
      currentId = node.outputs.output_1?.connections[0]?.node;
    }
    else if (node.name === 'audio') {
      const conf = nodeAudioState[currentId] || JSON.parse(node.data._audio || '{}');
      if (conf && conf.audio_url) steps.push({ type: 'audio', audio_url: conf.audio_url });
      currentId = node.outputs.output_1?.connections[0]?.node;
    }
    else if (node.name === 'video') {
      const conf = nodeVideoState[currentId] || JSON.parse(node.data._video || '{}');
      if (conf && conf.video_url) steps.push({ type: 'video', video_url: conf.video_url });
      currentId = node.outputs.output_1?.connections[0]?.node;
    }
    else if (node.name === 'file') {
      const conf = nodeFileState[currentId] || JSON.parse(node.data._file || '{}');
      if (conf && conf.file_url) steps.push({ type: 'file', file_url: conf.file_url });
      currentId = node.outputs.output_1?.connections[0]?.node;
    }
    else if (node.name === 'delay') {
      const conf = nodeDelayState[currentId] || JSON.parse(node.data._delay || '{}');
      steps.push({ type: 'delay', seconds: conf.seconds || 5 });
      currentId = node.outputs.output_1?.connections[0]?.node;
    }
    else if (node.name === 'goto') {
      const conf = nodeGotoState[currentId] || JSON.parse(node.data._goto || '{}');
      if (conf.flow_id) steps.push({ type: 'goto', flow_id: conf.flow_id });
      currentId = null;
    }
    else if (node.name === 'ai_agent') {
      // Fase 1 Fix: el nodo Agente IA ahora se exporta correctamente.
      // El agente toma el control de la conversación → no hay nodo siguiente (break).
      const aiState = nodeAiAgentState[currentId] || JSON.parse(node.data._ai || '{}');
      steps.push({
        type: 'ai_agent',
        system_prompt: aiState.system_prompt || '',
        ignore_master_context: aiState.ignore_master_context || false
      });
      currentId = null; // El agente IA es un nodo terminal — no hay continuación lineal
    }
    else {
      break; // Trigger o nodo final
    }
  }
  return steps;
}

// ─────────────────────────────────────────────
// Guardar y Exportar
// ─────────────────────────────────────────────
document.getElementById('btn-save').addEventListener('click', async () => {
  // Sincronizar estado de bloques y acciones con Drawflow
  syncAllNodeStateToDrawflow();

  // Validación pre-guardado (no bloquea el guardado, solo avisa)
  const validationIssues = validateFlow();
  applyValidationBadges(validationIssues);
  if (validationIssues.length > 0 && typeof Toast !== 'undefined') {
    Toast.warning(`${validationIssues.length} nodo${validationIssues.length === 1 ? '' : 's'} incompleto${validationIssues.length === 1 ? '' : 's'}`, {
      detail: 'Se guardó igual, pero revisa los nodos marcados con ⚠️ — puede que el flujo no funcione como esperas.'
    });
  }

  const data = editor.export();
  const nodes = data.drawflow.Home.data;
  const flowsConfig = { flows: [], defaultFlow: null };

  for (const nodeId in nodes) {
    const node = nodes[nodeId];
    if (node.name === 'trigger') {
      const keywordsRaw = node.data.keywords || '';
      const keywordsList = keywordsRaw.split(',').map(k => k.trim()).filter(k => k);
      const matchType = node.data.matchType || 'contains';
      const flowId = node.data._flowId || currentLoadedFlowId || `flow_${nodeId}`;
      const triggerType = node.data.triggerType || (keywordsList.length ? 'message' : null);
      const commentKeyword = (node.data.commentKeyword || '').trim();
      const newFlow = { id: flowId, name: node.data.flowName || `Flujo Visual ${nodeId}`, keywords: keywordsList, matchType, steps: [] };
      if (triggerType) newFlow.triggerType = triggerType;
      if (commentKeyword) newFlow.commentKeyword = commentKeyword;
      const nextNodeId = node.outputs.output_1?.connections[0]?.node;
      if (nextNodeId) newFlow.steps = buildStepsFromNode(nextNodeId, nodes, flowsConfig);

      // Eliminada la restricción de keywords. Siempre guardamos el flujo,
      // permitiendo flujos en borrador o subflujos invocados por otros medios.
      flowsConfig.flows.push(newFlow);
    }
  }

  // Ensure there's something to save
  if (flowsConfig.flows.length === 0) {
      if (typeof Toast !== 'undefined') Toast.warning('No se encontraron flujos válidos para guardar.');
      // return; // Let it save empty to allow deleting all flows if desired? Actually no, this is bulk save.
  }

  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.innerText = "Guardando...";
  try {
    const res = await fetch('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(flowsConfig)
    });
    if (res.ok) {
      btn.innerText = "✓ Guardado";
      btn.style.background = '#16a34a';
      markSaved();
      setTimeout(() => {
        btn.innerText = "Guardar Cambios";
        btn.style.background = '';
        btn.disabled = false;
      }, 2000);
    } else {
      btn.innerText = "Error al guardar";
      btn.style.background = '#dc2626';
      setTimeout(() => { btn.innerText = "Guardar Cambios"; btn.style.background = ''; btn.disabled = false; }, 2500);
    }
  } catch(e) {
    btn.innerText = "Sin conexión";
    btn.style.background = '#dc2626';
    setTimeout(() => { btn.innerText = "Guardar Cambios"; btn.style.background = ''; btn.disabled = false; }, 2500);
  }
});

// ─────────────────────────────────────────────
// Header: nombre editable + estado + publicar
// ─────────────────────────────────────────────
let currentFlowEnabled = false;

function updateFlowHeader(flow) {
  const center = document.getElementById('flow-header-center');
  const nameDisplay = document.getElementById('flow-name-display');
  const nameInput = document.getElementById('flow-name-input');
  const chip = document.getElementById('flow-status-chip');
  const btnPublish = document.getElementById('btn-publish');
  if (!center) return;

  currentFlowEnabled = flow.enabled !== false;
  center.style.display = 'flex';

  nameDisplay.textContent = flow.name || currentLoadedFlowId;
  nameInput.value = flow.name || '';

  refreshStatusChip(chip, btnPublish);

  // Edición inline del nombre
  nameDisplay.onclick = () => {
    nameDisplay.style.display = 'none';
    nameInput.style.display = 'block';
    nameInput.focus();
    nameInput.select();
  };

  nameInput.onblur = () => commitFlowName(nameDisplay, nameInput);
  nameInput.onkeydown = e => {
    if (e.key === 'Enter') nameInput.blur();
    if (e.key === 'Escape') { nameInput.value = nameDisplay.textContent; nameInput.blur(); }
  };
}

function commitFlowName(nameDisplay, nameInput) {
  const previousName = nameDisplay.textContent;
  const newName = nameInput.value.trim() || previousName;
  nameDisplay.textContent = newName;
  nameInput.style.display = 'none';
  nameDisplay.style.display = '';

  // Actualizar el nodo trigger con el nuevo nombre
  const nodes = editor.drawflow.drawflow.Home.data;
  for (const nid in nodes) {
    if (nodes[nid].name === 'trigger') {
      nodes[nid].data.flowName = newName;
      break;
    }
  }

  // Persistir el rename inmediatamente vía PATCH (no depende del botón Guardar).
  // Sin esto, un flujo sin keywords no se enviaba en el POST y el rename se perdía.
  if (currentLoadedFlowId && newName !== previousName) {
    fetch(`/api/flows/${encodeURIComponent(currentLoadedFlowId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ name: newName })
    }).then(res => {
      if (res.ok) {
        if (typeof Toast !== 'undefined') Toast.success('Nombre actualizado', { duration: 1800 });
      } else {
        if (typeof Toast !== 'undefined') Toast.error('No se pudo actualizar el nombre');
        nameDisplay.textContent = previousName;
      }
    }).catch(() => {
      if (typeof Toast !== 'undefined') Toast.error('Sin conexión: nombre no guardado');
      nameDisplay.textContent = previousName;
    });
  }
}

function refreshStatusChip(chip, btnPublish) {
  if (!chip) return;
  if (currentFlowEnabled) {
    chip.textContent = '● En Vivo';
    chip.className = 'flow-status-chip live';
    if (btnPublish) {
      btnPublish.textContent = 'Pausar';
      btnPublish.className = 'btn-publish live-state';
      btnPublish.style.display = '';
    }
  } else {
    chip.textContent = '○ Borrador';
    chip.className = 'flow-status-chip draft';
    if (btnPublish) {
      btnPublish.textContent = '▶ Publicar';
      btnPublish.className = 'btn-publish';
      btnPublish.style.display = '';
    }
  }
}

// Botón Publicar / Pausar
document.getElementById('btn-publish')?.addEventListener('click', async () => {
  if (!currentLoadedFlowId) return;
  const btn = document.getElementById('btn-publish');
  const wasEnabled = currentFlowEnabled;

  // No permitir activar un flujo con nodos incompletos
  if (!wasEnabled) {
    syncAllNodeStateToDrawflow();
    const issues = validateFlow();
    applyValidationBadges(issues);
    if (issues.length > 0) {
      if (typeof Toast !== 'undefined') {
        Toast.error(`No se puede publicar: ${issues.length} nodo${issues.length === 1 ? '' : 's'} incompleto${issues.length === 1 ? '' : 's'}`, {
          detail: 'Revisa los nodos marcados con ⚠️ en el lienzo antes de publicar.'
        });
      }
      return;
    }
  }

  btn.disabled = true;
  btn.textContent = wasEnabled ? 'Pausando...' : 'Publicando...';

  const res = await fetch(`/api/flows/${encodeURIComponent(currentLoadedFlowId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: !wasEnabled })
  });

  if (res.ok) {
    currentFlowEnabled = !wasEnabled;
    refreshStatusChip(
      document.getElementById('flow-status-chip'),
      document.getElementById('btn-publish')
    );
  }
  btn.disabled = false;
});

// ─────────────────────────────────────────────
// Cargar flujo desde backend (reverse converter)
// ─────────────────────────────────────────────
function createMessageNodeFromStep(posX, posY, step) {
  const tempHtml = `<div class="mc-node mc-content"><div class="mc-header"><span>💬</span> Send Message</div><div class="box node-blocks-container"></div></div>`;
  const nodeId = editor.addNode('message', 1, 10, posX, posY, 'message', { _blocks: '[]' }, tempHtml);

  if (step.type === 'text') {
    nodeBlocksState[nodeId] = [{ id: generateId(), type: 'text', content: step.message || '', buttons: [] }];
  } else if (step.type === 'template') {
    const buttons = (step.buttons || []).map(btn => ({
      title: btn.title || '',
      type: btn.type === 'web_url' ? 'web_url' : 'postback',
      url: btn.url || ''
    }));
    nodeBlocksState[nodeId] = [{ id: generateId(), type: 'text', content: step.message || '', buttons }];
  } else if (step.type === 'card') {
    const blocks = [{ id: generateId(), type: 'image', content: '', url: step.card?.image_url || '', buttons: [] }];
    if (step.card?.btn_title) {
      blocks[0].buttons.push({
        title: step.card.btn_title,
        type: step.card.btn_type === 'web_url' ? 'web_url' : 'postback',
        url: step.card.btn_url || ''
      });
    }
    nodeBlocksState[nodeId] = blocks;
  }

  return nodeId;
}

async function loadFlowIntoBuilder(flowId) {
  try {
    const res = await fetch(`/api/flows/${encodeURIComponent(flowId)}`);
    if (!res.ok) return false;
    const flow = await res.json();

    currentLoadedFlowId = flowId;
    updateFlowHeader(flow);

    editor.clear();

    const triggerData = {
      keywords: (flow.keywords || []).join(', '),
      matchType: flow.matchType || 'contains',
      flowName: flow.name || '',
      _flowId: flowId,
      triggerType: flow.triggerType || (flow.keywords?.length ? 'message' : null)
    };
    const triggerId = editor.addNode('trigger', 0, 1, 100, 200, 'trigger', triggerData, htmlTrigger);

    let prevNodeId = triggerId;
    let prevOutput = 'output_1';
    const steps = flow.steps || [];
    const createdNodeIds = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const posX = 100 + (i + 1) * 350;
      const posY = 200;
      let nodeId = null;

      if (step.type === 'text' || step.type === 'template' || step.type === 'card') {
        nodeId = createMessageNodeFromStep(posX, posY, step);
      } else if (step.type === 'delay') {
        nodeId = editor.addNode('delay', 1, 1, posX, posY, 'delay', { _delay: JSON.stringify({ seconds: step.seconds || 5 }) }, htmlDelay);
        nodeDelayState[nodeId] = { seconds: step.seconds || 5 };
      } else if (step.type === 'carousel') {
        nodeId = editor.addNode('carousel', 1, 1, posX, posY, 'carousel', { _carousel: JSON.stringify({ elements: step.elements || [] }) }, htmlCarousel);
        nodeCarouselState[nodeId] = { elements: step.elements || [] };
      } else if (step.type === 'gallery') {
        nodeId = editor.addNode('gallery', 1, 1, posX, posY, 'gallery', { _gallery: JSON.stringify({ images: step.images || [], delay_between_ms: step.delay_between_ms || 300 }) }, htmlGallery);
        nodeGalleryState[nodeId] = { images: step.images || [], delay_between_ms: step.delay_between_ms || 300 };
      } else if (step.type === 'audio') {
        nodeId = editor.addNode('audio', 1, 1, posX, posY, 'audio', { _audio: JSON.stringify({ audio_url: step.audio_url || '' }) }, htmlAudio);
        nodeAudioState[nodeId] = { audio_url: step.audio_url || '' };
      } else if (step.type === 'video') {
        nodeId = editor.addNode('video', 1, 1, posX, posY, 'video', { _video: JSON.stringify({ video_url: step.video_url || '' }) }, htmlVideo);
        nodeVideoState[nodeId] = { video_url: step.video_url || '' };
      } else if (step.type === 'file') {
        nodeId = editor.addNode('file', 1, 1, posX, posY, 'file', { _file: JSON.stringify({ file_url: step.file_url || '' }) }, htmlFile);
        nodeFileState[nodeId] = { file_url: step.file_url || '' };
      } else if (step.type === 'action') {
        const actionConf = { type: step.actionType, params: step.params || {} };
        nodeId = editor.addNode('action', 1, 1, posX, posY, 'action', { _action: JSON.stringify(actionConf) }, htmlAction);
        nodeActionsState[nodeId] = actionConf;
      } else if (step.type === 'input') {
        const inputConf = { type: step.inputType || 'text', field: step.field || '', prompt: step.prompt || '', retry: step.retryMessage || '' };
        nodeId = editor.addNode('input', 1, 2, posX, posY, 'input', { _input: JSON.stringify(inputConf) }, htmlInput);
        nodeInputState[nodeId] = inputConf;
      } else if (step.type === 'goto') {
        nodeId = editor.addNode('goto', 1, 0, posX, posY, 'goto', { _goto: JSON.stringify({ flow_id: step.flow_id || '' }) }, htmlGoto);
        nodeGotoState[nodeId] = { flow_id: step.flow_id || '' };
      } else if (step.type === 'ai_agent') {
        const aiConf = { system_prompt: step.system_prompt || '', ignore_master_context: step.ignore_master_context || false };
        nodeId = editor.addNode('ai_agent', 1, 1, posX, posY, 'ai_agent', { _ai: JSON.stringify(aiConf) }, htmlAiAgent);
        nodeAiAgentState[nodeId] = aiConf;
      }

      if (nodeId) {
        createdNodeIds.push(nodeId);
        if (prevNodeId) {
          editor.addConnection(prevNodeId, nodeId, prevOutput, 'input_1');
        }
        prevNodeId = nodeId;
        prevOutput = 'output_1';
      }
    }

    setTimeout(() => {
      renderTriggerNode(triggerId);
      createdNodeIds.forEach(nid => {
        const node = editor.getNodeFromId(nid);
        if (!node) return;
        if (node.name === 'message') renderBlocksInNode(nid);
        else if (node.name === 'delay') renderDelayNode(nid);
        else if (node.name === 'carousel') renderCarouselNode(nid);
        else if (node.name === 'gallery') renderGalleryNode(nid);
        else if (node.name === 'audio') renderAudioNode(nid);
        else if (node.name === 'video') renderVideoNode(nid);
        else if (node.name === 'file') renderFileNode(nid);
        else if (node.name === 'action') renderActionNode(nid);
        else if (node.name === 'input') renderInputNode(nid);
        else if (node.name === 'goto') renderGotoNode(nid);
        else if (node.name === 'ai_agent') renderAiAgentNode(nid);
      });

      // Auto-layout with Dagre
      if (typeof dagre !== 'undefined' && createdNodeIds.length > 0) {
        setTimeout(() => {
          document.getElementById('btn-arrange').click();
        }, 200);
      }
    }, 100);

    return true;
  } catch (err) {
    console.error('Error loading flow:', err);
    return false;
  }
}

// ─────────────────────────────────────────────
// Carga Inicial
// ─────────────────────────────────────────────
setTimeout(async () => {
  const params = new URLSearchParams(window.location.search);
  const flowId = params.get('flowId');

  if (flowId) {
    const loaded = await loadFlowIntoBuilder(flowId);
    if (!loaded) {
      console.warn('Could not load flow:', flowId);
    }
  } else if (Object.keys(editor.drawflow.drawflow.Home.data).length === 0) {
    editor.addNode('trigger', 0, 1, 100, 200, 'trigger', { keywords: 'precio, valor' }, htmlTrigger);
    const msgId = addMessageNode(450, 200);
    setTimeout(() => {
      editor.addConnection(1, msgId, 'output_1', 'input_1');
      if (nodeBlocksState[msgId]) {
        nodeBlocksState[msgId][0].content = '¡Hola! Nuestros faroles rústicos comienzan en $150.';
        renderBlocksInNode(msgId);
      }
    }, 100);
  } else {
    rehydrateAllNodeVisuals();
  }

  // Post-carga: inicializar Undo/Redo, validación y estado vacío del canvas
  setTimeout(() => {
    UndoRedo.init();
    applyValidationBadges(validateFlow());
    updateEmptyCanvasHint();
    markSaved();
  }, 250);
}, 150);

// ─────────────────────────────────────────────
// Indicador de cambios sin guardar
// ─────────────────────────────────────────────
let hasUnsavedChanges = false;

function markDirty() {
  hasUnsavedChanges = true;
  const ind = document.getElementById('unsaved-indicator');
  if (ind) ind.style.display = '';
}

function markSaved() {
  hasUnsavedChanges = false;
  const ind = document.getElementById('unsaved-indicator');
  if (ind) ind.style.display = 'none';
}

window.addEventListener('beforeunload', function (e) {
  if (!hasUnsavedChanges) return;
  e.preventDefault();
  e.returnValue = '';
});

// ─────────────────────────────────────────────
// Validación pre-guardado
// ─────────────────────────────────────────────
function validateFlow() {
  const issues = [];
  const data = editor.drawflow.drawflow.Home.data;

  for (const nodeId in data) {
    const node = data[nodeId];
    if (!node) continue;
    const d = node.data || {};

    switch (node.name) {
      case 'trigger': {
        const triggerType = d.triggerType || 'message';
        if (triggerType === 'comment') {
          if (!d.commentKeyword || !d.commentKeyword.trim()) {
            issues.push({ nodeId, type: 'trigger', message: 'Falta la palabra clave del comentario.' });
          }
        } else if (!d.keywords || !d.keywords.trim()) {
          issues.push({ nodeId, type: 'trigger', message: 'Falta configurar la palabra clave del disparador.' });
        }
        break;
      }
      case 'message': {
        const blocks = nodeBlocksState[nodeId];
        if (!blocks || blocks.length === 0) {
          issues.push({ nodeId, type: 'message', message: 'El mensaje no tiene contenido.' });
        } else if (blocks.every(b => b.type === 'text' ? !(b.content || '').trim() : !b.url)) {
          issues.push({ nodeId, type: 'message', message: 'El mensaje está vacío.' });
        }
        break;
      }
      case 'input': {
        const conf = nodeInputState[nodeId];
        if (!conf || !(conf.field || '').trim() || !(conf.prompt || '').trim()) {
          issues.push({ nodeId, type: 'input', message: 'Falta el campo o la pregunta a mostrar.' });
        }
        break;
      }
      case 'condition': {
        const conf = nodeConditionState[nodeId];
        if (!conf || !(conf.field || '').trim()) {
          issues.push({ nodeId, type: 'condition', message: 'Falta configurar la condición.' });
        }
        break;
      }
      case 'action': {
        const conf = nodeActionsState[nodeId];
        if (!conf || !conf.type) {
          issues.push({ nodeId, type: 'action', message: 'No se eligió ninguna acción.' });
        }
        break;
      }
      case 'carousel': {
        const conf = nodeCarouselState[nodeId];
        if (!conf || !conf.elements || conf.elements.length === 0 || conf.elements.every(el => !(el.title || '').trim())) {
          issues.push({ nodeId, type: 'carousel', message: 'El carrusel no tiene elementos con título.' });
        }
        break;
      }
      case 'gallery': {
        const conf = nodeGalleryState[nodeId];
        if (!conf || !conf.images || conf.images.length === 0 || conf.images.every(img => !img.url)) {
          issues.push({ nodeId, type: 'gallery', message: 'La galería no tiene imágenes.' });
        }
        break;
      }
      case 'audio': {
        const conf = nodeAudioState[nodeId];
        if (!conf || !conf.audio_url) issues.push({ nodeId, type: 'audio', message: 'Falta el archivo de audio.' });
        break;
      }
      case 'video': {
        const conf = nodeVideoState[nodeId];
        if (!conf || !conf.video_url) issues.push({ nodeId, type: 'video', message: 'Falta el archivo de video.' });
        break;
      }
      case 'file': {
        const conf = nodeFileState[nodeId];
        if (!conf || !conf.file_url) issues.push({ nodeId, type: 'file', message: 'Falta el archivo adjunto.' });
        break;
      }
      case 'delay': {
        const conf = nodeDelayState[nodeId];
        if (!conf || !conf.seconds || conf.seconds <= 0) issues.push({ nodeId, type: 'delay', message: 'El tiempo de espera debe ser mayor a 0.' });
        break;
      }
      case 'goto': {
        const conf = nodeGotoState[nodeId];
        if (!conf || !(conf.flow_id || '').trim()) issues.push({ nodeId, type: 'goto', message: 'Falta elegir el flujo destino.' });
        break;
      }
      case 'ai_agent': {
        const conf = nodeAiAgentState[nodeId];
        if (!conf || !(conf.system_prompt || '').trim()) issues.push({ nodeId, type: 'ai_agent', message: 'Falta el prompt del agente IA.' });
        break;
      }
      default:
        break;
    }
  }

  return issues;
}

function applyValidationBadges(issues) {
  document.querySelectorAll('.node-validation-badge').forEach(el => el.remove());
  document.querySelectorAll('.drawflow-node.has-validation-error').forEach(el => el.classList.remove('has-validation-error'));

  issues.forEach(issue => {
    const nodeEl = document.getElementById('node-' + issue.nodeId);
    if (!nodeEl) return;
    nodeEl.classList.add('has-validation-error');
    const badge = document.createElement('div');
    badge.className = 'node-validation-badge';
    badge.textContent = '!';
    badge.title = issue.message;
    nodeEl.appendChild(badge);
  });
}

// ─────────────────────────────────────────────
// Hint de descubribilidad: cómo agregar nodos
// ─────────────────────────────────────────────
function updateEmptyCanvasHint() {
  const empty = Object.keys(editor.drawflow.drawflow.Home.data).length === 0;
  const el = document.getElementById('canvas-empty-hint');
  if (el) el.classList.toggle('visible', empty);
}

(function initCanvasHint() {
  const HINT_KEY = 'fg_builder_ctx_hint_dismissed';
  const hint = document.getElementById('canvas-hint');
  const closeBtn = document.getElementById('canvas-hint-close');
  if (!hint) return;
  try {
    if (localStorage.getItem(HINT_KEY) === '1') hint.classList.add('hidden');
  } catch (e) {}
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      hint.classList.add('hidden');
      try { localStorage.setItem(HINT_KEY, '1'); } catch (e) {}
    });
  }
})();

// ─────────────────────────────────────────────
// Undo / Redo — historial de snapshots del flujo
// ─────────────────────────────────────────────
const UndoRedo = (function () {
  const MAX_HISTORY = 50;
  let history = [];
  let pointer = -1;
  let restoring = false;
  let debounceTimer = null;

  function snapshotNow() {
    syncAllNodeStateToDrawflow();
    return JSON.stringify(editor.export());
  }

  function updateButtons() {
    const undoBtn = document.getElementById('canvas-undo');
    const redoBtn = document.getElementById('canvas-redo');
    if (undoBtn) undoBtn.disabled = pointer <= 0;
    if (redoBtn) redoBtn.disabled = pointer >= history.length - 1;
  }

  function pushSnapshot() {
    if (restoring) return;
    const snap = snapshotNow();
    if (history[pointer] === snap) return; // sin cambios reales, evita ruido en el historial
    history = history.slice(0, pointer + 1);
    history.push(snap);
    if (history.length > MAX_HISTORY) history.shift();
    pointer = history.length - 1;
    updateButtons();
  }

  function scheduleSnapshot() {
    if (restoring) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(pushSnapshot, 500);
  }

  function restore(snap) {
    restoring = true;
    try {
      closeInspector();
      editor.import(JSON.parse(snap), false);
      rehydrateAllNodeVisuals();
      applyValidationBadges(validateFlow());
      updateEmptyCanvasHint();
      markDirty();
    } finally {
      restoring = false;
    }
    updateButtons();
  }

  function undo() {
    clearTimeout(debounceTimer);
    pushSnapshot();
    if (pointer <= 0) return;
    pointer--;
    restore(history[pointer]);
  }

  function redo() {
    if (pointer >= history.length - 1) return;
    pointer++;
    restore(history[pointer]);
  }

  return {
    init: function () {
      history = [snapshotNow()];
      pointer = 0;
      updateButtons();
    },
    schedule: scheduleSnapshot,
    undo,
    redo
  };
})();

document.getElementById('canvas-undo').addEventListener('click', () => UndoRedo.undo());
document.getElementById('canvas-redo').addEventListener('click', () => UndoRedo.redo());

document.addEventListener('keydown', function (e) {
  const tag = (e.target && e.target.tagName) || '';
  const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);
  if (!(e.ctrlKey || e.metaKey) || isEditable) return;

  if (e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    UndoRedo.undo();
  } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
    e.preventDefault();
    UndoRedo.redo();
  }
});

// Enganchar cambios del lienzo (crear/borrar nodo, conexiones, mover) al historial
editor.on('nodeCreated', function () {
  markDirty();
  UndoRedo.schedule();
  updateEmptyCanvasHint();
  setTimeout(() => applyValidationBadges(validateFlow()), 60);
});
editor.on('nodeRemoved', function () {
  markDirty();
  UndoRedo.schedule();
  updateEmptyCanvasHint();
  setTimeout(() => applyValidationBadges(validateFlow()), 60);
});
editor.on('nodeMoved', function () {
  markDirty();
  UndoRedo.schedule();
});
editor.on('connectionCreated', function () {
  markDirty();
  UndoRedo.schedule();
});
editor.on('connectionRemoved', function () {
  markDirty();
  UndoRedo.schedule();
});

// Enganchar ediciones dentro del panel de configuración (inputs, selects, botones)
document.addEventListener('input', function (e) {
  if (e.target.closest('#config-panel') || e.target.closest('#drawflow')) {
    markDirty();
    UndoRedo.schedule();
  }
});
document.addEventListener('change', function (e) {
  if (e.target.closest('#config-panel') || e.target.closest('#drawflow')) {
    markDirty();
    UndoRedo.schedule();
  }
});
document.addEventListener('click', function (e) {
  if (e.target.closest('#config-panel') || e.target.closest('#trigger-picker-overlay') || e.target.closest('.ctx-item') || e.target.closest('#ai-generate-modal')) {
    markDirty();
    UndoRedo.schedule();
  }
});

// ─────────────────────────────────────────────
// Pilar 1: Auto-Organizar (Dagre.js)
// ─────────────────────────────────────────────
document.getElementById('btn-arrange').addEventListener('click', () => {
  if (typeof dagre === 'undefined') {
    alert('Dagre.js no está cargado.');
    return;
  }
  
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', align: 'UL', marginx: 50, marginy: 50, nodesep: 80, ranksep: 200 });
  g.setDefaultEdgeLabel(() => ({}));

  const nodes = editor.drawflow.drawflow.Home.data;
  const nodeKeys = Object.keys(nodes);
  if (nodeKeys.length === 0) return;

  for (const id of nodeKeys) {
    const el = document.getElementById('node-' + id);
    const width = el ? el.offsetWidth : 300;
    const height = el ? el.offsetHeight : 200;
    g.setNode(id, { width, height });
  }

  for (const id of nodeKeys) {
    const node = nodes[id];
    for (const outputKey in node.outputs) {
      const connections = node.outputs[outputKey].connections;
      for (const conn of connections) {
        g.setEdge(id, conn.node);
      }
    }
  }

  dagre.layout(g);

  g.nodes().forEach(v => {
    const nodeInfo = g.node(v);
    const dfNode = nodes[v];
    if (dfNode) {
      const x = nodeInfo.x - (nodeInfo.width / 2);
      const y = nodeInfo.y - (nodeInfo.height / 2);
      
      dfNode.pos_x = x;
      dfNode.pos_y = y;
      
      const el = document.getElementById('node-' + v);
      if (el) {
        el.style.top = y + 'px';
        el.style.left = x + 'px';
      }
      editor.updateConnectionNodes('node-' + v);
    }
  });
});

// ─────────────────────────────────────────────
// Pilar 1: Menú Contextual (Doble Clic)
// ─────────────────────────────────────────────
const ctxMenu = document.getElementById('context-menu');
let ctxMousePos = { x: 0, y: 0 };

id.addEventListener('contextmenu', e => {
  if (e.target.closest('.drawflow-node')) return;
  e.preventDefault();

  const rect = id.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  ctxMousePos.x = x * (editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)) - (editor.precanvas.getBoundingClientRect().x * (editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)));
  ctxMousePos.y = y * (editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)) - (editor.precanvas.getBoundingClientRect().y * (editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)));

  ctxMenu.style.left = e.clientX + 'px';
  ctxMenu.style.top = e.clientY + 'px';
  ctxMenu.classList.remove('ctx-hidden');
});

document.addEventListener('click', e => {
  if (!e.target.closest('#context-menu') && !e.target.closest('#drawflow')) {
    ctxMenu.classList.add('ctx-hidden');
  }
});
id.addEventListener('click', e => {
  if (!e.target.closest('.ctx-item')) {
    ctxMenu.classList.add('ctx-hidden');
  }
});

document.querySelectorAll('.ctx-item').forEach(item => {
  item.addEventListener('click', e => {
    const type = e.currentTarget.getAttribute('data-type');
    const posX = ctxMousePos.x;
    const posY = ctxMousePos.y;

    if (type === 'trigger') {
      editor.addNode('trigger', 0, 1, posX, posY, 'trigger', { keywords: '' }, htmlTrigger);
    } else if (type === 'message') {
      addMessageNode(posX, posY);
    } else if (type === 'action') {
      const nodeId = editor.addNode('action', 1, 1, posX, posY, 'action', { _action: '{}' }, htmlAction);
      nodeActionsState[nodeId] = null;
      setTimeout(() => renderActionNode(nodeId), 50);
    } else if (type === 'input') {
      const nodeId = editor.addNode('input', 1, 2, posX, posY, 'input', { _input: '{}' }, htmlInput);
      nodeInputState[nodeId] = { type: 'email', field: 'email', prompt: 'Por favor ingresa tu email:', retry: 'Ese correo no es válido. Intenta de nuevo:' };
      setTimeout(() => renderInputNode(nodeId), 50);
    } else if (type === 'condition') {
      const nodeId = editor.addNode('condition', 1, 2, posX, posY, 'condition', { _condition: '{}' }, htmlCondition);
      nodeConditionState[nodeId] = { field: 'email', operator: 'contains', value: '@' };
      setTimeout(() => renderConditionNode(nodeId), 50);
    } else if (type === 'randomizer') {
      const nodeId = editor.addNode('randomizer', 1, 2, posX, posY, 'randomizer', { _randomizer: '{}' }, htmlRandomizer);
      nodeRandomizerState[nodeId] = { paths: 2 };
      setTimeout(() => renderRandomizerNode(nodeId), 50);
    } else if (type === 'carousel') {
      const nodeId = editor.addNode('carousel', 1, 1, posX, posY, 'carousel', { _carousel: '{}' }, htmlCarousel);
      nodeCarouselState[nodeId] = { elements: [] };
      setTimeout(() => renderCarouselNode(nodeId), 50);
    } else if (type === 'gallery') {
      const nodeId = editor.addNode('gallery', 1, 1, posX, posY, 'gallery', { _gallery: '{}' }, htmlGallery);
      nodeGalleryState[nodeId] = { images: [], delay_between_ms: 300 };
      setTimeout(() => renderGalleryNode(nodeId), 50);
    } else if (type === 'audio') {
      const nodeId = editor.addNode('audio', 1, 1, posX, posY, 'audio', { _audio: '{}' }, htmlAudio);
      nodeAudioState[nodeId] = { audio_url: '' };
      setTimeout(() => renderAudioNode(nodeId), 50);
    } else if (type === 'video') {
      const nodeId = editor.addNode('video', 1, 1, posX, posY, 'video', { _video: '{}' }, htmlVideo);
      nodeVideoState[nodeId] = { video_url: '' };
      setTimeout(() => renderVideoNode(nodeId), 50);
    } else if (type === 'file') {
      const nodeId = editor.addNode('file', 1, 1, posX, posY, 'file', { _file: '{}' }, htmlFile);
      nodeFileState[nodeId] = { file_url: '' };
      setTimeout(() => renderFileNode(nodeId), 50);
    } else if (type === 'delay') {
      const nodeId = editor.addNode('delay', 1, 1, posX, posY, 'delay', { _delay: '{}' }, htmlDelay);
      nodeDelayState[nodeId] = { seconds: 5 };
      setTimeout(() => renderDelayNode(nodeId), 50);
    } else if (type === 'goto') {
      const nodeId = editor.addNode('goto', 1, 0, posX, posY, 'goto', { _goto: '{}' }, htmlGoto);
      nodeGotoState[nodeId] = { flow_id: '' };
      setTimeout(() => renderGotoNode(nodeId), 50);
    }

    ctxMenu.classList.add('ctx-hidden');
  });
});

// Render Condition
function renderConditionNode(nodeId) {
  const nodeEl = document.getElementById('node-' + nodeId);
  if (!nodeEl) return;
  const container = nodeEl.querySelector('.condition-node-preview');
  if (!container) return;
  const conf = nodeConditionState[nodeId];
  if (!conf) return;
  container.innerHTML = `<div style="background:#f3e8ff; padding:10px; border-radius:6px; border:1px solid #d8b4fe;">
    <div style="font-size:12px; font-weight:600; color:#6b21a8; margin-bottom:5px;">Si ${conf.field}</div>
    <div style="font-size:11px; color:#581c87; margin-bottom:3px;">${conf.operator}</div>
    <div style="font-size:12px; font-weight:600; color:#6b21a8; background:white; padding:2px 5px; border-radius:4px; display:inline-block;">${conf.value || 'vacio'}</div>
  </div>`;
}

// Render Randomizer
function renderRandomizerNode(nodeId) {
  const nodeEl = document.getElementById('node-' + nodeId);
  if (!nodeEl) return;
  const container = nodeEl.querySelector('.randomizer-node-preview');
  if (!container) return;
  const conf = nodeRandomizerState[nodeId];
  if (!conf) return;
  container.innerHTML = `<div style="background:#fef3c7; padding:10px; border-radius:6px; border:1px solid #fcd34d;">
    <div style="font-size:12px; font-weight:600; color:#b45309; text-align:center;">${conf.paths} Salidas (A/B)</div>
  </div>`;
}


function renderConditionInspector(nodeId) {
  document.getElementById('config-title').innerText = 'Configurar Condición';
  const conf = nodeConditionState[nodeId] || { field: 'email', operator: 'contains', value: '' };
  
  const html = `
    <div class="config-group">
      <label class="config-label">Campo a evaluar</label>
      <input type="text" class="config-input" id="cond-field" value="${conf.field}" placeholder="ej: email o name">
    </div>
    <div class="config-group">
      <label class="config-label">Operador</label>
      <select class="config-input" id="cond-operator">
        <option value="==" ${conf.operator === '==' ? 'selected' : ''}>Es igual a (==)</option>
        <option value="!=" ${conf.operator === '!=' ? 'selected' : ''}>Diferente de (!=)</option>
        <option value=">" ${conf.operator === '>' ? 'selected' : ''}>Mayor que (>)</option>
        <option value="<" ${conf.operator === '<' ? 'selected' : ''}>Menor que (<)</option>
        <option value="contains" ${conf.operator === 'contains' ? 'selected' : ''}>Contiene</option>
        <option value="not_contains" ${conf.operator === 'not_contains' ? 'selected' : ''}>No contiene</option>
      </select>
    </div>
    <div class="config-group">
      <label class="config-label">Valor de comparación</label>
      <input type="text" class="config-input" id="cond-value" value="${conf.value}" placeholder="ej: @gmail.com">
    </div>
    <button class="btn-primary" style="width:100%" onclick="saveCondition('${nodeId}')">Guardar Condición</button>
  `;
  document.getElementById('config-body').innerHTML = html;
}

function saveCondition(nodeId) {
  const field = document.getElementById('cond-field').value;
  const operator = document.getElementById('cond-operator').value;
  const value = document.getElementById('cond-value').value;
  nodeConditionState[nodeId] = { field, operator, value };
  const node = editor.getNodeFromId(nodeId);
  node.data._condition = JSON.stringify(nodeConditionState[nodeId]);
  renderConditionNode(nodeId);
}

function renderRandomizerInspector(nodeId) {
  document.getElementById('config-title').innerText = 'Configurar Aleatorio';
  const conf = nodeRandomizerState[nodeId] || { paths: 2 };
  
  const html = `
    <div class="config-group">
      <label class="config-label">Número de Salidas Aleatorias (A/B)</label>
      <input type="number" class="config-input" id="rand-paths" value="${conf.paths}" min="2" max="6" readonly disabled title="Actualmente estático en 2 salidas en la UI">
      <p style="font-size:11px; color:#6b7280; margin-top:5px;">El nodo elegirá aleatoriamente entre sus salidas disponibles.</p>
    </div>
    <button class="btn-primary" style="width:100%" onclick="saveRandomizer('${nodeId}')">Guardar</button>
  `;
  document.getElementById('config-body').innerHTML = html;
}

function saveRandomizer(nodeId) {
  const paths = 2; // Fixed for now due to drawflow addNode
  nodeRandomizerState[nodeId] = { paths };
  const node = editor.getNodeFromId(nodeId);
  node.data._randomizer = JSON.stringify(nodeRandomizerState[nodeId]);
  renderRandomizerNode(nodeId);
}

// ─────────────────────────────────────────────
// Carrusel
// ─────────────────────────────────────────────
function renderCarouselNode(nodeId) {
  const nodeEl = document.getElementById('node-' + nodeId);
  if (!nodeEl) return;
  const container = nodeEl.querySelector('.carousel-node-preview');
  if (!container) return;
  const conf = nodeCarouselState[nodeId];
  const count = conf?.elements?.length || 0;
  container.innerHTML = count === 0
    ? '<em style="color:#8492a6; font-size:11px;">Sin tarjetas configuradas</em>'
    : `<div style="background:#e0f2fe; padding:8px; border-radius:6px; text-align:center; font-size:12px; color:#0369a1; font-weight:600;">🖼️ ${count} tarjeta${count !== 1 ? 's' : ''}</div>`;
}

function renderCarouselInspector(nodeId) {
  document.getElementById('config-title').innerText = 'Configurar Carrusel';
  const conf = nodeCarouselState[nodeId] || { elements: [] };
  let html = '<div>';
  conf.elements.forEach((el, i) => {
    html += `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:12px; position:relative;">
        <button onclick="removeCarouselElement('${nodeId}', ${i})" style="position:absolute;top:8px;right:8px;background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;">×</button>
        <div style="font-size:11px; font-weight:600; color:#6b7280; margin-bottom:6px;">TARJETA ${i + 1}</div>
        <label style="font-size:11px;color:#6b7280;">Título</label>
        <input class="config-input" value="${el.title || ''}" oninput="updateCarouselEl('${nodeId}',${i},'title',this.value)" placeholder="Título de la tarjeta" style="margin-bottom:6px;">
        <label style="font-size:11px;color:#6b7280;">Subtítulo</label>
        <input class="config-input" value="${el.subtitle || ''}" oninput="updateCarouselEl('${nodeId}',${i},'subtitle',this.value)" placeholder="Descripción breve" style="margin-bottom:6px;">
        <label style="font-size:11px;color:#6b7280;">URL de imagen</label>
        <input class="config-input" value="${el.image_url || ''}" oninput="updateCarouselEl('${nodeId}',${i},'image_url',this.value)" placeholder="https://..." style="margin-bottom:6px;">
        <label style="font-size:11px;color:#6b7280;">Botón (opcional)</label>
        <input class="config-input" value="${el.buttons?.[0]?.title || ''}" oninput="updateCarouselElBtn('${nodeId}',${i},this.value)" placeholder="Texto del botón">
      </div>`;
  });
  html += `<button class="btn-secondary" style="width:100%;margin-bottom:8px;" onclick="addCarouselElement('${nodeId}')">+ Agregar tarjeta</button></div>`;
  document.getElementById('config-body').innerHTML = html;
}

function addCarouselElement(nodeId) {
  if (!nodeCarouselState[nodeId]) nodeCarouselState[nodeId] = { elements: [] };
  if (nodeCarouselState[nodeId].elements.length >= 10) return alert('Máximo 10 tarjetas');
  nodeCarouselState[nodeId].elements.push({ title: '', subtitle: '', image_url: '', buttons: [] });
  renderCarouselInspector(nodeId);
  renderCarouselNode(nodeId);
}

function removeCarouselElement(nodeId, index) {
  nodeCarouselState[nodeId].elements.splice(index, 1);
  renderCarouselInspector(nodeId);
  renderCarouselNode(nodeId);
}

function updateCarouselEl(nodeId, index, field, value) {
  nodeCarouselState[nodeId].elements[index][field] = value;
  renderCarouselNode(nodeId);
}

function updateCarouselElBtn(nodeId, index, title) {
  const el = nodeCarouselState[nodeId].elements[index];
  el.buttons = title ? [{ type: 'postback', title, payload: `CAROUSEL_${nodeId}_EL${index}_BTN0` }] : [];
  renderCarouselNode(nodeId);
}

// ─────────────────────────────────────────────
// Galería
// ─────────────────────────────────────────────
function renderGalleryNode(nodeId) {
  const nodeEl = document.getElementById('node-' + nodeId);
  if (!nodeEl) return;
  const container = nodeEl.querySelector('.gallery-node-preview');
  if (!container) return;
  const conf = nodeGalleryState[nodeId];
  const count = conf?.images?.length || 0;
  container.innerHTML = count === 0
    ? '<em style="color:#8492a6; font-size:11px;">Sin imágenes</em>'
    : `<div style="background:#fef3c7; padding:8px; border-radius:6px; text-align:center; font-size:12px; color:#b45309; font-weight:600;">📸 ${count} imagen${count !== 1 ? 'es' : ''}</div>`;
}

function renderGalleryInspector(nodeId) {
  document.getElementById('config-title').innerText = 'Configurar Galería';
  const conf = nodeGalleryState[nodeId] || { images: [], delay_between_ms: 300 };
  let html = `<div>
    <label style="font-size:11px;color:#6b7280;">Delay entre imágenes (ms)</label>
    <input class="config-input" type="number" value="${conf.delay_between_ms || 300}" min="0" max="5000" oninput="updateGalleryDelay('${nodeId}',this.value)" style="margin-bottom:12px;">`;
  conf.images.forEach((img, i) => {
    html += `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
      <input class="config-input" style="flex:1;" value="${img.url || ''}" oninput="updateGalleryImg('${nodeId}',${i},this.value)" placeholder="https://imagen.jpg">
      <button onclick="removeGalleryImg('${nodeId}',${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:18px;">×</button>
    </div>`;
  });
  html += `<button class="btn-secondary" style="width:100%" onclick="addGalleryImg('${nodeId}')">+ Agregar imagen</button></div>`;
  document.getElementById('config-body').innerHTML = html;
}

function addGalleryImg(nodeId) {
  if (!nodeGalleryState[nodeId]) nodeGalleryState[nodeId] = { images: [], delay_between_ms: 300 };
  nodeGalleryState[nodeId].images.push({ url: '' });
  renderGalleryInspector(nodeId);
  renderGalleryNode(nodeId);
}

function removeGalleryImg(nodeId, index) {
  nodeGalleryState[nodeId].images.splice(index, 1);
  renderGalleryInspector(nodeId);
  renderGalleryNode(nodeId);
}

function updateGalleryImg(nodeId, index, url) {
  nodeGalleryState[nodeId].images[index].url = url;
  renderGalleryNode(nodeId);
}

function updateGalleryDelay(nodeId, value) {
  nodeGalleryState[nodeId].delay_between_ms = parseInt(value) || 300;
}

// ─────────────────────────────────────────────
// Audio
// ─────────────────────────────────────────────
function renderAudioNode(nodeId) {
  const nodeEl = document.getElementById('node-' + nodeId);
  if (!nodeEl) return;
  const container = nodeEl.querySelector('.audio-node-preview');
  if (!container) return;
  const conf = nodeAudioState[nodeId];
  container.innerHTML = conf?.audio_url
    ? `<div style="background:#dcfce7; padding:8px; border-radius:6px; font-size:11px; color:#166534;">🎵 ${conf.audio_url.split('/').pop().substring(0, 30)}</div>`
    : '<em style="color:#8492a6; font-size:11px;">Sin audio configurado</em>';
}

function renderAudioInspector(nodeId) {
  document.getElementById('config-title').innerText = 'Configurar Audio';
  const conf = nodeAudioState[nodeId] || { audio_url: '' };
  document.getElementById('config-body').innerHTML = `
    <div class="config-group">
      <label class="config-label">URL del Audio</label>
      <input type="text" class="config-input" id="audio-url" value="${conf.audio_url || ''}" placeholder="https://... mp3, ogg, wav">
    </div>
    <div class="config-group">
      <label class="config-label">O subir archivo</label>
      <input type="file" class="config-input" accept="audio/*" onchange="uploadMediaFile('${nodeId}','audio',this)">
    </div>
    <button class="btn-primary" style="width:100%" onclick="saveAudio('${nodeId}')">Guardar</button>`;
}

function saveAudio(nodeId) {
  const url = document.getElementById('audio-url').value.trim();
  nodeAudioState[nodeId] = { audio_url: url };
  const node = editor.getNodeFromId(nodeId);
  node.data._audio = JSON.stringify(nodeAudioState[nodeId]);
  renderAudioNode(nodeId);
}

// ─────────────────────────────────────────────
// Video
// ─────────────────────────────────────────────
function renderVideoNode(nodeId) {
  const nodeEl = document.getElementById('node-' + nodeId);
  if (!nodeEl) return;
  const container = nodeEl.querySelector('.video-node-preview');
  if (!container) return;
  const conf = nodeVideoState[nodeId];
  container.innerHTML = conf?.video_url
    ? `<div style="background:#ede9fe; padding:8px; border-radius:6px; font-size:11px; color:#4c1d95;">🎥 ${conf.video_url.split('/').pop().substring(0, 30)}</div>`
    : '<em style="color:#8492a6; font-size:11px;">Sin video configurado</em>';
}

function renderVideoInspector(nodeId) {
  document.getElementById('config-title').innerText = 'Configurar Video';
  const conf = nodeVideoState[nodeId] || { video_url: '' };
  document.getElementById('config-body').innerHTML = `
    <div class="config-group">
      <label class="config-label">URL del Video</label>
      <input type="text" class="config-input" id="video-url" value="${conf.video_url || ''}" placeholder="https://... mp4, mov, webm">
    </div>
    <div class="config-group">
      <label class="config-label">O subir archivo</label>
      <input type="file" class="config-input" accept="video/*" onchange="uploadMediaFile('${nodeId}','video',this)">
    </div>
    <button class="btn-primary" style="width:100%" onclick="saveVideo('${nodeId}')">Guardar</button>`;
}

function saveVideo(nodeId) {
  const url = document.getElementById('video-url').value.trim();
  nodeVideoState[nodeId] = { video_url: url };
  const node = editor.getNodeFromId(nodeId);
  node.data._video = JSON.stringify(nodeVideoState[nodeId]);
  renderVideoNode(nodeId);
}

// ─────────────────────────────────────────────
// Archivo / PDF
// ─────────────────────────────────────────────
function renderFileNode(nodeId) {
  const nodeEl = document.getElementById('node-' + nodeId);
  if (!nodeEl) return;
  const container = nodeEl.querySelector('.file-node-preview');
  if (!container) return;
  const conf = nodeFileState[nodeId];
  container.innerHTML = conf?.file_url
    ? `<div style="background:#fef9c3; padding:8px; border-radius:6px; font-size:11px; color:#713f12;">📄 ${conf.file_url.split('/').pop().substring(0, 30)}</div>`
    : '<em style="color:#8492a6; font-size:11px;">Sin archivo configurado</em>';
}

function renderFileInspector(nodeId) {
  document.getElementById('config-title').innerText = 'Configurar Archivo / PDF';
  const conf = nodeFileState[nodeId] || { file_url: '' };
  document.getElementById('config-body').innerHTML = `
    <div class="config-group">
      <label class="config-label">URL del Archivo</label>
      <input type="text" class="config-input" id="file-url" value="${conf.file_url || ''}" placeholder="https://... pdf, doc, xls, zip">
    </div>
    <div class="config-group">
      <label class="config-label">O subir archivo</label>
      <input type="file" class="config-input" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip" onchange="uploadMediaFile('${nodeId}','file',this)">
    </div>
    <button class="btn-primary" style="width:100%" onclick="saveFile('${nodeId}')">Guardar</button>`;
}

function saveFile(nodeId) {
  const url = document.getElementById('file-url').value.trim();
  nodeFileState[nodeId] = { file_url: url };
  const node = editor.getNodeFromId(nodeId);
  node.data._file = JSON.stringify(nodeFileState[nodeId]);
  renderFileNode(nodeId);
}

// ─────────────────────────────────────────────
// Delay / Espera
// ─────────────────────────────────────────────
function renderDelayNode(nodeId) {
  const nodeEl = document.getElementById('node-' + nodeId);
  if (!nodeEl) return;
  const container = nodeEl.querySelector('.delay-node-preview');
  if (!container) return;
  const conf = nodeDelayState[nodeId];
  const secs = conf?.seconds || 5;
  const label = secs >= 60 ? `${Math.floor(secs / 60)} min ${secs % 60 > 0 ? secs % 60 + 's' : ''}` : `${secs}s`;
  container.innerHTML = `<div style="background:#f0fdf4; padding:8px; border-radius:6px; text-align:center; font-size:13px; color:#15803d; font-weight:600;">⏱ Esperar ${label}</div>`;
}

function renderDelayInspector(nodeId) {
  document.getElementById('config-title').innerText = 'Configurar Espera';
  const conf = nodeDelayState[nodeId] || { seconds: 5 };
  document.getElementById('config-body').innerHTML = `
    <div class="config-group">
      <label class="config-label">Tiempo de espera (segundos)</label>
      <input type="number" class="config-input" id="delay-seconds" value="${conf.seconds || 5}" min="1" max="900" placeholder="ej: 5">
      <p style="font-size:11px; color:#6b7280; margin-top:4px;">Máximo 900 segundos (15 minutos)</p>
    </div>
    <button class="btn-primary" style="width:100%" onclick="saveDelay('${nodeId}')">Guardar</button>`;
}

function saveDelay(nodeId) {
  const seconds = Math.min(parseInt(document.getElementById('delay-seconds').value) || 5, 900);
  nodeDelayState[nodeId] = { seconds };
  const node = editor.getNodeFromId(nodeId);
  node.data._delay = JSON.stringify(nodeDelayState[nodeId]);
  renderDelayNode(nodeId);
}

// ─────────────────────────────────────────────
// Subida de archivos media (audio/video/file)
// ─────────────────────────────────────────────
async function uploadMediaFile(nodeId, type, inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.url) {
      if (type === 'audio') {
        nodeAudioState[nodeId] = { audio_url: data.url };
        document.getElementById('audio-url').value = data.url;
        renderAudioNode(nodeId);
      } else if (type === 'video') {
        nodeVideoState[nodeId] = { video_url: data.url };
        document.getElementById('video-url').value = data.url;
        renderVideoNode(nodeId);
      } else if (type === 'file') {
        nodeFileState[nodeId] = { file_url: data.url };
        document.getElementById('file-url').value = data.url;
        renderFileNode(nodeId);
      }
    } else {
      alert('Error al subir: ' + (data.error || 'desconocido'));
    }
  } catch (e) {
    alert('Error de red al subir archivo');
  }
}

// ─────────────────────────────────────────────
// Goto / Saltar a flujo
// ─────────────────────────────────────────────
function renderGotoNode(nodeId) {
  const nodeEl = document.getElementById('node-' + nodeId);
  if (!nodeEl) return;
  const container = nodeEl.querySelector('.goto-node-preview');
  if (!container) return;
  const conf = nodeGotoState[nodeId];
  container.innerHTML = conf?.flow_id
    ? `<div style="background:#dbeafe; padding:8px; border-radius:6px; text-align:center; font-size:12px; color:#1d4ed8; font-weight:600;">↗️ ${conf.flow_id}</div>`
    : '<em style="color:#8492a6; font-size:11px;">Sin destino</em>';
}

function renderGotoInspector(nodeId) {
  document.getElementById('config-title').innerText = 'Configurar Goto / Saltar';
  const conf = nodeGotoState[nodeId] || { flow_id: '' };
  document.getElementById('config-body').innerHTML = `
    <div class="config-group">
      <label class="config-label">ID del flujo destino</label>
      <input type="text" class="config-input" id="goto-flow-id" value="${conf.flow_id || ''}" placeholder="ej: flow_checkout o nombre del trigger">
      <p style="font-size:11px; color:#6b7280; margin-top:4px;">El flujo saltará al destino y no continuará con los pasos siguientes.</p>
    </div>
    <button class="btn-primary" style="width:100%" onclick="saveGoto('${nodeId}')">Guardar</button>`;
}

function saveGoto(nodeId) {
  const flowId = document.getElementById('goto-flow-id').value.trim();
  nodeGotoState[nodeId] = { flow_id: flowId };
  const node = editor.getNodeFromId(nodeId);
  node.data._goto = JSON.stringify(nodeGotoState[nodeId]);
  renderGotoNode(nodeId);
}

// ─────────────────────────────────────────────
// Trigger Inspector (matchType + keywords + nombre)
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Trigger Picker Modal
// ─────────────────────────────────────────────
function openTriggerPicker(nodeId) {
  window._pickerNodeId = nodeId;
  const overlay = document.getElementById('trigger-picker-overlay');
  overlay.style.display = 'flex';
}

function closeTriggerPicker() {
  document.getElementById('trigger-picker-overlay').style.display = 'none';
}

function selectTriggerType(nodeId, type) {
  closeTriggerPicker();
  // Escribir directamente en la store de Drawflow (getNodeFromId retorna copia)
  if (editor.drawflow.drawflow.Home.data[nodeId]) {
    editor.drawflow.drawflow.Home.data[nodeId].data.triggerType = type;
  }
  renderTriggerNode(nodeId);
  openInspector(nodeId);
}

document.getElementById('trigger-picker-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeTriggerPicker();
});

// ─────────────────────────────────────────────
// Inspector: Trigger
// ─────────────────────────────────────────────
function renderTriggerInspector(nodeId) {
  const data = editor.drawflow.drawflow.Home.data[nodeId]?.data || {};
  const triggerType = data.triggerType || 'message';

  if (triggerType === 'message') {
    renderTriggerMessageInspector(nodeId, data);
  } else if (triggerType === 'comment') {
    renderTriggerCommentInspector(nodeId, data);
  } else if (triggerType === 'mention') {
    renderTriggerMentionInspector(nodeId, data);
  }
}

function renderTriggerMentionInspector(nodeId, data) {
  document.getElementById('config-title').innerText = '💬 Disparador: Mención';
  document.getElementById('config-body').innerHTML = `
    <div style="margin-bottom:16px;">
      <button onclick="openTriggerPicker('${nodeId}')" style="background:none; border:1px solid #e5e7eb; border-radius:8px; padding:6px 12px; font-size:12px; color:#6b7280; cursor:pointer; display:flex; align-items:center; gap:6px;">
        ⚡ Cambiar tipo de disparador
      </button>
    </div>
    <div class="config-group" style="background:#f3e8ff; border:1px solid #d8b4fe; border-radius:8px; padding:12px; margin-bottom:12px;">
      <p style="font-size:13px; color:#6b21a8; font-weight:600; margin-bottom:6px;"><i class="fa-solid fa-info-circle"></i> ¿Cómo funciona?</p>
      <p style="font-size:12px; color:#7e22ce; line-height:1.4;">Este flujo se activará cada vez que un usuario mencione tu cuenta <strong>@${window.BOT_USERNAME || 'tu_cuenta'}</strong> en los comentarios o descripción de una de <strong>sus</strong> publicaciones.</p>
    </div>
    <div class="config-group" style="background:#fff7ed; border:1px solid #fdba74; border-radius:8px; padding:12px;">
      <p style="font-size:13px; color:#c2410c; font-weight:600; margin-bottom:6px;"><i class="fa-solid fa-triangle-exclamation"></i> Importante</p>
      <p style="font-size:12px; color:#c2410c; line-height:1.4;">Para responder a la mención, añade un nodo de <strong>Acción &gt; Mensaje</strong>. El texto de ese nodo se publicará como un <strong>comentario público</strong> en respuesta al usuario. No se soportan botones ni imágenes.</p>
    </div>
  `;
}

function renderTriggerMessageInspector(nodeId, data) {
  const node = { data };
  document.getElementById('config-title').innerText = '💬 Disparador: Mensaje';
  const keywords = node.data.keywords || '';
  const matchType = node.data.matchType || 'contains';

  const labelText = matchType === 'intent' 
    ? 'Descripción de la intención (Ej: El usuario quiere comprar, saludó, etc)'
    : 'Palabras clave (separadas por coma)';

  document.getElementById('config-body').innerHTML = `
    <div style="margin-bottom:16px;">
      <button onclick="openTriggerPicker('${nodeId}')" style="background:none; border:1px solid #e5e7eb; border-radius:8px; padding:6px 12px; font-size:12px; color:#6b7280; cursor:pointer; display:flex; align-items:center; gap:6px;">
        ⚡ Cambiar tipo de disparador
      </button>
    </div>
    <div class="config-group">
      <label class="config-label" id="trigger-keywords-label">${labelText}</label>
      <input type="text" class="config-input" id="trigger-keywords" value="${keywords}" placeholder="ej: precio, valor, costo">
    </div>
    <div class="config-group">
      <label class="config-label">Tipo de coincidencia</label>
      <select class="config-input" id="trigger-match-type" onchange="document.getElementById('trigger-keywords-label').innerText = this.value === 'intent' ? 'Descripción de la intención (Ej: El usuario quiere comprar)' : 'Palabras clave (separadas por coma)';">
        <option value="contains" ${matchType === 'contains' ? 'selected' : ''}>Contiene la palabra</option>
        <option value="exact" ${matchType === 'exact' ? 'selected' : ''}>Coincidencia exacta</option>
        <option value="starts_with" ${matchType === 'starts_with' ? 'selected' : ''}>Empieza con</option>
        <option value="regex" ${matchType === 'regex' ? 'selected' : ''}>Expresión regular (avanzado)</option>
        <option value="intent" ${matchType === 'intent' ? 'selected' : ''}>🧠 Intención por IA (Smart Trigger)</option>
      </select>
      <p style="font-size:11px; color:var(--text-muted); margin-top:5px; line-height:1.4;">Si usas <b>Intención por IA</b>, nuestro motor semántico evaluará si el mensaje significa lo mismo que tu descripción, incluso si usa sinónimos o palabras diferentes.</p>
    </div>
    <button class="btn-primary" style="width:100%; margin-top:8px;" onclick="saveTrigger('${nodeId}')">Aplicar</button>`;
}

function renderTriggerCommentInspector(nodeId, data) {
  document.getElementById('config-title').innerText = '💬 Disparador: Comentario';
  const keyword = data.commentKeyword || '';
  const replies = data.commentPublicReplies || (data.commentPublicReply ? [data.commentPublicReply] : ['']);
  const privateReply = data.commentPrivateReply !== false;
  const selectedMedia = data.commentMediaId || '';
  const selectedMediaThumb = data.commentMediaThumb || '';

  const repliesHtml = replies.map((r, i) => `
    <div style="display:flex; gap:6px; margin-bottom:6px;" id="reply-row-${i}">
      <textarea class="config-input comment-public-reply-item" style="min-height:50px; flex:1; resize:vertical;" placeholder="ej: ¡Gracias! Te escribimos por DM 📩">${r}</textarea>
      ${replies.length > 1 ? `<button onclick="removeCommentReply('${nodeId}',${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:18px;padding:0 4px;align-self:flex-start;margin-top:4px;">×</button>` : ''}
    </div>`).join('');

  document.getElementById('config-body').innerHTML = `
    <div style="margin-bottom:16px;">
      <button onclick="openTriggerPicker('${nodeId}')" style="background:none; border:1px solid #e5e7eb; border-radius:8px; padding:6px 12px; font-size:12px; color:#6b7280; cursor:pointer;">
        ⚡ Cambiar tipo de disparador
      </button>
    </div>

    <!-- Publicación específica -->
    <div class="config-group">
      <label class="config-label">Publicación (opcional)</label>
      <div id="comment-media-preview" style="margin-bottom:8px;">
        ${selectedMedia
          ? `<div style="display:flex;align-items:center;gap:8px;background:#f3f4f6;padding:8px;border-radius:8px;">
               ${selectedMediaThumb ? `<img src="${selectedMediaThumb}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">` : '🖼️'}
               <span style="font-size:12px;color:#374151;flex:1">Publicación seleccionada</span>
               <button onclick="clearCommentMedia('${nodeId}')" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:16px;">×</button>
             </div>`
          : `<div style="font-size:12px;color:#9ca3af;">Responde a comentarios en cualquier publicación</div>`}
      </div>
      <button id="btn-load-media" onclick="loadInstagramMedia('${nodeId}')" style="background:none;border:1px dashed #d1d5db;border-radius:8px;padding:7px 12px;font-size:12px;color:#6b7280;cursor:pointer;width:100%;">
        📸 Elegir publicación específica
      </button>
      <div id="media-grid" style="display:none; margin-top:10px;"></div>
    </div>

    <hr style="border:0; border-top:1px solid #f3f4f6; margin:14px 0;">

    <!-- Keyword -->
    <div class="config-group">
      <label class="config-label">Palabra clave en el comentario</label>
      <input type="text" class="config-input" id="comment-keyword" value="${keyword}" placeholder='ej: QUIERO, INFO, PRECIO'>
      <p style="font-size:11px; color:#6b7280; margin-top:4px;">Deja vacío para responder a cualquier comentario.</p>
    </div>

    <hr style="border:0; border-top:1px solid #f3f4f6; margin:14px 0;">

    <!-- Respuestas aleatorias -->
    <div class="config-group">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <label class="config-label" style="margin:0;">Respuestas públicas <span style="background:#e0e7ff;color:#3730a3;font-size:10px;padding:2px 7px;border-radius:10px;margin-left:4px;">aleatorias</span></label>
        <button onclick="addCommentReply('${nodeId}')" style="background:none;border:1px solid #d1d5db;border-radius:6px;padding:3px 10px;font-size:12px;color:#374151;cursor:pointer;">+ Añadir variante</button>
      </div>
      <div id="replies-container">${repliesHtml}</div>
      <p style="font-size:11px; color:#6b7280; margin-top:4px;">Si hay varias, el bot elige una al azar para sonar más natural.</p>
    </div>

    <!-- DM -->
    <div class="config-group" style="display:flex; align-items:center; gap:10px; margin-top:4px;">
      <input type="checkbox" id="comment-private-reply" ${privateReply ? 'checked' : ''} style="width:16px; height:16px; accent-color: var(--primary);">
      <label for="comment-private-reply" style="font-size:13px; color:#374151; cursor:pointer;">Enviar el flujo por mensaje directo (DM)</label>
    </div>
    <button class="btn-primary" style="width:100%; margin-top:16px;" onclick="saveTriggerComment('${nodeId}')">Aplicar</button>`;
}

// Cargar publicaciones de Instagram
window.loadInstagramMedia = async function(nodeId) {
  const grid = document.getElementById('media-grid');
  const btn = document.getElementById('btn-load-media');
  if (!grid) return;
  btn.textContent = '⏳ Cargando...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/instagram/media');
    const data = await res.json();
    const items = data.data || [];

    if (items.length === 0) {
      grid.innerHTML = '<p style="font-size:12px;color:#9ca3af;text-align:center;">No se encontraron publicaciones.</p>';
    } else {
      grid.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
        ${items.map(item => {
          const thumb = item.thumbnail_url || item.media_url || '';
          return `<div onclick="selectCommentMedia('${nodeId}','${item.id}','${thumb}')"
            style="cursor:pointer;border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;aspect-ratio:1;position:relative;transition:border-color .15s;"
            onmouseover="this.style.borderColor='#0084ff'" onmouseout="this.style.borderColor='#e5e7eb'">
            ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">` : '<div style="width:100%;height:100%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:24px;">🖼️</div>'}
          </div>`;
        }).join('')}
      </div>`;
    }
    grid.style.display = 'block';
  } catch(e) {
    grid.innerHTML = '<p style="font-size:12px;color:#ef4444;">Error al cargar publicaciones. Verifica el token.</p>';
    grid.style.display = 'block';
  }
  btn.textContent = '📸 Elegir publicación específica';
  btn.disabled = false;
};

window.selectCommentMedia = function(nodeId, mediaId, thumb) {
  const d = editor.drawflow.drawflow.Home.data[nodeId]?.data;
  if (d) { d.commentMediaId = mediaId; d.commentMediaThumb = thumb; }
  renderTriggerCommentInspector(nodeId, editor.drawflow.drawflow.Home.data[nodeId]?.data || {});
};

window.clearCommentMedia = function(nodeId) {
  const d = editor.drawflow.drawflow.Home.data[nodeId]?.data;
  if (d) { d.commentMediaId = ''; d.commentMediaThumb = ''; }
  renderTriggerCommentInspector(nodeId, editor.drawflow.drawflow.Home.data[nodeId]?.data || {});
};

window.addCommentReply = function(nodeId) {
  const items = Array.from(document.querySelectorAll('.comment-public-reply-item')).map(t => t.value);
  items.push('');
  const d = editor.drawflow.drawflow.Home.data[nodeId]?.data;
  if (d) d.commentPublicReplies = items;
  renderTriggerCommentInspector(nodeId, editor.drawflow.drawflow.Home.data[nodeId]?.data || {});
};

window.removeCommentReply = function(nodeId, idx) {
  const items = Array.from(document.querySelectorAll('.comment-public-reply-item')).map(t => t.value);
  items.splice(idx, 1);
  const d = editor.drawflow.drawflow.Home.data[nodeId]?.data;
  if (d) d.commentPublicReplies = items.length ? items : [''];
  renderTriggerCommentInspector(nodeId, editor.drawflow.drawflow.Home.data[nodeId]?.data || {});
};

function saveTrigger(nodeId) {
  const d = editor.drawflow.drawflow.Home.data[nodeId]?.data;
  if (!d) return;
  d.keywords = document.getElementById('trigger-keywords').value.trim();
  d.matchType = document.getElementById('trigger-match-type').value;
  renderTriggerNode(nodeId);
}

window.saveTriggerComment = function(nodeId) {
  const d = editor.drawflow.drawflow.Home.data[nodeId]?.data;
  if (!d) return;
  d.commentKeyword = document.getElementById('comment-keyword').value.trim();
  const replyItems = Array.from(document.querySelectorAll('.comment-public-reply-item')).map(t => t.value.trim()).filter(Boolean);
  d.commentPublicReplies = replyItems.length ? replyItems : [];
  d.commentPublicReply = replyItems[0] || '';
  d.commentPrivateReply = document.getElementById('comment-private-reply').checked;
  renderTriggerNode(nodeId);
  closeInspector();
};

function renderTriggerNode(nodeId) {
  const nodeEl = document.getElementById('node-' + nodeId);
  if (!nodeEl) return;
  const container = nodeEl.querySelector('.trigger-node-preview');
  if (!container) return;
  const data = editor.drawflow.drawflow.Home.data[nodeId]?.data || {};
  const triggerType = data.triggerType || 'message';

  if (triggerType === 'message') {
    const kw = data.keywords || '';
    const matchType = data.matchType || 'contains';
    const matchLabels = { contains: 'Contiene', exact: 'Exacto', starts_with: 'Empieza con', regex: 'Regex' };
    if (kw) {
      container.innerHTML = `
        <div class="trigger-type-badge">💬 Mensaje directo</div>
        <div style="background:#eff6ff; padding:8px; border-radius:6px; font-size:11px;">
          <div style="color:#1d4ed8; font-weight:600; margin-bottom:3px;">${matchLabels[matchType] || 'Contiene'}</div>
          <div style="color:#1e40af; max-height:54px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">${kw}</div>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="trigger-type-badge">💬 Mensaje directo</div>
        <div style="color:#9ca3af; font-size:12px;">Sin palabras clave aún</div>`;
    }
  } else if (triggerType === 'comment') {
    const kw = data.commentKeyword || '';
    const pub = data.commentPublicReply || '';
    container.innerHTML = `
      <div class="trigger-type-badge comment">💬 Comentario</div>
      ${kw ? `<div style="background:#f0fdf4; padding:8px; border-radius:6px; font-size:11px; color:#15803d; font-weight:600; margin-bottom:6px;">Palabra clave: "${kw}"</div>` : '<div style="font-size:11px; color:#9ca3af; margin-bottom:6px;">Cualquier comentario</div>'}
      ${pub ? `<div style="font-size:11px; color:#6b7280;">↩ Responde: "${pub.substring(0,40)}${pub.length>40?'...':''}"</div>` : ''}
      ${data.commentPrivateReply !== false ? '<div style="font-size:11px; color:#6b7280;">📩 Envía flujo por DM</div>' : ''}`;
  } else if (triggerType === 'mention') {
    container.innerHTML = `
      <div class="trigger-type-badge mention" style="background:#f3e8ff; color:#7e22ce;">@ Mención</div>
      <div style="font-size:11px; color:#6b7280; margin-top:6px;">Se activa cuando te etiquetan.</div>
      <div style="font-size:11px; color:#d97706; margin-top:4px; font-weight:bold;">⚠️ Responde con un comentario.</div>
    `;
  } else {
    container.innerHTML = `<div style="border:2px dashed #0084ff; border-radius:8px; padding:12px; text-align:center; color:#0084ff; font-weight:600; font-size:14px; cursor:pointer;" onclick="openTriggerPicker('${nodeId}')">+ Elegir disparador</div>`;
  }
}

// ─────────────────────────────────────────────
// IA Agent Handlers
// ─────────────────────────────────────────────
window.renderAiAgentNode = function(nodeId) {
  const nodeEl = document.getElementById('node-' + nodeId);
  if (!nodeEl) return;
  const container = nodeEl.querySelector('.ai-agent-node-preview');
  if (!container) return;
  
  const state = nodeAiAgentState[nodeId] || { system_prompt: '' };
  if (state.system_prompt) {
    container.innerHTML = `<div style="font-size:11px; color:#475569; overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">${state.system_prompt}</div>`;
  } else {
    container.innerHTML = `<em style="color:#ef4444; font-size:11px;">⚠️ Sin Configurar</em>`;
  }
};

window.renderAiAgentInspector = function(nodeId) {
  document.getElementById('config-title').innerText = 'Agente IA';
  
  const state = nodeAiAgentState[nodeId] || { system_prompt: '', ignore_master_context: false };
  const ignoreMaster = state.ignore_master_context || false;
  
  let html = `
    <div style="background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); padding: 15px; border-radius: 8px; color: white; margin-bottom: 15px;">
      <h3 style="margin:0 0 5px 0; font-size:14px; display:flex; align-items:center; gap:5px;">🧠 Agente IA</h3>
      <p style="margin:0; font-size:12px; opacity:0.9;">Cuando el flujo llegue a este nodo, la IA tomará el control y responderá automáticamente.</p>
    </div>
    
    <!-- FASE 2: Info sobre el contexto maestro -->
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin-bottom: 14px;">
      <p style="margin:0; font-size:12px; color: #166534; display:flex; align-items:flex-start; gap:6px;">
        <span style="font-size:14px; flex-shrink:0;">✅</span>
        <span><strong>Contexto Maestro activo:</strong> El agente ya conoce los productos, precios, tono de Faroles Genius y cómo manejar objeciones. No necesitas repetir esa información aquí.</span>
      </p>
    </div>

    <!-- FASE 3: Override por nodo -->
    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;">
      <label class="cfg-label" style="display:flex; justify-content:space-between;">
        <span>➕ Instrucciones adicionales (opcional)</span>
        <span style="color:#8b5cf6; font-size:11px;">Opcional</span>
      </label>
      <textarea id="ai-system-prompt" class="cfg-input" maxlength="1500" style="height: 120px; resize:vertical;" 
        placeholder="Ej: Solo atiende clientes detal. No menciones el Kit de Aliado.&#10;&#10;O: Este flujo es post-compra, el cliente ya compró. Ayuda con dudas de armado y cuidado.">${state.system_prompt}</textarea>
      <p style="font-size:11px; color:var(--text-muted); margin:0;">Se concatena al Contexto Maestro. Úsa esto para enfocar este nodo en un tipo de cliente o etapa específica.</p>
    </div>
    
    <!-- FASE 3: Checkbox para ignorar contexto maestro -->
    <div style="display:flex; align-items:flex-start; gap:10px; padding: 12px; background: #fef9c3; border: 1px solid #fde047; border-radius: 8px; margin-bottom: 14px; cursor:pointer;" onclick="document.getElementById('ai-ignore-master').click()">
      <input type="checkbox" id="ai-ignore-master" ${ignoreMaster ? 'checked' : ''} onclick="event.stopPropagation()" style="margin-top:2px; accent-color: #a855f7; width:16px; height:16px; flex-shrink:0; cursor:pointer;">
      <div>
        <p style="margin:0 0 2px; font-size:12px; font-weight:600; color:#854d0e;">Ignorar Contexto Maestro</p>
        <p style="margin:0; font-size:11px; color:#92400e;">Activa esto solo si este agente es para un negocio diferente o un propósito completamente distinto a Faroles Genius.</p>
      </div>
    </div>
    
    <button class="btn-primary" onclick="saveAiAgentConfig('${nodeId}')" style="width:100%;">Guardar Configuración</button>
  `;
  
  document.getElementById('config-body').innerHTML = html;
};

window.saveAiAgentConfig = function(nodeId) {
  const promptStr = document.getElementById('ai-system-prompt').value.trim();
  const ignoreMaster = document.getElementById('ai-ignore-master')?.checked || false;
  
  // FASE 3: el prompt ya no es requerido si el contexto maestro está activo
  if (ignoreMaster && !promptStr) {
    if (typeof Toast !== 'undefined') Toast.warning('Si ignoras el Contexto Maestro, debes escribir instrucciones propias.');
    return;
  }
  
  nodeAiAgentState[nodeId] = { 
    system_prompt: promptStr,
    ignore_master_context: ignoreMaster
  };
  
  // Guardar en data del drawflow para la exportación final
  editor.drawflow.drawflow.Home.data[nodeId].data._ai = JSON.stringify(nodeAiAgentState[nodeId]);
  
  renderAiAgentNode(nodeId);
  closeInspector();
  
  const msg = ignoreMaster 
    ? 'Agente configurado (modo standalone — sin Contexto Maestro)'
    : (promptStr ? 'Agente configurado con instrucciones adicionales ✅' : 'Agente configurado con Contexto Maestro completo ✅');
  if (typeof Toast !== 'undefined') Toast.success(msg);
};

// ─────────────────────────────────────────────
// Generador Mágico de Flujos (AI)
// ─────────────────────────────────────────────
window.generateFlowFromAI = async function() {
  const promptInput = document.getElementById('ai-prompt');
  const btnConfirm = document.getElementById('btn-confirm-generate');
  const prompt = promptInput.value.trim();
  
  if (!prompt) {
    if (typeof Toast !== 'undefined') Toast.warning('Escribe una descripción para el flujo.');
    return;
  }
  
  btnConfirm.innerHTML = '✨ Generando...';
  btnConfirm.disabled = true;
  
  try {
    const res = await fetch('/api/ai/generate-flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error desconocido');
    }
    
    const flowData = await res.json();
    if (!flowData.nodes || !Array.isArray(flowData.nodes)) throw new Error('La IA devolvió un formato inválido');
    
    editor.clear(); // Limpiamos el canvas actual
    const idMap = {};
    
    // 1. Crear Nodos
    for (const aiNode of flowData.nodes) {
      const type = aiNode.type;
      const x = aiNode.x || (Math.random() * 400 + 100);
      const y = aiNode.y || (Math.random() * 400 + 100);
      const data = aiNode.data || {};
      
      let newId = null;
      if (type === 'trigger') {
        newId = editor.addNode('trigger', 0, 1, x, y, 'trigger', { keywords: data.keywords || '', triggerType: 'message' }, htmlTrigger);
      } else if (type === 'message') {
        const tempHtml = `<div class="mc-node mc-content"><div class="mc-header"><span>💬</span> Send Message</div><div class="box node-blocks-container"></div></div>`;
        newId = editor.addNode('message', 1, 10, x, y, 'message', { _blocks: '[]' }, tempHtml);
        nodeBlocksState[newId] = [ { id: generateId(), type: 'text', content: data.text || 'Hola', buttons: [] } ];
        setTimeout(() => renderBlocksInNode(newId), 50);
      } else if (type === 'input') {
        newId = editor.addNode('input', 1, 2, x, y, 'input', { _input: '{}' }, htmlInput);
        nodeInputState[newId] = { type: data.inputType || 'email', field: data.field || 'email', prompt: data.prompt || 'Ingresa tu dato:', retry: 'Intenta de nuevo:' };
        setTimeout(() => renderInputNode(newId), 50);
      } else if (type === 'action') {
        newId = editor.addNode('action', 1, 1, x, y, 'action', { _action: '{}' }, htmlAction);
        nodeActionsState[newId] = { type: data.actionType || 'add_tag', params: { tag: data.tag || 'ia_tag' } };
        setTimeout(() => renderActionNode(newId), 50);
      } else if (type === 'delay') {
        newId = editor.addNode('delay', 1, 1, x, y, 'delay', { _delay: '{}' }, htmlDelay);
        nodeDelayState[newId] = { seconds: data.seconds || 5 };
        setTimeout(() => renderDelayNode(newId), 50);
      } else if (type === 'ai_agent') {
        newId = editor.addNode('ai_agent', 1, 1, x, y, 'ai_agent', { _ai: '{}' }, htmlAiAgent);
        nodeAiAgentState[newId] = { system_prompt: data.system_prompt || 'Eres un asistente.' };
        setTimeout(() => renderAiAgentNode(newId), 50);
      }
      
      if (newId) idMap[aiNode.id] = newId;
    }
    
    // 2. Conectar Nodos
    if (flowData.connections) {
      for (const conn of flowData.connections) {
        const fromId = idMap[conn.from];
        const toId = idMap[conn.to];
        if (fromId && toId) {
          editor.addConnection(fromId, toId, 'output_1', 'input_1');
        }
      }
    }
    
    if (typeof Toast !== 'undefined') Toast.success('Flujo mágico generado con éxito ✨');
    closeAiModal();
    
  } catch (err) {
    if (typeof Toast !== 'undefined') Toast.error(err.message);
    else alert('Error: ' + err.message);
  } finally {
    btnConfirm.innerHTML = 'Generar Flujo';
    btnConfirm.disabled = false;
  }
};
