'use strict';

/**
 * app.js — Puente de compatibilidad para Hostinger / PaaS.
 * Permite que las plataformas que buscan hardcodeado "app.js" como archivo de entrada
 * ejecuten sin problemas nuestra nueva arquitectura basada en "server.js".
 */
require('./server.js');
