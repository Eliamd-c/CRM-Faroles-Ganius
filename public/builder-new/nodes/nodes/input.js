/**
 * Input Node Module
 *
 * Handles user input collection (email, phone, text).
 */

export const INPUT_HTML = `
  <div class="mc-node mc-action">
    <div class="mc-header"><span>📥</span> User Input</div>
    <div class="box input-node-preview">
      <em style="color:#8492a6; font-size:11px;">Sin configurar</em>
    </div>
  </div>
`;

export function renderInputPreview(nodeId, config = {}) {
  if (!config.type) {
    return '<span class="anp-empty" style="font-size:12px;">Selecciona para configurar</span>';
  }

  const typeLabels = { email: '✉️ Email', phone: '📱 Teléfono', text: '📝 Texto Libre' };
  return `
    <div style="font-size:12px; font-weight:600; color:#374151; margin-bottom:4px;">Pedir: ${typeLabels[config.type] || config.type}</div>
    <div style="font-size:11px; color:#6b7280; margin-bottom:4px;">Guardar en: <span style="background:#e5e7eb; padding:2px 4px; border-radius:4px;">${config.field || 'N/A'}</span></div>
    <div style="font-size:11px; color:#6b7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">"${config.prompt || 'Sin mensaje'}"</div>
  `;
}

export function renderInputInspector(nodeId, data = {}) {
  const config = data || {};

  return {
    title: 'Entrada del Usuario',
    html: `
      <div class="config-group">
        <label class="config-label">¿Qué dato vamos a pedir?</label>
        <select class="config-input" id="input-type">
          <option value="email" ${config.type === 'email' ? 'selected' : ''}>✉️ Correo electrónico</option>
          <option value="phone" ${config.type === 'phone' ? 'selected' : ''}>📱 Teléfono</option>
          <option value="text" ${config.type === 'text' ? 'selected' : ''}>📝 Texto libre</option>
        </select>
      </div>
      <div class="config-group">
        <label class="config-label">Guardar respuesta en campo:</label>
        <input type="text" class="config-input" id="input-field" value="${config.field || ''}" placeholder="ej: email, phone, nombre" />
      </div>
      <div class="config-group">
        <label class="config-label">Mensaje a mostrar al usuario:</label>
        <textarea id="input-prompt" class="config-input" style="min-height:60px;" placeholder="Ej: Por favor escribe tu correo...">${config.prompt || ''}</textarea>
      </div>
      <div class="config-group">
        <label class="config-label">Mensaje si el usuario se equivoca (Reintento):</label>
        <textarea id="input-retry" class="config-input" style="min-height:60px;" placeholder="Ej: Ese formato no es válido. Intenta de nuevo...">${config.retry || ''}</textarea>
      </div>
      <button id="cfg-input-save" class="btn-primary" style="width:100%; margin-top:15px; padding:10px;">Aplicar Configuración</button>
    `
  };
}

export const InputNodeConfig = {
  type: 'input',
  label: 'Entrada del Usuario',
  icon: '📥',
  inputs: 1,
  outputs: 2,
  html: INPUT_HTML,
  render: renderInputPreview,
  inspector: renderInputInspector,
};
