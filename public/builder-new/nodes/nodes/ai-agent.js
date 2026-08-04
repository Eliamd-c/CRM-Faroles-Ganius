/**
 * AI Agent Node Module
 *
 * Handles AI-powered conversation and responses.
 */

export const AI_AGENT_HTML = `<div class="mc-node mc-content"><div class="mc-header"><span>🤖</span> Agente IA</div><div class="box ai-agent-node-preview"><em style="color:#8492a6; font-size:11px;">Sin configuración</em></div></div>`;

export function renderAiAgentPreview(nodeId, config = {}) {
  return config.model ? `<div style="background:#e0e7ff; padding:8px; border-radius:6px; font-size:11px; color:#3730a3;">🤖 ${config.model}</div>` : '<em style="color:#8492a6; font-size:11px;">Sin modelo</em>';
}

export function renderAiAgentInspector(nodeId, data = {}) {
  return {
    title: 'Agente IA',
    html: `<div class="config-group"><label class="config-label">Modelo</label><select class="config-input" id="ai-model"><option value="">Selecciona modelo</option><option value="gpt-4">GPT-4</option><option value="gpt-3.5">GPT-3.5</option><option value="claude">Claude</option></select></div><div class="config-group"><label class="config-label">Instrucción del sistema</label><textarea class="config-input" placeholder="Define el comportamiento del agente..." style="height:100px; font-family: monospace; font-size: 12px;"></textarea></div><div class="config-group"><label class="config-label">Temperatura (0-1)</label><input type="number" class="config-input" value="0.7" min="0" max="1" step="0.1" /></div><button class="btn-primary" style="width:100%; margin-top:10px;">Aplicar</button>`
  };
}

export const AiAgentNodeConfig = { type: 'ai_agent', label: 'Agente IA', icon: '🤖', inputs: 1, outputs: 1, html: AI_AGENT_HTML, render: renderAiAgentPreview, inspector: renderAiAgentInspector };
