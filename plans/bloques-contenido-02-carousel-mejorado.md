# Plan: Carrusel mejorado (Carousel)

## Contexto

Un carrusel es un contenedor que permite mostrar múltiples elementos (cards) en formato scrolleable horizontal. El usuario desliza entre tarjetas, cada una con imagen, título, descripción y botones. Es uno de los formatos más atractivos en Manychat y genera alta interacción.

Tu código actual tiene un elemento `card` que envía una tarjeta individual. Un carrusel es simplemente **múltiples cards en un solo mensaje**, pero con restricciones específicas de Meta.

---

## Análisis técnico actual

### Cómo funcionan hoy

**Backend (app.js):**
- Existe una función `sendCard()` que envía UNA tarjeta (image + title + subtitle + buttons)
- El paso de flujo `type: 'card'` solo soporta una tarjeta

**Frontend (builder.js):**
- Existe un nodo visual `card` que permite agregar una tarjeta
- Cada tarjeta guarda: title, subtitle, image_url, buttons

**Limitación actual:** No puedes encadenar múltiples cards en un solo mensaje. Tienes que mandarlas como pasos separados (lo que genera múltiples llamadas API).

---

## Decisión de diseño requerida

**Opción A:** Crear un nuevo tipo de nodo llamado "Carrusel" (separado del nodo "Card")
- **Ventaja:** Interfaz clara, el usuario sabe que está creando un carrusel
- **Desventaja:** Duplica lógica (ambos usan cards internamente)

**Opción B:** Expandir el nodo "Card" existente para permitir N elementos en lugar de 1
- **Ventaja:** Simplifica la UI (un solo nodo card)
- **Desventaja:** Menos intuitivo, el usuario puede no entender que puede agregar múltiples

**Opción C:** Híbrido — nodo "Card simple" (una sola) y nodo "Carrusel" (múltiples)
- **Ventaja:** Máxima claridad
- **Desventaja:** Duplica trabajo en backend

**Recomendación:** Opción C. Un usuario que agregue un nodo "Carrusel" expecta una experiencia diferente a "Una tarjeta". Vale la pena duplicar el trabajo.

---

## Requisitos técnicos para implementar Carrusel

### En Meta Graph API

**Endpoint:** `POST https://graph.facebook.com/v21.0/me/messages`

**Estructura del payload:**
```json
{
  "recipient": { "id": "..." },
  "message": {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [
          {
            "title": "Producto 1",
            "subtitle": "Descripción",
            "image_url": "https://...",
            "buttons": [
              { "type": "postback", "title": "Ver", "payload": "VER_1" }
            ]
          },
          {
            "title": "Producto 2",
            "subtitle": "Descripción 2",
            "image_url": "https://...",
            "buttons": [...]
          }
        ]
      }
    }
  }
}
```

**Limitaciones de Meta:**
- Mínimo: 1 elemento
- **Máximo: 10 elementos por carrusel**
- Cada elemento puede tener:
  - `title`: máximo 80 caracteres
  - `subtitle`: máximo 80 caracteres
  - `image_url`: requerida
  - `buttons`: máximo 3 por elemento
  - Cada botón máximo 20 caracteres

---

## Cambios en la estructura de datos

### flows.json (nuevos pasos)

**Hoy (card individual):**
```json
{
  "type": "card",
  "card": {
    "title": "Producto X",
    "subtitle": "Descripción",
    "image_url": "https://...",
    "buttons": [...]
  }
}
```

**Con carrusel (nuevo paso):**
```json
{
  "type": "carousel",
  "elements": [
    {
      "title": "Producto 1",
      "subtitle": "Descripción 1",
      "image_url": "https://...",
      "buttons": [...]
    },
    {
      "title": "Producto 2",
      "subtitle": "Descripción 2",
      "image_url": "https://...",
      "buttons": [...]
    }
  ]
}
```

---

## Cambios en el backend (app.js)

### Nueva función: `sendCarousel()`

```javascript
// Pseudocódigo
async function sendCarousel(senderId, elements) {
  // Validar que no haya más de 10 elementos
  // Validar que cada elemento tenga image_url
  // Enviar a Meta con structure { attachment: { type: 'template', payload: { template_type: 'generic', elements } } }
}
```

**Diferencia con `sendCard()`:**
- `sendCard()` envía UN elemento en un attachment template
- `sendCarousel()` envía MÚLTIPLES elementos en el mismo attachment

### Cambios en `processFlowSteps()`

Agregar un nuevo branch para `type: 'carousel'`:
```javascript
else if (step.type === 'carousel') {
  await sendCarousel(senderId, step.elements);
  currentId = node.outputs.output_1?.connections[0]?.node;
}
```

### Validación de límites

Cuando se procesa un paso carousel:
1. Verificar que `step.elements.length <= 10`
2. Para cada elemento:
   - Verificar que `image_url` existe y es URL válida
   - Truncar `title` a 80 caracteres (o advertir)
   - Truncar `subtitle` a 80 caracteres (o advertir)
   - Verificar que `buttons.length <= 3`

---

## Cambios en el frontend (builder.js)

### Nuevo nodo visual: "Carousel"

**Icono:** Imagen de varias tarjetas lado a lado

**Panel inspector (cuando se selecciona el nodo carousel):**

1. **Sección "Elementos del carrusel":**
   - Mostrar lista de elementos actuales (ej: "Elemento 1", "Elemento 2", etc.)
   - Botón "+ Agregar elemento" (máximo 10)
   - Cada elemento tiene un botón de editar y eliminar

2. **Modal de edición de elemento:**
   - Campo "Título" (máximo 80 caracteres, mostrar contador)
   - Campo "Subtítulo" (máximo 80 caracteres, mostrar contador)
   - Campo "URL de imagen"
   - Sección "Botones" (máximo 3):
     - Por cada botón: título, payload, y botón para eliminar
     - Botón "+ Agregar botón"

3. **Vista previa:**
   - Mostrar de forma visual cómo se verá el carrusel en Instagram (mockup horizontal scrolleable)

### Estado global en builder.js

```javascript
const nodeCarouselState = {};
// {
//   nodeId: {
//     elements: [
//       { title, subtitle, image_url, buttons: [] },
//       { title, subtitle, image_url, buttons: [] }
//     ]
//   }
// }
```

### Serialización en buildStepsFromNode()

Cuando se encuentra un nodo `carousel`:
```javascript
else if (node.name === 'carousel') {
  steps.push({
    type: 'carousel',
    elements: nodeCarouselState[currentId].elements
  });
  currentId = node.outputs.output_1?.connections[0]?.node;
}
```

---

## Impacto en experiencia del usuario

### Para el operador (quien diseña el flujo)

**Antes:**
- Para mostrar 5 productos: agregar 5 nodos "card" separados
- Genera 5 llamadas API separadas
- Es tedioso

**Después:**
- Agregar 1 nodo "carrusel"
- Dentro, agregar 5 elementos
- Se envía TODO en 1 llamada API
- Es más eficiente y visual

### Para el usuario final (Instagram)

**Antes:**
- Recibe 5 mensajes separados con 1 producto cada uno

**Después:**
- Recibe 1 mensaje con 5 productos, puede deslizar entre ellos

---

## Casos de uso principales

1. **Catálogo de productos:** Mostrar 5-10 productos con foto, nombre, precio y botón "Ver detalles"
2. **Galerías:** Mostrar opciones múltiples (colores disponibles, tamaños, etc.)
3. **Testimonios:** Mostrar múltiples reseñas/testimonios
4. **Opciones de compra:** Mostrar paquetes o planes diferentes lado a lado

---

## Limitaciones a documentar

- **Máximo 10 elementos:** Si el usuario intenta agregar el 11º, el builder lo rechaza
- **Imagen requerida:** Cada elemento DEBE tener una URL de imagen válida
- **Máximo 3 botones por elemento:** Meta lo rechaza si hay más
- **Caracteres truncados:** Si el título excede 80 caracteres, Instagram lo trunca (mostrar warning)
- **Tiempo de carga:** Un carrusel con 10 imágenes pesadas puede tardar en cargar en conexiones lentas

---

## Validaciones en el builder

**Mientras el usuario edita:**

1. Contador de elementos: "3 de 10"
2. Si intenta agregar el 11º: modal de error "Máximo 10 elementos por carrusel"
3. Para cada elemento:
   - Si no tiene imagen: ícono de alerta rojo "Se requiere imagen"
   - Si el título tiene 70+ caracteres: ícono amarillo "Instagram truncará este texto"
   - Si hay más de 3 botones: error rojo "Máximo 3 botones por elemento"

**Al guardar el flujo:**
- Validar todas las imágenes (que sean URLs válidas con HEAD request)
- Si alguna imagen es inválida, mostrar error y no permitir guardar

---

## Verificación / Testing

**Casos a probar:**

1. **Carrusel básico**
   - Crear nodo carousel con 3 elementos
   - Cada elemento: imagen, título, subtítulo, 2 botones
   - Enviar a Instagram
   - Verificar: se ve scrolleable, se pueden tocar los botones

2. **Límite de 10 elementos**
   - Agregar 10 elementos → permitir
   - Intentar agregar el 11º → rechazar

3. **Validación de imagen**
   - Guardar un carrusel sin imagen en uno de los elementos
   - Verificar: error o advertencia clara

4. **Truncamiento de texto**
   - Título con 100 caracteres
   - Guardar
   - Verificar en Instagram que se trunca a 80

5. **Botones y payloads**
   - Carrusel con 3 elementos, cada uno con botón diferente
   - Tocar botón del elemento 2
   - Verificar: se ejecuta el flujo correcto basado en ese payload

6. **Compatibilidad con tags/acciones**
   - Elemento 1: botón "Interesado" → agrega tag "interested_producto_1"
   - Elemento 2: botón "Más info" → ejecuta subcuenceo
   - Verificar: cada botón ejecuta su lógica correcta

---

## Checklist de implementación

- [ ] **Backend:** Crear función `sendCarousel(senderId, elements)`
- [ ] **Backend:** Validar límites de Meta (10 elementos, 3 botones, caracteres)
- [ ] **Backend:** Agregar branch en `processFlowSteps()` para `type: 'carousel'`
- [ ] **Frontend:** Crear nodo visual "Carousel" en Drawflow
- [ ] **Frontend:** Crear `nodeCarouselState` global
- [ ] **Frontend:** Crear panel inspector para carrusel con modal de edición
- [ ] **Frontend:** Crear vista previa visual del carrusel
- [ ] **Frontend:** Validaciones en tiempo real (contador, alertas)
- [ ] **Frontend:** Cambiar `buildStepsFromNode()` para serializar carrusel
- [ ] **Testing:** Enviar carruseles reales a Instagram
- [ ] **Documentation:** Documentar en README el uso de carruseles
- [ ] **UI:** Agregar ícono distintivo para el nodo carousel
