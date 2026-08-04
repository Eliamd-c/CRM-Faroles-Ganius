/**
 * Gallery Node Module
 */

export const GALLERY_HTML = `
  <div class="mc-node mc-content">
    <div class="mc-header"><span>📸</span> Galería</div>
    <div class="box gallery-node-preview"><em style="color:#8492a6; font-size:11px;">Sin imágenes</em></div>
  </div>
`;

export function renderGalleryPreview(nodeId, config = {}) {
  const images = config.images || [];
  return images.length > 0
    ? `<div style="background:#fef3c7; padding:8px; border-radius:6px; text-align:center; font-size:12px; color:#b45309;">📸 ${images.length} imagen${images.length !== 1 ? 'es' : ''}</div>`
    : '<em style="color:#8492a6; font-size:11px;">Sin imágenes</em>';
}

export function renderGalleryInspector(nodeId, data = {}) {
  return {
    title: 'Galería',
    html: `
      <div class="config-group">
        <label class="config-label">Imágenes</label>
        <input type="text" class="config-input" placeholder="https://ejemplo.com/imagen.jpg" />
        <button class="btn-secondary" style="width:100%; margin-top:8px; padding:8px;">+ Añadir imagen</button>
      </div>
      <div class="config-group">
        <label class="config-label">Delay entre imágenes (ms)</label>
        <input class="config-input" type="number" value="300" min="0" max="5000">
      </div>
    `
  };
}

export const GalleryNodeConfig = {
  type: 'gallery',
  label: 'Galería',
  icon: '📸',
  inputs: 1,
  outputs: 1,
  html: GALLERY_HTML,
  render: renderGalleryPreview,
  inspector: renderGalleryInspector,
};
