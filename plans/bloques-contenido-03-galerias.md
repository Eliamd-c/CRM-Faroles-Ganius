# Plan: Galerías (Grid de imágenes con botones)

## Contexto

Una galería es similar a un carrusel, pero en lugar de mostrar elementos en fila horizontal, se muestran en una **grilla (grid)** de múltiples imágenes. Es especialmente útil para catálogos visuales grandes donde quieres que el usuario vea múltiples opciones a la vez.

Meta no tiene un tipo de template específico para "galería". La implementación es usar **múltiples attachment messages** (enviar varias imágenes/cards seguidas rápidamente) o aprovechar el formato `generic` template pero con elementos más pequeños.

---

## Diferencia: Carrusel vs Galería

| Aspecto | Carrusel | Galería |
|---|---|---|
| Layout | Fila horizontal (scroll) | Grid 2-3 columnas |
| Elementos visibles | 1-2 a la vez | 4-6 a la vez |
| Caso de uso | Catálogo enfocado | Vista rápida de opciones |
| Implementación técnica | 1 template message | N image attachments o 1 generic con elementos pequeños |

---

## Requisitos técnicos para implementar Galerías

### Opción 1: Múltiples image attachments (enviados rápido)

**Meta permite:**
```json
{
  "recipient": { "id": "..." },
  "message": {
    "attachment": {
      "type": "image",
      "payload": { "url": "https://..." }
    }
  }
}
```

**Estrategia:** Enviar 4-6 imágenes en rápida sucesión (con delay de 200ms entre cada una). El usuario ve una "galería" aunque técnicamente son mensajes separados.

**Ventajas:**
- Simple de implementar
- Funciona con cualquier número de imágenes
- No hay límites de Meta

**Desventajas:**
- Genera ruido en el hilo de conversación (6 mensajes en lugar de 1)
- El usuario se abruma si hay muchas imágenes
- No hay botones por imagen (solo imágenes)

### Opción 2: Image carousel (template generic con imagenes pequeñas)

Meta permite el template `generic` con elementos que solo tienen imagen (sin title/subtitle/buttons).

**Ventajas:**
- Se ve compacto (como galería real)
- Solo 1 mensaje

**Desventajas:**
- Las imágenes se ven muy pequeñas
- No hay botones por imagen
- No es lo ideal para interacción

### Opción 3: Híbrido — Grid de cards con botones

Similar al carrusel pero con **hasta 6 elementos en lugar de 10**, y mostrados visualmente como grid.

**Ventajas:**
- Máxima interacción (botones en cada elemento)
- Compacto (1 mensaje)
- Mejor UX que carrusel para muchas opciones

**Desventajas:**
- Requiere optimización de UI (elementos más pequeños)
- Meta puede no renderizar perfectamente en todos los clientes

---

## Decisión de diseño requerida

**Recomendación:** Implementar Opción 1 (múltiples image attachments con delay) porque:
1. Es la más compatible con Meta
2. No requiere cambios complejos en el backend
3. Funciona bien para 4-8 imágenes

Si después necesitas interacción por imagen, evolucionas a Opción 3.

---

## Cambios en la estructura de datos

### flows.json (nuevo paso)

```json
{
  "type": "gallery",
  "images": [
    {
      "url": "https://...",
      "caption": "Producto 1 (opcional)"
    },
    {
      "url": "https://...",
      "caption": "Producto 2"
    }
  ],
  "delay_between_images_ms": 300
}
```

---

## Cambios en el backend (app.js)

### Nueva función: `sendGallery()`

```javascript
// Pseudocódigo
async function sendGallery(senderId, images, delayMs = 300) {
  // Para cada imagen:
  for (const img of images) {
    // Validar URL
    // Enviar imagen
    // Esperar delayMs antes de enviar la siguiente
    // Usar setTimeout o Promise.race + delay
  }
}
```

**Consideración:** El delay entre imágenes es importante. Si envías 6 imágenes instantáneamente, Meta puede:
- Agruparlas en un solo mensaje
- Rechazarlas por rate limiting
- Mostrarlas fuera de orden

Delay recomendado: 200-500ms

### Cambios en `processFlowSteps()`

```javascript
else if (step.type === 'gallery') {
  await sendGallery(senderId, step.images, step.delay_between_images_ms || 300);
  currentId = node.outputs.output_1?.connections[0]?.node;
}
```

### Validaciones

1. Cada URL debe ser válida (HTTPS)
2. Máximo 20 imágenes por galería (Meta es permisivo, pero en UX no tiene sentido)
3. Validar que Meta no rechace las imágenes (comprobar que la URL existe con HEAD request)

---

## Cambios en el frontend (builder.js)

### Nuevo nodo visual: "Galería"

**Icono:** 4 imágenes en grid

**Panel inspector:**

1. **Sección "Imágenes":**
   - Mostrar vista previa grid de las imágenes
   - Cada imagen tiene botones: editar, eliminar, subir nueva
   - Botón "+ Agregar imagen"

2. **Por cada imagen:**
   - Campo "URL de imagen"
   - Campo "Caption/descripción (opcional)"
   - Prevista miniatura
   - Botón para quitar

3. **Configuración avanzada (colapsable):**
   - "Delay entre imágenes (ms)" — selector 100-1000ms con slider
   - Información: "Esperar entre cada imagen para evitar problemas de carga"

### Estado global

```javascript
const nodeGalleryState = {};
// {
//   nodeId: {
//     images: [
//       { url: 'https://...', caption: 'Producto 1' },
//       { url: 'https://...', caption: 'Producto 2' }
//     ],
//     delayMs: 300
//   }
// }
```

### Serialización

```javascript
else if (node.name === 'gallery') {
  steps.push({
    type: 'gallery',
    images: nodeGalleryState[currentId].images,
    delay_between_images_ms: nodeGalleryState[currentId].delayMs || 300
  });
  currentId = node.outputs.output_1?.connections[0]?.node;
}
```

---

## Impacto en experiencia del usuario

### Para el operador

**Antes:**
- Agregar 5 nodos "card" separados si quería mostrar 5 productos visualmente

**Después:**
- Agregar 1 nodo "galería"
- Subir/pegar 5 URLs de imágenes
- Listo

### Para el usuario final (Instagram)

**Antes:**
- Recibe 5 mensajes con 1 tarjeta cada uno (o nada si solo eran imágenes)

**Después:**
- Recibe 5 imágenes que llegan seguidas (vistas como galería visual)

---

## Casos de uso

1. **Catálogo visual:** Mostrar 6-8 productos solo con foto (sin descripción)
2. **Portfolio:** Mostrar trabajos/proyectos
3. **Galería de fotos:** Usuario pregunta "Muestrame las opciones disponibles"
4. **Lookbook:** Diferentes combinaciones/estilos

---

## Validaciones en el builder

**Mientras se edita:**

1. Contador: "5 de 20 imágenes"
2. Por cada imagen:
   - Si la URL es inválida (no empieza con https://): ícono de error rojo
   - Mostrar miniatura si es válida
   - Si no carga la miniatura (timeout de 3s): "No se pudo cargar la imagen"

3. Botón "+ Agregar imagen":
   - Opción 1: Pegar URL
   - Opción 2: Subir archivo (POST /api/upload)
   - Si es por subida, el builder debe esperar el response y guardar la URL

**Al guardar el flujo:**
- Validar que todas las URLs sean accesibles (HEAD request)
- Si alguna falla, mostrar error: "Imagen no accesible: [URL]"

---

## Consideraciones de performance

### Rate limiting de Meta

Meta tiene límites de velocidad. Si envías 20 mensajes en 1 segundo, podría rechazar algunos.

**Solución:** El delay entre imágenes actúa como throttle natural. Con delay de 300ms:
- 10 imágenes = 3 segundos totales
- 20 imágenes = 6 segundos totales
- No hay riesgo de rate limiting

### Caché de imágenes

Si la URL de una imagen es lenta de cargar, el usuario verá cada mensaje llegando lentamente.

**Solución:** Documentar que el operador debe usar URLs de CDN rápidas (no URLs de base de datos local).

---

## Flujo completo de ejemplo

**Escenario:** Usuario dice "Mostrar catálogo"

1. Flujo busca keyword "catalogo"
2. Ejecuta nodo "Galería" con 6 imágenes de productos
3. Backend llama `sendGallery(senderId, 6_images, 300)`
4. Cada 300ms, envía una imagen
5. Usuario ve 6 imágenes en 1.8 segundos
6. Usuario toca una para ver detalles (otro flujo)

---

## Checklist de implementación

- [ ] **Backend:** Crear función `sendGallery(senderId, images, delayMs)`
- [ ] **Backend:** Implementar delay con `Promise` y `setTimeout`
- [ ] **Backend:** Validar URLs de imágenes (HEAD request)
- [ ] **Backend:** Agregar branch en `processFlowSteps()` para `type: 'gallery'`
- [ ] **Frontend:** Crear nodo visual "Galería"
- [ ] **Frontend:** Crear `nodeGalleryState` global
- [ ] **Frontend:** Panel inspector con preview grid
- [ ] **Frontend:** Validación de URLs en tiempo real
- [ ] **Frontend:** Cargar miniaturas de imágenes
- [ ] **Frontend:** Soporte para subida de imágenes (integración con /api/upload)
- [ ] **Frontend:** Serialización en `buildStepsFromNode()`
- [ ] **Testing:** Galería con 5-10 imágenes en Instagram
- [ ] **Documentation:** Documentar casos de uso
- [ ] **Performance:** Medir tiempo de carga de galerías grandes

---

## Evoluciones futuras

1. **Galería interactiva:** Agregar botones bajo cada imagen (ir a carrusel con detalles)
2. **Fotos con likes:** Integración con productos reales de Shopify/WooCommerce
3. **Galería dinámica:** Traer imágenes desde una API externa (catálogo de BD)
