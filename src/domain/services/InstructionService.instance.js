/**
 * InstructionService.instance.js
 *
 * Patrón Singleton: Inicializa UNA única instancia de InstructionService
 * que es compartida por toda la aplicación.
 *
 * Responsabilidades:
 * 1. Inyectar dependencias (gateways, config)
 * 2. Inicializar InstructionService con:
 *    - InstructionOverridesGateway (acceso a BD para overrides)
 *    - InstructionConfigGateway (acceso a BD para config de caching)
 *    - Instrucciones por defecto desde los estados
 * 3. Exportar singleton listo para usar en cualquier parte de la app
 *
 * Patrón: Singleton + Factory (Node.js Design Patterns, cap. 7 y 9)
 *
 * Uso:
 * const instructionService = require('../domain/services/InstructionService.instance');
 * const instruction = await instructionService.getInstance().then(svc => svc.getInstruction('ONBOARDING'));
 */

const { InstructionService } = require('./InstructionService');
const InstructionConfigGateway = require('../../adapters/gateways/InstructionConfigGateway');
const InstructionOverridesGateway = require('../../adapters/gateways/InstructionOverridesGateway');

/**
 * Marcador que ocupa el lugar del Contexto Maestro dentro de las instrucciones
 * por defecto. respondNode lo sustituye por state.AI_MASTER_CONTEXT en cada
 * llamada, de modo que editar la Identidad surta efecto sin esperar al TTL.
 */
const CONTEXT_PLACEHOLDER = '{{MASTER_CONTEXT}}';

// ─── Importar Estados para Instrucciones por Defecto ───
const OnboardingState = require('../states/OnboardingState');
const DiscoveryState = require('../states/DiscoveryState');
const RecommendationState = require('../states/RecommendationState');
const CheckoutState = require('../states/CheckoutState');

/**
 * Construye instrucciones por defecto desde los estados
 *
 * @returns {Object} { ONBOARDING: '...', DISCOVERY: '...', ... }
 */
function buildDefaultInstructions() {
  // El Contexto Maestro NO se hornea aquí: se inyecta en runtime desde respondNode.
  // Motivo: el operador lo edita en caliente (tab Identidad) y si quedara embebido
  // en el cache de instrucciones (TTL 300s) serviría una versión obsoleta.
  const context = CONTEXT_PLACEHOLDER;

  const stateInstances = {
    ONBOARDING: new OnboardingState(),
    DISCOVERY: new DiscoveryState(),
    RECOMMENDATION: new RecommendationState(),
    CHECKOUT: new CheckoutState()
  };

  const defaults = {};

  for (const [stageName, stateObj] of Object.entries(stateInstances)) {
    try {
      // Obtener la instrucción del estado (sin historial)
      // getSystemInstruction() es responsable de la etapa específica
      defaults[stageName] = stateObj.getSystemInstruction({
        context,
        intent: 'GENERAL',
        customer: null
      });
    } catch (err) {
      console.error(`[InstructionService.instance] Error building default for ${stageName}:`, err.message);
      // Fallback: instrucción genérica
      defaults[stageName] = `You are a helpful assistant in the ${stageName} stage. Guide the user through this stage of the sales funnel.`;
    }
  }

  return defaults;
}

/**
 * Inicializa y retorna el singleton
 *
 * Patrón: Lazy Loading (se construye solo cuando se necesita)
 */
async function initializeInstructionService() {
  let supabase = null;
  try {
    supabase = require('../../../db');
  } catch (err) {
    console.warn('[InstructionService.instance] ⚠️ Supabase no disponible:', err.message);
  }

  if (!supabase) {
    console.warn('[InstructionService.instance] ⚠️ Supabase no conectado. Usando solo defaults.');
  }

  // ─── Crear Gateways ───
  let instructionConfigGateway = null;
  let instructionOverridesGateway = null;
  if (supabase) {
    try {
      instructionConfigGateway = new InstructionConfigGateway(supabase);
    } catch (err) {
      console.error('[InstructionService.instance] Error creating InstructionConfigGateway:', err.message);
    }
    try {
      instructionOverridesGateway = new InstructionOverridesGateway(supabase);
    } catch (err) {
      console.error('[InstructionService.instance] Error creating InstructionOverridesGateway:', err.message);
    }
  }

  // ─── Construir instrucciones por defecto desde los estados ───
  const defaultInstructions = buildDefaultInstructions();

  // ─── Obtener configuración de caching desde BD ───
  let cachingConfig = {
    stdTTL: 300,       // 5 minutos
    checkperiod: 60,   // 1 minuto
    maxKeys: 50
  };

  if (instructionConfigGateway) {
    try {
      const config = await instructionConfigGateway.getCachingConfig();
      cachingConfig = {
        stdTTL: config.stdTTL || 300,
        checkperiod: config.checkperiod || 60,
        maxKeys: config.maxKeys || 50
      };
      console.log('[InstructionService.instance] ✅ Caching config loaded from BD:', cachingConfig);
    } catch (err) {
      console.warn('[InstructionService.instance] ⚠️ Error loading caching config, using defaults:', err.message);
    }
  }

  // ─── Inicializar InstructionService ───
  // El gateway es lo que permite que las instrucciones editadas desde el CRM
  // lleguen al agente. Sin él, OverrideInstructionStrategy siempre devuelve null.
  const service = new InstructionService(
    instructionOverridesGateway,
    defaultInstructions,
    cachingConfig
  );

  console.log('[InstructionService.instance] ✅ InstructionService initialized (singleton)');
  console.log('[InstructionService.instance] Default stages:', Object.keys(defaultInstructions));
  console.log('[InstructionService.instance] Cache config:', cachingConfig);

  return service;
}

// ─── Singleton Lazy Loading ───
let instance = null;
let initPromise = null;

/**
 * Obtiene o inicializa el singleton
 *
 * @returns {Promise<InstructionService>}
 */
async function getInstance() {
  if (instance) {
    return instance;
  }

  // Evita múltiples inicializaciones concurrentes
  if (initPromise) {
    return initPromise;
  }

  initPromise = initializeInstructionService();
  instance = await initPromise;
  return instance;
}

/**
 * Obtiene sincronamente si ya está inicializado
 * (para situaciones donde no se puede usar async/await)
 *
 * @returns {InstructionService|null}
 */
function getInstanceSync() {
  return instance;
}

/**
 * Resetea el singleton (útil para tests)
 */
function reset() {
  instance = null;
  initPromise = null;
}

module.exports = {
  getInstance,
  getInstanceSync,
  reset,

  // Construcción síncrona de defaults desde los estados del embudo.
  // La usa app.js para registrar las rutas sin bloquear en un await.
  buildDefaultInstructions,

  // respondNode lo necesita para sustituir el marcador por el Contexto Maestro real.
  CONTEXT_PLACEHOLDER,

  // Exporta también las clases por si se necesita crear instancias adicionales (testing)
  InstructionService,
  InstructionConfigGateway
};
