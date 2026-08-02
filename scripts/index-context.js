require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const supabase = require('../db');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateEmbedding(text, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: text,
          model: 'text-embedding-3-small'
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        }
      );
      return response.data.data[0].embedding;
    } catch (err) {
      const isLast = attempt === retries;
      console.warn(`  ⚠️ Intento ${attempt}/${retries} falló: ${err.message}${err.cause ? ' | causa: ' + err.cause.message : ''}`);
      if (isLast) throw err;
      await sleep(1000 * attempt);
    }
  }
}

async function indexContext() {
  if (!supabase) {
    console.error('Supabase no está configurado. No se puede indexar.');
    process.exit(1);
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY no está configurada.');
    process.exit(1);
  }

  const contextPath = path.join(__dirname, '..', 'Agente_IA_Faroles_Genius_Contexto_Maestro.md');
  const markdown = fs.readFileSync(contextPath, 'utf8');

  // Split by markdown headers level 2 (##)
  const sections = markdown.split(/\n## /);
  
  console.log(`Encontradas ${sections.length} secciones para indexar.`);

  for (let i = 0; i < sections.length; i++) {
    let text = sections[i].trim();
    if (!text) continue;
    
    // Si no es la primera sección, restauramos el '## '
    if (i > 0) text = '## ' + text;

    // Extraer el título de la primera línea
    const titleMatch = text.match(/^(?:#+ )?(.*?)(?:\n|$)/);
    const sectionTitle = titleMatch ? titleMatch[1].trim() : `Sección ${i}`;

    console.log(`Generando embedding para: ${sectionTitle} (${text.length} caracteres)...`);
    
    try {
      const embedding = await generateEmbedding(text);
      
      const { error } = await supabase.from('knowledge_chunks').insert({
        section_title: sectionTitle,
        content: text,
        embedding: embedding
      });

      if (error) {
        console.error(`Error insertando ${sectionTitle}:`, error.message);
      } else {
        console.log(`✅ ${sectionTitle} indexado con éxito.`);
      }
    } catch (err) {
      console.error(`❌ Error procesando ${sectionTitle}:`, err.message, err.cause ? '| causa: ' + err.cause.message : '');
    }

    await sleep(300); // pequeña pausa entre secciones para no saturar la conexión
  }

  console.log('✅ Proceso de indexación finalizado.');
}

indexContext();
