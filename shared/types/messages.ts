/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Protocolo de Mensagens Internas da Extensão Chrome (chrome.runtime.onMessage).
 * Tipado estritamente para garantir comunicação segura entre
 * Content Script, Service Worker, Popup e Options.
 */

import { TtsPlaybackState, SttRecordingState } from './audio';
import { DiscoveredModelInfo } from './models';

export type ExtensionMessageType =
  | 'TTS_REQUEST'
  | 'TTS_STOP'
  | 'TTS_AUDIO_READY'
  | 'STT_TRANSCRIBE_REQUEST'
  | 'STT_RESULT'
  | 'LENS_ANALYZE_REQUEST'
  | 'LENS_RESULT'
  | 'STATUS_UPDATE'
  | 'TOGGLE_HUD'
  | 'TEST_API_KEY'
  | 'DISCOVER_MODELS'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS';

export interface BaseMessage<T extends ExtensionMessageType, P = unknown> {
  type: T;
  payload: P;
  id?: string;
  timestamp?: number;
}

export type TtsRequestMessage = BaseMessage<'TTS_REQUEST', {
  text: string;
  agentId?: string;
  voiceName?: string;
  autoPlay?: boolean;
}>;

export type TtsStopMessage = BaseMessage<'TTS_STOP', void>;

export type TtsAudioReadyMessage = BaseMessage<'TTS_AUDIO_READY', {
  audioBase64: string;
  mimeType: string;
  sampleRate: number;
  durationMs: number;
}>;

export type SttTranscribeMessage = BaseMessage<'STT_TRANSCRIBE_REQUEST', {
  audioBase64: string;
  mimeType: string;
  agentId?: string;
  targetInputSelector?: string;
}>;

export type SttResultMessage = BaseMessage<'STT_RESULT', {
  text: string;
  isFinal: boolean;
  confidence?: number;
}>;

export type StatusUpdateMessage = BaseMessage<'STATUS_UPDATE', {
  ttsState?: TtsPlaybackState;
  sttState?: SttRecordingState;
  errorMessage?: string;
}>;

export type ToggleHudMessage = BaseMessage<'TOGGLE_HUD', {
  visible?: boolean;
}>;

export type TestApiKeyMessage = BaseMessage<'TEST_API_KEY', {
  apiKey: string;
}>;

export type DiscoverModelsMessage = BaseMessage<'DISCOVER_MODELS', void>;

export type LensAnalyzeMessage = BaseMessage<'LENS_ANALYZE_REQUEST', {
  instruction?: string;
  agentId?: string;
}>;

export type LensResultMessage = BaseMessage<'LENS_RESULT', {
  description: string;
}>;

export type AnyExtensionMessage =
  | TtsRequestMessage
  | TtsStopMessage
  | TtsAudioReadyMessage
  | SttTranscribeMessage
  | SttResultMessage
  | LensAnalyzeMessage
  | LensResultMessage
  | StatusUpdateMessage
  | ToggleHudMessage
  | TestApiKeyMessage
  | DiscoverModelsMessage;

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
