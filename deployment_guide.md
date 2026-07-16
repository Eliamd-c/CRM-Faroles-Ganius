# Guía de Despliegue en la Nube: Render.com (Node.js)

Para poder administrar y supervisar tu CRM de Instagram de manera continua desde internet de forma gratuita, puedes desplegar la aplicación en **Render.com** conectando directamente tu repositorio de GitHub. Al estar migrado a Node.js, el despliegue es aún más rápido.

Sigue estos pasos detallados para realizar el despliegue:

---

## Paso 1: Crear una Cuenta en Render y Conectar GitHub
1. Entra a [Render.com](https://render.com/) y regístrate (puedes iniciar sesión directamente con tu cuenta de GitHub).
2. En el panel principal de Render, haz clic en el botón **New +** y selecciona **Web Service**.
3. Selecciona **Connect a repository** y elige tu repositorio `CRM-Faroles-Ganius`.

---

## Paso 2: Configurar el Web Service en Render
En la configuración de tu nuevo servicio web, rellena los siguientes campos:

* **Name**: `crm-faroles-ganius` (este nombre determinará tu URL pública, por ejemplo: `https://crm-faroles-ganius.onrender.com`).
* **Region**: Selecciona la más cercana a ti (ej. *Oregon (US West)* o *Ohio (US East)*).
* **Branch**: `main`
* **Runtime**: `Node`
* **Build Command**: `npm install`
* **Start Command**: `npm start`
* **Instance Type**: Selecciona la opción **Free** (Gratuita).

---

## Paso 3: Configurar el Almacenamiento Persistente (Disco para SQLite)
Como SQLite guarda todos los contactos, chats y configuraciones en un archivo local (`crm.db`), si el servidor gratuito se reinicia o se redespliega, ese archivo se borraría por defecto. Para evitar esto, agregaremos un disco persistente gratuito en Render:

1. Desplázate hacia abajo y haz clic en el botón **Advanced**.
2. Busca la sección **Disks** (Discos) y haz clic en **Add Disk**.
3. Configura el disco con los siguientes valores:
   - **Name**: `crm_data`
   - **Mount Path**: `/data`
   - **Size**: `1 GiB` (es más que suficiente para almacenar millones de mensajes de texto y configuraciones).

---

## Paso 4: Configurar Variables de Entorno (Environment Variables)
En la misma sección **Advanced**, busca **Environment Variables** y haz clic en **Add Environment Variable** para indicarle a la aplicación que guarde la base de datos en el disco persistente que acabamos de crear:

1. **Ruta de Base de Datos**:
   - **Key**: `DATABASE_PATH`
   - **Value**: `/data/crm.db`
2. **Versión de Node (Opcional)**:
   - **Key**: `NODE_VERSION`
   - **Value**: `20.10.0`

---

## Paso 5: Desplegar la Aplicación
1. Haz clic en **Deploy Web Service** al final de la página.
2. Render comenzará a descargar tu código de GitHub, instalará las dependencias de Node e iniciará el servidor. Esto puede tardar 2 minutos.
3. Una vez que el estado cambie a **Live** (en verde), tu CRM estará en línea.
4. Podrás acceder a tu CRM desde la URL provista por Render (ej. `https://crm-faroles-ganius.onrender.com`).

---

## Paso 6: Vincular el Webhook en Meta Developers
1. Copia tu URL de Render agregando `/webhook` al final, por ejemplo:
   ```text
   https://crm-faroles-ganius.onrender.com/webhook
   ```
2. Ve al panel de Facebook Developers, en la configuración del Webhook de Instagram.
3. Haz clic en **Editar** suscripción y pega esa URL como **Callback URL**.
4. Escribe el mismo **Verify Token** que configuraste en tu CRM (en la sección Ajustes de tu página desplegada).
5. Haz clic en **Verificar y Guardar**.
