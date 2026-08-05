require('dotenv').config();
const { Pool } = require('pg');
const supabase = require('../db');
const langGraphService = require('../src/services/langgraph.service');

async function testRAG() {
  console.log('--- INICIANDO PRUEBA LOCAL DEL AGENTE IA (RAG) ---');
  
  try {
    // 1. Inyectar conocimiento falso en Supabase
    const testKnowledge = {
      section_title: 'Ficha Técnica Farol Solar 100W',
      content: 'El farol de 100W soporta lluvias torrenciales (IP67), dura 12 horas encendido y su precio actual es de $45,000 COP.'
    };
    
    console.log(`\n1. Inyectando conocimiento a la BD: "${testKnowledge.section_title}"`);
    
    // Generar embedding
    const axios = require('axios');
    const embedRes = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: testKnowledge.content, model: 'text-embedding-3-small' },
      { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } }
    );
    const embedding = embedRes.data.data[0].embedding;
    
    // Insertar en ai_knowledge
    const { data: inserted, error: insertError } = await supabase.from('ai_knowledge').insert({
      section_title: testKnowledge.section_title,
      content: testKnowledge.content,
      embedding: embedding
    }).select('id').single();
    
    if (insertError) throw insertError;
    const knowledgeId = inserted.id;
    console.log('✅ Conocimiento inyectado exitosamente.');

    // 2. Simular un cliente hablando con LangGraph
    const dummyInstagramId = 'test_local_user_' + Date.now();
    const mockCustomer = {
      instagram_id: dummyInstagramId,
      name: 'Usuario Tester'
    };
    const question = 'Quiero ver el catálogo de faroles o las opciones que tienen.';
    
    console.log(`\n2. Simulando mensaje entrante de Instagram...`);
    console.log(`[Usuario Tester]: "${question}"`);
    console.log(`Esperando respuesta del Agente (LangGraph)...`);
    
    const result = await langGraphService.processConversation(dummyInstagramId, question, mockCustomer);
    
    console.log(`\n[Agente Faroles Genius]: "${result.reply}"`);
    console.log(`\nEtapa del embudo: ${result.funnel_stage}`);
    console.log(`Acción recomendada: ${result.action}`);
    
    // 3. Limpiar la base de datos (eliminar conocimiento de prueba)
    console.log(`\n3. Limpiando datos de prueba...`);
    await supabase.from('ai_knowledge').delete().eq('id', knowledgeId);
    console.log('✅ Datos limpiados.');

    console.log('\n--- PRUEBA FINALIZADA EXITOSAMENTE ---');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA:', error);
    process.exit(1);
  }
}

testRAG();
