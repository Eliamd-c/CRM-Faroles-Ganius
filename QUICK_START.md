# ⚡ Quick Start: Motor IA en 5 Pasos

## Paso 1: Configura las API Keys
En `.env`:
```env
GEMINI_API_KEY=AIza...  # Obtén en https://ai.google.dev
# O
OPENAI_API_KEY=sk-...   # Obtén en https://platform.openai.com/api-keys
```

## Paso 2: Inicia el servidor
```bash
npm start
# ✅ Servidor CRM ejecutándose en puerto 5000
# ✅ Conectado a la base de datos SQLite: crm.db
```

## Paso 3: Abre el navegador
```
http://localhost:5000
```

## Paso 4: Ve a "Automatización" (tab central)
Verás 3 disparadores ya creados:
- **saludo** → `start`
- **interes_hogar** → `FLOW_HOME`
- **interes_negocio** → `FLOW_BUSINESS`

## Paso 5: Prueba con el Simulador
1. Haz clic en tab "Simulador DM"
2. Escribe: "Hola, ¿tienen faroles para distribuir?"
3. Haz clic: "Inyectar Webhook"
4. **La IA detecta intención "interes_negocio"**
5. **Se dispara automáticamente el flujo FLOW_BUSINESS**

---

## 🧪 Pruebas Rápidas

### Desde la UI
Automatización → Zona de prueba → "Probar detección"
```
Escribir: "¿cuánto cuesta un farol?"
Resultado: ✅ interes_hogar (confianza 85%) → FLOW_HOME
```

### Desde Terminal
```bash
curl -X POST http://localhost:5000/api/ai-triggers/test \
  -H "Content-Type: application/json" \
  -d '{"text": "quiero vender esos productos"}'
```

---

## 📝 Crear tu Primer Disparador Personalizado

### UI
1. Automatización → Panel izquierdo
2. **Nombre**: `interes_seguimiento`
3. **Descripción**: "El cliente pregunta cómo rastrear su pedido"
4. **Ejemplos**: "¿dónde está mi orden? | ¿cuándo llega?"
5. **Flujo destino**: `FLOW_HOME`
6. Guardar

### API
```bash
curl -X POST http://localhost:5000/api/ai-triggers \
  -H "Content-Type: application/json" \
  -d '{
    "intent_name": "interes_seguimiento",
    "description": "El cliente pregunta estado de su pedido",
    "examples": "¿dónde está mi pedido? | ¿cuándo llega?",
    "target_flow": "FLOW_HOME"
  }'
```

---

## 🎯 Cómo Testear en Producción

1. **Crea un disparador**
2. **Prueba sin enviar** (zona de prueba)
3. **Confianza ≥ 70%** → Actívalo con clientes reales
4. **Confianza 60-70%** → Revisa logs, ajusta ejemplos
5. **Confianza < 60%** → Deshabilita, refina descripción

---

## 🆘 Troubleshooting

### "Intención no se detecta"
→ Prueba con `/api/ai-triggers/test` antes de activar

### "Error: GEMINI_API_KEY not configured"
→ Añade clave en `.env` y reinicia servidor

### "Confianza muy baja (30%)"
→ Mejora los ejemplos (deben ser frases reales que dice un cliente)

---

## 📚 Docs Completos
- `CAMBIOS_IMPLEMENTADOS.md` — qué se modificó
- `IA_FLOW_ARCHITECTURE.md` — arquitectura detallada
- `SCHEMA.SQL` — tabla `ai_triggers`

---

**Listo en <5 minutos.** ¡Empieza a testear! 🚀
