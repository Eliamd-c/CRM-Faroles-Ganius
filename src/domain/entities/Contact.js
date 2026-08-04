// Domain Entity: Contact
// Represents a customer/user in the system

class Contact {
  constructor(data) {
    this.instagramId = data.instagram_id;
    this.name = data.name;
    this.profilePicUrl = data.profile_picture_url;
    this.state = data.bot_state || 'active';
    this.tags = data.tags || [];
    this.fields = data.fields || {};
    this.botPaused = data.bot_paused || false;
    this.awaitingInputType = data.awaiting_input_type;
    this.awaitingInputField = data.awaiting_input_field;
    this.awaitingInputChoices = data.awaiting_input_choices;
    this.awaitingInputPrompt = data.awaiting_input_prompt;
    this.awaitingInputRetries = data.awaiting_input_retries || 0;
    this.currentFlowId = data.current_flow_id;
    this.currentStepIndex = data.current_step_index;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Factory: Create from database row
  static fromDatabase(dbRow) {
    return new Contact(dbRow);
  }

  // Factory: Create new contact
  static new(senderId, name, profile) {
    return new Contact({
      instagram_id: senderId,
      name,
      profile_picture_url: profile?.profile_pic || null,
      bot_state: 'active',
      tags: [],
      fields: {},
      bot_paused: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // State queries
  isActive() {
    return !this.botPaused && this.state === 'active';
  }

  isPaused() {
    return this.botPaused;
  }

  isInAiAgent() {
    return this.state === 'ai_agent';
  }

  isAwaitingInput() {
    return this.state === 'awaiting_input';
  }

  isInFlow() {
    return !!this.currentFlowId;
  }

  // Conversions
  toDatabase() {
    return {
      instagram_id: this.instagramId,
      name: this.name,
      profile_picture_url: this.profilePicUrl,
      bot_state: this.state,
      tags: this.tags,
      fields: this.fields,
      bot_paused: this.botPaused,
      awaiting_input_type: this.awaitingInputType,
      awaiting_input_field: this.awaitingInputField,
      awaiting_input_choices: this.awaitingInputChoices,
      awaiting_input_prompt: this.awaitingInputPrompt,
      awaiting_input_retries: this.awaitingInputRetries,
      current_flow_id: this.currentFlowId,
      current_step_index: this.currentStepIndex,
      updated_at: new Date().toISOString()
    };
  }

  // State transitions
  switchToAiAgent() {
    this.state = 'ai_agent';
  }

  switchToAwaitingInput(inputType, field, choices = null, prompt = null) {
    this.state = 'awaiting_input';
    this.awaitingInputType = inputType;
    this.awaitingInputField = field;
    this.awaitingInputChoices = choices;
    this.awaitingInputPrompt = prompt;
    this.awaitingInputRetries = 0;
  }

  switchToActive() {
    this.state = 'active';
    this.awaitingInputType = null;
    this.awaitingInputField = null;
    this.awaitingInputRetries = 0;
  }

  incrementRetries() {
    this.awaitingInputRetries = (this.awaitingInputRetries || 0) + 1;
  }

  pause() {
    this.botPaused = true;
  }

  resume() {
    this.botPaused = false;
  }

  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  removeTag(tag) {
    this.tags = this.tags.filter(t => t !== tag);
  }

  setField(key, value) {
    this.fields[key] = value;
  }

  getField(key) {
    return this.fields[key];
  }
}

module.exports = Contact;
