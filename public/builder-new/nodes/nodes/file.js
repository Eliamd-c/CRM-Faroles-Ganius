/**
 * File Node Module
 */

export const FILE_HTML = `<div class="mc-node mc-content"><div class="mc-header"><span>📄</span> Archivo</div><div class="box file-node-preview"><em style="color:#8492a6; font-size:11px;">Sin archivo</em></div></div>`;

export function renderFilePreview(nodeId, config = {}) {
  return config.file_url ? `<div style="background:#f3e8ff; padding:8px; border-radius:6px; font-size:11px; color:#6b21a8;">📄 ${config.file_name || 'Descargar archivo'}</div>` : '<em style="color:#8492a6; font-size:11px;">Sin archivo</em>';
}

export function renderFileInspector(nodeId, data = {}) {
  return {
    title: 'Archivo',
    html: `<div class="config-group"><label class="config-label">URL del archivo</label><input type="text" class="config-input" placeholder="https://..." /><label class="config-label" style="margin-top:12px;">Nombre del archivo</label><input type="text" class="config-input" placeholder="documento.pdf" /><button class="btn-primary" style="width:100%; margin-top:10px;">Aplicar</button></div>`
  };
}

export const FileNodeConfig = { type: 'file', label: 'Archivo', icon: '📄', inputs: 1, outputs: 1, html: FILE_HTML, render: renderFilePreview, inspector: renderFileInspector };
