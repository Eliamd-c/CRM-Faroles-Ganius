# Plan: Quick Replies — Botones que desaparecen

## Contexto

En tu CRM actual, los "botones" se envían como **Template Messages** (botones persistentes que permanecen en el hilo). Manychat ofrece **Quick Replies**: botones que desaparecen tras tocarlos. Son conceptualmente distintos en la plataforma Meta, y la experiencia UX es completamente diferente.

Meta distingue entre:
- **Template Buttons**: persisten, se pueden tocar múltiples veces
- **Quick Replies**: desaparecen tras el primer toque, son para capturar una respuesta única (opción A, opción B, etc.)

Tu builder visual actualmente tiene un nodo "message" que puede llevar botones. La pregunta es: ¿qué tipo de botón es? ¿template o quick reply?

---

## Análisis técnico actual

### Cómo funcionan en tu código hoy

**Backend (app.js):**
```
sendMessage(senderId, text, buttons) → envía a Meta Graph API
```
Buscar en el código: ¿qué estructura de `buttons` se está pasando? ¿Es un array de `{ title, payload }`? ¿O es la estructura completa de `quick_replies` de Meta?

**Frontend (builder.js):**
- El nodo `message` permite agregar botones
- Se almacenan en `nodeBlocksState[nodeId]`
- Cada botón es un objeto con `{id, type, content, buttons}`

**Diferencia clave:** Los botones que hoy envías podrían ser templates, pero Meta acepta ambos. Necesitamos decidir cuál es el comportamiento deseado.

---

## Decisión de diseño requerida

**Opción A:** Mantener un único tipo de "botón" que se envía como Quick Reply
- **Ventaja:** Más simple, menos opciones en el builder
- **Desventaja:** No puedes tener menús persistentes (el usuario toca una opción y desaparece)
- **Caso de uso:** "¿Qué te interesa? [Ver precios] [Más info]" → respuesta única esperada

**Opción B:** Permitir DOS tipos de botones en el builder: "Botones rápidos" y "Botones persistentes"
- **Ventaja:** Máxima flexibilidad, cubre todos los casos
- **Desventaja:** Complejidad en la UI del builder, más confuso para el usuario
- **Caso de uso:** Menús navegables (toca "Productos" → te muestra opciones → toca "Precios" → desaparece)

**Recomendación:** Opción A por ahora. Si después necesitas menús persistentes, lo agregas como un tipo de nodo separado llamado "Menu persistente".

---

## Requisitos técnicos para implementar Quick Replies

### En el backend (app.js)

**1. Cambio en la función `sendMessage()`**
- Detectar si el mensaje tiene `buttons` (quick replies)
- Construir el payload con la estructura de Meta:
  ```json
  {
    "recipient": { "id": "..." },
    "message": {
      "text": "¿Qué te interesa?",
      "quick_replies": [
        { "content_type": "text", "title": "Ver precios", "payload": "VER_PRECIOS" },
        { "content_type": "text", "title": "Más info", "payload": "MAS_INFO" }
      ]
    }
  }
  ```

**2. Cambio en cómo se procesan botones en `processFlowSteps()`**
- Cuando se toca un botón, Instagram envía `postback.payload` o `message.quick_reply.payload`
- El webhook llega a `app.post('/webhook', ...)` → `handleMessage(event)`
- El código debe extraer el `payload` del botón presionado
- Usar ese payload para decidir cuál es el siguiente flujo (actualmente busca por keyword)

---

## Cambios en la estructura de datos

### Base de datos (Supabase)

Ningún cambio requerido. Los buttons se guardan en el JSON del flujo, no en el perfil del cliente.

### JSON de flows.json (flujos guardados)

El nodo `message` necesita un nuevo campo:

**Hoy:**
```json
{
  "type": "message",
  "message": "¿Qué te interesa?",
  "buttons": [
    { "id": 1, "title": "Ver precios", "payload": "VER_PRECIOS" }
  ]
}
```

**Con Quick Replies:**
```json
{
  "type": "message",
  "message": "¿Qué te interesa?",
  "buttons": [
    { "id": 1, "title": "Ver precios", "payload": "VER_PRECIOS" }
  ],
  "buttonType": "quick_reply"  // NUEVO: explícito que es quick reply
}
```

O simplemente cambiar el nombre del nodo de `message` a `quick_reply_message` para ser más explícito.

---

## Cambios en el Builder Visual (public/builder.js)

### Nodo visual

El nodo `message` actual debería tener una **opción visual clara** que diga:
- "Tipo de botón: Quick Reply (desaparecen tras tocar)" — radio button
- "Tipo de botón: Persistente (permanecen)" — radio button (para implementar después)

### Panel inspector

Cuando se edita un nodo `message` con botones:
1. El campo "Mensaje" → texto del mensaje
2. El campo "Botones" → array de botones
3. NUEVO: Mostrar límite de Meta: **máximo 13 botones, máximo 20 caracteres por título**
4. NUEVO: Validación en tiempo real → si el usuario escribe más de 20 caracteres, mostrar warning rojo "Instagram truncará este texto"

### Al serializar el flujo (buildStepsFromNode)

Cuando se guarda el flujo, el `buildStepsFromNode()` debe incluir `buttonType: "quick_reply"` en el objeto del paso.

---

## Cambios en el webhook (app.js POST /webhook)

### Detección de quick reply presionado

Hoy el webhook procesa:
```javascript
const text = event.message?.text || event.postback?.payload;
```

Con quick replies, Meta envía:
```json
{
  "message": {
    "text": "Ver precios",
    "quick_reply": { "payload": "VER_PRECIOS" }
  }
}
```

**Cambio requerido:** Extraer el `payload` con prioridad:
```javascript
const payload = event.message?.quick_reply?.payload || event.postback?.payload || event.message?.text;
```

### Ruteo basado en payload

Actualmente en `handleMessage()` línea 309-327, se busca un flujo por keyword:
```javascript
for (const flow of flowsConfig.flows) {
  if (flow.keywords && flow.matchType === 'contains') {
    const match = flow.keywords.find(...);
    if (match) matchedFlow = flow;
  }
}
```

**Necesario:** Agregar una segunda búsqueda por payload de botón presionado:
1. Primero: buscar si el mensaje es un payload de un botón → buscar nodo con ese payload como salida
2. Segundo: si no es payload, buscar por keyword normal
3. Tercero: ejecutar defaultFlow

---

## Limitaciones de Meta a implementar

| Límite | Valor | Acción en el builder |
|---|---|---|
| Máximo de botones | 13 | Mostrar error si intentas agregar más |
| Máximo de caracteres en título | 20 | Validar y truncar/advertir |
| Caracteres permitidos | Alfanuméricos + espacios | Advertencia si usa caracteres especiales |
| Disponibilidad | Solo móvil | No es un problema técnico, pero documentar |

---

## Impacto en experiencia del usuario

### Para el operador (quien diseña el flujo)

**Antes:**
- Agrega un nodo "message" con texto y botones
- Los botones persisten

**Después:**
- Agrega un nodo "message" con texto y botones
- Elige "Quick Reply" o "Botón persistente" en las opciones
- El builder valida que no exceda 13 botones ni 20 caracteres por botón
- Al guardar, se envía con la estructura correcta a Meta

### Para el usuario final (quien recibe el mensaje en Instagram)

**Antes:**
- Lee el mensaje, ve botones persistentes, puede tocar cualquiera múltiples veces

**Después:**
- Lee el mensaje, ve botones que desaparecen al tocar uno
- Respuesta más natural para "selecciona una opción"

---

## Verificación / Testing

**Casos a probar:**

1. **Quick reply básico**
   - Crear flujo con nodo message + 2 botones quick reply
   - Guardar el flujo
   - Abrir en Instagram y presionar un botón
   - Verificar: botón desaparece, payload llega al webhook, se ejecuta el flujo correcto

2. **Límite de 13 botones**
   - Intentar agregar 14 botones en el builder
   - Verificar: el builder rechaza o avisa

3. **Límite de 20 caracteres**
   - Escribir título de botón con 25 caracteres
   - Verificar: el builder advierte que será truncado en Instagram

4. **Payload incorrecto**
   - Presionar un botón cuyo payload no existe en ningún nodo
   - Verificar: se ejecuta defaultFlow o se IgnoRA el mensaje

5. **Combinación con tags/campos**
   - Crear un flujo: "¿Qué te interesa?" → [Precios] [Contacto]
   - Al tocar cada botón, agregar un tag diferente
   - Verificar: los tags se guardan correctamente en Supabase

---

## Checklist de implementación

- [ ] **Backend:** Modificar `sendMessage()` para detectar y enviar quick_replies
- [ ] **Backend:** Modificar `handleMessage()` para extraer payload de quick reply
- [ ] **Backend:** Agregar búsqueda de flujo por payload de botón
- [ ] **Backend:** Validar límites de Meta (13 botones, 20 caracteres)
- [ ] **Frontend:** Agregar campo "Tipo de botón" al panel inspector del nodo message
- [ ] **Frontend:** Validación en tiempo real de límites
- [ ] **Frontend:** Cambiar serialización para incluir `buttonType: "quick_reply"`
- [ ] **Database:** schema.sql — opcional, no necesita cambios (buttons guardados en JSON del flujo)
- [ ] **Testing:** Enviar mensajes reales a Instagram y verificar comportamiento
- [ ] **Documentation:** Actualizar README con diferencia entre quick replies y botones persistentes
