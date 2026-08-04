/**
 * Action Node Module
 *
 * Handles action node rendering with ACTION_CATALOG integration.
 * Supports contact, automation, and inbox action categories.
 */

/**
 * Action Catalog - Action definitions organized by category
 */
export const ACTION_CATALOG = {
  contact: {
    label: '📋 Datos de contacto',
    desc: 'Gestiona etiquetas, campos y estados del contacto',
    actions: [
      { id: 'add_tag', icon: '➕', label: 'Añadir etiqueta', desc: 'Etiqueta el contacto para segmentarlo', params: [{ key: 'tag', label: 'Nombre de la etiqueta', placeholder: 'ej: interesado_rustico' }] },
      { id: 'remove_tag', icon: '➖', label: 'Eliminar etiqueta', desc: 'Quita una etiqueta del contacto', params: [{ key: 'tag', label: 'Etiqueta a eliminar', placeholder: 'ej: interesado_rustico' }] },
      { id: 'set_field', icon: '📝', label: 'Establecer campo', desc: 'Guarda un dato personalizado del contacto', params: [{ key: 'field', label: 'Nombre del campo', placeholder: 'ej: ciudad' }, { key: 'value', label: 'Valor', placeholder: 'ej: Bogotá' }] },
      { id: 'clear_field', icon: '🗑️', label: 'Borrar campo', desc: 'Elimina un campo guardado del contacto', params: [{ key: 'field', label: 'Campo a borrar', placeholder: 'ej: ciudad' }] },
      { id: 'delete_contact', icon: '🚫', label: 'Eliminar contacto', desc: 'Elimina el contacto del CRM permanentemente', params: [] },
    ]
  },
  automation: {
    label: '⚙️ Automatización',
    desc: 'Controla el flujo de automatización del contacto',
    actions: [
      { id: 'pause_bot', icon: '⏸️', label: 'Pausar automatizaciones', desc: 'El bot no responderá más a este contacto', params: [] },
      { id: 'resume_bot', icon: '▶️', label: 'Reanudar automatizaciones', desc: 'Reactiva el bot para este contacto', params: [] },
      { id: 'subscribe_sequence', icon: '📬', label: 'Suscribir a secuencia', desc: 'Inicia una secuencia/drip para este contacto', params: [{ key: 'sequence_id', label: 'ID de la secuencia', placeholder: 'ej: seq_welcome' }] },
      { id: 'unsubscribe_sequence', icon: '🚫', label: 'Desuscribir secuencia', desc: 'Detiene una secuencia activa del contacto', params: [{ key: 'sequence_id', label: 'ID de la secuencia', placeholder: 'ej: seq_welcome' }] },
    ]
  },
  inbox: {
    label: '📥 Bandeja de entrada',
    desc: 'Gestiona el estado de la conversación',
    actions: [
      { id: 'mark_open', icon: '🟢', label: 'Marcar como Abierta', desc: 'Marca la conversación como activa', params: [] },
      { id: 'mark_closed', icon: '🔴', label: 'Marcar como Cerrada', desc: 'Marca la conversación como resuelta', params: [] },
    ]
  }
};

/**
 * Action node HTML template
 */
export const ACTION_HTML = `
  <div class="mc-node mc-action">
    <div class="mc-header"><span>⚡</span> Action</div>
    <div class="box action-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin configurar</em>
    </div>
  </div>
`;

/**
 * Render action node preview
 * @param {string} nodeId - Node ID
 * @param {Object} config - Action configuration
 * @returns {string} HTML preview
 */
export function renderActionPreview(nodeId, config = {}) {
  if (!config || !config.type) {
    return '<span class="anp-empty">Selecciona este nodo para configurar</span>';
  }

  let actionDef = null;
  for (const cat of Object.values(ACTION_CATALOG)) {
    actionDef = cat.actions.find(a => a.id === config.type);
    if (actionDef) break;
  }

  if (!actionDef) return '<span class="anp-empty">Acción no encontrada</span>';

  const paramText = Object.values(config.params || {}).filter(Boolean).join(' · ');
  return `
    <span class="anp-icon">${actionDef.icon}</span>
    <div class="anp-info">
      <strong>${actionDef.label}</strong>
      ${paramText ? `<span class="anp-params">${paramText}</span>` : ''}
    </div>
  `;
}

/**
 * Render action node inspector
 * @param {string} nodeId - Node ID
 * @param {Object} data - Node data
 * @returns {Object} Inspector config
 */
export function renderActionInspector(nodeId, data = {}) {
  const config = data || {};
  const selectedAction = config.type;

  let actionCategories = '';
  for (const [catKey, category] of Object.entries(ACTION_CATALOG)) {
    actionCategories += `<optgroup label="${category.label}">`;
    for (const action of category.actions) {
      actionCategories += `<option value="${action.id}" ${selectedAction === action.id ? 'selected' : ''}>${action.icon} ${action.label}</option>`;
    }
    actionCategories += `</optgroup>`;
  }

  let paramInputs = '';
  if (selectedAction) {
    let actionDef = null;
    for (const cat of Object.values(ACTION_CATALOG)) {
      actionDef = cat.actions.find(a => a.id === selectedAction);
      if (actionDef) break;
    }

    if (actionDef && actionDef.params.length > 0) {
      paramInputs = '<hr style="border:0; border-top:1px solid #e5e7eb; margin:15px 0;">';
      for (const param of actionDef.params) {
        paramInputs += `
          <div style="margin-bottom:12px;">
            <label class="cfg-label" style="margin-top:10px; font-weight:normal;">${param.label}</label>
            <input type="text" class="config-input" id="action-param-${param.key}" value="${config.params?.[param.key] || ''}" placeholder="${param.placeholder}" />
          </div>
        `;
      }
    }
  }

  const saveBtn = selectedAction ? `<button id="cfg-action-save" class="btn-primary" style="width:100%; margin-top:15px; padding:10px;">Aplicar Configuración</button>` : '';

  return {
    title: 'Acción',
    html: `
      <div class="config-group">
        <label class="config-label">Selecciona una acción</label>
        <select class="config-input" id="action-type" onchange="renderActionNode('${nodeId}');">
          <option value="">-- Selecciona una acción --</option>
          ${actionCategories}
        </select>
      </div>
      ${paramInputs}
      ${saveBtn}
    `
  };
}

/**
 * Action node configuration
 */
export const ActionNodeConfig = {
  type: 'action',
  label: 'Acción',
  icon: '⚡',
  inputs: 1,
  outputs: 1,
  html: ACTION_HTML,
  render: renderActionPreview,
  inspector: renderActionInspector,
};
