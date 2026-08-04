class HandleCommentUseCase {
  constructor({ metaGateway, openaiGateway, flowGateway, supabaseGateway, state, flowsConfig, broadcastLog, recentReplies }) {
    this.meta = metaGateway;
    this.openai = openaiGateway;
    this.flow = flowGateway;
    this.db = supabaseGateway;
    this.state = state;
    this.flowsConfig = flowsConfig;
    this.broadcastLog = broadcastLog;
    this.recentReplies = recentReplies;
  }

  async execute({ commentId, text, fromName, fromId }) {
    if (fromId === this.state.INSTAGRAM_ACCOUNT_ID || (this.state.BOT_USERNAME && fromName === this.state.BOT_USERNAME)) {
      return { status: 'self_comment' };
    }

    if (this.recentReplies.has(commentId)) {
      return { status: 'duplicate_reply' };
    }

    this.recentReplies.add(commentId);
    setTimeout(() => this.recentReplies.delete(commentId), 60000);
    this.broadcastLog('COMMENT', `@${fromName} comentó: "${text}"`);

    const commentTriggers = this.flowsConfig.commentTriggers || [];
    const lowerText = this.openai.removeAccents(text).toLowerCase();
    let matched = null;

    for (const trigger of commentTriggers) {
      if (!trigger.keywords || trigger.keywords.length === 0) continue;
      const matchType = trigger.matchType || 'contains';
      const found = trigger.keywords.find(kw => {
        const cleanKw = this.openai.removeAccents(kw).toLowerCase();
        if (matchType === 'exact') return lowerText === cleanKw;
        if (matchType === 'starts_with') return lowerText.startsWith(cleanKw);
        return lowerText.includes(cleanKw);
      });
      if (found) { matched = trigger; break; }
    }

    if (matched) {
      const replyPool = matched.commentPublicReplies?.length ? matched.commentPublicReplies : (matched.publicReply ? [matched.publicReply] : []);
      if (replyPool.length) {
        const pick = replyPool[Math.floor(Math.random() * replyPool.length)];
        await this.meta.replyComment(commentId, pick.replace('{username}', fromName));
      }
      if (matched.privateReply) {
        await this.meta.sendPrivateReply(commentId, matched.privateReply.replace('{username}', fromName));
      }
      return { status: 'matched', trigger: matched };
    } else {
      await this.meta.replyComment(commentId, `Gracias @${fromName} por tu comentario! 🙌`);
      await this.meta.sendPrivateReply(commentId, `Hola @${fromName}! Vimos tu comentario: "${text}". Te escribimos por aquí para darte una atención más personalizada. ¿En qué podemos ayudarte?`);
      return { status: 'default_reply' };
    }
  }
}

module.exports = HandleCommentUseCase;
