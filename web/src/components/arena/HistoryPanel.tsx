/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Painel de Histórico e Registro de Sessão.
 */

import React from 'react';
import { History, Trash2, Volume2, Mic, Eye } from 'lucide-react';
import { HistoryItem } from '@shared/types/storage';

interface HistoryPanelProps {
  historyItems: HistoryItem[];
  onClearHistory: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ historyItems, onClearHistory }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <History className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Histórico de Atividades</h3>
            <p className="text-xs text-slate-400">{historyItems.length} registros nesta sessão</p>
          </div>
        </div>

        {historyItems.length > 0 && (
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        )}
      </div>

      <div className="max-h-60 overflow-y-auto flex flex-col gap-2">
        {historyItems.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-600">
            Nenhuma atividade registrada ainda nesta sessão.
          </div>
        ) : (
          historyItems.map((item) => {
            const iconMap: Record<string, React.ReactNode> = {
              tts: <Volume2 className="w-3.5 h-3.5 text-blue-400" />,
              stt: <Mic className="w-3.5 h-3.5 text-red-400" />,
              vision: <Eye className="w-3.5 h-3.5 text-indigo-400" />,
            };
            return (
              <div
                key={item.id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div className="mt-0.5">{iconMap[item.type] || <Volume2 className="w-3.5 h-3.5" />}</div>
                  <span className="text-slate-300 truncate">{item.previewText}</span>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
