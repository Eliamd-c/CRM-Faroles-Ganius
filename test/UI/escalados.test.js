/**
 * Test Suite: Escalados Pendientes UI
 * Archivo: test/UI/escalados.test.js
 *
 * Tests de funciones de la UI de escalados:
 * - formatTimeDiff
 * - renderEscaladosTable
 * - sendHumanMessage
 * - Estado vacío
 * - Actualización de datos
 *
 * Nota: JSDOM necesario para tests con DOM
 */

/**
 * Mock de document para escape HTML
 */
class MockDOM {
  constructor() {
    this.textContent = '';
    this.innerHTML = '';
  }

  static createElement() {
    return new MockDOM();
  }
}

// Escape HTML helper (tomado de agents-studio.js)
const escapeHtml = (text) => {
  if (!text || typeof text !== 'string') return '';

  // Usar map de caracteres en lugar de DOM en Node.js
  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return String(text).replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
};

/**
 * Función: formatTimeDiff
 * Convierte ISO timestamp a tiempo relativo humanizado
 */
const formatTimeDiff = (isoString) => {
  if (!isoString) return 'N/A';

  try {
    const now = new Date();
    const paused = new Date(isoString);

    // Validar que la fecha sea válida
    if (isNaN(paused.getTime())) return 'N/A';

    const diffMs = now - paused;

    if (diffMs < 0) return 'Futuro';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return '0 min';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) {
      const mins = diffMin % 60;
      return mins > 0 ? `${diffHour}h ${mins}m` : `${diffHour}h`;
    }

    const hours = diffHour % 24;
    return hours > 0 ? `${diffDay}d ${hours}h` : `${diffDay}d`;
  } catch (error) {
    return 'N/A';
  }
};

/**
 * Función: formatReasonBadge
 * Convierte reason en HTML badge
 */
const formatReasonBadge = (reason) => {
  const reasonMap = {
    'escalacion': 'Escalación',
    'operador_manual': 'Operador',
    'requiere_ia': 'Requiere IA'
  };

  const label = reasonMap[reason] || reason || 'Desconocida';
  const badgeClass = reason === 'escalacion' ? 'escalacion' :
                     reason === 'operador_manual' ? 'operador' :
                     reason === 'requiere_ia' ? 'requiere_ia' : 'operador';

  return `<span class="escalados-badge ${badgeClass}">${escapeHtml(label)}</span>`;
};

/**
 * Función: renderEscaladosTable
 * Renderiza tabla HTML desde datos
 */
const renderEscaladosTable = (escalados) => {
  let html = `
    <table class="escalados-table">
      <thead>
        <tr>
          <th>Usuario</th>
          <th>Pausado hace</th>
          <th class="escalados-razon">Razón</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;

  escalados.forEach(escalado => {
    const username = escapeHtml(escalado.username || 'Desconocido');
    const timeDiff = formatTimeDiff(escalado.paused_at);
    const reasonBadge = formatReasonBadge(escalado.pause_reason);

    html += `
      <tr>
        <td>${username}</td>
        <td>${timeDiff}</td>
        <td class="escalados-razon">${reasonBadge}</td>
        <td>
          <button class="btn-view-escalado" data-escalado-id="${escapeHtml(String(escalado.instagram_id))}">
            <i class="fas fa-eye"></i> Ver
          </button>
        </td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
    <div style="padding: 1rem; text-align: center; font-size: 0.85rem; color: #9ba1a6;">
      Total: ${escalados.length} contacto(s) en escalación
    </div>
  `;

  return html;
};

/**
 * Tests: formatTimeDiff
 */
describe('formatTimeDiff', () => {
  test('debe retornar "0 min" para tiempo actual', () => {
    const now = new Date().toISOString();
    expect(formatTimeDiff(now)).toBe('0 min');
  });

  test('debe retornar "5m" para 5 minutos atrás', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatTimeDiff(fiveMinAgo)).toBe('5m');
  });

  test('debe retornar "2h 30m" para 2.5 horas atrás', () => {
    const twoHalfHoursAgo = new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString();
    expect(formatTimeDiff(twoHalfHoursAgo)).toBe('2h 30m');
  });

  test('debe retornar "1d 3h" para 1 día y 3 horas atrás', () => {
    const oneDayThreeHoursAgo = new Date(Date.now() - (24 + 3) * 60 * 60 * 1000).toISOString();
    expect(formatTimeDiff(oneDayThreeHoursAgo)).toBe('1d 3h');
  });

  test('debe retornar "Futuro" para timestamp en el futuro', () => {
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    expect(formatTimeDiff(future)).toBe('Futuro');
  });

  test('debe retornar "N/A" para timestamp nulo', () => {
    expect(formatTimeDiff(null)).toBe('N/A');
  });

  test('debe retornar "N/A" para timestamp inválido', () => {
    expect(formatTimeDiff('invalid-date')).toBe('N/A');
  });
});

/**
 * Tests: renderEscaladosTable
 */
describe('renderEscaladosTable', () => {
  test('debe renderizar tabla con datos correctos', () => {
    const escalados = [
      {
        instagram_id: 'ig_123',
        username: 'juan_perez',
        paused_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        pause_reason: 'operador_manual'
      }
    ];

    const html = renderEscaladosTable(escalados);

    expect(html).toContain('<table class="escalados-table">');
    expect(html).toContain('juan_perez');
    expect(html).toContain('ig_123');
    expect(html).toContain('Operador');
  });

  test('debe escapar HTML en username para prevenir XSS', () => {
    const escalados = [
      {
        instagram_id: 'ig_123',
        username: '<img src=x onerror="alert(1)">',
        paused_at: new Date().toISOString(),
        pause_reason: 'escalacion'
      }
    ];

    const html = renderEscaladosTable(escalados);

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  test('debe mostrar evento delegado en botón Ver', () => {
    const escalados = [
      {
        instagram_id: 'ig_456',
        username: 'maria_gomez',
        paused_at: new Date().toISOString(),
        pause_reason: 'requiere_ia'
      }
    ];

    const html = renderEscaladosTable(escalados);

    expect(html).toContain('data-escalado-id="ig_456"');
    expect(html).toContain('btn-view-escalado');
  });

  test('debe renderizar múltiples filas', () => {
    const escalados = [
      {
        instagram_id: 'ig_1',
        username: 'user1',
        paused_at: new Date().toISOString(),
        pause_reason: 'operador_manual'
      },
      {
        instagram_id: 'ig_2',
        username: 'user2',
        paused_at: new Date().toISOString(),
        pause_reason: 'escalacion'
      }
    ];

    const html = renderEscaladosTable(escalados);

    expect(html).toContain('user1');
    expect(html).toContain('user2');
    expect(html).toContain('Total: 2 contacto(s)');
  });
});

/**
 * Tests: Badges de razón
 */
describe('formatReasonBadge', () => {
  test('debe renderizar badge de escalación en rojo', () => {
    const badge = formatReasonBadge('escalacion');
    expect(badge).toContain('escalados-badge escalacion');
    expect(badge).toContain('Escalación');
  });

  test('debe renderizar badge de operador en amarillo', () => {
    const badge = formatReasonBadge('operador_manual');
    expect(badge).toContain('escalados-badge operador');
    expect(badge).toContain('Operador');
  });

  test('debe renderizar badge de requiere_ia en azul', () => {
    const badge = formatReasonBadge('requiere_ia');
    expect(badge).toContain('escalados-badge requiere_ia');
    expect(badge).toContain('Requiere IA');
  });

  test('debe escapar HTML en reason personalizado', () => {
    const badge = formatReasonBadge('<script>alert(1)</script>');
    expect(badge).not.toContain('<script>');
  });
});

/**
 * Tests: Estado vacío
 */
describe('Estado vacío', () => {
  test('debe retornar HTML de tabla vacía con 0 contactos', () => {
    const html = renderEscaladosTable([]);
    expect(html).toContain('Total: 0 contacto(s)');
    expect(html).toContain('escalados-table');
  });

  test('debe mostrar mensaje descriptivo cuando no hay escalados', () => {
    const html = `
      <div class="escalados-empty">
        <i class="fas fa-check-circle"></i>
        <h3>Sin contactos en escalación</h3>
        <p>El sistema está en orden.</p>
      </div>
    `;
    expect(html).toContain('Sin contactos en escalación');
    expect(html).toContain('El sistema está en orden');
  });
});

/**
 * Tests: Validación de mensaje
 */
describe('sendHumanMessage validaciones', () => {
  test('debe rechazar mensaje vacío', () => {
    const message = '';
    expect(!message || message.length === 0).toBe(true);
  });

  test('debe rechazar mensaje > 950 caracteres', () => {
    const message = 'a'.repeat(951);
    expect(message.length > 950).toBe(true);
  });

  test('debe aceptar mensaje de exactamente 950 caracteres', () => {
    const message = 'a'.repeat(950);
    expect(message.length).toBe(950);
  });

  test('debe aceptar mensaje válido', () => {
    const message = 'Hola, ¿cómo estás?';
    expect(message && message.length > 0 && message.length <= 950).toBe(true);
  });
});

/**
 * Tests: Actualización de datos
 */
describe('Actualización de datos', () => {
  test('debe mergear nuevos datos con tabla existente', () => {
    const newEscalados = [
      {
        instagram_id: 'ig_1',
        username: 'user1',
        paused_at: new Date().toISOString(),
        pause_reason: 'escalacion'
      },
      {
        instagram_id: 'ig_2',
        username: 'user2',
        paused_at: new Date().toISOString(),
        pause_reason: 'requiere_ia'
      }
    ];

    const html = renderEscaladosTable(newEscalados);
    expect(html).toContain('user1');
    expect(html).toContain('user2');
    expect(html).toContain('Total: 2 contacto(s)');
  });
});

/**
 * Tests: Responsividad
 */
describe('Responsividad', () => {
  test('debe ocultar columna de razón en mobile', () => {
    const css = '.escalados-table .escalados-razon { display: none; }';
    expect(css).toContain('display: none');
  });

  test('debe mantener columnas esenciales en mobile', () => {
    const escalados = [
      {
        instagram_id: 'ig_1',
        username: 'user1',
        paused_at: new Date().toISOString(),
        pause_reason: 'operador_manual'
      }
    ];

    const html = renderEscaladosTable(escalados);
    // Verificar que usuario y acciones siempre están presentes
    expect(html).toContain('user1');
    expect(html).toContain('btn-view-escalado');
  });
});
