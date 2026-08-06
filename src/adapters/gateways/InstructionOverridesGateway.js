/**
 * InstructionOverridesGateway
 *
 * Adapter para persistencia de instrucciones dinámicas en BD.
 * Implementa Clean Architecture: Inyectable, testeable, sin coupling a Express.
 *
 * Patrón: Repository Gateway (Gof)
 * - getInstructionOverride(stageName) → Retorna instruction_text o NULL
 * - saveInstructionOverride(stageName, text) → INSERT OR UPDATE
 * - getAllInstructionOverrides() → { ONBOARDING: '...', DISCOVERY: '...', ... }
 */
class InstructionOverridesGateway {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required');
    }
    this.supabase = supabaseClient;
  }

  /**
   * Obtiene la instrucción override para una etapa específica.
   *
   * @param {string} stageName - Nombre de la etapa (ONBOARDING, DISCOVERY, etc.)
   * @returns {Promise<string|null>} Texto de la instrucción o null si no existe
   */
  async getInstructionOverride(stageName) {
    if (!stageName || typeof stageName !== 'string') {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('instruction_overrides')
        .select('instruction_text')
        .eq('stage_name', stageName.toUpperCase())
        .maybeSingle();

      if (error) {
        console.error(`[InstructionOverridesGateway] Error fetching ${stageName}:`, error.message);
        return null;
      }

      return data ? data.instruction_text : null;
    } catch (err) {
      console.error(`[InstructionOverridesGateway] Unexpected error:`, err.message);
      return null;
    }
  }

  /**
   * Guarda o actualiza una instrucción override.
   *
   * @param {string} stageName - Nombre de la etapa
   * @param {string} instructionText - Texto de la instrucción
   * @returns {Promise<boolean>} True si se guardó correctamente
   */
  async saveInstructionOverride(stageName, instructionText) {
    if (!stageName || typeof stageName !== 'string' || !instructionText || typeof instructionText !== 'string') {
      throw new Error('stageName and instructionText are required strings');
    }

    if (instructionText.trim().length < 50) {
      throw new Error('Instruction text must be at least 50 characters');
    }

    if (instructionText.length > 5000) {
      throw new Error('Instruction text must not exceed 5000 characters');
    }

    try {
      const { error } = await this.supabase
        .from('instruction_overrides')
        .upsert({
          stage_name: stageName.toUpperCase(),
          instruction_text: instructionText.trim(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'stage_name' });

      if (error) {
        console.error(`[InstructionOverridesGateway] Error saving ${stageName}:`, error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error(`[InstructionOverridesGateway] Unexpected error:`, err.message);
      return false;
    }
  }

  /**
   * Obtiene TODAS las instrucciones override en un objeto.
   *
   * @returns {Promise<Object>} { ONBOARDING: '...', DISCOVERY: '...', ... }
   */
  async getAllInstructionOverrides() {
    try {
      const { data, error } = await this.supabase
        .from('instruction_overrides')
        .select('stage_name, instruction_text');

      if (error) {
        console.error('[InstructionOverridesGateway] Error fetching all:', error.message);
        return {};
      }

      const result = {};
      if (data && Array.isArray(data)) {
        for (const row of data) {
          result[row.stage_name] = row.instruction_text;
        }
      }

      return result;
    } catch (err) {
      console.error('[InstructionOverridesGateway] Unexpected error:', err.message);
      return {};
    }
  }
}

module.exports = InstructionOverridesGateway;
