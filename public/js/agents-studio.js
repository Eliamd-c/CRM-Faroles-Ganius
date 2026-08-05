/**
 * Agents Studio - Controller
 * Maneja la lógica de la UI y la comunicación con el Backend.
 */

const AgentsStudio = (() => {
  // Estado local
  const state = {
    activeAgent: null,
    isGraphLoaded: false
  };

  // Referencias DOM
  const dom = {
    modal: document.getElementById('config-modal'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    contextInput: document.getElementById('ai-context'),
    saveStatus: document.getElementById('save-status'),
    mermaidGraph: document.getElementById('mermaid-graph'),
    graphLoader: document.getElementById('graph-loader')
  };

  /**
   * Inicializa los event listeners de las pestañas
   */
  const initTabs = () => {
    dom.tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Remover activo de todos
        dom.tabBtns.forEach(b => b.classList.remove('active'));
        dom.tabPanes.forEach(p => p.classList.remove('active'));
        
        // Activar el clickeado
        const targetId = e.currentTarget.getAttribute('data-target');
        e.currentTarget.classList.add('active');
        document.getElementById(targetId).classList.add('active');

        // Renderizado perezoso del grafo
        if (targetId === 'tab-inspector' && !state.isGraphLoaded) {
          loadGraph();
        }
      });
    });
  };

  /**
   * Abre el modal para un agente específico
   * @param {string} agentId 
   */
  const openConfigModal = async (agentId) => {
    state.activeAgent = agentId;
    dom.modal.classList.remove('hidden');
    
    // Resetear pestañas a la primera
    dom.tabBtns[0].click();
    state.isGraphLoaded = false;
    dom.mermaidGraph.innerHTML = '';
    dom.graphLoader.style.display = 'flex';

    await loadContext();
  };

  /**
   * Cierra el modal
   */
  const closeConfigModal = () => {
    dom.modal.classList.add('hidden');
    state.activeAgent = null;
  };

  /**
   * Carga el contexto del agente desde la BD (Supabase app_config)
   */
  const loadContext = async () => {
    try {
      dom.contextInput.value = 'Cargando contexto maestro...';
      const res = await fetch('/api/config');
      const data = await res.json();
      
      const masterPrompt = data.find(c => c.key === 'AI_MASTER_CONTEXT');
      if (masterPrompt) {
        dom.contextInput.value = masterPrompt.value;
      } else {
        dom.contextInput.value = 'Eres Faroles Genius...'; // Default
      }
    } catch (err) {
      console.error('Error cargando contexto:', err);
      dom.contextInput.value = 'Error al cargar el contexto. Revisa la conexión al servidor.';
    }
  };

  /**
   * Guarda el contexto editado en el backend
   */
  const saveContext = async () => {
    const newContext = dom.contextInput.value;
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'AI_MASTER_CONTEXT', value: newContext })
      });
      
      if (res.ok) {
        showStatus('¡Identidad guardada con éxito!');
      } else {
        showStatus('Error al guardar.', true);
      }
    } catch (err) {
      console.error(err);
      showStatus('Error de conexión.', true);
    }
  };

  /**
   * Muestra mensaje temporal de estado
   */
  const showStatus = (msg, isError = false) => {
    dom.saveStatus.textContent = msg;
    dom.saveStatus.style.color = isError ? '#ff4d4d' : '#00d26a';
    dom.saveStatus.classList.add('show');
    setTimeout(() => {
      dom.saveStatus.classList.remove('show');
    }, 3000);
  };

  /**
   * Carga el grafo Mermaid desde LangGraph
   */
  const loadGraph = async () => {
    try {
      dom.graphLoader.style.display = 'flex';
      dom.mermaidGraph.innerHTML = '';
      
      const res = await fetch('/api/langgraph/diagram');
      if (!res.ok) throw new Error('Network response was not ok');
      const { diagram } = await res.json();
      
      dom.graphLoader.style.display = 'none';
      
      if (diagram && window.mermaid) {
        const { svg } = await mermaid.render('langgraph-mermaid', diagram);
        dom.mermaidGraph.innerHTML = svg;
        state.isGraphLoaded = true;
      } else {
        dom.mermaidGraph.innerHTML = '<p>El diagrama no está disponible o Mermaid no cargó.</p>';
      }
    } catch (error) {
      console.error("Error al cargar diagrama:", error);
      dom.graphLoader.style.display = 'none';
      dom.mermaidGraph.innerHTML = '<p class="text-warning">Error cargando el grafo. Asegúrate de que el servidor está corriendo.</p>';
    }
  };

  // Inicialización global
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    if (window.mermaid) {
      mermaid.initialize({ startOnLoad: false, theme: 'default' });
    }
  });

  // API Pública
  return {
    openConfigModal,
    closeConfigModal,
    saveContext,
    loadGraph
  };
})();

// Exponer al scope global para los onclick en HTML
window.agentsStudio = AgentsStudio;
