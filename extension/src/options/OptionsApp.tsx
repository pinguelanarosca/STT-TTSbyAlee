/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Página Completa de Opções da Extensão Chrome (React 19 + TypeScript).
 * Estrutura de abas:
 * 1. Chave Gemini & Testes (api)
 * 2. Agentes & Personas (agents) - Centro unificado de agentes, super editor de áudio, testes TTS/STT e modelos
 * 3. Atalhos de Teclado Editáveis (shortcuts)
 * 4. Histórico & Logs em Tempo Real (history)
 * 5. ChatGPT & Integração (chatgpt)
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
  RotateCcw,
} from 'lucide-react';
import { AppStorageSchema, HistoryItem, TechnicalLogItem, LogLevel, LogSource } from '@shared/types/storage';
import { CanonicalAgent, GeminiVoiceName, AmbienceType } from '@shared/types/agent';
import { DEFAULT_AGENTS } from '@shared/constants/defaultAgents';
import { DEFAULT_UI_PREFERENCES } from '@shared/constants/defaultSettings';
import { KNOWN_MODELS, TASK_FALLBACK_CHAINS, validateAgentModelIntegrity } from '@shared/constants/modelsCatalog';
import { base64ToUint8Array } from '@shared/utils/pcmWav';
import { formatShortcutDisplay, recordShortcutFromEvent } from '@shared/utils/shortcutMatcher';
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

  // Comandos Globais do Chrome (chrome.commands)
  const [globalCommands, setGlobalCommands] = useState<Array<{ name?: string; shortcut?: string; description?: string }>>([]);

  // Estado dos atalhos editáveis
  const [recordingAction, setRecordingAction] = useState<string | null>(null);

  // Sub-aba de Histórico vs Logs Técnicos
  const [historySubTab, setHistorySubTab] = useState<'history' | 'logs'>('logs');
  const [logLevelFilter, setLogLevelFilter] = useState<string>('all');
  const [logSourceFilter, setLogSourceFilter] = useState<string>('all');

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

    // Carrega comandos globais reais do chrome.commands.getAll()
    if (typeof chrome !== 'undefined' && chrome.commands?.getAll) {
      chrome.commands.getAll((cmds) => {
        setGlobalCommands(cmds || []);
      });
    }

    // Inscreve para atualizações do histórico e logs em tempo real
    const unsubscribeHistory = chromeStorage.subscribe('history', (newHistory) => {
      setStorageState((prev) => (prev ? { ...prev, history: newHistory } : null));
    });

    const unsubscribeLogs = chromeStorage.subscribe('logs', (newLogs) => {
      setStorageState((prev) => (prev ? { ...prev, logs: newLogs } : null));
    });

    return () => {
      unsubscribeHistory();
      unsubscribeLogs();
    };
  }, []);

  // Gravador de Teclas para Atalhos
  useEffect(() => {
    if (!recordingAction) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const newShortcut = recordShortcutFromEvent(e);
      if (newShortcut && storageState) {
        const currentShortcuts = storageState.ui.shortcuts || DEFAULT_UI_PREFERENCES.shortcuts;
        const updatedShortcuts = { ...currentShortcuts, [recordingAction]: newShortcut };

        chromeStorage.setPartial('ui', { shortcuts: updatedShortcuts }).then(() => {
          setStorageState({
            ...storageState,
            ui: { ...storageState.ui, shortcuts: updatedShortcuts },
          });
          notifySaved(`Atalho atualizado: ${formatShortcutDisplay(newShortcut)}`);
        });

        setRecordingAction(null);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [recordingAction, storageState]);

  const notifySaved = (msg: string = 'Configurações salvas!') => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleResetShortcuts = async () => {
    if (!storageState) return;
    const defaultShortcuts = DEFAULT_UI_PREFERENCES.shortcuts;
    await chromeStorage.setPartial('ui', { shortcuts: defaultShortcuts });
    setStorageState({
      ...storageState,
      ui: { ...storageState.ui, shortcuts: defaultShortcuts },
    });
    notifySaved('Atalhos restaurados para o padrão.');
  };

  // Carregar agente no editor ao mudar seletor
  const handleSelectAgent = (agentId: string) => {
    if (!storageState) return;
    setSelectedAgentId(agentId);

    const allAgents = [...DEFAULT_AGENTS, ...storageState.agents.customAgents];
    const target = allAgents.find((a) => a.metadata.id === agentId) || DEFAULT_AGENTS[0];
    setAgentForm(JSON.parse(JSON.stringify(target)));
    setIsCustomAgent(!target.metadata.isBuiltIn);

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

  // Web Audio com Equalizador & Ambience
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

      const arrayBuffer = audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength) as ArrayBuffer;
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = Math.max(0.5, Math.min(2.0, rate || 1.0));

      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 250;
      bassFilter.gain.value = agentForm.voice.bass ?? 0;

      const midFilter = ctx.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1200;
      midFilter.Q.value = 0.8;
      midFilter.gain.value = agentForm.voice.mid ?? 0;

      const trebleFilter = ctx.createBiquadFilter();
      trebleFilter.type = 'highshelf';
      trebleFilter.frequency.value = 3500;
      trebleFilter.gain.value = agentForm.voice.treble ?? 0;

      const gainNode = ctx.createGain();
      gainNode.gain.value = Math.max(0, Math.min(1.0, volume ?? 1.0));

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
      console.error('[Web Audio] Erro ao reproduzir:', err);
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

  const appendHistoryItem = async (type: 'tts' | 'stt' | 'vision', text: string, status: 'success' | 'error' = 'success', errorDetails?: string) => {
    try {
      const historyData = await chromeStorage.get('history');
      const newItem: HistoryItem = {
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        type,
        agentId: selectedAgentId,
        previewText: status === 'error' ? `❌ [ERRO] ${text}` : text,
        status,
        errorDetails,
      };
      const updated = [newItem, ...(historyData.recentItems || [])].slice(0, 50);
      await chromeStorage.setPartial('history', { recentItems: updated });
    } catch (_) {}
  };

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

      const bytes = base64ToUint8Array(response.audioBase64);
      await playAudioWithAcousticFilters(bytes, agentForm.voice.rateMultiplier, agentForm.voice.volume);
      await appendHistoryItem('tts', ttsTestText.length > 80 ? ttsTestText.substring(0, 80) + '...' : ttsTestText, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await appendHistoryItem('tts', ttsTestText.substring(0, 60), 'error', msg);
      alert(`Falha na síntese TTS: ${msg}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleToggleRecordSTT = async () => {
    if (isRecording) {
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
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

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
              await appendHistoryItem('stt', text.length > 80 ? text.substring(0, 80) + '...' : text, 'success');
            };
            reader.readAsDataURL(audioBlob);
          } catch (err) {
            setIsTranscribing(false);
            const msg = err instanceof Error ? err.message : String(err);
            await appendHistoryItem('stt', 'Teste de Ditado', 'error', msg);
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

  const currentShortcuts = storageState.ui.shortcuts || DEFAULT_UI_PREFERENCES.shortcuts;

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
            <CheckCircle size={16} />
            <span>{savedNotice}</span>
          </div>
        )}
      </div>

      {/* Navegação de Abas */}
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
            A extensão utiliza sua chave para acessar os modelos de áudio nativo <code>gemini-3.8-flash-lite-tts</code> e transcrição <code>gemini-3.5-flash-lite</code>.
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
      {/* ABA 2: AGENTES E PERSONAS */}
      {/* ========================================================================= */}
      {activeTab === 'agents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#38bdf8" />
                <span>Agente Ativo no Navegador</span>
              </label>
              <span style={{ fontSize: 11, background: isCustomAgent ? 'rgba(99, 102, 241, 0.2)' : 'rgba(148, 163, 184, 0.15)', color: isCustomAgent ? '#a5b4fc' : '#94a3b8', padding: '3px 10px', borderRadius: 999 }}>
                {isCustomAgent ? 'Personalizado' : 'De Fábrica'}
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
                <optgroup label="Agentes de Fábrica">
                  {DEFAULT_AGENTS.map((ag) => (
                    <option key={ag.metadata.id} value={ag.metadata.id}>
                      {ag.metadata.name} — ({ag.voice.preferredVoice})
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

          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {isCustomAgent && (
                <>
                  <button
                    onClick={handleSaveCustomAgentChanges}
                    style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: 8, padding: '11px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Save size={16} />
                    <span>Salvar Alterações</span>
                  </button>

                  <button
                    onClick={() => handleDeleteCustomAgent(agentForm.metadata.id)}
                    style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', borderRadius: 8, padding: '11px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Trash2 size={16} />
                    <span>Excluir Agente</span>
                  </button>
                </>
              )}
            </div>

            <button
              onClick={handleCreateNewAgentFromCurrent}
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#ffffff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Plus size={18} />
              <span>Criar Novo Agente</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: ATALHOS DE TECLADO EDITÁVEIS */}
      {/* ========================================================================= */}
      {activeTab === 'shortcuts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Atalhos Internos / Content Script */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 24 }}>
            {(() => {
              const currentShortcuts = storageState?.ui?.shortcuts || DEFAULT_UI_PREFERENCES.shortcuts;
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Keyboard size={18} color="#38bdf8" />
                        <span>Atalhos Internos da Página (Content Script - Editáveis)</span>
                      </h2>
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
                        Atalhos de teclado escutados diretamente na página web ativa via listener de eventos da página.
                      </p>
                    </div>

                    <button
                      onClick={handleResetShortcuts}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid #334155',
                        color: '#cbd5e1',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>Restaurar Padrões</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                    {[
                      { id: 'readSelection', desc: 'Ler texto selecionado imediatamente (TTS)', defaultVal: 'Ctrl+B' },
                      { id: 'togglePause', desc: 'Pausar ou retomar a reprodução de áudio', defaultVal: 'Pause' },
                      { id: 'startDictation', desc: 'Iniciar ou concluir ditado por voz (STT)', defaultVal: 'Ctrl+Shift+Space' },
                      { id: 'lensSelection', desc: 'Ativar seleção Gemini Lens (Visão da Tela)', defaultVal: 'Ctrl+Shift+L' },
                      { id: 'toggleHud', desc: 'Abrir ou fechar o HUD flutuante', defaultVal: 'Alt+Shift+H' },
                    ].map((sc) => {
                      const currentVal = (currentShortcuts as Record<string, string>)[sc.id] || sc.defaultVal;
                      const isRecording = recordingAction === sc.id;

                      return (
                        <div key={sc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#1e293b', border: isRecording ? '1px solid #38bdf8' : '1px solid #334155', borderRadius: 10 }}>
                          <div>
                            <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 500, display: 'block' }}>{sc.desc}</span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>Ação de atalho interno do content script</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <kbd style={{ background: isRecording ? 'rgba(56, 189, 248, 0.2)' : '#0f172a', border: isRecording ? '1px solid #38bdf8' : '1px solid #334155', padding: '6px 12px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12, color: isRecording ? '#38bdf8' : '#e2e8f0', fontWeight: 600 }}>
                              {isRecording ? 'Pressione as teclas...' : formatShortcutDisplay(currentVal)}
                            </kbd>

                            <button
                              onClick={() => setRecordingAction(isRecording ? null : sc.id)}
                              style={{
                                background: isRecording ? '#ef4444' : '#3b82f6',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '7px 14px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {isRecording ? 'Cancelar' : 'Alterar'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Atalhos Globais Reais do Chrome (chrome.commands) */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Settings2 size={18} color="#c084fc" />
                  <span>Atalhos Globais do Navegador (Chrome Commands)</span>
                </h2>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
                  Atalhos globais registrados no sistema do Chrome. O Chrome gerencia estes atalhos nativamente.
                </p>
              </div>

              <button
                onClick={() => {
                  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
                  } else {
                    window.open('chrome://extensions/shortcuts', '_blank');
                  }
                }}
                style={{
                  background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ExternalLink size={14} />
                <span>Gerenciar Atalhos Globais</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {globalCommands.length === 0 ? (
                <div style={{ padding: '12px 16px', background: '#1e293b', borderRadius: 8, fontSize: 12, color: '#94a3b8' }}>
                  Carregando ou nenhum comando global configurado em manifest.json.
                </div>
              ) : (
                globalCommands.map((cmd) => (
                  <div key={cmd.name || 'cmd'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}>
                    <div>
                      <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>{cmd.description || cmd.name}</span>
                      <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Comando nativo Chrome: {cmd.name}</span>
                    </div>
                    <kbd style={{ background: '#0f172a', border: '1px solid #475569', padding: '5px 10px', borderRadius: 6, fontFamily: 'monospace', fontSize: 12, color: '#38bdf8', fontWeight: 700 }}>
                      {cmd.shortcut || 'Não definido (Defina em chrome://extensions/shortcuts)'}
                    </kbd>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: HISTÓRICO & LOGS TÉCNICOS */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 24 }}>
          {/* Cabeçalho da Aba e Seleção de Sub-aba */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setHistorySubTab('logs')}
                style={{
                  background: historySubTab === 'logs' ? '#3b82f6' : '#1e293b',
                  color: '#ffffff',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Sliders size={15} />
                <span>Logs Técnicos ({storageState?.logs?.items?.length || 0})</span>
              </button>

              <button
                onClick={() => setHistorySubTab('history')}
                style={{
                  background: historySubTab === 'history' ? '#3b82f6' : '#1e293b',
                  color: '#ffffff',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <History size={15} />
                <span>Histórico de Atividades ({storageState?.history?.recentItems?.length || 0})</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {historySubTab === 'logs' && (
                <>
                  <button
                    onClick={() => {
                      const items = storageState?.logs?.items || [];
                      navigator.clipboard.writeText(JSON.stringify(items, null, 2));
                      notifySaved('Logs copiados para a área de transferência!');
                    }}
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Copy size={14} />
                    <span>Copiar Logs</span>
                  </button>

                  <button
                    onClick={async () => {
                      await chromeStorage.setPartial('logs', { items: [] });
                      notifySaved('Logs técnicos limpos.');
                    }}
                    style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Trash2 size={14} />
                    <span>Limpar Logs</span>
                  </button>
                </>
              )}

              {historySubTab === 'history' && (
                <button
                  onClick={async () => {
                    await chromeStorage.setPartial('history', { recentItems: [] });
                    notifySaved('Histórico de atividades limpo.');
                  }}
                  style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Trash2 size={14} />
                  <span>Limpar Histórico</span>
                </button>
              )}
            </div>
          </div>

          {/* SUB-ABA 1: LOGS TÉCNICOS */}
          {historySubTab === 'logs' && (
            <div>
              {/* Filtros de Logs */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, background: '#1e293b', padding: '10px 14px', borderRadius: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Filtrar Nível:</span>
                <select
                  value={logLevelFilter}
                  onChange={(e) => setLogLevelFilter(e.target.value)}
                  style={{ background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: 6, padding: '4px 10px', fontSize: 12, outline: 'none' }}
                >
                  <option value="all">Todos os Níveis</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                  <option value="debug">Debug</option>
                </select>

                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginLeft: 8 }}>Origem:</span>
                <select
                  value={logSourceFilter}
                  onChange={(e) => setLogSourceFilter(e.target.value)}
                  style={{ background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: 6, padding: '4px 10px', fontSize: 12, outline: 'none' }}
                >
                  <option value="all">Todas as Origens</option>
                  <option value="TTS">TTS</option>
                  <option value="STT">STT</option>
                  <option value="LENS">LENS</option>
                  <option value="ROUTER">ROUTER</option>
                  <option value="API">API</option>
                  <option value="SHORTCUT">SHORTCUT</option>
                  <option value="SYSTEM">SYSTEM</option>
                </select>
              </div>

              {/* Lista de Logs Técnicos */}
              {(() => {
                const rawItems = storageState?.logs?.items || [];
                const filtered = rawItems.filter((item: TechnicalLogItem) => {
                  if (logLevelFilter !== 'all' && item.level !== logLevelFilter) return false;
                  if (logSourceFilter !== 'all' && item.source !== logSourceFilter) return false;
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <p style={{ fontSize: 13, color: '#64748b' }}>
                      Nenhum log técnico registrado {logLevelFilter !== 'all' || logSourceFilter !== 'all' ? 'para os filtros selecionados' : 'ainda'}.
                    </p>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 500, overflowY: 'auto' }}>
                    {filtered.map((item: TechnicalLogItem) => {
                      const isErr = item.level === 'error';
                      const isWarn = item.level === 'warn';
                      const badgeBg = isErr ? 'rgba(239, 68, 68, 0.2)' : isWarn ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.2)';
                      const badgeColor = isErr ? '#f87171' : isWarn ? '#fbbf24' : '#38bdf8';

                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: '10px 14px',
                            background: isErr ? 'rgba(239, 68, 68, 0.06)' : '#1e293b',
                            border: isErr ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #334155',
                            borderRadius: 8,
                            fontSize: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, padding: '2px 6px', borderRadius: 4, fontSize: 10, background: badgeBg, color: badgeColor }}>
                                {item.source} | {item.level.toUpperCase()}
                              </span>
                              <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{item.operation}</span>
                              {item.modelId && (
                                <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#a5b4fc', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                                  {item.modelId}
                                </span>
                              )}
                              {item.httpStatus && (
                                <span style={{ fontSize: 10, background: item.httpStatus >= 400 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)', color: item.httpStatus >= 400 ? '#f87171' : '#34d399', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700 }}>
                                  HTTP {item.httpStatus}
                                </span>
                              )}
                              {item.durationMs && (
                                <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                                  {item.durationMs}ms
                                </span>
                              )}
                            </div>
                            <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          <div style={{ color: isErr ? '#fca5a5' : '#f8fafc', fontSize: 12, wordBreak: 'break-word', margin: '2px 0' }}>
                            {item.message}
                          </div>

                          {item.errorDetails && (
                            <div style={{ marginTop: 4, padding: '6px 10px', background: 'rgba(0,0,0,0.4)', borderRadius: 6, color: '#f87171', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-word', maxHeight: 120, overflowY: 'auto' }}>
                              {item.errorDetails}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* SUB-ABA 2: HISTÓRICO DE ATIVIDADES */}
          {historySubTab === 'history' && (
            <div>
              {(!storageState?.history?.recentItems || storageState.history.recentItems.length === 0) ? (
                <p style={{ fontSize: 13, color: '#64748b' }}>Nenhum histórico de atividade registrado ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 450, overflowY: 'auto' }}>
                  {storageState.history.recentItems.map((item: HistoryItem) => {
                    const isErr = item.status === 'error' || item.previewText.startsWith('❌');
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '12px 16px',
                          background: isErr ? 'rgba(239, 68, 68, 0.08)' : '#1e293b',
                          border: isErr ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #334155',
                          borderRadius: 10,
                          fontSize: 12,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, padding: '2px 6px', borderRadius: 4, fontSize: 10, background: item.type === 'tts' ? 'rgba(56,189,248,0.2)' : item.type === 'stt' ? 'rgba(248,113,113,0.2)' : 'rgba(168,85,247,0.2)', color: item.type === 'tts' ? '#38bdf8' : item.type === 'stt' ? '#f87171' : '#c084fc' }}>
                              {item.type.toUpperCase()}
                            </span>
                            <span style={{ color: isErr ? '#f87171' : '#f8fafc', fontWeight: isErr ? 600 : 400 }}>
                              {item.previewText}
                            </span>
                          </div>
                          <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        {item.errorDetails && (
                          <div style={{ marginTop: 4, padding: '6px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, color: '#fca5a5', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-word' }}>
                            {item.errorDetails}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 5: CHATGPT */}
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
                <li><strong>Ditado Rápido:</strong> Clique na caixa de mensagem do ChatGPT e pressione seu atalho de ditado (padrão: <code>Ctrl + Shift + Espaço</code>). Fale sua pergunta e o texto será transcrito pelo agente ativo.</li>
                <li><strong>Leitura de Respostas:</strong> Selecione qualquer resposta longa gerada pelo ChatGPT e pressione seu atalho de leitura (padrão: <code>Ctrl + B</code>). A narração começará imediatamente.</li>
                <li><strong>Seleção Gemini Lens:</strong> Pressione <code>Ctrl + Shift + L</code> ou <code>Ctrl + Shift + Arrastar</code> em uma área para extrair e narrar o texto selecionado.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
