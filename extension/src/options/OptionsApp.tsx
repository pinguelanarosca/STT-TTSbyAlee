/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Página Completa de Opções da Extensão Chrome (React 19 + TypeScript).
 * Estrutura de abas atualizada:
 * 1. Chave Gemini & Testes (api)
 * 2. Agentes & Personas (agents) - Centro unificado de agentes, super editor de áudio, testes TTS/STT e modelos
 * 3. Atalhos de Teclado (shortcuts)
 * 4. Histórico & Logs (history)
 * 5. ChatGPT & Integração (chatgpt) - Última aba
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  Key,
  Users,
  Keyboard,
  History,
  Save,
  CheckCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Volume2,
  Mic,
  Sliders,
  Play,
  Pause,
  Square,
  Sparkles,
  Bot,
  ExternalLink,
  Music,
  Radio,
  Eye,
  Settings2,
} from 'lucide-react';
import { AppStorageSchema } from '@shared/types/storage';
import { CanonicalAgent, GeminiVoiceName, AmbienceType } from '@shared/types/agent';
import { DEFAULT_AGENTS, getCanonicalAgent } from '@shared/constants/defaultAgents';
import { KNOWN_MODELS, TASK_FALLBACK_CHAINS, validateAgentModelIntegrity } from '@shared/constants/modelsCatalog';
import { chromeStorage } from '../services/storage/chromeStorageAdapter';
import { geminiDirectClient } from '../services/geminiDirectClient';

type TabKey = 'api' | 'agents' | 'shortcuts' | 'history' | 'chatgpt';

const GEMINI_VOICES: GeminiVoiceName[] = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'];
const AMBIENCE_TYPES: { id: AmbienceType; label: string }[] = [
  { id: 'none', label: 'Nenhum (Voz Seca)' },
  { id: 'studio', label: 'Estúdio Fechado' },
  { id: 'room', label: 'Sala Acústica' },
  { id: 'warm', label: 'Vocal Aveludado / Quente' },
  { id: 'hall', label: 'Auditório / Espaço Aberto' },
];

export const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('agents');
  const [storageState, setStorageState] = useState<AppStorageSchema | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Estado do editor unificado de agente
  const [selectedAgentId, setSelectedAgentId] = useState<string>('narrator');
  const [agentForm, setAgentForm] = useState<CanonicalAgent>(DEFAULT_AGENTS[0]);
  const [isCustomAgent, setIsCustomAgent] = useState<boolean>(false);

  // Estado dos testes em tempo real (TTS & STT)
  const [ttsTestText, setTtsTestText] = useState<string>(
    'Olá! Esta é uma demonstração de síntese vocal Gemini com ajustes acústicos e equalização em tempo real.'
  );
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [sttTestText, setSttTestText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);

  // Web Audio e MediaRecorder referências
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    chromeStorage.getAll().then((data) => {
      setStorageState(data);
      const activeId = data.agents.activeAgentId || 'narrator';
      setSelectedAgentId(activeId);

      const allAgents = [...DEFAULT_AGENTS, ...data.agents.customAgents];
      const found = allAgents.find((a) => a.metadata.id === activeId) || DEFAULT_AGENTS[0];
      setAgentForm(JSON.parse(JSON.stringify(found)));
      setIsCustomAgent(!found.metadata.isBuiltIn);
    });
  }, []);

  const notifySaved = (msg: string = 'Configurações salvas!') => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  // Carregar agente no editor ao mudar seletor
  const handleSelectAgent = (agentId: string) => {
    if (!storageState) return;
    setSelectedAgentId(agentId);

    const allAgents = [...DEFAULT_AGENTS, ...storageState.agents.customAgents];
    const target = allAgents.find((a) => a.metadata.id === agentId) || DEFAULT_AGENTS[0];
    setAgentForm(JSON.parse(JSON.stringify(target)));
    setIsCustomAgent(!target.metadata.isBuiltIn);

    // Persiste imediatamente como agente ativo da extensão
    chromeStorage.setPartial('agents', { activeAgentId: agentId });
    setStorageState({
      ...storageState,
      agents: { ...storageState.agents, activeAgentId: agentId },
    });
    notifySaved(`Agente ativo alterado para "${target.metadata.name}"`);
  };

  // Testar conexão de chave de API
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

    try {
      const isValid = await geminiDirectClient.testApiKey(storageState.api.apiKey);
      setIsTesting(false);
      if (isValid) {
        setTestResult({ success: true, message: 'Chave válida e autenticada com sucesso no Google AI Studio!' });
      } else {
        setTestResult({ success: false, message: 'Chave não autorizada ou sem acesso à API Gemini.' });
      }
    } catch (err) {
      setIsTesting(false);
      setTestResult({ success: false, message: 'Erro de conexão ao verificar a chave.' });
    }
  };

  // Super Motor de Áudio Web Audio com Equalizador & Ambience
  const playAudioWithAcousticFilters = async (audioBytes: Uint8Array, rate: number, volume: number) => {
    try {
      if (activeSourceRef.current) {
        try { activeSourceRef.current.stop(); } catch (_) {}
      }

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioCtx({ sampleRate: 24000 });
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Decodifica buffer
      const arrayBuffer = audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength) as ArrayBuffer;
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = Math.max(0.5, Math.min(2.0, rate || 1.0));

      // 1. Equalizador - Graves (Low Shelf)
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 250;
      bassFilter.gain.value = agentForm.voice.bass ?? 0;

      // 2. Equalizador - Médios (Peaking)
      const midFilter = ctx.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1200;
      midFilter.Q.value = 0.8;
      midFilter.gain.value = agentForm.voice.mid ?? 0;

      // 3. Equalizador - Agudos (High Shelf)
      const trebleFilter = ctx.createBiquadFilter();
      trebleFilter.type = 'highshelf';
      trebleFilter.frequency.value = 3500;
      trebleFilter.gain.value = agentForm.voice.treble ?? 0;

      // 4. Ganho Master
      const gainNode = ctx.createGain();
      gainNode.gain.value = Math.max(0, Math.min(1.0, volume ?? 1.0));

      // Conexão do Pipeline de Áudio
      source.connect(bassFilter);
      bassFilter.connect(midFilter);
      midFilter.connect(trebleFilter);
      trebleFilter.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.onended = () => {
        setIsPlayingAudio(false);
      };

      activeSourceRef.current = source;
      source.start(0);
      setIsPlayingAudio(true);
    } catch (err) {
      console.error('[Web Audio] Erro ao reproduzir com filtros:', err);
      setIsPlayingAudio(false);
    }
  };

  const stopAudio = () => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch (_) {}
      activeSourceRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  // Testar Síntese TTS com parâmetros atuais em edição
  const handleTestTTS = async () => {
    if (!ttsTestText.trim()) return;
    if (!storageState?.api.apiKey) {
      alert('Por favor, configure sua Chave de API na aba "Chave Gemini & Testes" primeiro.');
      return;
    }

    setIsSynthesizing(true);
    try {
      const response = await geminiDirectClient.synthesizeSpeech(
        {
          text: ttsTestText,
          voiceName: agentForm.voice.preferredVoice,
          rateMultiplier: agentForm.voice.rateMultiplier,
          pitchMultiplier: agentForm.voice.pitchMultiplier,
          systemInstruction: agentForm.instructions.ttsSystemInstruction,
          modelId: agentForm.modelPreferences.ttsModelId || 'gemini-3.8-flash-lite-tts',
        },
        storageState.api.apiKey
      );

      // Decodifica Base64 para Uint8Array
      const binaryString = atob(response.audioBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      await playAudioWithAcousticFilters(bytes, agentForm.voice.rateMultiplier, agentForm.voice.volume);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Falha na síntese TTS: ${msg}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Testar Gravação e Transcrição STT
  const handleToggleRecordSTT = async () => {
    if (isRecording) {
      // Parar gravação e transcrever
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      if (!storageState?.api.apiKey) {
        alert('Por favor, configure sua Chave de API primeiro.');
        return;
      }
      try {
        audioChunksRef.current = [];
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          setIsTranscribing(true);
          try {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Audio = (reader.result as string).replace(/^data:audio\/[a-z0-9]+;base64,/, '');
              const text = await geminiDirectClient.transcribeAudio(
                {
                  audioBase64: base64Audio,
                  mimeType: 'audio/webm',
                  formattingInstruction: agentForm.instructions.sttFormattingInstruction,
                  modelId: agentForm.modelPreferences.sttModelId || 'gemini-3.5-flash-lite',
                },
                storageState!.api.apiKey
              );
              setSttTestText(text);
              setIsTranscribing(false);
            };
            reader.readAsDataURL(audioBlob);
          } catch (err) {
            setIsTranscribing(false);
            const msg = err instanceof Error ? err.message : String(err);
            alert(`Falha no STT: ${msg}`);
          }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(200);
        setIsRecording(true);
      } catch (err) {
        alert('Permissão de microfone negada ou indisponível.');
      }
    }
  };

  // Ações de Salvamento / Criação de Agente
  const handleCreateNewAgentFromCurrent = async () => {
    if (!storageState) return;

    const validation = validateAgentModelIntegrity(agentForm.modelPreferences);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const newId = `custom-${Date.now()}`;
    const newAgent: CanonicalAgent = {
      ...JSON.parse(JSON.stringify(agentForm)),
      metadata: {
        ...agentForm.metadata,
        id: newId,
        name: agentForm.metadata.isBuiltIn ? `${agentForm.metadata.name} (Custom)` : agentForm.metadata.name,
        isBuiltIn: false,
        version: 1,
      },
    };

    const updatedCustom = [...storageState.agents.customAgents, newAgent];
    await chromeStorage.setPartial('agents', {
      customAgents: updatedCustom,
      activeAgentId: newId,
    });

    setStorageState({
      ...storageState,
      agents: {
        ...storageState.agents,
        customAgents: updatedCustom,
        activeAgentId: newId,
      },
    });

    setSelectedAgentId(newId);
    setAgentForm(newAgent);
    setIsCustomAgent(true);
    notifySaved(`Novo agente "${newAgent.metadata.name}" criado e ativado com sucesso!`);
  };

  const handleSaveCustomAgentChanges = async () => {
    if (!storageState || !isCustomAgent) return;

    const validation = validateAgentModelIntegrity(agentForm.modelPreferences);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const updatedCustom = storageState.agents.customAgents.map((ag) =>
      ag.metadata.id === agentForm.metadata.id ? JSON.parse(JSON.stringify(agentForm)) : ag
    );

    await chromeStorage.setPartial('agents', { customAgents: updatedCustom });
    setStorageState({
      ...storageState,
      agents: { ...storageState.agents, customAgents: updatedCustom },
    });
    notifySaved(`Agente "${agentForm.metadata.name}" atualizado com sucesso!`);
  };

  const handleDeleteCustomAgent = async (agentIdToDelete: string) => {
    if (!storageState) return;
    if (!confirm('Deseja realmente excluir este agente personalizado?')) return;

    const updatedCustom = storageState.agents.customAgents.filter((a) => a.metadata.id !== agentIdToDelete);
    const fallbackId = 'narrator';

    await chromeStorage.setPartial('agents', {
      customAgents: updatedCustom,
      activeAgentId: fallbackId,
    });

    setStorageState({
      ...storageState,
      agents: {
        ...storageState.agents,
        customAgents: updatedCustom,
        activeAgentId: fallbackId,
      },
    });

    setSelectedAgentId(fallbackId);
    const narrator = DEFAULT_AGENTS[0];
    setAgentForm(JSON.parse(JSON.stringify(narrator)));
    setIsCustomAgent(false);
    notifySaved('Agente personalizado excluído.');
  };

  if (!storageState) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8', background: '#090d16' }}>
        Carregando configurações...
      </div>
    );
  }

  const allAgents = [...DEFAULT_AGENTS, ...storageState.agents.customAgents];

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#f8fafc' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
            <Volume2 size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              EXT TTS STT <span style={{ fontSize: 11, background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#60a5fa', padding: '2px 8px', borderRadius: 999 }}>Gemini 2.0</span>
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
              Painel Avançado de Configuração, Agentes Multimodais e Acústica
            </p>
          </div>
        </div>

        {savedNotice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, animation: 'fadeIn 0.2s ease-in-out' }}>
            <CheckCircle size={16} />
            <span>{savedNotice}</span>
          </div>
        )}
      </div>

      {/* Navegação de Abas Atualizada: ChatGPT é a ÚLTIMA aba */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #1e293b', paddingBottom: 8, marginBottom: 24, overflowX: 'auto' }}>
        {[
          { key: 'api', label: 'Chave Gemini & Testes', icon: Key },
          { key: 'agents', label: 'Agentes e Personas', icon: Users },
          { key: 'shortcuts', label: 'Atalhos de Teclado', icon: Keyboard },
          { key: 'history', label: 'Histórico & Logs', icon: History },
          { key: 'chatgpt', label: 'ChatGPT', icon: Bot },
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
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: CHAVE GEMINI & TESTES */}
      {/* ========================================================================= */}
      {activeTab === 'api' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={18} color="#38bdf8" />
            <span>Chave de API do Google AI Studio (Gemini)</span>
          </h2>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
            A extensão utiliza sua chave para acessar os modelos de áudio nativo <code>gemini-3.8-flash-lite-tts</code> e transcrição <code>gemini-3.5-transcribe</code>.
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
                padding: '12px 14px',
                fontSize: 13,
                fontFamily: 'monospace',
                outline: 'none',
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
                padding: '12px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              }}
            >
              <Save size={16} />
              <span>Salvar Chave</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
            <button
              onClick={handleTestApiKey}
              disabled={isTesting}
              style={{
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 500,
                cursor: isTesting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <RefreshCw size={15} className={isTesting ? 'animate-spin' : ''} />
              <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão com Gemini'}</span>
            </button>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#38bdf8', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span>Obter chave no Google AI Studio</span>
              <ExternalLink size={13} />
            </a>
          </div>

          {testResult && (
            <div
              style={{
                marginTop: 18,
                padding: '12px 16px',
                borderRadius: 8,
                fontSize: 13,
                background: testResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: testResult.success ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
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

      {/* ========================================================================= */}
      {/* ABA 2: AGENTES E PERSONAS (CENTRO PRINCIPAL DE CONFIGURAÇÃO) */}
      {/* ========================================================================= */}
      {activeTab === 'agents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 1. SELETOR GRANDE DE AGENTE ATIVO NO TOPO */}
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 14, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#38bdf8" />
                <span>Agente Ativo no Navegador</span>
              </label>
              <span style={{ fontSize: 11, background: isCustomAgent ? 'rgba(99, 102, 241, 0.2)' : 'rgba(148, 163, 184, 0.15)', color: isCustomAgent ? '#a5b4fc' : '#94a3b8', padding: '3px 10px', borderRadius: 999, border: isCustomAgent ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(148, 163, 184, 0.3)' }}>
                {isCustomAgent ? 'Personalizado' : 'De Fábrica (Canônico)'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: agentForm.metadata.color || '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {agentForm.metadata.name.substring(0, 2).toUpperCase()}
              </div>

              <select
                value={selectedAgentId}
                onChange={(e) => handleSelectAgent(e.target.value)}
                style={{
                  flex: 1,
                  background: '#1e293b',
                  border: '1px solid #3b82f6',
                  borderRadius: 10,
                  color: '#f8fafc',
                  padding: '12px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <optgroup label="Agentes de Fábrica (8 Canônicos)">
                  {DEFAULT_AGENTS.map((ag) => (
                    <option key={ag.metadata.id} value={ag.metadata.id}>
                      {ag.metadata.name} — ({ag.voice.preferredVoice}, {ag.metadata.category})
                    </option>
                  ))}
                </optgroup>
                {storageState.agents.customAgents.length > 0 && (
                  <optgroup label="Agentes Personalizados">
                    {storageState.agents.customAgents.map((ag) => (
                      <option key={ag.metadata.id} value={ag.metadata.id}>
                        ★ {ag.metadata.name} — ({ag.voice.preferredVoice})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* 2. IDENTIDADE / DESCRIÇÃO DO AGENTE */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings2 size={16} color="#38bdf8" />
              <span>Identidade e Metadados do Agente</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Nome da Persona:</label>
                <input
                  type="text"
                  value={agentForm.metadata.name}
                  onChange={(e) => setAgentForm({ ...agentForm, metadata: { ...agentForm.metadata, name: e.target.value } })}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Categoria:</label>
                <select
                  value={agentForm.metadata.category}
                  onChange={(e) => setAgentForm({ ...agentForm, metadata: { ...agentForm.metadata, category: e.target.value as any } })}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }}
                >
                  <option value="productivity">Produtividade & Trabalho</option>
                  <option value="translation">Tradução & Idiomas</option>
                  <option value="accessibility">Acessibilidade & Leitura</option>
                  <option value="editorial">Editorial & Redação</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Cor da Persona:</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#14b8a6', '#f43f5e', '#ec4899'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setAgentForm({ ...agentForm, metadata: { ...agentForm.metadata, color: col } })}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: col,
                        border: agentForm.metadata.color === col ? '2px solid #ffffff' : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Descrição da Atuação:</label>
              <input
                type="text"
                value={agentForm.metadata.description}
                onChange={(e) => setAgentForm({ ...agentForm, metadata: { ...agentForm.metadata, description: e.target.value } })}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* 3. PERSONALIZAÇÃO TTS */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Volume2 size={16} color="#38bdf8" />
              <span>Personalização do Sistema para Leitura (TTS)</span>
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px' }}>
              Define a entonação, o estilo vocal, supressão de ruídos de navegação e formatação que o Gemini deve aplicar ao ler textos.
            </p>
            <textarea
              rows={3}
              value={agentForm.instructions.ttsSystemInstruction}
              onChange={(e) =>
                setAgentForm({
                  ...agentForm,
                  instructions: { ...agentForm.instructions, ttsSystemInstruction: e.target.value },
                })
              }
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: 12, fontSize: 13, boxSizing: 'border-box', lineHeight: 1.5 }}
            />
          </div>

          {/* 4. PERSONALIZAÇÃO STT */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mic size={16} color="#f87171" />
              <span>Personalização do Sistema para Ditado e Transcrição (STT)</span>
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px' }}>
              Instrução de formatação ortográfica, pontuação e polimento textual aplicada na transcrição do áudio gravado.
            </p>
            <textarea
              rows={3}
              value={agentForm.instructions.sttFormattingInstruction}
              onChange={(e) =>
                setAgentForm({
                  ...agentForm,
                  instructions: { ...agentForm.instructions, sttFormattingInstruction: e.target.value },
                })
              }
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: 12, fontSize: 13, boxSizing: 'border-box', lineHeight: 1.5 }}
            />
          </div>

          {/* 5. SUPER EDITOR DE ÁUDIO TTS */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={16} color="#38bdf8" />
              <span>Super Editor Acústico de Áudio TTS</span>
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px' }}>
              Equalização em tempo real (Bass/Mid/Treble), modelagem de ambiente (Reverb/Ambience) e controle de velocidade e tom.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 20 }}>
              {/* Voz Gemini */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                  <span>Voz Gemini:</span>
                  <span style={{ color: '#38bdf8' }}>{agentForm.voice.preferredVoice}</span>
                </label>
                <select
                  value={agentForm.voice.preferredVoice}
                  onChange={(e) => setAgentForm({ ...agentForm, voice: { ...agentForm.voice, preferredVoice: e.target.value } })}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }}
                >
                  {GEMINI_VOICES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Velocidade (Rate) */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                  <span>Velocidade de Leitura:</span>
                  <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{(agentForm.voice.rateMultiplier || 1.0).toFixed(2)}x</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={agentForm.voice.rateMultiplier || 1.0}
                  onChange={(e) => setAgentForm({ ...agentForm, voice: { ...agentForm.voice, rateMultiplier: parseFloat(e.target.value) } })}
                  style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
              </div>

              {/* Pitch / Tom */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                  <span>Tom Vocal (Pitch):</span>
                  <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{(agentForm.voice.pitchMultiplier || 1.0).toFixed(2)}x</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={agentForm.voice.pitchMultiplier || 1.0}
                  onChange={(e) => setAgentForm({ ...agentForm, voice: { ...agentForm.voice, pitchMultiplier: parseFloat(e.target.value) } })}
                  style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
              </div>

              {/* Volume Master */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                  <span>Volume Master:</span>
                  <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{Math.round((agentForm.voice.volume ?? 1.0) * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1.0"
                  step="0.05"
                  value={agentForm.voice.volume ?? 1.0}
                  onChange={(e) => setAgentForm({ ...agentForm, voice: { ...agentForm.voice, volume: parseFloat(e.target.value) } })}
                  style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Equalizador de 3 Bandas */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Music size={14} color="#60a5fa" />
                <span>Equalizador de Frequências Acústicas</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {/* Bass */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#cbd5e1', marginBottom: 4 }}>
                    <span>Graves (Bass)</span>
                    <span style={{ fontFamily: 'monospace', color: (agentForm.voice.bass ?? 0) > 0 ? '#34d399' : (agentForm.voice.bass ?? 0) < 0 ? '#f87171' : '#94a3b8' }}>
                      {(agentForm.voice.bass ?? 0) > 0 ? `+${agentForm.voice.bass} dB` : `${agentForm.voice.bass ?? 0} dB`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="1"
                    value={agentForm.voice.bass ?? 0}
                    onChange={(e) => setAgentForm({ ...agentForm, voice: { ...agentForm.voice, bass: parseInt(e.target.value, 10) } })}
                    style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                </div>

                {/* Mid */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#cbd5e1', marginBottom: 4 }}>
                    <span>Médios (Mid)</span>
                    <span style={{ fontFamily: 'monospace', color: (agentForm.voice.mid ?? 0) > 0 ? '#34d399' : (agentForm.voice.mid ?? 0) < 0 ? '#f87171' : '#94a3b8' }}>
                      {(agentForm.voice.mid ?? 0) > 0 ? `+${agentForm.voice.mid} dB` : `${agentForm.voice.mid ?? 0} dB`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="1"
                    value={agentForm.voice.mid ?? 0}
                    onChange={(e) => setAgentForm({ ...agentForm, voice: { ...agentForm.voice, mid: parseInt(e.target.value, 10) } })}
                    style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                </div>

                {/* Treble */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#cbd5e1', marginBottom: 4 }}>
                    <span>Agudos (Treble)</span>
                    <span style={{ fontFamily: 'monospace', color: (agentForm.voice.treble ?? 0) > 0 ? '#34d399' : (agentForm.voice.treble ?? 0) < 0 ? '#f87171' : '#94a3b8' }}>
                      {(agentForm.voice.treble ?? 0) > 0 ? `+${agentForm.voice.treble} dB` : `${agentForm.voice.treble ?? 0} dB`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="1"
                    value={agentForm.voice.treble ?? 0}
                    onChange={(e) => setAgentForm({ ...agentForm, voice: { ...agentForm.voice, treble: parseInt(e.target.value, 10) } })}
                    style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>

            {/* Ambience / Reverb */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                  Ambiente Acústico (Reverb):
                </label>
                <select
                  value={agentForm.voice.ambience || 'none'}
                  onChange={(e) => setAgentForm({ ...agentForm, voice: { ...agentForm.voice, ambience: e.target.value as AmbienceType } })}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }}
                >
                  {AMBIENCE_TYPES.map((amb) => (
                    <option key={amb.id} value={amb.id}>{amb.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                  <span>Intensidade do Ambiente:</span>
                  <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{agentForm.voice.ambienceIntensity ?? 30}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={agentForm.voice.ambienceIntensity ?? 30}
                  onChange={(e) => setAgentForm({ ...agentForm, voice: { ...agentForm.voice, ambienceIntensity: parseInt(e.target.value, 10) } })}
                  style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* 6. TEXTO DE TESTE TTS + REPRODUÇÃO */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Play size={16} color="#38bdf8" />
              <span>Texto de Teste TTS (Pré-visualização de Áudio)</span>
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
              Sintetiza o texto usando a configuração e os filtros de equalização atualmente selecionados, antes mesmo de salvar o agente.
            </p>

            <textarea
              rows={3}
              value={ttsTestText}
              onChange={(e) => setTtsTestText(e.target.value)}
              placeholder="Digite o texto de teste para síntese vocal..."
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: 12, fontSize: 13, boxSizing: 'border-box', marginBottom: 12 }}
            />

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={handleTestTTS}
                disabled={isSynthesizing || isPlayingAudio}
                style={{
                  background: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isSynthesizing ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                }}
              >
                {isSynthesizing ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Volume2 size={16} />
                )}
                <span>{isSynthesizing ? 'Sintetizando Áudio...' : 'Sintetizar e Ouvir Fala'}</span>
              </button>

              {isPlayingAudio && (
                <button
                  onClick={stopAudio}
                  style={{
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Square size={14} />
                  <span>Parar</span>
                </button>
              )}

              {isPlayingAudio && (
                <span style={{ fontSize: 12, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', animation: 'pulse 1s infinite' }} />
                  Reproduzindo com equalização ativa...
                </span>
              )}
            </div>
          </div>

          {/* 7. TEXTO DE TESTE STT + GRAVAÇÃO / TRANSCRIÇÃO */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mic size={16} color="#f87171" />
              <span>Texto de Teste STT (Gravação e Transcrição)</span>
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
              Grave sua voz para testar a transcrição com a instrução e o modelo STT configurados para esta persona.
            </p>

            <div style={{ minHeight: 70, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 12, fontSize: 13, color: sttTestText ? '#f8fafc' : '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
              {isTranscribing ? 'Processando transcrição com Gemini 3.5 Transcribe...' : sttTestText || 'O texto falado aparecerá aqui após a transcrição...'}
            </div>

            <button
              onClick={handleToggleRecordSTT}
              disabled={isTranscribing}
              style={{
                background: isRecording ? '#ef4444' : '#1e293b',
                color: '#ffffff',
                border: isRecording ? 'none' : '1px solid #334155',
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {isRecording ? <Square size={16} /> : <Mic size={16} color="#f87171" />}
              <span>{isRecording ? '⏹ Parar Gravação e Transcrever' : '🎤 Gravar Áudio do Microfone'}</span>
            </button>
          </div>

          {/* 8. MODELOS POR MODALIDADE */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio size={16} color="#38bdf8" />
              <span>Modelos de IA por Modalidade</span>
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>
              Configuração dos modelos oficiais do catálogo Gemini utilizados para cada função desta persona.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {/* Modelo TTS */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  Modelo TTS (Síntese com Áudio Nativo):
                </label>
                <select
                  value={agentForm.modelPreferences.ttsModelId || 'gemini-3.8-flash-lite-tts'}
                  onChange={(e) =>
                    setAgentForm({
                      ...agentForm,
                      modelPreferences: { ...agentForm.modelPreferences, ttsModelId: e.target.value },
                    })
                  }
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }}
                >
                  {TASK_FALLBACK_CHAINS.tts.map((m) => (
                    <option key={m} value={m}>{KNOWN_MODELS[m]?.displayName || m}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                  {KNOWN_MODELS[agentForm.modelPreferences.ttsModelId || 'gemini-3.8-flash-lite-tts']?.description}
                </span>
              </div>

              {/* Modelo STT */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  Modelo STT (Transcrição de Áudio):
                </label>
                <select
                  value={agentForm.modelPreferences.sttModelId || 'gemini-3.5-flash-lite'}
                  onChange={(e) =>
                    setAgentForm({
                      ...agentForm,
                      modelPreferences: { ...agentForm.modelPreferences, sttModelId: e.target.value },
                    })
                  }
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }}
                >
                  {TASK_FALLBACK_CHAINS.stt.map((m) => (
                    <option key={m} value={m}>{KNOWN_MODELS[m]?.displayName || m}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                  {KNOWN_MODELS[agentForm.modelPreferences.sttModelId || 'gemini-3.5-flash-lite']?.description}
                </span>
              </div>

              {/* Modelo Vision / Lens */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  Modelo Vision (Análise de Tela):
                </label>
                <select
                  value={agentForm.modelPreferences.visionModelId || 'gemini-3.1-flash-lite'}
                  onChange={(e) =>
                    setAgentForm({
                      ...agentForm,
                      modelPreferences: { ...agentForm.modelPreferences, visionModelId: e.target.value },
                    })
                  }
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }}
                >
                  {TASK_FALLBACK_CHAINS.vision.map((m) => (
                    <option key={m} value={m}>{KNOWN_MODELS[m]?.displayName || m}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                  {KNOWN_MODELS[agentForm.modelPreferences.visionModelId || 'gemini-3.1-flash-lite']?.description}
                </span>
              </div>
            </div>
          </div>

          {/* 9. CRIAR NOVO AGENTE / SALVAR / CRIAR CÓPIA */}
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {isCustomAgent ? (
                <>
                  <button
                    onClick={handleSaveCustomAgentChanges}
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '11px 20px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Save size={16} />
                    <span>Salvar Alterações do Agente</span>
                  </button>

                  <button
                    onClick={() => handleDeleteCustomAgent(agentForm.metadata.id)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      borderRadius: 8,
                      padding: '11px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Trash2 size={16} />
                    <span>Excluir Agente</span>
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  ℹ️ Este é um agente de fábrica protegido. Suas alterações podem ser salvas como uma nova persona personalizada.
                </div>
              )}
            </div>

            {/* BOTÃO CLARAMENTE DESTACADO: CRIAR NOVO AGENTE */}
            <button
              onClick={handleCreateNewAgentFromCurrent}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
              }}
            >
              <Plus size={18} />
              <span>Criar Novo Agente com Estes Parâmetros</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: ATALHOS DE TECLADO */}
      {/* ========================================================================= */}
      {activeTab === 'shortcuts' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Keyboard size={18} color="#38bdf8" />
            <span>Atalhos de Teclado Disponíveis</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { key: 'Ctrl + B', desc: 'Ler texto selecionado imediatamente (TTS na página ativa)' },
              { key: 'Pause / Break', desc: 'Pausar ou retomar a reprodução de áudio' },
              { key: 'Ctrl + Shift + Espaço', desc: 'Iniciar ou concluir ditado por voz (STT no campo focado)' },
              { key: 'Ctrl + Shift + L', desc: 'Ativar seleção retangular Gemini Lens para inspeção visual' },
              { key: 'Alt + Shift + S', desc: 'Atalho global de navegador para ler seleção' },
              { key: 'Alt + Shift + D', desc: 'Atalho global para iniciar transcrição' },
              { key: 'Alt + Shift + H', desc: 'Atalho global para abrir ou fechar o HUD flutuante' },
            ].map((sc) => (
              <div key={sc.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#1e293b', borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: '#f8fafc' }}>{sc.desc}</span>
                <kbd style={{ background: '#0f172a', border: '1px solid #334155', padding: '5px 10px', borderRadius: 6, fontFamily: 'monospace', fontSize: 12, color: '#38bdf8', fontWeight: 600 }}>
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: HISTÓRICO & LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={18} color="#38bdf8" />
              <span>Registros e Histórico de Atividades</span>
            </h2>
            {storageState.history.recentItems.length > 0 && (
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
            )}
          </div>

          {storageState.history.recentItems.length === 0 ? (
            <p style={{ fontSize: 13, color: '#64748b' }}>Nenhuma atividade registrada ainda nesta sessão.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
              {storageState.history.recentItems.map((item) => (
                <div key={item.id} style={{ padding: '10px 14px', background: '#1e293b', borderRadius: 8, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: item.type === 'tts' ? '#38bdf8' : item.type === 'stt' ? '#f87171' : '#a855f7' }}>
                      [{item.type.toUpperCase()}]
                    </span>
                    <span style={{ color: '#e2e8f0' }}>{item.previewText}</span>
                  </div>
                  <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 5: CHATGPT (ÚLTIMA ABA) */}
      {/* ========================================================================= */}
      {activeTab === 'chatgpt' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #10a37f, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={22} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Integração com ChatGPT & LLMs Web
              </h2>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
                Utilize o EXT TTS STT para ditar ou ouvir respostas em qualquer interface de IA conversacional.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8', margin: '0 0 6px' }}>
                Como usar na interface web do ChatGPT:
              </h4>
              <ul style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
                <li><strong>Ditado Rápido:</strong> Clique na caixa de mensagem do ChatGPT e pressione <code>Ctrl + Shift + Espaço</code>. Fale sua pergunta e o texto será transcrito e formatado pelo agente ativo.</li>
                <li><strong>Leitura de Respostas:</strong> Selecione qualquer resposta longa gerada pelo ChatGPT e pressione <code>Ctrl + B</code>. A narração começará imediatamente com a voz e equalização da persona selecionada.</li>
                <li><strong>Pausar Leitura:</strong> Pressione a tecla <code>Pause / Break</code> a qualquer momento.</li>
              </ul>
            </div>

            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: '#34d399', margin: '0 0 6px' }}>
                Sugestão de Persona Recomendada:
              </h4>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px', lineHeight: 1.5 }}>
                Para redação e prompts avançados, ative o agente <strong>Revisor Gramatical & Ditado</strong> ou <strong>Assistente de Código & Dev</strong>.
              </p>
              <button
                onClick={() => {
                  handleSelectAgent('editor');
                  setActiveTab('agents');
                }}
                style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid #3b82f6',
                  color: '#60a5fa',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Ativar Agente Revisor Gramatical
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
