/**
 * Carousel Node Module
 *
 * Handles carousel/card collections.
 */

export const CAROUSEL_HTML = `
  <div class="mc-node mc-content">
    <div class="mc-header"><span>🖼️</span> Carrusel</div>
    <div class="box carousel-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin tarjetas configuradas</em>
    </div>
  </div>
`;

export function renderCarouselPreview(nodeId, config = {}) {
  const elements = config.elements || [];
  const count = elements.filter(el => el.title).length;

  if (count === 0) {
    return '<em style="color:#8492a6; font-size:11px;">Sin tarjetas configuradas</em>';
  }

  return `<div style="background:#e0f2fe; padding:8px; border-radius:6px; text-align:center; font-size:12px; color:#0369a1; font-weight:600;">🖼️ ${count} tarjeta${count !== 1 ? 's' : ''}</div>`;
}

export function renderCarouselInspector(nodeId, data = {}) {
  const config = data || {};
  const elements = config.elements || [];

  let cardsHtml = elements.map((el, i) => `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:12px; position:relative;">
      <button onclick="removeCarouselElement('${nodeId}', ${i})" style="position:absolute;top:8px;right:8px;background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;">×</button>
      <div style="font-size:11px; font-weight:600; color:#6b7280; margin-bottom:6px;">TARJETA ${i + 1}</div>
      <input type="text" class="config-input" value="${el.title || ''}" placeholder="Título" style="margin-bottom:8px;" />
      <input type="text" class="config-input" value="${el.subtitle || ''}" placeholder="Subtítulo" />
    </div>
  `).join('');

  return {
    title: 'Carrusel',
    html: `
      ${cardsHtml}
      <button class="btn-secondary" style="width:100%;margin-bottom:8px; padding:10px;" onclick="addCarouselElement('${nodeId}')">+ Agregar tarjeta</button>
      <p style="font-size:11px; color:#6b7280; margin-top:12px;">Máximo 10 tarjetas</p>
    `
  };
}

export const CarouselNodeConfig = {
  type: 'carousel',
  label: 'Carrusel',
  icon: '🖼️',
  inputs: 1,
  outputs: 1,
  html: CAROUSEL_HTML,
  render: renderCarouselPreview,
  inspector: renderCarouselInspector,
};
