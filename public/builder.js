const id = document.getElementById("drawflow");
const editor = new Drawflow(id);
editor.reroute = true;
editor.start();

// Definición de Nodos HTML para Drawflow
const htmlTrigger = `
  <div class="node-trigger">
    <div class="title-box">⚡ Palabra Clave</div>
    <div class="box">
      <input type="text" df-keywords placeholder="Ej: precio, info" />
    </div>
  </div>
`;

const htmlText = `
  <div class="node-text">
    <div class="title-box">💬 Mensaje de Texto</div>
    <div class="box">
      <textarea df-message placeholder="Escribe el mensaje del bot..."></textarea>
    </div>
  </div>
`;

const htmlButtons = `
  <div class="node-buttons">
    <div class="title-box">🔘 Respuestas Rápidas</div>
    <div class="box">
      <textarea df-message placeholder="Texto del mensaje..."></textarea>
      <input type="text" df-btn1 placeholder="Botón 1 (Obligatorio)" />
      <input type="text" df-btn2 placeholder="Botón 2 (Opcional)" />
      <input type="text" df-btn3 placeholder="Botón 3 (Opcional)" />
    </div>
  </div>
`;

const htmlTemplate = `
  <div class="node-template">
    <div class="title-box">🔀 Plantilla de Botones</div>
    <div class="box">
      <textarea df-message placeholder="Texto principal..."></textarea>
      
      <hr style="border:0; border-top:1px solid #333; margin:10px 0;">
      <input type="text" df-btn1_title placeholder="Botón 1 (Obligatorio)" />
      <select df-btn1_type><option value="postback">Acción (Cable)</option><option value="web_url">Sitio Web</option></select>
      <input type="text" df-btn1_url placeholder="URL (Si es Sitio Web)" />
      
      <hr style="border:0; border-top:1px solid #333; margin:10px 0;">
      <input type="text" df-btn2_title placeholder="Botón 2 (Opcional)" />
      <select df-btn2_type><option value="postback">Acción (Cable)</option><option value="web_url">Sitio Web</option></select>
      <input type="text" df-btn2_url placeholder="URL" />

      <hr style="border:0; border-top:1px solid #333; margin:10px 0;">
      <input type="text" df-btn3_title placeholder="Botón 3 (Opcional)" />
      <select df-btn3_type><option value="postback">Acción (Cable)</option><option value="web_url">Sitio Web</option></select>
      <input type="text" df-btn3_url placeholder="URL" />
    </div>
  </div>
`;

// Registrar los tipos de nodos
editor.registerNode('trigger', htmlTrigger);
editor.registerNode('text', htmlText);
editor.registerNode('buttons', htmlButtons);
editor.registerNode('template', htmlTemplate);

// Configuración de Drag & Drop desde la barra lateral
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
  // Ajustar coordenadas para soltar exactamente donde está el cursor
  const rect = id.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Posición ajustada por el zoom y pan del editor
  const posX = x * (editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)) - (editor.precanvas.getBoundingClientRect().x * (editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)));
  const posY = y * (editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)) - (editor.precanvas.getBoundingClientRect().y * (editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)));

  if (type === 'trigger') {
    editor.addNode('trigger', 0, 1, posX, posY, 'trigger', { keywords: '' }, htmlTrigger);
  } else if (type === 'text') {
    editor.addNode('text', 1, 1, posX, posY, 'text', { message: '' }, htmlText);
  } else if (type === 'buttons') {
    editor.addNode('buttons', 1, 1, posX, posY, 'buttons', { message: '', btn1: '', btn2: '', btn3: '' }, htmlButtons);
  } else if (type === 'template') {
    editor.addNode('template', 1, 3, posX, posY, 'template', { 
      message: '', 
      btn1_title: '', btn1_type: 'postback', btn1_url: '',
      btn2_title: '', btn2_type: 'postback', btn2_url: '',
      btn3_title: '', btn3_type: 'postback', btn3_url: ''
    }, htmlTemplate);
  }
});

// Función recursiva para trazar los cables
function buildStepsFromNode(nodeId, nodes, flowsConfig) {
  let steps = [];
  let currentId = nodeId;
  
  while (currentId) {
    const node = nodes[currentId];
    if (!node) break;

    if (node.name === 'text') {
      steps.push({ type: 'text', message: node.data.message });
      currentId = node.outputs.output_1?.connections[0]?.node;
    } 
    else if (node.name === 'buttons') {
      const btns = [];
      if (node.data.btn1 && node.data.btn1.trim()) btns.push({ title: node.data.btn1.trim() });
      if (node.data.btn2 && node.data.btn2.trim()) btns.push({ title: node.data.btn2.trim() });
      if (node.data.btn3 && node.data.btn3.trim()) btns.push({ title: node.data.btn3.trim() });
      steps.push({ type: 'buttons', message: node.data.message, buttons: btns });
      currentId = node.outputs.output_1?.connections[0]?.node;
    }
    else if (node.name === 'template') {
      const templateBtns = [];
      // Para cada botón, comprobamos si tiene cable (postback) o es web
      for (let i = 1; i <= 3; i++) {
        const title = node.data[`btn${i}_title`];
        const type = node.data[`btn${i}_type`];
        const url = node.data[`btn${i}_url`];
        const connectedNodeId = node.outputs[`output_${i}`]?.connections[0]?.node;
        
        if (title && title.trim()) {
          if (type === 'web_url') {
            templateBtns.push({ type: 'web_url', title: title.trim(), url: url?.trim() || '' });
          } else {
            // Postback
            const payload = `POSTBACK_${node.id}_BTN${i}`;
            templateBtns.push({ type: 'postback', title: title.trim(), payload: payload });
            
            // Crear el "Flujo Oculto"
            if (connectedNodeId) {
              const hiddenSteps = buildStepsFromNode(connectedNodeId, nodes, flowsConfig);
              if (hiddenSteps.length > 0) {
                flowsConfig.flows.push({
                  id: `flow_${payload}`,
                  name: `Ruta Oculta ${title.trim()}`,
                  keywords: [payload],
                  matchType: 'contains',
                  steps: hiddenSteps
                });
              }
            }
          }
        }
      }
      steps.push({ type: 'template', message: node.data.message, buttons: templateBtns });
      currentId = null; // Se ramifica, detenemos el camino principal
    }
    else {
      break;
    }
  }
  return steps;
}

// Lógica de Guardado (Traducir de Cajas Visuales a flows.json)
document.getElementById('btn-save').addEventListener('click', async () => {
  const data = editor.export();
  const nodes = data.drawflow.Home.data;
  
  const flowsConfig = { flows: [], defaultFlow: null };

  // Buscar todos los nodos tipo 'trigger'
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

      // Iniciar recorrido
      let nextNodeId = node.outputs.output_1?.connections[0]?.node;
      if (nextNodeId) {
        newFlow.steps = buildStepsFromNode(nextNodeId, nodes, flowsConfig);
      }
      
      if (keywordsList.length > 0) {
        flowsConfig.flows.push(newFlow);
      }
    }
  }

  // Enviar a la API Backend
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
    console.error(e);
    btn.innerText = "Error al guardar";
  }
});

// Inyectar un ejemplo inicial visual en el lienzo
setTimeout(() => {
  editor.addNode('trigger', 0, 1, 100, 200, 'trigger', { keywords: 'precio, valor' }, htmlTrigger);
  editor.addNode('text', 1, 1, 500, 200, 'text', { message: '¡Hola! Nuestros faroles rústicos comienzan en $150. ¿Te gustaría ver el catálogo?' }, htmlText);
  // Conectar nodo 1 al nodo 2
  editor.addConnection(1, 2, 'output_1', 'input_1');
}, 100);
