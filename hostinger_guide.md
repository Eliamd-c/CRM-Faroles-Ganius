# Guía de Despliegue en Hostinger (Node.js / Web.js)

Hostinger ofrece soporte nativo para aplicaciones de **Node.js** en sus planes de hosting VPS y algunos planes de hosting compartido (a través del administrador de aplicaciones de Node.js). Al migrar el CRM a Node.js, ahora puedes alojarlo en tu cuenta de Hostinger y mantener tus datos guardados en SQLite de forma persistente.

Sigue estos pasos para configurarlo:

---

## Opción A: Despliegue usando el panel de Node.js (hPanel)

Si tu plan de Hostinger cuenta con la sección nativa de Node.js en el panel de administración (hPanel):

### 1. Crear la Aplicación en Hostinger
1. Inicia sesión en tu **hPanel** de Hostinger.
2. Ve a **Sitios web** -> Administrar -> sección **Avanzado** -> **Node.js**.
3. Haz clic en **Crear aplicación** e ingresa la siguiente configuración:
   - **Versión de Node**: Selecciona `20.x` o `18.x`.
   - **Directorio de la aplicación**: `crm-faroles` (esta será la carpeta en tu servidor).
   - **Archivo de inicio**: `app.js` (nuestro archivo principal del backend).
   - **Dominio / Subdominio**: Selecciona el dominio en el cual quieres ver tu CRM (ej: `crm.tudominio.com`).
4. Haz clic en **Crear**. Esto creará la carpeta y detendrá temporalmente el servicio para que subas los archivos.

### 2. Subir el Código
Puedes subir el código de dos formas:

* **Vía GitHub (Recomendado)**:
  1. Conéctate a tu servidor mediante la terminal SSH de Hostinger.
  2. Navega al directorio creado: `cd domains/tudominio.com/crm-faroles` (o la ruta correspondiente que indique tu hPanel).
  3. Clona tu repositorio: `git clone https://github.com/Eliamd-c/CRM-Faroles-Ganius.git .`
  *(Asegúrate de agregar el punto `.` al final para clonar el contenido directamente en esa carpeta)*.

* **Vía Administrador de Archivos**:
  1. Comprime todos los archivos del proyecto de tu escritorio en un archivo `.zip` (excepto la carpeta `node_modules` y el archivo `crm.db` local).
  2. Abre el **Administrador de Archivos** en el hPanel de Hostinger.
  3. Ve a la carpeta de tu aplicación de Node.js y sube el archivo `.zip`.
  4. Descomprime el archivo allí mismo.

### 3. Instalar Dependencias
1. En el panel de Node.js del hPanel de Hostinger, entra a la configuración de tu aplicación.
2. Busca la sección que permite ejecutar comandos de npm y haz clic en **npm install** (o abre la consola SSH en la carpeta del proyecto y corre `npm install`).
3. Esto instalará automáticamente `express`, `sqlite3`, `axios` y `dotenv`.

### 4. Iniciar la Aplicación
1. Una vez instaladas las dependencias, haz clic en **Iniciar** (Start) en el panel de Node.js.
2. Entra a tu dominio seleccionado (ej. `https://crm.tudominio.com`). ¡Tu CRM ya estará activo!
3. La base de datos `crm.db` se creará automáticamente en el servidor y guardará tus datos de forma permanente.

---

## Opción B: Despliegue en un VPS de Hostinger (Terminal SSH)

Si tienes un VPS (Servidor Virtual Privado) en Hostinger con Linux:

1. Conéctate a tu VPS por SSH:
   ```bash
   ssh root@ip_de_tu_vps
   ```
2. Instala Node.js y npm (si no están instalados):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. Clona tu repositorio en la carpeta que desees (ej: `/var/www/crm-faroles`):
   ```bash
   git clone https://github.com/Eliamd-c/CRM-Faroles-Ganius.git /var/www/crm-faroles
   cd /var/www/crm-faroles
   ```
4. Instala las dependencias:
   ```bash
   npm install
   ```
5. Instala `pm2` para mantener la aplicación corriendo en segundo plano:
   ```bash
   npm install -g pm2
   pm2 start app.js --name "crm-faroles"
   pm2 save
   pm2 startup
   ```
6. Configura un proxy inverso con Nginx para apuntar tu dominio (puerto 80/443) al puerto local `5000` de Node.js.

---

## Configurar el Webhook de Meta con tu URL de Hostinger
1. Una vez desplegado, tu webhook en Facebook Developers deberá apuntar a la URL pública de tu dominio:
   ```text
   https://crm.tudominio.com/webhook
   ```
2. Asegúrate de que el certificado SSL (HTTPS) de tu dominio esté activo en Hostinger para que Meta pueda validar la conexión.
