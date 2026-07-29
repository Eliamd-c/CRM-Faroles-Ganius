# Plan: Bloques de Audio

## Contexto

El contenido de audio (archivos de voz, música, podcasts) se envía a través de attachments de tipo `audio`. Meta soporta archivos en formatos `m4a`, `mp3`, `ogg`, `wav`, etc.

Casos de uso:
- **Mensajes de voz:** El bot envía una respuesta hablada (text-to-speech generado o grabado)
- **Audio de bienvenida:** Presentación de la marca en voz
- **Podcast/clips:** Compartir un podcast corto sobre el tema
- **Confirmación de compra:** "Tu pedido #12345 ha sido confirmado" en audio

---

## Requisitos técnicos

### Meta Graph API

**Endpoint:** `POST https://graph.facebook.com/v21.0/me/messages`

**Estructura del payload:**
```json
{
  "recipient": { "id": "..." },
  "message": {
    "attachment": {
      "type": "audio",
      "payload": {
        "url": "https://example.com/audio.mp3",
        "is_reusable": true
      }
    }
  }
}
```

**Formatos permitidos:** `m4a`, `mp3`, `ogg`, `wav`, `aac`, `mpeg`

**Límites:**
- Tamaño máximo: 26 MB (según documentación de Meta)
- Duración recomendada: máximo 10 minutos (más largas, usuario se aburre en chat)

### Métodos para generar audio

**Opción A: URL de audio preexistente**
- El usuario sube un archivo MP3 a su servidor
- El bot envía la URL

**Opción B: Text-to-Speech (TTS)**
- El usuario escribe un texto en el builder
- El backend convierte texto a voz usando una API (Google Cloud, Amazon Polly, OpenAI Whisper)
- Se genera un MP3 que se envía

**Opción C: Hybrid**
- Opción A como default (es simple)
- TTS como feature premium después

**Recomendación:** Empezar con Opción A (URL de audio). TTS se puede agregar después como evolución.

---

## Cambios en la estructura de datos

### flows.json

```json
{
  "type": "audio",
  "audio_url": "https://example.com/message.mp3",
  "caption": "(Opcional) Escucha mi mensaje" 
}
```

---

## Cambios en el backend (app.js)

### Nueva función: `sendAudio()`

```javascript
// Pseudocódigo
async function sendAudio(senderId, audioUrl, caption = null) {
  // Validar que audioUrl es HTTPS
  // Validar que URL responde (HEAD request)
  // Validar que Content-Type es audio/*
  // Validar que tamaño < 26 MB
  // Enviar a Meta
}
```

**Validaciones:**
1. URL debe ser HTTPS (Meta lo requiere)
2. HEAD request a la URL para verificar que existe y obtener el `Content-Length`
3. Verificar que `Content-Type` comience con `audio/`
4. Verificar que tamaño <= 26MB
5. Si alguna validación falla, loguear error y no enviar

### Cambios en `processFlowSteps()`

```javascript
else if (step.type === 'audio') {
  await sendAudio(senderId, step.audio_url, step.caption);
  currentId = node.outputs.output_1?.connections[0]?.node;
}
```

---

## Cambios en el frontend (builder.js)

### Nuevo nodo visual: "Audio"

**Icono:** Ícono de nota musical o speaker

**Panel inspector:**

1. **Campo "URL de audio":**
   - Texto con placeholder "https://example.com/audio.mp3"
   - Botón "Validar URL"
   - Si URL es válida: mostrar ícono verde y duración del audio (si es posible)
   - Si URL es inválida: mostrar ícono rojo

2. **Opción "Subir archivo":**
   - Botón "Subir archivo de audio"
   - Soportar drag-and-drop
   - Después de subir, mostrar la URL generada

3. **Campo "Nota/descripción (opcional)":**
   - Texto para mostrar al usuario junto con el reproductor
   - Ej: "Escucha mi consejo sobre este tema"

4. **Validación:**
   - Máximo 26 MB
   - Formatos: .mp3, .wav, .m4a, .ogg, .aac
   - Duración: máximo 600 segundos (10 minutos)

### Validación de archivo

Cuando el usuario sube un archivo:
1. Verificar que el tamaño sea < 26 MB
2. Verificar que el formato sea permitido (extensión)
3. Reproducir los primeros 2 segundos en el builder (para preview)
4. Mostrar duración total del audio
5. Si el formato no es soportado o el archivo está corrupto, mostrar error

### Subida a servidor

**Endpoint:** `POST /api/upload` (ya existe)

Multer ya está configurado. Necesitaría agregar tipos `audio/*` a la lista de MIME types permitidos.

**Alternativa:** Si el usuario no quiere subir a su servidor, puede usar una URL externa (de un CDN, Cloudinary, etc.).

### Estado global

```javascript
const nodeAudioState = {};
// {
//   nodeId: {
//     audio_url: 'https://...',
//     caption: 'Escucha mi mensaje'
//   }
// }
```

### Serialización

```javascript
else if (node.name === 'audio') {
  steps.push({
    type: 'audio',
    audio_url: nodeAudioState[currentId].audio_url,
    caption: nodeAudioState[currentId].caption
  });
  currentId = node.outputs.output_1?.connections[0]?.node;
}
```

---

## Cambios en la subida de archivos

### app.js — configuración de multer

Actualmente, multer solo permite imágenes (jpg, png, gif, webp).

**Cambio necesario:** Expandir para soportar audio

```javascript
const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/mp4']
};

const ALLOWED_EXTENSIONS = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  audio: ['.mp3', '.wav', '.ogg', '.aac', '.m4a']
};

// En fileFilter:
const ext = path.extname(file.originalname).toLowerCase();
const mimeAllowed = Object.values(ALLOWED_MIME_TYPES).flat().includes(file.mimetype);
const extAllowed = Object.values(ALLOWED_EXTENSIONS).flat().includes(ext);

if (mimeAllowed && extAllowed && file.size <= 26 * 1024 * 1024) {
  cb(null, true);
} else {
  cb(new Error('Archivo de audio inválido o demasiado grande'));
}
```

### Directorio de almacenamiento

Los archivos de audio pueden ir al mismo directorio `public/uploads/` que las imágenes. Organizar por carpeta si es necesario: `uploads/images/` y `uploads/audio/`.

---

## Impacto en experiencia del usuario

### Para el operador

**Flujo 1: Usar URL externa**
1. Subir audio a Cloudinary o un CDN
2. Copiar URL
3. En el builder, agregar nodo "Audio"
4. Pegar URL
5. Guardar flujo

**Flujo 2: Subir al servidor**
1. En el builder, agregar nodo "Audio"
2. Hacer click en "Subir archivo"
3. Seleccionar archivo de su computadora
4. El builder sube a `/api/upload`, obtiene URL
5. URL se inserta automáticamente
6. Guardar flujo

### Para el usuario final (Instagram)

**Antes:**
- Solo podía recibir mensajes de texto o imágenes

**Después:**
- Recibe un audio que puede reproducir in-app
- No necesita descargar ni abrir una app externa

---

## Casos de uso

1. **Verificación de compra:** "Tu pedido ha sido confirmado" en audio
2. **Presentación de marca:** Audio de 30 segundos con la historia de la marca
3. **Respuesta personalizada:** Bot responde con audio generado por TTS
4. **Podcast corto:** "Nuestro episodio de hoy habla sobre..."
5. **Confirmación de voz:** Usuario da consentimiento escuchando términos

---

## Validaciones en el builder

**Para URL externa:**
1. Hacer HEAD request a la URL para verificar que existe
2. Verificar Content-Type (debe ser audio/*)
3. Obtener Content-Length y verificar <= 26 MB
4. Si falla algo, mostrar error específico

**Para subida de archivo:**
1. Validar tamaño antes de subir (lado del cliente, en JS)
2. Validar formato (extensión)
3. Durante la subida, mostrar barra de progreso
4. Si falla, mostrar error

**Después de tener la URL:**
1. Intentar cargar el audio en un `<audio>` tag (lado del cliente)
2. Si carga correctamente, extraer duración
3. Mostrar duración en el panel inspector: "Duración: 1:23"
4. Permitir "preview" — reproducir los primeros 3 segundos

---

## Consideraciones técnicas

### Formatos de audio

Meta soporta múltiples formatos. Algunos son más comprimidos que otros:

| Formato | Tamaño | Calidad | Compatibilidad |
|---|---|---|---|
| MP3 | Pequeño | Media-Alta | Excelente |
| WAV | Grande | Muy alta | Excelente |
| OGG | Pequeño | Media | Buena |
| AAC | Muy pequeño | Alta | Buena |
| M4A | Muy pequeño | Alta | Buena |

**Recomendación:** MP3 es el más compatible. Si el usuario sube WAV, el backend podría convertirlo a MP3 (pero eso requiere FFmpeg, complejidad adicional).

### Text-to-Speech (evolución futura)

Si después quieres agregar TTS:

**Opciones de API:**
1. Google Cloud Text-to-Speech
2. Amazon Polly
3. OpenAI TTS (es gratis para los usuarios de ChatGPT Plus)
4. ElevenLabs (voces más naturales)

El backend recibiría un paso con `type: 'audio'` y `tts_text: "tu mensaje aquí"`, generaría el MP3, lo subiría a storage, y enviaría la URL a Meta.

---

## Checklist de implementación

- [ ] **Backend:** Crear función `sendAudio(senderId, audioUrl, caption)`
- [ ] **Backend:** Validar URL (HEAD request, Content-Type, tamaño)
- [ ] **Backend:** Agregar branch en `processFlowSteps()` para `type: 'audio'`
- [ ] **Backend:** Expandir multer para soportar audio (MIME types)
- [ ] **Frontend:** Crear nodo visual "Audio"
- [ ] **Frontend:** Crear `nodeAudioState` global
- [ ] **Frontend:** Panel inspector con campos URL y upload
- [ ] **Frontend:** Validación de URL en tiempo real
- [ ] **Frontend:** Subida de archivo con `fetch` al endpoint `/api/upload`
- [ ] **Frontend:** Preview de audio (elemento `<audio>`)
- [ ] **Frontend:** Extracción de duración del audio
- [ ] **Frontend:** Serialización en `buildStepsFromNode()`
- [ ] **Testing:** Enviar audio a Instagram y reproducir
- [ ] **Security:** Validar que solo se permiten audio files (no executables disfrazados)
- [ ] **Documentation:** Documentar formatos soportados y tamaño máximo

---

## Evoluciones futuras

1. **Text-to-Speech:** Convertir texto a audio automáticamente
2. **Transcripción:** Cuando usuario envía audio, transcribir a texto
3. **Audio con subtítulos:** Mostrar transcripción junto al audio
4. **Biblioteca de audios:** Guardar audios reutilizables
5. **Analytics:** Medir cuántos usuarios reprodujeron el audio
