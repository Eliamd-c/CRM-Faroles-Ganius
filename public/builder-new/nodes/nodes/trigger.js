/**
 * Trigger Node Module
 *
 * Handles trigger node rendering and configuration.
 * Supports: message triggers, comment triggers, mention triggers
 */

/**
 * Trigger node HTML template
 */
export const TRIGGER_HTML = `
  <div class="mc-node mc-trigger">
    <div class="mc-header"><span>⚡</span> Cuando...</div>
    <div class="box trigger-node-preview">
      <div style="border: 2px dashed #0084ff; border-radius: 8px; padding: 12px; text-align: center; color: #0084ff; font-weight: 600; font-size: 14px; cursor: pointer;">
        + Elegir disparador
      </div>
    </div>
  </div>
`;

/**
 * Render trigger node visual preview
 * @param {string} nodeId - Node ID
 * @param {Object} nodeData - Node data from drawflow
 * @returns {string} HTML content
 */
export function renderTriggerPreview(nodeId, nodeData = {}) {
  const triggerType = nodeData.triggerType || 'message';

  if (triggerType === 'message') {
    return renderMessageTriggerPreview(nodeData);
  } else if (triggerType === 'comment') {
    return renderCommentTriggerPreview(nodeData);
  } else if (triggerType === 'mention') {
    return renderMentionTriggerPreview(nodeData);
  } else {
    return `<div style="border:2px dashed #0084ff; border-radius:8px; padding:12px; text-align:center; color:#0084ff; font-weight:600; font-size:14px; cursor:pointer;" onclick="openTriggerPicker('${nodeId}')">+ Elegir disparador</div>`;
  }
}

/**
 * Render message trigger preview
 * @param {Object} data - Trigger data
 * @returns {string} HTML content
 */
function renderMessageTriggerPreview(data) {
  const kw = data.keywords || '';
  const matchType = data.matchType || 'contains';
  const matchLabels = {
    contains: 'Contiene',
    exact: 'Exacto',
    starts_with: 'Empieza con',
    regex: 'Regex',
    intent: 'Intención IA'
  };

  if (kw) {
    return `
      <div class="trigger-type-badge">💬 Mensaje directo</div>
      <div style="background:#eff6ff; padding:8px; border-radius:6px; font-size:11px;">
        <div style="color:#1d4ed8; font-weight:600; margin-bottom:3px;">${matchLabels[matchType] || 'Contiene'}</div>
        <div style="color:#1e40af; max-height:54px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">${kw}</div>
      </div>`;
  } else {
    return `
      <div class="trigger-type-badge">💬 Mensaje directo</div>
      <div style="color:#9ca3af; font-size:12px;">Sin palabras clave aún</div>`;
  }
}

/**
 * Render comment trigger preview
 * @param {Object} data - Trigger data
 * @returns {string} HTML content
 */
function renderCommentTriggerPreview(data) {
  const kw = data.commentKeyword || '';
  const pub = data.commentPublicReply || '';

  return `
    <div class="trigger-type-badge comment">💬 Comentario</div>
    ${kw ? `<div style="background:#f0fdf4; padding:8px; border-radius:6px; font-size:11px; color:#15803d; font-weight:600; margin-bottom:6px;">Palabra clave: "${kw}"</div>` : '<div style="font-size:11px; color:#9ca3af; margin-bottom:6px;">Cualquier comentario</div>'}
    ${pub ? `<div style="font-size:11px; color:#6b7280;">↩ Responde: "${pub.substring(0,40)}${pub.length>40?'...':''}"</div>` : ''}
    ${data.commentPrivateReply !== false ? '<div style="font-size:11px; color:#6b7280;">📩 Envía flujo por DM</div>' : ''}`;
}

/**
 * Render mention trigger preview
 * @param {Object} data - Trigger data
 * @returns {string} HTML content
 */
function renderMentionTriggerPreview(data) {
  return `
    <div class="trigger-type-badge mention" style="background:#f3e8ff; color:#7e22ce;">@ Mención</div>
    <div style="font-size:11px; color:#6b7280; margin-top:6px;">Se activa cuando te etiquetan.</div>
    <div style="font-size:11px; color:#d97706; margin-top:4px; font-weight:bold;">⚠️ Responde con un comentario.</div>
  `;
}

/**
 * Render trigger configuration inspector
 * @param {string} nodeId - Node ID
 * @param {Object} data - Node data
 * @returns {Object} Inspector config { title, html }
 */
export function renderTriggerInspector(nodeId, data = {}) {
  const triggerType = data.triggerType || 'message';

  if (triggerType === 'message') {
    return renderMessageTriggerInspector(nodeId, data);
  } else if (triggerType === 'comment') {
    return renderCommentTriggerInspector(nodeId, data);
  } else if (triggerType === 'mention') {
    return renderMentionTriggerInspector(nodeId, data);
  }

  return {
    title: 'Disparador',
    html: '<p style="color:var(--text-muted); font-size:13px;">Selecciona un tipo de disparador.</p>'
  };
}

/**
 * Render message trigger inspector
 * @param {string} nodeId - Node ID
 * @param {Object} data - Node data
 * @returns {Object} Inspector config
 */
function renderMessageTriggerInspector(nodeId, data) {
  const keywords = data.keywords || '';
  const matchType = data.matchType || 'contains';

  const labelText = matchType === 'intent'
    ? 'Descripción de la intención (Ej: El usuario quiere comprar, saludó, etc)'
    : 'Palabras clave (separadas por coma)';

  return {
    title: '💬 Disparador: Mensaje',
    html: `
      <div style="margin-bottom:16px;">
        <button onclick="openTriggerPicker('${nodeId}')" style="background:none; border:1px solid #e5e7eb; border-radius:8px; padding:6px 12px; font-size:12px; color:#6b7280; cursor:pointer; display:flex; align-items:center; gap:6px;">
          ⚡ Cambiar tipo de disparador
        </button>
      </div>
      <div class="config-group">
        <label class="config-label" id="trigger-keywords-label">${labelText}</label>
        <input type="text" class="config-input" id="trigger-keywords" value="${keywords}" placeholder="ej: precio, valor, costo">
      </div>
      <div class="config-group">
        <label class="config-label">Tipo de coincidencia</label>
        <select class="config-input" id="trigger-match-type" onchange="document.getElementById('trigger-keywords-label').innerText = this.value === 'intent' ? 'Descripción de la intención (Ej: El usuario quiere comprar)' : 'Palabras clave (separadas por coma)';">
          <option value="contains" ${matchType === 'contains' ? 'selected' : ''}>Contiene la palabra</option>
          <option value="exact" ${matchType === 'exact' ? 'selected' : ''}>Coincidencia exacta</option>
          <option value="starts_with" ${matchType === 'starts_with' ? 'selected' : ''}>Empieza con</option>
          <option value="regex" ${matchType === 'regex' ? 'selected' : ''}>Expresión regular (avanzado)</option>
          <option value="intent" ${matchType === 'intent' ? 'selected' : ''}>🧠 Intención por IA (Smart Trigger)</option>
        </select>
        <p style="font-size:11px; color:var(--text-muted); margin-top:5px; line-height:1.4;">Si usas <b>Intención por IA</b>, nuestro motor semántico evaluará si el mensaje significa lo mismo que tu descripción, incluso si usa sinónimos o palabras diferentes.</p>
      </div>
      <button class="btn-primary" style="width:100%; margin-top:8px;" onclick="saveTrigger('${nodeId}')">Aplicar</button>`
  };
}

/**
 * Render mention trigger inspector
 * @param {string} nodeId - Node ID
 * @param {Object} data - Node data
 * @returns {Object} Inspector config
 */
function renderMentionTriggerInspector(nodeId, data) {
  return {
    title: '💬 Disparador: Mención',
    html: `
      <div style="margin-bottom:16px;">
        <button onclick="openTriggerPicker('${nodeId}')" style="background:none; border:1px solid #e5e7eb; border-radius:8px; padding:6px 12px; font-size:12px; color:#6b7280; cursor:pointer; display:flex; align-items:center; gap:6px;">
          ⚡ Cambiar tipo de disparador
        </button>
      </div>
      <div class="config-group" style="background:#f3e8ff; border:1px solid #d8b4fe; border-radius:8px; padding:12px; margin-bottom:12px;">
        <p style="font-size:13px; color:#6b21a8; font-weight:600; margin-bottom:6px;"><i class="fa-solid fa-info-circle"></i> ¿Cómo funciona?</p>
        <p style="font-size:12px; color:#7e22ce; line-height:1.4;">Este flujo se activará cada vez que un usuario mencione tu cuenta <strong>@${window.BOT_USERNAME || 'tu_cuenta'}</strong> en los comentarios o descripción de una de <strong>sus</strong> publicaciones.</p>
      </div>
      <div class="config-group" style="background:#fff7ed; border:1px solid #fdba74; border-radius:8px; padding:12px;">
        <p style="font-size:13px; color:#c2410c; font-weight:600; margin-bottom:6px;"><i class="fa-solid fa-triangle-exclamation"></i> Importante</p>
        <p style="font-size:12px; color:#c2410c; line-height:1.4;">Para responder a la mención, añade un nodo de <strong>Acción &gt; Mensaje</strong>. El texto de ese nodo se publicará como un <strong>comentario público</strong> en respuesta al usuario. No se soportan botones ni imágenes.</p>
      </div>
    `
  };
}

/**
 * Render comment trigger inspector
 * @param {string} nodeId - Node ID
 * @param {Object} data - Node data
 * @returns {Object} Inspector config
 */
function renderCommentTriggerInspector(nodeId, data) {
  const keyword = data.commentKeyword || '';
  const replies = data.commentPublicReplies || (data.commentPublicReply ? [data.commentPublicReply] : ['']);
  const privateReply = data.commentPrivateReply !== false;
  const selectedMedia = data.commentMediaId || '';
  const selectedMediaThumb = data.commentMediaThumb || '';

  const repliesHtml = replies.map((r, i) => `
    <div style="display:flex; gap:6px; margin-bottom:6px;" id="reply-row-${i}">
      <textarea class="config-input comment-public-reply-item" style="min-height:50px; flex:1; resize:vertical;" placeholder="ej: ¡Gracias! Te escribimos por DM 📩">${r}</textarea>
      ${replies.length > 1 ? `<button onclick="removeCommentReply('${nodeId}',${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:18px;padding:0 4px;align-self:flex-start;margin-top:4px;">×</button>` : ''}
    </div>`).join('');

  return {
    title: '💬 Disparador: Comentario',
    html: `
      <div style="margin-bottom:16px;">
        <button onclick="openTriggerPicker('${nodeId}')" style="background:none; border:1px solid #e5e7eb; border-radius:8px; padding:6px 12px; font-size:12px; color:#6b7280; cursor:pointer;">
          ⚡ Cambiar tipo de disparador
        </button>
      </div>

      <div class="config-group">
        <label class="config-label">Publicación (opcional)</label>
        <div id="comment-media-preview" style="margin-bottom:8px;">
          ${selectedMedia
            ? `<div style="display:flex;align-items:center;gap:8px;background:#f3f4f6;padding:8px;border-radius:8px;">
                 ${selectedMediaThumb ? `<img src="${selectedMediaThumb}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">` : '🖼️'}
                 <span style="font-size:12px;color:#374151;flex:1">Publicación seleccionada</span>
                 <button onclick="clearCommentMedia('${nodeId}')" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:16px;">×</button>
               </div>`
            : `<div style="font-size:12px;color:#9ca3af;">Responde a comentarios en cualquier publicación</div>`}
        </div>
      </div>

      <div class="config-group">
        <label class="config-label">Palabra clave (opcional)</label>
        <input type="text" class="config-input" id="trigger-comment-keyword" value="${keyword}" placeholder="ej: precio, soporte">
        <p style="font-size:11px; color:#6b7280; margin-top:4px;">Deja vacío para responder a cualquier comentario.</p>
      </div>

      <div class="config-group">
        <label class="config-label">Respuesta pública</label>
        ${repliesHtml}
        <button onclick="addCommentReply('${nodeId}')" style="background:none; border:1px dashed #e5e7eb; border-radius:6px; padding:6px 12px; font-size:12px; color:#6b7280; cursor:pointer; width:100%; margin-top:6px;">+ Añadir respuesta</button>
      </div>

      <div class="config-group">
        <label class="config-label" style="display:flex; align-items:center; gap:8px; margin:0;">
          <input type="checkbox" id="trigger-comment-private" ${privateReply ? 'checked' : ''}>
          Enviar flujo por mensaje directo
        </label>
      </div>

      <button class="btn-primary" style="width:100%; margin-top:8px;" onclick="saveTrigger('${nodeId}')">Aplicar</button>
    `
  };
}

/**
 * Trigger node configuration
 */
export const TriggerNodeConfig = {
  type: 'trigger',
  label: 'Cuando...',
  icon: '⚡',
  inputs: 0,
  outputs: 1,
  html: TRIGGER_HTML,
  render: renderTriggerPreview,
  inspector: renderTriggerInspector,
};
