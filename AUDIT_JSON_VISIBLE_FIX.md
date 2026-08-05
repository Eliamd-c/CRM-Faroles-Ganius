# AUDITORÍA Y FIXES: JSON Visible + Respuesta Redundante

**Fecha:** 2026-08-05  
**Arquitecto:** Claude Code  
**Severidad:** CRÍTICA  
**Estado:** FIXES APLICADOS

---

## RESUMEN EJECUTIVO

Se identificaron **DOS BUGS CRÍTICOS** en la cadena de orquestación LangGraph → webhook:

### BUG A: JSON Visible al Usuario (CRÍTICO)
**Síntoma:** El usuario ve mensajes crudos JSON: `{"success":true,"message":"Quick Replies enviados...","awaiting_input":true}`

**Causa Raíz:** 
- `processConversation()` en langgraph.service.js toma el último mensaje del array
- Cuando se ejecuta `send_quick_replies`, el último mensaje es de tipo 'tool' con el JSON del resultado
- Ese JSON se retorna como `reply` en el action
- HandleIncomingMessageUseCase envía ese reply sin verificar `awaiting_quick_reply`

**Root Trace:**
```
respondNode outputs: [{ role: 'assistant', content: "texto" }, tool_calls: [...]]
                     ↓
toolNode executes:   [{ role: 'tool', content: '{"success":true,...}' }]
                     ↓
processConversation: const lastMsg = result.messages[-1]  ← AQUÍ (toma tool message)
                     reply: lastMsg.content  ← JSON!!!
                     ↓
HandleIncomingMessageUseCase: send_message(reply)  ← ENVÍA EL JSON
```

### BUG B: Respuesta Redundante (PROBABLE)
**Síntoma:** Después de JSON, el usuario ve otra respuesta (ej. "respuesta de Kit de Aliado")

**Causa Probable:**
- ReAct loop se ejecuta si `awaiting_quick_reply` no se verifica
- O respondNode se ejecuta dos veces si el router no pausa correctamente
- Necesita verificación adicional en logs

---

## RAÍZ ARQUITECTÓNICA

### Patrón ReAct Loop (LangGraph)
El agente utiliza ReAct (Reasoning + Acting):
1. **Reasoning (respondNode):** LLM decide qué hacer
2. **Acting (toolNode):** Ejecuta herramientas
3. **Feedback (tool messages):** Retorna resultados para que LLM vuelva a razonar

**Problema:** Los tool messages contienen feedback INTERNO para el LLM, no son respuestas al usuario.

### Arquitectura de Pausa Conversacional
Cuando `send_quick_replies` se ejecuta:
1. Envía botones a Meta API (correcto)
2. Retorna `{success: true, awaiting_input: true}`
3. Marca `awaiting_quick_reply=true` para pausar el flujo
4. NO debe generar más mensajes al usuario

**Lo que salió mal:**
- El resultado del tool se confundió con respuesta al usuario
- La verificación de `awaiting_quick_reply` se perdió en la migración a Clean Architecture

---

## FIXES APLICADOS

### FIX 1: Filtrar Tool Messages en `processConversation`
**Archivo:** `src/services/langgraph.service.js` (línea 472-485)

**Cambio:**
```javascript
// ANTES: Toma CUALQUIER último mensaje (podría ser tool)
const lastMsg = result.messages[result.messages.length - 1];
reply: lastMsg.content

// DESPUÉS: Filtra solo mensajes de assistant
const assistantMsgs = result.messages.filter(m => m.role === 'assistant');
const lastAssistantMsg = assistantMsgs.length > 0
  ? assistantMsgs[assistantMsgs.length - 1]
  : null;

// Si estamos pausando para quick_reply y no hay respuesta assistant, retornar acción correcta
if (!lastAssistantMsg && result.awaiting_quick_reply) {
  action: 'pause_for_input'
  reply: ''
}
```

**Impacto:**
- El JSON del tool NUNCA se ve al usuario
- Se retorna action correcto: 'pause_for_input' en lugar de 'send_message'

### FIX 2: Verificar `awaiting_quick_reply` en HandleIncomingMessageUseCase
**Archivo:** `src/use-cases/HandleIncomingMessageUseCase.js` (línea 89-108)

**Cambio:**
```javascript
// ANTES: No verificaba awaiting_quick_reply
const result = await this.langGraphService.processConversation(senderId, text, contact);
if (result.action === 'send_message' && result.reply) {
  await this._sendInChunks(senderId, result.reply);
}

// DESPUÉS: Verificación explícita
if (result.awaiting_quick_reply) {
  console.log(`⏸️ Quick replies enviados - pausando conversación`);
  return { status: 'awaiting_quick_reply', contact };
}

if (result.action === 'pause_bot') { ... }
else if (result.action === 'pause_for_input') { ... }  // ← NUEVO
else if (result.action === 'send_message' && result.reply) { ... }
```

**Impacto:**
- Double-check de seguridad
- No se envía mensaje si estamos esperando respuesta en botones
- Manejo explícito de acción 'pause_for_input'

### FIX 3: Consistencia en flow.service.js
**Archivo:** `src/services/flow.service.js` (línea 219-233)

**Cambio:** Misma verificación de `awaiting_quick_reply` cuando se dispara AI desde triggers de flujo

**Impacto:**
- Consistencia: todos los puntos que consumen processConversation validan awaiting_quick_reply
- Evita envío de JSON desde flujos activados por palabras clave

---

## VALIDACIÓN (VERIFICAR DESPUÉS DE DESPLEGAR)

### Test 1: Verificar que NO se vea JSON
```
1. Usuario envía: "Hola"
2. Bot responde con texto + quick_replies (botones)
3. Usuario NO debería ver: {"success":true,...}
4. Usuario debería ver: El texto de la respuesta + botones
```

**Logs esperados:**
```
[LangGraphService] ⏸️ Pausa de conversación (quick_reply) - sin reply adicional
[HandleMessage] ⏸️ Quick replies enviados - awaiting_quick_reply=true, pausando conversación
```

### Test 2: Verificar que NO haya respuesta redundante
```
1. Usuario hace click en botón de quick_reply
2. Bot responde UNA SOLA VEZ
3. No hay repeticiones de la respuesta anterior
```

**Logs a revisar:**
```
[RespondNode] 🔧 LLM solicita...
```

Debe aparecer una sola vez por conversación de usuario, no dos.

### Test 3: Verificar respuesta normal (sin quick_replies)
```
1. Usuario envía: "¿Cuál es el precio?"
2. Bot responde normalmente (sin botones)
3. Debe ver: La respuesta completa del agente
```

**Logs esperados:**
```
[LangGraphService] ✅ Respuesta generada
[HandleMessage] Status: ai_handled
```

---

## NOTAS ARQUITECTÓNICAS

### Por qué esto es una arquitectura ResAct correcta

**ReAct Loop Correcto:**
```
User Message → Reasoning (respondNode) → 
  Decide: "Usar send_quick_replies" → 
  Return: [assistant_msg, tool_calls=[send_quick_replies]]
    ↓
Acting (toolNode) → 
  Execute: send_quick_replies
  Return: [tool_msg_with_JSON, awaiting_quick_reply=true]
    ↓
Router Check → 
  if awaiting_quick_reply=true → pauseForInput → END
    ↓
Return to Webhook → 
  Check awaiting_quick_reply → 
  if true → return (no send) ← ESTO FALTABA
```

### Patrón de Integración Clean Architecture

Este proyecto usa Clean Architecture con:
- **Use Cases:** Orquestación de la lógica (HandleIncomingMessageUseCase)
- **Services:** Servicios de dominio (LangGraphService)
- **Gateways:** Adapters a sistemas externos (Meta, DB)

El bug ocurrió en la **transición entre Service → UseCase** donde se perdió la validación de estado.

---

## RIESGOS RESIDUALES

### Risk 1: Respuesta redundante no completamente diagnosticada
Aplicamos un fix de doble-check, pero la causa exacta de "respuesta de Kit de Aliado" no se diagnosticó.

**Acción recomendada:**
- Monitorear logs de producción después del deploy
- Buscar múltiples ejecuciones de `[RespondNode] 🔧 LLM solicita`
- Si sigue ocurriendo, puede ser un ReAct loop no controlado

### Risk 2: Histórico de mensajes puede tener JSON persistido
Si hay clientes con conversaciones antiguas que recibieron el JSON, podría afectar experiencia.

**Acción recomendada:**
- Revisar tabla `messages` en Supabase para detectar mensajes con JSON
- Considerar script de limpieza si es crítico

### Risk 3: Estados anteriores en PostgreSQL checkpoint
LangGraph usa PostgreSQL para guardar checkpoints. Si hay checkpoints anteriores con estado inconsistente, podrían afectar.

**Acción recomendada:**
- Test con cliente nuevo (sin historial)
- Test con cliente existente que tenga checkpoint anterior

---

## SIGUIENTE PASO RECOMENDADO

1. **Deploy estos cambios a staging**
2. **Ejecutar tests unitarios de HandleIncomingMessageUseCase**
3. **Manual testing con botones de quick_replies:**
   - "Hola" → Bot envía botones (sin JSON visible)
   - Click en botón → Respuesta única
4. **Monitorear logs en producción** durante 1-2 horas
5. **Si OK:** Desplegar a prod

**Archivos modificados:**
- `src/services/langgraph.service.js`
- `src/use-cases/HandleIncomingMessageUseCase.js`
- `src/services/flow.service.js`

**Commits sugeridos:**
```
fix(critical): Filtrar tool messages en processConversation para evitar JSON visible
fix(critical): Verificar awaiting_quick_reply en HandleIncomingMessageUseCase
fix(critical): Aplicar fix de awaiting_quick_reply en flow.service.js
```
