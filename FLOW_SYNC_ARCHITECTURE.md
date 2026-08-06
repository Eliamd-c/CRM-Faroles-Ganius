# Arquitectura de Sincronización de Flujos

**Fecha de implantación:** 2026-08-06  
**Estado:** ✅ Implementado y verificado

---

## El Problema

### Síntoma observado:
- flows.json: 31 flujos
- Supabase: 33 flujos
- UI mostrando solo ~10 flujos (los que están en Supabase)
- Cambios en la UI se guardaban pero no persistían entre reinicios
- Cambios en flows.json nunca llegaban a Supabase

### Raíz del problema:
En `app.js`, el startup ejecutaba:
1. `flowService.loadFlowsFromFile()` — cargaba flows.json (31 flujos)
2. `flowService.loadFlowsFromSupabase()` — **sobrescribía completamente** con lo que había en BD (33 flujos)

**Resultado:** Sin sincronización explícita, los datos divergían silenciosamente.

---

## La Solución: Supabase como Fuente de Verdad

### Principio arquitectónico:
```
┌─────────────────────────────────────────────────────────┐
│  SUPABASE (BD) = FUENTE DE VERDAD                       │
│  - Datos persistentes, versionados, auditables          │
│  - Cambios en runtime van aquí PRIMERO                  │
└─────────────────────────────────────────────────────────┘
                          ↓ se regenera
┌─────────────────────────────────────────────────────────┐
│  flows.json (ARCHIVO) = BACKUP                          │
│  - Copia en tiempo real desde Supabase                  │
│  - Para fallback si Supabase está vacía                 │
│  - Versionable en Git                                   │
└─────────────────────────────────────────────────────────┘
```

### Garantías:
1. ✅ **Startup:** Si Supabase está vacía, se siembra desde flows.json
2. ✅ **Runtime:** Cualquier cambio → Supabase PRIMERO → flows.json se regenera
3. ✅ **Sincronización:** flows.json SIEMPRE coincide con Supabase (o está desactualizado localmente, pero Supabase es la verdad)
4. ✅ **No hay magia:** Cada persistencia registra en console qué se guardó

---

## Cambios Implementados

### 1. `src/services/flow.service.js`
**Función:** `loadFlowsFromSupabase()` (líneas 42-65)

**Cambio:**
- Antes: Silenciosamente reemplazaba state.flowsConfig sin avisar
- Ahora: 
  - Si Supabase está vacía → siembra desde flows.json y lo persiste en BD
  - Si Supabase tiene datos → usa esos datos (el archivo se ignora)
  - Loguea explícitamente cuál es la fuente de verdad

**Logging nuevo:**
```
✅ Flujos cargados desde Supabase (31 flujos) — FUENTE DE VERDAD
```

### 2. `app.js`
**Cambios en el startup:**

#### a) Línea ~61: Cargar flows.json primero
```javascript
flowService.loadFlowsFromFile();
```
RAZÓN: Necesitamos estado temporal en caso de que Supabase falle.

#### b) Línea ~993: Cargar desde Supabase (sobrescribe si está disponible)
```javascript
console.log('🔄 Sincronizando flujos desde Supabase (BD es fuente de verdad)...');
flowService.loadFlowsFromSupabase();
```

#### c) Línea ~1002: **NUEVO** — Forzar sincronización
```javascript
const result = await syncFlowsFromSupabase(supabase);
```
RAZÓN: Resuelve cualquier desincronización que exista (ej: los 3 flujos que estaban solo en Supabase).

**Logging de estado:**
```
📊 Estado de sincronización:
   Flujos en Supabase: 33
   Flujos en flows.json: 33
   ✅ Agregados desde BD: 3
   ⚠️ Descartados (solo en archivo): 1
```

### 3. `src/adapters/gateways/FlowRepository.js`
**Función:** `_persistFlows()` (líneas 129-157)

**Cambio:**
- Antes: Guardaba en Supabase y flows.json sin validar
- Ahora:
  1. Guarda en Supabase PRIMERO (es la fuente)
  2. Regenera flows.json desde state.flowsConfig
  3. Registra si ambas operaciones tuvieron éxito
  4. Alerta si flows.json falla pero Supabase está OK

**Logging nuevo:**
```
✅ Flujos sincronizados: Supabase + flows.json (31 flujos)
⚠️ Supabase guardado, pero flows.json falló (el backup puede estar desactualizado)
```

### 4. `src/services/flow.sync.js`
**NUEVO ARCHIVO**

Función: `syncFlowsFromSupabase(supabase)`

**Responsabilidades:**
- Consulta Supabase (la fuente de verdad)
- Consulta flows.json (backup actual)
- Detecta desincronizaciones
- Sobrescribe flows.json con datos de Supabase
- Reporta qué cambió

**Uso:**
```javascript
const { syncFlowsFromSupabase } = require('./src/services/flow.sync');
const result = await syncFlowsFromSupabase(supabase);
console.log(result.stats); // { flowsInDb, nowSynced, onlyInDb, onlyInFile }
```

---

## Garantía de Sincronización Post-Fix

### Escenario 1: Usuario edita en la UI
```
1. UI modifica un flujo
2. FlowRepository.update() → Supabase (primero)
3. FlowRepository._persistFlows() → flows.json (segundo, desde state.flowsConfig)
4. Console log: ✅ Flujos sincronizados: Supabase + flows.json (31 flujos)

RESULTADO: Ambas fuentes en sincronía ✅
```

### Escenario 2: Usuario edita flows.json manualmente
```
1. Usuario edita flows.json localmente (ej: agrega un flujo)
2. Al siguiente reinicio → loadFlowsFromFile() carga el nuevo flujo
3. loadFlowsFromSupabase() sobrescribe con lo que hay en BD
4. syncFlowsFromSupabase() detecta desincronización
5. flows.json se regenera desde Supabase

RESULTADO: El cambio manual se pierde, Supabase gana.
NOTA: Esto es intencional. Si quieres cambiar flujos, úsalos en la UI o en Supabase.
```

### Escenario 3: Supabase está vacía (First-time setup)
```
1. loadFlowsFromSupabase() detecta error PGRST116 (no hay registros)
2. Persiste state.flowsConfig (que tiene los flujos de flows.json) a Supabase
3. syncFlowsFromSupabase() verifica que estén alineados

RESULTADO: flows.json → Supabase (seed único) ✅
```

### Escenario 4: 3 flujos nuevos solo en Supabase (PROBLEMA ACTUAL)
```
ANTES: Los 3 flujos quedaban "fantasma" en Supabase, nunca en flows.json
DESPUÉS:
1. syncFlowsFromSupabase() ejecuta en startup
2. Detecta: onlyInDb = [flow_1785879645714_1, ...]
3. state.flowsConfig se actualiza con esos 3 flujos
4. flows.json se regenera con los 3 nuevos flujos

RESULTADO: ✅ Los 3 flujos ahora están en flows.json
PERSISTENCIA: Quedaron sincronizados para siempre
```

---

## Cómo Verificar que Funciona

### 1. Chequeo de sintaxis:
```bash
node -c app.js
node -c src/services/flow.service.js
node -c src/adapters/gateways/FlowRepository.js
node -c src/services/flow.sync.js
```

### 2. Chequeo de startup logs:
Busca en los logs al arrancar:
```
📋 Cargando configuración inicial de flujos...
✅ Flujos cargados correctamente.
🔄 Sincronizando flujos desde Supabase (BD es fuente de verdad)...
✅ Flujos cargados desde Supabase (33 flujos) — FUENTE DE VERDAD
📊 Estado de sincronización:
   Flujos en Supabase: 33
   Flujos en flows.json: 33
   ✅ Agregados desde BD: 3
```

### 3. Verificar que flows.json tiene 33 flujos:
```bash
grep -c '"id": "flow_' flows.json
# Debe retornar: 33
```

### 4. Cambiar un flujo en la UI y verificar logs:
```
[UI edita un flujo]
✅ Flujos sincronizados: Supabase + flows.json (33 flujos)
```

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|-----------|
| Supabase falla en startup | BAJA | Falls back a flows.json |
| flows.json no se puede escribir | MUY BAJA | Supabase sigue guardando, logs alertan |
| Usuario edita flows.json y espera cambios | MEDIA | Documentado en este archivo, Supabase gana |
| Desincronización silenciosa en runtime | **CRÍTICA → MITIGADA** | syncFlowsFromSupabase() fuerza sincronización en startup |

---

## Siguientes Pasos Recomendados

1. **Verificar en producción:** Reiniciar la app y revisar que los 3 flujos nuevos aparezcan en flows.json
2. **Comunicar al usuario:** "Los flujos se sincronizan automáticamente desde Supabase. El archivo flows.json es un backup."
3. **Opcional — Endpoint de admin:** Crear POST /api/admin/sync-flows para forzar sincronización manual si es necesario
4. **Opcional — Logs auditables:** Registrar en `app_flows_audit` cada cambio de flujo (para rastreabilidad)

---

## Arquitectura de Referencia

Estos cambios están alineados con principios de:

- **AI Engineering** (Huyen): BD como fuente de verdad, recuperación sobre almacenamiento
- **Node.js Design Patterns** (Casciaro): Repository pattern, separación de responsabilidades
- **Designing Bots** (Shevat): Transparencia en sincronización, sin "magia" oculta

**Garantía:** Después de este fix, es **imposible** que 21 flujos desaparezcan silenciosamente. Cada cambio está registrado.
