# Capacidades actuales del Builder — Faroles Genius CRM

Este documento describe qué puede hacer el Flow Builder tal como está el código hoy. Refleja el estado real del proyecto, no un plan a futuro.

---

## 1. Qué es

Un editor visual de automatizaciones (tipo Manychat) construido sobre **Drawflow**, donde cada automatización es un flujo de nodos conectados que se ejecuta cuando un cliente escribe un DM, comenta en una publicación, o (próximamente) menciona la cuenta en una historia de Instagram.

Cada flujo se guarda como un objeto en `flows.json` con: nombre, estado (activo/borrador), palabras clave del disparador, tipo de coincidencia, y la secuencia de pasos (`steps`) que ejecuta.

---

## 2. Disparadores (Triggers)

Al arrastrar el nodo "Disparador" al canvas, se abre un modal **"Inicia automatización cuando..."** con tres opciones:

| Tipo | Estado | Descripción |
|---|---|---|
| **Mensaje directo** | ✅ Disponible | Se activa cuando el usuario escribe un DM que coincide con las palabras clave configuradas |
| **Comentario en publicación** | ✅ Disponible | Se activa cuando alguien comenta en un post o reel con la palabra clave |
| **Mención en historia** | 🔒 Deshabilitado en la UI ("Próximamente") | El backend ya sabe reaccionar a menciones en historias, pero esta opción aún no es seleccionable desde el Builder |

### Tipos de coincidencia (matchType) para el disparador de mensaje
- **Contiene** — la palabra clave aparece en cualquier parte del texto
- **Exacto** — el mensaje debe ser idéntico a la palabra clave
- **Empieza con** — el mensaje debe iniciar con la palabra clave
- **Regex** — coincidencia por patrón (con protección anti-ReDoS: los caracteres especiales del usuario se neutralizan, así que en la práctica funciona como una búsqueda de palabra completa segura, no como una regex libre)

Todos los tipos de coincidencia ignoran mayúsculas y acentos.

### Disparador por comentario
- Palabra clave con los mismos tipos de coincidencia (contiene / exacto / empieza con)
- **Selector de publicación específica**: puede limitarse a comentarios de un post en particular, con una grilla visual de miniaturas obtenida directamente de la API de Instagram
- **Respuestas públicas aleatorias**: se pueden cargar varias variantes de respuesta pública y el sistema elige una al azar en cada comentario, para sonar más natural
- Opción de enviar además un mensaje directo (DM) de seguimiento

### Fallback con IA (Smart Triggers)
Si un mensaje no coincide con ninguna palabra clave configurada, el sistema le pregunta a un modelo de OpenAI (gpt-4o-mini) si la **intención** del mensaje coincide semánticamente con algún flujo existente, incluso si el usuario lo escribió con sinónimos, faltas de ortografía o de otra forma. Si encuentra coincidencia, ejecuta ese flujo; si no, cae al flujo por defecto (`defaultFlow`).

---

## 3. Nodos disponibles en el canvas

| Nodo | Función |
|---|---|
| **Disparador** | Punto de entrada del flujo (ver sección 2) |
| **Mensaje** | Contiene uno o varios *bloques* de contenido (ver abajo) y hasta 20 botones |
| **Tarjeta** | Mensaje tipo card con imagen, título, subtítulo y botón |
| **Carrusel** | Serie de tarjetas deslizables |
| **Galería** | Serie de imágenes enviadas en secuencia con un pequeño delay configurable entre cada una |
| **Audio** | Envía un archivo de audio |
| **Video** | Envía un archivo de video |
| **Archivo** | Envía un PDF u otro documento |
| **Espera (Delay)** | Pausa la conversación entre 1 segundo y 15 minutos antes de continuar |
| **Entrada (Input)** | Le pide un dato al usuario (ver validaciones abajo) y lo guarda en el perfil del cliente |
| **Condición** | Bifurca el flujo según el valor de un campo del cliente |
| **Aleatorio (Randomizer)** | Bifurca el flujo a una ruta al azar entre varias opciones |
| **Ir a (Goto)** | Salta a otro flujo existente por su ID |
| **Acción** | Ejecuta una acción sobre el registro del cliente (ver lista abajo) |
| **Agente IA** | Activa el modo conversacional con IA (ver sección 4) |

### Bloques dentro de un nodo "Mensaje"
- **Texto** — con botón "✨ Mejorar con IA" que reescribe el texto usando GPT para hacerlo más persuasivo y agregar emojis
- **Imagen** — por URL o subiendo el archivo directamente desde el navegador

### Validaciones del nodo "Entrada"
`email`, `phone`, `number`, `url`, `date`, `choice` (opción entre una lista), o texto libre. Si el usuario responde con un formato inválido, reintenta hasta 3 veces antes de continuar por la ruta de fallo.

### Operadores del nodo "Condición"
`==`, `!=`, `>`, `<`, `contiene`, `no contiene` — comparando un campo guardado del cliente contra un valor fijo.

### Acciones disponibles en el nodo "Acción"
`add_tag`, `remove_tag`, `set_field`, `clear_field`, `delete_contact`, `pause_bot`, `resume_bot`, `mark_open`, `mark_closed`, `subscribe_sequence`, `unsubscribe_sequence`.

---

## 4. Agente IA (conversacional)

Al soltar un mensaje en el nodo "Agente IA", el bot deja de seguir el flujo lineal y empieza a conversar libremente usando GPT-4o, con estas capacidades:

- **Contexto maestro del negocio**: lee un documento markdown (`Agente_IA_Faroles_Genius_Contexto_Maestro.md`) con la personalidad, catálogo, precios, políticas de envío y objeciones comunes de Faroles Genius, y lo usa como base de conocimiento
- **RAG (búsqueda semántica)**: además del contexto fijo, busca por similitud semántica en una base de conocimiento indexada (`knowledge_chunks`) para traer solo la información más relevante a cada pregunta — *(pendiente de terminar de configurar, ver sección 6)*
- **Aprendizaje humano**: cuando un humano corrige o enseña una respuesta correcta, queda guardada y el bot la prioriza como instrucción estricta la próxima vez que surja una pregunta similar
- **Memoria conversacional**: recuerda los últimos turnos de la conversación con cada cliente (hasta 15 mensajes), no responde en el vacío
- **Herramientas (function calling)**:
  - `send_product_media` — puede enviar fotos o videos del catálogo de producto según lo que pida el cliente
  - `escalate_to_human` — puede pasar la conversación a un asesor humano y pausar el bot automáticamente cuando detecta que el cliente quiere cerrar la compra, está frustrado, o pregunta algo fuera de su conocimiento
- **Palabras de escape**: el cliente puede escribir "salir", "menú", "humano", "asesor" o "agente" para salir del modo IA en cualquier momento
- **Prompt por nodo**: cada nodo "Agente IA" puede tener sus propias instrucciones adicionales, y opcionalmente ignorar el contexto maestro para un comportamiento 100% independiente

---

## 5. Generación de flujos con IA

Desde el Builder se puede describir en lenguaje natural qué automatización se necesita (ej. *"crea un flujo que salude, pregunte el email, y luego etiquete al cliente"*) y GPT-4o genera automáticamente los nodos y las conexiones en el canvas, listos para editar.

---

## 6. Página "Mis Automatizaciones"

Listado con:
- Estado visual: **Activo** / **Borrador** / **Detenido**
- Palabras clave configuradas (con overflow "+N")
- Cantidad y tipo de pasos (con iconos)
- **Contador de ejecuciones** — cuántas veces se disparó cada flujo y cuándo fue la última vez
- Activar/desactivar con un switch
- Duplicar flujo
- Eliminar flujo (con confirmación)

En el Builder mismo: nombre del flujo editable en línea, chip de estado **En Vivo / Borrador**, y botón **Publicar** para activarlo.

---

## 7. Envíos masivos y secuencias

- **Broadcasts**: envío masivo programado o inmediato a todos los contactos o a un subconjunto filtrado por etiquetas, ejecutando una secuencia de pasos igual que un flujo normal
- **Secuencias (drip campaigns)**: un cliente puede suscribirse a una secuencia de mensajes programados en el tiempo *(la tabla que sostiene esta función, `sequence_subscriptions`, aún no existe en la base de datos actual — ver sección 8)*

---

## 8. Lo que falta o está a medio terminar

- **Memoria vectorial (RAG)**: el código para buscar por similitud semántica ya existe y está listo, pero la infraestructura en Supabase (tabla `knowledge_chunks`, extensión `pgvector`, función `match_knowledge`) recién se está terminando de configurar — actualmente en proceso de verificar las credenciales correctas del proyecto de Supabase
- **Disparador por mención en historia**: soportado en el backend, pero deshabilitado en el selector visual del Builder
- **Secuencias (drip campaigns)**: el código está completo, pero la tabla `sequence_subscriptions` no existe todavía en la base de datos de producción

---

## 9. Seguridad (contexto para quien mantenga el proyecto)

Toda la API (`/api/*`) requiere un token (`API_SECRET`) enviado como `Bearer`. El webhook de Instagram valida la firma criptográfica de Meta (`META_APP_SECRET`). Row Level Security está activo en Supabase — solo el backend, usando la Service Role Key, puede leer o escribir datos de clientes.
