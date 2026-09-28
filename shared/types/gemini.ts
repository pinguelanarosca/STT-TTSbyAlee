/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DTOs e tipos puros de requisição/resposta para API Gemini Multimodal.
 * Agnóstico de SDK (@google/genai ou fetch direto).
 */

export interface GeminiInlineData {
  mimeType: string;
  data: string; // Base64 string
}

export interface GeminiPart {
  text?: string;
  inlineData?: GeminiInlineData;
}

export interface GeminiContent {
  role?: 'user' | 'model' | 'system';
  parts: GeminiPart[];
}

export interface GeminiSpeechConfig {
  voiceConfig?: {
    prebuiltVoiceConfig?: {
      voiceName: string;
    };
  };
}

export interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  speechConfig?: GeminiSpeechConfig;
}

export interface GeminiGenerateContentRequest {
  contents: GeminiContent[];
  systemInstruction?: {
    parts: GeminiPart[];
  };
  generationConfig?: GeminiGenerationConfig;
}

export interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
    role?: string;
  };
  finishReason?: string;
}

export interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export interface TtsSynthesisRequest {
  text: string;
  voiceName: string;
  rateMultiplier: number;
  pitchMultiplier: number;
  systemInstruction?: string;
  modelId?: string;
}

export interface SttTranscriptionRequest {
  audioBase64: string;
  mimeType: string;
  formattingInstruction?: string;
  modelId?: string;
}
