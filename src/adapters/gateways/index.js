// Gateway adapters - Abstractions for external services

const MetaGateway = require('./MetaGateway');
const OpenAiGateway = require('./OpenAiGateway');
const FlowGateway = require('./FlowGateway');
const SupabaseGateway = require('./SupabaseGateway');

module.exports = {
  MetaGateway,
  OpenAiGateway,
  FlowGateway,
  SupabaseGateway
};
