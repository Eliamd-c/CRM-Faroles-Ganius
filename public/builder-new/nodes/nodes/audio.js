/**
 * Audio Node Module
 */

export const AUDIO_HTML = `<div class="mc-node mc-content"><div class="mc-header"><span>🎵</span> Audio</div><div class="box audio-node-preview"><em style="color:#8492a6; font-size:11px;">Sin audio</em></div></div>`;

export function renderAudioPreview(nodeId, config = {}) {
  return config.audio_url ? `<div style="background:#dcfce7; padding:8px; border-radius:6px; font-size:11px; color:#166534;">🎵 Reproducir audio</div>` : '<em style="color:#8492a6; font-size:11px;">Sin audio</em>';
}

export function renderAudioInspector(nodeId, data = {}) {
  return {
    title: 'Audio',
    html: `<div class="config-group"><label class="config-label">URL del audio</label><input type="text" class="config-input" placeholder="https://..." /><button class="btn-primary" style="width:100%; margin-top:10px;">Aplicar</button></div>`
  };
}

export const AudioNodeConfig = { type: 'audio', label: 'Audio', icon: '🎵', inputs: 1, outputs: 1, html: AUDIO_HTML, render: renderAudioPreview, inspector: renderAudioInspector };
