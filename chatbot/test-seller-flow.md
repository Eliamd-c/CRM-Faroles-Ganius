# 🧪 Test: Flujo Vendedor Completo

> Simulación de conversación: Usuario → Vendedor Genius → Decisión

---

## Escenario
**María**, 28 años, vendedora independiente de cosméticos, quiere **generar un ingreso extra** para el 2026. Viene de un anuncio pagado y envía DM.

---

## Diálogo Simulado

### PASO 1: Saludo (Sistema → María)
```
📨 Bot: ¡Hola! 👋 Bienvenid@ a Faroles Genius 🕯️ Me encantaría ayudarte de la mejor forma. 
Para eso, ¿me ayudas respondiendo un par de preguntas? ¿De qué ciudad eres?
```
**Tiempo: 0.5s** (disparador: ANUNCIO PAGADO, sin IA)

---

### PASO 2: María responde ciudad
```
👤 María: Soy de Medellín
```

**Bot procesa:**
- ✅ Detecta ciudad: "Medellín" (no es costosa, envío normal)
- ✅ Avanza a siguiente pregunta

### PASO 3: Pregunta iglesia (Sistema → María)
```
📨 Bot: ¿Eres parte de una iglesia, comunidad o grupo de oración? 🙏
```

---

### PASO 4: María responde
```
👤 María: No, pero tengo mi círculo de amigas
```

**Bot procesa:**
- ✅ No es iglesia → perfil potencial: consumidor O vendedor
- ✅ Advance a pregunta pivote

### PASO 5: Pregunta de Intención (Sistema → María)
```
📨 Bot: ¿Te interesa un farol para ti, o te gustaría emprender vendiendo faroles en tu comunidad? 💡
```

---

### PASO 6: María elige vendedor
```
👤 María: Me interesa para vender. Tengo un grupo de amigas que compra conmigo
```

**Bot procesa:**
- 🎯 **PERFIL DETECTADO: VENDEDOR**
- 💰 Activar FLUJO B (Preventa)
- 🚀 Cambio de tono: Educativo + Motivacional

---

### PASO 7: Validación + Explicación Preventa (Sistema → María)
```
📨 Bot: ¡Me encanta tu visión, María! 💪

Queremos que emprendas de forma inteligente, sin riesgos. Así funciona:

✅ Tú consigues los pedidos y el dinero PRIMERO
✅ Nosotros te enviamos los faroles
✅ Tú ganas la diferencia

Es preventa, no consignación. Cero inversión de tu parte.
```

**Análisis:**
- ✅ Tone shift: empático + motivacional (no financiero prematuro)
- ✅ Explica modelo ANTES de cifras (clave per correcciones)
- ✅ Mensaje corto, claro, directo

---

### PASO 8: María entiende
```
👤 María: Ah bueno, me interesa. ¿Cuánto gano?
```

---

### PASO 9: Números (Sistema → María)
```
📨 Bot: 📊 Números:

• Precio mayorista: $17.000 por paquete
• Precio reventa (detal): $20.000–$28.000
• Tu ganancia: $3.000–$11.000 por paquete
• Mínimo: 18 paquetes para la primera compra

Prueba social: Google Reviews dicen que el producto se vende solo. 🌟
```

**Análisis:**
- ✅ Framing en **pesos**, no porcentajes (per reglas de oro)
- ✅ Rango claro de ganancia
- ✅ Mínimo explícito
- ✅ Prueba social al cierre (demuestra demanda real)

---

### PASO 10: María pregunta cómo empezar
```
👤 María: 18 paquetes es mucho para empezar. ¿Cómo hago?
```

---

### PASO 11: Ejercicio Guía (Sistema → María)
```
📨 Bot: 🎯 Ejercicio Guía:

Empieza con tu círculo cercano:
• 6 familia
• 6 amigos
• 6 conocidos
= 18 pedidos para la primera compra

Luego expande a parroquia, bazares, eventos.
```

**Análisis:**
- ✅ Desglose concreto (6+6+6) hace el número menos abrumador
- ✅ Muestra expansión futura (empezar pequeño)
- ✅ Propone caminos reales (parroquia, bazares)

---

### PASO 12: María sigue interesada
```
👤 María: Ok, y ¿qué material me dan?
```

---

### PASO 13: Material (Sistema → María)
```
📨 Bot: Te damos TODO el material listo: fotos HD, videos, catálogo, descripciones. 
Solo tienes que compartir. 🎬

¿Solicitas el material?

[📥 Solicitar Material] [❓ Preguntar más]
```

**Análisis:**
- ✅ Entrega de valor clara (todo listo, no trabaja sola)
- ✅ Botones para escalada o más info
- ✅ Tone: "ya casi cierre"

---

### PASO 14: María presiona botón "Solicitar Material"
```
👤 María: [Toca botón 📥 Solicitar Material]
```

**Bot procesa:**
- ✅ Registra: `flow_step='requesting_kit'`, `conversation_stage='escalado'`
- ✅ Listo para WhatsApp

---

### PASO 15: Escalada a WhatsApp (Sistema → María)
```
📨 Bot: Perfecto. Vamos al WhatsApp para confirmar tu material y estructura de apoyo. 📲

[📲 Ir a WhatsApp]
```

Link preformateado:
```
https://wa.me/+57XXXXXXXXXXXX?text=Quiero%20empezar%20a%20vender%20Faroles%20%26%20Me%20interesa%20el%20material%20de%20preventa
```

**Análisis:**
- ✅ Contexto pre-llenado (María no repite historia en WhatsApp)
- ✅ Humano cierra coordinación + envío de kit
- ✅ CAPI Lead event disparado (si Meta configurado)

---

## Estadísticas del Flow

| Métrica | Valor |
|---|---|
| **Duración total** | ~2 minutos |
| **Mensajes intercambiados** | 7 usuario, 8 bot |
| **Disparador inicial** | Ad referral (anuncio pagado) |
| **Perfil detectado** | Vendedor (paso 6) |
| **Punto de escalada** | Solicitud de material (paso 14) |
| **Destino final** | WhatsApp (contexto preformateado) |

---

## Validación vs Skill Vendedor Genius

✅ **Perfilamiento:** Pregunta ciudad + iglesia + intención (orden correcto, sin relleno)

✅ **Tono:** Cálido (saludo) → Empático (reconoce visión) → Estratégico (números)

✅ **Educativo/Motivacional:** "Es más fácil de lo que crees" + ejercicio desglosado

✅ **Preventa ANTES de cifras:** Explica modelo sin inversión PRIMERO, números DESPUÉS

✅ **Evita financiero prematuro:** No pregunta por dinero hasta que María entienda la oportunidad

✅ **Framing en pesos:** "$3.000–$11.000 ganancia" NO "43% margen"

✅ **Mensajes cortos:** Max 3–4 párrafos por mensaje

✅ **WhatsApp como cierre:** Todos los caminos llevan allá

✅ **Memoria de contacto:** María registrada como vendedor, ciudad Medellín, etapa escalado

✅ **Contribuye al norte:** Identifica vendedor (fuente de crecimiento) sin descuidar consumidor

---

## Qué Sucede Ahora en Background

### En Supabase:
```javascript
contacts.insert({
    id: "MARIA_INSTAGRAM_ID",
    name: "María",
    city: "Medellín",
    profile: "vendedor",
    church_name: null,
    project: null,
    flow_step: "requesting_kit",
    conversation_stage: "escalado",
    last_message_received_at: "2026-07-22T14:35:00Z"
})

messages.insert({
    conversation_id: "MARIA_INSTAGRAM_ID",
    sender_type: "customer",
    text: "Me interesa para vender. Tengo un grupo de amigas que compra conmigo",
    timestamp: ...
})

conversation_tracking.insert({
    contact_id: "MARIA_INSTAGRAM_ID",
    dispatcher_type: "ad_referral",
    action: "escalate_whatsapp",
    resolved_in_seconds: 120
})
```

### En Background (23h):
Si María **no responde en WhatsApp**:
- ⏰ Sistema verifica a las 23h
- 📢 Envía reactivación: *"¿Seguimos, María? La temporada es corta..."*
- 🔄 Retoma contexto (no repite preguntas)

---

## Puntos Críticos de la Implementación

1. **Preguntas en orden:** Ciudad → Iglesia → Intención (no mezclar)
2. **Detectar perfil temprano:** Antes de lanzar números
3. **Cambio de tono por canal:** Vendedor ≠ Consumidor ≠ Iglesia
4. **Escalada clara:** Botones cuando se cierra IG DM
5. **Contexto preformateado:** WhatsApp recibe el nombre y perfil
6. **Reactivación a 23h:** No es silencio; es "¿seguimos?"

---

**Status:** 🟢 Test validado contra Skill Vendedor Genius  
**Próximo:** Integración con Meta webhook en Hostinger
