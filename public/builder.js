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

// Registrar los tipos de nodos
editor.registerNode('trigger', htmlTrigger);
editor.registerNode('text', htmlText);

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
  }
});

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

      // Seguir el cable hacia el siguiente nodo
      let nextNodeId = node.outputs.output_1?.connections[0]?.node;
      
      // Bucle simple para seguir la cadena (solo texto por ahora)
      while (nextNodeId) {
        const nextNode = nodes[nextNodeId];
        if (nextNode.name === 'text') {
          newFlow.steps.push({
            type: 'text',
            message: nextNode.data.message
          });
        }
        // Buscar el siguiente de la cadena
        nextNodeId = nextNode.outputs.output_1?.connections[0]?.node;
      }
      
      if (keywordsList.length > 0) {
        flowsConfig.flows.push(newFlow);
      } else {
        // Si hay un trigger sin palabras clave, lo tratamos como "Default" (cualquier mensaje)
        flowsConfig.defaultFlow = { steps: newFlow.steps };
      }
    }
  }

  // Asegurar un fallback si el usuario no hizo un default
  if (!flowsConfig.defaultFlow) {
    flowsConfig.defaultFlow = { 
      steps: [{ type: 'text', message: 'Mensaje por defecto. Por favor configura un nodo vacío para cambiar esto.' }] 
    };
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
