let mermaidLoaded = false;

async function loadMermaid() {
  if (mermaidLoaded) return true;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.onload = () => {
      mermaid.initialize({ startOnLoad: false, theme: 'default' });
      mermaidLoaded = true;
      resolve(true);
    };
    script.onerror = () => reject(new Error('Fallo al cargar Mermaid.js'));
    document.head.appendChild(script);
  });
}

async function renderGraphDiagram() {
  const container = document.getElementById('mermaid-container');
  container.innerHTML = '<p style="color: #666;">Cargando arquitectura del agente...</p>';

  try {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No autorizado');

    const res = await fetch('/api/langgraph/diagram', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Fallo al cargar el diagrama');
    
    const data = await res.json();
    if (data.diagram) {
      await loadMermaid();
      // Renderizar el gráfico de mermaid
      const { svg } = await mermaid.render('langgraph-diagram-svg', data.diagram);
      container.innerHTML = svg;
    } else {
      container.innerHTML = '<p style="color: red;">No se pudo obtener el diagrama.</p>';
    }
  } catch (err) {
    container.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
  }
}

// Escuchar el evento de click en la pestaña de LangGraph para Lazy Loading
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refresh-graph-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', renderGraphDiagram);
  }

  // Interceptar los clics en las pestañas
  const tabBtns = document.querySelectorAll('.tab-btn');
  let firstTimeLoaded = false;
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (btn.dataset.target === 'langgraph-tab' && !firstTimeLoaded) {
        renderGraphDiagram();
        firstTimeLoaded = true;
      }
    });
  });
});
