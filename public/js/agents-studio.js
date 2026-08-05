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

  /**
   * Escalados: Carga contactos en escalación desde /api/pending-humans
   */
  const loadEscalados = async () => {
    const container = document.getElementById('escalados-container');
    try {
      container.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-spin"></i> Cargando escalados...</div>';

      const res = await fetch('/api/pending-humans');
      if (!res.ok) throw new Error('Error fetching escalados');
      const data = await res.json();

      if (data && Array.isArray(data) && data.length > 0) {
        renderEscaladosTable(data);
      } else {
        renderEscaladosEmpty();
      }
    } catch (error) {
      console.error('Error cargando escalados:', error);
      container.innerHTML = '<p class="text-warning" style="padding: 2rem; text-align: center;">Error al cargar escalados. Verifica la conexión.</p>';
    }
  };

  /**
   * Escalados: Renderiza la tabla de escalados
   */
  const renderEscaladosTable = (escalados) => {
    const container = document.getElementById('escalados-container');
    let html = `
      <table class="escalados-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Pausado hace</th>
            <th class="escalados-razon">Razón</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;

    escalados.forEach(escalado => {
      const username = escapeHtml(escalado.username || 'Desconocido');
      const timeDiff = formatTimeDiff(escalado.paused_at);
      const reasonBadge = formatReasonBadge(escalado.pause_reason);

      html += `
        <tr>
          <td>${username}</td>
          <td>${timeDiff}</td>
          <td class="escalados-razon">${reasonBadge}</td>
          <td>
            <button class="btn-view-escalado" data-escalado-id="${escapeHtml(String(escalado.instagram_id))}">
              <i class="fas fa-eye"></i> Ver
            </button>
          </td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
      <div style="padding: 1rem; text-align: center; font-size: 0.85rem; color: #9ba1a6;">
        Total: ${escalados.length} contacto(s) en escalación
      </div>
    `;

    container.innerHTML = html;
    initEscaladosEventDelegation();
  };

  /**
   * Escalados: Renderiza estado vacío
   */
  const renderEscaladosEmpty = () => {
    const container = document.getElementById('escalados-container');
    container.innerHTML = `
      <div class="escalados-empty">
        <i class="fas fa-check-circle"></i>
        <h3>Sin contactos en escalación</h3>
        <p>El sistema está en orden.</p>
      </div>
    `;
  };

  /**
   * Escalados: Formatea diferencia de tiempo en formato humanizado
   * Ej: "5 min", "2h 30m", "1d 3h"
   */
  const formatTimeDiff = (isoString) => {
    if (!isoString) return 'N/A';

    try {
      const now = new Date();
      const paused = new Date(isoString);

      // Validar que la fecha sea válida (no NaN)
      if (isNaN(paused.getTime())) return 'N/A';

      const diffMs = now - paused;

      if (diffMs < 0) return 'Futuro'; // Error: fecha en el futuro

      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return '0 min';
      if (diffMin < 60) return `${diffMin}m`;
      if (diffHour < 24) {
        const mins = diffMin % 60;
        return mins > 0 ? `${diffHour}h ${mins}m` : `${diffHour}h`;
      }

      const hours = diffHour % 24;
      return hours > 0 ? `${diffDay}d ${hours}h` : `${diffDay}d`;
    } catch (error) {
      console.error('Error en formatTimeDiff:', error);
      return 'N/A';
    }
  };

  /**
   * Escalados: Formatea badge de razón
   */
  const formatReasonBadge = (reason) => {
    const reasonMap = {
      'escalacion': 'Escalación',
      'operador_manual': 'Operador',
      'requiere_ia': 'Requiere IA'
    };

    const label = reasonMap[reason] || reason || 'Desconocida';
    const badgeClass = reason === 'escalacion' ? 'escalacion' :
                       reason === 'operador_manual' ? 'operador' :
                       reason === 'requiere_ia' ? 'requiere_ia' : 'operador';

    return `<span class="escalados-badge ${badgeClass}">${escapeHtml(label)}</span>`;
  };

  /**
   * Escalados: Delegación de eventos para "Ver detalles"
   */
  const initEscaladosEventDelegation = () => {
    const container = document.getElementById('escalados-container');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-view-escalado');
      if (!btn) return;

      const instagramId = btn.getAttribute('data-escalado-id');
      if (!instagramId) return;

      openEscaladoModal(instagramId);
    });
  };

  /**
   * Escalados: Abre el modal con detalles del escalado
   */
  const openEscaladoModal = async (instagramId) => {
    const modal = document.getElementById('escalado-modal');
    if (!modal) return;

    try {
      // Buscar en escalados cargados
      const container = document.getElementById('escalados-container');
      const table = container.querySelector('table');
      if (!table) return;

      const rows = table.querySelectorAll('tbody tr');
      let escaladoData = null;

      rows.forEach(row => {
        const btn = row.querySelector('.btn-view-escalado');
        if (btn && btn.getAttribute('data-escalado-id') === instagramId) {
          // Extraer data de la fila actual
          const cells = row.querySelectorAll('td');
          escaladoData = {
            instagram_id: instagramId,
            username: cells[0].textContent.trim(),
            paused_at: 'N/A', // Necesitaríamos fetch para el timestamp exacto
            pause_reason: 'unknown'
          };
        }
      });

      // Si no lo encontramos en la tabla actual, hacer fetch completo
      if (!escaladoData) {
        const res = await fetch('/api/pending-humans');
        if (!res.ok) throw new Error('Error fetching escalados');
        const escalados = await res.json();
        escaladoData = escalados.find(e => String(e.instagram_id) === String(instagramId));
        if (!escaladoData) throw new Error('Escalado no encontrado');
      }

      // Llenar modal con datos
      document.getElementById('escalado-modal-title').textContent =
        `👤 ${escapeHtml(escaladoData.username)} - Escalado`;
      document.getElementById('escalado-instagram-id').textContent = escapeHtml(String(escaladoData.instagram_id));
      document.getElementById('escalado-name').textContent = escapeHtml(escaladoData.name || 'N/A');
      document.getElementById('escalado-username').textContent = '@' + escapeHtml(escaladoData.username || 'N/A');
      document.getElementById('escalado-paused-at').textContent =
        new Date(escaladoData.paused_at).toLocaleString('es-ES', { timeZone: 'UTC' }) + ' UTC';

      const reasonLabel = {
        'escalacion': 'Escalación Automática',
        'operador_manual': 'Pausado por Operador',
        'requiere_ia': 'Requiere Intervención IA'
      }[escaladoData.pause_reason] || 'Desconocida';
      document.getElementById('escalado-reason').innerHTML = formatReasonBadge(escaladoData.pause_reason);

      // Limpiar formulario
      document.getElementById('escalado-message').value = '';
      document.getElementById('escalado-char-count').textContent = '0';
      document.getElementById('escalado-modal-status').textContent = '';
      document.getElementById('btn-send-escalado').disabled = false;

      // Guardar referencia del escalado actual
      state.currentEscalado = escaladoData;

      // Mostrar modal
      modal.classList.remove('hidden');
    } catch (error) {
      console.error('Error abriendo modal de escalado:', error);
      alert('Error al cargar detalles del escalado.');
    }
  };

  /**
   * Escalados: Cierra el modal
   */
  const closeEscaladoModal = () => {
    const modal = document.getElementById('escalado-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    state.currentEscalado = null;
  };

  /**
   * Escalados: Envía mensaje manual al contacto escalado
   */
  const sendHumanMessage = async () => {
    const message = document.getElementById('escalado-message').value.trim();
    const statusDiv = document.getElementById('escalado-modal-status');
    const sendBtn = document.getElementById('btn-send-escalado');

    // Validaciones
    if (!message || message.length === 0) {
      statusDiv.textContent = '❌ El mensaje no puede estar vacío.';
      statusDiv.style.color = '#ff4d4d';
      return;
    }

    if (message.length > 950) {
      statusDiv.textContent = '❌ El mensaje excede 950 caracteres.';
      statusDiv.style.color = '#ff4d4d';
      return;
    }

    if (!state.currentEscalado || !state.currentEscalado.instagram_id) {
      statusDiv.textContent = '❌ Error: escalado no identificado.';
      statusDiv.style.color = '#ff4d4d';
      return;
    }

    try {
      sendBtn.disabled = true;
      statusDiv.textContent = 'Enviando...';
      statusDiv.style.color = '#9ba1a6';

      const payload = {
        instagram_id: state.currentEscalado.instagram_id,
        message: message
      };

      const res = await fetch('/api/langgraph/inject-human-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al enviar mensaje');
      }

      statusDiv.textContent = '✅ Mensaje enviado correctamente.';
      statusDiv.style.color = '#00d26a';

      // Limpiar y cerrar después de 2 segundos
      setTimeout(() => {
        closeEscaladoModal();
        loadEscalados(); // Refrescar tabla
      }, 2000);
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      statusDiv.textContent = `❌ ${error.message}`;
      statusDiv.style.color = '#ff4d4d';
      sendBtn.disabled = false;
    }
  };

  /**
   * Escalados: Character counter para el textarea
   */
  const initEscaladoCharCounter = () => {
    const messageInput = document.getElementById('escalado-message');
    const charCount = document.getElementById('escalado-char-count');

    if (messageInput && charCount) {
      messageInput.addEventListener('input', () => {
        charCount.textContent = messageInput.value.length;
      });
    }
  };

  /**
   * Escalados: Auto-refresh cada 10 segundos (solo si tab activo)
   */
  const startEscaladosAutoRefresh = () => {
    if (state.escaladosRefreshInterval) clearInterval(state.escaladosRefreshInterval);

    state.escaladosRefreshInterval = setInterval(() => {
      const tabPane = document.getElementById('tab-escalados');
      if (tabPane && tabPane.classList.contains('active')) {
        loadEscalados();
      }
    }, 10000);
  };

  /**
   * Parar auto-refresh
   */
  const stopEscaladosAutoRefresh = () => {
    if (state.escaladosRefreshInterval) {
      clearInterval(state.escaladosRefreshInterval);
      state.escaladosRefreshInterval = null;
    }
  };

  // Inicialización global
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initKnowledgeDelegation();
    initEscaladoCharCounter();
    loadAgentStats();
    if (window.mermaid) {
      // Tema oscuro: el Studio usa fondo dark; 'default' era ilegible.
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
    }

    // Iniciar auto-refresh de escalados
    startEscaladosAutoRefresh();
  });

  // Cleanup
  window.addEventListener('beforeunload', () => {
    stopEscaladosAutoRefresh();
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
    loadAgentStats,
    // Escalados
    loadEscalados,
    openEscaladoModal,
    closeEscaladoModal,
    sendHumanMessage
  };
})();

// Exponer al scope global para los onclick en HTML
window.agentsStudio = AgentsStudio;
