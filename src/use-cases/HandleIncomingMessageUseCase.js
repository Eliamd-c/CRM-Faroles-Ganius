// Use Case: Handle Incoming Message
// Orchestrates all business logic for processing incoming messages

const Contact = require('../domain/entities/Contact');

class HandleIncomingMessageUseCase {
  constructor({ metaGateway, openaiGateway, flowGateway, supabaseGateway, state, flowsConfig, broadcastLog }) {
    this.meta = metaGateway;
    this.openai = openaiGateway;
    this.flow = flowGateway;
    this.db = supabaseGateway;
    this.state = state;
    this.flowsConfig = flowsConfig;
    this.broadcastLog = broadcastLog;
  }

  async execute(inputData) {
    const { senderId, text, storyMention, hasAttachments, event } = inputData;

    if (!senderId) throw new Error('Missing senderId');
    if (String(senderId).trim() === String(this.state.INSTAGRAM_ACCOUNT_ID).trim()) return { status: 'self_message' };
    if (!text && !storyMention && !hasAttachments) return { status: 'no_content' };

    // Get sender profile
    const profile = await this.meta.getUserProfile(senderId);
    const senderName = profile?.name || senderId;

    // Handle story mention
    if (storyMention) {
      this.broadcastLog('STORY', `@${senderName} te mencionó en su historia.`, profile);
      await this.meta.logMessage(senderId, 'inbound', 'story_mention', '[Mención en historia]');
      await this.meta.sendMessage(senderId, `¡Hola @${senderName}! 👋 ¡Gracias por mencionarnos en tu historia! Nos encanta ❤️`);
      return { status: 'story_mention_handled' };
    }

    // Log message
    this.broadcastLog('DM', `Recibido de ${senderName}: "${text}"`, profile);
    const msgExtra = {};
    if (event?.message?.reply_to?.mid) msgExtra.reply_to_mid = event.message.reply_to.mid;
    if (event?.message?.quick_reply) msgExtra.metadata = { quick_reply: event.message.quick_reply.payload };
    if (event?.message?.referral) msgExtra.metadata = { ...msgExtra.metadata, referral: event.message.referral };
    await this.meta.logMessage(senderId, 'inbound', 'text', text || (hasAttachments ? '[Adjunto/s]' : ''), event?.message?.mid, msgExtra);

    // Get or create contact
    let contact = await this.db.getContactByInstagramId(senderId);
    if (!contact) {
      const newContact = Contact.new(senderId, senderName, profile);
      contact = await this.db.createContact(newContact);
      this.broadcastLog('SYSTEM', `Nuevo contacto creado: ${senderName}`);

      // Execute welcome flow if exists
      if (this.flowsConfig.welcomeFlow?.steps?.length > 0) {
        this.broadcastLog('SYSTEM', `Ejecutando Welcome Flow para ${senderName}`);
        await this.flow.processFlowSteps(this.flowsConfig.welcomeFlow.steps, senderId, senderName, new Set(), text);
        return { status: 'new_contact_welcomed', contact };
      }
      return { status: 'new_contact_created', contact };
    }

    // Update profile if changed
    if (profile) {
      let needsUpdate = false;
      if (profile.name && profile.name !== contact.name) {
        contact.name = profile.name;
        needsUpdate = true;
      }
      if (profile.profile_pic && profile.profile_pic !== contact.profilePicUrl) {
        contact.profilePicUrl = profile.profile_pic;
        needsUpdate = true;
      }
      if (needsUpdate) {
        await this.db.updateContact(contact);
      }
    }

    // Check if bot is paused
    if (contact.isPaused()) {
      console.log(`[IGNORE] Bot pausado para el usuario ${senderId}`);
      return { status: 'bot_paused', contact };
    }

    // ============================================
    // STATE-SPECIFIC HANDLERS (NO GUARD CONDITION)
    // ============================================

    // Handle awaiting input state
    if (contact.isAwaitingInput()) {
      return await this._handleAwaitingInput(senderId, senderName, text, contact);
    }

    // ============================================
    // FLOW MATCHING (Active state)
    // ============================================

    const matchedFlow = this._findMatchingFlow(text);
    if (matchedFlow && matchedFlow.steps) {
      matchedFlow.executionCount = (matchedFlow.executionCount || 0) + 1;
      matchedFlow.lastExecutedAt = new Date().toISOString();
      this.flow.saveFlowsConfig().catch(err => console.warn('⚠️ Error guardando flujos:', err.message));
      await this.flow.processFlowSteps(matchedFlow.steps, senderId, senderName, new Set(), text);
      return { status: 'flow_matched', contact, flow: matchedFlow };
    }

    // Try smart trigger with AI
    console.log(`[Smart Trigger] Buscando intención con IA para: "${text}"`);
    const smartFlowId = await this.openai.detectIntentWithAI(text, this.flowsConfig.flows, senderId);
    if (smartFlowId) {
      console.log(`[Smart Trigger] Intención detectada. Ejecutando flujo: ${smartFlowId}`);
      const smartFlow = this.flowsConfig.flows.find(f => f.id === smartFlowId);
      if (smartFlow && smartFlow.steps) {
        smartFlow.executionCount = (smartFlow.executionCount || 0) + 1;
        smartFlow.lastExecutedAt = new Date().toISOString();
        this.flow.saveFlowsConfig().catch(err => console.warn('⚠️ Error guardando smart trigger:', err.message));
        await this.flow.processFlowSteps(smartFlow.steps, senderId, senderName, new Set(), text);
        return { status: 'smart_trigger_matched', contact, flow: smartFlow };
      }
    }

    // Fallback to default flow
    if (this.flowsConfig.defaultFlow?.steps) {
      console.log(`[Router] No hubo coincidencia. Ejecutando Default Flow.`);
      await this.flow.processFlowSteps(this.flowsConfig.defaultFlow.steps, senderId, senderName, new Set(), text);
      return { status: 'default_flow_executed', contact };
    }

    return { status: 'no_match', contact };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  _checkExitPattern(text) {
    const lowerTxt = text.trim().toLowerCase().replace(/\s+/g, ' ');
    const patterns = [/^(salir|exit|quit|menu|menú)$/, /^(volver al menú|menu principal)$/];
    return patterns.some(p => p.test(lowerTxt));
  }

  _validateInput(text, inputType) {
    const lowerTxt = text.trim();
    if (inputType === 'email') return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(lowerTxt);
    if (inputType === 'phone') return /^\+?[\d\s-]{7,15}$/.test(lowerTxt);
    if (inputType === 'number') return /^-?\d+(\.\d+)?$/.test(lowerTxt);
    if (inputType === 'url') return /^https?:\/\/.+\..+/.test(lowerTxt);
    if (inputType === 'date') return !isNaN(Date.parse(lowerTxt));
    if (inputType === 'choice') {
      // This will be handled separately
      return true;
    }
    return lowerTxt.length > 0;
  }

  async _handleAwaitingInput(senderId, senderName, text, contact) {
    const inputType = contact.awaitingInputType;
    const lowerTxt = text.trim();

    let isValid = false;
    if (inputType === 'email') {
      isValid = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(lowerTxt);
    } else if (inputType === 'phone') {
      isValid = /^\+?[\d\s-]{7,15}$/.test(lowerTxt);
    } else if (inputType === 'number') {
      isValid = /^-?\d+(\.\d+)?$/.test(lowerTxt);
    } else if (inputType === 'url') {
      isValid = /^https?:\/\/.+\..+/.test(lowerTxt);
    } else if (inputType === 'date') {
      isValid = !isNaN(Date.parse(lowerTxt));
    } else if (inputType === 'choice') {
      const choices = (contact.awaitingInputChoices || '').split(',').map(c => c.trim().toLowerCase());
      isValid = choices.includes(lowerTxt.toLowerCase());
    } else {
      isValid = lowerTxt.length > 0;
    }

    if (isValid) {
      contact.switchToActive();
      if (contact.awaitingInputField) contact.setField(contact.awaitingInputField, lowerTxt);
      await this.db.updateContact(contact);
      this.broadcastLog('SYSTEM', `Dato capturado: ${lowerTxt} guardado`);
      if (contact.currentFlowId) {
        const successFlow = this.flowsConfig.flows.find(f => f.id === `flow_${contact.currentFlowId}`);
        if (successFlow && successFlow.steps) await this.flow.processFlowSteps(successFlow.steps, senderId, senderName);
      }
      return { status: 'input_captured', contact };
    } else {
      contact.incrementRetries();
      const retries = contact.awaitingInputRetries;
      if (retries >= 3) {
        contact.switchToActive();
        contact.awaitingInputRetries = 0;
        await this.db.updateContact(contact);
        return { status: 'max_retries_reached', contact };
      } else {
        await this.db.updateContact(contact);
        await this.meta.sendMessage(senderId, contact.awaitingInputPrompt || "Formato inválido. Intenta de nuevo:");
        return { status: 'input_invalid', contact, retries };
      }
    }
  }

  _findMatchingFlow(text) {
    const normalizedText = this.openai.removeAccents(text);
    const lowerText = normalizedText.toLowerCase();
    for (const f of this.flowsConfig.flows) {
      if (f.enabled === false) continue;
      if (!f.keywords || f.keywords.length === 0) continue;
      const matchType = f.matchType || 'contains';
      if (matchType === 'contains') {
        const match = f.keywords.find(kw => {
          const cleanKw = kw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
          return lowerText.includes(cleanKw);
        });
        if (match) return f;
      } else if (matchType === 'exact') {
        const match = f.keywords.find(kw => lowerText === kw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
        if (match) return f;
      } else if (matchType === 'starts_with') {
        const match = f.keywords.find(kw => lowerText.startsWith(kw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")));
        if (match) return f;
      } else if (matchType === 'regex') {
        const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = f.keywords.some(kw => {
          try { return new RegExp('\\b' + escapeRegExp(kw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")) + '\\b', 'i').test(lowerText); }
          catch (e) { return false; }
        });
        if (match) return f;
      }
    }
    return null;
  }
}

module.exports = HandleIncomingMessageUseCase;
