# 🔍 DIAGNÓSTICO: Webhook no recibe mensajes

**Síntomas:**
- ✅ Indicador 🟢 Verde (conectado)
- ✅ OAuth funcionando
- ❌ Monitor NO recibe mensajes
- ❌ Webhook no verifica eventos

---

## 📊 PUNTOS DE FALLA

### **1. VERIFY_TOKEN no coincide** 🔴 MÁS COMÚN
```
Meta App Settings → Webhook
  ├─ Verify Token en Meta: "my_verify_token_123"
  └─ VERIFY_TOKEN en .env: "diferente_token"
  
Result: Webhook rechazado ❌
```

### **2. Webhook URL incorrecta** 🔴
```
Meta App → Webhook URL:
  ❌ http://localhost:3000/webhook (local no funciona)
  ✅ https://tudominio.com/webhook (debe ser HTTPS)
  ❌ https://tudominio.com:3000/webhook (puerto innecesario)
```

### **3. Webhook no está activo en Meta** 🔴
```
Meta App → Instagram → Webhook Settings
  ├─ Status: Active? (debe estar activado)
  ├─ Subscribed Fields: messages, comments, etc?
  └─ Test Webhook: ¿Pasó la prueba?
```

### **4. Webhook endpoint no responde** 🔴
```
Meta envía: POST /webhook
App responde: ¿200 OK en < 20 segundos?

Si no → Meta desactiva el webhook automáticamente
```

---

## 🧪 PRUEBAS DE DIAGNÓSTICO

### **Test 1: Webhook Verification Manual**
```bash
curl -X GET "http://tudominio.com/webhook?hub.mode=subscribe&hub.verify_token=TU_VERIFY_TOKEN&hub.challenge=test_challenge_123"

✅ Respuesta esperada: test_challenge_123
❌ Respuesta: error → VERIFY_TOKEN incorrecto
```

### **Test 2: Check Webhook en Meta App**
```
Facebook Developers → App Settings → Webhook
  1. ¿Está el Webhook URL listado?
  2. ¿Status = Active?
  3. ¿Last attempt = Success?
  4. Haz clic en "Test Webhook"
     ✅ Debe pasar la verificación
```

### **Test 3: Simular evento POST**
```bash
curl -X POST http://tudominio.com/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "instagram",
    "entry": [{
      "messaging": [{
        "sender": {"id": "123", "name": "Test User"},
        "message": {"text": "Mensaje de prueba"}
      }]
    }]
  }'

✅ Respuesta: 200 OK
```

### **Test 4: Revisar Logs del Servidor**
```bash
# Ver logs en tiempo real
tail -f /path/to/logs/server.log

# Buscar errores de webhook
grep -i "webhook\|verification" /path/to/logs/server.log

# ¿Ves líneas como estas?
# ✅ "Webhook verificado por Meta"
# ✅ "[DM] Mensaje recibido"
# ❌ "Verificación fallida — token incorrecto"
```

---

## 🔧 CHECKLIST DE SOLUCIÓN

### **Paso 1: Verificar VERIFY_TOKEN**
```bash
# En tu hosting, verifica:
echo $VERIFY_TOKEN
# Debe mostrar algo como: my_verify_token_xyz

# Luego verifica en Meta App:
# Facebook Developers → App → Settings → Webhook
# Verify Token debe ser EXACTAMENTE igual
```

### **Paso 2: Verificar Webhook URL**
```bash
Meta App Webhook URL debe ser:
  https://tudominio.com/webhook
  
NO:
  ❌ http://tudominio.com/webhook (debe ser HTTPS)
  ❌ https://tudominio.com:3000/webhook (sin puerto)
  ❌ https://localhost:3000/webhook (debe ser dominio real)
```

### **Paso 3: Activar Webhook en Meta**
```
Facebook Developers → My Apps → Tu App
  → Settings → Webhooks
    ├─ Active? ✅ Sí
    ├─ Test? ✅ Pasó
    ├─ Subscribed Fields:
    │  ✅ messages
    │  ✅ comments
    │  ✅ mentions
    └─ Instagram? ✅ Sí
```

### **Paso 4: Verificar Endpoint**
```javascript
// En app.js línea 128
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);  // ✅ Correcto
  }
  res.sendStatus(403);  // ❌ Si llega aquí = token incorrecto
});
```

---

## 🎯 PROBLEMAS MÁS COMUNES

| Problema | Síntoma | Solución |
|----------|---------|----------|
| **VERIFY_TOKEN incorrecto** | "Verificación fallida" en logs | Comparar token en .env vs Meta App |
| **Webhook URL no HTTPS** | Meta rechaza URL | Usar HTTPS + dominio válido |
| **Webhook no activo** | No llega ningún evento | Activar en Meta App Settings |
| **app.js no reiniciado** | Cambios en .env no aplican | `npm restart` o redeploy |
| **Webhook no subscrito** | No recibe del tipo correcto | Verificar "Subscribed Fields" en Meta |

---

## 💡 CÓMO VERIFICAR RÁPIDO

### **En tu servidor de hosting, ejecuta:**

```bash
# 1. Ver VERIFY_TOKEN actual
grep VERIFY_TOKEN .env

# 2. Prueba manual de verificación
curl -X GET "https://tudominio.com/webhook?hub.mode=subscribe&hub.verify_token=$(grep VERIFY_TOKEN .env | cut -d= -f2)&hub.challenge=test123"

# Respuesta esperada: test123
# Si falla: el token en .env no coincide con Meta

# 3. Ver logs del servidor
tail -50 logs/server.log | grep -i webhook

# 4. Reiniciar servidor (si es necesario)
npm restart
# o redeploy en tu hosting
```

---

## 🚨 SI NADA FUNCIONA

1. **Abre Meta App Dashboard:**
   - Facebook Developers → Tu App
   - Webhooks → Recent Deliveries
   - ¿Ves intentos de entrega?
     - ✅ SÍ: El webhook recibe eventos pero algo falla en el procesamiento
     - ❌ NO: El webhook no está registrado correctamente

2. **Si ves "Recent Deliveries":**
   - Haz clic en uno
   - ¿Status = Success (200)?
     - ✅ SÍ: El webhook responde, pero el procesamiento falla
     - ❌ NO: El webhook rechaza la solicitud

3. **Si recibe pero no procesa:**
   - Revisa `app.js` línea 150-205 (webhook POST handler)
   - ¿Se procesan los eventos?
   - ¿Llama a `broadcastLog()`?

---

## 📋 RESUMEN

**Para que funcione necesitas:**
1. ✅ OAuth configurado (ya tienes esto)
2. ✅ VERIFY_TOKEN en .env = VERIFY_TOKEN en Meta App
3. ✅ Webhook URL = https://tudominio.com/webhook
4. ✅ Webhook ACTIVO en Meta App
5. ✅ Subscribed Fields incluya "messages"
6. ✅ app.js reiniciado con cambios en .env

**¿Cuál de estos NO tienes?** Empieza por ahí.

