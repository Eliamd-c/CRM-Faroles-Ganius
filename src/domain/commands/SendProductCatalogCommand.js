const Command = require('./Command');

// ==========================================
// SendProductCatalogCommand
// ==========================================
// Envía un carrusel visual de productos al cliente via Instagram.
// El LLM decide cuándo es apropiado mostrar el catálogo
// (típicamente en las etapas RECOMMENDATION o CHECKOUT).

class SendProductCatalogCommand extends Command {
  constructor() {
    super(
      'send_product_catalog',
      'Envía un carrusel visual de productos/faroles solares al cliente. Úsalo cuando el cliente pida ver opciones, modelos o el catálogo de productos.'
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
            category: {
              type: 'string',
              description: 'Categoría de productos a mostrar (ej. "faroles_jardín", "faroles_pared", "todos")',
              enum: ['faroles_jardín', 'faroles_pared', 'faroles_calle', 'todos']
            },
            message: {
              type: 'string',
              description: 'Mensaje acompañante antes del carrusel (ej. "¡Mira estas opciones perfectas para ti!")'
            }
          },
          required: ['message']
        }
      }
    };
  }

  async execute(params, context) {
    const { meta, supabase, senderId } = context;
    const { message, category } = params;

    try {
      // Enviar mensaje de texto antes del carrusel
      if (message) {
        await meta.sendMessage(senderId, message);
      }

      // Buscar productos del catálogo en Supabase
      let query = supabase.from('media_catalog').select('*').eq('active', true);
      if (category && category !== 'todos') {
        query = query.eq('category', category);
      }
      const { data: products } = await query.limit(10);

      if (!products || products.length === 0) {
        await meta.sendMessage(senderId, '📦 En este momento estamos actualizando nuestro catálogo. ¡Pronto tendremos novedades para ti!');
        return { success: true, message: 'Catálogo vacío, mensaje de espera enviado' };
      }

      // Construir y enviar el carrusel
      const elements = products.map(p => ({
        title: p.title || p.name || 'Farol Solar',
        subtitle: p.description || p.subtitle || '',
        image_url: p.image_url || p.url,
        buttons: [
          { type: 'postback', title: '💰 Ver Precio', payload: `PRICE_${p.id}` },
          { type: 'postback', title: '🛒 Me Interesa', payload: `INTEREST_${p.id}` }
        ]
      }));

      await meta.sendCarousel(senderId, elements);
      return { success: true, message: `Carrusel de ${elements.length} productos enviado` };

    } catch (err) {
      console.error('[SendProductCatalog] Error:', err.message);
      return { success: false, message: err.message };
    }
  }
}

module.exports = SendProductCatalogCommand;
