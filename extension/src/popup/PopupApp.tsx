/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Componente principal do Popup da Extensão Chrome (React 19 + TypeScript).
 */

import React, { useEffect, useState } from 'react';
import { Volume2, Mic, Settings, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { DEFAULT_AGENTS } from '@shared/constants/defaultAgents';
import { CanonicalAgent } from '@shared/types/agent';
import { chromeStorage } from '../services/storage/chromeStorageAdapter';
import { sendTabMessageSafe, isRestrictedUrl } from '../utils/tabMessenger';

export const PopupApp: React.FC = () => {
  const [agents, setAgents] = useState<CanonicalAgent[]>(DEFAULT_AGENTS);
  const [activeAgentId, setActiveAgentId] = useState<string>('narrator');
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Pronto');
  const [tabWarning, setTabWarning] = useState<string | null>(null);

  useEffect(() => {
    // Carrega dados iniciais do storage
    chromeStorage.getAll().then((state) => {
      setHasApiKey(Boolean(state.api.apiKey));
      setActiveAgentId(state.agents.activeAgentId || 'narrator');
      if (state.agents.customAgents && state.agents.customAgents.length > 0) {
        setAgents([...DEFAULT_AGENTS, ...state.agents.customAgents]);
      }
    });

    // Checa se a aba ativa é restrita
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab && isRestrictedUrl(tab.url)) {
        setTabWarning('Aba do sistema ou protegida (chrome://). Navegue para um site (ex: google.com) para usar.');
      }
    }).catch(() => {});

    // Inscreve-se para mudanças de storage
    const unsubKey = chromeStorage.subscribe('api', (api) => {
      setHasApiKey(Boolean(api.apiKey));
    });
    const unsubAgents = chromeStorage.subscribe('agents', (ag) => {
      setActiveAgentId(ag.activeAgentId);
    });

    return () => {
      unsubKey();
      unsubAgents();
    };
  }, []);

  const handleAgentChange = async (newId: string) => {
    setActiveAgentId(newId);
    await chromeStorage.setPartial('agents', { activeAgentId: newId });
  };

  const handleReadSelection = async () => {
    setStatusMessage('Enviando leitura...');
    setTabWarning(null);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const res = await sendTabMessageSafe(tab.id, tab.url, {
        type: 'CMD_READ_SELECTION',
        payload: { agentId: activeAgentId },
      });
      if (!res.success && res.error) {
        setTabWarning(res.error);
      }
    }
    setTimeout(() => setStatusMessage('Pronto'), 1500);
  };

  const handleStartDictation = async () => {
    setStatusMessage('Iniciando ditado...');
    setTabWarning(null);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const res = await sendTabMessageSafe(tab.id, tab.url, {
        type: 'CMD_START_DICTATION',
        payload: { agentId: activeAgentId },
      });
      if (!res.success && res.error) {
        setTabWarning(res.error);
      }
    }
    setTimeout(() => setStatusMessage('Pronto'), 1500);
  };

  const handleOpenLens = async () => {
    setTabWarning(null);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const res = await sendTabMessageSafe(tab.id, tab.url, { type: 'TOGGLE_HUD' });
      if (!res.success && res.error) {
        setTabWarning(res.error);
      }
    }
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const activeAgent = agents.find((a) => a.metadata.id === activeAgentId) || agents[0];

  return (
    <div style={{ width: 340, padding: 14, background: '#0f172a', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Volume2 size={16} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>EXT TTS STT</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Gemini Multimodal</div>
          </div>
        </div>
        <button
          onClick={handleOpenOptions}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
          title="Abrir Configurações"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Aviso de Chave de API */}
      {!hasApiKey && (
        <div
          onClick={handleOpenOptions}
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 10,
            fontSize: 11,
            color: '#fca5a5',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertCircle size={14} />
          <span>Chave Gemini ausente. Clique para configurar.</span>
        </div>
      )}

      {/* Aviso de Aba Restrita / Recarregamento */}
      {tabWarning && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 12,
            fontSize: 11,
            color: '#fcd34d',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertCircle size={14} />
          <span>{tabWarning}</span>
        </div>
      )}

      {/* Seletor de Agente */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
          Agente Ativo
        </label>
        <select
          value={activeAgentId}
          onChange={(e) => handleAgentChange(e.target.value)}
          style={{
            width: '100%',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 6,
            color: '#f8fafc',
            padding: '6px 8px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {agents.map((ag) => (
            <option key={ag.metadata.id} value={ag.metadata.id}>
              {ag.metadata.name} ({ag.voice.preferredVoice})
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
          {activeAgent.metadata.description}
        </div>
      </div>

      {/* Ações Rápidas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <button
          onClick={handleReadSelection}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Volume2 size={16} />
          <span>Ler Seleção (Alt+Shift+S ou Ctrl+B)</span>
        </button>

        <button
          onClick={handleStartDictation}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <Mic size={16} color="#ef4444" />
          <span>Ditar no Campo (Ctrl+Shift+Espaço)</span>
        </button>

        <button
          onClick={handleOpenLens}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <Eye size={16} color="#8b5cf6" />
          <span>Abrir HUD Flutuante (Alt+Shift+H)</span>
        </button>
      </div>

      {/* Status Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b', borderTop: '1px solid #1e293b', paddingTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle2 size={12} color="#10b981" />
          <span>Status: {statusMessage}</span>
        </div>
        <span>Voz: {activeAgent.voice.preferredVoice}</span>
      </div>
    </div>
  );
};
