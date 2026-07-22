# Setup Supabase para CMR Faroles

## 1. Ejecutar Schema SQL

1. Ve a tu proyecto Supabase: https://app.supabase.com
2. Abre **SQL Editor** (lado izquierdo)
3. Clickea **"New Query"**
4. **Abre el archivo** `migrations/001_create_schema.sql`
5. **Copia TODO el contenido** y pégalo en el editor
6. Clickea **"Run"** (esquina superior derecha)
7. Espera a que termine (debe decir "Success")

### ¿Qué creó?
- ✅ 11 tablas (contacts, messages, conversations, flows, ai_triggers, agents, activity_log, etc.)
- ✅ Índices para performance
- ✅ Datos semilla (flows default, auto_responders, ai_triggers)
- ✅ Extensiones UUID

---

## 2. Verificar Creación

En Supabase, ve a **Table Editor** (lado izquierdo):
- Deberías ver todas las tablas listadas
- Si ves `contacts`, `messages`, `conversations` → ¡Success! ✅

---

## 3. Variables de Entorno

Ya creé `.env.local` con:
```
NEXT_PUBLIC_SUPABASE_URL=https://szttmyjzqqbveijzkrjw.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

✅ **NO commitear este archivo** — está en `.gitignore`

---

## 4. Instalar Dependencias

```bash
npm install @supabase/supabase-js
```

---

## 5. Próximos Pasos

Una vez confirmes que el schema se creó:
1. Migrar datos de SQLite → Supabase
2. Actualizar `app.js` para usar Supabase en lugar de sqlite3
3. Agregar queries de control (contactos inactivos, etapas, etc.)

---

## ¿Problemas?

**"Error: relation "contacts" does not exist"**
→ El schema SQL no se ejecutó. Repite Paso 1.

**"No puedo ver las tablas"**
→ Recarga Supabase o limpiar caché. Si persiste, ejecuta schema de nuevo.

---

Avísame cuando hayas ejecutado el schema ✅
