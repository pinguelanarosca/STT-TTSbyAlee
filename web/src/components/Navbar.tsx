/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Barra de navegação do Web Studio com alternância de abas e status de conexão.
 */

import React from 'react';
import { Volume2, PlayCircle, Users, Cpu, Download, Settings, Sparkles } from 'lucide-react';

export type StudioTab = 'arena' | 'agents' | 'models' | 'extension' | 'settings';

interface NavbarProps {
  activeTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  activeAgentName: string;
  hasApiKey: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  activeAgentName,
  hasApiKey,
}) => {
  const tabs = [
    { id: 'arena', label: 'Test Arena', icon: PlayCircle },
    { id: 'agents', label: 'Agent Studio', icon: Users },
    { id: 'models', label: 'Modelos & Descoberta', icon: Cpu },
    { id: 'extension', label: 'Extensão & Download', icon: Download },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Volume2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100 text-base tracking-tight">EXT TTS STT</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20">
              Studio 2.0
            </span>
          </div>
          <p className="text-xs text-slate-400">Gemini Multimodal Suite</p>
        </div>
      </div>

      <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as StudioTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400">Agente:</span>
          <span className="font-semibold text-slate-200">{activeAgentName}</span>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            hasApiKey
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20 cursor-pointer'
          }`}
          onClick={() => !hasApiKey && onTabChange('settings')}
          title={hasApiKey ? 'Chave de API configurada' : 'Chave não configurada - clique para configurar'}
        >
          <span className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span>{hasApiKey ? 'API Ativa' : 'Sem Chave'}</span>
        </div>
      </div>
    </header>
  );
};
