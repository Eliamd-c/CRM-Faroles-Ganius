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

module.exports = {
    getGeminiLeadScore,
    getChatGptSuggestion
};
