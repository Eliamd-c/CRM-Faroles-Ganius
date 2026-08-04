// Supabase Gateway Adapter
// Wraps database operations for contacts and messages

const Contact = require('../../domain/entities/Contact');
const Message = require('../../domain/entities/Message');

class SupabaseGateway {
  constructor(supabaseClient) {
    this.db = supabaseClient;
  }

  // Contact operations
  async getContactByInstagramId(instagramId) {
    if (!this.db) return null;
    try {
      const { data } = await this.db
        .from('customers')
        .select('*')
        .eq('instagram_id', instagramId)
        .single();
      return data ? Contact.fromDatabase(data) : null;
    } catch (err) {
      if (err.code === 'PGRST116') return null; // Not found
      throw err;
    }
  }

  async createContact(contact) {
    if (!this.db) return contact;
    const { data, error } = await this.db
      .from('customers')
      .insert([contact.toDatabase()])
      .select()
      .single();
    if (error) throw error;
    return Contact.fromDatabase(data);
  }

  async updateContact(contact) {
    if (!this.db) return contact;
    const { data, error } = await this.db
      .from('customers')
      .update(contact.toDatabase())
      .eq('instagram_id', contact.instagramId)
      .select()
      .single();
    if (error) throw error;
    return Contact.fromDatabase(data);
  }

  async getAllContacts() {
    if (!this.db) return [];
    const { data } = await this.db.from('customers').select('*');
    return (data || []).map(row => Contact.fromDatabase(row));
  }

  // Message operations
  async logMessage(message) {
    if (!this.db) return message;
    const { data, error } = await this.db
      .from('messages')
      .insert([message.toDatabase()])
      .select()
      .single();
    if (error) throw error;
    return Message.fromDatabase(data);
  }

  async getMessagesByContactId(instagramId, limit = 50) {
    if (!this.db) return [];
    const { data } = await this.db
      .from('messages')
      .select('*')
      .eq('instagram_id', instagramId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    return (data || []).map(row => Message.fromDatabase(row));
  }

  // Search and filtering
  async searchContacts(query) {
    if (!this.db) return [];
    const { data } = await this.db
      .from('customers')
      .select('*')
      .ilike('name', `%${query}%`)
      .or(`instagram_id.eq.${query}`);
    return (data || []).map(row => Contact.fromDatabase(row));
  }

  async getContactsByTag(tag) {
    if (!this.db) return [];
    const { data } = await this.db
      .from('customers')
      .select('*')
      .contains('tags', [tag]);
    return (data || []).map(row => Contact.fromDatabase(row));
  }

  // Utility methods
  async updateContactField(instagramId, fieldName, fieldValue) {
    if (!this.db) return null;
    const contact = await this.getContactByInstagramId(instagramId);
    if (!contact) return null;

    contact.setField(fieldName, fieldValue);
    return this.updateContact(contact);
  }

  async addContactTag(instagramId, tag) {
    if (!this.db) return null;
    const contact = await this.getContactByInstagramId(instagramId);
    if (!contact) return null;

    contact.addTag(tag);
    return this.updateContact(contact);
  }

  async removeContactTag(instagramId, tag) {
    if (!this.db) return null;
    const contact = await this.getContactByInstagramId(instagramId);
    if (!contact) return null;

    contact.removeTag(tag);
    return this.updateContact(contact);
  }

  async pauseContact(instagramId) {
    if (!this.db) return null;
    const contact = await this.getContactByInstagramId(instagramId);
    if (!contact) return null;

    contact.pause();
    return this.updateContact(contact);
  }

  async resumeContact(instagramId) {
    if (!this.db) return null;
    const contact = await this.getContactByInstagramId(instagramId);
    if (!contact) return null;

    contact.resume();
    return this.updateContact(contact);
  }

  async getRecentMessages(instagramId, limit = 20) {
    if (!this.db) return [];
    const { data } = await this.db
      .from('messages')
      .select('*')
      .eq('instagram_id', instagramId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []).map(row => Message.fromDatabase(row));
  }

  async getContactStats(instagramId) {
    if (!this.db) return null;

    const contact = await this.getContactByInstagramId(instagramId);
    if (!contact) return null;

    const { count: messageCount } = await this.db
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('instagram_id', instagramId);

    return {
      contact,
      messageCount: messageCount || 0,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      tagsCount: contact.tags.length,
      fieldsCount: Object.keys(contact.fields).length
    };
  }

  async getContactsByState(state) {
    if (!this.db) return [];
    const { data } = await this.db
      .from('customers')
      .select('*')
      .eq('bot_state', state);
    return (data || []).map(row => Contact.fromDatabase(row));
  }

  async countActiveContacts() {
    if (!this.db) return 0;
    const { count } = await this.db
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('bot_state', 'active')
      .eq('bot_paused', false);
    return count || 0;
  }

  async countPausedContacts() {
    if (!this.db) return 0;
    const { count } = await this.db
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('bot_paused', true);
    return count || 0;
  }
}

module.exports = SupabaseGateway;
