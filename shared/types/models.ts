/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Contratos de Capacidades e Metadados de Modelos Gemini.
 * Modela estritamente:
 * - Categorias: general multimodal, vision, stt_transcription, tts, live_audio
 * - I/O: inputModalities, outputModalities
 * - Tarefas: general, vision, stt, tts, live
 * - Métodos de API: generateContent, generateContentStream, liveConnect
 * - Ciclo de vida: GA, preview, deprecated, replacement
 */

export type ModelCategory = 
  | 'general_multimodal' 
  | 'vision' 
  | 'stt_transcription' 
  | 'tts' 
  | 'live_audio';

export type ModelTier = 'flash' | 'pro' | 'lite' | 'preview' | 'legacy';

export type ModelAvailability = 'ga' | 'preview' | 'deprecated' | 'runtime_discovered';

export type ModelApiMethod = 
  | 'generateContent' 
  | 'generateContentStream' 
  | 'liveConnect';

export interface ModelInputModalities {
  text: boolean;
  image: boolean;
  audio: boolean;
  video: boolean;
}

export interface ModelOutputModalities {
  text: boolean;
  audio: boolean;
  image: boolean;
}

export interface ModelTaskCapabilities {
  general: {
    supported: boolean;
  };
  vision: {
    supported: boolean;
    method?: 'generateContent';
  };
  stt: {
    supported: boolean;
    method?: 'generateContent' | 'liveConnect';
  };
  tts: {
    supported: boolean;
    method?: 'generateContent' | 'systemSpeech';
  };
  live: {
    supported: boolean;
    method?: 'liveConnect';
  };
}

export interface ModelDescriptor {
  id: string;
  displayName: string;
  description: string;
  category: ModelCategory;
  tier: ModelTier;
  inputModalities: ModelInputModalities;
  outputModalities: ModelOutputModalities;
  tasks: ModelTaskCapabilities;
  apiMethods: ModelApiMethod[];
  streaming: boolean;
  deprecated: boolean;
  replacementModelId?: string;
  availability: ModelAvailability;
  recommendedMaxTokens?: number;
}

export interface DiscoveredModelInfo {
  id: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
  discoveredAt: number; // timestamp UTC
}
