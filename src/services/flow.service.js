const fs = require('fs');
const path = require('path');
const { state, broadcastLog } = require('../shared');
const supabase = require('../../db');
const meta = require('./meta.service');

// Lazy-loaded to avoid circular dependency
let openaiService = null;
function getOpenAI() {
  if (!openaiService) openaiService = require('./openai.service');
  return openaiService;
}

// Lazy-loaded to avoid circular dependency with sequences
let subscribeToSequenceFn = null;
function setSubscribeToSequence(fn) { subscribeToSequenceFn = fn; }

async function saveFlowsConfig() {
  let savedToDb = false;
  if (supabase) {
    try {
      const { error } = await supabase
        .from('app_flows')
        .upsert({ id: 1, config: state.flowsConfig, updated_at: new Date().toISOString() });
      if (!error) savedToDb = true;
      else console.error('❌ Error guardando flujos en Supabase:', error.message);
    } catch (e) {
      console.error('❌ Excepción guardando flujos en Supabase:', e.message);
    }
  }
  try {
    await fs.promises.writeFile(
      path.join(__dirname, '..', '..', 'flows.json'),
      JSON.stringify(state.flowsConfig, null, 2)
    );
  } catch (e) {
    if (!savedToDb) throw e;
  }
}

async function loadFlowsFromSupabase() {
  if (!supabase) {
    console.warn('⚠️ Supabase no conectado: los flujos se leen/escriben solo en flows.json (NO persisten entre despliegues).');
    return;
  }
  try {
    const { data, error } = await supabase.from('app_flows').select('config').eq('id', 1).single();
    if (error) {
      if (error.code === 'PGRST116' || /no rows|0 rows/i.test(error.message || '')) {
        console.log('ℹ️ No hay flujos guardados en Supabase todavía. Sembrando con flows.json...');
        await saveFlowsConfig();
      } else {
        console.error('⚠️ No se pudieron cargar flujos de Supabase, se usa flows.json:', error.message);
      }
      return;
    }
    if (data && data.config && Array.isArray(data.config.flows)) {
      state.flowsConfig = data.config;
      console.log(`✅ Flujos cargados desde Supabase (${state.flowsConfig.flows.length} flujos) — persistentes entre despliegues.`);
    }
  } catch (e) {
    console.error('⚠️ Excepción cargando flujos de Supabase, se usa flows.json:', e.message);
  }
}

function loadFlowsFromFile() {
  try {
    let filePath = path.join(__dirname, '..', '..', 'flows.json');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, '..', '..', 'flows.json.example');
      if (fs.existsSync(filePath)) {
        console.log('ℹ️ flows.json no encontrado. Usando flows.json.example como semilla...');
      }
    }
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath);
      state.flowsConfig = JSON.parse(rawData);
      console.log('✅ Flujos cargados correctamente.');
      let migrated = false;
      for (const flow of (state.flowsConfig.flows || [])) {
        if (flow.enabled === undefined) { flow.enabled = true; migrated = true; }
        if (!flow.createdAt) { flow.createdAt = new Date().toISOString(); migrated = true; }
        if (!flow.updatedAt) { flow.updatedAt = new Date().toISOString(); migrated = true; }
      }
      if (migrated) {
        fs.writeFileSync(path.join(__dirname, '..', '..', 'flows.json'), JSON.stringify(state.flowsConfig, null, 2));
        console.log('✅ flows.json migrado: campos enabled/createdAt/updatedAt añadidos');
      }
    } else {
      console.warn('⚠️ flows.json ni flows.json.example encontrados. Usando configuración vacía por defecto.');
    }
  } catch (err) {
    console.error('❌ Error al cargar flows.json:', err.message);
  }
}

async function processFlowSteps(steps, senderId, senderName, _visited = new Set(), triggerText = null) {
  let customer = null;
  if (supabase) {
    try {
      const { data } = await supabase.from('customers').select('*').eq('instagram_id', senderId).single();
      customer = data;
    } catch (e) {
      console.error('[DB] Error fetching customer for flow steps:', e.message);
    }
  }

  const interpolate = (txt) => {
    if (!txt || typeof txt !== 'string') return txt;
    let replaced = txt.replace('{username}', senderName);
    replaced = replaced.replace(/\{\{([\w\s_-]+)\}\}/g, (match, fieldName) => {
      const key = fieldName.trim();
      if (key === 'name' || key === 'username') return customer?.name || senderName;
      if (customer?.fields && customer.fields[key] !== undefined && customer.fields[key] !== null) {
        return customer.fields[key];
      }
      return '';
    });
    return replaced;
  };

  for (const step of steps) {
    if (step.type === 'text') {
      await meta.sendMessage(senderId, interpolate(step.message));
    } else if (step.type === 'buttons') {
      await meta.sendMessage(senderId, interpolate(step.message), step.buttons);
    } else if (step.type === 'template') {
      await meta.sendTemplate(senderId, interpolate(step.message), step.buttons);
    } else if (step.type === 'card') {
      const cardData = { ...step.card, title: interpolate(step.card.title), subtitle: interpolate(step.card.subtitle) };
      await meta.sendCard(senderId, cardData, interpolate(step.message));
    } else if (step.type === 'action') {
      await executeAction(senderId, senderName, step);
    } else if (step.type === 'condition') {
      let conditionMet = false;
      const fieldVal = (step.field === 'name') ? (customer?.name || '') : (customer?.fields?.[step.field] || '');
      const v1 = String(fieldVal).toLowerCase().trim();
      const v2 = String(step.value || '').toLowerCase().trim();
      if (step.operator === '==') conditionMet = (v1 === v2);
      else if (step.operator === '!=') conditionMet = (v1 !== v2);
      else if (step.operator === '>') conditionMet = (Number(v1) > Number(v2));
      else if (step.operator === '<') conditionMet = (Number(v1) < Number(v2));
      else if (step.operator === 'contains') conditionMet = (v1.includes(v2));
      else if (step.operator === 'not_contains') conditionMet = (!v1.includes(v2));
      const nextFlowId = conditionMet ? step.truePayload : step.falsePayload;
      if (nextFlowId && !_visited.has(nextFlowId)) {
        _visited.add(nextFlowId);
        const nextFlow = state.flowsConfig.flows.find(f => f.id === `flow_${nextFlowId}`);
        if (nextFlow) await processFlowSteps(nextFlow.steps, senderId, senderName, _visited, triggerText);
      }
      break;
    } else if (step.type === 'randomizer') {
      if (step.paths && step.paths.length > 0) {
        const randomPayload = step.paths[Math.floor(Math.random() * step.paths.length)];
        if (randomPayload && !_visited.has(randomPayload)) {
          _visited.add(randomPayload);
          const nextFlow = state.flowsConfig.flows.find(f => f.id === `flow_${randomPayload}`);
          if (nextFlow) await processFlowSteps(nextFlow.steps, senderId, senderName, _visited, triggerText);
        }
      }
      break;
    } else if (step.type === 'input') {
      const replyText = interpolate(step.prompt) || 'Por favor responde:';
      await meta.sendMessage(senderId, replyText);
      if (supabase) {
        await supabase.from('customers').update({
          bot_state: 'awaiting_input',
          awaiting_input_type: step.inputType || 'text',
          awaiting_input_field: step.field,
          awaiting_input_prompt: step.retryMessage || 'Intenta de nuevo:',
          awaiting_input_retries: 0,
          current_flow_id: step.successPayload,
          current_step_index: step.failPayload
        }).eq('instagram_id', senderId);
      }
      break;
    } else if (step.type === 'carousel') {
      await meta.sendCarousel(senderId, step.elements || []);
    } else if (step.type === 'gallery') {
      await meta.sendGallery(senderId, step.images || [], step.delay_between_ms || 300);
    } else if (step.type === 'audio') {
      await meta.sendAudio(senderId, step.audio_url);
    } else if (step.type === 'video') {
      await meta.sendVideo(senderId, step.video_url);
    } else if (step.type === 'file') {
      await meta.sendFile(senderId, step.file_url);
    } else if (step.type === 'delay') {
      const ms = Math.min((step.seconds || 1) * 1000, 15 * 60 * 1000);
      await new Promise(resolve => setTimeout(resolve, ms));
    } else if (step.type === 'goto') {
      const targetId = step.flow_id;
      if (targetId && !_visited.has(targetId)) {
        _visited.add(targetId);
        const targetFlow = state.flowsConfig.flows.find(f => f.id === `flow_${targetId}` || f.id === targetId);
        if (targetFlow) await processFlowSteps(targetFlow.steps, senderId, senderName, _visited, triggerText);
        else broadcastLog('WARNING', `Goto: Flujo no encontrado: ${targetId}`);
      }
      break;
    } else if (step.type === 'ai_agent') {
      if (supabase) {
        await supabase.from('customers').update({
          bot_state: 'active',
          current_ai_prompt: step.system_prompt || '',
          ignore_master_context: step.ignore_master_context || false,
          ai_history: []
        }).eq('instagram_id', senderId);
        broadcastLog('SYSTEM', `Cerebro LangGraph activado para ${senderName}${step.ignore_master_context ? ' (modo standalone)' : ' (con Contexto Maestro)'}`);
        
        if (triggerText && customer) {
          customer.current_ai_prompt = step.system_prompt || '';
          customer.ignore_master_context = step.ignore_master_context || false;
          customer.bot_state = 'active';
          
          const langGraph = require('./langgraph.service');
          const meta = require('./meta.service');
          
          // Ejecución asíncrona ("Fire and forget")
          langGraph.processConversation(senderId, triggerText, customer).then(async (result) => {
            if (result.action === 'pause_bot') {
              await supabase.from('customers').update({ bot_paused: true }).eq('instagram_id', senderId);
              await meta.sendMessage(senderId, result.reply);
            } else if (result.action === 'send_message' && result.reply) {
              await meta.sendMessage(senderId, result.reply);
            }
          }).catch(err => console.error('[LangGraph Flow Trigger] Error:', err));
        }
      } else {
        console.warn('⚠️ Supabase no conectado. No se puede activar el Agente IA.');
      }
      break;
    }
  }
}

async function executeAction(senderId, senderName, step) {
  if (!supabase) {
    console.warn('⚠️ Supabase no conectado. No se ejecutó la acción:', step.actionType);
    return;
  }
  const { actionType, params } = step;
  console.log(`[ACTION] Ejecutando acción: ${actionType} para el usuario ${senderId}`);
  try {
    let { data: customer, error: fetchErr } = await supabase
      .from('customers').select('*').eq('instagram_id', senderId).single();
    if (fetchErr || !customer) {
      const { data: newCust, error: insertErr } = await supabase
        .from('customers').insert([{ instagram_id: senderId, name: senderName }]).select().single();
      if (insertErr) { console.error('❌ Error creando cliente:', insertErr.message); return; }
      customer = newCust;
    }
    let updates = {};
    switch (actionType) {
      case 'add_tag': {
        const tag = params.tag?.trim();
        if (tag) { const tags = new Set(customer.tags || []); tags.add(tag); updates.tags = Array.from(tags); }
        break;
      }
      case 'remove_tag': {
        const tag = params.tag?.trim();
        if (tag) { const tags = new Set(customer.tags || []); tags.delete(tag); updates.tags = Array.from(tags); }
        break;
      }
      case 'set_field': {
        const field = params.field?.trim();
        const value = params.value?.trim();
        if (field) updates.fields = { ...(updates.fields || customer.fields), [field]: value };
        break;
      }
      case 'clear_field': {
        const field = params.field?.trim();
        if (field) { updates.fields = { ...(updates.fields || customer.fields) }; delete updates.fields[field]; }
        break;
      }
      case 'compute': {
        const field = params.field?.trim();
        const operator = params.operator || '*';
        const currentFields = updates.fields || customer.fields || {};
        const resolveOperand = (val) => {
          if (val === undefined || val === null || val === '') return NaN;
          const fieldVal = currentFields[val];
          return Number(fieldVal !== undefined ? fieldVal : val);
        };
        const a = resolveOperand(params.operand1);
        const b = resolveOperand(params.operand2);
        if (field && !isNaN(a) && !isNaN(b)) {
          let result;
          if (operator === '+') result = a + b;
          else if (operator === '-') result = a - b;
          else if (operator === '/') result = b !== 0 ? a / b : 0;
          else result = a * b;
          updates.fields = { ...currentFields, [field]: result };
        }
        break;
      }
      case 'delete_contact': {
        await supabase.from('customers').delete().eq('instagram_id', senderId);
        broadcastLog('SYSTEM', `Contacto eliminado permanentemente: ${senderName}`);
        return;
      }
      case 'pause_bot': { updates.bot_paused = true; break; }
      case 'resume_bot': { updates.bot_paused = false; break; }
      case 'mark_open': { updates.status = 'open'; break; }
      case 'mark_closed': { updates.status = 'closed'; break; }
      case 'subscribe_sequence': {
        const seqId = params.sequence_id;
        if (seqId && subscribeToSequenceFn) {
          await subscribeToSequenceFn(senderId, seqId);
          broadcastLog('SYSTEM', `${senderName} suscrito a secuencia ${seqId}`);
        }
        return;
      }
      case 'unsubscribe_sequence': {
        const seqId = params.sequence_id;
        if (seqId) {
          await supabase.from('sequence_subscriptions')
            .update({ is_unsubscribed: true })
            .eq('instagram_id', senderId).eq('sequence_id', seqId);
          broadcastLog('SYSTEM', `${senderName} desuscrito de secuencia ${seqId}`);
        }
        return;
      }
      default:
        if (step.tag) {
          const tags = new Set(customer.tags || []); tags.add(step.tag); updates.tags = Array.from(tags);
        } else {
          console.log(`[ACTION] Tipo de acción desconocida: ${actionType}`);
        }
        break;
    }
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: updateErr } = await supabase.from('customers').update(updates).eq('instagram_id', senderId);
      if (updateErr) console.error(`❌ Error actualizando cliente en acción ${actionType}:`, updateErr.message);
      else broadcastLog('SYSTEM', `Acción ${actionType || 'legacy'} ejecutada para ${senderName}`);
    }
  } catch (error) {
    console.error('[ACTION] Excepción general:', error.message);
  }
}

module.exports = {
  saveFlowsConfig,
  loadFlowsFromSupabase,
  loadFlowsFromFile,
  processFlowSteps,
  executeAction,
  setSubscribeToSequence,
};
