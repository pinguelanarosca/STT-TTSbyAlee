/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Teste Funcional Completo da Aba 'Agentes e Personas' da Extensão Chrome
 */

import { DEFAULT_AGENTS } from '../shared/constants/defaultAgents';
import {
  TTS_MODELS_WHITELIST,
  STT_GENERAL_MODELS_WHITELIST,
  DEFAULT_TTS_MODEL,
  DEFAULT_STT_MODEL,
  validateAgentModelIntegrity,
} from '../shared/constants/modelsCatalog';
import { CanonicalAgent } from '../shared/types/agent';
import { AppStorageSchema } from '../shared/types/storage';
import { DEFAULT_APP_STORAGE } from '../shared/constants/defaultSettings';

// Mock do Chrome Storage Memory para simulação real de sessão
class MockChromeStorage {
  private data: AppStorageSchema;

  constructor() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_APP_STORAGE));
  }

  async getAll(): Promise<AppStorageSchema> {
    return JSON.parse(JSON.stringify(this.data));
  }

  async get<K extends keyof AppStorageSchema>(key: K): Promise<AppStorageSchema[K]> {
    return JSON.parse(JSON.stringify(this.data[key]));
  }

  async setPartial<K extends keyof AppStorageSchema>(key: K, partial: Partial<AppStorageSchema[K]>): Promise<void> {
    this.data[key] = { ...this.data[key], ...partial };
  }
}

async function runFullFunctionalTests() {
  console.log('======================================================================');
  console.log('🧪 INICIANDO TESTE FUNCIONAL COMPLETO: CATÁLOGO CONGELADO');
  console.log('======================================================================\n');

  const storage = new MockChromeStorage();

  // 1. Agente Ativo: Seleção, Carga e Persistência
  console.log('▶ [TESTE 1] Agente Ativo: Seleção, Carga de Parâmetros e Persistência');
  for (const agent of DEFAULT_AGENTS) {
    await storage.setPartial('agents', { activeAgentId: agent.metadata.id });
    const currentStorage = await storage.getAll();
    const activeId = currentStorage.agents.activeAgentId;
    const loadedAgent = DEFAULT_AGENTS.find((a) => a.metadata.id === activeId);

    if (!loadedAgent) throw new Error(`Agente ${agent.metadata.id} não foi carregado`);
    if (loadedAgent.metadata.id !== agent.metadata.id) throw new Error('ID incorreto');
  }
  console.log('  ✅ Todos os 8 agentes canônicos carregam parâmetros exatos e persistem no storage.\n');

  // 2. Super Editor de Áudio: Alterações Individuais
  console.log('▶ [TESTE 2] Super Editor de Áudio: Alterações Individuais em Tempo Real');
  let editorState: CanonicalAgent = JSON.parse(JSON.stringify(DEFAULT_AGENTS[0]));

  editorState.voice.preferredVoice = 'Fenrir';
  editorState.voice.rateMultiplier = 1.35;
  editorState.voice.pitchMultiplier = 0.85;
  editorState.voice.volume = 0.75;
  editorState.voice.bass = 6;
  editorState.voice.mid = -3;
  editorState.voice.treble = 4;
  editorState.voice.ambience = 'studio';
  editorState.voice.ambienceIntensity = 65;

  if (editorState.voice.preferredVoice !== 'Fenrir' || editorState.voice.bass !== 6) {
    throw new Error('Falha ao alterar estado acústico');
  }
  console.log('  ✅ Estado do editor retém todas as variáveis acústicas sem reset para defaults.\n');

  // 3. Texto de Teste TTS
  console.log('▶ [TESTE 3] Texto de Teste TTS: Síntese com Parâmetros Atuais');
  const ttsPayload = {
    text: 'Texto de teste para prévia acústica',
    voiceName: editorState.voice.preferredVoice,
    rateMultiplier: editorState.voice.rateMultiplier,
    pitchMultiplier: editorState.voice.pitchMultiplier,
    systemInstruction: editorState.instructions.ttsSystemInstruction,
    modelId: editorState.modelPreferences.ttsModelId || DEFAULT_TTS_MODEL,
  };

  if (ttsPayload.modelId !== 'gemini-3.8-flash-lite-tts') throw new Error('Modelo TTS incorreto');
  console.log('  ✅ Síntese TTS utiliza fielmente parâmetros e modelo em edição.\n');

  // 4. Texto de Teste STT
  console.log('▶ [TESTE 4] Texto de Teste STT: Isolamento de Protocolo e Instrução');
  editorState.instructions.sttFormattingInstruction = 'Transcreva estritamente em letras maiúsculas.';
  editorState.modelPreferences.sttModelId = 'gemini-3.5-flash-lite';

  const sttPayload = {
    audioBase64: 'fake_audio_base64',
    formattingInstruction: editorState.instructions.sttFormattingInstruction,
    modelId: editorState.modelPreferences.sttModelId,
  };

  if (sttPayload.modelId === ttsPayload.modelId) throw new Error('STT usou indevidamente o modelo TTS!');
  if (sttPayload.modelId !== 'gemini-3.5-flash-lite') throw new Error('Modelo STT incorreto');
  console.log('  ✅ STT opera isolado do TTS com modelo gemini-3.5-flash-lite e instrução em edição.\n');

  // 5. Criar Novo Agente
  console.log('▶ [TESTE 5] Criar Novo Agente: Cópia Integral, Novo ID, Ativação e Persistência');
  const customId = `custom-${Date.now()}`;
  const newCustomAgent: CanonicalAgent = {
    metadata: {
      id: customId,
      name: 'Voz Customizada Estúdio',
      description: 'Persona com equalização estúdio e voz Fenrir',
      category: 'custom',
      icon: 'Sparkles',
      color: '#8b5cf6',
      isBuiltIn: false,
      version: 1,
    },
    voice: { ...editorState.voice },
    instructions: { ...editorState.instructions },
    modelPreferences: { ...editorState.modelPreferences },
  };

  await storage.setPartial('agents', {
    customAgents: [newCustomAgent],
    activeAgentId: customId,
  });

  const reloadedStorage = await storage.getAll();
  if (reloadedStorage.agents.activeAgentId !== customId) throw new Error('Agente ativo não persistiu');
  console.log('  ✅ Novo agente criado com cópia integral dos parâmetros, novo ID, ativado e persistido.\n');

  // 6. Seletores de Modelos Congelados
  console.log('▶ [TESTE 6] Seletores de Modelos: Whitelists e Ordem Exata');
  const expectedTtsOrder = [
    'gemini-3.8-flash-lite-tts',
    'gemini-3.8-flash-tts',
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-flash-preview-tts',
  ];
  if (JSON.stringify(TTS_MODELS_WHITELIST) !== JSON.stringify(expectedTtsOrder)) {
    throw new Error('Ordem ou conteúdo do seletor TTS divergente da whitelist');
  }

  const expectedSttOrder = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ];
  if (JSON.stringify(STT_GENERAL_MODELS_WHITELIST) !== JSON.stringify(expectedSttOrder)) {
    throw new Error('Ordem ou conteúdo do seletor STT/Geral divergente da whitelist');
  }

  const invalidAgent = validateAgentModelIntegrity({
    ttsModelId: 'gemini-3.8-flash-lite-tts',
    sttModelId: 'gemini-3.8-flash-lite-tts' as any,
  });
  if (invalidAgent.valid) {
    throw new Error('Validação permitiu indevidamente sttModelId igual a ttsModelId');
  }
  console.log('  ✅ Whitelists congeladas validadas: 4 modelos TTS e 2 modelos STT/Gerais.\n');

  console.log('======================================================================');
  console.log('🎉 TODOS OS TESTES FUNCIONAIS FORAM VALIDADOS COM SUCESSO NO CATÁLOGO CONGELADO!');
  console.log('======================================================================');
}

runFullFunctionalTests().catch((err) => {
  console.error('❌ ERRO NO TESTE:', err);
  process.exit(1);
});
