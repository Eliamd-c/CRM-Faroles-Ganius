class HandleAttachmentsUseCase {
  constructor({ metaGateway, supabaseGateway, broadcastLog }) {
    this.meta = metaGateway;
    this.db = supabaseGateway;
    this.broadcastLog = broadcastLog;
  }

  async execute({ senderId, attachments, mid }) {
    if (!attachments || attachments.length === 0) {
      return { status: 'no_attachments' };
    }

    const profile = await this.meta.getUserProfile(senderId);
    const senderName = profile?.name || senderId;

    const results = [];

    for (const attachment of attachments) {
      const { type, payload } = attachment;
      const url = payload?.url;

      this.broadcastLog('ATTACHMENT', `@${senderName} envió ${type}: ${url}`, profile);

      await this.meta.logMessage(senderId, 'inbound', type, `[${type}]`, mid, {
        attachment_type: type,
        attachment_url: url
      });

      results.push({
        type,
        url,
        status: 'logged'
      });
    }

    return {
      status: 'attachments_processed',
      count: results.length,
      attachments: results
    };
  }
}

module.exports = HandleAttachmentsUseCase;
