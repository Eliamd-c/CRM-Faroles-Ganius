# Secuencias (Automatización de Automatizaciones)

## Visión general
El video menciona la capacidad de enviar al usuario a través de varios flujos o automatizaciones dependiendo de ciertas condiciones. En lugar de un solo flujo lineal, se concibe una "secuencia" que conecta flujos independientes a lo largo del tiempo.

## Oportunidad de Mejora para nuestro CRM
Actualmente, nuestro Flow Builder permite saltar entre nodos dentro del mismo lienzo usando el nodo "GoTo / Saltar". Sin embargo, podríamos implementar un sistema de **Secuencias** de nivel superior donde un flujo pueda invocar a otro flujo distinto que haya sido guardado previamente (cuando implementemos el Dashboard de flujos).

## Posible Implementación
- Crear un nodo llamado "Ejecutar Flujo" que tome como parámetro el ID de otro flujo guardado.
- Permitir desencadenar estos flujos basados en retrasos (ej. 1 día después del flujo inicial).
