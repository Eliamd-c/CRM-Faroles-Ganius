const id = document.getElementById("drawflow");
const editor = new Drawflow(id);
editor.reroute = true;
editor.curvature = 0.5;
editor.start();

let adminApiKey = sessionStorage.getItem('ADMIN_API_KEY');
if (!adminApiKey) {
  adminApiKey = prompt("Por favor, ingresa tu ADMIN_API_KEY para acceder al Builder:");
  if (adminApiKey) {
    sessionStorage.setItem('ADMIN_API_KEY', adminApiKey);
  }
}

// ─────────────────────────────────────────────
// Estado global
// ─────────────────────────────────────────────
const nodeBlocksState = {}; // { nodeId: [ { id: 'b1', type: 'text', content: '', url: '', buttons: [] } ] }
const nodeActionsState  = {}; // { nodeId: { type: 'add_tag', params: {} } }
const nodeInputState = {}; // { nodeId: { type: 'email', field: 'email', prompt: '', retry: '' } }
const nodeConditionState = {}; // { nodeId: { field: '', operator: '', value: '' } }
const nodeRandomizerState = {}; // { nodeId: { paths: 2 } }

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
  <div class="node-trigger">
    <div class="title-box"><span>⚡</span> Cuando...</div>
    <div class="box trigger-node-preview">
      <div style="color: #8592a3; font-size: 13px; line-height: 1.5; margin-bottom: 16px;">
        Un disparador es un evento que inicia tu Automatización.<br>Haz clic para añadir un disparador.
      </div>
      <div style="border: 2px dashed #0084ff; border-radius: 8px; padding: 12px; text-align: center; color: #0084ff; font-weight: 600; font-size: 14px; cursor: pointer;">
        + Nuevo disparador
      </div>
    </div>
  </div>
`;

// Nodo Legacy de Tarjeta (para compatibilidad)
const htmlCard = `
  <div class="node-card">
    <div class="title-box">🖼️ Tarjeta (Legacy)</div>
    <div class="box">
      <p style="font-size:11px; color:#888;">Nodo antiguo, por favor usa el Inspector.</p>
    </div>
  </div>
`;

const htmlCondition = `
  <div class="node-condition">
    <div class="title-box"><span>🔀</span> Condition</div>
    <div class="box condition-node-preview">
      <em style="color:#8492a6; font-size:11px;">Configura en el panel...</em>
    </div>
  </div>
`;

const htmlRandomizer = `
  <div class="node-randomizer">
    <div class="title-box"><span>🎲</span> Randomizer</div>
    <div class="box randomizer-node-preview">
      <em style="color:#8492a6; font-size:11px;">Configura salidas en el panel...</em>
    </div>
  </div>
`;

const htmlAction = `
  <div class="node-action">
    <div class="title-box"><span>⚡</span> Action</div>
    <div class="box action-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin configurar</em>
    </div>
  </div>
`;

const htmlInput = `
  <div class="node-input">
    <div class="title-box"><span>📥</span> User Input</div>
    <div class="box input-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin configurar</em>
    </div>
  </div>
`;

// Registrar nodos estáticos
editor.registerNode('trigger', htmlTrigger);
editor.registerNode('card', htmlCard);
editor.registerNode('action', htmlAction);
editor.registerNode('input', htmlInput);

// ─────────────────────────────────────────────
// Agregar nodo Mensaje (dinámico, soporta hasta 20 botones)
// ─────────────────────────────────────────────
function addMessageNode(posX, posY) {
  const tempHtml = `<div class="node-message"><div class="title-box"><span>💬</span> Send Message</div><div class="box node-blocks-container"></div></div>`;
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
  }
});

// ─────────────────────────────────────────────
// Panel Inspector (D.2 UX)
// ─────────────────────────────────────────────
let selectedNodeId = null;

function openInspector(nodeId) {
  selectedNodeId = nodeId;
  const node = editor.getNodeFromId(nodeId);
  const panel = document.getElementById('config-panel');
  panel.classList.remove('hidden');

  if (node.name === 'message') {
    renderMessageInspector(nodeId);
  } else if (node.name === 'action') {
    renderActionInspector(nodeId);
  } else if (node.name === 'input') {
    renderInputInspector(nodeId);
  } else if (node.name === 'condition') {
    renderConditionInspector(nodeId);
  } else if (node.name === 'randomizer') {
    renderRandomizerInspector(nodeId);
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
        <button onclick="deleteBlock('${nodeId}', ${idx})" style="position: absolute; top: 10px; right: -30px; background: none; border: none; color: #ef4444; font-size: 16px; cursor: pointer;" title="Eliminar bloque">×</button>
    `;
      
    if (block.type === 'text') {
      html += `
        <div style="background: #f1f2f6; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <textarea class="cfg-input" style="width: 100%; border: none; background: transparent; outline: none; resize: none; min-height: 80px; font-size: 13px; font-family: inherit; color: #1c1e21;" oninput="updateBlockContent('${nodeId}', ${idx}, this.value)" placeholder="Introduce tu texto...">${block.content}</textarea>
      `;
    } else if (block.type === 'image') {
      html += `
        <div style="background: #f1f2f6; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <label style="font-size:11px; color:var(--text-muted); margin-bottom:4px; display:block;">URL de la Imagen</label>
          <input class="cfg-input" type="text" style="width:100%; border: none; background: #ffffff; padding: 8px; border-radius: 6px; font-size: 13px;" value="${block.url || ''}" oninput="updateBlockUrl('${nodeId}', ${idx}, this.value)" placeholder="https://..." />
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
    if ((block.buttons || []).length < 13) {
      html += `<div onclick="addButton('${nodeId}', ${idx})" style="border: 1px dashed #b0b8c4; border-radius: 20px; padding: 10px; text-align: center; font-size: 13px; font-weight: 500; color: #b0b8c4; cursor: pointer; margin-top: 10px; transition: color 0.15s, border-color 0.15s;" onmouseover="this.style.color='#0084ff'; this.style.borderColor='#0084ff';" onmouseout="this.style.color='#b0b8c4'; this.style.borderColor='#b0b8c4';">+ Añadir botón</div>`;
    }
    
    html += `</div>`; // fin .ms-block-wrapper
  });
  
  html += `</div>`; // .insp-blocks-list
  
  html += `
    <div style="margin-top:20px; padding:15px; border-radius:8px; background:#f3f4f6;">
      <label class="cfg-label" style="text-align:center; display:block; margin-bottom:10px;">Añadir bloque de contenido:</label>
      <div style="display:flex; gap:10px;">
        <button class="btn-primary" onclick="addBlock('${nodeId}', 'text')" style="flex:1; padding:10px; border-radius:6px; border:none; cursor:pointer; font-weight:500;">📝 Texto</button>
        <button class="btn-primary" onclick="addBlock('${nodeId}', 'image')" style="flex:1; padding:10px; border-radius:6px; border:none; cursor:pointer; font-weight:500;">🖼️ Imagen</button>
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
      <input type="text" value="${btn.title}" oninput="updateBtnTitle('${nodeId}', ${idx}, ${bIdx}, this.value)" style="width:100%; padding:10px 12px; border:2px solid ${btn.title.length > 20 ? '#ef4444' : '#0084ff'}; border-radius:8px; font-size:14px; outline:none; font-weight:600; color:${btn.title.length > 20 ? '#ef4444' : '#0084ff'};" />
      ${btn.title.length > 20 ? '<div style="font-size:11px; color:#ef4444; margin-top:4px; margin-bottom:16px;">⚠️ Instagram truncará este texto (máx 20 caracteres)</div>' : '<div style="margin-bottom:20px;"></div>'}
      
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
window.updateBlockContent = (nodeId, idx, val) => { nodeBlocksState[nodeId][idx].content = val; renderBlocksInNode(nodeId); };
window.updateBlockUrl = (nodeId, idx, val) => { nodeBlocksState[nodeId][idx].url = val; renderBlocksInNode(nodeId); };
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
      </select>
      
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
      nodeInputState[nodeId] = {
        type: document.getElementById('cfg-input-type').value,
        field: document.getElementById('cfg-input-field').value.trim(),
        prompt: document.getElementById('cfg-input-prompt').value.trim(),
        retry: document.getElementById('cfg-input-retry').value.trim()
      };
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
            const hasWebUrl = block.buttons.some(b => b.type === 'web_url');
            if (hasWebUrl) {
              steps.push({ type: 'template', message: block.content, buttons: templateBtns });
            } else {
              steps.push({ type: 'buttons', message: block.content, buttons: templateBtns, buttonType: 'quick_reply' });
            }
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
  for (const nodeId in nodeBlocksState) {
    if (editor.drawflow.drawflow.Home.data[nodeId]) {
      editor.drawflow.drawflow.Home.data[nodeId].data._blocks = JSON.stringify(nodeBlocksState[nodeId]);
    }
  }
  for (const nodeId in nodeActionsState) {
    if (editor.drawflow.drawflow.Home.data[nodeId] && nodeActionsState[nodeId]) {
      editor.drawflow.drawflow.Home.data[nodeId].data._action = JSON.stringify(nodeActionsState[nodeId]);
    }
  }
  for (const nodeId in nodeInputState) {
    if (editor.drawflow.drawflow.Home.data[nodeId] && nodeInputState[nodeId]) {
      editor.drawflow.drawflow.Home.data[nodeId].data._input = JSON.stringify(nodeInputState[nodeId]);
    }
  }

  const data = editor.export();
  const nodes = data.drawflow.Home.data;
  const flowsConfig = { flows: [], defaultFlow: null };

  for (const nodeId in nodes) {
    const node = nodes[nodeId];
    if (node.name === 'trigger') {
      const keywordsRaw = node.data.keywords || '';
      const keywordsList = keywordsRaw.split(',').map(k => k.trim()).filter(k => k);
      const newFlow = { id: `flow_${nodeId}`, name: `Flujo Visual ${nodeId}`, keywords: keywordsList, matchType: 'contains', steps: [] };
      const nextNodeId = node.outputs.output_1?.connections[0]?.node;
      if (nextNodeId) newFlow.steps = buildStepsFromNode(nextNodeId, nodes, flowsConfig);
      if (keywordsList.length > 0) flowsConfig.flows.push(newFlow);
    }
  }

  const btn = document.getElementById('btn-save');
  btn.innerText = "Guardando...";
  try {
    const res = await fetch('/api/flows', { 
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': adminApiKey || ''
      }, 
      body: JSON.stringify(flowsConfig) 
    });
    
    if (res.status === 401) {
      alert("Error: API Key inválida");
      sessionStorage.removeItem('ADMIN_API_KEY');
      location.reload();
      return;
    }
    
    if (res.ok) {
      btn.innerText = "¡Guardado con éxito!";
      setTimeout(() => btn.innerText = "Guardar Cambios", 2000);
    }
  } catch(e) {
    btn.innerText = "Error al guardar";
  }
});

// ─────────────────────────────────────────────
// Carga Inicial (Ejemplo)
// ─────────────────────────────────────────────
setTimeout(() => {
  if (Object.keys(editor.drawflow.drawflow.Home.data).length === 0) {
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
    // Restaurar los estados desde Drawflow si ya habían datos guardados (en un entorno de carga real)
    const nodes = editor.drawflow.drawflow.Home.data;
    for (const nodeId in nodes) {
       const node = nodes[nodeId];
       if (node.name === 'message' && node.data._blocks) {
         nodeBlocksState[nodeId] = JSON.parse(node.data._blocks);
         renderBlocksInNode(nodeId);
       }
       if (node.name === 'action' && node.data._action) {
         nodeActionsState[nodeId] = JSON.parse(node.data._action);
         renderActionNode(nodeId);
       }
       if (node.name === 'input' && node.data._input) {
         nodeInputState[nodeId] = JSON.parse(node.data._input);
         renderInputNode(nodeId);
       }
       if (node.name === 'condition' && node.data._condition) {
         nodeConditionState[nodeId] = JSON.parse(node.data._condition);
         renderConditionNode(nodeId);
       }
       if (node.name === 'randomizer' && node.data._randomizer) {
         nodeRandomizerState[nodeId] = JSON.parse(node.data._randomizer);
         renderRandomizerNode(nodeId);
       }
    }
  }
}, 150);

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

    } else if (type === 'randomizer') {
      const nodeId = editor.addNode('randomizer', 1, 2, posX, posY, 'randomizer', { _randomizer: '{}' }, htmlRandomizer);
      nodeRandomizerState[nodeId] = { paths: 2 };
      setTimeout(() => renderRandomizerNode(nodeId), 50);
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
