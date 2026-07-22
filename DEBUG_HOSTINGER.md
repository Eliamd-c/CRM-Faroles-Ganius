# 🔧 Debugging Hostinger 503 Error

## ❌ Problema
crm.falolesgenius.com retorna 503 Service Unavailable

## ✅ Soluciones a Intentar (en orden)

### 1️⃣ Verificar Logs del Servidor
En Hostinger Panel → Files/Logs:
- Busca archivos de error en `/var/www/logs/`
- O en el panel de Hostinger: **Error Logs**
- Mira si hay errores de Node.js

```
Error típicos:
- "EADDRINUSE: port already in use"
- "Cannot find module..."
- "SUPABASE_URL not found"
```

### 2️⃣ Configurar Port Correctamente
En Hostinger, Node.js probablemente **NO corre en puerto 5000**.

**Solución:**
1. En Variables de Entorno, busca si hay un puerto asignado por Hostinger
2. Modifica `app.js` línea ~750:

```javascript
const PORT = process.env.PORT || 3000;  // Cambiar 5000 → 3000
app.listen(PORT, () => {
  console.log(`🚀 Corriendo en puerto ${PORT}`);
});
```

3. Push a GitHub
4. Redeploy en Hostinger

### 3️⃣ Verificar Archivo .env en Hostinger
**Importante:** Hostinger usa **Variables de Entorno** en el panel, NO archivos `.env`

✅ YA HECHO: Agregaste variables en el panel

**Pero verifica:**
- ¿Las variables tienen valores reales (no vacías)?
- ¿NEXT_PUBLIC_SUPABASE_URL comienza con "https://"?
- ¿SUPABASE_SERVICE_ROLE_KEY es la KEY completa (no truncada)?

Si alguna está vacía o incompleta → Edita y guarda nuevamente

### 4️⃣ Reiniciar la Aplicación
En Hostinger Panel:
1. Busca "Aplicaciones" o "Node.js Applications"
2. Encuentra "crm.falolesgenius.com"
3. Click en "Restart" o "Stop & Start"

### 5️⃣ Ver Logs en Tiempo Real
Si Hostinger lo permite:
1. Panel → Logs → Server Logs (tail -f)
2. Intenta acceder al dominio
3. Mira qué error aparece

### 6️⃣ Proxy Inverso (si Node.js no responde)
A veces Hostinger necesita que Node responda en localhost:

**Opción A:** Usa puerto que Hostinger asigna automáticamente
**Opción B:** Configura proxy inverso en Nginx

En Hostinger busca:
- Advanced → Nginx/Apache Configuration
- O solicita soporte para ayudarte

---

## 🧪 Test Local vs Producción

**Local (localhost:5000):** ✅ FUNCIONA
```bash
curl http://localhost:5000/api/meta/status
→ {"configured":true, ...}
```

**Producción (Hostinger):** ❌ 503
```bash
curl https://crm.falolesgenius.com
→ 503 Service Unavailable
```

---

## 📞 Si Nada Funciona

### Contactar Hostinger Support
Proporciona:
1. URL: crm.falolesgenius.com
2. Error: 503 Service Unavailable
3. Pregunta: "¿Cuál es el puerto recomendado para Node.js?"
4. Pregunta: "¿Cómo veo los error logs?"

### Código Funcional Probado
Todo el código está probado y funciona en:
- localhost:5000 ✅
- Git commit: c0f5205 ✅

---

## 🚨 Quick Fix Checklist

- [ ] Revisar logs de error en Hostinger
- [ ] Cambiar PORT de 5000 → (puerto que asigne Hostinger)
- [ ] Verificar que variables de entorno no estén vacías
- [ ] Restart la aplicación en Hostinger
- [ ] Esperar 2-5 minutos después de restart
- [ ] Si aún falla → Contactar Hostinger support

---

**Última actualización:** 2026-07-22
**Servidor Local Status:** ✅ WORKING
**Hosting Status:** ⏳ DEBUGGING
