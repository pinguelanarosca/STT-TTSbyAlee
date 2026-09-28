/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Validações de integridade e consistência para chaves, agentes e payloads.
 * Agnóstico de plataforma.
 */

import { CanonicalAgent } from '../types/agent';
import { AudioSettingsSchema } from '../types/storage';

/**
 * Validação sintática preliminar da chave de API do Gemini (Google AI Studio).
 */
export function validateApiKey(apiKey: unknown): boolean {
  if (typeof apiKey !== 'string') return false;
  const trimmed = apiKey.trim();
  // Chaves do Google AI Studio tipicamente iniciam com 'AIzaSy' e possuem 39 caracteres
  if (trimmed.length < 30) return false;
  return /^AIzaSy[A-Za-z0-9_-]{33}$/.test(trimmed) || trimmed.length >= 35;
}

/**
 * Validação de conformidade de um objeto com a interface CanonicalAgent.
 */
export function validateAgent(candidate: unknown): candidate is CanonicalAgent {
  if (!candidate || typeof candidate !== 'object') return false;
  const a = candidate as Partial<CanonicalAgent>;

  if (!a.metadata || typeof a.metadata !== 'object') return false;
  if (typeof a.metadata.id !== 'string' || a.metadata.id.trim() === '') return false;
  if (typeof a.metadata.name !== 'string' || a.metadata.name.trim() === '') return false;

  if (!a.voice || typeof a.voice !== 'object') return false;
  if (typeof a.voice.preferredVoice !== 'string') return false;
  if (typeof a.voice.volume !== 'number' || a.voice.volume < 0 || a.voice.volume > 1) return false;

  if (!a.instructions || typeof a.instructions !== 'object') return false;
  if (typeof a.instructions.ttsSystemInstruction !== 'string') return false;
  if (typeof a.instructions.sttFormattingInstruction !== 'string') return false;

  return true;
}

/**
 * Valida se as configurações de áudio estão dentro de intervalos acústicos seguros.
 */
export function validateAudioSettings(candidate: unknown): candidate is AudioSettingsSchema {
  if (!candidate || typeof candidate !== 'object') return false;
  const s = candidate as Partial<AudioSettingsSchema>;

  if (typeof s.sampleRate !== 'number' || s.sampleRate < 8000 || s.sampleRate > 96000) return false;
  if (typeof s.volume !== 'number' || s.volume < 0 || s.volume > 1) return false;
  if (typeof s.pitchMultiplier !== 'number' || s.pitchMultiplier < 0.2 || s.pitchMultiplier > 3.0) return false;
  if (typeof s.rateMultiplier !== 'number' || s.rateMultiplier < 0.2 || s.rateMultiplier > 3.0) return false;
  if (typeof s.autoPlay !== 'boolean') return false;

  return true;
}

/**
 * Validação do schema completo de persistência namespaced.
 */
export function validateAppStorageSchema(candidate: unknown): boolean {
  if (!candidate || typeof candidate !== 'object') return false;
  const s = candidate as Record<string, unknown>;
  return (
    typeof s.api === 'object' && s.api !== null &&
    typeof s.agents === 'object' && s.agents !== null &&
    typeof s.audio === 'object' && s.audio !== null &&
    typeof s.models === 'object' && s.models !== null &&
    typeof s.ui === 'object' && s.ui !== null &&
    typeof s.history === 'object' && s.history !== null
  );
}

