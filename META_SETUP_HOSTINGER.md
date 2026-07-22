# 🔧 Configuración de Meta en Hostinger

## Cómo agregar credenciales de Meta API en Hostinger

### 1️⃣ Obtener las Credenciales de Meta

Ve a: **https://developers.facebook.com/apps/**

1. Selecciona tu app (o crea una si no exists)
2. Ve a **Settings → Basic** y copia:
   - **App ID**
   - **App Secret**
3. Ve a **Messenger** y configura tu página de Instagram/Facebook
4. Ve a **Messenger → Settings** y copia:
   - **Page Access Token** ← necesario
   - **Verify Token** ← tú lo creas (cualquier string seguro)

5. Obtén tu **Instagram Account ID**:
   - Ve a tu perfil de Instagram Business
   - En la URL: `instagram.com/accounts/...` o desde la API de Meta

---

### 2️⃣ Agregar Variables de Entorno en Hostinger

En Hostinger (si usas su hosting):

1. **Panel de Control Hostinger** → **Variables de Entorno** (o .env)
2. Agrega estas líneas:

```env
META_PAGE_ACCESS_TOKEN=tu_page_access_token_aqui
META_WEBHOOK_VERIFY_TOKEN=tu_webhook_verify_token_aqui
INSTAGRAM_ACCOUNT_ID=tu_instagram_account_id_aqui
INSTAGRAM_BUSINESS_ACCOUNT_ID=tu_instagram_business_account_id_aqui
```

3. **Guarda los cambios**

---

### 3️⃣ Verificar Configuración

Una vez deployado, el servidor cargará automáticamente estas variables.

**Para verificar:**
```bash
curl http://localhost:5000/api/meta/status
```

Deberías recibir:
```json
{
  "configured": true,
  "page_access_token_set": true,
  "webhook_verify_token_set": true,
  "instagram_account_id_set": true,
  "message": "✅ Meta configurado correctamente"
}
```

---

### 4️⃣ Configurar Webhook en Meta

En Meta Developers:

1. Ve a **Messenger → Settings → Webhooks**
2. Usa esta URL: `https://tudominio.com/webhook`
3. Usa el **Verify Token** que pusiste en `.env.local`
4. Subscribe a: `messages`, `messaging_postbacks`

---

## ⚠️ SEGURIDAD

- ❌ NUNCA commitees `.env.local` a GitHub
- ✅ Usa variables de entorno en el servidor de producción
- ✅ Rota tokens regularmente
- ✅ Usa webhooks con HTTPS solo

---

## 🚀 Resultado

Una vez configurado, la UI no pedirá credenciales cada vez.
Se cargarán automáticamente del servidor al iniciar.

API disponible: `/api/meta/status` (estado de configuración)
