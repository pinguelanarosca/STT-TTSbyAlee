/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Catálogo Canônico de Modelos Gemini, Matriz Estrita de Capacidades
 * e Cadeias de Fallback Independentes por Tarefa/Modalidade.
 * 
 * Baseado estritamente na documentação oficial atual da API Gemini:
 * - TTS: gemini-3.8-flash-lite-tts / gemini-3.8-flash-tts
 * - STT: gemini-3.5-transcribe / gemini-3.5-transcribe-live
 * - General/Vision: gemini-3.8-flash / gemini-3.1-pro-preview
 * - Live Voice: gemini-3.8-live / gemini-3.8-live-extended-thinking
 * Modelos da família 1.5 e 2.0 são marcados explicitamente como obsoletos/encerrados.
 */

import { ModelDescriptor } from '../types/models';

/**
 * Catálogo oficial de modelos conhecidos e testados.
 * A disponibilidade em runtime de novos modelos deve ser enriquecida via API Discovery.
 */
export const KNOWN_MODELS: Record<string, ModelDescriptor> = {
  // =========================================================================
  // MODELOS TTS (Text-to-Speech) DEDICADOS
  // =========================================================================
  'gemini-3.8-flash-lite-tts': {
    id: 'gemini-3.8-flash-lite-tts',
    displayName: 'Gemini 3.8 Flash-Lite TTS',
    description: 'Modelo de áudio de alta eficiência e ultrabaixa latência para leitura de artigos, assistentes e TTS padrão.',
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
    apiMethods: ['generateContent'],
    streaming: false,
    deprecated: false,
    availability: 'ga',
    recommendedMaxTokens: 4096,
  },
  'gemini-3.8-flash-tts': {
    id: 'gemini-3.8-flash-tts',
    displayName: 'Gemini 3.8 Flash TTS',
    description: 'Modelo flagship de síntese vocal com suporte a Voice Design, múltiplos interlocutores, diálogos e backchanneling.',
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
    apiMethods: ['generateContent'],
    streaming: false,
    deprecated: false,
    availability: 'ga',
    recommendedMaxTokens: 8192,
  },

  // =========================================================================
  // MODELOS STT (Speech-to-Text / Transcrição de Áudio) DEDICADOS
  // =========================================================================
  'gemini-3.5-transcribe': {
    id: 'gemini-3.5-transcribe',
    displayName: 'Gemini 3.5 Transcribe',
    description: 'Modelo especializado para transcrição de áudio pré-gravado ou estático em texto estruturado.',
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
    apiMethods: ['generateContent', 'generateContentStream'],
    streaming: true,
    deprecated: false,
    availability: 'ga',
    recommendedMaxTokens: 8192,
  },
  'gemini-3.5-transcribe-live': {
    id: 'gemini-3.5-transcribe-live',
    displayName: 'Gemini 3.5 Transcribe Live',
    description: 'Modelo para transcrição de áudio em tempo real e tradução de fala via Live API.',
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
    apiMethods: ['liveConnect'],
    streaming: true,
    deprecated: false,
    availability: 'ga',
  },

  // =========================================================================
  // MODELOS GERAIS MULTIMODAIS / VISION
  // =========================================================================
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash',
    description: 'Flagship multimodal de alta velocidade para tarefas de texto, sumarização, revisão e compreensão visual.',
    category: 'general_multimodal',
    tier: 'flash',
    inputModalities: { text: true, image: true, audio: true, video: true },
    outputModalities: { text: true, audio: false, image: false },
    tasks: {
      general: { supported: true },
      vision: { supported: true, method: 'generateContent' },
      stt: { supported: false }, // Não é o modelo especializado para STT
      tts: { supported: false }, // Não gera áudio nativo de saída
      live: { supported: false },
    },
    apiMethods: ['generateContent', 'generateContentStream'],
    streaming: true,
    deprecated: false,
    availability: 'ga',
    recommendedMaxTokens: 8192,
  },
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro Preview',
    description: 'Modelo avançado para raciocínio analítico complexo, código denso e tarefas STEM.',
    category: 'general_multimodal',
    tier: 'preview',
    inputModalities: { text: true, image: true, audio: true, video: true },
    outputModalities: { text: true, audio: false, image: false },
    tasks: {
      general: { supported: true },
      vision: { supported: true, method: 'generateContent' },
      stt: { supported: false },
      tts: { supported: false },
      live: { supported: false },
    },
    apiMethods: ['generateContent', 'generateContentStream'],
    streaming: true,
    deprecated: false,
    availability: 'preview',
    recommendedMaxTokens: 8192,
  },

  // =========================================================================
  // MODELOS LIVE (Audio-to-Audio em Tempo Real)
  // =========================================================================
  'gemini-3.8-live': {
    id: 'gemini-3.8-live',
    displayName: 'Gemini 3.8 Live',
    description: 'Interação bidirecional de voz e vídeo em tempo real com áudio nativo na Live API.',
    category: 'live_audio',
    tier: 'flash',
    inputModalities: { text: true, image: true, audio: true, video: true },
    outputModalities: { text: true, audio: true, image: false },
    tasks: {
      general: { supported: false },
      vision: { supported: true, method: 'generateContent' },
      stt: { supported: false },
      tts: { supported: false },
      live: { supported: true, method: 'liveConnect' },
    },
    apiMethods: ['liveConnect'],
    streaming: true,
    deprecated: false,
    availability: 'ga',
  },
  'gemini-3.8-live-extended-thinking': {
    id: 'gemini-3.8-live-extended-thinking',
    displayName: 'Gemini 3.8 Live Extended Thinking',
    description: 'Interação de voz em tempo real combinada com capacidade de raciocínio profundo e chamada a ferramentas.',
    category: 'live_audio',
    tier: 'preview',
    inputModalities: { text: true, image: true, audio: true, video: true },
    outputModalities: { text: true, audio: true, image: false },
    tasks: {
      general: { supported: false },
      vision: { supported: true, method: 'generateContent' },
      stt: { supported: false },
      tts: { supported: false },
      live: { supported: true, method: 'liveConnect' },
    },
    apiMethods: ['liveConnect'],
    streaming: true,
    deprecated: false,
    availability: 'preview',
  },

  // =========================================================================
  // MODELOS LEGADOS / DEPRECADOS (Mapeamento explícito para substitutos)
  // =========================================================================
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash (Encerrado)',
    description: 'Modelo de geração anterior oficialmente encerrado pelo Google.',
    category: 'general_multimodal',
    tier: 'legacy',
    inputModalities: { text: true, image: true, audio: true, video: true },
    outputModalities: { text: true, audio: false, image: false },
    tasks: {
      general: { supported: false },
      vision: { supported: false },
      stt: { supported: false },
      tts: { supported: false },
      live: { supported: false },
    },
    apiMethods: [],
    streaming: false,
    deprecated: true,
    replacementModelId: 'gemini-3.8-flash',
    availability: 'deprecated',
  },
};

/**
 * Aliases e mapeamento de substituição para modelos legados encontrados no código antigo.
 */
export const MODEL_ALIASES: Record<string, string> = {
  // Família 2.0
  'gemini-2.0-flash': 'gemini-3.8-flash',
  'gemini-2.0-pro': 'gemini-3.1-pro-preview',
  'gemini-2.0-flash-thinking': 'gemini-3.8-flash',
  'gemini-2.5-flash': 'gemini-3.8-flash',

  // Família 1.5
  'gemini-1.5-flash': 'gemini-3.8-flash',
  'gemini-1.5-flash-latest': 'gemini-3.8-flash',
  'gemini-1.5-pro': 'gemini-3.1-pro-preview',
  'gemini-1.5-pro-latest': 'gemini-3.1-pro-preview',

  // Nomes genéricos
  'gemini-flash': 'gemini-3.8-flash',
  'gemini-pro': 'gemini-3.1-pro-preview',
  'gemini-transcribe': 'gemini-3.5-transcribe',
  'gemini-tts': 'gemini-3.8-flash-lite-tts',
  'gemini-live': 'gemini-3.8-live',
};

/**
 * CADEIAS DE FALLBACK INDEPENDENTES POR TAREFA E PROTOCOLO/TRANSPORT.
 * - STT unary/file -> generateContent (gemini-3.5-transcribe)
 * - STT live/stream -> liveConnect / WebSocket (gemini-3.5-transcribe-live)
 * Jamais utiliza o modelo Live como fallback automático do fluxo Unary ou vice-versa.
 */
export const TASK_FALLBACK_CHAINS = {
  /** TTS: Apenas modelos que produzem saída nativa de fala via generateContent */
  tts: ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'] as const,

  /** STT Unary/File: Transcrição de áudio via generateContent/generateContentStream */
  stt_unary: ['gemini-3.5-transcribe'] as const,

  /** STT Live/Streaming: Transcrição e tradução em tempo real via liveConnect/WebSocket */
  stt_live: ['gemini-3.5-transcribe-live'] as const,

  /** STT legado/padrão: Mapeia estritamente para o transport unary */
  stt: ['gemini-3.5-transcribe'] as const,

  /** Vision: Modelos multimodais com processamento visual */
  vision: ['gemini-3.8-flash', 'gemini-3.1-pro-preview'] as const,

  /** General / Editorial / Texto */
  general: ['gemini-3.8-flash', 'gemini-3.1-pro-preview'] as const,

  /** Live Audio bidirecional conversacional */
  live: ['gemini-3.8-live', 'gemini-3.8-live-extended-thinking'] as const,
};

export type TaskFallbackKey = keyof typeof TASK_FALLBACK_CHAINS;

/**
 * Retorna o modelo padrão garantido para a tarefa e protocolo especificados.
 */
export function getFallbackModelForTask(
  task: TaskFallbackKey
): string {
  return TASK_FALLBACK_CHAINS[task][0];
}

/**
 * Normaliza um ID de modelo, resolvendo aliases e respeitando a tarefa e protocolo pretendidos.
 */
export function normalizeModelId(
  rawModelId: string | undefined | null,
  task: TaskFallbackKey = 'general'
): string {
  if (!rawModelId || typeof rawModelId !== 'string') {
    return getFallbackModelForTask(task);
  }
  const trimmed = rawModelId.trim();

  // Se for um alias conhecido, redireciona para o substituto
  if (MODEL_ALIASES[trimmed]) {
    const aliased = MODEL_ALIASES[trimmed];
    // Validação estrita por protocolo
    if (task === 'tts' && !KNOWN_MODELS[aliased]?.tasks.tts.supported) {
      return getFallbackModelForTask('tts');
    }
    if ((task === 'stt' || task === 'stt_unary') && KNOWN_MODELS[aliased]?.tasks.stt.method !== 'generateContent') {
      return getFallbackModelForTask('stt_unary');
    }
    if (task === 'stt_live' && KNOWN_MODELS[aliased]?.tasks.stt.method !== 'liveConnect') {
      return getFallbackModelForTask('stt_live');
    }
    return aliased;
  }

  return trimmed;
}

/**
 * Validação rigorosa de capacidade do modelo para a tarefa pretendida.
 */
export function validateModelTaskSupport(
  modelId: string,
  task: 'tts' | 'stt' | 'vision' | 'general' | 'live'
): boolean {
  const normalized = normalizeModelId(modelId, task);
  const descriptor = KNOWN_MODELS[normalized];
  if (!descriptor) {
    // Modelos descobertos dinamicamente em runtime
    return true;
  }
  return descriptor.tasks[task]?.supported ?? false;
}
