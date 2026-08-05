/**
 * Agents Studio - Controller
 * Maneja la lógica de la UI y la comunicación con el Backend.
 */

const AgentsStudio = (() => {
  // Función helper para escapar HTML y prevenir XSS
  const escapeHtml = (text) => {
    if (!text || typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Estado local
  const state = {
    activeAgent: null,
    isGraphLoaded: false,
    isGraphRendering: false, // guarda de concurrencia para mermaid.render
    graphRenderSeq: 0        // ID único por render (evita colisión de IDs en el DOM)
  };

  // Referencias DOM
  const dom = {
    modal: document.getElementById('config-modal'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    contextInput: document.getElementById('ai-context'),
    saveContextBtn: document.getElementById('btn-save-context'),
    saveStatus: document.getElementById('save-status'),
    mermaidGraph: document.getElementById('mermaid-graph'),
    graphLoader: document.getElementById('graph-loader'),
    skillsList: document.getElementById('skills-list'),
    knowledgeList: document.getElementById('knowledge-list'),
    knowledgeModal: document.getElementById('knowledge-modal'),
    knTitle: document.getElementById('kn-title'),
    knContent: document.getElementById('kn-content'),
    statStates: document.getElementById('stat-states'),
    statTools: document.getElementById('stat-tools')
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
        } else if (targetId === 'tab-skills' && !state.skillsLoaded) {
          loadSkills();
        } else if (targetId === 'tab-knowledge' && !state.knowledgeLoaded) {
          loadKnowledge();
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
    state.skillsLoaded = false;
    state.knowledgeLoaded = false;
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
      const res = await fetch('/api/ai/master-context');
      const data = await res.json();

      if (data.context && data.context.trim().length > 0) {
        dom.contextInput.value = data.context;
        dom.contextInput.disabled = false;
        dom.saveContextBtn.disabled = false;
      } else {
        dom.contextInput.value = '';
        dom.contextInput.disabled = true;
        dom.saveContextBtn.disabled = true;
        showStatus('⚠️ El contexto maestro no está disponible. Contacta al administrador.', true);
      }
    } catch (err) {
      console.error('Error cargando contexto:', err);
      dom.contextInput.value = '';
      dom.contextInput.disabled = true;
      dom.saveContextBtn.disabled = true;
      showStatus('❌ Error al cargar el contexto. Verifica la conexión al servidor.', true);
    }
  };

  /**
   * Guarda el contexto editado en el backend
   */
  const saveContext = async () => {
    const newContext = dom.contextInput.value;
    try {
      const res = await fetch('/api/ai/master-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: newContext })
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
    // Guarda de concurrencia: dos clicks seguidos en "Refrescar" podían
    // dejar dos renders compitiendo por el mismo contenedor.
    if (state.isGraphRendering) return;
    state.isGraphRendering = true;
    try {
      dom.graphLoader.style.display = 'flex';
      dom.mermaidGraph.innerHTML = '';
      
      const res = await fetch('/api/langgraph/diagram');
      if (!res.ok) throw new Error('Network response was not ok');
      const { diagram } = await res.json();
      
      dom.graphLoader.style.display = 'none';
      
      if (diagram && window.mermaid) {
        const renderId = `langgraph-mermaid-${++state.graphRenderSeq}`;
        const { svg } = await mermaid.render(renderId, diagram);
        dom.mermaidGraph.innerHTML = svg;
        state.isGraphLoaded = true;
      } else {
        dom.mermaidGraph.innerHTML = '<p>El diagrama no está disponible o Mermaid no cargó.</p>';
      }
    } catch (error) {
      console.error("Error al cargar diagrama:", error);
      dom.graphLoader.style.display = 'none';
      dom.mermaidGraph.innerHTML = '<p class="text-warning">Error cargando el grafo. Asegúrate de que el servidor está corriendo.</p>';
    } finally {
      state.isGraphRendering = false;
    }
  };

  /**
   * Carga los contadores reales de la tarjeta del agente.
   * Fuente única de verdad: el backend (CommandRegistry y SALES_STATES).
   * Evita la incoherencia de números hardcodeados en el HTML.
   */
  const loadAgentStats = async () => {
    const setStat = (el, value) => { if (el) el.textContent = value; };
    try {
      const [toolsRes, statesRes] = await Promise.all([
        fetch('/api/langgraph/tools'),
        fetch('/api/langgraph/states')
      ]);
      if (toolsRes.ok) {
        const { tools } = await toolsRes.json();
        setStat(dom.statTools, Array.isArray(tools) ? tools.length : '?');
      } else { setStat(dom.statTools, '?'); }

      if (statesRes.ok) {
        const { states } = await statesRes.json();
        setStat(dom.statStates, Array.isArray(states) ? states.length : '?');
      } else { setStat(dom.statStates, '?'); }
    } catch (e) {
      console.error('Error cargando estadísticas del agente:', e);
      setStat(dom.statTools, '?');
      setStat(dom.statStates, '?');
    }
  };

  /**
   * Carga las habilidades (tools) dinámicamente
   */
  const loadSkills = async () => {
    try {
      const res = await fetch('/api/langgraph/tools');
      if (!res.ok) throw new Error('Error al cargar habilidades');
      const data = await res.json();

      dom.skillsList.innerHTML = '';
      if (data.tools && data.tools.length > 0) {
        let html = '';
        data.tools.forEach(tool => {
          const toolName = escapeHtml(tool.function.name).replace(/_/g, ' ');
          const description = escapeHtml(tool.function.description);
          html += `
            <div class="skill-item">
              <i class="fas fa-tools text-primary"></i>
              <div class="skill-info">
                <h4>${toolName}</h4>
                <p><code>${escapeHtml(tool.function.name)}</code>: ${description}</p>
              </div>
              <!-- Badge de solo lectura: NO es un interruptor.
                   No existe endpoint de activación/desactivación, y una UI
                   que finge control es peor que no tenerlo (Shevat). -->
              <div class="toggle active" title="Registrada en el CommandRegistry"><i class="fas fa-check"></i></div>
            </div>
          `;
        });
        dom.skillsList.innerHTML = html;
        state.skillsLoaded = true;
      } else {
        dom.skillsList.innerHTML = '<p>No hay habilidades configuradas.</p>';
      }
    } catch (e) {
      console.error(e);
      dom.skillsList.innerHTML = '<p class="text-warning">Error al cargar habilidades.</p>';
    }
  };

  /**
   * Carga los conocimientos (RAG)
   */
  const loadKnowledge = async () => {
    try {
      const res = await fetch('/api/ai/knowledge');
      if (!res.ok) throw new Error('Error al cargar conocimiento');
      const data = await res.json();

      dom.knowledgeList.innerHTML = '';
      if (data && data.length > 0) {
        let html = '';
        data.forEach(kn => {
          const title = escapeHtml(kn.section_title);
          const raw = (kn.content || '').substring(0, 100);
          const preview = escapeHtml(raw);
          const id = escapeHtml(String(kn.id));
          html += `
            <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; gap: 1rem; align-items: flex-start;">
              <div style="flex: 1; min-width: 0;">
                <h4 style="margin: 0 0 0.5rem 0; color: #fff;">${title}</h4>
                <p style="margin: 0; font-size: 0.9rem; color: #aaa;">${preview}${raw.length === 100 ? '...' : ''}</p>
              </div>
              <!-- Sin onclick inline: el título puede contener comillas.
                   Delegación de eventos + data-attribute (ver initKnowledgeDelegation). -->
              <button class="btn-close" title="Eliminar conocimiento" data-kn-delete="${id}">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          `;
        });
        dom.knowledgeList.innerHTML = html;
        state.knowledgeLoaded = true;
      } else {
        dom.knowledgeList.innerHTML = '<p style="color: #9ba1a6;">Aún no hay bases de conocimiento agregadas.</p>';
      }
    } catch (e) {
      console.error(e);
      dom.knowledgeList.innerHTML = '<p class="text-warning">Error al cargar conocimiento.</p>';
    }
  };

  /**
   * Elimina una base de conocimiento del índice RAG.
   * Patrón: delegación de eventos sobre el contenedor (un solo listener,
   * sobrevive al re-render de la lista).
   */
  const initKnowledgeDelegation = () => {
    if (!dom.knowledgeList) return;
    dom.knowledgeList.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-kn-delete]');
      if (!btn) return;
      const id = btn.getAttribute('data-kn-delete');
      if (!confirm('¿Eliminar esta base de conocimiento? El agente dejará de usarla.')) return;

      btn.disabled = true;
      try {
        const res = await fetch(`/api/ai/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('DELETE falló');
        state.knowledgeLoaded = false;
        await loadKnowledge();
        showStatus('Conocimiento eliminado.');
      } catch (err) {
        console.error(err);
        btn.disabled = false;
        showStatus('No se pudo eliminar el conocimiento.', true);
      }
    });
  };

  const openAddKnowledgeModal = () => {
    dom.knowledgeModal.classList.remove('hidden');
    dom.knTitle.value = '';
    dom.knContent.value = '';
  };

  const closeAddKnowledgeModal = () => {
    dom.knowledgeModal.classList.add('hidden');
  };

  const saveKnowledge = async () => {
    const title = dom.knTitle.value.trim();
    const content = dom.knContent.value.trim();
    
    if (!title || !content) {
      alert("Por favor completa ambos campos.");
      return;
    }

    try {
      const res = await fetch('/api/ai/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_title: title, content })
      });
      
      if (res.ok) {
        closeAddKnowledgeModal();
        state.knowledgeLoaded = false;
        loadKnowledge(); // Refrescar lista
        showStatus('Conocimiento agregado exitosamente.');
      } else {
        alert("Error al guardar conocimiento. Asegúrate de tener OPENAI_API_KEY configurada para los embeddings.");
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión.");
    }
  };

  // Inicialización global
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initKnowledgeDelegation();
    loadAgentStats();
    if (window.mermaid) {
      // Tema oscuro: el Studio usa fondo dark; 'default' era ilegible.
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
    }
  });

  // API Pública
  return {
    openConfigModal,
    closeConfigModal,
    saveContext,
    loadGraph,
    openAddKnowledgeModal,
    closeAddKnowledgeModal,
    saveKnowledge,
    loadAgentStats
  };
})();

// Exponer al scope global para los onclick en HTML
window.agentsStudio = AgentsStudio;
