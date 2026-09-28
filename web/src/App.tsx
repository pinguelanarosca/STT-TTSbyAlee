/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Componente Raiz do Web Studio (React 19 + TypeScript).
 */

import React, { useState, useEffect } from 'react';
import { Navbar, StudioTab } from './components/Navbar';
import { TestArena } from './components/arena/TestArena';
import { AgentStudio } from './components/agents/AgentStudio';
import { ModelExplorer } from './components/models/ModelExplorer';
import { ExtensionViewer } from './components/extension/ExtensionViewer';
import { SettingsPanel } from './components/settings/SettingsPanel';

import { webStorage } from './services/storage/webStorageAdapter';
import { AppStorageSchema, HistoryItem } from '@shared/types/storage';
import { DEFAULT_AGENTS, getCanonicalAgent } from '@shared/constants/defaultAgents';
import { CanonicalAgent } from '@shared/types/agent';

export default function App() {
  const [activeTab, setActiveTab] = useState<StudioTab>('arena');
  const [storageState, setStorageState] = useState<AppStorageSchema | null>(null);

  useEffect(() => {
    webStorage.getAll().then((data) => {
      setStorageState(data);
    });
  }, []);

  const handleUpdateStorage = async (partial: Partial<AppStorageSchema>) => {
    await webStorage.setMultiple(partial);
    const updated = await webStorage.getAll();
    setStorageState(updated);
  };

  const handleResetStorage = async () => {
    await webStorage.reset();
    const fresh = await webStorage.getAll();
    setStorageState(fresh);
  };

  const handleSelectActiveAgent = async (agentId: string) => {
    if (!storageState) return;
    await webStorage.setPartial('agents', { activeAgentId: agentId });
    setStorageState({
      ...storageState,
      agents: { ...storageState.agents, activeAgentId: agentId },
    });
  };

  const handleSaveAgent = async (agent: CanonicalAgent) => {
    if (!storageState) return;
    const custom = [...storageState.agents.customAgents];
    const idx = custom.findIndex((a) => a.metadata.id === agent.metadata.id);
    if (idx >= 0) {
      custom[idx] = agent;
    } else {
      custom.push(agent);
    }
    await handleUpdateStorage({
      agents: { ...storageState.agents, customAgents: custom },
    });
  };

  const handleDeleteAgent = async (id: string) => {
    if (!storageState) return;
    const custom = storageState.agents.customAgents.filter((a) => a.metadata.id !== id);
    await handleUpdateStorage({
      agents: { ...storageState.agents, customAgents: custom },
    });
  };

  const handleAddHistoryItem = async (type: 'tts' | 'stt' | 'vision', preview: string) => {
    if (!storageState) return;
    const newItem: HistoryItem = {
      id: `hist_${Date.now()}`,
      timestamp: Date.now(),
      type,
      agentId: storageState.agents.activeAgentId,
      previewText: preview.substring(0, 100),
    };
    const updatedHistory = [newItem, ...storageState.history.recentItems].slice(0, 50);
    await webStorage.setPartial('history', { recentItems: updatedHistory });
    setStorageState({
      ...storageState,
      history: { ...storageState.history, recentItems: updatedHistory },
    });
  };

  const handleClearHistory = async () => {
    if (!storageState) return;
    await webStorage.setPartial('history', { recentItems: [] });
    setStorageState({
      ...storageState,
      history: { ...storageState.history, recentItems: [] },
    });
  };

  if (!storageState) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 text-xs">
        Carregando Web Studio...
      </div>
    );
  }

  const allAgents = [...DEFAULT_AGENTS, ...storageState.agents.customAgents];
  const activeAgent = allAgents.find((a) => a.metadata.id === storageState.agents.activeAgentId) || allAgents[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500/30">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeAgentName={activeAgent.metadata.name}
        hasApiKey={Boolean(storageState.api.apiKey)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8">
        {activeTab === 'arena' && (
          <TestArena
            agents={allAgents}
            activeAgent={activeAgent}
            onSelectAgent={handleSelectActiveAgent}
            historyItems={storageState.history.recentItems}
            onAddHistoryItem={handleAddHistoryItem}
            onClearHistory={handleClearHistory}
          />
        )}

        {activeTab === 'agents' && (
          <AgentStudio
            agents={allAgents}
            activeAgentId={storageState.agents.activeAgentId}
            onSelectActiveAgent={handleSelectActiveAgent}
            onSaveAgent={handleSaveAgent}
            onDeleteAgent={handleDeleteAgent}
          />
        )}

        {activeTab === 'models' && <ModelExplorer />}

        {activeTab === 'extension' && <ExtensionViewer />}

        {activeTab === 'settings' && (
          <SettingsPanel
            storageState={storageState}
            onUpdateStorage={handleUpdateStorage}
            onResetStorage={handleResetStorage}
          />
        )}
      </main>

      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-600">
        EXT TTS STT Studio — Gemini Multimodal Speech & Vision Suite • 2026
      </footer>
    </div>
  );
}
