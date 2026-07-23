const axios = require('axios');

async function getGeminiLeadScore(chatHistory) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { error: "Gemini API Key no configurada" };

    const prompt = `
Analiza el siguiente historial de chat con un cliente potencial para una tienda de faroles.
Determina la "temperatura" del lead (Frio, Tibio, Caliente).
También identifica objeciones comunes (Precio, Envío, Confianza).

Historial:
${chatHistory}

Responde SOLO en formato JSON válido con esta estructura:
{
  "temperatura": "Caliente",
  "objeciones": ["Precio", "Envío"],
  "resumen_breve": "Cliente muy interesado pero duda por costo de envío."
}`;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        
        let text = response.data.candidates[0].content.parts[0].text;
        // Limpiar backticks de markdown si vienen en la respuesta
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (err) {
        console.error("Error en Gemini API:", err.message);
        return { error: "Error analizando lead" };
    }
}

async function getChatGptSuggestion(chatHistory, leadProfile) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { error: "OpenAI API Key no configurada" };

    const prompt = `
Eres el mejor asesor de ventas experto en persuasión para "Faroles Genius".
Tu objetivo es leer el historial de conversación con este cliente y sugerir la próxima respuesta que debe enviar el vendedor humano para cerrar la venta o acercarlo a la conversión.

El cliente es: ${JSON.stringify(leadProfile)}

Historial reciente:
${chatHistory}

Instrucciones:
1. Sé muy empático, persuasivo y amigable.
2. Si notaste objeciones de precio, recuérdales que comprando varias unidades acceden a precios mayoristas o pueden unirse con amigos para un mejor precio.
3. El mensaje debe estar listo para ser copiado y enviado (no escribas "Asesor:" al principio, solo el texto puro).
4. Usa emojis sutilmente.

Respuesta sugerida:`;

    try {
        const url = `https://api.openai.com/v1/chat/completions`;
        const response = await axios.post(url, {
            model: "gpt-4o",
            messages: [{ role: "system", content: prompt }]
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        return { suggestion: response.data.choices[0].message.content.trim() };
    } catch (err) {
        console.error("Error en OpenAI API:", err.message);
        return { error: "Error generando sugerencia" };
    }
}

/**
 * Clasificar intención del mensaje (Fase 2: Disparadores IA)
 * Retorna { intent, confianza } con valores 0-1
 */
async function classifyIntent(text, contextHistory = '', triggers = []) {
    const apiKey = process.env.GEMINI_API_KEY;

    // Si no hay API key, usar fallback simple
    if (!apiKey) {
        console.log('⚠️ Gemini API no configurada, usando clasificación simple');
        return { intent: 'unknown', confianza: 0.3 };
    }

    // Construir lista de intenciones disponibles
    const intentList = triggers.map(t => `- ${t.intent_name}: ${t.description || ''}`).join('\n');

    const prompt = `
Analiza el siguiente mensaje de cliente para una tienda de faroles (Faroles Genius).
Clasifica la intención en UNA de estas categorías:

${intentList}

Mensaje: "${text}"

${contextHistory ? `Contexto previo:\n${contextHistory}` : ''}

Responde EXACTAMENTE en JSON (sin markdown):
{
  "intent": "nombre_de_intension",
  "confianza": 0.85,
  "razon": "Porque el cliente mencionó..."
}

Confianza: 0 = totalmente inseguro, 1 = completamente seguro
`;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        let text_response = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        text_response = text_response.replace(/```json/g, '').replace(/```/g, '').trim();

        const result = JSON.parse(text_response);
        return {
            intent: result.intent || 'unknown',
            confianza: parseFloat(result.confianza) || 0.3,
            razon: result.razon
        };
    } catch (err) {
        console.error('⚠️ Error en clasificación IA:', err.message);
        return { intent: 'error', confianza: 0.2 };
    }
}

async function getGeminiCommentSuggestion(commentText, postCaption = '') {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        let publicReply = "¡Hola! 👋 Gracias por escribirnos. Te acabamos de enviar un mensaje directo con toda la información. 📩";
        let privateDm = "¡Hola! Gracias por comentar en nuestra publicación sobre faroles. 🕯️✨ ¿Te gustaría recibir la información de precios para tu hogar o para venta al por mayor?";
        
        const lower = (commentText || '').toLowerCase();
        if (lower.includes('precio') || lower.includes('costo') || lower.includes('cuanto') || lower.includes('valen')) {
            publicReply = "¡Hola! 🌟 Te enviamos un mensaje privado con el catálogo y la lista de precios completa. 📥";
            privateDm = "¡Hola! ✨ Con gusto te compartimos nuestra lista de precios. Manejamos precios especiales al por mayor si compras desde 12 unidades. ¿Cuántos faroles te gustaría cotizar?";
        } else if (lower.includes('envio') || lower.includes('ciudad') || lower.includes('donde') || lower.includes('ubicacion')) {
            publicReply = "¡Hola! 🚚 Realizamos envíos a todo el país. Revisa tus mensajes directos para coordinar los detalles. 📩";
            privateDm = "¡Hola! 🚚 Hacemos envíos seguros a toda Colombia. ¿A qué ciudad o municipio te gustaría recibir tu pedido de faroles?";
        }
        return { publicReply, privateDm, intent: 'consultar_precio' };
    }

    const prompt = `
Eres la IA de atención al cliente de "Faroles Genius", una marca líder en faroles artesanales y navideños.
Analiza el siguiente comentario de Instagram realizado por un usuario en nuestra publicación:

Publicación/Caption: "${postCaption || 'Faroles de alta calidad para el Día de Velitas y decoración'}"
Comentario del cliente: "${commentText}"

Genera dos respuestas:
1. "publicReply": Una respuesta pública amigable, empática y profesional para responder al comentario (máximo 150 caracteres, usar 1 o 2 emojis).
2. "privateDm": Un mensaje privado persuasivo (DM) para enviar al inbox del cliente iniciando la conversación de ventas o dando la info solicitada (máximo 250 caracteres, súper empático).
3. "intent": Clasifica la intención del usuario ("precio", "envio", "mayorista", "felicitacion", "otro").

Responde ÚNICAMENTE en formato JSON estricto:
{
  "intent": "precio",
  "publicReply": "¡Hola! 🌟 Te acabamos de enviar un mensaje directo con la lista de precios completa. 📥",
  "privateDm": "¡Hola! ✨ Gracias por tu interés en nuestros faroles. Manejamos paquetes individuales y descuentos especiales al por mayor. ¿Te gustaría cotizar para hogar o negocio?"
}`;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        
        let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (err) {
        console.error("Error en Gemini Comment AI:", err.message);
        return {
            intent: "consulta",
            publicReply: "¡Hola! 👋 Gracias por tu comentario. Te enviamos la información completa por mensaje directo. 📥",
            privateDm: "¡Hola! Gracias por contactar a Faroles Genius 🕯️✨ ¿En qué ciudad te encuentras para ayudarte con tu cotización?"
        };
    }
}

module.exports = {
    getGeminiLeadScore,
    getChatGptSuggestion,
    classifyIntent,
    getGeminiCommentSuggestion
};

