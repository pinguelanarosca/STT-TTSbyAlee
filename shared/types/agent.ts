/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Contrato canônico dos Agentes e Personas do EXT TTS STT.
 * Agnóstico de plataforma: compartilhado entre Extension (MV3), Web Studio e Server.
 */

export type AgentModality = 'tts' | 'stt' | 'lens' | 'chat';

export type AgentCategory = 
  | 'productivity' 
  | 'translation' 
  | 'accessibility' 
  | 'editorial' 
  | 'custom';

export type GeminiVoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';

export type AmbienceType = 'none' | 'room' | 'studio' | 'hall' | 'warm';

export interface AgentVoiceConfig {
  preferredVoice: GeminiVoiceName | string;
  pitchMultiplier: number;  // 0.5 a 2.0 (1.0 = normal)
  rateMultiplier: number;   // 0.5 a 2.0 (1.0 = normal)
  volume: number;           // 0.0 a 1.0 (1.0 = 100%)
  bass?: number;            // -10 a +10 dB (0 = normal)
  mid?: number;             // -10 a +10 dB (0 = normal)
  treble?: number;          // -10 a +10 dB (0 = normal)
  ambience?: AmbienceType;
  ambienceIntensity?: number; // 0 a 100%
}

export interface AgentModalityInstructions {
  /** Instrução de sistema para o modelo no modo TTS (leitura inteligente / sumarização / tradução) */
  ttsSystemInstruction: string;
  /** Instrução de formatação e limpeza no modo STT (ditado / transcrição) */
  sttFormattingInstruction: string;
  /** Instrução para inspeção contextual de tela / multimodal Lens */
  lensInspectionInstruction?: string;
}

export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  category: AgentCategory;
  icon: string;             // Nome do ícone (ex: 'Volume2', 'Languages', 'Sparkles', 'FileText')
  color: string;            // Cor hexadecimal ou identificador de tema (ex: '#3b82f6')
  isBuiltIn: boolean;       // True para agentes de fábrica, false para customizados
  version: number;
}

export interface AgentModelPreferences {
  ttsModelId?: string;      // ID do modelo preferido para síntese/interpretação
  sttModelId?: string;      // ID do modelo preferido para transcrição
  sttLiveModelId?: string;  // ID do modelo preferido para streaming/live
  visionModelId?: string;   // ID do modelo preferido para Lens/Visão
  generalModelId?: string;  // ID do modelo geral/fallback
}

export interface CanonicalAgent {
  metadata: AgentMetadata;
  voice: AgentVoiceConfig;
  instructions: AgentModalityInstructions;
  modelPreferences: AgentModelPreferences;
}
