# 🎯 FASE 2: Disparadores (Anuncio + IA)

**Objetivo**: Implementar sistema híbrido de disparadores para tráfico pagado y orgánico.

**Timeline**: Después de Fase 1 (validar conversión antes de escalar)

---

## 📋 Arquitectura de Disparadores

### Flujo de Decisión

```
Mensaje entrante
      │
      ▼
¿Trae referral (anuncio pagado)?
      │
   Sí │              No
      ▼               ▼
Usar variante    ¿Coincide palabra clave
"anuncio"        de ALTA confianza?
                      │
                   Sí │              No
                      ▼               ▼
                   Disparar        Enviar a
                   directo       clasificador IA
                                      │
                                      ▼
                          ¿Confianza ≥ 70%?
                                      │
                           Sí ────────┼────────── No
                           ▼                      ▼
                     Disparar flujo      ¿Confianza 50-70%?
                                               │
                                      Sí ──────┼────── No
                                      ▼               ▼
                                    Fallback      No disparar
                                    genérico      (dejar para
                                    + botones     humano)
```

---

## 1️⃣ DISPARADOR: Anuncio Pagado (PRIORITY MAX)

**Ya implementado en Fase 1** ✅

Detecta: `messagingEvent.referral` en webhook
Acción: Ir directo a bienvenida "anuncio pagado"

```javascript
if (referral && !contact.flow_step) {
  // Mostrar msg_welcome_from_ad
  // Saltar clasificador
}
```

---

## 2️⃣ DISPARADOR: Palabras Clave Fast-Path

**NUEVO - Implementar**

### Palabras Clave de Alta Confianza

Estas triggean automáticamente sin clasificador:

```javascript
const FAST_PATH_KEYWORDS = {
  'precio|costo|cuánto cuesta|tarifa': 'msg_pricing_and_story',
  'hola|buenos|buenas|hey|qué tal': 'msg_welcome_organic',
  'información|info|catálogo|qué venden|que ofrecen': 'msg_pricing_and_story',
  'comprar|quiero|me interesa|envío|envíos': 'msg_pricing_and_story'
};
```

**Lógica:**
1. Mensaje entra
2. Buscar match en FAST_PATH_KEYWORDS (case-insensitive)
3. Si match → dispara flujo directamente (sin IA)
4. Si NO match → enviar a clasificador IA

**Ventaja:** -90% latencia (sin LLM call)

---

## 3️⃣ DISPARADOR: Intención por IA (Orgánico)

**Ya existe en ai_copilot.js** ✅

**Nueva: Umbrales y contexto**

### Umbral de Confianza

```
Confianza > 70%  → Disparar flujo automáticamente
Confianza 50-70% → Fallback genérico + botones
Confianza < 50%  → No disparar (dejar para humano)
```

### Contexto de Intención

Enviar últimos N mensajes al clasificador:

```javascript
const history = await dbAll('messages', { 
  conversation_id: conversationId 
});
const historyStr = history
  .slice(-6)  // Últimos 6 mensajes
  .map(m => `${m.sender_type}: ${m.text}`)
  .join('\n');

const result = await classifyIntent(text, historyStr, triggers);
```

### Intenciones Disponibles (Phase 1)

```
saludo → start
interes_hogar → FLOW_HOME
interes_negocio → FLOW_BUSINESS
```

**Nuevas intenciones (Phase 2+):**
- `interes_seguimiento` → rastrear pedido
- `interes_oferta` → preguntar descuentos
- `interes_envio` → preguntar envíos

---

## 4️⃣ FALLBACK GENÉRICO (Confianza 50-70%)

Cuando la IA no está segura:

```
¡Hola {Name}! 👋

Veo que te interesa algo, pero no estoy 100% segura de qué.
¿Me ayudas eligiendo? 👇

[Botón: 🏠 Decorar mi hogar]
[Botón: 💰 Vender/distribuir]
[Botón: 📞 Hablar con un humano]
```

---

## 5️⃣ IMPLEMENTACIÓN EN app.js

**Función: `detectDispatcher(text, referral, contact)`**

```javascript
async function detectDispatcher(text, referral, contact) {
  // 1. Si viene de anuncio → saltar todo
  if (referral && !contact.flow_step) {
    return { type: 'ad_referral', flowId: 'msg_welcome_from_ad' };
  }

  // 2. Buscar fast-path keyword
  const keyword = Object.entries(FAST_PATH_KEYWORDS).find(([pattern]) =>
    new RegExp(pattern, 'i').test(text)
  );
  
  if (keyword) {
    return { type: 'fast_path', flowId: keyword[1] };
  }

  // 3. Clasificador IA
  const triggers = await dbAll('ai_triggers', { is_active: 1 });
  const result = await classifyIntent(text, historyStr, triggers);

  if (result.confianza >= 0.7) {
    return { type: 'ia_high_confidence', ...result };
  } else if (result.confianza >= 0.5) {
    return { type: 'fallback_generic', flowId: 'msg_fallback' };
  } else {
    return { type: 'no_dispatch', reason: 'low_confidence' };
  }
}
```

---

## 📊 Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `app.js` | Agregar `detectDispatcher()`, `FAST_PATH_KEYWORDS`, integrar en `handleBotResponseLogic()` |
| `migrations/003_phase2_intents.sql` | Agregar nuevas intenciones si aplica |
| `.env.local` | (Opcional) Umbrales configurables |
| Tests | Crear tests para cada tipo de dispatcher |

---

## ✅ Checklist Fase 2

- [ ] Implementar FAST_PATH_KEYWORDS
- [ ] Crear función `detectDispatcher()`
- [ ] Integrar con `handleBotResponseLogic()`
- [ ] Crear mensaje fallback genérico
- [ ] Enviar contexto (últimos 6 mensajes) al clasificador IA
- [ ] Definir umbrales (70%, 50%)
- [ ] Crear tests:
  - [ ] Test fast-path (sin IA)
  - [ ] Test IA alta confianza
  - [ ] Test IA baja confianza (fallback)
  - [ ] Test anuncio pagado (referral)
- [ ] Monitorear & ajustar umbrales con datos reales
- [ ] Documentar en PHASE_2_TRIGGERS.md
- [ ] Commitear a GitHub

---

## 🧪 Casos de Prueba

**Test 1: Fast-Path**
- Input: "hola, cuánto cuesta"
- Expected: Salta IA, muestra precios
- Latency: <100ms (sin LLM)

**Test 2: IA Alta Confianza**
- Input: "quiero vender esos faroles"
- Expected: Detecta `interes_negocio`, confidence 85%+
- Action: Dispara FLOW_BUSINESS

**Test 3: IA Baja Confianza**
- Input: "gracias"
- Expected: Confidence <50%
- Action: No dispara, deja para humano

**Test 4: Referral (Anuncio)**
- Input: DM desde anuncio
- Expected: Muestra `msg_welcome_from_ad`
- Ignore: IA, keywords

---

## 🚀 Métricas a Rastrear

```
- % tráfico anuncio vs orgánico
- % fast-path vs IA
- Confianza promedio (IA)
- Tasa conversión por tipo disparador
- Falsos positivos (debería ser humano)
- Falsos negativos (detectó pero no era intención)
```

---

## 📝 Próximas Fases

**Fase 3**: CAPI & Atribución Meta
**Fase 4**: Comment-to-DM, Smart Delays

---

¿Empezamos a implementar Fase 2?
