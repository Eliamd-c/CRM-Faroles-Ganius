// Bootstrap/Dependency Injection Setup
// Instantiates all gateways and use-cases with proper dependencies

const MetaGateway = require('../adapters/gateways/MetaGateway');
const OpenAiGateway = require('../adapters/gateways/OpenAiGateway');
const FlowGateway = require('../adapters/gateways/FlowGateway');
const SupabaseGateway = require('../adapters/gateways/SupabaseGateway');

const HandleIncomingMessageUseCase = require('../use-cases/HandleIncomingMessageUseCase');
const HandleCommentUseCase = require('../use-cases/HandleCommentUseCase');
const HandlePostbackUseCase = require('../use-cases/HandlePostbackUseCase');
const HandleMentionUseCase = require('../use-cases/HandleMentionUseCase');
const HandleAttachmentsUseCase = require('../use-cases/HandleAttachmentsUseCase');

function bootstrap(dependencies) {
  const { state, flowsConfig, supabaseClient, broadcastLog, recentReplies } = dependencies;

  if (!state) throw new Error('Missing state dependency');
  if (!flowsConfig) throw new Error('Missing flowsConfig dependency');
  if (!broadcastLog) throw new Error('Missing broadcastLog dependency');

  console.log('[Bootstrap] Initializing Clean Architecture...');

  // ============================================
  // 1. INSTANTIATE GATEWAYS
  // ============================================
  const metaGateway = new MetaGateway();
  const openaiGateway = new OpenAiGateway();
  const flowGateway = new FlowGateway();
  const supabaseGateway = new SupabaseGateway(supabaseClient);

  console.log('[Bootstrap] ✅ Gateways initialized (4/4)');

  // ============================================
  // 2. INSTANTIATE USE-CASES
  // ============================================
  const handleIncomingMessageUseCase = new HandleIncomingMessageUseCase({
    metaGateway,
    openaiGateway,
    flowGateway,
    supabaseGateway,
    state,
    flowsConfig,
    broadcastLog
  });

  const handleCommentUseCase = new HandleCommentUseCase({
    metaGateway,
    openaiGateway,
    flowGateway,
    supabaseGateway,
    state,
    flowsConfig,
    broadcastLog,
    recentReplies: recentReplies || new Set()
  });

  const handlePostbackUseCase = new HandlePostbackUseCase({
    metaGateway,
    openaiGateway,
    flowGateway,
    supabaseGateway,
    state,
    flowsConfig,
    broadcastLog
  });

  const handleMentionUseCase = new HandleMentionUseCase({
    metaGateway,
    flowGateway,
    state,
    flowsConfig,
    broadcastLog
  });

  const handleAttachmentsUseCase = new HandleAttachmentsUseCase({
    metaGateway,
    supabaseGateway,
    broadcastLog
  });

  console.log('[Bootstrap] ✅ UseCases initialized (5/5)');

  // ============================================
  // 3. RETURN DI CONTAINER
  // ============================================
  return {
    // Gateways
    gateways: {
      metaGateway,
      openaiGateway,
      flowGateway,
      supabaseGateway
    },

    // Use Cases
    useCases: {
      handleIncomingMessageUseCase,
      handleCommentUseCase,
      handlePostbackUseCase,
      handleMentionUseCase,
      handleAttachmentsUseCase
    },

    // Convenience shortcuts
    handleMessage: handleIncomingMessageUseCase,
    handleComment: handleCommentUseCase,
    handlePostback: handlePostbackUseCase,
    handleMention: handleMentionUseCase,
    handleAttachments: handleAttachmentsUseCase
  };
}

module.exports = bootstrap;
