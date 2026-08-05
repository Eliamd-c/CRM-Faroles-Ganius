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
    // LANGGRAPH ORCHESTRATION (Brain)
    // ============================================
    console.log(`[Router] Delegando mensaje de "${senderName}" a LangGraph`);
    
    try {
      // Lazy load to avoid circular dependencies if any
      const langGraphService = require('../services/langgraph.service');
      
      const result = await langGraphService.processConversation(senderId, text, contact);
      
      if (result.action === 'pause_bot') {
        contact.switchToPaused();
        await this.db.updateContact(contact);
        if (result.reply) {
          await this._sendInChunks(senderId, result.reply);
        }
        this.broadcastLog('SYSTEM', `Bot pausado por LangGraph para el usuario ${senderName}`);
        return { status: 'bot_paused_by_ai', contact };
      } else if (result.action === 'send_message' && result.reply) {
        await this._sendInChunks(senderId, result.reply);
        this.broadcastLog('SYSTEM', `LangGraph respondió a ${senderName}`);
        return { status: 'ai_handled', contact };
      } else if (result.action === 'error') {
        this.broadcastLog('SYSTEM', `❌ Error interno en LangGraph: ${result.reply}`);
        return { status: 'error', contact };
      }
      
      return { status: 'handled', contact };
    } catch (err) {
      console.error('[LangGraph] Error en ejecución principal (SPOF):', err);
      this.broadcastLog('SYSTEM', `❌ Excepción grave en el orquestador: ${err.message}`);
      
      // Contingencia Absoluta (SPOF 1): Enviar mensaje directo vía Meta sin usar IA ni flujos
      try {
        await this.meta.sendMessage(senderId, "Nuestro sistema inteligente se encuentra en mantenimiento momentáneo. 🛠️ Un asesor humano te contactará muy pronto para continuar tu atención.");
        contact.switchToPaused();
        await this.db.updateContact(contact);
        this.broadcastLog('SYSTEM', `Bot pausado por contingencia para el usuario ${senderName}`);
      } catch (metaErr) {
        console.error('[LangGraph] Falló también la contingencia hacia Meta:', metaErr.message);
      }
      
      return { status: 'error', contact, error: err.message };
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================
  
  async _sendInChunks(targetId, text) {
    if (!text) return;
    const chunks = text.match(/[\s\S]{1,950}/g) || [];
    for (const chunk of chunks) {
      await this.meta.sendMessage(targetId, chunk);
      await new Promise(r => setTimeout(r, 500)); // Pequeña pausa entre mensajes
    }
  }

  _checkExitPattern(text) {
    const lowerTxt = text.trim().toLowerCase().replace(/\s+/g, ' ');
    const patterns = [/^(salir|exit|quit|menu|menú)$/, /^(volver al menú|menu principal)$/];
    return patterns.some(p => p.test(lowerTxt));
  }


}

module.exports = HandleIncomingMessageUseCase;
