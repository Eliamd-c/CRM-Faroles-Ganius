# 🚀 CONFIGURACIÓN PRODUCCIÓN: Meta Webhook Real

**Estado:** Listo para conectar a Instagram Business Account

---

## 📋 Datos de Tu Servidor (Hostinger)

```
Webhook URL:     https://crm.falolesgenius.com/webhook
Verify Token:    faroles_crm_2026
```

---

## 🔧 PASOS EN META DEVELOPERS (Ejecuta Ahora)

### 1️⃣ Ir a Meta Developers
```
https://developers.facebook.com/apps/
```

### 2️⃣ Selecciona tu App
- Click en tu app de Faroles Genius

### 3️⃣ Configura el Webhook
**Messenger → Settings → Webhooks**

1. Click **Edit**
2. Completa:
   - **Callback URL:** `https://crm.falolesgenius.com/webhook`
   - **Verify Token:** `faroles_crm_2026`
3. Click **Verify and Save**

### 4️⃣ Suscribete a Eventos
**Debajo de "Webhooks", en "Webhook Fields":**

Marca estas opciones:
- ✅ `messages` ← CRÍTICO
- ✅ `messaging_postbacks` ← CRÍTICO  
- ✅ `comments` ← Para Fase 3
- ✅ `message_reads` ← Opcional

Click **Save**

### 5️⃣ Página de Suscripción
**Messenger → Settings → Page Subscription**

1. En "Webhook Fields", verifica que tu página (Instagram Business) esté suscrita
2. Si no aparece:
   - Click **Add or Remove Pages**
   - Selecciona tu página de Instagram
   - Marca los eventos (messages, postbacks, comments)
   - Click **Save**

### 6️⃣ Page Access Token
**Messenger → Settings**
1. Busca **Page Access Token**
2. Copia el token
3. Verifica que está en Hostinger: `META_PAGE_ACCESS_TOKEN`

---

## ✅ VERIFICACIÓN (Después de Configurar Meta)

### Test 1: Webhook Verification
```bash
curl -X GET "https://crm.falolesgenius.com/webhook?hub.mode=subscribe&hub.verify_token=faroles_crm_2026&hub.challenge=CHALLENGE_ACCEPTED"
```

Debería retornar: `CHALLENGE_ACCEPTED`

### Test 2: Enviar DM de Prueba
1. **Desde otra cuenta de Instagram** (o Business Account test)
2. Envía un DM a tu Instagram Business
3. **Resultado esperado:**
   - Bot responde automáticamente en 1-3 segundos
   - Sigue flujo Fase 1 (bienvenida + precios)

### Test 3: Revisar Logs
En Hostinger → Error Logs o Console:
```
📨 Webhook recibido: {...}
🤖 Procesando: "Hola"
⚡ Disparador: FAST-PATH
📤 Enviando mensaje a Meta...
```

---

## 🎯 Flujo Esperado (Producción)

```
Cliente → Envía DM "Hola, cuánto cuesta?"
   ↓
Meta API → Envía webhook a crm.falolesgenius.com/webhook
   ↓
Servidor → Recibe evento
   ↓
Fase 2 (Disparadores):
   - Detecta "cuánto cuesta" (fast-path)
   - Sin llamar a IA (más rápido)
   ↓
Bot responde con precios automáticamente
   ↓
Cliente recibe respuesta en IG DM en <3 segundos
```

---

## ⚠️ PROBLEMAS COMUNES

### ❌ "Invalid OAuth access token"
**Solución:** 
- Copia el Page Access Token nuevamente desde Meta
- Actualiza en Hostinger Variables de Entorno
- Espera 2-5 minutos

### ❌ "Webhook verification failed"
**Solución:**
- Verifica URL: `https://crm.falolesgenius.com/webhook` (sin / al final)
- Verifica token: `faroles_crm_2026` (debe coincidir exactamente)
- Que el servidor esté corriendo en Hostinger

### ❌ No recibe mensajes
**Solución:**
- ¿Página está suscrita a `messages` evento?
- ¿Page Access Token es válido?
- Revisar logs de Hostinger

---

## 📝 Checklist de Producción

- [ ] Webhook URL configurado en Meta: `https://crm.falolesgenius.com/webhook`
- [ ] Verify Token: `faroles_crm_2026`
- [ ] Eventos suscritos: `messages`, `postbacks`, `comments`
- [ ] Page Access Token en Hostinger
- [ ] Webhook verification pasó (retorna CHALLENGE_ACCEPTED)
- [ ] Enviaste DM de prueba y recibiste respuesta
- [ ] Logs muestran procesamiento correcto
- [ ] Bot responde en <3 segundos

---

## 🚀 Una vez todo funciona:

**Ya tienes operativo:**
- ✅ Fase 1: Sales funnel automático
- ✅ Fase 2: Smart dispatchers (fast-path + IA)
- ⏳ Fase 3: Próximo (Comment-to-DM + Smart Delays)

---

**Última actualización:** 2026-07-22  
**Status:** 🟢 Ready to Deploy  
**Commit:** 263b756 (Supabase 2.39.0 compatible)

