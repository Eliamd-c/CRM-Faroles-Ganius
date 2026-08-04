/**
 * Condition Node Module
 *
 * Handles conditional logic (if-then branching).
 */

export const CONDITION_HTML = `
  <div class="mc-node mc-logic">
    <div class="mc-header"><span>🔀</span> Condition</div>
    <div class="box condition-node-preview">
      <em style="color:#8492a6; font-size:11px;">Configura en el panel...</em>
    </div>
  </div>
`;

export function renderConditionPreview(nodeId, config = {}) {
  if (!config.field) {
    return '<em style="color:#8492a6; font-size:11px;">Configura una condición</em>';
  }

  return `
    <div style="background:#f3e8ff; padding:10px; border-radius:6px; border:1px solid #d8b4fe;">
      <div style="font-size:12px; font-weight:600; color:#6b21a8; margin-bottom:5px;">Si ${config.field}</div>
      <div style="font-size:11px; color:#581c87; margin-bottom:3px;">${config.operator || 'contiene'}</div>
      <div style="font-size:12px; font-weight:600; color:#6b21a8; background:white; padding:2px 5px; border-radius:4px; display:inline-block;">${config.value || 'vacío'}</div>
    </div>
  `;
}

export function renderConditionInspector(nodeId, data = {}) {
  const config = data || {};

  return {
    title: 'Condición',
    html: `
      <div class="config-group">
        <label class="config-label">Campo a evaluar</label>
        <input type="text" class="config-input" id="condition-field" value="${config.field || ''}" placeholder="ej: email, nombre" />
      </div>
      <div class="config-group">
        <label class="config-label">Operador</label>
        <select class="config-input" id="condition-operator">
          <option value="contains" ${config.operator === 'contains' ? 'selected' : ''}>Contiene</option>
          <option value="equals" ${config.operator === 'equals' ? 'selected' : ''}>Es igual a</option>
          <option value="starts_with" ${config.operator === 'starts_with' ? 'selected' : ''}>Empieza con</option>
        </select>
      </div>
      <div class="config-group">
        <label class="config-label">Valor</label>
        <input type="text" class="config-input" id="condition-value" value="${config.value || ''}" placeholder="ej: @" />
      </div>
      <button class="btn-primary" style="width:100%; margin-top:15px; padding:10px;">Aplicar</button>
    `
  };
}

export const ConditionNodeConfig = {
  type: 'condition',
  label: 'Condición',
  icon: '🔀',
  inputs: 1,
  outputs: 2,
  html: CONDITION_HTML,
  render: renderConditionPreview,
  inspector: renderConditionInspector,
};
