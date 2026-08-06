# Guía para el Escritor de Copy y Estratega de Ventas
## Cómo redactar las Instrucciones de cada Etapa del Agente IA

**Para**: Escritor de copy / Estratega de ventas
**Sistema**: Agents Studio → Tab "Instrucciones Dinámicas"
**Objetivo**: Escribir las instrucciones que guían al agente IA en cada etapa de la conversación de venta

---

## 1. ¿Qué estás escribiendo exactamente?

No estás escribiendo mensajes finales para el cliente. Estás escribiendo **las órdenes que recibe el agente IA** para saber cómo comportarse en cada momento de la venta.

Piénsalo así:
- ❌ NO escribes: *"Hola, gracias por tu interés en nuestros faroles..."*
- ✅ SÍ escribes: *"Saluda con calidez, preséntate como Faroles Genius, y haz UNA pregunta para conocer si la persona busca faroles para su comunidad o para reventa."*

**Tú diriges al actor (la IA). No escribes su guion palabra por palabra — le das la intención, el tono y las reglas.**

---

## 2. Las 4 Etapas del Embudo

El agente pasa por 4 etapas en orden. Cada una tiene su propia instrucción:

| Etapa | Momento | Objetivo del cliente | Objetivo de la IA |
|-------|---------|---------------------|-------------------|
| **ONBOARDING** | Primer contacto | "¿Quiénes son?" | Dar bienvenida, generar confianza, descubrir intención |
| **DISCOVERY** | Exploración | "¿Qué ofrecen?" | Entender necesidad real, calificar (comunidad vs. aliado) |
| **RECOMMENDATION** | Propuesta | "¿Qué me conviene?" | Recomendar producto/kit específico con argumentos |
| **CHECKOUT** | Cierre | "Quiero comprar" | Guiar el pedido, resolver dudas finales, cerrar |

---

## 3. Estructura recomendada de CADA instrucción

Usa esta plantilla para cada etapa. El agente responde mejor cuando la instrucción tiene estas 5 secciones:

```
### ROL Y CONTEXTO
Quién es la IA en este momento y qué acaba de pasar en la conversación.

### OBJETIVO DE ESTA ETAPA
Qué debe lograr la IA antes de pasar a la siguiente etapa.

### QUÉ HACER (Reglas positivas)
Acciones concretas que SÍ debe hacer.

### QUÉ EVITAR (Reglas negativas)
Errores que NO debe cometer.

### TONO Y ESTILO
Cómo debe sonar: cálido, breve, sin presionar, etc.
```

**Requisito técnico**: cada instrucción debe tener entre **50 y 5000 caracteres**. El editor te muestra el contador en vivo.

---

## 4. Guía por Etapa (con qué incluir)

### 🚪 ETAPA 1: ONBOARDING (Bienvenida)

**Lo que debe lograr**: Que el cliente se sienta bien recibido y la IA descubra si es una **comunidad de fe** o un **posible aliado (revendedor)**.

Incluye en la instrucción:
- Cómo saludar (cálido, humano, marca Faroles Genius)
- Que haga **UNA sola pregunta** para no abrumar
- Que detecte señales: ¿menciona su parroquia/grupo? ¿pregunta por precios de mayoreo?
- Que NO dispare precios ni catálogo todavía
- Tono: acogedor, sin sonar robótico ni vendedor agresivo

**Estrategia de venta a aplicar aquí**: *Generar pertenencia*. La persona debe sentir que habla con alguien de su mundo (comunidades marianas), no con un call center.

---

### 🧭 ETAPA 2: DISCOVERY (Descubrimiento)

**Lo que debe lograr**: Entender la **necesidad real** y calificar al cliente.

Incluye en la instrucción:
- Preguntas para entender: ¿cuántos faroles?, ¿para qué evento (Día de las Velitas, procesión)?, ¿es para su comunidad o para vender?
- Que escuche antes de proponer
- Que identifique el "dolor" o la motivación (embellecer la iglesia, recaudar fondos, generar ingreso)
- Que NO salte directo a vender el Kit de Aliado sin entender el contexto
- Tono: curioso, servicial, consultivo

**Estrategia de venta a aplicar aquí**: *Escucha activa y calificación*. Distinguir entre quien compra para su comunidad (venta directa) y quien quiere ser aliado (reclutamiento).

---

### 💡 ETAPA 3: RECOMMENDATION (Recomendación)

**Lo que debe lograr**: Proponer la solución correcta con argumentos que conecten.

Incluye en la instrucción:
- Que recomiende según lo descubierto (ej: pocos faroles → venta directa; interés en ingreso → Kit de Aliado)
- Que use **historias de éxito** o beneficios concretos (durabilidad, precio justo, apoyo a la comunidad)
- Que presente el valor antes que el precio
- Que maneje objeciones comunes (precio, confianza, logística)
- Que NO liste todo el catálogo — recomienda 1-2 opciones específicas
- Tono: seguro, entusiasta pero honesto, orientado al beneficio del cliente

**Estrategia de venta a aplicar aquí**: *Recomendación consultiva*. No vender "todo", vender lo que resuelve. Usar prueba social (otras comunidades ya lo hacen).

---

### 🛒 ETAPA 4: CHECKOUT (Cierre)

**Lo que debe lograr**: Cerrar el pedido sin fricción.

Incluye en la instrucción:
- Que confirme qué producto/cantidad quiere
- Que explique el siguiente paso (pago, envío, contacto de un asesor humano)
- Que resuelva dudas finales rápido
- Que refuerce la decisión (que se sienta bien de comprar)
- Que NO meta nuevas ofertas que distraigan del cierre
- Tono: claro, resolutivo, agradecido

**Estrategia de venta a aplicar aquí**: *Reducir fricción y reforzar la decisión*. Cada pregunta extra puede perder la venta. Confirmar y avanzar.

---

## 5. Principios de Copy que SÍ funcionan aquí

1. **Una idea por instrucción de acción** — La IA se confunde si le pides 5 cosas a la vez.
2. **Lenguaje de la comunidad** — Usa las palabras de tu público (Emaús, Lazos de Amor Mariano, Día de las Velitas, aliado, kit).
3. **Beneficio antes que característica** — "Faroles que embellecen tu procesión" > "Faroles de 30cm de aluminio".
4. **Sin presión agresiva** — Este público valora la honestidad y la fe, no la venta forzada.
5. **Brevedad** — Instruye a la IA a mandar mensajes cortos, no párrafos enormes.

---

## 6. Errores comunes a evitar

| ❌ Error | ✅ Corrección |
|---------|--------------|
| Escribir el mensaje literal del cliente | Escribir la *intención* y dejar que la IA redacte |
| Instrucción de 2 líneas sin contexto | Usar las 5 secciones de la plantilla |
| Pedir que venda en la primera etapa | Respetar el orden: primero confianza, luego venta |
| Mezclar objetivos de varias etapas | Cada instrucción = un solo objetivo claro |
| Tono corporativo frío | Tono humano, de comunidad de fe |

---

## 7. Flujo de trabajo (paso a paso)

1. Abre **Agents Studio** → https://crm.farolesgenius.com/agents-studio.html
2. Entra a **Configurar** (Agente de Ventas)
3. Ve al tab **"Instrucciones Dinámicas"**
4. Selecciona una etapa (empieza por ONBOARDING)
5. Escribe la instrucción usando la plantilla de la sección 3
6. Verifica el contador (50-5000 caracteres)
7. Click en **"Guardar Instrucción"**
8. Repite para las 4 etapas
9. Prueba una conversación real y ajusta lo que no suene bien

**Ventaja**: Puedes editar y guardar sin que nadie toque el código. Los cambios se aplican solos.

---

## 8. Checklist antes de guardar cada instrucción

- [ ] ¿Tiene las 5 secciones (Rol, Objetivo, Qué hacer, Qué evitar, Tono)?
- [ ] ¿El objetivo es UNO solo y claro para esa etapa?
- [ ] ¿Usa el lenguaje de la comunidad (fe, aliados, kit)?
- [ ] ¿Instruye tono humano y cálido, no robótico?
- [ ] ¿Evita vender antes de tiempo?
- [ ] ¿Está entre 50 y 5000 caracteres?
- [ ] ¿Probé una conversación de ejemplo?

---

## 9. Recurso adicional: Skill de Copywriting

El proyecto tiene una skill especializada llamada **faroles-genius-copywriter** basada en el libro *"Contagioso"* de Jonah Berger (framework STEPPS). Si necesitas redactar textos de marketing más elaborados (posts, anuncios, emails), pídele al equipo técnico que la use — aplica los principios de marketing de boca en boca de la marca.

---

**Preparado para**: Escritor de copy + Estratega de ventas Faroles Genius
**Fecha**: 2026-08-05
