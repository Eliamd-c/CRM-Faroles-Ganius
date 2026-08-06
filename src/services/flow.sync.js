/**
 * Flow Synchronization Service
 *
 * ARQUITECTURA:
 * - Supabase es la FUENTE DE VERDAD para flujos
 * - flows.json es un BACKUP que se regenera
 * - Si hay desincronización, Supabase gana
 *
 * Uso:
 *   const { syncFlowsFromSupabase } = require('./flow.sync');
 *   await syncFlowsFromSupabase(); // Fuerza sincronización
 */

const fs = require('fs');
const path = require('path');
const { state } = require('../shared');

/**
 * Sincroniza flows.json con Supabase.
 * IMPORTANTE: Supabase es la fuente de verdad.
 * Si Supabase tiene 33 flujos y flows.json tiene 31, el resultado será 33 flujos.
 *
 * @param {object} supabase - Cliente Supabase
 * @returns {object} { success, message, stats }
 */
async function syncFlowsFromSupabase(supabase) {
  if (!supabase) {
    return { success: false, message: 'Supabase no conectado', stats: null };
  }

  try {
    // Paso 1: Obtener flujos de Supabase (FUENTE DE VERDAD)
    const { data: appFlows, error } = await supabase
      .from('app_flows')
      .select('id, config')
      .eq('id', 1)
      .single();

    if (error) {
      return {
        success: false,
        message: `Error consultando Supabase: ${error.message}`,
        stats: null
      };
    }

    if (!appFlows || !appFlows.config || !Array.isArray(appFlows.config.flows)) {
      return {
        success: false,
        message: 'Supabase no tiene configuración válida de flujos',
        stats: null
      };
    }

    const flowsFromDb = appFlows.config.flows;
    const dbIds = new Set(flowsFromDb.map(f => f.id));

    // Paso 2: Obtener flujos de flows.json (BACKUP ACTUAL)
    const flowsJsonPath = path.join(__dirname, '..', '..', 'flows.json');
    let flowsFromFile = [];
    let fileIds = new Set();

    try {
      if (fs.existsSync(flowsJsonPath)) {
        const fileData = JSON.parse(fs.readFileSync(flowsJsonPath, 'utf8'));
        flowsFromFile = fileData.flows || [];
        fileIds = new Set(flowsFromFile.map(f => f.id));
      }
    } catch (e) {
      console.warn(`⚠️ No se pudo leer flows.json: ${e.message}`);
    }

    // Paso 3: Análisis de desincronización
    const onlyInDb = [...dbIds].filter(id => !fileIds.has(id));
    const onlyInFile = [...fileIds].filter(id => !dbIds.has(id));
    const synced = flowsFromFile.length - onlyInFile.length;

    // Paso 4: Supabase gana. Actualizar state.flowsConfig con datos de Supabase
    state.flowsConfig = appFlows.config;

    // Paso 5: Regenerar flows.json desde Supabase (para que sea el backup actual)
    try {
      await fs.promises.writeFile(
        flowsJsonPath,
        JSON.stringify(state.flowsConfig, null, 2)
      );
    } catch (e) {
      console.error(`❌ Error regenerando flows.json: ${e.message}`);
      return {
        success: false,
        message: `flows.json no se pudo actualizar: ${e.message}`,
        stats: {
          flowsInDb: flowsFromDb.length,
          flowsInFile: flowsFromFile.length,
          synced,
          onlyInDb: onlyInDb.length,
          onlyInFile: onlyInFile.length
        }
      };
    }

    // Paso 6: Reportar resultados
    return {
      success: true,
      message: onlyInDb.length > 0 || onlyInFile.length > 0
        ? `Sincronización completada: ${onlyInDb.length} flujos nuevos de Supabase integrados a flows.json, ${onlyInFile.length} flujos locales descartados (Supabase es fuente de verdad)`
        : 'Flujos ya estaban sincronizados ✅',
      stats: {
        flowsInDb: flowsFromDb.length,
        flowsInFile: flowsFromFile.length,
        nowSynced: state.flowsConfig.flows?.length || 0,
        onlyInDb,      // IDs que se agregaron a flows.json
        onlyInFile,    // IDs que se descartaron (estaban solo en archivo)
        synced         // IDs que ya estaban en ambos
      }
    };
  } catch (err) {
    console.error('❌ Error en syncFlowsFromSupabase:', err.message);
    return { success: false, message: err.message, stats: null };
  }
}

module.exports = {
  syncFlowsFromSupabase
};
