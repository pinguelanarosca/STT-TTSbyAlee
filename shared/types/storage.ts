/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Contrato unificado de Armazenamento organizado por Namespaces.
 * Estrutura estrita: api, agents, audio, models, ui, history.
 */

import { CanonicalAgent, GeminiVoiceName } from './agent';
import { DiscoveredModelInfo } from './models';

export interface ApiSettingsSchema {
  apiKey: string;
  customEndpoint?: string;
  timeoutMs: number;
}

export interface AgentsSettingsSchema {
  activeAgentId: string;
  customAgents: CanonicalAgent[];
  favoriteAgentIds: string[];
}

export interface AudioSettingsSchema {
  sampleRate: number;
  preferredVoice: GeminiVoiceName | string;
  autoPlay: boolean;
  volume: number;
  pitchMultiplier: number;
  rateMultiplier: number;
}

export interface ModelsSettingsSchema {
  ttsModelId: string;
  sttModelId: string;
  visionModelId: string;
  generalModelId: string;
  discoveredModels: DiscoveredModelInfo[];
  discoveryCacheTimestamp?: number;
}

export interface UiPreferencesSchema {
  hudPosition: { x: number; y: number };
  theme: 'dark' | 'light' | 'system';
  autoInject: boolean;
  shortcuts: {
    toggleHud?: string;
    readSelection?: string;
    startDictation?: string;
    togglePause?: string;
    lensSelection?: string;
  };
}

export interface HistoryItemSchema {
  id: string;
  timestamp: number;
  type: 'tts' | 'stt' | 'vision';
  agentId: string;
  previewText: string;
  durationMs?: number;
  status?: 'success' | 'error';
  errorDetails?: string;
}

export type HistoryItem = HistoryItemSchema;

export interface HistorySettingsSchema {
  enabled: boolean;
  maxEntries: number;
  recentItems: HistoryItemSchema[];
}

export interface AppStorageSchema {
  api: ApiSettingsSchema;
  agents: AgentsSettingsSchema;
  audio: AudioSettingsSchema;
  models: ModelsSettingsSchema;
  ui: UiPreferencesSchema;
  history: HistorySettingsSchema;
}

export interface IStorageService {
  get<K extends keyof AppStorageSchema>(namespace: K): Promise<AppStorageSchema[K]>;
  getAll(): Promise<AppStorageSchema>;
  set<K extends keyof AppStorageSchema>(namespace: K, value: AppStorageSchema[K]): Promise<void>;
  setPartial<K extends keyof AppStorageSchema>(namespace: K, partial: Partial<AppStorageSchema[K]>): Promise<void>;
  setMultiple(partial: Partial<AppStorageSchema>): Promise<void>;
  reset(): Promise<void>;
  subscribe<K extends keyof AppStorageSchema>(
    namespace: K,
    callback: (newValue: AppStorageSchema[K], oldValue?: AppStorageSchema[K]) => void
  ): () => void;
}
