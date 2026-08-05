class GetGraphStateUseCase {
  constructor(langGraphService) {
    this.langGraphService = langGraphService;
  }

  async execute({ threadId, limit = 10 }) {
    if (!threadId) {
      throw new Error('threadId is required');
    }

    try {
      const history = await this.langGraphService.getStateHistory(threadId, limit);
      
      // Mapear el historial para devolver una estructura limpia al cliente
      const formattedHistory = history.map(state => ({
        checkpoint_id: state.checkpoint_id,
        created_at: state.created_at,
        messages: state.values?.messages || [],
        intent: state.values?.intent || null,
        human_needed: state.values?.human_needed || false,
        next_node: state.next || []
      }));

      return {
        threadId,
        history: formattedHistory
      };
    } catch (error) {
      throw new Error(`Failed to get graph state: ${error.message}`);
    }
  }
}

module.exports = GetGraphStateUseCase;
