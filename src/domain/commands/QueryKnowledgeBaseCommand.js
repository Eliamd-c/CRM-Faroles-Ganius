const Command = require('./Command');
const axios = require('axios');

class QueryKnowledgeBaseCommand extends Command {
  constructor() {
    super(
      'query_knowledge_base',
      'Busca en los manuales de la empresa (políticas, productos, precios, datos técnicos). Úsalo SIEMPRE que te pregunten algo específico sobre Faroles Genius para asegurarte de dar la información correcta.'
    );
  }

  getToolSchema() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'La pregunta o término de búsqueda (ej. "precio farol solar 100w" o "política de envíos")'
            }
          },
          required: ['query']
        }
      }
    };
  }

  async execute(args, context) {
    try {
      const { query } = args;
      const { supabase } = context;

      if (!supabase || !process.env.OPENAI_API_KEY) {
        return { status: 'error', message: 'Configuración incompleta (Supabase u OpenAI)' };
      }

      console.log(`[QueryKnowledgeBase] Generando embedding para: "${query}"`);
      const embedRes = await axios.post(
        'https://api.openai.com/v1/embeddings',
        { input: query, model: 'text-embedding-3-small' },
        { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 15000 }
      );
      
      const query_embedding = embedRes.data.data[0].embedding;

      console.log(`[QueryKnowledgeBase] Buscando en Supabase (match_knowledge)...`);
      const { data, error } = await supabase.rpc('match_knowledge', {
        query_embedding,
        match_threshold: 0.2, // Umbral tolerante
        match_count: 3
      });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return { status: 'success', data: 'No se encontró información relevante en los manuales para esa pregunta.' };
      }

      const results = data.map(doc => `[${doc.section_title}]: ${doc.content}`).join('\n\n');
      console.log(`[QueryKnowledgeBase] Encontrados ${data.length} documentos relevantes.`);
      
      return { status: 'success', data: results };

    } catch (error) {
      console.error('[QueryKnowledgeBaseCommand] Error:', error);
      return { status: 'error', message: error.message };
    }
  }
}

module.exports = QueryKnowledgeBaseCommand;
