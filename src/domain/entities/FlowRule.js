class FlowRule {
  constructor({ keywords = [], exactMatch = false, flowId }) {
    if (!flowId) throw new Error('FlowRule requires a flowId');
    this.keywords = keywords.map(k => k.toLowerCase().trim());
    this.exactMatch = exactMatch;
    this.flowId = flowId;
  }

  matches(text) {
    if (!text || this.keywords.length === 0) return false;
    
    const normalizedText = text.toLowerCase().trim();
    if (this.exactMatch) {
      return this.keywords.includes(normalizedText);
    }
    
    // Partial match (contains)
    return this.keywords.some(keyword => normalizedText.includes(keyword));
  }
}

module.exports = FlowRule;
