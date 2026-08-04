# 🔐 Flujo OAuth - Conectar Instagram Directamente

**¡SÍ! Ya está implementado.** No necesitas configurar tokens manualmente en `.env`.

---

## 📊 DOS FORMAS DE CONECTARSE

### **Opción 1: Manual (Actual - Configuración complicada)**
```
Usuario → Configura .env
        → Ingresa PAGE_ACCESS_TOKEN
        → Ingresa VERIFY_TOKEN
        → Ingresa API_SECRET
        → Reinicia servidor
        ✓ Funciona
```

### **Opción 2: OAuth (Recomendado - Más fácil)** ✨
```
Usuario → Hace clic "Conectar Instagram"
        → Abre ventana de login de Facebook
        → Autoriza la app
        → Facebook redirige con código
        → App intercambia código por token
        → ✓ Automático - No necesita .env
```

---

## 🔄 CÓMO FUNCIONA EL FLUJO OAUTH

```
┌──────────────────────────────────────────────────────────────┐
│  USUARIO HACE CLIC EN "Conectar Instagram"                   │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│  /auth/instagram                                              │
│  ├─ Construye Facebook OAuth URL                            │
│  ├─ Pide permisos: instagram_basic, manage_messages, etc    │
│  └─ Redirige a https://facebook.com/v21.0/dialog/oauth     │
└──────────────────────────────────────────────────────────────┘
                           ↓
                  [Facebook Login & Auth]
                           ↓
┌──────────────────────────────────────────────────────────────┐
│  /auth/callback (con código de autorización)                │
│  ├─ Intercambia código por SHORT LIVED TOKEN               │
│  ├─ Intercambia por LONG LIVED TOKEN (60 días)            │
│  ├─ Obtiene lista de páginas de Facebook                   │
│  ├─ Extrae Instagram Business Account ID                   │
│  ├─ Guarda en Supabase (app_config table)                 │
│  └─ Actualiza state.ACCESS_TOKEN                          │
└──────────────────────────────────────────────────────────────┘
                           ↓
              ✅ "Conexión Exitosa"
              (ventana se cierra automáticamente)
                           ↓
                    Monitor recibe mensajes
```

---

## ✅ REQUISITOS PARA OAUTH

### **1. Meta App Configurada**
```
Facebook Developers → Mi Apps → Crear App
  └─ Tipo: Social Commerce (Instagram)
  └─ Nombre: CRM 2.0 (o tu nombre)
  └─ Correo: tu-email@example.com
```

### **2. Instagram Setup**
```
Meta App → Settings → Basic
  ├─ APP_ID: xxxxxxxxxxxxxxx
  └─ APP_SECRET: xxxxxxxxxxxxxxx

Meta App → Instagram → Configuración
  ├─ Webhook URL: https://tudominio.com/webhook
  └─ Verify Token: tu_verify_token_aqui
```

### **3. Variables en .env**
```env
# REQUERIDO SOLO PARA OAUTH:
META_APP_ID=xxxxxxxxxxxxxxx
META_APP_SECRET=xxxxxxxxxxxxxxx
META_REDIRECT_URI=https://tudominio.com/auth/callback

# Opcionales (se auto-completan vía OAuth):
# PAGE_ACCESS_TOKEN=  ← Se obtiene vía OAuth
# INSTAGRAM_ACCOUNT_ID=  ← Se obtiene vía OAuth
# VERIFY_TOKEN=  ← Se puede usar si lo quieres pre-configurado
# API_SECRET=  ← Genéra uno aleatorio
```

---

## 🚀 PASOS PARA HABILITAR OAUTH

### **Paso 1: Crear Meta App**
```
1. Ir a https://developers.facebook.com/
2. Mi Apps → Crear App
3. Tipo: Social Commerce
4. Nombre: CRM 2.0
5. Copiar APP_ID y APP_SECRET
```

### **Paso 2: Configurar Webhook**
```
Meta App → Instagram → Configuración
  Webhook URL: https://tudominio.com/webhook
  Verify Token: tu_token_cualquiera
  Subscribe Fields: messages, comments, mentions
```

### **Paso 3: Actualizar .env**
```env
META_APP_ID=tu_app_id_aqui
META_APP_SECRET=tu_app_secret_aqui
META_REDIRECT_URI=https://tudominio.com/auth/callback
API_SECRET=cualquier_string_aleatorio
VERIFY_TOKEN=tu_verify_token
```

### **Paso 4: Reiniciar servidor**
```bash
npm start
```

### **Paso 5: Hacer clic en botón**
```
Ir a http://localhost:3000
Hacer clic en "Conectar Instagram"
Autorizar la app
¡Listo!
```

---

## 🎯 COMPARACIÓN: MANUAL vs OAUTH

| Aspecto | Manual (.env) | OAuth |
|---------|---------------|-------|
| **Complejidad** | ⭐⭐⭐⭐⭐ (Muy difícil) | ⭐⭐ (Fácil) |
| **Seguridad** | Riesgosa (tokens en .env) | ✅ Segura (OAuth 2.0) |
| **Renovación** | Manual | Automática (60 días) |
| **UX** | Copiar/pegar en config | 1 clic + login |
| **Setup Time** | 30+ minutos | 5 minutos |
| **Para producción** | ❌ No recomendado | ✅ Recomendado |

---

## 📋 CÓDIGO DEL FLUJO OAUTH

### **Endpoint 1: /auth/instagram**
```javascript
app.get('/auth/instagram', (req, res) => {
  const redirectUri = process.env.META_REDIRECT_URI || `${req.protocol}://${host}/auth/callback`;
  res.redirect(`https://www.facebook.com/v21.0/dialog/oauth?client_id=${process.env.META_APP_ID}&...`);
});
```

### **Endpoint 2: /auth/callback**
```javascript
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  
  // 1. Intercambiar código por SHORT TOKEN
  const tokenRes = await axios.get(`https://graph.facebook.com/v21.0/oauth/access_token?...code=${code}`);
  let userToken = tokenRes.data.access_token;
  
  // 2. Intercambiar por LONG TOKEN (60 días)
  const longRes = await axios.get(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&...`);
  if (longRes.data?.access_token) userToken = longRes.data.access_token;
  
  // 3. Obtener páginas de Facebook
  const pagesRes = await axios.get(`https://graph.facebook.com/v21.0/me/accounts?...access_token=${userToken}`);
  
  // 4. Encontrar cuenta Instagram
  const page = pagesRes.data.data.find(p => p.instagram_business_account);
  const igAccountId = page.instagram_business_account?.id;
  
  // 5. Guardar en Supabase
  await supabase.from('app_config').upsert({
    key: 'INSTAGRAM_ACCESS_TOKEN',
    value: userToken
  });
  
  // 6. ✅ Listo
  res.send('<h1>✅ Conexión Exitosa</h1>');
});
```

---

## 🔍 VERIFICAR QUE FUNCIONA

```bash
# 1. Verificar que OAuth está habilitado
curl http://localhost:3000/auth/instagram

# 2. Verificar estado de conexión
curl http://localhost:3000/api/auth/status

# Respuesta si está conectado:
# {"connected": true}

# 3. Verificar que Monitor recibe mensajes
# Abre http://localhost:3000
# Deberías ver: 🟢 CONECTADO Y FUNCIONANDO
```

---

## ⚠️ PROBLEMAS COMUNES

| Problema | Causa | Solución |
|----------|-------|----------|
| "Error: APP_ID no configurado" | `META_APP_ID` falta en .env | Agregar `META_APP_ID` en .env |
| "Error: Invalid redirect URI" | Redirect URI no matches | Verificar exactamente en Meta App settings |
| "Error: Code expired" | Código de OAuth caducó | Reintentar login (códigos duran ~10 min) |
| "Conexión Exitosa pero Monitor vacío" | Falta VERIFY_TOKEN para webhook | Configurar VERIFY_TOKEN en .env + Meta App |

---

## 🎯 RESUMEN

**Tienes DOS opciones:**

1. **Manual**: Configurar .env manualmente (complicado, riesgo de seguridad)
2. **OAuth** (recomendado): Hacer clic en botón, autorizar en Facebook (2 minutos)

**Para usar OAuth:**
- Crear Meta App en Facebook Developers
- Copiar APP_ID y APP_SECRET
- Poner en .env + META_REDIRECT_URI
- ¡Listo! El botón funcionará

**Para recibir webhooks después:**
- Aún necesitas VERIFY_TOKEN en .env
- Webhook URL configurado en Meta App
- Entonces el Monitor recibe mensajes en tiempo real

---

## 🚀 PRÓXIMOS PASOS

1. ¿Tienes Meta App configurada?
2. ¿Tienes APP_ID y APP_SECRET?
3. Si no: Crear Meta App en Facebook Developers (5 min)
4. Si sí: Agregar a .env y reiniciar
5. Probar botón "Conectar Instagram"

**¿Necesitas ayuda con Meta App?** Puedo guiarte paso a paso. 🎯
