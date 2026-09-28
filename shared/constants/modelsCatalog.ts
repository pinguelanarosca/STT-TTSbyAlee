/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Catálogo Canônico de Modelos Gemini CONGELADO DEFINITIVAMENTE.
 * 
 * WHITELIST ESTREITA E IMUTÁVEL:
 * 
 * 1. TTS (EXATAMENTE 4 MODELOS NESSA ORDEM ESTREITA):
 *    1. gemini-3.8-flash-lite-tts (Gemini 3.8 Flash-Lite TTS)
 *    2. gemini-3.8-flash-tts (Gemini 3.8 Flash TTS)
 *    3. gemini-3.1-flash-tts-preview (Gemini 3.1 Flash TTS)
 *    4. gemini-2.5-flash-preview-tts (Gemini 2.5 Flash TTS)
 * 
 * 2. STT / MODELOS GERAIS (EXATAMENTE 2 MODELOS NESSA ORDEM ESTREITA):
 *    1. gemini-3.5-flash-lite (Gemini 3.5 Flash-Lite)
 *    2. gemini-3.1-flash-lite (Gemini 3.1 Flash-Lite)
 * 
 * 3. TESTE DA CHAVE DE API:
 *    - gemini-3.1-flash-lite
 * 
 * REGRAS DE INTEGRIDADE:
 * - TTS e STT são 100% independentes.
 * - sttModelId !== ttsModelId.
 * - Modelos TTS NUNCA entram no seletor STT.
 * - Modelos STT / Flash-Lite NUNCA entram no seletor TTS.
 * - Maps Grounding é uma capability e NUNCA um modelo.
 * - Descoberta dinâmica por models.list() NUNCA adiciona modelos fora desta whitelist.
 * 
 * MOTOR DE FALLBACK:
 * - TTS: exatamente 3.8-flash-lite-tts -> 3.8-flash-tts -> 3.1-flash-tts-preview -> 2.5-flash-preview-tts (Zero-Retry).
 * - STT / Geral: exatamente 3.5-flash-lite -> 3.1-flash-lite (Zero-Retry).
 * - Auth Test: exatamente 3.1-flash-lite -> 3.5-flash-lite (Zero-Retry).
 * - Cada modelo é chamado no máximo uma vez por operação.
 * - Qualquer erro avança imediatamente ao próximo da cadeia sem retry ou backoff.
 */

import { ModelDescriptor } from '../types/models';

/**
 * 1. WHITELIST OFICIAL E ORDEM EXATA DOS MODELOS TTS (EXATAMENTE 4)
 */
export const TTS_MODELS_WHITELIST = [
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
] as const;

export type TtsModelId = (typeof TTS_MODELS_WHITELIST)[number];

/**
 * 2. WHITELIST OFICIAL E ORDEM EXATA DE STT E MODELOS GERAIS (EXATAMENTE 2)
 */
export const STT_GENERAL_MODELS_WHITELIST = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;

export type SttGeneralModelId = (typeof STT_GENERAL_MODELS_WHITELIST)[number];

// Aliases canônicos tipados
export const FLASH_LITE_MODELS_WHITELIST = STT_GENERAL_MODELS_WHITELIST;
export const STT_UNARY_MODELS_WHITELIST = STT_GENERAL_MODELS_WHITELIST;
export const STT_LIVE_MODELS_WHITELIST = STT_GENERAL_MODELS_WHITELIST;

export type FlashLiteModelId = SttGeneralModelId;
export type SttUnaryModelId = SttGeneralModelId;
export type SttLiveModelId = SttGeneralModelId;

/**
 * 3. MODELO PADRÃO PARA TESTE DE CHAVE E CONECTIVIDADE
 */
export const AUTH_TEST_INITIAL_MODEL: SttGeneralModelId = 'gemini-3.1-flash-lite';

/**
 * 4. MODELOS DEFAULT
 */
export const DEFAULT_TTS_MODEL: TtsModelId = 'gemini-3.8-flash-lite-tts';
export const DEFAULT_STT_MODEL: SttGeneralModelId = 'gemini-3.5-flash-lite';
export const DEFAULT_VISION_MODEL: SttGeneralModelId = 'gemini-3.5-flash-lite';
export const DEFAULT_GENERAL_MODEL: SttGeneralModelId = 'gemini-3.5-flash-lite';

/**
 * Catálogo Canônico com descritores dos modelos da whitelist congelada.
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
  // STT / MODELOS GERAIS FLASH-LITE (Ordem Exata 1 a 2)
  // =========================================================================
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    displayName: 'Gemini 3.5 Flash-Lite',
    description: 'Modelo Flash-Lite intermediário de alta eficiência para transcrição STT, visão multimodal e tarefas gerais.',
    category: 'general_multimodal',
    tier: 'lite',
    inputModalities: { text: true, image: true, audio: true, video: true },
    outputModalities: { text: true, audio: false, image: false },
    tasks: {
      general: { supported: true },
      vision: { supported: true, method: 'generateContent' },
      stt: { supported: true, method: 'generateContent' },
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
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash-Lite',
    description: 'Modelo leve de ultrabaixa latência para autenticação, testes de conectividade, transcrição e visão.',
    category: 'general_multimodal',
    tier: 'lite',
    inputModalities: { text: true, image: true, audio: true, video: true },
    outputModalities: { text: true, audio: false, image: false },
    tasks: {
      general: { supported: true },
      vision: { supported: true, method: 'generateContent' },
      stt: { supported: true, method: 'generateContent' },
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
};

/**
 * Normalização direta para a whitelist congelada (sem criação de novos modelos).
 */
export const MODEL_ALIASES: Record<string, string> = {
  'gemini-tts': 'gemini-3.8-flash-lite-tts',
  'gemini-3.8-tts': 'gemini-3.8-flash-tts',
  'gemini-3.1-tts': 'gemini-3.1-flash-tts-preview',
  'gemini-2.5-tts': 'gemini-2.5-flash-preview-tts',
  'gemini-transcribe': 'gemini-3.5-flash-lite',
  'gemini-stt': 'gemini-3.5-flash-lite',
  'gemini-flash': 'gemini-3.5-flash-lite',
  'gemini-3.8-flash': 'gemini-3.5-flash-lite',
  'gemini-3.5-transcribe': 'gemini-3.5-flash-lite',
  'gemini-3.5-transcribe-live': 'gemini-3.5-flash-lite',
};

/**
 * CADEIAS DE FALLBACK EXATAS CONGELADAS (Zero-Retry):
 * - TTS: gemini-3.8-flash-lite-tts -> gemini-3.8-flash-tts -> gemini-3.1-flash-tts-preview -> gemini-2.5-flash-preview-tts
 * - STT / Geral / Vision: gemini-3.5-flash-lite -> gemini-3.1-flash-lite
 * - Auth Test: gemini-3.1-flash-lite -> gemini-3.5-flash-lite
 */
export const TASK_FALLBACK_CHAINS = {
  tts: TTS_MODELS_WHITELIST,
  stt: STT_GENERAL_MODELS_WHITELIST,
  stt_unary: STT_GENERAL_MODELS_WHITELIST,
  stt_live: STT_GENERAL_MODELS_WHITELIST,
  vision: STT_GENERAL_MODELS_WHITELIST,
  general: STT_GENERAL_MODELS_WHITELIST,
  auth_test: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'] as const,
} as const;

export type TaskFallbackKey = keyof typeof TASK_FALLBACK_CHAINS;

/**
 * Retorna a cadeia estrita de modelos para uma tarefa.
 */
export function getFallbackChainForTask(task: TaskFallbackKey): readonly string[] {
  return TASK_FALLBACK_CHAINS[task] || STT_GENERAL_MODELS_WHITELIST;
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

  const chain = getFallbackChainForTask(task);
  if (chain.includes(trimmed as any)) {
    return trimmed;
  }

  if (MODEL_ALIASES[trimmed]) {
    const target = MODEL_ALIASES[trimmed];
    if (chain.includes(target as any)) {
      return target;
    }
  }

  return getFallbackModelForTask(task);
}

/**
 * Validação de integridade:
 * - sttModelId !== ttsModelId
 * - Modelos TTS só na whitelist TTS
 * - Modelos STT só na whitelist STT/Geral
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

  if (!STT_GENERAL_MODELS_WHITELIST.includes(stt as any)) {
    return {
      valid: false,
      error: `Modelo STT "${stt}" inválido. Permitidos: ${STT_GENERAL_MODELS_WHITELIST.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * MOTOR DE EXECUÇÃO COM FALLBACK IMEDIATO (ZERO-RETRY)
 * 
 * - Sem repetições de modelo.
 * - Sem retries idênticos.
 * - Sem backoff.
 * - Cada modelo da cadeia é chamado no máximo uma única vez.
 * - Qualquer erro encerra a tentativa e passa ao próximo modelo da cadeia.
 * - Falha total retorna erro consolidado de todas as tentativas.
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
    if (triedModels.includes(modelId)) {
      continue;
    }
    triedModels.push(modelId);

    try {
      const result = await executor(modelId);
      return {
        result,
        usedModelId: modelId,
        attempts: triedModels,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ modelId, error: errorMsg });
    }
  }

  const formattedErrors = errors
    .map((e, idx) => `[${idx + 1}] Modelo "${e.modelId}": ${e.error}`)
    .join(' | ');

  throw new Error(
    `Falha total na cadeia de fallback para "${task}". Todos os ${triedModels.length} modelos falharam sem retry. Detalhes: ${formattedErrors}`
  );
}
