# Plan: PDF y Archivos descargables

## Contexto

Los PDFs y archivos descargables son críticos para procesos B2B (facturas, manuales, documentos contractuales) y algunos B2C (guías de uso, catálogos, recetas).

Meta soporta archivos mediante attachments de tipo `file`. El usuario puede descargar el archivo directamente desde Instagram sin salir de la app.

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
      "type": "file",
      "payload": {
        "url": "https://example.com/documento.pdf",
        "is_reusable": true
      }
    }
  }
}
```

**Formatos permitidos:**
- Documentos: `pdf`, `doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx`
- Comprimidos: `zip`, `rar`, `7z`
- Otros: `txt`, `csv`, `json`

**Límites:**
- Tamaño máximo: 26 MB (mismo que video/audio)
- Instagram automáticamente genera un nombre de descarga basado en la URL

---

## Cambios en la estructura de datos

### flows.json

```json
{
  "type": "file",
  "file_url": "https://example.com/documento.pdf",
  "filename": "Manual_de_uso.pdf",
  "caption": "(Opcional) Descarga nuestro manual completo"
}
```

---

## Cambios en el backend (app.js)

### Nueva función: `sendFile()`

```javascript
// Pseudocódigo
async function sendFile(senderId, fileUrl, filename = null) {
  // Validar que fileUrl es HTTPS
  // HEAD request para verificar existencia
  // Validar que tamaño < 26 MB
  // Validar que la extensión está permitida
  // Enviar a Meta
}
```

**Validaciones:**
1. URL debe ser HTTPS
2. HEAD request para verificar existencia y tamaño
3. Tamaño <= 26 MB
4. Extensión en whitelist (pdf, doc, xls, etc.)
5. Content-Type debe coincidir con extensión (no enviar un .exe disfrazado de .pdf)

### Cambios en `processFlowSteps()`

```javascript
else if (step.type === 'file') {
  await sendFile(senderId, step.file_url, step.filename);
  currentId = node.outputs.output_1?.connections[0]?.node;
}
```

---

## Cambios en el frontend (builder.js)

### Nuevo nodo visual: "Archivo"

**Icono:** Ícono de documento o descarga

**Panel inspector:**

1. **Campo "URL del archivo":**
   - Texto con placeholder
   - Botón "Validar"
   - Si válido: mostrar información (tamaño, tipo de archivo)

2. **Opción "Subir archivo":**
   - Botón "Subir archivo"
   - Drag-and-drop soportado
   - Validar tamaño antes de subir (< 26 MB)
   - Validar formato (extensión en whitelist)

3. **Campo "Nombre de descarga (opcional)":**
   - Texto: "Manual_de_uso.pdf"
   - Si no se proporciona, usar el nombre de la URL original
   - Si la URL es https://example.com/s3_ak3j4.pdf, generar nombre más legible

4. **Descripción (opcional):**
   - Campo de texto: "Descarga nuestro manual completo"

5. **Información:**
   - Mostrar tamaño del archivo (si es posible obtenerlo)
   - Mostrar tipo de archivo (PDF, Word, Excel, etc.)

### Validación de archivo

**Whitelist de extensiones permitidas:**

```
Documentos: pdf, doc, docx, txt, xls, xlsx, csv, ppt, pptx
Comprimidos: zip, rar, 7z
Otros: json, xml, sql
```

**Validaciones:**
1. Tamaño < 26 MB (lado del cliente)
2. Extensión en whitelist
3. Si es URL: HEAD request para verificar tamaño real
4. Mostrar información detallada antes de guardar

### Subida de archivo

El endpoint `/api/upload` actual está configurado para images. Necesitaría expandirse.

**Cambio en multer (app.js):**

```javascript
const ALLOWED_EXTENSIONS = {
  document: ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.csv', '.ppt', '.pptx'],
  archive: ['.zip', '.rar', '.7z'],
  data: ['.json', '.xml', '.sql']
};

const ALLOWED_MIME_TYPES = {
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ],
  archive: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
  data: ['application/json', 'application/xml', 'application/sql']
};
```

### Estado global

```javascript
const nodeFileState = {};
// {
//   nodeId: {
//     file_url: 'https://...',
//     filename: 'Manual_de_uso.pdf',
//     caption: 'Descarga nuestro manual'
//   }
// }
```

### Serialización

```javascript
else if (node.name === 'file') {
  steps.push({
    type: 'file',
    file_url: nodeFileState[currentId].file_url,
    filename: nodeFileState[currentId].filename,
    caption: nodeFileState[currentId].caption
  });
  currentId = node.outputs.output_1?.connections[0]?.node;
}
```

---

## Impacto en experiencia del usuario

### Para el operador

**Flujo 1: URL externa**
1. Archivo subido a Google Drive, Dropbox, o CDN
2. Copiar URL del archivo
3. Agregar nodo "Archivo"
4. Pegar URL
5. Proporcionar nombre de descarga amigable
6. Guardar flujo

**Flujo 2: Subir al servidor**
1. Agregar nodo "Archivo"
2. Click en "Subir archivo"
3. Seleccionar archivo (PDF, Word, Excel, etc.)
4. Validación de tamaño (< 26 MB)
5. Subida al servidor, obtiene URL
6. Nombre de descarga se auto-rellena
7. Guardar flujo

### Para el usuario final (Instagram)

**Antes:**
- Recibe link de texto: "Descarga el manual aquí" (tiene que copiar URL en navegador)

**Después:**
- Recibe un archivo descargable directamente en Instagram
- Toca para descargar
- Se abre con su app de documentos predeterminada

---

## Casos de uso principales

1. **Factura/recibo:** "Tu factura está lista" → PDF descargable
2. **Manual de usuario:** "Guía de instalación" → PDF
3. **Certificado:** "Tu certificado de compra" → PDF o imagen
4. **Catálogo:** "Catálogo completo de 2024" → PDF o Excel
5. **Términos y condiciones:** "Términos de uso" → PDF
6. **Contrato:** "Acuerdo de servicio" → PDF
7. **Receta:** "Receta de la semana" → PDF
8. **Presentación:** "Propuesta comercial" → PPTX o PDF

---

## Validaciones en el builder

**Para URL externa:**
1. HEAD request a la URL
2. Verificar existencia del archivo
3. Verificar tamaño <= 26 MB
4. Verificar que Content-Type coincida con la extensión (ej: `application/pdf` para `.pdf`)
5. Generar nombre legible si no se proporciona

**Para subida:**
1. Validar tamaño pre-subida (lado del cliente)
2. Validar extensión (en whitelist)
3. Mostrar barra de progreso
4. Validar de nuevo post-subida (tamaño real)
5. Si falla: mostrar error específico

**Información mostrada:**
- Tipo de archivo (icono + nombre: "PDF Document", "Word Document", etc.)
- Tamaño (ej: "2.5 MB")
- Nombre de descarga (editable)

---

## Consideraciones de seguridad

### Validación estricta

Es crítico validar que solo se permiten ciertos tipos de archivo. Un atacante podría:
1. Intentar subir un `.exe` disfrazado de `.pdf`
2. Intentar subir un `.html` con malware
3. Intentar acceder a archivos locales del servidor

**Protecciones:**
1. Whitelist de extensiones (no blacklist)
2. Validación de MIME type (Content-Type)
3. Guardar archivos en directorio separado, no ejecutable (ej: `/uploads/files/`, no `/uploads/scripts/`)
4. Cambiar nombre de archivo al guardar (randomizar) para evitar path traversal

### Límite de almacenamiento

26 MB por archivo × múltiples flujos = puede crecer rápidamente el almacenamiento.

**Recomendación:** Implementar límite de espacio total (ej: máximo 500 MB por cuenta) o usar storage externo (AWS S3, Google Cloud Storage).

---

## Checklist de implementación

- [ ] **Backend:** Crear función `sendFile(senderId, fileUrl, filename)`
- [ ] **Backend:** Validar URL y metadata de archivo
- [ ] **Backend:** Crear whitelist de extensiones y MIME types permitidos
- [ ] **Backend:** Agregar branch en `processFlowSteps()` para `type: 'file'`
- [ ] **Backend:** Expandir multer para soportar archivos (permitir extensiones, tipos)
- [ ] **Backend:** Cambiar nombre de archivos al guardar (seguridad)
- [ ] **Frontend:** Crear nodo visual "Archivo"
- [ ] **Frontend:** Crear `nodeFileState` global
- [ ] **Frontend:** Panel inspector con URL, filename, caption
- [ ] **Frontend:** Validación de URL y subida de archivo
- [ ] **Frontend:** Mostrar información del archivo (tipo, tamaño)
- [ ] **Frontend:** Serialización en `buildStepsFromNode()`
- [ ] **Testing:** Descargar archivos reales desde Instagram
- [ ] **Security:** Implementar validación de MIME type strict
- [ ] **Documentation:** Documentar extensiones permitidas y límite de tamaño

---

## Evoluciones futuras

1. **Archivos dinámicos:** Generar PDF en tiempo real (ej: factura con datos del cliente)
2. **Firmas digitales:** Incluir firma digital en PDFs
3. **Control de descarga:** Limitar número de descargas o expiración del link
4. **Análisis:** Medir cuántos usuarios descargaron el archivo
5. **Versionado:** Mantener versiones anteriores de documentos
