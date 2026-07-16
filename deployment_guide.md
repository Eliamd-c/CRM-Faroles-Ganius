# Guía de Despliegue en la Nube: Render.com

Para poder administrar y supervisar tu CRM de Instagram de manera continua desde internet (sin necesidad de tener tu ordenador encendido y sin depender de ngrok), puedes desplegar la aplicación de forma gratuita en **Render.com** conectando directamente tu repositorio de GitHub.

Sigue estos pasos detallados para realizar el despliegue:

---

## Paso 1: Crear una Cuenta en Render y Conectar GitHub
1. Entra a [Render.com](https://render.com/) y regístrate (puedes iniciar sesión directamente con tu cuenta de GitHub).
2. En el panel principal de Render, haz clic en el botón **New +** y selecciona **Web Service**.
3. Selecciona **Connect a repository** y elige tu repositorio `CRM-Faroles-Ganius`. Si no aparece, haz clic en el enlace para dar permisos a Render en tu cuenta de GitHub para ese repositorio específico.

---

## Paso 2: Configurar el Web Service en Render
En la pantalla de configuración de tu nuevo servicio web, rellena los siguientes campos:

* **Name**: `crm-faroles-ganius` (este nombre determinará tu URL pública, por ejemplo: `https://crm-faroles-ganius.onrender.com`).
* **Region**: Selecciona la más cercana a ti (ej. *Oregon (US West)* o *Ohio (US East)*).
* **Branch**: `main`
* **Runtime**: `Python`
* **Build Command**: `pip install -r requirements.txt`
* **Start Command**: `gunicorn app:app`
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

1. **Primera Variable (Ruta de Base de Datos)**:
   - **Key**: `DATABASE_PATH`
   - **Value**: `/data/crm.db`
2. **Segunda Variable (Versión de Python - Opcional pero recomendada)**:
   - **Key**: `PYTHON_VERSION`
   - **Value**: `3.12.10`

---

## Paso 5: Desplegar la Aplicación
1. Haz clic en **Deploy Web Service** al final de la página.
2. Render comenzará a descargar tu código de GitHub, instalará las dependencias (`Flask`, `Requests` y `Gunicorn`) e iniciará el servidor. Esto puede tardar 2-3 minutos en el plan gratuito.
3. Una vez que el estado cambie a **Live** (en verde), tu CRM estará en línea.
4. Podrás acceder a tu CRM desde la URL provista por Render (ej. `https://crm-faroles-ganius.onrender.com`).

---

## Paso 6: Vincular el Webhook en Meta Developers
Ahora que tu servidor está en internet con una URL pública permanente y segura (HTTPS):

1. Copia tu URL de Render agregando `/webhook` al final, por ejemplo:
   ```text
   https://crm-faroles-ganius.onrender.com/webhook
   ```
2. Ve a la consola de desarrolladores de Meta (Facebook Developers), en la configuración del Webhook de Instagram.
3. Haz clic en **Editar** suscripción y pega esa URL como **Callback URL**.
4. Escribe el mismo **Verify Token** que configuraste en tu CRM (en la sección Ajustes de tu página desplegada).
5. Haz clic en **Verificar y Guardar**. ¡Listo! A partir de ese momento, cualquier DM que envíen a tu Instagram profesional llegará automáticamente a tu CRM en la nube las 24 horas del día.
