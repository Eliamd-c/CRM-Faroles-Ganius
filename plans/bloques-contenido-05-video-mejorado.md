# Plan: Video mejorado

## Contexto

Tu código actual probablemente permite enviar video como parte de un `card` (attachment). El plan aquí es crear un **tipo de bloque dedicado para video** con validaciones, previsualizaciones y mejor UX.

Meta soporta videos en el formato de attachment. Los videos pueden tener thumbnail personalizado, título y botones asociados.

---

## Requisitos técnicos

### Meta Graph API

**Endpoint:** `POST https://graph.facebook.com/v21.0/me/messages`

**Opción 1: Video simple (solo reproducir)**
```json
{
  "recipient": { "id": "..." },
  "message": {
    "attachment": {
      "type": "video",
      "payload": {
        "url": "https://example.com/video.mp4",
        "is_reusable": true
      }
    }
  }
}
```

**Opción 2: Video con template (thumbnail + título + botones)**
```json
{
  "recipient": { "id": "..." },
  "message": {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "media",
        "elements": [
          {
            "media_type": "video",
            "attachment_id": "...", // O usar URL directa
            "buttons": [
              { "type": "postback", "title": "Ver detalles", "payload": "VER_DETALLES_VIDEO_1" }
            ]
          }
        ]
      }
    }
  }
}
```

**Formatos permitidos:** `mp4`, `mov`, `avi`, `webm`, `ogg`

**Límites:**
- Tamaño máximo: 26 MB
- Duración máxima: Sin límite documentado, pero recomendado máximo 5-10 minutos
- Resolución recomendada: 720p o menor

### Diferencia entre Opción 1 y 2

| Aspecto | Opción 1 | Opción 2 |
|---|---|---|
| Complejidad | Simple | Media |
| Tiene botones | No | Sí |
| Tiene thumbnail | Auto-generado | Personalizable |
| Tiene título | No | Sí |
| Interactividad | Reproducir | Reproducir + botones |

**Recomendación:** Empezar con Opción 1 (video simple). Después agregar Opción 2.

---

## Cambios en la estructura de datos

### flows.json

```json
{
  "type": "video",
  "video_url": "https://example.com/video.mp4",
  "thumbnail_url": "https://example.com/thumbnail.jpg",
  "title": "(Opcional) Mira nuestro producto",
  "buttons": [] // Opcional, máximo 1-2 botones
}
```

---

## Cambios en el backend (app.js)

### Nueva función: `sendVideo()`

```javascript
// Pseudocódigo
async function sendVideo(senderId, videoUrl, title = null, thumbnail = null, buttons = []) {
  // Validar que videoUrl es HTTPS
  // Validar que URL responde (HEAD request)
  // Validar que Content-Type es video/*
  // Validar que tamaño < 26 MB
  // Si hay thumbnail, validar que sea HTTPS e imagen válida
  // Si hay botones, validar máximo 1-2
  // Enviar a Meta usando template 'media' si hay title/buttons, sino usar video simple
}
```

**Validaciones:**
1. URL debe ser HTTPS
2. HEAD request para verificar existencia y tamaño
3. Content-Type debe ser `video/*`
4. Tamaño <= 26 MB
5. Thumbnail (si existe) debe ser HTTPS e imagen válida
6. Máximo 1-2 botones por video

### Cambios en `processFlowSteps()`

```javascript
else if (step.type === 'video') {
  await sendVideo(
    senderId, 
    step.video_url, 
    step.title, 
    step.thumbnail_url, 
    step.buttons
  );
  currentId = node.outputs.output_1?.connections[0]?.node;
}
```

---

## Cambios en el frontend (builder.js)

### Nuevo nodo visual: "Video"

**Icono:** Ícono de play/película

**Panel inspector:**

1. **Campo "URL del video":**
   - Texto con placeholder
   - Botón "Validar"
   - Si válido: mostrar duración del video (si es posible extraerla)

2. **Opción "Subir video":**
   - Botón "Subir archivo de video"
   - Drag-and-drop soportado
   - Validar tamaño antes de subir (< 26 MB)

3. **Thumbnail (opcional):**
   - Campo URL de thumbnail OR
   - Botón "Generar thumbnail automático" (extrae frame del video en tiempo 0)
   - Mostrar preview del thumbnail

4. **Título (opcional):**
   - Campo de texto
   - "Mira nuestro tutorial"

5. **Botones (opcional):**
   - Máximo 1-2 botones
   - Estructura: { title, payload }

6. **Información:**
   - Mostrar duración del video si es posible
   - Mostrar tamaño

### Validación de archivo

Cuando el usuario sube un video:
1. Validar tamaño < 26 MB (lado del cliente)
2. Validar formato (extensión)
3. Mostrar barra de progreso durante la subida
4. Después de subir, intentar reproducir preview (elemento `<video>`)
5. Extraer duración del video
6. Mostrar "Duración: 2:45"

### Thumbnail automático

Meta puede generar un thumbnail automáticamente. Pero si el usuario quiere personalizar:
1. Puede subir una imagen como thumbnail (JPG/PNG)
2. O el builder extrae un frame del video (requiere FFmpeg en el servidor, complejidad adicional)

**Por ahora:** Permitir URL de thumbnail, no auto-generación.

### Estado global

```javascript
const nodeVideoState = {};
// {
//   nodeId: {
//     video_url: 'https://...',
//     thumbnail_url: 'https://...',
//     title: 'Mira nuestro tutorial',
//     buttons: [ { title, payload } ]
//   }
// }
```

### Serialización

```javascript
else if (node.name === 'video') {
  steps.push({
    type: 'video',
    video_url: nodeVideoState[currentId].video_url,
    thumbnail_url: nodeVideoState[currentId].thumbnail_url,
    title: nodeVideoState[currentId].title,
    buttons: nodeVideoState[currentId].buttons
  });
  currentId = node.outputs.output_1?.connections[0]?.node;
}
```

---

## Cambios en la subida de archivos

### app.js — multer

Expandir para soportar video:

```javascript
const ALLOWED_MIME_TYPES = {
  video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/ogg']
};

const ALLOWED_EXTENSIONS = {
  video: ['.mp4', '.mov', '.avi', '.webm', '.ogg']
};

// fileFilter como antes, pero agregando tipos de video
```

### Tamaño máximo

Multer configurable para permitir 26 MB en uploads de video:

```javascript
const upload = multer({
  limits: { 
    fileSize: 26 * 1024 * 1024 // 26 MB
  },
  // ... resto de config
});
```

---

## Impacto en experiencia del usuario

### Para el operador

**Flujo 1: URL externa**
1. Video subido a YouTube, Vimeo, o un CDN
2. Copiar URL del video
3. Agregar nodo "Video"
4. Pegar URL
5. Guardar flujo

**Flujo 2: Subir al servidor**
1. Agregar nodo "Video"
2. Click en "Subir video"
3. Seleccionar archivo de su computadora
4. Barra de progreso mientras sube
5. Una vez completo, URL se inserta automáticamente
6. Opcionalmente: subir thumbnail personalizado
7. Opcionalmente: agregar título y botones
8. Guardar flujo

### Para el usuario final (Instagram)

**Antes:**
- Recibe link de texto al video (tiene que abrir navegador)

**Después:**
- Recibe video reproducible dentro de Instagram
- Puede ver thumbnail personalizado
- Puede tocar botones para acciones relacionadas ("Ver carrito", "Contactar", etc.)

---

## Casos de uso

1. **Demo de producto:** "Mira cómo funciona nuestro producto" → video de 2 minutos
2. **Tutorial:** "Cómo usar nuestro servicio" → video paso a paso
3. **Testimonio:** Video de cliente diciendo por qué le gusta el producto
4. **Anuncio publicitario:** Video de 30 segundos sobre promoción
5. **Presentación:** "Conoce al equipo" → video de la empresa

---

## Validaciones en el builder

**Para URL externa:**
1. HEAD request a la URL
2. Verificar Content-Type es video/*
3. Verificar tamaño <= 26 MB
4. Intentar reproducir en elemento `<video>` (lado del cliente)
5. Si no carga: mostrar error

**Para subida:**
1. Validar tamaño pre-subida (lado del cliente)
2. Validar formato (extensión)
3. Mostrar barra de progreso
4. Después de subida, reproducir preview
5. Extraer duración con JavaScript

**Preview de thumbnail:**
1. Si hay URL de thumbnail, mostrar miniatura
2. Si no hay, mostrar ícono genérico de video
3. Permitir cambiar/quitar thumbnail

---

## Consideraciones técnicas

### Formatos de video

| Formato | Compatibilidad | Tamaño | Notas |
|---|---|---|---|
| MP4 | Excelente | Medio | Estándar de internet |
| MOV | Buena | Grande | Desde iPhone |
| WebM | Buena | Pequeño | Optimizado para web |
| OGG | Media | Pequeño | Menos común |

**Recomendación:** MP4 es más compatible. Si el usuario sube MOV, el backend podría convertirlo (pero requiere FFmpeg).

### Compresión de video

Videos sin comprimir son muy pesados (> 100 MB). El usuario debería comprimir antes:
- Resolución: 720p máximo
- Codec: H.264
- Bitrate: 2-4 Mbps
- Formato: MP4

Documentar esto en el builder.

### Performance

Subir un video de 26 MB es lento (depende de la conexión del usuario). Considerar:
- Mostrar estimación de tiempo de subida
- Permitir reintentar si la subida falla
- Mostrar barra de progreso detallada

---

## Checklist de implementación

- [ ] **Backend:** Crear función `sendVideo(senderId, videoUrl, title, thumbnail, buttons)`
- [ ] **Backend:** Validar URL y metadata de video
- [ ] **Backend:** Agregar branch en `processFlowSteps()` para `type: 'video'`
- [ ] **Backend:** Expandir multer para soportar video (MIME types, tamaño)
- [ ] **Frontend:** Crear nodo visual "Video"
- [ ] **Frontend:** Crear `nodeVideoState` global
- [ ] **Frontend:** Panel inspector con URL, thumbnail, título, botones
- [ ] **Frontend:** Validación de URL y subida de archivo
- [ ] **Frontend:** Extracción de duración del video
- [ ] **Frontend:** Preview en elemento `<video>`
- [ ] **Frontend:** Serialización en `buildStepsFromNode()`
- [ ] **Testing:** Enviar video a Instagram y reproducir
- [ ] **Documentation:** Documentar formatos y límites de tamaño
- [ ] **UX:** Advertir sobre compresión de video recomendada

---

## Evoluciones futuras

1. **Auto-compresión:** Backend comprime video automáticamente a formato óptimo
2. **Extracción de thumbnail:** Extraer frame del video como thumbnail (FFmpeg)
3. **Video con subtítulos:** Incluir subtítulos en el video
4. **Analytics:** Medir cuántos usuarios reprodujeron el video
5. **Transmisión en vivo:** Integrar con live streaming de Instagram
