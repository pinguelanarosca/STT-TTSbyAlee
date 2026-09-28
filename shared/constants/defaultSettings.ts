/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Configurações e Preferências Padrão do Sistema (Single Source of Truth).
 * Organizado estritamente pelos namespaces: api, agents, audio, models, ui, history.
 */

import {
  AppStorageSchema,
  ApiSettingsSchema,
  AgentsSettingsSchema,
  AudioSettingsSchema,
  ModelsSettingsSchema,
  UiPreferencesSchema,
  HistorySettingsSchema,
} from '../types/storage';
import { DEFAULT_AGENT_ID } from './defaultAgents';
import { getFallbackModelForTask } from './modelsCatalog';

export const DEFAULT_API_SETTINGS: ApiSettingsSchema = {
  apiKey: '',
  timeoutMs: 30000,
};

export const DEFAULT_AGENTS_SETTINGS: AgentsSettingsSchema = {
  activeAgentId: DEFAULT_AGENT_ID,
  customAgents: [],
  favoriteAgentIds: ['narrator', 'translator', 'summarizer'],
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettingsSchema = {
  sampleRate: 24000, // Padrão LINEAR16 24kHz Gemini TTS
  preferredVoice: 'Puck',
  autoPlay: true,
  volume: 1.0,
  pitchMultiplier: 1.0,
  rateMultiplier: 1.0,
};

export const DEFAULT_MODELS_SETTINGS: ModelsSettingsSchema = {
  ttsModelId: getFallbackModelForTask('tts'),      // gemini-3.8-flash-lite-tts
  sttModelId: getFallbackModelForTask('stt'),      // gemini-3.5-transcribe
  visionModelId: getFallbackModelForTask('vision'), // gemini-3.8-flash
  generalModelId: getFallbackModelForTask('general'), // gemini-3.8-flash
  discoveredModels: [],
  discoveryCacheTimestamp: undefined,
};

export const DEFAULT_UI_PREFERENCES: UiPreferencesSchema = {
  hudPosition: { x: 24, y: 24 },
  theme: 'system',
  autoInject: true,
  shortcuts: {
    toggleHud: 'Alt+Shift+H',
    readSelection: 'Alt+Shift+S',
    startDictation: 'Alt+Shift+D',
  },
};

export const DEFAULT_HISTORY_SETTINGS: HistorySettingsSchema = {
  enabled: true,
  maxEntries: 50,
  recentItems: [],
};

export const DEFAULT_STORAGE_STATE: AppStorageSchema = {
  api: DEFAULT_API_SETTINGS,
  agents: DEFAULT_AGENTS_SETTINGS,
  audio: DEFAULT_AUDIO_SETTINGS,
  models: DEFAULT_MODELS_SETTINGS,
  ui: DEFAULT_UI_PREFERENCES,
  history: DEFAULT_HISTORY_SETTINGS,
};

/**
 * Função pura de migração para transformar dados brutos e desestruturados
 * de versões antigas do storage na estrutura namespaced canônica.
 */
export function migrateLegacyStorage(raw: Record<string, unknown>): AppStorageSchema {
  const state: AppStorageSchema = {
    api: { ...DEFAULT_API_SETTINGS },
    agents: { ...DEFAULT_AGENTS_SETTINGS },
    audio: { ...DEFAULT_AUDIO_SETTINGS },
    models: { ...DEFAULT_MODELS_SETTINGS },
    ui: { ...DEFAULT_UI_PREFERENCES },
    history: { ...DEFAULT_HISTORY_SETTINGS },
  };

  if (!raw || typeof raw !== 'object') return state;

  // Migração do namespace api
  if (typeof raw.apiKey === 'string') state.api.apiKey = raw.apiKey;
  if (raw.api && typeof raw.api === 'object') {
    state.api = { ...state.api, ...(raw.api as Partial<ApiSettingsSchema>) };
  }

  // Migração do namespace agents
  if (typeof raw.activeAgentId === 'string') state.agents.activeAgentId = raw.activeAgentId;
  if (Array.isArray(raw.customAgents)) state.agents.customAgents = raw.customAgents;
  if (raw.agents && typeof raw.agents === 'object') {
    state.agents = { ...state.agents, ...(raw.agents as Partial<AgentsSettingsSchema>) };
  }

  // Migração do namespace audio
  if (raw.audioSettings && typeof raw.audioSettings === 'object') {
    state.audio = { ...state.audio, ...(raw.audioSettings as Partial<AudioSettingsSchema>) };
  } else if (raw.audio && typeof raw.audio === 'object') {
    state.audio = { ...state.audio, ...(raw.audio as Partial<AudioSettingsSchema>) };
  }

  // Migração do namespace models
  if (raw.modelSettings && typeof raw.modelSettings === 'object') {
    state.models = { ...state.models, ...(raw.modelSettings as Partial<ModelsSettingsSchema>) };
  } else if (raw.models && typeof raw.models === 'object') {
    state.models = { ...state.models, ...(raw.models as Partial<ModelsSettingsSchema>) };
  }

  // Migração do namespace ui
  if (raw.uiPreferences && typeof raw.uiPreferences === 'object') {
    state.ui = { ...state.ui, ...(raw.uiPreferences as Partial<UiPreferencesSchema>) };
  } else if (raw.ui && typeof raw.ui === 'object') {
    state.ui = { ...state.ui, ...(raw.ui as Partial<UiPreferencesSchema>) };
  }

  return state;
}
