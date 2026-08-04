// Flow Gateway Adapter
// Wraps flow.service to abstract flow engine calls

const flow = require('../../services/flow.service');

class FlowGateway {
  // Flow configuration
  async loadFlowsFromFile() {
    return flow.loadFlowsFromFile();
  }

  async loadFlowsFromSupabase() {
    return flow.loadFlowsFromSupabase();
  }

  async saveFlowsConfig(config) {
    return flow.saveFlowsConfig(config);
  }

  // Flow execution
  async processFlowSteps(steps, senderId, senderName, visitedSteps = new Set(), inputText = null) {
    return flow.processFlowSteps(steps, senderId, senderName, visitedSteps, inputText);
  }

  async executeAction(step, senderId, senderName) {
    return flow.executeAction(step, senderId, senderName);
  }

  // Sequence subscription
  setSubscribeToSequence(callback) {
    return flow.setSubscribeToSequence(callback);
  }
}

module.exports = FlowGateway;
