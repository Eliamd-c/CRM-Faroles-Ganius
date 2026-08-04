/**
 * Delay Node Module
 *
 * Pauses flow execution for specified duration.
 */

export const DELAY_HTML = `<div class="mc-node mc-logic"><div class="mc-header"><span>⏱️</span> Delay</div><div class="box delay-node-preview"><em style="color:#8492a6; font-size:11px;">Configura en el panel...</em></div></div>`;

export function renderDelayPreview(nodeId, config = {}) {
  const seconds = config.seconds || 0;
  return `<div style="background:#dbeafe; padding:8px; border-radius:6px; font-size:11px; color:#0369a1; font-weight:600;">⏱️ ${seconds}s</div>`;
}

export function renderDelayInspector(nodeId, data = {}) {
  return {
    title: 'Espera',
    html: `<div class="config-group"><label class="config-label">Segundos a esperar</label><input type="number" class="config-input" value="${data?.seconds || 0}" min="0" max="3600" step="1" /><p style="font-size:11px; color:#6b7280; margin-top:12px;">Máximo 1 hora (3600 segundos)</p><button class="btn-primary" style="width:100%; margin-top:10px;">Aplicar</button></div>`
  };
}

export const DelayNodeConfig = { type: 'delay', label: 'Espera', icon: '⏱️', inputs: 1, outputs: 1, html: DELAY_HTML, render: renderDelayPreview, inspector: renderDelayInspector };
