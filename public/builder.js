const id = document.getElementById("drawflow");
const editor = new Drawflow(id);
editor.reroute = true;
editor.start();

// ─────────────────────────────────────────────
// Estado global
// ─────────────────────────────────────────────
const nodeBlocksState = {}; // { nodeId: [ { id: 'b1', type: 'text', content: '', url: '', buttons: [] } ] }
const nodeActionsState  = {}; // { nodeId: { type: 'add_tag', params: {} } }

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
  const container = document.querySelector(`#node-${nodeId} .node-blocks-container`);
  if (!container) return;
  const blocks = nodeBlocksState[nodeId] || [];
  
  let html = '';
  blocks.forEach(block => {
    html += `<div class="canvas-block canvas-block-${block.type}" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:10px; margin-bottom:8px;">`;
    if (block.type === 'text') {
      html += `<div class="cb-text" style="font-size:13px; color:#4b5563; white-space:pre-wrap;">${block.content || '<span class="cb-placeholder" style="color:#9ca3af; font-style:italic;">Texto vacío...</span>'}</div>`;
    } else if (block.type === 'image') {
      html += `<div class="cb-image" style="text-align:center;">${block.url ? `<img src="${block.url}" style="max-width:100%; border-radius:6px;" />` : '<div class="cb-placeholder-img" style="color:#9ca3af; font-size:12px; padding:15px; border:1px dashed #d1d5db; border-radius:6px;">🖼️ Sin imagen (Añade URL en Inspector)</div>'}</div>`;
    }
    
    // Botones
    if (block.buttons && block.buttons.length > 0) {
      html += `<div class="cb-btns" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">`;
      block.buttons.forEach(btn => {
        html += `<div class="cb-btn-row" style="background:#fff; border:1px solid #d1d5db; padding:6px 10px; border-radius:6px; font-size:12px; display:flex; justify-content:space-between; box-shadow:0 1px 2px rgba(0,0,0,0.02);"><span>${btn.title || 'Botón'}</span> <span class="cb-btn-icon" style="color:#6b7280; font-size:10px;">►</span></div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
  });

  if (blocks.length === 0) {
    html = `<div style="text-align:center; padding: 20px; color: var(--text-muted); font-size:12px;">Sin contenido.<br>Añade bloques en el Inspector.</div>`;
  }

  container.innerHTML = html;
  
  // Reposicionar salidas para los botones
  setTimeout(() => repositionOutputs(nodeId), 30);
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
  const btnRows = nodeEl.querySelectorAll('.cb-btn-row');
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

// ─────────────────────────────────────────────
// Definición de Nodos HTML
// ─────────────────────────────────────────────
const htmlTrigger = `
  <div class="node-trigger">
    <div class="title-box">⚡ Palabra Clave (Trigger)</div>
    <div class="box">
      <input type="text" df-keywords placeholder="Ej: precio, info" />
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

const htmlAction = `
  <div class="node-action">
    <div class="title-box">⚡ Realizar Acciones</div>
    <div class="box" style="padding-bottom:10px;">
      <div class="action-node-preview">
        <span class="anp-empty">Selecciona este nodo para configurar</span>
      </div>
    </div>
  </div>
`;

// Registrar nodos estáticos
editor.registerNode('trigger', htmlTrigger);
editor.registerNode('card', htmlCard);
editor.registerNode('action', htmlAction);

// ─────────────────────────────────────────────
// Agregar nodo Mensaje (dinámico, soporta hasta 20 botones)
// ─────────────────────────────────────────────
function addMessageNode(posX, posY) {
  const tempHtml = `<div class="node-message"><div class="title-box">💬 Enviar Mensaje</div><div class="box node-blocks-container" style="padding:16px;"></div></div>`;
  const nodeId = editor.addNode('message', 1, 20, posX, posY, 'message', { _blocks: '[]' }, tempHtml);
  
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
  document.getElementById('config-title').innerText = 'Inspector de Mensaje';
  const blocks = nodeBlocksState[nodeId] || [];
  let html = '<div class="insp-blocks-list" id="insp-blocks-list">';
  
  blocks.forEach((block, idx) => {
    html += `<div class="insp-block-card" style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:12px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
      <div class="insp-block-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-weight:600; font-size:13px; color:#374151;">${block.type === 'text' ? '📝 Texto' : '🖼️ Imagen'}</span>
        <button class="insp-del-btn" onclick="deleteBlock('${nodeId}', ${idx})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:16px;">×</button>
      </div>
      <div class="insp-block-body">`;
      
    if (block.type === 'text') {
      html += `<textarea class="cfg-input" style="width:100%; min-height:80px; margin-bottom:8px;" oninput="updateBlockContent('${nodeId}', ${idx}, this.value)" placeholder="Escribe tu mensaje...">${block.content}</textarea>`;
    } else if (block.type === 'image') {
      html += `
        <label style="font-size:11px; color:var(--text-muted); margin-bottom:4px; display:block;">URL de la Imagen</label>
        <input class="cfg-input" type="text" style="width:100%; margin-bottom:8px;" value="${block.url || ''}" oninput="updateBlockUrl('${nodeId}', ${idx}, this.value)" placeholder="https://..." />
      `;
    }

    // Botones del bloque
    html += `<div class="insp-btns-list" style="margin-top:10px;">`;
    (block.buttons || []).forEach((btn, bIdx) => {
      html += `
        <div style="background:#f9fafb; padding:10px; border-radius:6px; border:1px solid #e5e7eb; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:11px; font-weight:600; color:#6b7280; text-transform:uppercase;">Botón ${bIdx + 1}</span>
            <button onclick="deleteButton('${nodeId}', ${idx}, ${bIdx})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:12px;">Eliminar</button>
          </div>
          <input type="text" class="cfg-input" style="width:100%; margin-bottom:6px; padding:6px; font-size:12px;" value="${btn.title}" oninput="updateBtnTitle('${nodeId}', ${idx}, ${bIdx}, this.value)" placeholder="Título del botón..." />
          <select class="cfg-input" style="width:100%; padding:6px; font-size:12px; margin-bottom:${btn.type==='web_url'?'6px':'0'};" onchange="updateBtnType('${nodeId}', ${idx}, ${bIdx}, this.value)">
            <option value="postback" ${btn.type === 'postback'?'selected':''}>Continuar Flujo</option>
            <option value="web_url" ${btn.type === 'web_url'?'selected':''}>Abrir Web</option>
          </select>
          ${btn.type === 'web_url' ? `<input type="text" class="cfg-input" style="width:100%; padding:6px; font-size:12px; margin-bottom:0;" value="${btn.url||''}" oninput="updateBtnUrl('${nodeId}', ${idx}, ${bIdx}, this.value)" placeholder="https://..." />` : ''}
        </div>
      `;
    });
    html += `</div>`;
    
    if ((block.buttons || []).length < 3) {
      html += `<button class="btn-add" onclick="addButton('${nodeId}', ${idx})" style="width:100%; padding:8px; border:1px dashed #d1d5db; background:#f9fafb; color:var(--primary); border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;">+ Añadir Botón</button>`;
    }
    
    html += `</div></div>`;
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

// Global window functions for the generated HTML
window.updateBlockContent = (nodeId, idx, val) => { nodeBlocksState[nodeId][idx].content = val; renderBlocksInNode(nodeId); };
window.updateBlockUrl = (nodeId, idx, val) => { nodeBlocksState[nodeId][idx].url = val; renderBlocksInNode(nodeId); };
window.deleteBlock = (nodeId, idx) => { nodeBlocksState[nodeId].splice(idx, 1); renderBlocksInNode(nodeId); renderMessageInspector(nodeId); };
window.addBlock = (nodeId, type) => { nodeBlocksState[nodeId].push({id: generateId(), type, content: type==='text'?'Nuevo texto':'', url:'', buttons:[]}); renderBlocksInNode(nodeId); renderMessageInspector(nodeId); };
window.addButton = (nodeId, idx) => { nodeBlocksState[nodeId][idx].buttons.push({title:'Nuevo Botón', type:'postback', url:''}); renderBlocksInNode(nodeId); renderMessageInspector(nodeId); };
window.deleteButton = (nodeId, idx, bIdx) => { nodeBlocksState[nodeId][idx].buttons.splice(bIdx, 1); renderBlocksInNode(nodeId); renderMessageInspector(nodeId); };
window.updateBtnTitle = (nodeId, idx, bIdx, val) => { nodeBlocksState[nodeId][idx].buttons[bIdx].title = val; renderBlocksInNode(nodeId); };
window.updateBtnType = (nodeId, idx, bIdx, val) => { nodeBlocksState[nodeId][idx].buttons[bIdx].type = val; renderMessageInspector(nodeId); };
window.updateBtnUrl = (nodeId, idx, bIdx, val) => { nodeBlocksState[nodeId][idx].buttons[bIdx].url = val; };

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
    const res = await fetch('/api/flows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(flowsConfig) });
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
    }
  }
}, 150);
