/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Página Completa de Configurações da Extensão Chrome (React 19 + TypeScript).
 * Preserva integralmente:
 * - Agentes (CRUD completo de customizados + 8 agentes de fábrica)
 * - Vozes Gemini (Puck, Charon, Kore, Fenrir, Aoede)
 * - Modelos (TTS, STT, Vision, Descoberta)
 * - Diagnóstico e teste de chave de API
 * - Atalhos de teclado
 * - Histórico e Logs
 */

import React, { useEffect, useState } from 'react';
import {
  Key,
  Users,
  Cpu,
  Volume2,
  Keyboard,
  History,
  Save,
  CheckCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
} from 'lucide-react';
import { AppStorageSchema } from '@shared/types/storage';
import { CanonicalAgent } from '@shared/types/agent';
import { DEFAULT_AGENTS } from '@shared/constants/defaultAgents';
import { KNOWN_MODELS, TASK_FALLBACK_CHAINS } from '@shared/constants/modelsCatalog';
import { chromeStorage } from '../services/storage/chromeStorageAdapter';

type TabKey = 'api' | 'agents' | 'models' | 'audio' | 'shortcuts' | 'history';

export const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('api');
  const [storageState, setStorageState] = useState<AppStorageSchema | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Estado para edição/criação de agente
  const [editingAgent, setEditingAgent] = useState<CanonicalAgent | null>(null);

  useEffect(() => {
    chromeStorage.getAll().then((data) => {
      setStorageState(data);
    });
  }, []);

  const notifySaved = (msg: string = 'Configurações salvas!') => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleSaveApiKey = async (newKey: string) => {
    if (!storageState) return;
    await chromeStorage.setPartial('api', { apiKey: newKey.trim() });
    setStorageState({ ...storageState, api: { ...storageState.api, apiKey: newKey.trim() } });
    notifySaved('Chave de API salva com sucesso!');
  };

  const handleTestApiKey = async () => {
    if (!storageState?.api.apiKey) {
      setTestResult({ success: false, message: 'Digite uma chave de API primeiro.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);

    chrome.runtime.sendMessage(
      { type: 'TEST_API_KEY', payload: { apiKey: storageState.api.apiKey } },
      (response) => {
        setIsTesting(false);
        if (response?.success) {
          setTestResult({ success: true, message: 'Chave válida e autenticada com sucesso no Google AI Studio!' });
        } else {
          setTestResult({ success: false, message: response?.error || 'Chave inválida ou erro de rede.' });
        }
      }
    );
  };

  const handleSaveAgent = async (agentToSave: CanonicalAgent) => {
    if (!storageState) return;

    let updatedCustom = [...storageState.agents.customAgents];
    const existingIndex = updatedCustom.findIndex((a) => a.metadata.id === agentToSave.metadata.id);

    if (existingIndex >= 0) {
      updatedCustom[existingIndex] = agentToSave;
    } else {
      updatedCustom.push(agentToSave);
    }

    await chromeStorage.setPartial('agents', { customAgents: updatedCustom });
    setStorageState({
      ...storageState,
      agents: { ...storageState.agents, customAgents: updatedCustom },
    });
    setEditingAgent(null);
    notifySaved(`Agente "${agentToSave.metadata.name}" salvo com sucesso!`);
  };

  const handleDeleteCustomAgent = async (id: string) => {
    if (!storageState) return;
    const updated = storageState.agents.customAgents.filter((a) => a.metadata.id !== id);
    await chromeStorage.setPartial('agents', { customAgents: updated });
    setStorageState({
      ...storageState,
      agents: { ...storageState.agents, customAgents: updated },
    });
    notifySaved('Agente removido.');
  };

  if (!storageState) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8' }}>
        Carregando configurações...
      </div>
    );
  }

  const allAgents = [...DEFAULT_AGENTS, ...storageState.agents.customAgents];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Volume2 size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f8fafc' }}>
              EXT TTS STT — Configurações
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
              Painel de controle de inteligência artificial multimodal Gemini
            </p>
          </div>
        </div>

        {savedNotice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '6px 12px', borderRadius: 6, fontSize: 13 }}>
            <CheckCircle size={16} />
            <span>{savedNotice}</span>
          </div>
        )}
      </div>

      {/* Navegação por Abas */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #1e293b', paddingBottom: 8, marginBottom: 24, overflowX: 'auto' }}>
        {[
          { key: 'api', label: 'Chave Gemini & Testes', icon: Key },
          { key: 'agents', label: 'Agentes & Personas', icon: Users },
          { key: 'models', label: 'Modelos de IA', icon: Cpu },
          { key: 'audio', label: 'Áudio & Vozes', icon: Volume2 },
          { key: 'shortcuts', label: 'Atalhos de Teclado', icon: Keyboard },
          { key: 'history', label: 'Histórico & Logs', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: isActive ? '#1e293b' : 'transparent',
                color: isActive ? '#38bdf8' : '#94a3b8',
                border: isActive ? '1px solid #334155' : '1px solid transparent',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Conteúdo das Abas */}

      {/* ABA 1: API KEY & DIAGNÓSTICO */}
      {activeTab === 'api' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: '#f8fafc' }}>
            Chave de API do Google AI Studio (Gemini)
          </h2>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
            A extensão utiliza sua chave de API para se comunicar diretamente com os endpoints de áudio do Google Gemini.
            A chave fica armazenada com segurança no seu navegador através de <code>chrome.storage.local</code>.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              type="password"
              placeholder="Cole sua chave AIzaSy..."
              defaultValue={storageState.api.apiKey}
              id="input-api-key"
              style={{
                flex: 1,
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                color: '#f8fafc',
                padding: '10px 14px',
                fontSize: 13,
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={() => {
                const el = document.getElementById('input-api-key') as HTMLInputElement;
                if (el) handleSaveApiKey(el.value);
              }}
              style={{
                background: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Save size={16} />
              <span>Salvar Chave</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <button
              onClick={handleTestApiKey}
              disabled={isTesting}
              style={{
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                cursor: isTesting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={15} className={isTesting ? 'animate-spin' : ''} />
              <span>{isTesting ? 'Testando...' : 'Testar Conexão com Gemini'}</span>
            </button>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#38bdf8', fontSize: 13, textDecoration: 'none' }}
            >
              Obter chave no Google AI Studio ↗
            </a>
          </div>

          {testResult && (
            <div
              style={{
                marginTop: 16,
                padding: '12px 16px',
                borderRadius: 8,
                fontSize: 13,
                background: testResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: testResult.success ? '1px solid #10b981' : '1px solid #ef4444',
                color: testResult.success ? '#34d399' : '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {testResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: AGENTES & PERSONAS */}
      {activeTab === 'agents' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Agentes Padrão ({DEFAULT_AGENTS.length}) & Customizados ({storageState.agents.customAgents.length})
            </h2>
            <button
              onClick={() => {
                setEditingAgent({
                  metadata: {
                    id: `custom-${Date.now()}`,
                    name: 'Novo Agente',
                    description: 'Descrição do agente customizado',
                    category: 'custom',
                    icon: 'Sparkles',
                    color: '#3b82f6',
                    isBuiltIn: false,
                    version: 1,
                  },
                  voice: {
                    preferredVoice: 'Puck',
                    pitchMultiplier: 1.0,
                    rateMultiplier: 1.0,
                    volume: 1.0,
                  },
                  instructions: {
                    ttsSystemInstruction: 'Você é um assistente de leitura.',
                    sttFormattingInstruction: 'Transcreva o áudio com fidelidade.',
                  },
                  modelPreferences: {
                    ttsModelId: 'gemini-3.8-flash-lite-tts',
                    sttModelId: 'gemini-3.5-transcribe',
                  },
                });
              }}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={16} />
              <span>Criar Novo Agente</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {allAgents.map((ag) => (
              <div
                key={ag.metadata.id}
                style={{
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: ag.metadata.color }} />
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#f8fafc' }}>{ag.metadata.name}</span>
                    </div>
                    {ag.metadata.isBuiltIn ? (
                      <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', borderRadius: 4 }}>
                        De Fábrica
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa', borderRadius: 4 }}>
                        Customizado
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px', lineHeight: 1.4 }}>
                    {ag.metadata.description}
                  </p>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Voz: <strong style={{ color: '#cbd5e1' }}>{ag.voice.preferredVoice}</strong> • Velocidade: {ag.voice.rateMultiplier}x
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 14, borderTop: '1px solid #1e293b', paddingTop: 10 }}>
                  <button
                    onClick={() => setEditingAgent({ ...ag })}
                    style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', borderRadius: 6, padding: '6px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <Edit2 size={13} />
                    <span>Editar</span>
                  </button>
                  {!ag.metadata.isBuiltIn && (
                    <button
                      onClick={() => handleDeleteCustomAgent(ag.metadata.id)}
                      style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
                      title="Excluir agente"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Modal de Edição */}
          {editingAgent && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
              <div style={{ width: 500, background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#f8fafc' }}>
                  Editar Agente: {editingAgent.metadata.name}
                </h3>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Nome:</label>
                  <input
                    type="text"
                    value={editingAgent.metadata.name}
                    onChange={(e) => setEditingAgent({ ...editingAgent, metadata: { ...editingAgent.metadata, name: e.target.value } })}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f8fafc', padding: 8, fontSize: 13 }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Voz Gemini:</label>
                  <select
                    value={editingAgent.voice.preferredVoice}
                    onChange={(e) => setEditingAgent({ ...editingAgent, voice: { ...editingAgent.voice, preferredVoice: e.target.value } })}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f8fafc', padding: 8, fontSize: 13 }}
                  >
                    {['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Instrução TTS (Síntese de Voz):</label>
                  <textarea
                    rows={3}
                    value={editingAgent.instructions.ttsSystemInstruction}
                    onChange={(e) => setEditingAgent({ ...editingAgent, instructions: { ...editingAgent.instructions, ttsSystemInstruction: e.target.value } })}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f8fafc', padding: 8, fontSize: 12 }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Instrução STT (Transcrição de Fala):</label>
                  <textarea
                    rows={3}
                    value={editingAgent.instructions.sttFormattingInstruction}
                    onChange={(e) => setEditingAgent({ ...editingAgent, instructions: { ...editingAgent.instructions, sttFormattingInstruction: e.target.value } })}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f8fafc', padding: 8, fontSize: 12 }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    onClick={() => setEditingAgent(null)}
                    style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSaveAgent(editingAgent)}
                    style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  >
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: MODELOS */}
      {activeTab === 'models' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: '#f8fafc' }}>
            Modelos de IA Oficiais por Modalidade
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#f8fafc', marginBottom: 4 }}>
                Modelo TTS (Text-to-Speech com Áudio Nativo)
              </label>
              <select
                value={storageState.models.ttsModelId}
                onChange={async (e) => {
                  const val = e.target.value;
                  await chromeStorage.setPartial('models', { ttsModelId: val });
                  setStorageState({ ...storageState, models: { ...storageState.models, ttsModelId: val } });
                  notifySaved();
                }}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 14px', fontSize: 13 }}
              >
                {TASK_FALLBACK_CHAINS.tts.map((m) => (
                  <option key={m} value={m}>{KNOWN_MODELS[m]?.displayName || m}</option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'block' }}>
                {KNOWN_MODELS[storageState.models.ttsModelId]?.description}
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#f8fafc', marginBottom: 4 }}>
                Modelo STT (Transcrição de Voz)
              </label>
              <select
                value={storageState.models.sttModelId}
                onChange={async (e) => {
                  const val = e.target.value;
                  await chromeStorage.setPartial('models', { sttModelId: val });
                  setStorageState({ ...storageState, models: { ...storageState.models, sttModelId: val } });
                  notifySaved();
                }}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 14px', fontSize: 13 }}
              >
                {TASK_FALLBACK_CHAINS.stt_unary.map((m) => (
                  <option key={m} value={m}>{KNOWN_MODELS[m]?.displayName || m}</option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'block' }}>
                {KNOWN_MODELS[storageState.models.sttModelId]?.description}
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#f8fafc', marginBottom: 4 }}>
                Modelo Vision / Análise de Tela
              </label>
              <select
                value={storageState.models.visionModelId}
                onChange={async (e) => {
                  const val = e.target.value;
                  await chromeStorage.setPartial('models', { visionModelId: val });
                  setStorageState({ ...storageState, models: { ...storageState.models, visionModelId: val } });
                  notifySaved();
                }}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 14px', fontSize: 13 }}
              >
                {TASK_FALLBACK_CHAINS.vision.map((m) => (
                  <option key={m} value={m}>{KNOWN_MODELS[m]?.displayName || m}</option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'block' }}>
                {KNOWN_MODELS[storageState.models.visionModelId]?.description}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: ÁUDIO & VOZES */}
      {activeTab === 'audio' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: '#f8fafc' }}>
            Parâmetros Acústicos Padrão
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
                Voz Global Preferida:
              </label>
              <select
                value={storageState.audio.preferredVoice}
                onChange={async (e) => {
                  const val = e.target.value;
                  await chromeStorage.setPartial('audio', { preferredVoice: val });
                  setStorageState({ ...storageState, audio: { ...storageState.audio, preferredVoice: val } });
                  notifySaved();
                }}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 14px', fontSize: 13 }}
              >
                {['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
                Taxa de Amostragem (Sample Rate):
              </label>
              <select
                value={storageState.audio.sampleRate}
                onChange={async (e) => {
                  const val = parseInt(e.target.value, 10);
                  await chromeStorage.setPartial('audio', { sampleRate: val });
                  setStorageState({ ...storageState, audio: { ...storageState.audio, sampleRate: val } });
                  notifySaved();
                }}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 14px', fontSize: 13 }}
              >
                <option value={24000}>24.000 Hz (Recomendado Gemini LINEAR16)</option>
                <option value={16000}>16.000 Hz (Padrão de voz e telefonia)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: ATALHOS */}
      {activeTab === 'shortcuts' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: '#f8fafc' }}>
            Atalhos de Teclado Disponíveis
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { key: 'Ctrl + B', desc: 'Ler texto selecionado imediatamente (TTS na página)' },
              { key: 'Pause / Break', desc: 'Pausar ou retomar a reprodução de áudio' },
              { key: 'Ctrl + Shift + Espaço', desc: 'Iniciar ou concluir transcrição por voz (STT no campo focado)' },
              { key: 'Ctrl + Shift + L', desc: 'Ativar seleção retangular Gemini Lens' },
              { key: 'Alt + Shift + S', desc: 'Atalho global do navegador para ler seleção' },
              { key: 'Alt + Shift + D', desc: 'Atalho global para iniciar ditado' },
              { key: 'Alt + Shift + H', desc: 'Atalho global para abrir/fechar o HUD flutuante' },
            ].map((sc) => (
              <div key={sc.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1e293b', borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: '#f8fafc' }}>{sc.desc}</span>
                <kbd style={{ background: '#0f172a', border: '1px solid #334155', padding: '4px 8px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12, color: '#38bdf8' }}>
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 6: HISTÓRICO & LOGS */}
      {activeTab === 'history' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#f8fafc' }}>
              Registros e Histórico Recente
            </h2>
            <button
              onClick={async () => {
                await chromeStorage.setPartial('history', { recentItems: [] });
                setStorageState({ ...storageState, history: { ...storageState.history, recentItems: [] } });
                notifySaved('Histórico limpo.');
              }}
              style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
            >
              Limpar Registros
            </button>
          </div>

          {storageState.history.recentItems.length === 0 ? (
            <p style={{ fontSize: 13, color: '#64748b' }}>Nenhuma atividade registrada ainda nesta sessão.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {storageState.history.recentItems.map((item) => (
                <div key={item.id} style={{ padding: '8px 12px', background: '#1e293b', borderRadius: 6, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span>[{item.type.toUpperCase()}] {item.previewText}</span>
                  <span style={{ color: '#64748b' }}>{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
