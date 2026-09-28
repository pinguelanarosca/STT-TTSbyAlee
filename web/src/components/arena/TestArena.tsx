/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Test Arena: Orquestrador modular para testes de TTS, STT, Visão e Mixer.
 */

import React from 'react';
import { CanonicalAgent } from '@shared/types/agent';
import { HistoryItem } from '@shared/types/storage';
import { TtsPlayground } from './TtsPlayground';
import { SttPlayground } from './SttPlayground';
import { VisionPlayground } from './VisionPlayground';
import { MixerPanel } from './MixerPanel';
import { HistoryPanel } from './HistoryPanel';

interface TestArenaProps {
  agents: CanonicalAgent[];
  activeAgent: CanonicalAgent;
  onSelectAgent: (id: string) => void;
  historyItems: HistoryItem[];
  onAddHistoryItem: (type: 'tts' | 'stt' | 'vision', preview: string) => void;
  onClearHistory: () => void;
}

export const TestArena: React.FC<TestArenaProps> = ({
  agents,
  activeAgent,
  onSelectAgent,
  historyItems,
  onAddHistoryItem,
  onClearHistory,
}) => {
  return (
    <div className="flex flex-col gap-6">
      {/* Seletor de Agente Ativo na Arena */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md"
            style={{ backgroundColor: activeAgent.metadata.color }}
          >
            {activeAgent.metadata.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100 text-sm">{activeAgent.metadata.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {activeAgent.metadata.category}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{activeAgent.metadata.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Trocar Persona:</span>
          <select
            value={activeAgent.metadata.id}
            onChange={(e) => onSelectAgent(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {agents.map((ag) => (
              <option key={ag.metadata.id} value={ag.metadata.id}>
                {ag.metadata.name} ({ag.voice.preferredVoice})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid Principal: TTS e STT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TtsPlayground activeAgent={activeAgent} onActivityLog={onAddHistoryItem} />
        <SttPlayground activeAgent={activeAgent} onActivityLog={onAddHistoryItem} />
      </div>

      {/* Grid Secundário: Visão e Mixer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VisionPlayground activeAgent={activeAgent} onActivityLog={onAddHistoryItem} />
        <MixerPanel />
      </div>

      {/* Histórico da Sessão */}
      <HistoryPanel historyItems={historyItems} onClearHistory={onClearHistory} />
    </div>
  );
};
