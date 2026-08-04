/**
 * Randomizer Node Module
 *
 * Handles random path selection (A/B testing).
 */

export const RANDOMIZER_HTML = `
  <div class="mc-node mc-logic">
    <div class="mc-header"><span>🎲</span> Randomizer</div>
    <div class="box randomizer-node-preview">
      <em style="color:#8492a6; font-size:11px;">Configura salidas en el panel...</em>
    </div>
  </div>
`;

export function renderRandomizerPreview(nodeId, config = {}) {
  const paths = config.paths || 2;
  return `
    <div style="background:#fef3c7; padding:10px; border-radius:6px; border:1px solid #fcd34d;">
      <div style="font-size:12px; font-weight:600; color:#b45309; text-align:center;">${paths} Salidas (A/B)</div>
    </div>
  `;
}

export function renderRandomizerInspector(nodeId, data = {}) {
  const config = data || {};
  const paths = config.paths || 2;

  return {
    title: 'Aleatorizador',
    html: `
      <div class="config-group">
        <label class="config-label">Número de salidas</label>
        <input type="number" class="config-input" id="randomizer-paths" value="${paths}" min="2" max="10" />
      </div>
      <div style="font-size:11px; color:#6b7280; margin-top:12px; padding:12px; background:#f3f4f6; border-radius:6px;">
        El nodo elegirá aleatoriamente entre sus salidas disponibles.
      </div>
      <button class="btn-primary" style="width:100%; margin-top:15px; padding:10px;">Aplicar</button>
    `
  };
}

export const RandomizerNodeConfig = {
  type: 'randomizer',
  label: 'Aleatorizador',
  icon: '🎲',
  inputs: 1,
  outputs: 2,
  html: RANDOMIZER_HTML,
  render: renderRandomizerPreview,
  inspector: renderRandomizerInspector,
};
