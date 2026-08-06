const fs = require('fs');
const path = require('path');
const { state } = require('../../shared');

class FlowRepository {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  async create(flowData) {
    const flow = {
      id: `flow_${Date.now()}`,
      name: flowData.name,
      keywords: flowData.keywords || [],
      matchType: flowData.matchType || 'contains',
      steps: flowData.steps || [],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!state.flowsConfig.flows) state.flowsConfig.flows = [];
    state.flowsConfig.flows.push(flow);

    await this._persistFlows();
    return flow;
  }

  async read(flowId) {
    if (!state.flowsConfig.flows) return null;
    return state.flowsConfig.flows.find(f => f.id === flowId || f.id === `flow_${flowId}`) || null;
  }

  async update(flowId, updates) {
    if (!state.flowsConfig.flows) return null;

    const flow = await this.read(flowId);
    if (!flow) return null;

    const updated = {
      ...flow,
      ...updates,
      id: flow.id,
      createdAt: flow.createdAt,
      updatedAt: new Date().toISOString()
    };

    const idx = state.flowsConfig.flows.findIndex(f => f.id === flow.id);
    if (idx >= 0) {
      state.flowsConfig.flows[idx] = updated;
      await this._persistFlows();
    }

    return updated;
  }

  async delete(flowId) {
    if (!state.flowsConfig.flows) return false;

    const flow = await this.read(flowId);
    if (!flow) return false;

    state.flowsConfig.flows = state.flowsConfig.flows.filter(f => f.id !== flow.id);
    await this._persistFlows();

    return true;
  }

  async list(filters = {}) {
    if (!state.flowsConfig.flows) return [];

    let flows = [...state.flowsConfig.flows];

    if (filters.enabled !== undefined) {
      flows = flows.filter(f => f.enabled === filters.enabled);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      flows = flows.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.keywords && f.keywords.some(k => k.toLowerCase().includes(q)))
      );
    }

    return flows;
  }

  async search(keyword) {
    if (!state.flowsConfig.flows) return [];

    const kw = keyword.toLowerCase().trim();
    return state.flowsConfig.flows.filter(f =>
      f.enabled && f.keywords && f.keywords.some(k => k.toLowerCase().includes(kw))
    );
  }

  async testFlow(flowId, testInput) {
    const flow = await this.read(flowId);
    if (!flow) throw new Error(`Flujo no encontrado: ${flowId}`);

    return {
      flowId: flow.id,
      flowName: flow.name,
      testInput,
      status: 'ready',
      message: 'Flujo listo para ejecutar'
    };
  }

  async exportFlow(flowId) {
    const flow = await this.read(flowId);
    if (!flow) throw new Error(`Flujo no encontrado: ${flowId}`);

    return {
      flow,
      exportedAt: new Date().toISOString()
    };
  }

  async importFlow(flowData) {
    if (!flowData.name || !flowData.steps) {
      throw new Error('Datos de flujo inválidos: necesita name y steps');
    }

    return this.create(flowData);
  }

  async _persistFlows() {
    let savedToDb = false;
    let savedToFile = false;

    // CRÍTICO: Supabase es la fuente de verdad. Guardar aquí PRIMERO.
    if (this.supabase) {
      try {
        await this.supabase
          .from('app_flows')
          .upsert({
            id: 1,
            config: state.flowsConfig,
            updated_at: new Date().toISOString()
          });
        savedToDb = true;
      } catch (e) {
        console.error('❌ Error guardando flujos en Supabase:', e.message);
      }
    }

    // flows.json es BACKUP: se regenera desde state.flowsConfig (que viene de Supabase)
    try {
      const filePath = path.join(__dirname, '..', '..', '..', 'flows.json');
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(state.flowsConfig, null, 2)
      );
      savedToFile = true;
    } catch (e) {
      if (!savedToDb) throw e;
      console.error('⚠️ Error guardando flows.json:', e.message);
    }

    // Validación de sincronización (verboso, pero necesario para debugging)
    if (savedToDb && savedToFile) {
      const dbCount = state.flowsConfig.flows?.length || 0;
      console.log(`✅ Flujos sincronizados: Supabase + flows.json (${dbCount} flujos)`);
    } else if (savedToDb && !savedToFile) {
      console.warn(`⚠️ Supabase guardado, pero flows.json falló (el backup puede estar desactualizado)`);
    }
  }
}

module.exports = FlowRepository;
