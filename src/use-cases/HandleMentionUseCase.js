class HandleMentionUseCase {
  constructor({ metaGateway, flowGateway, state, flowsConfig, broadcastLog }) {
    this.meta = metaGateway;
    this.flow = flowGateway;
    this.state = state;
    this.flowsConfig = flowsConfig;
    this.broadcastLog = broadcastLog;
  }

  async execute({ mentionId, commentId, mediaId }) {
    const actualMentionId = mentionId || commentId || mediaId;
    
    if (!actualMentionId) {
      return { status: 'invalid_mention' };
    }

    this.broadcastLog('MENTION', `Alguien te mencionó en una publicación (ID: ${actualMentionId})`);

    if (this.flowsConfig.mentionFlow?.steps?.length > 0) {
      const firstStep = this.flowsConfig.mentionFlow.steps[0];
      let replyText = '¡Gracias por mencionarnos! 🙌';
      
      if (firstStep.type === 'message' && firstStep.message) {
        replyText = firstStep.message;
      }

      await this.replyToMention(actualMentionId, replyText);
      return { status: 'mention_replied', text: replyText };
    }

    return { status: 'no_mention_flow' };
  }

  async replyToMention(mentionId, text) {
    if (!this.state.ACCESS_TOKEN || !this.state.INSTAGRAM_ACCOUNT_ID) {
      return { status: 'no_credentials' };
    }

    try {
      const payload = new URLSearchParams();
      payload.append('message', text);
      payload.append('access_token', this.state.ACCESS_TOKEN);
      if (mentionId) payload.append('comment_id', mentionId);
      
      const axios = require('axios');
      await axios.post(`https://graph.instagram.com/v26.0/${this.state.INSTAGRAM_ACCOUNT_ID}/mentions`, payload);
      
      console.log(`✅ Respuesta a mención enviada a ${mentionId}`);
      this.broadcastLog('SYSTEM', `Comentario de respuesta publicado en la mención ${mentionId}`);
      return { status: 'replied' };
    } catch (err) {
      console.error(`❌ Error enviando respuesta a mención ${mentionId}:`, err.response?.data || err.message);
      this.broadcastLog('ERROR', `Falló respuesta a mención: ${err.message}`);
      return { status: 'error', error: err.message };
    }
  }
}

module.exports = HandleMentionUseCase;
