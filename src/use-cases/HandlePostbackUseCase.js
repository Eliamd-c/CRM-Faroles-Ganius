class HandlePostbackUseCase {
  constructor({ metaGateway, openaiGateway, flowGateway, supabaseGateway, state, flowsConfig, broadcastLog }) {
    this.meta = metaGateway;
    this.openai = openaiGateway;
    this.flow = flowGateway;
    this.db = supabaseGateway;
    this.state = state;
    this.flowsConfig = flowsConfig;
    this.broadcastLog = broadcastLog;
  }

  async execute({ senderId, payload, title, event }) {
    if (!senderId || !payload) return { status: 'invalid_postback' };

    const profile = await this.meta.getUserProfile(senderId);
    const senderName = profile?.name || senderId;

    this.broadcastLog('POSTBACK', `@${senderName} presionó botón: ${title}`, profile);

    const contact = await this.db.getContactByInstagramId(senderId);
    if (!contact) {
      this.broadcastLog('SYSTEM', `Postback de usuario desconocido: ${senderId}`);
      return { status: 'contact_not_found' };
    }

    const flow = this.flowsConfig.flows.find(f => f.id === payload || f.id === `flow_${payload}`);
    if (flow && flow.steps) {
      this.broadcastLog('SYSTEM', `Ejecutando flow desde postback: ${flow.id}`);
      await this.flow.processFlowSteps(flow.steps, senderId, senderName, new Set(), payload);
      return { status: 'flow_executed', flow };
    }

    return { status: 'no_flow_found', payload };
  }
}

module.exports = HandlePostbackUseCase;
