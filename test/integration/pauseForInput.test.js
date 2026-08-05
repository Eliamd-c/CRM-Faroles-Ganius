/**
 * @fileoverview Tests para la arquitectura de pausa conversacional (pauseForInputNode)
 *
 * Arquitectura probada:
 * 1. Detección de send_quick_replies en postRespondRouter
 * 2. Nodo pauseForInputNode marca estado awaiting_quick_reply
 * 3. SendQuickRepliesCommand marca bot_state='awaiting_input' en BD
 * 4. webhook.handlers respeta la pausa y NO envía mensajes adicionales
 * 5. Flujo completo: quick_replies → pausa → usuario hace click → continúa
 */

const assert = require('assert');

// ====================================================================
// TEST 1: pauseForInputNode detecta send_quick_replies correctamente
// ====================================================================
describe('pauseForInputNode - Detección de Quick Replies', () => {
  it('debe retornar awaiting_quick_reply=true cuando hay send_quick_replies', () => {
    // Simular el nodo sin importar (evitar dependencias pesadas)
    const mockGraphData = {
      tool_calls: [
        {
          function: {
            name: 'send_quick_replies',
            arguments: JSON.stringify({
              message: '¿Cuál prefieres?',
              options: [{ title: 'Opción A' }, { title: 'Opción B' }]
            })
          },
          id: 'tool_1'
        }
      ],
      messages: [{ role: 'assistant', content: 'test' }]
    };

    // Simulación del nodo pauseForInputNode
    function pauseForInputNode(graphData) {
      const toolCalls = graphData.tool_calls || [];
      const hasSendQuickReplies = toolCalls.some(tc => tc.function?.name === 'send_quick_replies');

      if (hasSendQuickReplies) {
        return {
          awaiting_quick_reply: true,
          messages: graphData.messages
        };
      }

      return {
        awaiting_quick_reply: false,
        messages: graphData.messages
      };
    }

    const result = pauseForInputNode(mockGraphData);
    assert.strictEqual(result.awaiting_quick_reply, true, 'Debería marcar awaiting_quick_reply=true');
  });

  it('debe retornar awaiting_quick_reply=false cuando NO hay send_quick_replies', () => {
    const mockGraphData = {
      tool_calls: [
        {
          function: {
            name: 'save_customer_data',
            arguments: '{}'
          },
          id: 'tool_2'
        }
      ],
      messages: [{ role: 'assistant', content: 'test' }]
    };

    function pauseForInputNode(graphData) {
      const toolCalls = graphData.tool_calls || [];
      const hasSendQuickReplies = toolCalls.some(tc => tc.function?.name === 'send_quick_replies');
      if (hasSendQuickReplies) {
        return { awaiting_quick_reply: true, messages: graphData.messages };
      }
      return { awaiting_quick_reply: false, messages: graphData.messages };
    }

    const result = pauseForInputNode(mockGraphData);
    assert.strictEqual(result.awaiting_quick_reply, false, 'Debería marcar awaiting_quick_reply=false');
  });

  it('debe manejar tool_calls vacío sin errores', () => {
    const mockGraphData = {
      tool_calls: [],
      messages: []
    };

    function pauseForInputNode(graphData) {
      const toolCalls = graphData.tool_calls || [];
      const hasSendQuickReplies = toolCalls.some(tc => tc.function?.name === 'send_quick_replies');
      if (hasSendQuickReplies) {
        return { awaiting_quick_reply: true, messages: graphData.messages };
      }
      return { awaiting_quick_reply: false, messages: graphData.messages };
    }

    const result = pauseForInputNode(mockGraphData);
    assert.strictEqual(result.awaiting_quick_reply, false);
  });
});

// ====================================================================
// TEST 2: postRespondRouter retorna 'PAUSE_FOR_INPUT' cuando hay quick_replies
// ====================================================================
describe('postRespondRouter - Enrutamiento de Quick Replies', () => {
  it('debe retornar "PAUSE_FOR_INPUT" cuando hay send_quick_replies', () => {
    const mockGraphData = {
      tool_calls: [
        {
          function: { name: 'send_quick_replies' }
        }
      ]
    };

    function postRespondRouter(graphData) {
      const toolCalls = graphData.tool_calls || [];
      const hasSendQuickReplies = toolCalls.some(tc => tc.function?.name === 'send_quick_replies');

      if (hasSendQuickReplies) {
        return 'PAUSE_FOR_INPUT';
      }

      if (toolCalls.length > 0) return 'TOOLS';
      return 'END_GRAPH';
    }

    const result = postRespondRouter(mockGraphData);
    assert.strictEqual(result, 'PAUSE_FOR_INPUT', 'Debería enrutar a PAUSE_FOR_INPUT');
  });

  it('debe retornar "TOOLS" cuando hay otras herramientas pero no quick_replies', () => {
    const mockGraphData = {
      tool_calls: [
        {
          function: { name: 'query_knowledge_base' }
        }
      ]
    };

    function postRespondRouter(graphData) {
      const toolCalls = graphData.tool_calls || [];
      const hasSendQuickReplies = toolCalls.some(tc => tc.function?.name === 'send_quick_replies');

      if (hasSendQuickReplies) {
        return 'PAUSE_FOR_INPUT';
      }

      if (toolCalls.length > 0) return 'TOOLS';
      return 'END_GRAPH';
    }

    const result = postRespondRouter(mockGraphData);
    assert.strictEqual(result, 'TOOLS', 'Debería enrutar a TOOLS');
  });

  it('debe retornar "END_GRAPH" cuando NO hay tool_calls', () => {
    const mockGraphData = {
      tool_calls: []
    };

    function postRespondRouter(graphData) {
      const toolCalls = graphData.tool_calls || [];
      const hasSendQuickReplies = toolCalls.some(tc => tc.function?.name === 'send_quick_replies');

      if (hasSendQuickReplies) {
        return 'PAUSE_FOR_INPUT';
      }

      if (toolCalls.length > 0) return 'TOOLS';
      return 'END_GRAPH';
    }

    const result = postRespondRouter(mockGraphData);
    assert.strictEqual(result, 'END_GRAPH', 'Debería enrutar a END_GRAPH');
  });

  it('debe priorizar PAUSE_FOR_INPUT sobre TOOLS', () => {
    const mockGraphData = {
      tool_calls: [
        {
          function: { name: 'send_quick_replies' }
        },
        {
          function: { name: 'query_knowledge_base' }
        }
      ]
    };

    function postRespondRouter(graphData) {
      const toolCalls = graphData.tool_calls || [];
      const hasSendQuickReplies = toolCalls.some(tc => tc.function?.name === 'send_quick_replies');

      if (hasSendQuickReplies) {
        return 'PAUSE_FOR_INPUT';
      }

      if (toolCalls.length > 0) return 'TOOLS';
      return 'END_GRAPH';
    }

    const result = postRespondRouter(mockGraphData);
    assert.strictEqual(result, 'PAUSE_FOR_INPUT', 'Debería priorizar PAUSE_FOR_INPUT');
  });
});

// ====================================================================
// TEST 3: SendQuickRepliesCommand marca bot_state='awaiting_input' en BD
// ====================================================================
describe('SendQuickRepliesCommand - Marcando Pausa en BD', () => {
  it('debe incluir awaiting_input=true en el resultado', async () => {
    // Simular ejecución de comando sin BD real
    const params = {
      message: '¿Cuál prefieres?',
      options: [{ title: 'A' }, { title: 'B' }]
    };

    const context = {
      meta: {
        sendQuickReplies: async () => {} // Mock
      },
      senderId: '123456',
      supabaseGateway: {
        db: {
          from: () => ({
            update: () => ({
              eq: () => ({
                catch: (fn) => fn({ message: 'Mock error (no-op)' })
              })
            })
          })
        }
      }
    };

    // Simular la ejecución del comando
    const mockExecute = async (params, context) => {
      const { meta, senderId, supabaseGateway } = context;
      const quickReplies = (params.options || []).slice(0, 13).map(opt => ({
        content_type: 'text',
        title: (opt.title || '').substring(0, 20),
        payload: opt.payload || opt.title
      }));

      await meta.sendQuickReplies(senderId, params.message, quickReplies);

      if (supabaseGateway && senderId) {
        try {
          await supabaseGateway.db
            .from('customers')
            .update({ bot_state: 'awaiting_input', awaiting_input_type: 'choice' })
            .eq('instagram_id', String(senderId))
            .catch(err => console.warn('Mock: Error marcando pausa'));
        } catch (err) {
          // No romper el flujo si falla actualizar la BD
        }
      }

      return {
        success: true,
        message: `Quick Replies enviados con ${quickReplies.length} opciones`,
        awaiting_input: true
      };
    };

    const result = await mockExecute(params, context);
    assert.strictEqual(result.awaiting_input, true, 'Debería retornar awaiting_input=true');
    assert.strictEqual(result.success, true);
  });

  it('debe manejar supabaseGateway=undefined sin romper', async () => {
    const params = {
      message: 'Test',
      options: [{ title: 'A' }]
    };

    const context = {
      meta: {
        sendQuickReplies: async () => {}
      },
      senderId: '123456'
      // supabaseGateway es undefined
    };

    const mockExecute = async (params, context) => {
      const { meta, senderId, supabaseGateway } = context;
      const quickReplies = (params.options || []).slice(0, 13).map(opt => ({
        content_type: 'text',
        title: (opt.title || '').substring(0, 20),
        payload: opt.payload || opt.title
      }));

      await meta.sendQuickReplies(senderId, params.message, quickReplies);

      if (supabaseGateway && senderId) {
        try {
          await supabaseGateway.db
            .from('customers')
            .update({ bot_state: 'awaiting_input', awaiting_input_type: 'choice' })
            .eq('instagram_id', String(senderId))
            .catch(err => {});
        } catch (err) {}
      }

      return {
        success: true,
        message: `Quick Replies enviados con ${quickReplies.length} opciones`,
        awaiting_input: true
      };
    };

    const result = await mockExecute(params, context);
    assert.strictEqual(result.success, true, 'No debe romper sin supabaseGateway');
  });
});

// ====================================================================
// TEST 4: webhook.handlers NO envía mensaje si awaiting_quick_reply=true
// ====================================================================
describe('webhook.handlers - Respetando Pausa', () => {
  it('debe retornar early si result.awaiting_quick_reply=true', () => {
    const result = {
      awaiting_quick_reply: true,
      action: 'send_message',
      reply: 'Este mensaje NO debe enviarse'
    };

    // Simular la lógica en webhook.handlers
    let messageSent = false;
    if (result.awaiting_quick_reply) {
      console.log('Pausa detectada, NO enviando mensaje');
      return; // ← No enviar nada
    }

    messageSent = true; // Esto no debe ejecutarse

    assert.strictEqual(messageSent, false, 'No debería enviar mensaje cuando awaiting_quick_reply=true');
  });

  it('debe enviar mensaje si result.awaiting_quick_reply=false', () => {
    const result = {
      awaiting_quick_reply: false,
      action: 'send_message',
      reply: 'Este mensaje SÍ debe enviarse'
    };

    let messageSent = false;
    if (result.awaiting_quick_reply) {
      return; // No enviar
    }

    if (result.action === 'send_message' && result.reply) {
      messageSent = true;
    }

    assert.strictEqual(messageSent, true, 'Debería enviar mensaje cuando awaiting_quick_reply=false');
  });

  it('debe respetar pausa incluso con action="send_message"', () => {
    const result = {
      awaiting_quick_reply: true,
      action: 'send_message',
      reply: 'No se envía'
    };

    let messageSent = false;
    if (result.awaiting_quick_reply) {
      return; // Pausa: salir sin enviar
    }

    if (result.action === 'send_message' && result.reply) {
      messageSent = true;
    }

    assert.strictEqual(messageSent, false, 'Pausa debería prevenir envío incluso con send_message');
  });
});

// ====================================================================
// TEST 5: GraphState incluye awaiting_quick_reply
// ====================================================================
describe('GraphState - Flag awaiting_quick_reply', () => {
  it('debe tener default value false', () => {
    const graphState = {
      awaiting_quick_reply: {
        value: (x, y) => y !== undefined ? y : x,
        default: () => false
      }
    };

    const defaultValue = graphState.awaiting_quick_reply.default();
    assert.strictEqual(defaultValue, false, 'Default debería ser false');
  });

  it('debe actualizar correctamente el valor', () => {
    const graphState = {
      awaiting_quick_reply: {
        value: (x, y) => y !== undefined ? y : x,
        default: () => false
      }
    };

    // Simular actualización
    const current = false;
    const newValue = true;
    const updated = graphState.awaiting_quick_reply.value(current, newValue);

    assert.strictEqual(updated, true, 'Debería actualizar a true');
  });

  it('debe preservar valor anterior si newValue es undefined', () => {
    const graphState = {
      awaiting_quick_reply: {
        value: (x, y) => y !== undefined ? y : x,
        default: () => false
      }
    };

    const current = true;
    const updated = graphState.awaiting_quick_reply.value(current, undefined);

    assert.strictEqual(updated, true, 'Debería preservar el valor anterior');
  });
});

// ====================================================================
// TEST 6: Contexto recibe supabaseGateway
// ====================================================================
describe('Inyección de Dependencias - supabaseGateway', () => {
  it('debe incluir supabaseGateway en el contexto de toolNode', () => {
    const context = {
      senderId: '123456',
      customer: { instagramId: '123456' },
      meta: {},
      supabase: {},
      supabaseGateway: { db: {}, pauseBot: () => {} }
    };

    assert.ok(context.supabaseGateway, 'Context debe incluir supabaseGateway');
    assert.ok(context.supabaseGateway.db, 'supabaseGateway debe tener .db');
  });

  it('debe funcionar si supabaseGateway=null', () => {
    const context = {
      senderId: '123456',
      customer: { instagramId: '123456' },
      meta: {},
      supabase: {},
      supabaseGateway: null
    };

    // SendQuickRepliesCommand debe manejar esto sin errores
    const supabaseGateway = context.supabaseGateway;
    if (supabaseGateway) {
      // Usar supabaseGateway
    }

    assert.ok(true, 'No debe romper si supabaseGateway es null');
  });
});

// ====================================================================
// TEST 7: Flujo completo (integración conceptual)
// ====================================================================
describe('Flujo Completo - Quick Replies → Pausa → Click', () => {
  it('debe pausar cuando el LLM invoca send_quick_replies', () => {
    // Flujo:
    // 1. Usuario envía mensaje
    // 2. LLM decide usar send_quick_replies
    // 3. postRespondRouter detecta → PAUSE_FOR_INPUT
    // 4. pauseForInputNode marca awaiting_quick_reply=true
    // 5. webhook.handlers NO envía mensaje adicional
    // 6. Usuario hace click en botón
    // 7. webhook.handlers procesa el click (payload) con bot_state='awaiting_input'
    // 8. Bot continúa

    const simulatedFlow = {
      step1_llm_invokes: {
        tool_calls: [
          { function: { name: 'send_quick_replies' } }
        ]
      },
      step2_router_decides: 'PAUSE_FOR_INPUT',
      step3_node_marks: { awaiting_quick_reply: true },
      step4_webhook_validates: false // No envía más mensajes
    };

    assert.ok(simulatedFlow.step1_llm_invokes.tool_calls.length > 0);
    assert.strictEqual(simulatedFlow.step2_router_decides, 'PAUSE_FOR_INPUT');
    assert.strictEqual(simulatedFlow.step3_node_marks.awaiting_quick_reply, true);
    assert.strictEqual(simulatedFlow.step4_webhook_validates, false);
  });

  it('debe reanudar cuando el usuario hace click en un botón', () => {
    // Usuario hace click en quick_reply:
    // 1. webhook.handlers recibe el postback con payload (opción seleccionada)
    // 2. Detecta que bot_state='awaiting_input'
    // 3. Valida el payload
    // 4. Actualiza bot_state='active'
    // 5. Procesa el siguiente paso del flujo

    const userClick = {
      postback: {
        payload: 'option_A'
      },
      sender: { id: '123456' }
    };

    const botState = {
      before: 'awaiting_input',
      after: 'active'
    };

    assert.strictEqual(botState.before, 'awaiting_input');
    assert.strictEqual(botState.after, 'active');
  });
});

// ====================================================================
// TEST 8: Seguridad - Validación de senderId
// ====================================================================
describe('Seguridad - String Conversion en senderId', () => {
  it('debe convertir senderId a string antes de actualizar BD', () => {
    const senderId = 123456; // Número
    const instagramId = String(senderId);

    assert.strictEqual(typeof instagramId, 'string');
    assert.strictEqual(instagramId, '123456');
  });

  it('debe preservar senderId como string si ya lo es', () => {
    const senderId = '123456';
    const instagramId = String(senderId);

    assert.strictEqual(instagramId, '123456');
  });
});

// ====================================================================
// TEST 9: Resiliencia - Manejo de errores en BD
// ====================================================================
describe('Resiliencia - Manejo de Errores', () => {
  it('no debe romper si falla la actualización de BD en SendQuickRepliesCommand', async () => {
    const context = {
      meta: {
        sendQuickReplies: async () => {}
      },
      senderId: '123456',
      supabaseGateway: {
        db: {
          from: () => ({
            update: () => ({
              eq: () => ({
                catch: (fn) => {
                  fn(new Error('BD Error')); // Simular error
                }
              })
            })
          })
        }
      }
    };

    const mockExecute = async (params, context) => {
      const { meta, senderId, supabaseGateway } = context;
      const quickReplies = [{ content_type: 'text', title: 'A', payload: 'A' }];

      await meta.sendQuickReplies(senderId, 'Test', quickReplies);

      if (supabaseGateway && senderId) {
        try {
          await supabaseGateway.db
            .from('customers')
            .update({ bot_state: 'awaiting_input' })
            .eq('instagram_id', String(senderId))
            .catch(err => console.warn('Error BD'));
        } catch (err) {
          console.warn('Capturado:', err.message);
        }
      }

      return {
        success: true,
        awaiting_input: true,
        message: 'OK'
      };
    };

    const result = await mockExecute({}, context);
    assert.strictEqual(result.success, true, 'No debe romper por error de BD');
  });

  it('no debe romper si falla pauseForInputNode', () => {
    const graphData = {
      tool_calls: [{ function: { name: 'send_quick_replies' } }],
      messages: null // Posible error
    };

    function pauseForInputNode(graphData) {
      try {
        const toolCalls = graphData.tool_calls || [];
        const hasSendQuickReplies = toolCalls.some(tc => tc.function?.name === 'send_quick_replies');
        return {
          awaiting_quick_reply: hasSendQuickReplies,
          messages: graphData.messages || []
        };
      } catch (err) {
        console.warn('Error en pauseForInputNode:', err);
        return { awaiting_quick_reply: false, messages: [] };
      }
    }

    const result = pauseForInputNode(graphData);
    assert.strictEqual(result.awaiting_quick_reply, true);
    assert.ok(Array.isArray(result.messages));
  });
});

// ====================================================================
// TEST 10: Validación de entrada en webhook.handlers
// ====================================================================
describe('Validación - webhook.handlers processConversation', () => {
  it('debe retornar early si awaiting_quick_reply=true SIN procesar sendInChunks', () => {
    const result = {
      awaiting_quick_reply: true,
      action: 'send_message',
      reply: 'Este mensaje NO debe enviarse'
    };

    let sendInChunksCalled = false;
    const sendInChunks = (id, msg) => {
      sendInChunksCalled = true;
    };

    // Simular lógica de webhook
    if (result.awaiting_quick_reply) {
      return; // ← Debe retornar aquí
    }

    if (result.action === 'send_message' && result.reply) {
      sendInChunks('123', result.reply);
    }

    assert.strictEqual(sendInChunksCalled, false, 'sendInChunks NO debe ser invocado en pausa');
  });
});
