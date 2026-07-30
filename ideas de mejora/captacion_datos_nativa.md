# Nodos Nativos de Captación de Datos (Leads)

## Visión general
El presentador menciona la fluidez con la que se puede pedir información de contacto: *"Y acá si quisiera yo pudiera pedirles el correo, aprieto este botón y me dice... déjame tu correo... para recibir las [recompensas]"*

## Oportunidad de Mejora para nuestro CRM
Actualmente tenemos un nodo de "Pedir Dato" donde el usuario debe configurar manualmente qué variable guardar (ej. `email`). Pero podemos hacerlo aún más potente y nativo.

## Posible Implementación
- Crear nodos pre-fabricados específicos para "Pedir Email" y "Pedir Teléfono".
- Estos nodos incluirían validación automática (Regex) para asegurar que el usuario no escriba "hola" cuando se le pide un correo, haciendo que el bot le vuelva a insistir hasta que entregue un formato válido.
- Sincronización directa con un panel de "Contactos/Leads" dentro de nuestro CRM, en vez de solo guardarlo silenciosamente en la base de datos JSON de Supabase.
