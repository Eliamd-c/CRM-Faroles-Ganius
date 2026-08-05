// Singleton del SupabaseGateway para el código legacy (services/handlers/app.js)
// que aún importa el cliente `db` directamente y no recibe el contenedor DI.
// Patrón Singleton (Node.js Design Patterns, cap. 7): una única instancia compartida
// por módulo, construida sobre el mismo cliente Supabase que usa bootstrap().
//
// Objetivo: que TODO cambio de `bot_paused` pase por pauseBot()/resumeBot(),
// garantizando el invariante bot_paused <-> bot_paused_at/bot_paused_reason.

const supabase = require('../../../db');
const SupabaseGateway = require('./SupabaseGateway');

module.exports = new SupabaseGateway(supabase);
