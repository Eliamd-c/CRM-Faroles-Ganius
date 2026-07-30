let allFlows = [];
let deleteTarget = null;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isInternalSubFlow(flow) {
  if (!flow.keywords || flow.keywords.length === 0) return false;
  return flow.keywords.every(kw => /^[A-Z][A-Z0-9_]+$/.test(kw) && kw.includes('_'));
}

function getFlowStatus(flow) {
  if (flow.enabled === false) return { label: 'DETENIDO', cls: 'status-stopped' };
  if (!flow.keywords || flow.keywords.length === 0 || !flow.steps || flow.steps.length === 0) {
    return { label: 'BORRADOR', cls: 'status-draft' };
  }
  return { label: 'ACTIVO', cls: 'status-live' };
}

function timeAgo(iso) {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? 'es' : ''}`;
}

function renderKeywordPills(keywords) {
  if (!keywords || keywords.length === 0) return '<span style="color:var(--text-muted);font-size:12px">Sin keywords</span>';
  const max = 4;
  const shown = keywords.slice(0, max);
  let html = shown.map(kw => `<span class="keyword-pill">${escapeHtml(kw)}</span>`).join('');
  if (keywords.length > max) {
    html += `<span class="keyword-more">+${keywords.length - max}</span>`;
  }
  return html;
}

function countStepTypes(steps) {
  if (!steps || steps.length === 0) return { total: 0, types: [] };
  const typeSet = new Set();
  for (const s of steps) typeSet.add(s.type);
  return { total: steps.length, types: Array.from(typeSet) };
}

function stepTypeIcons(types) {
  const icons = {
    text: '💬', template: '💬', delay: '⏱', carousel: '🖼️',
    gallery: '📸', audio: '🎵', video: '🎥', file: '📄',
    action: '⚡', input: '📥', condition: '🔀', randomizer: '🎲',
    goto: '↗️', card: '💬', buttons: '💬'
  };
  return types.map(t => icons[t] || '').filter(Boolean).join(' ');
}

function renderFlows(flows) {
  const visible = flows.filter(f => !isInternalSubFlow(f));
  const tbody = document.getElementById('flows-body');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('flow-count');

  count.textContent = `(${visible.length})`;

  if (visible.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = visible.map(flow => {
    const status = getFlowStatus(flow);
    const { total, types } = countStepTypes(flow.steps);
    const checked = flow.enabled !== false ? 'checked' : '';

    return `<tr data-id="${escapeHtml(flow.id)}">
      <td data-label="Nombre">
        <a class="flow-name" href="/builder.html?flowId=${encodeURIComponent(flow.id)}">${escapeHtml(flow.name || flow.id)}</a>
        <div class="flow-id">${escapeHtml(flow.id)}</div>
      </td>
      <td data-label="Estado">
        <span class="status-badge ${status.cls}">${status.label}</span>
      </td>
      <td data-label="Keywords">
        <div class="keywords-cell">${renderKeywordPills(flow.keywords)}</div>
      </td>
      <td data-label="Pasos">
        <span class="step-count">${total}</span>
        <span style="font-size:12px;margin-left:4px">${stepTypeIcons(types)}</span>
      </td>
      <td data-label="Ejecutados">
        ${flow.executionCount > 0
          ? `<span style="font-weight:600;color:var(--text-main)">${flow.executionCount}</span><span style="font-size:11px;color:var(--text-muted);margin-left:3px">veces</span>`
          : `<span style="color:var(--text-muted);font-size:12px">—</span>`}
      </td>
      <td data-label="Modificado" class="date-cell">${timeAgo(flow.updatedAt)}</td>
      <td data-label="Acciones">
        <div class="actions-cell">
          <label class="toggle-switch" title="${flow.enabled !== false ? 'Desactivar' : 'Activar'}">
            <input type="checkbox" ${checked} onchange="toggleFlow('${escapeHtml(flow.id)}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
          <button class="btn-icon" title="Duplicar" onclick="duplicateFlow('${escapeHtml(flow.id)}')">📋</button>
          <button class="btn-icon danger" title="Eliminar" onclick="openDeleteModal('${escapeHtml(flow.id)}', '${escapeHtml(flow.name || flow.id)}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function loadFlows() {
  try {
    const res = await fetch('/api/flows');
    const config = await res.json();
    allFlows = config.flows || [];
    renderFlows(allFlows);
  } catch (err) {
    console.error('Error loading flows:', err);
  }
}

async function toggleFlow(id, enabled) {
  try {
    const res = await fetch(`/api/flows/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    if (!res.ok) throw new Error('Failed');
    await loadFlows();
  } catch (err) {
    console.error('Error toggling flow:', err);
    await loadFlows();
  }
}

async function duplicateFlow(id) {
  try {
    const res = await fetch(`/api/flows/${encodeURIComponent(id)}/duplicate`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed');
    await loadFlows();
  } catch (err) {
    console.error('Error duplicating flow:', err);
  }
}

function openDeleteModal(id, name) {
  deleteTarget = id;
  document.getElementById('delete-flow-name').textContent = name;
  document.getElementById('delete-modal').classList.add('visible');
}

function closeDeleteModal() {
  deleteTarget = null;
  document.getElementById('delete-modal').classList.remove('visible');
}

document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
  if (!deleteTarget) return;
  try {
    const res = await fetch(`/api/flows/${encodeURIComponent(deleteTarget)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed');
    closeDeleteModal();
    await loadFlows();
  } catch (err) {
    console.error('Error deleting flow:', err);
    closeDeleteModal();
  }
});

document.addEventListener('DOMContentLoaded', loadFlows);
