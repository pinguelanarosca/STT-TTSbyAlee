/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Catálogo Canônico de Modelos Gemini, Whitelist Estrita Operacional
 * e Motor de Fallback Imediato (Zero-Retry).
 * 
 * Whitelists e Ordens Oficiais:
 * - TTS (Ordem Estrita):
 *   1. gemini-3.8-flash-lite-tts (Gemini 3.8 Flash-Lite TTS)
 *   2. gemini-3.8-flash-tts (Gemini 3.8 Flash TTS)
 *   3. gemini-3.1-flash-tts-preview (Gemini 3.1 Flash TTS)
 *   4. gemini-2.5-flash-preview-tts (Gemini 2.5 Flash TTS)
 * 
 * - Flash-Lite / Geral / Vision / Teste de Chave (Ordem Estrita):
 *   1. gemini-3.1-flash-lite (Gemini 3.1 Flash-Lite)
 *   2. gemini-3.5-flash-lite (Gemini 3.5 Flash-Lite)
 *   3. gemini-2.5-flash-lite (Gemini 2.5 Flash-Lite)
 * 
 * - STT Unary: gemini-3.5-transcribe (Gemini 3.5 Transcribe)
 * - STT Live: gemini-3.5-transcribe-live (Gemini 3.5 Transcribe Live)
 * 
 * Regras de Integridade:
 * - sttModelId !== ttsModelId (Nunca idênticos)
 * - Modelos TTS NUNCA aparecem no seletor STT
 * - Modelos Gerais NUNCA aparecem no seletor TTS
 * - Maps Grounding é uma CAPABILITY, NUNCA um modelo
 * - Em qualquer erro: Zero retry no mesmo modelo; avanço imediato para o próximo da cadeia.
 */

import { ModelDescriptor } from '../types/models';

/**
 * 1. WHITELIST OFICIAL E ORDEM EXATA DOS MODELOS TTS
 */
export const TTS_MODELS_WHITELIST = [
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
] as const;

export type TtsModelId = (typeof TTS_MODELS_WHITELIST)[number];

/**
 * 2. WHITELIST OFICIAL E ORDEM EXATA DOS MODELOS FLASH-LITE (Geral, Vision, Teste de Chave)
 */
export const FLASH_LITE_MODELS_WHITELIST = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
] as const;

export type FlashLiteModelId = (typeof FLASH_LITE_MODELS_WHITELIST)[number];

/**
 * 3. WHITELIST OFICIAL DOS MODELOS STT (Transcrição de Voz)
 */
export const STT_UNARY_MODELS_WHITELIST = [
  'gemini-3.5-transcribe',
] as const;

export const STT_LIVE_MODELS_WHITELIST = [
  'gemini-3.5-transcribe-live',
] as const;

export type SttUnaryModelId = (typeof STT_UNARY_MODELS_WHITELIST)[number];
export type SttLiveModelId = (typeof STT_LIVE_MODELS_WHITELIST)[number];

/**
 * MODELO PADRÃO PARA TESTE DE CHAVE E CONECTIVIDADE
 */
export const AUTH_TEST_INITIAL_MODEL: FlashLiteModelId = 'gemini-3.1-flash-lite';

/**
 * MODELO PADRÃO DEFAULT DE TTS
 */
export const DEFAULT_TTS_MODEL: TtsModelId = 'gemini-3.8-flash-lite-tts';

/**
 * MODELO PADRÃO DEFAULT DE STT
 */
export const DEFAULT_STT_MODEL: SttUnaryModelId = 'gemini-3.5-transcribe';

/**
 * MODELO PADRÃO DEFAULT DE VISION / GERAL
 */
export const DEFAULT_VISION_MODEL: FlashLiteModelId = 'gemini-3.1-flash-lite';

/**
 * Catálogo Canônico com descritores detalhados para cada modelo da whitelist.
 */
export const KNOWN_MODELS: Record<string, ModelDescriptor> = {
  // =========================================================================
  // MODELOS TTS (Ordem Exata 1 a 4)
  // =========================================================================
  'gemini-3.8-flash-lite-tts': {
    id: 'gemini-3.8-flash-lite-tts',
    displayName: 'Gemini 3.8 Flash-Lite TTS',
    description: 'Modelo de áudio de alta eficiência e ultrabaixa latência para leitura e TTS padrão.',
    category: 'tts',
    tier: 'lite',
    inputModalities: { text: true, image: false, audio: false, video: false },
    outputModalities: { text: false, audio: true, image: false },
    tasks: {
      general: { supported: false },
      vision: { supported: false },
      stt: { supported: false },
      tts: { supported: true, method: 'generateContent' },
      live: { supported: false },
    },
    capabilities: { mapsGrounding: false },
    apiMethods: ['generateContent'],
    streaming: false,
    deprecated: false,
    availability: 'ga',
    recommendedMaxTokens: 4096,
  },
  'gemini-3.8-flash-tts': {
    id: 'gemini-3.8-flash-tts',
    displayName: 'Gemini 3.8 Flash TTS',
    description: 'Modelo flagship de síntese vocal com suporte a entonações expressivas e diálogos.',
    category: 'tts',
    tier: 'flash',
    inputModalities: { text: true, image: false, audio: false, video: false },
    outputModalities: { text: false, audio: true, image: false },
    tasks: {
      general: { supported: false },
      vision: { supported: false },
      stt: { supported: false },
      tts: { supported: true, method: 'generateContent' },
      live: { supported: false },
    },
    capabilities: { mapsGrounding: false },
    apiMethods: ['generateContent'],
    streaming: false,
    deprecated: false,
    availability: 'ga',
    recommendedMaxTokens: 8192,
  },
  'gemini-3.1-flash-tts-preview': {
    id: 'gemini-3.1-flash-tts-preview',
    displayName: 'Gemini 3.1 Flash TTS',
    description: 'Modelo TTS balanceado para leitura natural em preview.',
    category: 'tts',
    tier: 'preview',
    inputModalities: { text: true, image: false, audio: false, video: false },
    outputModalities: { text: false, audio: true, image: false },
    tasks: {
      general: { supported: false },
      vision: { supported: false },
      stt: { supported: false },
      tts: { supported: true, method: 'generateContent' },
      live: { supported: false },
    },
    capabilities: { mapsGrounding: false },
    apiMethods: ['generateContent'],
    streaming: false,
    deprecated: false,
    availability: 'preview',
    recommendedMaxTokens: 4096,
  },
  'gemini-2.5-flash-preview-tts': {
    id: 'gemini-2.5-flash-preview-tts',
    displayName: 'Gemini 2.5 Flash TTS',
    description: 'Modelo de síntese vocal com compatibilidade para endpoints 2.5.',
    category: 'tts',
    tier: 'preview',
    inputModalities: { text: true, image: false, audio: false, video: false },
    outputModalities: { text: false, audio: true, image: false },
    tasks: {
      general: { supported: false },
      vision: { supported: false },
      stt: { supported: false },
      tts: { supported: true, method: 'generateContent' },
      live: { supported: false },
    },
    capabilities: { mapsGrounding: false },
    apiMethods: ['generateContent'],
    streaming: false,
    deprecated: false,
    availability: 'preview',
    recommendedMaxTokens: 4096,
  },

  // =========================================================================
  // MODELOS FLASH-LITE (Geral, Vision, Teste de Chave - Ordem Exata 1 a 3)
  // =========================================================================
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash-Lite',
    description: 'Modelo leve de ultrabaixa latência para visão multimodal, testes de conexão e análise rápida.',
    category: 'general_multimodal',
    tier: 'lite',
    inputModalities: { text: true, image: true, audio: true, video: true },
    outputModalities: { text: true, audio: false, image: false },
    tasks: {
      general: { supported: true },
      vision: { supported: true, method: 'generateContent' },
      stt: { supported: false },
      tts: { supported: false },
      live: { supported: false },
    },
    capabilities: { mapsGrounding: true },
    apiMethods: ['generateContent', 'generateContentStream'],
    streaming: true,
    deprecated: false,
    availability: 'ga',
    recommendedMaxTokens: 8192,
  },
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    displayName: 'Gemini 3.5 Flash-Lite',
    description: 'Modelo Flash-Lite intermediário de alta eficiência e capacidade multimodal ampla.',
    category: 'general_multimodal',
    tier: 'lite',
    inputModalities: { text: true, image: true, audio: true, video: true },
    outputModalities: { text: true, audio: false, image: false },
    tasks: {
      general: { supported: true },
      vision: { supported: true, method: 'generateContent' },
      stt: { supported: false },
      tts: { supported: false },
      live: { supported: false },
    },
    capabilities: { mapsGrounding: true },
    apiMethods: ['generateContent', 'generateContentStream'],
    streaming: true,
    deprecated: false,
    availability: 'ga',
    recommendedMaxTokens: 8192,
  },
  'gemini-2.5-flash-lite': {
    id: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash-Lite',
    description: 'Modelo Flash-Lite compacto para fallback de tarefas gerais e compreensão de imagem.',
    category: 'general_multimodal',
    tier: 'lite',
    inputModalities: { text: true, image: true, audio: true, video: true },
    outputModalities: { text: true, audio: false, image: false },
    tasks: {
      general: { supported: true },
      vision: { supported: true, method: 'generateContent' },
      stt: { supported: false },
      tts: { supported: false },
      live: { supported: false },
    },
    capabilities: { mapsGrounding: true },
    apiMethods: ['generateContent', 'generateContentStream'],
    streaming: true,
    deprecated: false,
    availability: 'ga',
    recommendedMaxTokens: 8192,
  },

  // =========================================================================
  // MODELOS STT (Transcrição de Voz Dedicada)
  // =========================================================================
  'gemini-3.5-transcribe': {
    id: 'gemini-3.5-transcribe',
    displayName: 'Gemini 3.5 Transcribe',
    description: 'Modelo especializado para transcrição de áudio via protocolo Unary.',
    category: 'stt_transcription',
    tier: 'flash',
    inputModalities: { text: true, image: false, audio: true, video: false },
    outputModalities: { text: true, audio: false, image: false },
    tasks: {
      general: { supported: false },
      vision: { supported: false },
      stt: { supported: true, method: 'generateContent' },
      tts: { supported: false },
      live: { supported: false },
    },
    capabilities: { mapsGrounding: false },
    apiMethods: ['generateContent', 'generateContentStream'],
    streaming: true,
    deprecated: false,
    availability: 'ga',
    recommendedMaxTokens: 8192,
  },
  'gemini-3.5-transcribe-live': {
    id: 'gemini-3.5-transcribe-live',
    displayName: 'Gemini 3.5 Transcribe Live',
    description: 'Modelo para transcrição e tradução de áudio em tempo real via protocolo Live WebSocket.',
    category: 'stt_transcription',
    tier: 'flash',
    inputModalities: { text: false, image: false, audio: true, video: false },
    outputModalities: { text: true, audio: false, image: false },
    tasks: {
      general: { supported: false },
      vision: { supported: false },
      stt: { supported: true, method: 'liveConnect' },
      tts: { supported: false },
      live: { supported: true, method: 'liveConnect' },
    },
    capabilities: { mapsGrounding: false },
    apiMethods: ['liveConnect'],
    streaming: true,
    deprecated: false,
    availability: 'ga',
  },
};

/**
 * Mapeamento de Aliases e Normalização para a Whitelist Atual.
 */
export const MODEL_ALIASES: Record<string, string> = {
  // Redirecionamento TTS
  'gemini-tts': 'gemini-3.8-flash-lite-tts',
  'gemini-3.8-tts': 'gemini-3.8-flash-tts',
  'gemini-3.1-tts': 'gemini-3.1-flash-tts-preview',
  'gemini-2.5-tts': 'gemini-2.5-flash-preview-tts',

  // Redirecionamento Geral / Flash-Lite
  'gemini-3.8-flash': 'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview': 'gemini-3.1-flash-lite',
  'gemini-2.5-flash': 'gemini-2.5-flash-lite',
  'gemini-flash': 'gemini-3.1-flash-lite',
  'gemini-flash-lite': 'gemini-3.1-flash-lite',
  'gemini-pro': 'gemini-3.1-flash-lite',

  // Redirecionamento STT
  'gemini-transcribe': 'gemini-3.5-transcribe',
  'gemini-stt': 'gemini-3.5-transcribe',
};

/**
 * 8. CADEIAS DE FALLBACK EXATAS POR TAREFA
 * TTS: 3.8 Flash-Lite TTS -> 3.8 Flash TTS -> 3.1 Flash TTS -> 2.5 Flash TTS
 * Vision / Geral / Auth: 3.1 Flash-Lite -> 3.5 Flash-Lite -> 2.5 Flash-Lite
 * STT Unary: 3.5 Transcribe
 * STT Live: 3.5 Transcribe Live
 */
export const TASK_FALLBACK_CHAINS = {
  tts: TTS_MODELS_WHITELIST,
  stt_unary: STT_UNARY_MODELS_WHITELIST,
  stt_live: STT_LIVE_MODELS_WHITELIST,
  stt: STT_UNARY_MODELS_WHITELIST,
  vision: FLASH_LITE_MODELS_WHITELIST,
  general: FLASH_LITE_MODELS_WHITELIST,
  auth_test: FLASH_LITE_MODELS_WHITELIST,
} as const;

export type TaskFallbackKey = keyof typeof TASK_FALLBACK_CHAINS;

/**
 * Retorna a cadeia estrita de modelos para uma tarefa.
 */
export function getFallbackChainForTask(task: TaskFallbackKey): readonly string[] {
  return TASK_FALLBACK_CHAINS[task] || FLASH_LITE_MODELS_WHITELIST;
}

/**
 * Retorna o primeiro modelo garantido para uma tarefa.
 */
export function getFallbackModelForTask(task: TaskFallbackKey): string {
  return getFallbackChainForTask(task)[0];
}

/**
 * Normaliza um ID de modelo para a whitelist estrita.
 */
export function normalizeModelId(
  rawModelId: string | undefined | null,
  task: TaskFallbackKey = 'general'
): string {
  if (!rawModelId || typeof rawModelId !== 'string') {
    return getFallbackModelForTask(task);
  }
  const trimmed = rawModelId.trim();

  // Se já pertencer à whitelist da tarefa, retorna
  const chain = getFallbackChainForTask(task);
  if (chain.includes(trimmed as any)) {
    return trimmed;
  }

  // Verifica aliases
  if (MODEL_ALIASES[trimmed]) {
    const target = MODEL_ALIASES[trimmed];
    if (chain.includes(target as any)) {
      return target;
    }
  }

  return getFallbackModelForTask(task);
}

/**
 * 4. REGRA DE INTEGRIDADE: sttModelId !== ttsModelId
 */
export function validateAgentModelIntegrity(modelPreferences?: {
  ttsModelId?: string;
  sttModelId?: string;
  visionModelId?: string;
  generalModelId?: string;
}): { valid: boolean; error?: string } {
  const tts = modelPreferences?.ttsModelId || DEFAULT_TTS_MODEL;
  const stt = modelPreferences?.sttModelId || DEFAULT_STT_MODEL;

  if (tts === stt) {
    return {
      valid: false,
      error: `Violação de integridade: o modelo STT (${stt}) nunca pode ser igual ao modelo TTS (${tts}).`,
    };
  }

  if (!TTS_MODELS_WHITELIST.includes(tts as any)) {
    return {
      valid: false,
      error: `Modelo TTS "${tts}" inválido. Permitidos: ${TTS_MODELS_WHITELIST.join(', ')}`,
    };
  }

  if (!STT_UNARY_MODELS_WHITELIST.includes(stt as any) && !STT_LIVE_MODELS_WHITELIST.includes(stt as any)) {
    return {
      valid: false,
      error: `Modelo STT "${stt}" inválido. Permitidos: ${STT_UNARY_MODELS_WHITELIST.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * 9 & 10 & 11. MOTOR DE EXECUÇÃO COM FALLBACK IMEDIATO (ZERO-RETRY)
 * 
 * Regra Crítica:
 * - Em QUALQUER erro (4xx, 5xx, quota, rate limit, timeout, format, API, etc.):
 *   - NUNCA repetir o mesmo modelo.
 *   - ZERO retry. ZERO backoff.
 *   - Cada modelo da cadeia é chamado no máximo UMA VEZ.
 *   - Avança imediatamente para o próximo modelo da cadeia.
 * - Em falha total: retorna erro agregado detalhando todos os modelos tentados e mensagens.
 */
export interface FallbackAttemptError {
  modelId: string;
  error: string;
}

export async function executeWithZeroRetryFallback<T>(
  task: TaskFallbackKey,
  preferredModelId: string | undefined,
  executor: (modelId: string) => Promise<T>
): Promise<{ result: T; usedModelId: string; attempts: string[] }> {
  const baseChain = getFallbackChainForTask(task);
  
  // Monta a ordem de tentativa: inicia pelo modelo preferido (se estiver na cadeia) e segue com os demais da cadeia sem repetição
  const candidateModels: string[] = [];
  if (preferredModelId && baseChain.includes(preferredModelId as any)) {
    candidateModels.push(preferredModelId);
  }
  for (const m of baseChain) {
    if (!candidateModels.includes(m)) {
      candidateModels.push(m);
    }
  }

  const triedModels: string[] = [];
  const errors: FallbackAttemptError[] = [];

  for (const modelId of candidateModels) {
    // Garante que nenhum modelo seja tentado mais de uma vez
    if (triedModels.includes(modelId)) {
      continue;
    }
    triedModels.push(modelId);

    try {
      // Tentativa única no modelo
      const result = await executor(modelId);
      return {
        result,
        usedModelId: modelId,
        attempts: triedModels,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ modelId, error: errorMsg });
      // ZERO RETRY: Não tenta novamente. Avança imediatamente para o próximo modelo no loop.
    }
  }

  // Falha total da cadeia
  const formattedErrors = errors
    .map((e, idx) => `[${idx + 1}] Modelo "${e.modelId}": ${e.error}`)
    .join(' | ');

  throw new Error(
    `Falha total na cadeia de fallback para "${task}". Todos os ${triedModels.length} modelos falharam sem retry. Detalhes: ${formattedErrors}`
  );
}
