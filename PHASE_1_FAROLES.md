# 🎯 FASE 1: Implementar Flujo de Faroles Genius

**Objetivo**: Implementar el flujo completo de conversión según la especificación de estrategia.

**Timeline**: Antes de 7 de diciembre (Día de las Velitas)

---

## 📋 Tareas de Fase 1

### 1. ✅ Actualizar Tabla de Precios (con Tier Mayorista)

**Archivo**: `static/js/app.js` (UI) + `app.js` (API)

**Cambios:**
- Reemplazar tabla de precios actual por la tabla de la especificación
- **AGREGAR BLOQUE DESTACADO**: "🏆 18+ PAQUETES = $16.000 c/u" (ahorras $216.000)
- Mostrar siempre junto a la tabla (no como sorpresa)

**Tabla actual:**
```
1 paquete: $28.000
2 paquetes: $26.000
... 
12 paquetes: $20.000
```

**Tabla nueva:**
```
1 paquete: $28.000
2 paquetes: $26.000
...
12 paquetes: $20.000

🏆 18+ PAQUETES: $16.000 c/u (ahorras $216.000)
```

---

### 2. ✅ Reescribir Mensajes del Flujo (5 Pasos)

**Archivo**: `app.js` - crear/actualizar flows en BD

**Paso 1 - Bienvenida (VARIANTE por disparador)**

Si viene de **anuncio pagado** (video ya visto):
```
¡Gracias por escribirnos, {First Name}! 🙏
Como viste, en Faroles Genius queremos que cada hogar —y cada iglesia— tenga su farol.
Cuéntame, ¿es para tu casa, para regalar, o te gustaría armar un grupo (familia, amigos o tu iglesia)?

[Botón: Es para mi casa] [Botón: Quiero armar un grupo]
```

Si viene de **DM orgánico** (no vio anuncio):
```
¡Hola {First Name}! 👋 Bienvenida a Faroles Genius.

[VIDEO ADJUNTO - 55s]

Inspirados por la Virgen María, nuestros faroles artesanales celebran el Día de las Velitas y la fe de tu familia. 🏮💛

[Botón: Comencemos]
```

---

**Paso 2 - Historia + Precios (fusionado)**

```
{First Name}, nuestros faroles están hechos a mano con cartón de caña de azúcar y papel seda,
logrando un efecto de vitral único. Miden 35 cm x 17 cm y vienen en 8 diseños distintos,
100% reutilizables.

🎁 Un paquete de 4 faroles cuesta $28.000, y mientras más llevas, más ahorras:

[TABLA DE PRECIOS COMPLETA]

🏆 Si reúnes 18 paquetes entre familia y amigos, el precio baja a $16.000 c/u — ¡ahorras $216.000!

[Botón: Ver mis opciones]
```

---

**Paso 3 - Decisión**

```
{First Name}, ¿quieres comprar para ti o prefieres armar un grupo con familia/amigos para bajar el precio?

[Botón: Comprar para mí] [Botón: Armar un grupo]
```

---

**Paso 4a - Rama Individual**

```
Perfecto, ¿cuántos paquetes te gustaría llevar?

[Botones: 1 / 2 / 3 / 4+]

Para confirmar tu pedido y coordinar el pago, hablemos por WhatsApp 📲

[Botón: Ir a WhatsApp]
```

---

**Paso 4b - Rama Grupo**

```
¡Genial! 🎉 Si reúnes 18 paquetes entre tu familia, amigos, o tu iglesia/grupo de oración,
el precio baja a $16.000 c/u — un ahorro de $216.000.

Y como agradecimiento por organizar el grupo, te regalamos un mini cuadro de la Virgen María 🖼️💛 para tu casa.

¿Armamos tu grupo?

[Botón: Sí, quiero armar un grupo] [Botón: Prefiero comprar solo]
```

Si confirma:
```
¡Genial! Para armar tu grupo con calma (cuántos paquetes, diseños, fecha) es más fácil por WhatsApp.
Ahí llevamos el conteo de tu grupo hasta llegar a los 18 📲

[Botón: Ir a WhatsApp]
```

---

### 3. ✅ Agregar Disparador: Anuncio Pagado

**Archivo**: `app.js` - función `processMessagingEvent`

**Detectar**: objeto `referral` en webhook de Meta
```javascript
if (messagingEvent.referral) {
  // Usar variante de bienvenida "anuncio pagado"
  // Saltar clasificador de intención
}
```

**Acción**: Ir directo a Paso 1 variante "anuncio"

---

### 4. ✅ Mensaje de Reactivación (23h)

**Archivo**: `app.js` - agregar función `scheduleReactivation`

**Lógica:**
- Si no hay respuesta tras 20-22h: enviar mensaje de urgencia estacional
- Si no responde tras 23h: cerrar conversación

**Mensaje:**
```
{First Name}, ¿sigues interesada en tus faroles?
Quedan pocos días para el 7 de diciembre 🕯️
Escríbenos si tienes alguna duda.
```

---

## 📊 Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `app.js` | Actualizar flows (Paso 1-4), agregar disparador de anuncio, scheduler de reactivación |
| `static/js/app.js` | UI para mostrar tabla de precios + bloque mayorista |
| `templates/index.html` | (si es necesario) sección de precios |
| `migrations/` | (opcional) agregar datos semilla de flows nuevos |

---

## ✅ Checklist de Fase 1

- [ ] Tabla de precios con tier mayorista creada
- [ ] Paso 1 bienvenida (variantes anuncio/orgánico)
- [ ] Paso 2 historia + precios fusionados
- [ ] Paso 3 decisión individual/grupo
- [ ] Paso 4a rama individual (compra personal)
- [ ] Paso 4b rama grupo (organizar grupo + regalo)
- [ ] Disparador de anuncio pagado implementado
- [ ] Mensaje de reactivación (23h) agregado
- [ ] Flujos guardados en BD Supabase
- [ ] Testeado en simulador DM
- [ ] Commitear a GitHub con skill
- [ ] Documentación actualizada

---

## 🚀 Cómo Proceder

1. **Actualizar flows en BD** (insert en Supabase)
2. **Reescribir lógica en app.js** (nuevos pasos + disparadores)
3. **Testear en simulador DM** (probar ambas ramas)
4. **Commitear**: `feat(faroles): implement phase 1 sales funnel`

---

**¿Empezamos?** Voy a actualizar los flows primero.
