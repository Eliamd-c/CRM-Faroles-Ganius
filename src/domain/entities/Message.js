// Domain Entity: Message
// Represents a message in the conversation

class Message {
  constructor(data) {
    this.mid = data.mid;
    this.instagramId = data.instagram_id;
    this.text = data.content || '';
    this.type = data.message_type || 'text';
    this.direction = data.direction; // 'inbound' | 'outbound'
    this.attachmentType = data.attachment_type;
    this.attachmentUrl = data.attachment_url;
    this.replyToMid = data.reply_to_mid;
    this.metadata = data.metadata || {};
    this.timestamp = data.timestamp || Date.now();
    this.createdAt = data.created_at;
  }

  // Factory: Create new outbound message
  static new(instagramId, text, type = 'text') {
    return new Message({
      instagram_id: instagramId,
      content: text,
      message_type: type,
      direction: 'outbound',
      timestamp: Date.now(),
      created_at: new Date().toISOString()
    });
  }

  // Factory: Create from database
  static fromDatabase(dbRow) {
    return new Message(dbRow);
  }

  // State queries
  isInbound() {
    return this.direction === 'inbound';
  }

  isOutbound() {
    return this.direction === 'outbound';
  }

  hasAttachment() {
    return !!this.attachmentUrl;
  }

  isReply() {
    return !!this.replyToMid;
  }

  // Conversions
  toDatabase() {
    return {
      mid: this.mid,
      instagram_id: this.instagramId,
      direction: this.direction,
      message_type: this.type,
      content: this.text,
      attachment_type: this.attachmentType,
      attachment_url: this.attachmentUrl,
      reply_to_mid: this.replyToMid,
      metadata: Object.keys(this.metadata).length > 0 ? this.metadata : null,
      timestamp: this.timestamp,
      created_at: this.createdAt || new Date().toISOString()
    };
  }

  // Mutations
  attachMedia(type, url) {
    this.attachmentType = type; // 'image', 'video', 'audio', 'file'
    this.attachmentUrl = url;
  }

  addMetadata(key, value) {
    this.metadata[key] = value;
  }

  getMetadata(key) {
    return this.metadata[key];
  }
}

module.exports = Message;
