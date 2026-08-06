# GUÍA CONCEPTUAL: Cómo Funciona el Agente de IA (LangGraph)

**Propósito:** Entender la LÓGICA y el COMPORTAMIENTO del agente de ventas sin leer código.

**Audiencia:** CEO/Propietario, Gerentes, Supervisores — personas que quieren entender QUÉ hace el bot, CÓMO toma decisiones y POR QUÉ a veces funciona bien y a veces no.

---

## ÍNDICE

1. [¿Qué es LangGraph? (Analogía Simple)](#qu-es-langgraph-analogía-simple)
2. [El Flujo Cognitivo del Agente (Paso a Paso)](#el-flujo-cognitivo-del-agente-paso-a-paso)
3. [Cómo Construye el Conocimiento (Jerarquía de Fuentes)](#cómo-construye-el-conocimiento-jerarquía-de-fuentes)
4. [Cómo Construye los Mensajes](#cómo-construye-los-mensajes)
5. [El Papel del Historial y Checkpoints](#el-papel-del-historial-y-checkpoints)
6. [Decisiones del Agente: Cuándo Dice Qué](#decisiones-del-agente-cuándo-dice-qué)
7. [Contexto Maestro vs. Instrucciones Dinámicas](#contexto-maestro-vs-instrucciones-dinámicas)
8. [Máquina de Estados: Las Etapas del Embudo](#máquina-de-estados-las-etapas-del-embudo)
9. [Qué Salió Bien y Qué Falla](#qué-salió-bien-y-qué-falla)
10. [Problema Bonus: flows.json vs. UI Desincronizados](#problema-bonus-flowsjson-vs-ui-desincronizados)
11. [Reglas de Oro y Límites](#reglas-de-oro-y-límites)

---

## ¿Qué es LangGraph? (Analogía Simple)

### Explicación para tu Amigo

Imagina que tu agente de ventas es como un **chef de restaurante en equipo**:

- **Tú (el cliente)** llegas con una pregunta: "¿Cuánto cuesta un farol?"
- **El chef (LangGraph)** recibe tu pedido.
- El chef **lee la receta** (Contexto Maestro de Faroles Genius).
- El chef **decide qué hacer**: ¿hacer la comida aquí? ¿llamar al sous-chef para ingredientes especiales? ¿consultar el libro de recetas de la etapa actual?
- El chef **prepara el plato**, lo **prueba**, lo **ajusta** y **te lo sirve**.
- **Registra lo que hizo** en un libro para la próxima vez que vengas (Checkpoint).

### En Términos Técnicos (Simplificado)

**LangGraph** es un orquestador de conversaciones. Recibe mensajes del usuario, los procesa a través de una **máquina de estados**, consulta herramientas (como bases de conocimiento), y devuelve una respuesta. **Recuerda todo lo que pasó antes** y usa esa información para no repetirse.

---

## El Flujo Cognitivo del Agente (Paso a Paso)

Cuando un usuario envía un mensaje, esto es lo que sucede **internamente** en el agente:

### Paso 1: Llega el Mensaje

```
Usuario envía: "Hola, ¿cuánto cuesta un kit de aliado?"
```

El servidor recibe el mensaje y lo pasa al agente.

### Paso 2: Recuperar Historial Anterior

El agente busca en su memoria:
- **¿Quién eres?** (contacto ya conocido, es amigo/aliado/detal?)
- **¿Qué dijiste antes?** (últimas conversaciones)
- **¿Dónde estabas en el embudo?** (ONBOARDING → DISCOVERY → RECOMMENDATION → CHECKOUT?)
- **¿Qué intentabas hacer?** (Comprar? Preguntar? Escalar a humano?)

Si todo esto está guardado, lo carga en la memoria del agente.

### Paso 3: Analizar Intención

El agente hace una pregunta interna: **¿Qué quiere realmente este usuario?**

La IA analiza el mensaje y decide:
- ¿ESCALATE? (Pide hablar con un humano)
- ¿OBJECTION? (Tiene dudas de precio, garantía)
- ¿PURCHASE_INTENT? (Quiere comprar)
- ¿GENERAL? (Solo pregunta)

### Paso 4: Decidir si Avanzar en el Embudo

El agente pregunta: **¿Ya maduró la conversación para pasar a la siguiente etapa?**

Ejemplo:
- Usuario estaba en ONBOARDING (presentación del producto).
- Después de 3 mensajes mostrando interés, el agente decide: "Ya es hora de DISCOVERY (descubrir sus necesidades)".
- Si el usuario dice "Quiero ser aliado", salta directo a RECOMMENDATION.

### Paso 5: Generar Respuesta

El agente arma la respuesta con base en:

1. **Quién es en esta etapa** (Contexto + Instrucción de Etapa)
2. **Qué herramientas puede usar** (RAG, búsqueda de precios, etc.)
3. **Historial anterior** (Para no repetirse)
4. **Tono y reglas** (Debe ser cálido, colombiano, debe terminar con una pregunta)

### Paso 6: ¿Necesito Ayuda Especial?

El agente pregunta: **¿Debo usar una herramienta para esta respuesta?**

Ejemplo de herramientas:
- **Query Knowledge Base**: "Busca en mi base de datos los precios exactos"
- **Send Quick Replies**: "Envía botones para que el usuario elija"
- **Log Message**: "Registra este mensaje en la BD"

Si necesita una herramienta, la llama y espera el resultado.

### Paso 7: Entregar la Respuesta

El agente devuelve el mensaje al usuario.

### Paso 8: Guardar en Checkpoint

El agente guarda todo lo que pasó en una "capsula del tiempo" (checkpoint):
- Mensaje del usuario
- Análisis de intención
- Respuesta generada
- Etapa del embudo actual
- Cualquier dato nuevo del cliente

Esto asegura que **la próxima vez**, el agente recuerde todo.

---

## Cómo Construye el Conocimiento (Jerarquía de Fuentes)

### El Agente Consulta 3 Fuentes de Verdad (en Orden):

#### **1. CONTEXTO MAESTRO (Verdad Absoluta de Identidad)**

Archivo: `Agente_IA_Faroles_Genius_Contexto_Maestro_Oficial.md`

**Qué contiene:**
- Quién es el agente (Faroles Genius, vende faroles devocionales)
- Tono y personalidad (cálido, colombiano, servicial)
- Estrategia de venta (StoryBrand: el cliente es el héroe)
- Reglas de oro (nunca inventar precios, siempre terminar con pregunta)
- Historias de éxito (la señora de Bogotá, moneda social)
- Objeciones y cómo responder

**Cuándo se usa:**
- SIEMPRE, para todo lo relacionado con **identidad, tono, valores, política de empresa**.
- Si el Contexto Maestro dice "Los faroles duran 7+ años" → ESO es la verdad, aunque una instrucción de etapa diga otra cosa.

**Símbolo de Autoridad:** ⭐ El Rey

#### **2. INSTRUCCIONES DINÁMICAS POR ETAPA (Verdad de Comportamiento)**

Archivos: Editables en la UI de CRM (Agentes Studio)

**Etapas:**
1. **ONBOARDING**: "Preséntate, haz que el usuario sienta que entiende el producto"
2. **DISCOVERY**: "Descubre qué tipo de cliente es (Aliado vs. Detal)"
3. **RECOMMENDATION**: "Sugiere el producto adecuado con la mejor oferta"
4. **CHECKOUT**: "Cierra la venta, toma datos, coordina pago"

**Cuándo se usa:**
- Define el **objetivo específico de ESTA etapa**.
- Determina el **tono local** (si en ONBOARDING debe sonar más formal, en CHECKOUT más urgente).
- Anula la identidad SOLO en detalles tácticos (no en misión fundamental).

**Símbolo de Autoridad:** 🎯 El General de Turno

#### **3. BASE DE CONOCIMIENTO (RAG) (Verdad de Datos Actualizados)**

Fuente: 5 bases de conocimiento indexadas

**Qué contiene:**
- Precios exactos
- Especificaciones técnicas
- Políticas de envío
- Términos y condiciones
- Respuestas a preguntas frecuentes

**Cuándo se usa:**
- **SIEMPRE**, cuando el usuario pregunta sobre:
  - Precio
  - Especificaciones técnicas
  - Costo de envío
  - Garantía
  - Cualquier dato que cambie a menudo

**Regla Anti-Alucinación:** Si el agente **NO consulta RAG** pero inventa un precio, es un FALLO crítico.

**Símbolo de Autoridad:** 📚 El Guardián de la Verdad

---

### Jerarquía Visual (¿Cuál Gana si Hay Conflicto?)

```
Identidad (Contexto Maestro: tono, valores)
   ↓ AUTORIDAD MÁXIMA PARA: quién eres, cómo hablas
   
Etapa (Instrucción Dinámico: objetivo de esta conversación)
   ↓ AUTORIDAD MÁXIMA PARA: estrategia táctica, urgencia
   
Datos (RAG: precios, specs)
   ↓ AUTORIDAD MÁXIMA PARA: números, hechos objetivos
```

**Ejemplo de Aplicación:**

| Pregunta del Usuario | Consulta... | Resultado |
|---|---|---|
| "Cuánto cuesta un kit de aliado?" | RAG + Contexto | "$108.000" (del RAG). Luego explicar valor (Contexto). |
| "¿Son ustedes de confianza?" | Contexto + Etapa | Historia de Bogotá (Contexto), ajustada al tono de DISCOVERY (Etapa). |
| "Qué sigue después de que compre?" | Etapa + RAG | Instrucción CHECKOUT (qué hacer ahora), más policy de garantía (RAG). |
| "¿Por qué se llaman Faroles Genius?" | Solo Contexto | Responder con misión y valores. |

---

## Cómo Construye los Mensajes

### Receta del Mensaje del Agente

Cuando el agente prepara tu respuesta, combina cuatro ingredientes:

#### Ingrediente 1: Sistema Instruction (Rol)

```
"Eres el asesor de ventas de Faroles Genius.
Tu misión: ayudar clientes a comprar con calidez y claridad.
Tono: cálido, colombiano, servicial.
Etapa actual: DISCOVERY.
Tu objetivo aquí: descubrir si es Aliado o Detal."
```

#### Ingrediente 2: Historial de Conversación

```
Usuario (1er mensaje): "Hola, ¿qué es Faroles Genius?"
Agente (respuesta 1): "Hola! Hacemos faroles artesanales... [30 palabras]"
Usuario (2do mensaje): "¿Puedo ser distribuidor?"
Agente (en construcción ahora...): "Claro que sí..."
```

El agente **RECUERDA** los 2do-3er mensajes atrás para no repetirse.

#### Ingrediente 3: Contexto Inyectado (RAG)

Si preguntó por precio, el RAG inyecta:

```
"Precios al detal:
- 1 paquete: $28.000
- Kit aliado (6 paquetes): $108.000"
```

#### Ingrediente 4: Temperatura Baja (Respuestas Controladas)

La temperatura está en **0.2** (muy baja), lo que significa:
- El agente NO improvisa ni aluciná.
- Responde con precisión y repetición (puede sonar robótico a veces, pero es seguro).
- Temperatura BAJA = Menos errores, pero menos creatividad.

### El Resultado

Mensaje final:

```
"¡Claro que sí! Te veo potencial como aliado. 🤝

El Kit inicial es de 6 paquetes a $18.000 cada uno = $108.000 total.
Pagas contra entrega.

Si vendes los 6 a $30.000, tu ganancia es $72.000 con cero riesgo.

¿Te animas a hacer la prueba? ¿A qué ciudad te haríamos envío?"
```

**Nota:** Cada mensaje tiene un máximo de ~950 caracteres (limitación de Meta). Si es más largo, se divide en 2-3 mensajes.

---

## El Papel del Historial y Checkpoints

### ¿Qué es un Checkpoint?

Un **checkpoint** es una "capsula del tiempo" — una grabación de:
- Todos los mensajes de la conversación hasta ahora
- La intención detectada
- La etapa del embudo
- Datos del cliente
- Decisiones tomadas

### ¿Dónde se Guardan?

En una **base de datos PostgreSQL** (Supabase). Cada checkpoint tiene:
- Un ID único (el ID de Instagram del usuario)
- Una timestamp (cuándo se guardó)
- Una secuencia (checkpoint #1, #2, #3...)

### ¿Cómo se Usa?

1. **Usuario envía 1er mensaje**: "Hola"
   - Se crea Checkpoint #1 (vacío)
   - Agente responde

2. **Usuario envía 2do mensaje**: "Cuánto cuesta?"
   - Se recupera Checkpoint #1
   - Se agrega el 2do mensaje
   - Se crea Checkpoint #2

3. **Usuario envía 3er mensaje**: "Quiero comprar"
   - Se recupera Checkpoint #2 (con 2 mensajes previos)
   - Se agrega el 3er mensaje
   - Agente VE todo el contexto
   - Se crea Checkpoint #3

### El Problema de los 184 Checkpoints

**¿Qué pasó?**

Después de ~100-150 mensajes (190 checkpoints), el agente empezaba a:
- Imitar sus propias respuestas viejas
- Repetirse
- Perder el "hilo"

**¿Por qué?**

Hay dos posibles causas:

1. **Token Limit**: El LLM tiene una ventana de contexto (~4,000-8,000 tokens disponibles para la conversación). Si la conversación es muy larga, solo ve los últimos 20-30 mensajes. El agente entonces se "pierde" en su propio historial antiguo.

2. **Duplicación de Memoria**: Si el checkpoint NO se limpia adecuadamente, el agente ve:
   ```
   [Historia completa de 184 mensajes]
   + [Mi respuesta anterior sobre precios]
   + [Mi respuesta anterior sobre garantía]
   → Aprende "debo siempre hablar de precios así"
   ```

**¿Cuál es la Solución?**

Implementar una **ventana de contexto limitada**:
- Guardar TODOS los checkpoints (para auditoría e historial)
- Pero inyectar SOLO los últimos 10 mensajes + resumen de los antiguos

Ejemplo:
```
[RESUMEN: Usuario es Aliado, en etapa CHECKOUT desde hace 10 mensajes]
[Últimos 10 mensajes reales]
Nuevo mensaje del usuario: "..."
```

---

## Decisiones del Agente: Cuándo Dice Qué

### La Matriz de Decisión

| Pregunta del Usuario | Análisis Interno | Acción |
|---|---|---|
| "¿Cuánto cuesta?" | Necesita RAG | Consulta base de datos → Devuelve precio exacto |
| "¿Cómo son de buena calidad?" | Puede usar Contexto | Cuenta historia de Bogotá + especificaciones de RAG |
| "Habla con un humano" | Detecta ESCALATE | Pausa bot, notifica operador humano |
| "Lol 😂" | Intent = GENERAL | Responde con calidez, reencauza a la venta |
| "No tengo dinero" | Detecta OBJECTION | Ofrece kit pequeño + opción de compra grupal |
| "Acepto, mis datos son..." | Intent = PURCHASE | Toma datos, verifica completitud, escalona a pago |

### Las 4 Respuestas Posibles del Agente

#### 1. "Sé la Respuesta" (Usa Contexto)

Cuando la respuesta está en el Contexto Maestro:

```
Usuario: "¿Cuál es la personalidad del agente?"
Agente: "Soy cálido y cercano, como una persona de fe..."
```

**Riesgo:** Bajo (es información controlada)

#### 2. "Busco la Respuesta" (Consulta RAG)

Cuando la respuesta es un dato factual:

```
Usuario: "¿Cuánto cuesta?"
Agente: [Consulta RAG] → "La tabla dice..."
```

**Riesgo:** Bajo si el RAG tiene datos — **ALTO si inventa precio sin consultar**.

#### 3. "No Sé, Subamos a un Humano" (Escalada)

Cuando está fuera de scope:

```
Usuario: "¿Personalizas los faroles con mi nombre?"
Agente: "Esa es buena pregunta. Un asesor nuestro se pondrá en contacto..."
```

**Riesgo:** Bajo (es honesto)

#### 4. "Hago la Pregunta Pero Invento" (ALUCINACIÓN)

Lo que **NO debe pasar pero ocurre a veces**:

```
Usuario: "¿Cuánto cuesta envío a Medellín?"
Agente: [No consulta RAG] → "Unos $8.500" [mentira]
```

**Riesgo:** MUY ALTO — Pérdida de confianza, órdenes incorrectas.

---

### Cuándo el Agente Elige Cada Opción

El agente usa esta lógica interna:

```
SI pregunta es sobre IDENTIDAD o TONO
   → Usa Contexto (Opción 1)
   
SI pregunta es sobre PRECIO, SPECS, ENVÍO, GARANTÍA
   → Consulta RAG (Opción 2)
   SI RAG no tiene respuesta
      → Escala a humano (Opción 3)
      
SI pregunta es vaga (hola, lol, etc.)
   → Usa Contexto + guía conversación
   
SI usuario pide hablar con humano
   → Escalada inmediata (Opción 3)
```

**Regla Anti-Alucinación:** El sistema **AVISA** al agente:
```
"REGLA ANTI-INVENCIÓN: Si preguntan por precios, DEBES llamar a 
'query_knowledge_base' ANTES de responder. Nunca respondas esos 
datos de memoria. Si RAG no devuelve el dato, dilo y escala."
```

---

## Contexto Maestro vs. Instrucciones Dinámicas

### ¿Cuál es la Diferencia?

| Aspecto | Contexto Maestro | Instrucción Dinámico |
|---|---|---|
| **Dónde está** | Archivo .md en disco | Base de datos (editable en UI) |
| **Quién lo edita** | Arquitecto / CEO | Manager (puede editar sin redeploy) |
| **Cambios** | Requiere redeploy | Aplicado inmediatamente (cache ~2 minutos) |
| **Quién Manda** | Identidad, valores, tono | Objetivo de esta etapa, urgencia |
| **Ejemplo** | "Eres Faroles Genius, tono cálido" | "DISCOVERY: descubre si es Aliado o Detal" |

### Cómo Compiten

**Escenario 1: Contradicción de Tono**

```
Contexto Maestro: "Tono cálido, nunca presiones"
Instrucción CHECKOUT: "URGENTE: cierra hoy, menciona límite de stock"

¿Quién gana?
→ MANDA EL CONTEXTO (identidad no se negocia)
→ Respuesta: "Es urgente para nosotros, sí. Pero respetando tu tiempo, 
   ¿cuándo te gustaría confirmar? 🙏"
```

**Escenario 2: Contradicción de Datos**

```
Contexto Maestro: "Precio kit aliado: $108.000"
Instrucción DISCOVERY: "Menciona rango de precios $100-150k"
RAG: "$108.000" (actualizado hoy)

¿Quién gana?
→ MANDA RAG (es el dato actual)
→ Respuesta: "$108.000 exactos" (del RAG)
```

### La Jerarquía Real

```
┌─────────────────────────────────────────┐
│  IDENTIDAD (Contexto Maestro)           │
│  "Quién eres, cómo hablas, qué valores" │
│  🚫 NO SE NEGOCIA                       │
└─────────────────────────────────────────┘
           ↓ Más flexible
┌─────────────────────────────────────────┐
│  ETAPA (Instrucción Dinámica)           │
│  "Objetivo táctico de esta conversación"│
│  ✅ Se puede reescribir sin cambiar     │
│     identidad fundamental              │
└─────────────────────────────────────────┘
           ↓ Más flexible aún
┌─────────────────────────────────────────┐
│  DATOS (RAG)                            │
│  "Hechos, números, especificaciones"    │
│  ✅ Se actualiza diariamente            │
└─────────────────────────────────────────┘
```

---

## Máquina de Estados: Las Etapas del Embudo

El agente no es "lineal" — navega por **4 etapas** como un embudo de ventas.

### Las 4 Etapas (Sales Funnel)

#### **1. ONBOARDING**
**Objetivo:** Presentar el producto y hacer que el usuario sienta que lo entiendes.

**Comportamiento del Agente:**
- Saluda cálidamente
- Presenta el producto (faroles artesanales, devocionales)
- Cuenta una historia corta (moneda social)
- Pregunta: "¿Qué te trae aquí?" o "¿Buscas para tu hogar o tu comunidad?"

**Sale de ONBOARDING cuando:**
- Usuario dice "Quiero ser aliado"
- Usuario pregunta "Cuánto cuesta?"
- Usuario demuestra interés claro (3+ mensajes)

#### **2. DISCOVERY**
**Objetivo:** Descubrir qué tipo de cliente es (Aliado vs. Detal) y sus verdaderas necesidades.

**Comportamiento del Agente:**
- Profundiza: "¿Tienes acceso a una parroquia/comunidad?"
- Pregunta volumen: "¿Cuántos faroles necesitarías?"
- Detecta: ¿Es Aliado (compra para revender) o Detal (compra para sí)?

**Sale de DISCOVERY cuando:**
- Confirmó el tipo de cliente
- Conoce el volumen aproximado
- Hay suficiente claridad para recomendar

#### **3. RECOMMENDATION**
**Objetivo:** Sugerir el producto/cantidad exacta y crear urgencia (pero con calidez).

**Comportamiento del Agente:**
- Presenta tabla de precios (Aliado vs. Detal)
- Subraya el valor: "Con 6 paquetes ganas $72.000"
- Ofrece opciones: "¿Quieres el kit de entrada o esperas reunir más?"
- Pregunta: "¿A qué ciudad te hacemos envío?"

**Sale de RECOMMENDATION cuando:**
- Usuario dice "Quiero comprar"
- Usuario empieza a dar datos (ciudad, celular)
- Usuario pone objeción de precio (va a OBJECTION HANDLING)

#### **4. CHECKOUT**
**Objetivo:** Tomar datos, coordinar pago, cerrar la venta.

**Comportamiento del Agente:**
- Toma: Nombre, Ciudad, Celular, Dirección
- Ofrece: Pago Contra Entrega o Consignación Anticipada
- Cierra: "¡Listo! Tu pedido está confirmado. Te contactaremos hoy..."

**Sale de CHECKOUT cuando:**
- Datos tomados correctamente
- Pago coordenado
- Escala a humano para procesamiento

### Transiciones Automáticas

El agente **evalúa automáticamente** si debe cambiar de etapa:

```
ONBOARDING
   ↓ [Usuario muestra interés claro]
DISCOVERY
   ↓ [Confirmado: es Aliado o Detal]
RECOMMENDATION
   ↓ [Usuario dice "quiero comprar"]
CHECKOUT
   ↓ [Datos tomados]
ESCALADA A HUMANO
```

**Pero hay saltos:** Si en ONBOARDING el usuario dice "Quiero ser aliado", salta directo a RECOMMENDATION (skips DISCOVERY).

---

## Qué Salió Bien y Qué Falla

### Lo Que El Agente Hace Bien

✅ **Cálido y Personable**
- Responde con emojis modestos
- Reconoce el nombre del usuario
- No suena robótico

✅ **Recuerda Conversaciones Anteriores**
- Mensajes posteriores hacen referencia a lo que dijiste antes
- No te pide de nuevo información que ya diste

✅ **Hace Buenas Preguntas**
- CADA respuesta termina con una pregunta
- Mantiene el control de la conversación

✅ **Consulta el RAG para Precios**
- (La mayoría de las veces) va a buscar datos actualizados
- No inventa números al azar

✅ **Escala a Humano**
- Cuando no sabe, pide hablar con un operador
- Si el usuario pide humano, lo honra inmediatamente

✅ **Maneja Objeciones**
- Responde a "Es muy caro" con kit pequeño + opción grupal
- Responde a "No confío" con Pago Contra Entrega

✅ **Genera Dinámicamente**
- Cuando usuario dice "Quiero ser aliado", genera los 5 pasos sin necesidad de un flujo predefinido
- Adapta respuestas a contexto

### Lo Que Falla

❌ **Alucinaciones en Datos Específicos**
- A veces inventa detalles sobre especificaciones no consultadas
- Ejemplo: "Los faroles tienen LED de 50 lumens" (sin verificar RAG)
- **Causa:** El RAG no fue consultado, o falló silenciosamente

❌ **Historial Largo = Repetición**
- Después de 100+ mensajes, empieza a imitar sus propias respuestas viejas
- El agente se "ve a sí mismo" en el historial y lo copia
- **Causa:** Ventana de contexto no limitada; el LLM recuerda sus pasos anteriores más que el objetivo actual

❌ **Confusión entre "Generar" y "Leer Flujo"**
- A veces responde con pasos dinámicos cuando debería usar un flujo builder
- O viceversa: rigidez cuando debería ser flexible
- **Causa:** Falta claridad en la lógica de cuándo usar cada camino

❌ **Quick Replies Sin Pausa**
- Enviaba botones pero luego agregaba un mensaje adicional sin esperar
- Confundía al usuario
- **Causa:** No diferenciaba entre "ejecuté herramienta" y "espero respuesta"

❌ **Inflación de Tokens**
- El Contexto Maestro a veces se duplicaba (aparecía 2 veces en el prompt)
- Gastaba tokens innecesarios
- **Causa:** Lógica de detección de duplicados no robusta

❌ **Sincronización Flows.json ↔ UI**
- La UI mostraba 10 flujos pero flows.json tenía 31
- Algunos flujos no se refrescaban en la interfaz
- **Causa:** Cache no sincronizado; retraso en cargar cambios

---

## Problema Bonus: flows.json vs. UI Desincronizados

### ¿Qué Observó?

```
flows.json contiene: 31 flujos
UI (Agentes Studio) muestra: 10 flujos
```

### Investigación: ¿Dónde está el Desincro?

**Hipótesis 1: Carga Incompleta**
- La UI carga `GET /api/flows` que devuelve `state.flowsConfig`
- `state.flowsConfig` se inicializa con `loadFlowsFromFile()`
- Si el archivo es muy grande o tiene JSON malformado, solo carga la primera parte

**Hipótesis 2: Filtrado por Estado**
- La UI solo muestra flujos con `enabled: true`
- Si 21 flujos están marcados `enabled: false`, no se ven
- Solución: Revisar la UI y filtros

**Hipótesis 3: Cache del Navegador**
- El navegador cacheó una versión antigua de flows.json
- Hard refresh (`Ctrl+Shift+R`) podría resolver

**Hipótesis 4: Problema en el JSON**
- flows.json tiene un error de sintaxis después del flujo #10
- El parser se detiene y no lee el resto

### Cómo Verificarlo

```bash
# 1. Contar flujos en archivo
grep -c '"id": "flow_' flows.json
→ Resultado: 31

# 2. Revisar si hay errores en JSON
# Abrir flows.json en editor y buscar línea 150-200 (donde termina el flujo #10)

# 3. Ver qué devuelve la API
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/flows | jq '.flows | length'
→ Verifica si devuelve 31 o menos

# 4. Revisar BD
# Si hay un servicio de Supabase que guarda flujos, verificar allí
```

### Solución Recomendada

1. **Verificar integridad de flows.json**
   - Validar JSON en https://jsonlint.com/
   - Si hay error, corregir y recargar

2. **Limpiar cache del navegador**
   - Abrir DevTools (F12) → Settings → Clear all

3. **Forzar recarga del servidor**
   - Reiniciar app.js
   - Verificar que loadFlowsFromFile() carga correcto

4. **Auditar la UI**
   - Revisar código donde filtra flows
   - Asegurar que no hay `filter(f => f.enabled)` que oculte flujos

---

## Reglas de Oro y Límites

### Reglas Que El Agente SIEMPRE Sigue

#### 1. "Nunca Inventes Datos"
- Si no está en Contexto Maestro, RAG o Instrucción → **Pregunta o Escala**
- No inventar precios, especificaciones, tiempos de envío

#### 2. "Termina Cada Mensaje con una Pregunta"
- El agente DEBE hacer una pregunta al final
- Mantiene el diálogo, no monólogos
- Incrementa tasa de respuesta

#### 3. "Mensajes Cortos (max 950 caracteres)"
- Meta (Instagram) tiene límite de caracteres
- Si respuesta es larga, dividir en 2-3 mensajes
- Cada mensaje es una idea

#### 4. "Tono Cálido, No Corporativo"
- No: "Estimado cliente, le cordial saludo..."
- Sí: "Hola, ¡qué gusto saber de ti! 🕯️"

#### 5. "El Usuario es el Héroe, Yo Soy el Guía"
- No vender el producto, vender el beneficio para el cliente
- No: "Nuestros faroles son los mejores"
- Sí: "Con estos faroles, tu hogar (o comunidad) brillará de forma única"

#### 6. "Consultar RAG Antes de Dar Datos"
- Precio → Consulta RAG
- Especificaciones → Consulta RAG
- Garantía → Consulta RAG
- Si RAG no tiene → Escala a humano

#### 7. "Escala a Humano Cuando:"
- Usuario pide explícitamente
- Datos personalizados (faroles únicos, tamaños especiales)
- Conflicto/frustración alta
- Luego de 3 intentos fallidos del agente

### Límites Conocidos

| Límite | Valor | Causa |
|---|---|---|
| Ventana de Contexto | ~4,000-8,000 tokens | LLM gpt-4o-mini tiene este límite |
| Caracteres por Mensaje | 950 | Limitación de Meta (Instagram) |
| Checkpoints Útiles | ~50-100 antes de deterioro | Después, el agente se repite |
| Consultas RAG por Conversación | Sin límite teórico, pero 3+ puede ser lento | Cada consulta toma ~0.5-1 segundo |
| Herramientas Simultáneas | 1 a la vez | ReAct Loop las ejecuta secuencialmente |
| Quick Replies Máximo | 13 botones | Limitación de Meta |

### Temperatura y Determinismo

| Parámetro | Valor | Significado |
|---|---|---|
| Temperatura | 0.2 (muy baja) | Respuestas predecibles, pocas sorpresas |
| Top-p | Por defecto | Muestreo nuclear (ignora palabras muy improbables) |
| Modelo | gpt-4o-mini | Balanza costo/calidad (más barato que gpt-4) |

**Nota:** Temperatura baja = **más seguro pero menos creativo**. El agente no improvisa historias nuevas, repite lo que sabe.

---

## Cuándo Ocurren Problemas (Diagnóstico Rápido)

### Síntoma: "El Agente Me Preguntó lo Mismo Dos Veces"

**Causa probable:** Historial largo, el agente se repite.

**Solución:**
1. Limpiar historial (borrar checkpoints viejos)
2. Implementar ventana de contexto limitada (últimos 10 mensajes)

### Síntoma: "El Agente Inventó un Precio"

**Causa probable:** No consultó RAG.

**Solución:**
1. Verificar que RAG tiene el dato
2. Revisar logs: ¿query_knowledge_base fue llamado?
3. Si RAG está caído, agente debería haber escalado

### Síntoma: "El Agente Envió Botones Pero Luego Un Mensaje Extra"

**Causa probable:** send_quick_replies ejecutado, pero no pausó.

**Solución:**
1. Verificar que pauseForInputNode se ejecuta después de toolNode
2. Revisar flag `awaiting_quick_reply` en checkpoint

### Síntoma: "La UI Muestra Solo 10 Flujos Pero flows.json Tiene 31"

**Causa probable:** Desincronización de cache o error de JSON.

**Solución:**
1. Validar JSON en jsonlint.com
2. Hacer hard refresh del navegador (Ctrl+Shift+R)
3. Reiniciar servidor

### Síntoma: "El Agente Tarda Mucho en Responder"

**Causa probable:** RAG consultado, herramienta externa lenta, o LLM sobrecargado.

**Solución:**
1. Revisar logs: ¿query_knowledge_base tardó?
2. Verificar estado de OpenAI API
3. Si problema persiste, implementar circuit breaker (ya existe)

---

## Resumen Ejecutivo: Las 7 Verdades del Agente

1. **Es una Máquina de Estados**: El agente navega por 4 etapas (ONBOARDING → DISCOVERY → RECOMMENDATION → CHECKOUT). Cada etapa tiene un objetivo claro.

2. **Tiene 3 Fuentes de Verdad**: Contexto Maestro (identidad) → Instrucción de Etapa (táctico) → RAG (datos). Mandan en ese orden.

3. **Recuerda TODO**: Gracias a los checkpoints, sabe qué dijiste hace 10 mensajes. Esto es bueno hasta los ~100 mensajes; después, empieza a confundirse.

4. **Nunca Inventa, o Escala**: Si no sabe una respuesta, la busca en RAG. Si RAG no tiene, escala a humano. La excepción: alucinaciones (falla del sistema).

5. **Es Cálido por Diseño**: El Contexto Maestro obliga a ser colombiano, cercano, servicial. No es corporativo.

6. **Termina con Preguntas**: Cada respuesta es una pregunta. Esto mantiene el diálogo vivo.

7. **Puede Fallar de 3 Formas**: Alucinación (inventa), Repetición (historial largo), Confusión de Etapas (salto ilógico). Todas son arquitectónicas, todas pueden corregirse.

---

## Cómo Usar Esta Guía

### Para Supervisores de Ventas
- Usa la **Matriz de Decisión** (Sección 6) para entender por qué el agente dice X.
- Usa **Las 4 Etapas** (Sección 8) para ver en dónde está un cliente.
- Si algo falla, revisa **Síntomas y Soluciones** (Sección Final).

### Para Gerentes de Producto
- Lee **Jerarquía de Fuentes** (Sección 3) para entender qué editar.
- Lee **Contexto Maestro vs. Instrucciones Dinámicas** (Sección 7) para saber qué manda a qué.
- Usa **Reglas de Oro** (Sección 11) como checklist.

### Para el CEO
- Lee **Qué Salió Bien y Qué Falla** (Sección 9) para evaluar ROI.
- Lee **Límites Conocidos** (Sección 11) para entender restricciones.
- Usa **Resumen Ejecutivo** (arriba) como elevator pitch.

---

## Próximos Pasos Recomendados

1. **Corto Plazo (Esta Semana)**
   - Validar que flows.json tiene sintaxis correcta
   - Limpiar checkpoints antiguos (>30 días)
   - Testear RAG: ¿devuelve todos los precios?

2. **Mediano Plazo (Este Mes)**
   - Implementar ventana de contexto limitada (últimos 10 mensajes)
   - Crear dashboard de "errores del agente" (alucinaciones detectadas)
   - Auditar Instrucciones de Etapa: ¿son claras y no contradictorias?

3. **Largo Plazo (Este Trimestre)**
   - Considerar fine-tuning del modelo en datos históricos de Faroles Genius
   - Implementar feedback loop: usuarios marcan "respuesta útil / no útil"
   - Expandir RAG con más fuentes (reseñas, FAQ dinámico)

---

## Glosario Rápido

| Término | Significa |
|---|---|
| **LangGraph** | Orquestador de conversaciones que usa máquina de estados + LLM |
| **Checkpoint** | "Capsula del tiempo" — grabación de toda la conversación hasta un punto |
| **RAG** | Retrieval-Augmented Generation — buscar datos en base de conocimiento antes de responder |
| **Contexto Maestro** | Archivo central de identidad, valores, estrategia del agente |
| **Instrucción Dinámico** | Guía de comportamiento POR ETAPA, editable sin redeploy |
| **Máquina de Estados** | Sistema de 4 etapas (ONBOARDING → CHECKOUT) que el agente navega |
| **Tool Call** | "Llamada a herramienta" — cuando el agente decide usar algo como RAG o send_quick_replies |
| **Alucinación** | Cuando el agente inventa un dato (precio, especificación) sin verificar |
| **Circuit Breaker** | "Cortacircuitos" — detiene llamadas a LLM si está fallando, usa respuesta de contingencia |
| **Token** | Unidad de "palabras" que el LLM puede procesar — cada token cuesta dinero |
| **Temperatura** | Parámetro que controla si respuestas son predecibles (baja) o creativas (alta) |
| **ReAct Loop** | Bucle Reflexión-Acción — el agente genera, ejecuta herramientas, ve resultados, genera de nuevo |

---

## Preguntas Frecuentes (FAQ)

### P: "¿El agente es consciente de lo que dice?"
**R:** No. El agente es un modelo de lenguaje (LLM) que predice la siguiente palabra. No "entiende", solo recombina patrones. Por eso a veces inventa.

### P: "¿Puedo editar el Contexto Maestro sin redeploy?"
**R:** No completamente. El archivo se carga al iniciar el servidor. Para cambios, redeploy o implementar un sistema dinámico (como ya existe para Instrucciones de Etapa).

### P: "¿Qué pasa si el RAG falla?"
**R:** El agente debería detectarlo y escalar a humano ("Un asesor te responderá pronto"). Si no lo hace, es un fallo del circuit breaker.

### P: "¿El historial se borra alguna vez?"
**R:** No automáticamente. Los checkpoints se guardan indefinidamente en PostgreSQL. Recomendación: implementar purga de conversaciones >90 días.

### P: "¿Por qué a veces el agente suena robótico?"
**R:** Temperatura baja (0.2). Es por seguridad (menos alucinaciones). Subir a 0.5 lo haría más creativo pero menos confiable.

### P: "¿Cuántos usuarios simultáneos puede atender?"
**R:** Depende de infraestructura. El agente es stateless (sin estado), pero PostgreSQL (checkpoints) puede ser cuello de botella con >1000 usuarios simultáneos.

### P: "¿El agente se mejora con el tiempo?"
**R:** Solo con fine-tuning (reentrenamiento). Los checkpoints son memoria (aprende historias) pero no "mejoran" el modelo. El agente hoy es igual al de hace 3 meses.

---

**Fin de la Guía**

Última actualización: Agosto 2026

Preguntas o sugerencias: contacta al equipo de Arquitectura de IA (Subagente: arquitecto-agentes)
