const id = document.getElementById("drawflow");
const editor = new Drawflow(id);
editor.reroute = true;
editor.start();

// ─────────────────────────────────────────────
// Estado global: datos de botones por nodo
// (Drawflow solo guarda campos df-*, los botones
//  dinámicos se guardan aquí y en el JSON exportado)
// ─────────────────────────────────────────────
const nodeButtonsState = {}; // { nodeId: [ {title, type, url}, ... ] }

// ─────────────────────────────────────────────
// Helpers: construir el HTML interno de los botones
// ─────────────────────────────────────────────
function renderButtonsInNode(nodeId) {
  const container = document.querySelector(`#node-${nodeId} .btn-list`);
  if (!container) return;
  const btns = nodeButtonsState[nodeId] || [];
  container.innerHTML = '';
  btns.forEach((btn, idx) => {
    const row = document.createElement('div');
    row.className = 'btn-row';
    row.innerHTML = `
      <span class="btn-label">${btn.title || 'Sin título'}</span>
      <button class="btn-edit-icon" data-nodeid="${nodeId}" data-idx="${idx}" title="Editar">✏️</button>
    `;
    container.appendChild(row);
  });

  // Mostrar/ocultar el botón de agregar
  const addBtn = container.parentElement.querySelector('.btn-add');
  if (addBtn) addBtn.style.display = btns.length >= 3 ? 'none' : 'flex';

  // Reposicionar conectores de salida
  setTimeout(() => repositionOutputs(nodeId), 30);
}

// ─────────────────────────────────────────────
// Template HTML del nuevo nodo unificado
// ─────────────────────────────────────────────
function buildMessageNodeHtml(nodeId) {
  return `
  <div class="node-message" data-nodeid="${nodeId}">
    <div class="title-box">💬 Enviar Mensaje</div>
    <div class="box">
      <textarea df-message placeholder="Escribe el mensaje del bot..."></textarea>
      <div class="btn-list"></div>
      <button class="btn-add" data-nodeid="${nodeId}">+ Añadir botón</button>
    </div>
  </div>
  `;
}

// ─────────────────────────────────────────────
// Definición de Nodos: Trigger, Card, Action
// (el nodo Message se construye dinámicamente)
// ─────────────────────────────────────────────
const htmlTrigger = `
  <div class="node-trigger">
    <div class="title-box">⚡ Palabra Clave</div>
    <div class="box">
      <input type="text" df-keywords placeholder="Ej: precio, info" />
    </div>
  </div>
`;

const htmlCard = `
  <div class="node-card">
    <div class="title-box">🖼️ Tarjeta (Imagen)</div>
    <div class="box">
      <div style="margin-bottom:10px;">
        <label style="font-size:11px; color:#aaa;">Opcional: Subir desde tu PC</label>
        <input type="file" class="file-upload" accept="image/*" style="width:100%; margin-top:3px; background:#222; border:1px solid #444; color:#fff;" />
        <span class="upload-status" style="font-size:10px; display:block; margin-top:2px;"></span>
      </div>
      <input type="text" df-image_url placeholder="URL pública (Se llena sola al subir)" />
      <input type="text" df-title placeholder="Título principal" />
      <input type="text" df-subtitle placeholder="Subtítulo (Opcional)" />
      <hr style="border:0; border-top:1px solid #333; margin:10px 0;">
      <input type="text" df-btn_title placeholder="Texto del botón" />
      <select df-btn_type><option value="postback">Acción (Cable)</option><option value="web_url">Sitio Web</option></select>
      <input type="text" df-btn_url placeholder="URL (Si es Sitio Web)" />
    </div>
  </div>
`;

const htmlAction = `
  <div class="node-action">
    <div class="title-box">⚡ Acción (Etiqueta)</div>
    <div class="box">
      <input type="text" df-tag placeholder="Nombre de la etiqueta" />
      <p style="font-size:11px; color:#aaa; margin:5px 0 0 0;">Esta etiqueta se guardará en el CRM</p>
    </div>
  </div>
`;

// Registrar nodos estáticos
editor.registerNode('trigger', htmlTrigger);
editor.registerNode('card', htmlCard);
editor.registerNode('action', htmlAction);

// ─────────────────────────────────────────────
// Función que agrega un nodo Message al canvas
// ─────────────────────────────────────────────
function addMessageNode(posX, posY) {
  const tempHtml = `<div class="node-message"><div class="title-box">💬 Enviar Mensaje</div><div class="box"><textarea df-message placeholder="Escribe el mensaje del bot..."></textarea><div class="btn-list"></div><button class="btn-add">+ Añadir botón</button></div></div>`;
  // 1 entrada, 4 salidas: output_1 = siguiente paso, output_2/3/4 = botones 1/2/3
  const nodeId = editor.addNode('message', 1, 4, posX, posY, 'message', { message: '', _btns: '[]' }, tempHtml);

  nodeButtonsState[nodeId] = [];

  setTimeout(() => {
    const nodeEl = document.querySelector(`#node-${nodeId}`);
    if (nodeEl) {
      const addBtn = nodeEl.querySelector('.btn-add');
      if (addBtn) addBtn.setAttribute('data-nodeid', nodeId);
      const nodeDiv = nodeEl.querySelector('.node-message');
      if (nodeDiv) nodeDiv.setAttribute('data-nodeid', nodeId);
    }
    repositionOutputs(nodeId);
  }, 80);

  return nodeId;
}

// ─────────────────────────────────────────────
// Reposicionar conectores de salida dinámicamente
// output_1 → "Siguiente paso" (abajo del nodo)
// output_2/3/4 → alineados con cada fila de botón
// ─────────────────────────────────────────────
function repositionOutputs(nodeId) {
  const nodeEl = document.querySelector(`#node-${nodeId}`);
  if (!nodeEl) return;

  const btns = nodeButtonsState[nodeId] || [];
  const btnRows = nodeEl.querySelectorAll('.btn-row');
  const nodeRect = nodeEl.getBoundingClientRect();

  // output_1: "Siguiente paso" pegado al fondo del nodo
  const out1 = nodeEl.querySelector('.output_1');
  if (out1) {
    out1.style.position = 'absolute';
    out1.style.top = (nodeEl.offsetHeight - 10) + 'px';
    out1.style.right = '-9px';
    out1.style.display = 'block';
  }

  // output_2, output_3, output_4: uno por fila de botón
  for (let i = 0; i < 3; i++) {
    const out = nodeEl.querySelector(`.output_${i + 2}`);
    if (!out) continue;

    if (i < btns.length && btnRows[i]) {
      const btnRect = btnRows[i].getBoundingClientRect();
      const relTop = (btnRect.top - nodeRect.top) + btnRect.height / 2;
      out.style.position = 'absolute';
      out.style.top = relTop + 'px';
      out.style.right = '-9px';
      out.style.display = 'block';
    } else {
      out.style.display = 'none';
    }
  }
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
  } else if (type === 'card') {
    editor.addNode('card', 1, 1, posX, posY, 'card', {
      image_url: '', title: '', subtitle: '',
      btn_title: '', btn_type: 'postback', btn_url: ''
    }, htmlCard);
  } else if (type === 'action') {
    editor.addNode('action', 1, 1, posX, posY, 'action', { tag: '' }, htmlAction);
  }
});

// ─────────────────────────────────────────────
// Panel lateral: Editar botón
// ─────────────────────────────────────────────
let activeBtnMeta = null; // { nodeId, idx }

function openBtnPanel(nodeId, idx) {
  activeBtnMeta = { nodeId, idx };
  const btn = (nodeButtonsState[nodeId] || [])[idx] || { title: '', type: 'postback', url: '' };

  document.getElementById('config-title').innerText = 'Editar Botón';
  document.getElementById('config-body').innerHTML = `
    <label class="cfg-label">Título del botón</label>
    <input id="cfg-btn-title" class="cfg-input" type="text" value="${btn.title}" placeholder="Ej: Ver catálogo" />

    <label class="cfg-label" style="margin-top:14px;">Cuando se presione este botón</label>
    <div class="cfg-type-list">
      <div class="cfg-type-item ${btn.type === 'postback' ? 'active' : ''}" data-type="postback">
        <span>🔀</span> Seleccionar paso existente
      </div>
      <div class="cfg-type-item ${btn.type === 'web_url' ? 'active' : ''}" data-type="web_url">
        <span>🌐</span> Abrir sitio web
      </div>
    </div>

    <div id="cfg-url-wrap" style="margin-top:10px; display:${btn.type === 'web_url' ? 'block' : 'none'};">
      <label class="cfg-label">URL del sitio web</label>
      <input id="cfg-btn-url" class="cfg-input" type="text" value="${btn.url || ''}" placeholder="https://..." />
    </div>

    <hr style="border:0; border-top:1px solid #2a2d3e; margin:16px 0;">
    <button id="cfg-btn-delete" style="background:#ef444420; color:#ef4444; border:1px solid #ef444450; padding:8px 14px; border-radius:6px; cursor:pointer; width:100%; font-size:13px;">🗑️ Eliminar botón</button>
  `;

  // Eventos del panel
  document.querySelectorAll('.cfg-type-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.cfg-type-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('cfg-url-wrap').style.display = item.dataset.type === 'web_url' ? 'block' : 'none';
      saveBtnFromPanel();
    });
  });

  document.getElementById('cfg-btn-title').addEventListener('input', saveBtnFromPanel);
  document.getElementById('cfg-btn-url')?.addEventListener('input', saveBtnFromPanel);

  document.getElementById('cfg-btn-delete').addEventListener('click', () => {
    nodeButtonsState[nodeId].splice(idx, 1);
    renderButtonsInNode(nodeId);
    closePanel();
  });

  document.getElementById('config-panel').classList.remove('hidden');
}

function saveBtnFromPanel() {
  if (!activeBtnMeta) return;
  const { nodeId, idx } = activeBtnMeta;
  const title = document.getElementById('cfg-btn-title')?.value || '';
  const type = document.querySelector('.cfg-type-item.active')?.dataset.type || 'postback';
  const url = document.getElementById('cfg-btn-url')?.value || '';
  if (!nodeButtonsState[nodeId]) nodeButtonsState[nodeId] = [];
  nodeButtonsState[nodeId][idx] = { title, type, url };
  renderButtonsInNode(nodeId);
}

function closePanel() {
  activeBtnMeta = null;
  document.getElementById('config-panel').classList.add('hidden');
}

document.getElementById('close-config').addEventListener('click', closePanel);

// ─────────────────────────────────────────────
// Delegación de eventos en el canvas
// ─────────────────────────────────────────────
id.addEventListener('click', e => {
  // Clic en "Añadir botón"
  const addBtn = e.target.closest('.btn-add');
  if (addBtn) {
    const nodeId = addBtn.getAttribute('data-nodeid');
    if (!nodeId) return;
    if (!nodeButtonsState[nodeId]) nodeButtonsState[nodeId] = [];
    if (nodeButtonsState[nodeId].length >= 3) return;
    const idx = nodeButtonsState[nodeId].length;
    nodeButtonsState[nodeId].push({ title: 'Nuevo Botón', type: 'postback', url: '' });
    renderButtonsInNode(nodeId);
    openBtnPanel(nodeId, idx);
    return;
  }

  // Clic en editar botón (ícono lápiz)
  const editBtn = e.target.closest('.btn-edit-icon');
  if (editBtn) {
    const nodeId = editBtn.getAttribute('data-nodeid');
    const idx = parseInt(editBtn.getAttribute('data-idx'), 10);
    openBtnPanel(nodeId, idx);
  }
});

// ─────────────────────────────────────────────
// Subida de imágenes
// ─────────────────────────────────────────────
id.addEventListener('change', async (e) => {
  if (e.target.classList.contains('file-upload')) {
    const file = e.target.files[0];
    if (!file) return;
    const statusSpan = e.target.nextElementSibling;
    statusSpan.innerText = "Subiendo archivo...";
    statusSpan.style.color = "#f59e0b";
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        statusSpan.innerText = "¡Subida con éxito!";
        statusSpan.style.color = "#10b981";
        const box = e.target.closest('.box');
        const urlInput = box.querySelector('input[df-image_url]');
        urlInput.value = data.url;
        urlInput.dispatchEvent(new Event('change'));
      } else {
        statusSpan.innerText = "Error: " + (data.error || 'Desconocido');
        statusSpan.style.color = "#ef4444";
      }
    } catch(err) {
      statusSpan.innerText = "Error de red.";
      statusSpan.style.color = "#ef4444";
    }
  }
});

// ─────────────────────────────────────────────
// buildStepsFromNode (recursivo)
// ─────────────────────────────────────────────
function buildStepsFromNode(nodeId, nodes, flowsConfig) {
  let steps = [];
  let currentId = nodeId;

  while (currentId) {
    const node = nodes[currentId];
    if (!node) break;

    if (node.name === 'message') {
      const btns = nodeButtonsState[currentId] || JSON.parse(node.data._btns || '[]');
      if (btns.length === 0) {
        // Sin botones → texto puro, sigue por output_1
        steps.push({ type: 'text', message: node.data.message });
        currentId = node.outputs.output_1?.connections[0]?.node;
      } else {
        // Con botones → template; cada botón postback genera un flujo oculto
        // que se traza desde el cable de output_2, output_3 o output_4
        const templateBtns = btns.map((btn, i) => {
          if (btn.type === 'web_url') {
            return { type: 'web_url', title: btn.title, url: btn.url };
          } else {
            const payload = `POSTBACK_${currentId}_BTN${i}`;
            // Trazar el cable del output correspondiente (output_2 = btn0, output_3 = btn1, output_4 = btn2)
            const connectedNodeId = node.outputs[`output_${i + 2}`]?.connections[0]?.node;
            if (connectedNodeId) {
              const hiddenSteps = buildStepsFromNode(connectedNodeId, nodes, flowsConfig);
              if (hiddenSteps.length > 0) {
                flowsConfig.flows.push({
                  id: `flow_${payload}`,
                  name: `Ruta Botón ${btn.title}`,
                  keywords: [payload],
                  matchType: 'contains',
                  steps: hiddenSteps
                });
              }
            }
            return { type: 'postback', title: btn.title, payload };
          }
        });
        steps.push({ type: 'template', message: node.data.message, buttons: templateBtns });
        // El flujo principal continúa por output_1 (siguiente paso)
        currentId = node.outputs.output_1?.connections[0]?.node;
      }
    }
    else if (node.name === 'card') {
      const cardData = {
        image_url: node.data.image_url?.trim() || '',
        title: node.data.title?.trim() || '',
        subtitle: node.data.subtitle?.trim() || '',
        btn_title: node.data.btn_title?.trim() || '',
        btn_type: node.data.btn_type,
        btn_url: node.data.btn_url?.trim() || ''
      };
      if (cardData.btn_type === 'postback') {
        const payload = `POSTBACK_${currentId}_CARD`;
        cardData.btn_payload = payload;
        const connectedNodeId = node.outputs.output_1?.connections[0]?.node;
        if (connectedNodeId) {
          const hiddenSteps = buildStepsFromNode(connectedNodeId, nodes, flowsConfig);
          if (hiddenSteps.length > 0) {
            flowsConfig.flows.push({ id: `flow_${payload}`, name: `Ruta Tarjeta`, keywords: [payload], matchType: 'contains', steps: hiddenSteps });
          }
        }
      }
      steps.push({ type: 'card', message: '', card: cardData });
      currentId = null;
    }
    else if (node.name === 'action') {
      const tag = node.data.tag?.trim();
      if (tag) steps.push({ type: 'action', tag });
      currentId = node.outputs.output_1?.connections[0]?.node;
    }
    else {
      break;
    }
  }
  return steps;
}

// ─────────────────────────────────────────────
// Guardar: serializar botones en _btns antes de exportar
// ─────────────────────────────────────────────
document.getElementById('btn-save').addEventListener('click', async () => {
  // Serializar el estado de botones en el campo df-_btns de cada nodo message
  for (const nodeId in nodeButtonsState) {
    const nodeEl = document.querySelector(`#node-${nodeId} [df-_btns]`);
    if (nodeEl) {
      nodeEl.value = JSON.stringify(nodeButtonsState[nodeId]);
      nodeEl.dispatchEvent(new Event('change'));
    } else {
      // Forzar sincronización mediante la API interna de Drawflow
      if (editor.drawflow.drawflow.Home.data[nodeId]) {
        editor.drawflow.drawflow.Home.data[nodeId].data._btns = JSON.stringify(nodeButtonsState[nodeId]);
      }
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
      const newFlow = {
        id: `flow_${nodeId}`,
        name: `Flujo Visual ${nodeId}`,
        keywords: keywordsList,
        matchType: 'contains',
        steps: []
      };
      const nextNodeId = node.outputs.output_1?.connections[0]?.node;
      if (nextNodeId) {
        newFlow.steps = buildStepsFromNode(nextNodeId, nodes, flowsConfig);
      }
      if (keywordsList.length > 0) flowsConfig.flows.push(newFlow);
    }
  }

  const btn = document.getElementById('btn-save');
  btn.innerText = "Guardando...";
  try {
    const res = await fetch('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flowsConfig)
    });
    if (res.ok) {
      btn.innerText = "¡Guardado con éxito!";
      setTimeout(() => btn.innerText = "Guardar Cambios", 2000);
    }
  } catch(e) {
    btn.innerText = "Error al guardar";
  }
});

// ─────────────────────────────────────────────
// Nodo de ejemplo inicial
// ─────────────────────────────────────────────
setTimeout(() => {
  editor.addNode('trigger', 0, 1, 100, 200, 'trigger', { keywords: 'precio, valor' }, htmlTrigger);
  const msgId = addMessageNode(450, 200);
  setTimeout(() => {
    editor.addConnection(1, msgId, 'output_1', 'input_1');
    // Poner texto de ejemplo
    if (editor.drawflow.drawflow.Home.data[msgId]) {
      editor.drawflow.drawflow.Home.data[msgId].data.message = '¡Hola! Nuestros faroles rústicos comienzan en $150.';
    }
  }, 100);
}, 150);
