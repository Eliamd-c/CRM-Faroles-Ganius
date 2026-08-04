class DatabaseGateway {
  async getCustomerByInstagramId(instagramId) {
    throw new Error('Method not implemented.');
  }

  async createCustomer(customerData) {
    throw new Error('Method not implemented.');
  }

  async updateCustomer(instagramId, updates) {
    throw new Error('Method not implemented.');
  }

  async logMessage(senderId, direction, type, content, mid, extra) {
    throw new Error('Method not implemented.');
  }
}

module.exports = DatabaseGateway;
