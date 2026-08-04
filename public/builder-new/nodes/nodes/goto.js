/**
 * Goto Node Module
 *
 * Redirects flow to another node or flow.
 */

export const GOTO_HTML = `<div class="mc-node mc-logic"><div class="mc-header"><span>⤴️</span> Goto</div><div class="box goto-node-preview"><em style="color:#8492a6; font-size:11px;">Configura el destino...</em></div></div>`;

export function renderGotoPreview(nodeId, config = {}) {
  const target = config.target_node || config.target_flow;
  return target ? `<div style="background:#dcfce7; padding:8px; border-radius:6px; font-size:11px; color:#166534;">⤴️ Ir a: ${target}</div>` : '<em style="color:#8492a6; font-size:11px;">Sin destino</em>';
}

export function renderGotoInspector(nodeId, data = {}) {
  return {
    title: 'Ir a',
    html: `<div class="config-group"><label class="config-label">Tipo de destino</label><select class="config-input" id="goto-type"><option value="node">Nodo</option><option value="flow">Flujo</option></select></div><div class="config-group"><label class="config-label">Selecciona destino</label><input type="text" class="config-input" placeholder="Ej: ID del nodo" /><button class="btn-primary" style="width:100%; margin-top:10px;">Aplicar</button></div>`
  };
}

export const GotoNodeConfig = { type: 'goto', label: 'Ir a', icon: '⤴️', inputs: 1, outputs: 0, html: GOTO_HTML, render: renderGotoPreview, inspector: renderGotoInspector };
