# 🚀 Deployment: Activar Bot Vendedor Genius v2

> Cómo cambiar del app.js viejo al app-v2.js refactorizado, paso a paso.

---

## ⚠️ ANTES DE EMPEZAR

- **Backup:** guarda app.js actual como `app-legacy.js`
- **Base de datos:** Supabase debe tener las migraciones ejecutadas (001, 002, 003)
- **Credenciales:** .env.local debe tener tokens Meta y Supabase
- **WhatsApp:** número de Faroles debe estar listo (`https://wa.me/+57XXXXXXXXXXXX`)

---

## PASO 1: Renombrar Archivos

```bash
# En C:\Users\elamd\Desktop\CMR Faroles\

mv app.js app-legacy.js
mv app-v2.js app.js
```

O en PowerShell:
```powershell
Rename-Item app.js app-legacy.js
Rename-Item app-v2.js app.js
```

---

## PASO 2: Actualizar package.json

Verificar que exista `ai_copilot.js` con la función `classifyIntent` exportada:

```javascript
module.exports = { classifyIntent, ... };
```

Si no existe, asegúrate que tienes:
```bash
npm install @google/generative-ai
```

---

## PASO 3: Probar Localmente

```bash
npm start
```

Debería ver:
```
✅ Conectado a Supabase: https://xxx.supabase.co
✅ Cliente admin para RLS
✅ Credenciales Meta inicializadas
🚀 Faroles Genius v2 escuchando en puerto 5000
📡 Webhook: https://crm.falolesgenius.com/webhook
✅ Listo para recibir eventos de Meta
```

---

## PASO 4: Probar Webhook Verification

```bash
curl -X GET "http://localhost:5000/webhook?hub.mode=subscribe&hub.verify_token=faroles_crm_2026&hub.challenge=TEST_CHALLENGE"
```

Debería retornar: `TEST_CHALLENGE`

---

## PASO 5: Simular Evento (Local)

```bash
curl -X POST http://localhost:5000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "instagram",
    "entry": [{
      "messaging": [{
        "sender": { "id": "12345" },
        "message": { "text": "Hola" }
      }]
    }]
  }'
```

Debería ver en logs:
```
📨 Webhook POST recibido
📥 Evento: 12345
   Texto: "Hola" | Payload: "" | Referral: null
   Perfil: null | Etapa: start
   Disparador: fast_path → welcome
📤 Enviando a 12345...
✅ Mensaje enviado...
```

---

## PASO 6: Reemplazar en Hostinger

1. **SSH a Hostinger:**
   ```bash
   ssh user@crm.falolesgenius.com
   cd ~/www/CMR_Faroles
   ```

2. **Backup de seguridad:**
   ```bash
   cp app.js app-legacy-$(date +%s).js
   ```

3. **Descargar app-v2.js local:**
   - Transfiere `app-v2.js` vía SFTP a Hostinger
   - O copia el contenido y haz `nano app-v2.js` + paste

4. **Reemplazar:**
   ```bash
   mv app-v2.js app.js
   ```

5. **Reiniciar Node (Hostinger):**
   - Si usas PM2: `pm2 restart app`
   - Si usas systemd: `systemctl restart faroles-bot`
   - Si manual: mata el proceso y `npm start` de nuevo

---

## PASO 7: Verificar en Producción

Endpoint de salud (si lo añadimos):
```bash
curl https://crm.falolesgenius.com/
```

Debería retornar:
```json
{ "status": "Faroles Genius Bot v2 running" }
```

---

## PASO 8: Probar con Cliente Real

1. **En una cuenta de Instagram diferente**, envía DM a la página de Faroles
2. **Texto:** "Hola, cuánto cuesta?"
3. **Esperado:**
   - Bot responde en < 2 segundos
   - Pregunta ciudad
   - Luego iglesia
   - Luego intención (consumidor/vendedor)

---

## 🔧 Solución de Problemas

### ❌ "Error: classifyIntent is not a function"
**Solución:** Verifica que `ai_copilot.js` existe y exporta `classifyIntent`.

### ❌ "Cannot find module '@supabase/supabase-js'"
**Solución:** 
```bash
npm install @supabase/supabase-js
```

### ❌ "Meta API error: Invalid OAuth access token"
**Solución:**
- Copia un token NUEVO de Meta Developers
- Actualiza .env.local en Hostinger
- Reinicia: `pm2 restart app`

### ❌ "No responde en IG DM"
**Solución:**
- Verifica webhook en Meta Developers (Settings → Webhooks)
- Confirma que la página está suscrita a `messages` evento
- Revisa logs de Hostinger (Error Logs)

### ❌ "Pregunta iglesia pero debería ir directo"
**Solución:** Es normal. El flujo pregunta siempre (perfila completo).
Si quieres saltar, edita `startProfiling()` y agrega lógica de fast-path.

---

## 📊 Monitoreo Post-Deploy

### Logs importantes

En Hostinger, revisar **Error Logs** cada 1h:
```
✅ Buscamos: "Mensaje enviado"
❌ Evitar: "RLS policy violation", "Invalid OAuth token", "PGRST"
```

### Métricas a registrar (diarias)

- Total de contactos nuevos (contacts table)
- Perfiles detectados (consumer / seller / church)
- Tasa de escalada a WhatsApp (conversation_stage='cerrado')
- Reactivaciones enviadas (logs de verificación)

---

## 🚨 Rollback de Emergencia

Si algo sale mal:

```bash
# En Hostinger:
cp app-legacy-*.js app.js
pm2 restart app
```

El bot anterior seguirá funcionando (aunque sin las mejoras v2).

---

## ✅ Checklist Final

- [ ] Backup de app.js viejo
- [ ] app-v2.js probado localmente
- [ ] Todas las tablas Supabase creadas (migraciones)
- [ ] .env.local con tokens META válidos
- [ ] Número WhatsApp actualizado en app-v2.js (línea con `wa.me/...`)
- [ ] Webhook URL verificado en Meta Developers
- [ ] Evento de prueba procesa sin errores
- [ ] Cliente real recibe respuesta en < 3 segundos
- [ ] Logs de Hostinger sin "RLS policy" errors
- [ ] Reactivación a 23h funciona (verificado mañana)

---

**Status:** 🟢 Listo para deploy  
**Tiempo estimado:** 10 minutos  
**Riesgo:** Bajo (rollback fácil)

**Próximo:** Integración de CAPI (Facebook Conversions API) para atribución en Ads Manager.
