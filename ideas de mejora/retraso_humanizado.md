# Retraso Humanizado (Anti-Bot)

## Visión general
El video hace un fuerte énfasis en NO responder de forma instantánea a ciertas interacciones (como un nuevo seguidor). Recomienda usar un retraso de 1 minuto: *"porque la gente ya empieza a sentir que es un bot y cada vez que siente que es un bot como que produce cierto rechazo... se siente como menos artificial."*

## Oportunidad de Mejora para nuestro CRM
Nosotros ya tenemos un nodo de "Espera (Delay)" en el Flow Builder. Sin embargo, podríamos integrar esta mentalidad de "respuesta humanizada" directamente en las respuestas por defecto y triggers generales.

## Posible Implementación
- Añadir un indicador de "Escribiendo..." (`typing_on` en la API de Messenger/Instagram) durante las pausas del bot.
- Permitir que el nodo de Trigger principal tenga una configuración global de "Humanizar Respuesta" que añada automáticamente un retraso aleatorio (ej. 3 a 10 segundos) antes de disparar el primer mensaje, simulando que alguien está leyendo y empezando a escribir.
