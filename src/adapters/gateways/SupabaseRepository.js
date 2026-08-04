const DatabaseGateway = require('../../use-cases/contracts/DatabaseGateway');

class SupabaseRepository extends DatabaseGateway {
  constructor(supabaseClient) {
    super();
    this.db = supabaseClient;
  }

  async getCustomerByInstagramId(instagramId) {
    if (!this.db) return null;
    try {
      const { data } = await this.db.from('customers').select('*').eq('instagram_id', instagramId).single();
      return data;
    } catch (e) {
      console.error('[SupabaseRepository] Error getting customer:', e.message);
      return null;
    }
  }

  async createCustomer(customerData) {
    if (!this.db) return null;
    try {
      const { data, error } = await this.db.from('customers').insert([customerData]).select().single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('[SupabaseRepository] Error creating customer:', e.message);
      return null;
    }
  }

  async updateCustomer(instagramId, updates) {
    if (!this.db) return null;
    try {
      await this.db.from('customers').update(updates).eq('instagram_id', instagramId);
    } catch (e) {
      console.error('[SupabaseRepository] Error updating customer:', e.message);
    }
  }

  async logMessage(senderId, direction, type, content, mid = null, extra = {}) {
    if (!this.db) return;
    try {
      await this.db.from('messages').insert([{
        instagram_id: senderId,
        direction,
        message_type: type,
        content,
        mid,
        ...extra
      }]);
    } catch (err) {
      console.error('[SupabaseRepository] Error logging message:', err.message);
    }
  }
}

module.exports = SupabaseRepository;
