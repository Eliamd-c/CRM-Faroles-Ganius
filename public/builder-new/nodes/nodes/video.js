/**
 * Video Node Module
 */

export const VIDEO_HTML = `<div class="mc-node mc-content"><div class="mc-header"><span>🎬</span> Video</div><div class="box video-node-preview"><em style="color:#8492a6; font-size:11px;">Sin video</em></div></div>`;

export function renderVideoPreview(nodeId, config = {}) {
  return config.video_url ? `<div style="background:#dbeafe; padding:8px; border-radius:6px; font-size:11px; color:#0369a1;">🎬 Reproducir video</div>` : '<em style="color:#8492a6; font-size:11px;">Sin video</em>';
}

export function renderVideoInspector(nodeId, data = {}) {
  return {
    title: 'Video',
    html: `<div class="config-group"><label class="config-label">URL del video</label><input type="text" class="config-input" placeholder="https://..." /><label class="config-label" style="margin-top:12px;">Autoplay</label><input type="checkbox" style="margin-top:8px;" /><button class="btn-primary" style="width:100%; margin-top:10px;">Aplicar</button></div>`
  };
}

export const VideoNodeConfig = { type: 'video', label: 'Video', icon: '🎬', inputs: 1, outputs: 1, html: VIDEO_HTML, render: renderVideoPreview, inspector: renderVideoInspector };
