-- Migration: Faroles Phase 2 - Fallback Genérico
-- Mensaje genérico cuando la IA no tiene suficiente confianza (50-70%)
-- Created: 2026-07-22

-- ============================================
-- MENSAJE FALLBACK GENÉRICO (Confianza 50-70%)
-- ============================================
-- Cuando el clasificador IA no está seguro, mostramos opciones de elección
INSERT INTO flows (id, message_text, buttons_json) VALUES
('msg_fallback',
'¡Hola {First Name}! 👋

Veo que te interesa algo, pero no estoy 100% segura de qué. ¿Me ayudas eligiendo? 👇',
'[{"type":"text","title":"🏠 Decorar mi hogar","payload":"FLOW_INDIVIDUAL"},{"type":"text","title":"💰 Vender/distribuir","payload":"FLOW_GROUP"},{"type":"text","title":"📞 Hablar con un humano","payload":"FALLBACK_HUMAN"}]')
ON CONFLICT (id) DO UPDATE SET message_text = EXCLUDED.message_text, buttons_json = EXCLUDED.buttons_json;

-- ============================================
-- ACTUALIZACIÓN: Mapeo del botón "Hablar con humano"
-- ============================================
-- Este payload será manejado en handleButtonPayload() para derivar a agente
