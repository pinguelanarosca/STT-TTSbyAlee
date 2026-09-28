/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Metadados e tipos primitivos de áudio (agnósticos de Web Audio API e DOM).
 */

export type AudioEncoding = 'LINEAR16' | 'WAV' | 'MP3' | 'OGG_OPUS' | 'WEBM_OPUS';

export interface AudioMetadata {
  sampleRate: number;      // Taxa de amostragem em Hz (ex: 24000 para Gemini TTS, 16000 para STT)
  channels: number;        // 1 = mono, 2 = stereo
  bitDepth: number;        // 16 bits para PCM linear padrão
  byteLength: number;      // Tamanho total do buffer em bytes
  durationMs: number;      // Duração estimada em milissegundos
}

export interface AudioProcessingConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

export type TtsPlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

export type SttRecordingState = 'idle' | 'listening' | 'processing' | 'transcribing' | 'error';
