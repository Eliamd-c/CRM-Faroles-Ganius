# 🔍 DIAGNÓSTICO: Monitor no recibe mensajes

**Fecha:** 2026-08-04  
**Basado en:** Node.js Design Patterns - Observer, Adapter, Pipeline

---

## 📊 ARQUITECTURA ACTUAL

```
┌─────────────────────────────────────────────────────────┐
│  FLUJO DE MENSAJES (ACTUAL)                             │
└─────────────────────────────────────────────────────────┘

Instagram DM/Comment
    ↓
Meta Webhook (POST /webhook)
    ↓
Validación de Firma
    ↓
Handlers (webhook.handlers.js)
    ├─ handleMessage()
    ├─ handleComment()
    └─ handleMention()
    ↓
broadcastLog() [Observer Pattern]
    ↓
state.sseClients.forEach() [Broadcast to all]
    ↓
SSE Response (EventSource)
    ↓
Monitor UI (index.html)
    ↓
Display en tiempo real
```

---

## 🔧 PUNTOS DE FALLO (Analysis)

### **1. VERIFICAR WEBHOOK VERIFICATION**

**Línea 128-138 (app.js):**
```javascript
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);  // ✅ Si llega aquí
  }
  res.sendStatus(403);  // ❌ Si falla aquí
});
```

**¿Qué revisar?**
- ¿`VERIFY_TOKEN` matches en Meta App → Settings?
- ¿Webhook URL es correcto? (ej: `https://tudominio.com/webhook`)

---

### **2. VERIFICAR WEBHOOK SIGNATURE**

**Línea 140-149 (app.js):**
```javascript
app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = (process.env.META_APP_SECRET || '').trim();
  
  if (appSecret && signature) {
    const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret)
      .update(req.rawBody)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      console.warn('⚠️ Firma inválida');  // ⚠️ ADVERTENCIA: no bloquea
    }
  }
  res.sendStatus(200);  // ✅ Responde 200 de todas formas
});
```

**Problema Potencial:**
- ⚠️ **NO valida firma** - Acepta cualquier webhook (seguridad débil)
- ¿`META_APP_SECRET` está configurado en `.env`?

---

### **3. VERIFICAR BODY PARSING**

**Línea 150-151 (app.js):**
```javascript
const body = req.body;
if (body.object !== 'instagram') return;  // ❌ Ignora si no es Instagram
```

**Problema Potencial:**
- ¿Está `express.json()` configurado?
- ¿El Content-Type es `application/json`?

---

### **4. VERIFICAR HANDLERS**

**webhook.handlers.js:**
```javascript
async function handleMessage(event) {
  // Procesa DM
  // ¿Llama a broadcastLog()?
}
```

**¿Qué revisar?**
- ¿Handler se ejecuta?
- ¿Llama a `broadcastLog()` correctamente?

---

### **5. VERIFICAR SSE CONNECTION**

**Línea 105-123 (app.js):**
```javascript
app.get('/stream', (req, res) => {
  if (req.query.token !== process.env.API_SECRET) {
    return res.status(403).json({...});  // ❌ Rechaza si token inválido
  }
  
  state.sseClients.push(newClient);  // ✅ Guarda cliente
  res.write(`data: ${JSON.stringify({...})}\n\n`);  // ✅ Envía evento
});
```

**Problema Potencial:**
- ¿`API_SECRET` en localStorage matches `process.env.API_SECRET`?
- ¿Los clientes se conectan al stream?

---

## 🧪 PLAN DE DIAGNÓSTICO

### **PASO 1: Verificar Configuración (.env)**
```bash
✓ PAGE_ACCESS_TOKEN → Instagram
✓ VERIFY_TOKEN → Para webhook verification
✓ META_APP_SECRET → Para firma
✓ API_SECRET → Para SSE authentication
✓ INSTAGRAM_ACCOUNT_ID → Tu cuenta
```

### **PASO 2: Verificar Webhook en Meta Dashboard**
```
Facebook Business Suite → Settings → Webhooks
  ├─ Callback URL → ¿Está correcta?
  ├─ Verify Token → ¿Matches en .env?
  ├─ Subscribed Fields → ¿messages, comments, etc?
  └─ Active → ¿Está activado?
```

### **PASO 3: Test Webhook Verification**
```bash
curl -X GET "http://localhost:3000/webhook?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=YOUR_VERIFY_TOKEN"

Response esperado: test123 (sin JSON)
```

### **PASO 4: Test SSE Connection**
```bash
curl "http://localhost:3000/stream?token=YOUR_API_SECRET"

Response esperado:
data: {"type":"SYSTEM","message":"Conectado al monitor..."}
```

### **PASO 5: Test Webhook POST**
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "instagram",
    "entry": [{
      "messaging": [{
        "sender": {"id": "123"},
        "message": {"text": "Hola"}
      }]
    }]
  }'

Response esperado: 200 OK
```

### **PASO 6: Check Console Logs**
```bash
✓ ¿Aparece "[DM] ..."?
✓ ¿Aparece "[SYSTEM] ..."?
✓ ¿Hay errores en stderr?
```

---

## 🎯 PROBLEMAS COMUNES

| Problema | Síntoma | Solución |
|----------|---------|----------|
| Webhook no verifica | 403 en Meta | Verificar VERIFY_TOKEN en .env vs Meta settings |
| Webhook no recibe POST | No hay logs | Verificar URL en Meta dashboard |
| Mensajes no aparecen | Logs sí pero Monitor vacío | Verificar API_SECRET en localStorage |
| SSE reconecta | Monitor se desconecta | Verificar Network → EventSource status |
| Body no se parsea | `req.body` undefined | Verificar `express.json()` en app.js |

---

## 🏗️ DESIGN PATTERNS USADOS

### **Observer Pattern** ✅
```javascript
// broadcastLog = Observable
state.sseClients.forEach(client => {  // Observers
  client.res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
});
```

### **Adapter Pattern** ⚠️
```javascript
// Instagram API → Internal format
// Adaptación en webhook.handlers.js
// ¿Está correcta la adaptación?
```

### **Pipeline Pattern** 🔄
```javascript
Webhook → Validation → Parsing → Handler → Broadcast
```

---

## 📋 CHECKLIST DE DIAGNÓSTICO

- [ ] ¿VERIFY_TOKEN en .env matches Meta settings?
- [ ] ¿PAGE_ACCESS_TOKEN es válido?
- [ ] ¿Webhook URL es accesible desde internet?
- [ ] ¿Webhook está verificado en Meta dashboard?
- [ ] ¿Subscribed fields incluyen "messages"?
- [ ] ¿API_SECRET es el mismo en localStorage y .env?
- [ ] ¿SSE conexión se establece (Network tab)?
- [ ] ¿Aparecen logs en console del servidor?
- [ ] ¿req.body se parsea correctamente?
- [ ] ¿broadcastLog() se llama?

---

## 🚀 PASOS INMEDIATOS

1. **Abre Browser DevTools** (F12)
   - Tab Network → Busca `/stream`
   - ¿Status 200?
   - ¿EventSource conectado?

2. **Revisa Consola del Servidor**
   ```bash
   npm start
   # ¿Ves "Conectado al monitor..."?
   # ¿Ves "[DM] ..." cuando escribes mensaje?
   ```

3. **Test Webhook POST manual**
   ```bash
   # Desde otra terminal
   curl -X POST http://localhost:3000/webhook \
     -H "Content-Type: application/json" \
     -d '{"object":"instagram","entry":[{"messaging":[{"sender":{"id":"123"},"message":{"text":"test"}}]}]}'
   ```

4. **Verifica Meta Webhook Logs**
   - Meta App → Webhooks → Recent Deliveries
   - ¿Se envían eventos?
   - ¿Qué status code retorna?

---

**¿PRÓXIMO PASO?** Ejecuta los tests y comparte los resultados del diagnóstico.

