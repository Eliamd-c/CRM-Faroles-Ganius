// Meta Gateway Adapter
// Wraps meta.service to abstract Instagram API calls

const meta = require('../../services/meta.service');

class MetaGateway {
  // User profile operations
  async getUserProfile(senderId) {
    return meta.getUserProfile(senderId);
  }

  // Message operations - Text
  async sendMessage(recipientId, text, quickReplies = null) {
    return meta.sendMessage(recipientId, text, quickReplies);
  }

  // Message operations - Template
  async sendTemplate(recipientId, text, buttons) {
    return meta.sendTemplate(recipientId, text, buttons);
  }

  // Message operations - Quick Replies
  async sendQuickReplies(recipientId, text, replies) {
    return meta.sendQuickReplies(recipientId, text, replies);
  }

  // Message operations - Media
  async sendMediaMessage(recipientId, url, type = 'image') {
    return meta.sendMediaMessage(recipientId, url, type);
  }

  async sendCard(recipientId, elements) {
    return meta.sendCard(recipientId, elements);
  }

  async sendCarousel(recipientId, elements) {
    return meta.sendCarousel(recipientId, elements);
  }

  async sendGallery(recipientId, elements) {
    return meta.sendGallery(recipientId, elements);
  }

  async sendAudio(recipientId, url) {
    return meta.sendAudio(recipientId, url);
  }

  async sendVideo(recipientId, url) {
    return meta.sendVideo(recipientId, url);
  }

  async sendFile(recipientId, url) {
    return meta.sendFile(recipientId, url);
  }

  // Comments
  async replyComment(commentId, message) {
    return meta.replyComment(commentId, message);
  }

  // Mentions
  async sendPrivateReply(eventId, message) {
    return meta.sendPrivateReply(eventId, message);
  }

  // Logging
  async logMessage(instagramId, direction, type, content, mid = null, extra = {}) {
    return meta.logMessageToDB(instagramId, direction, type, content, mid, extra);
  }

  // Validation & Config
  async validarToken(token) {
    return meta.validarToken(token);
  }

  async initBot(token, accountId) {
    return meta.initBot(token, accountId);
  }

  async loadAppConfig() {
    return meta.loadAppConfig();
  }
}

module.exports = MetaGateway;
