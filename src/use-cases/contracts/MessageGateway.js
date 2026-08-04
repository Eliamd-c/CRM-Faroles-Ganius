class MessageGateway {
  async getUserProfile(senderId) {
    throw new Error('Method not implemented.');
  }

  async sendMessage(senderId, text) {
    throw new Error('Method not implemented.');
  }

  async replyComment(commentId, text) {
    throw new Error('Method not implemented.');
  }

  async sendPrivateReply(commentId, text) {
    throw new Error('Method not implemented.');
  }
}

module.exports = MessageGateway;
