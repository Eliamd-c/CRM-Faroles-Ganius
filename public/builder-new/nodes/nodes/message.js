/**
 * Message Node Module
 *
 * Handles message node rendering with blocks, images, and buttons.
 * Core node type for sending multi-block messages.
 */

/**
 * Message node HTML template
 */
export const MESSAGE_HTML = `
  <div class="mc-node mc-content">
    <div class="mc-header"><span>💬</span> Send Message</div>
    <div class="box node-blocks-container"></div>
  </div>
`;

/**
 * Render message node blocks preview
 * @param {string} nodeId - Node ID
 * @param {Object} nodeData - Node data
 * @param {Array} blocks - Blocks from state
 * @returns {string} HTML preview
 */
export function renderBlocksPreview(nodeId, nodeData = {}, blocks = []) {
  if (!blocks || blocks.length === 0) {
    return '<div class="nd-placeholder" style="padding:16px; text-align:center;">Vacío — añade bloques en el Inspector</div>';
  }

  let html = '';
  blocks.forEach(block => {
    // Text block
    if (block.type === 'text') {
      html += `<div class="nd-text-block">${block.content || '<span class="nd-placeholder">Escribe algo...</span>'}</div>`;
    }
    // Image block
    else if (block.type === 'image') {
      html += `<div class="nd-image-block">${block.url ? `<img src="${block.url}" />` : '<div class="nd-placeholder" style="padding:16px; text-align:center;">📷 Sin imagen</div>'}</div>`;
    }

    // Buttons
    if (block.buttons && block.buttons.length > 0) {
      html += `<div class="nd-keyboard">`;
      block.buttons.forEach(btn => {
        html += `<div class="nd-kb-btn">${btn.title || 'Nuevo Botón'}</div>`;
      });
      html += `</div>`;
    }
  });

  return html;
}

/**
 * Render message node inspector
 * @param {string} nodeId - Node ID
 * @param {Object} data - Node data
 * @param {Array} blocks - Blocks from state
 * @returns {Object} Inspector config { title, html }
 */
export function renderMessageInspector(nodeId, data = {}, blocks = []) {
  const blocksList = blocks || [];
  let html = '<div class="insp-blocks-list" id="insp-blocks-list">';

  blocksList.forEach((block, idx) => {
    html += `
      <div class="ms-block-wrapper" style="margin-bottom: 24px; position: relative;">
        <button onclick="deleteBlock('${nodeId}', ${idx})" style="position: absolute; top: -10px; right: -10px; background: white; border: 1px solid #ef4444; color: #ef4444; width: 24px; height: 24px; border-radius: 50%; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" title="Eliminar bloque"><i class="fa-solid fa-times"></i></button>

        <div style="background: #f1f2f6; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
    `;

    if (block.type === 'text') {
      html += `
        <textarea id="text-block-${nodeId}-${idx}" class="cfg-input" style="width: 100%; border: none; background: transparent; outline: none; resize: none; min-height: 80px; font-size: 13px; font-family: inherit; color: #1c1e21;" oninput="updateBlockContent('${nodeId}', ${idx}, this.value)" placeholder="Introduce tu texto...">${block.content}</textarea>
        <div style="display: flex; justify-content: flex-end;">
          <button onclick="improveTextWithAI('${nodeId}', ${idx})" style="background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            <span id="ai-icon-${nodeId}-${idx}">✨</span> <span id="ai-text-${nodeId}-${idx}">Mejorar con IA</span>
          </button>
        </div>
      `;
    } else if (block.type === 'image') {
      html += `
        <label class="cfg-label"><i class="fa-solid fa-image"></i> URL de la Imagen</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input id="img-url-${nodeId}-${idx}" class="cfg-input" type="text" style="margin-bottom:0;" value="${block.url || ''}" oninput="updateBlockUrl('${nodeId}', ${idx}, this.value)" placeholder="https://..." />
          <label style="cursor: pointer; background: #ffffff; padding: 8px; border-radius: 6px; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; flex-shrink: 0; border: 1px solid #cbd5e1; color: var(--primary);" title="Subir imagen">
            <input type="file" accept="image/*" style="display: none;" onchange="uploadBlockImage(this, '${nodeId}', ${idx})" />
            <i class="fa-solid fa-upload"></i>
          </label>
        </div>
        <div id="upload-progress-${nodeId}-${idx}" style="font-size: 11px; color: var(--color-primary); display: none; margin-top: 4px;">Subiendo imagen...</div>
      `;
    }

    // Buttons
    html += `<div class="ms-btns-container" style="display: flex; flex-direction: column; gap: 4px;">`;
    (block.buttons || []).forEach((btn, bIdx) => {
      html += `
        <div class="ms-btn" onclick="openButtonEditor('${nodeId}', ${idx}, ${bIdx})" style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; text-align: center; font-size: 13px; font-weight: 600; color: #0084ff; cursor: pointer; display: flex; justify-content: center; align-items: center; position: relative;">
          ${btn.title || 'New Button'}
          <div style="position: absolute; right: 10px; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #d1d5db;"></div>
        </div>`;
    });
    html += `</div>`;

    // Add button option
    if ((block.buttons || []).length < 3) {
      html += `<div onclick="addButton('${nodeId}', ${idx})" style="border: 1px dashed var(--primary); background: rgba(37,99,235,0.05); border-radius: 20px; padding: 10px; text-align: center; font-size: 13px; font-weight: 600; color: var(--primary); cursor: pointer; margin-top: 10px;"><i class="fa-solid fa-plus"></i> Añadir botón</div>`;
    }

    html += `</div></div>`;
  });

  html += `</div>`;

  // Add block options
  html += `
    <div style="margin-top:20px;">
      <label class="cfg-label" style="margin-bottom:8px; display:block;">Añadir bloque</label>
      <div class="block-palette">
        <div class="block-palette-item" onclick="addBlock('${nodeId}', 'text')">
          <span class="bpi-icon">📝</span>Texto
        </div>
        <div class="block-palette-item" onclick="addBlock('${nodeId}', 'image')">
          <span class="bpi-icon">🖼️</span>Imagen
        </div>
      </div>
    </div>
  `;

  return {
    title: 'Enviar mensaje',
    html
  };
}

/**
 * Message node configuration
 */
export const MessageNodeConfig = {
  type: 'message',
  label: 'Enviar mensaje',
  icon: '💬',
  inputs: 1,
  outputs: 1,
  html: MESSAGE_HTML,
  render: (nodeId, data = {}, blocks = []) => renderBlocksPreview(nodeId, data, blocks),
  inspector: renderMessageInspector,
};
