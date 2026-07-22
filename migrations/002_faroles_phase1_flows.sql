-- Migration: Faroles Phase 1 - Sales Funnel Flows
-- Actualizar flows para implementar el embudo de venta completo
-- Created: 2026-07-21

-- Precio mayorista (constante en la especificación)
-- 18+ paquetes = $16.000 c/u
-- Ahorro: $216.000 (vs $28.000 c/u)

-- ============================================
-- PASO 1: BIENVENIDA (variante anuncio pagado)
-- ============================================
INSERT INTO flows (id, message_text, buttons_json) VALUES
('msg_welcome_from_ad',
'¡Gracias por escribirnos, {First Name}! 🙏 Como viste, en Faroles Genius queremos que cada hogar —y cada iglesia— tenga su farol. Cuéntame, ¿es para tu casa, para regalar, o te gustaría armar un grupo (familia, amigos o tu iglesia)?',
'[{"type":"text","title":"🏠 Es para mi casa","payload":"FLOW_INDIVIDUAL"},{"type":"text","title":"💰 Quiero armar un grupo","payload":"FLOW_GROUP"}]')
ON CONFLICT (id) DO UPDATE SET message_text = EXCLUDED.message_text, buttons_json = EXCLUDED.buttons_json;

-- ============================================
-- PASO 1B: BIENVENIDA (variante DM orgánico)
-- ============================================
INSERT INTO flows (id, message_text, buttons_json) VALUES
('msg_welcome_organic',
'¡Hola {First Name}! 👋 Bienvenida a Faroles Genius. [VIDEO ADJUNTO 55s] Inspirados por la Virgen María, nuestros faroles artesanales celebran el Día de las Velitas y la fe de tu familia. 🏮💛',
'[{"type":"text","title":"➡️ Comencemos","payload":"START_FLOW"}]')
ON CONFLICT (id) DO UPDATE SET message_text = EXCLUDED.message_text, buttons_json = EXCLUDED.buttons_json;

-- ============================================
-- PASO 2: HISTORIA + PRECIOS (fusionados)
-- ============================================
INSERT INTO flows (id, message_text, buttons_json) VALUES
('msg_pricing_and_story',
'Nuestros faroles están hechos a mano con cartón de caña de azúcar y papel seda, logrando un efecto de vitral único. Miden 35 cm x 17 cm y vienen en 8 diseños distintos, 100% reutilizables.

🎁 Precios según cantidad:
1 paq: $28.000 | 2 paq: $26.000 | 3 paq: $25.000 | 4 paq: $25.000
5 paq: $24.000 | 6 paq: $24.000 | 7 paq: $24.000 | 8 paq: $22.000
9 paq: $22.000 | 10 paq: $22.000 | 11 paq: $21.000 | 12 paq: $20.000

🏆 PRECIO MAYORISTA: Si reúnes 18 paquetes, ¡baja a $16.000 c/u! Ahorras $216.000.

¿Qué te interesa?',
'[{"type":"text","title":"📋 Ver mis opciones","payload":"DECISION_POINT"}]')
ON CONFLICT (id) DO UPDATE SET message_text = EXCLUDED.message_text, buttons_json = EXCLUDED.buttons_json;

-- ============================================
-- PASO 3: DECISIÓN (individual vs grupo)
-- ============================================
INSERT INTO flows (id, message_text, buttons_json) VALUES
('msg_decision',
'¿Quieres comprar para ti o prefieres armar un grupo con familia/amigos para bajar el precio?',
'[{"type":"text","title":"🛒 Comprar para mí","payload":"FLOW_INDIVIDUAL"},{"type":"text","title":"👥 Armar un grupo","payload":"FLOW_GROUP"}]')
ON CONFLICT (id) DO UPDATE SET message_text = EXCLUDED.message_text, buttons_json = EXCLUDED.buttons_json;

-- ============================================
-- PASO 4A: RAMA INDIVIDUAL
-- ============================================
INSERT INTO flows (id, message_text, buttons_json) VALUES
('msg_individual_qty',
'Perfecto, ¿cuántos paquetes te gustaría llevar?',
'[{"type":"text","title":"1 paquete","payload":"QTY_1"},{"type":"text","title":"2-3 paquetes","payload":"QTY_2_3"},{"type":"text","title":"4-6 paquetes","payload":"QTY_4_6"},{"type":"text","title":"7+ paquetes","payload":"QTY_7PLUS"}]')
ON CONFLICT (id) DO UPDATE SET message_text = EXCLUDED.message_text, buttons_json = EXCLUDED.buttons_json;

INSERT INTO flows (id, message_text, buttons_json) VALUES
('msg_individual_whatsapp',
'Para confirmar tu pedido y coordinar el pago, hablemos por WhatsApp 📲',
'[{"type":"text","title":"📱 Ir a WhatsApp","payload":"WHATSAPP_INDIVIDUAL"}]')
ON CONFLICT (id) DO UPDATE SET message_text = EXCLUDED.message_text, buttons_json = EXCLUDED.buttons_json;

-- ============================================
-- PASO 4B: RAMA GRUPO
-- ============================================
INSERT INTO flows (id, message_text, buttons_json) VALUES
('msg_group_pitch',
'¡Genial! 🎉 Si reúnes 18 paquetes entre tu familia, amigos, o tu iglesia/grupo de oración, el precio baja a $16.000 c/u — un ahorro de $216.000.

Y como agradecimiento por organizar el grupo, te regalamos un mini cuadro de la Virgen María 🖼️💛 para tu casa.

¿Armamos tu grupo?',
'[{"type":"text","title":"✨ Sí, quiero armar","payload":"GROUP_YES"},{"type":"text","title":"Prefiero comprar solo","payload":"GROUP_NO"}]')
ON CONFLICT (id) DO UPDATE SET message_text = EXCLUDED.message_text, buttons_json = EXCLUDED.buttons_json;

INSERT INTO flows (id, message_text, buttons_json) VALUES
('msg_group_whatsapp',
'¡Genial! Para armar tu grupo con calma (cuántos paquetes, diseños, fecha) es más fácil por WhatsApp. Ahí llevamos el conteo de tu grupo hasta llegar a los 18 📲',
'[{"type":"text","title":"📱 Ir a WhatsApp","payload":"WHATSAPP_GROUP"}]')
ON CONFLICT (id) DO UPDATE SET message_text = EXCLUDED.message_text, buttons_json = EXCLUDED.buttons_json;

-- ============================================
-- MENSAJE DE REACTIVACIÓN (después de 20-22h)
-- ============================================
INSERT INTO flows (id, message_text, buttons_json) VALUES
('msg_reactivation',
'{First Name}, ¿sigues interesada en tus faroles? Quedan pocos días para el 7 de diciembre 🕯️ Escríbenos si tienes alguna duda.',
'[{"type":"text","title":"📞 Escribir","payload":"REACTIVATION_YES"}]')
ON CONFLICT (id) DO UPDATE SET message_text = EXCLUDED.message_text, buttons_json = EXCLUDED.buttons_json;

-- ============================================
-- ACTUALIZAR FLOWS EXISTENTES (renombrados)
-- ============================================

UPDATE flows
SET message_text = 'Perfecto, ¡tenemos diseños hermosos listos! Por cierto, ¿sabías que si te unes con amigos o familiares para comprar, les sale a precio de mayorista? 😉',
    buttons_json = '[{"type":"text","title":"📲 Ver catálogo en WA","payload":"WA_HOME"}]'
WHERE id = 'FLOW_HOME';

UPDATE flows
SET message_text = '¡Excelente visión! 🚀 Tenemos un programa para distribuidores donde puedes comprar con descuentos exclusivos y obtener un gran margen de ganancia. Además te damos todo el material publicitario.',
    buttons_json = '[{"type":"text","title":"📲 Enviar material al WA","payload":"WA_BUSINESS"}]'
WHERE id = 'FLOW_BUSINESS';

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_flows_message_text ON flows(message_text);
