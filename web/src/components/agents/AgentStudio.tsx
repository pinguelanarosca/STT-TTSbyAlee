/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Agent Studio: Gestão e CRUD de Personas e Agentes de Leitura/Transcrição.
 */

import React, { useState } from 'react';
import { Users, Plus, Edit2, Trash2, Check, Sparkles, Volume2, Mic } from 'lucide-react';
import { CanonicalAgent } from '@shared/types/agent';
import { DEFAULT_AGENTS } from '@shared/constants/defaultAgents';

interface AgentStudioProps {
  agents: CanonicalAgent[];
  activeAgentId: string;
  onSelectActiveAgent: (id: string) => void;
  onSaveAgent: (agent: CanonicalAgent) => void;
  onDeleteAgent: (id: string) => void;
}

export const AgentStudio: React.FC<AgentStudioProps> = ({
  agents,
  activeAgentId,
  onSelectActiveAgent,
  onSaveAgent,
  onDeleteAgent,
}) => {
  const [editingAgent, setEditingAgent] = useState<CanonicalAgent | null>(null);

  const handleCreateNew = () => {
    setEditingAgent({
      metadata: {
        id: `agent_${Date.now()}`,
        name: 'Novo Agente Criativo',
        description: 'Persona personalizada para leitura e síntese customizada.',
        category: 'custom',
        icon: 'Sparkles',
        color: '#6366f1',
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
        ttsSystemInstruction: 'Você é um narrador expressivo e atencioso.',
        sttFormattingInstruction: 'Transcreva o áudio com máxima fidelidade e pontuação.',
        lensInspectionInstruction: 'Descreva detalhadamente os elementos visuais.',
      },
      modelPreferences: {
        ttsModelId: 'gemini-3.8-flash-lite-tts',
        sttModelId: 'gemini-3.5-transcribe',
      },
    });
  };

  const voicesList = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Agent Studio</h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure as instruções de sistema, vozes e personas que alimentam a extensão e a web.
          </p>
        </div>

        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-lg shadow-blue-600/25 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Nova Persona</span>
        </button>
      </div>

      {/* Grid de Agentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {agents.map((ag) => {
          const isActive = ag.metadata.id === activeAgentId;
          return (
            <div
              key={ag.metadata.id}
              className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                isActive
                  ? 'border-blue-500 ring-1 ring-blue-500/50 shadow-lg shadow-blue-500/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md"
                      style={{ backgroundColor: ag.metadata.color }}
                    >
                      {ag.metadata.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">{ag.metadata.name}</h4>
                      <span className="text-[10px] text-slate-500 capitalize">{ag.metadata.category}</span>
                    </div>
                  </div>

                  {ag.metadata.isBuiltIn ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      Padrão
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Customizado
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">{ag.metadata.description}</p>

                <div className="flex items-center gap-4 text-xs text-slate-500 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-slate-300 font-medium">{ag.voice.preferredVoice}</span>
                  </div>
                  <div>Velocidade: {ag.voice.rateMultiplier}x</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-800">
                <button
                  onClick={() => onSelectActiveAgent(ag.metadata.id)}
                  disabled={isActive}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 cursor-default'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {isActive ? '✓ Agente Ativo' : 'Ativar'}
                </button>

                <button
                  onClick={() => setEditingAgent({ ...ag })}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  title="Editar persona"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                {!ag.metadata.isBuiltIn && (
                  <button
                    onClick={() => onDeleteAgent(ag.metadata.id)}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition cursor-pointer"
                    title="Excluir persona"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Criação / Edição */}
      {editingAgent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="text-base font-bold text-slate-100">
              {editingAgent.metadata.isBuiltIn ? 'Visualizar / Clonar Agente' : 'Editar Persona'}
            </h3>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Nome do Agente:</label>
              <input
                type="text"
                value={editingAgent.metadata.name}
                onChange={(e) =>
                  setEditingAgent({
                    ...editingAgent,
                    metadata: { ...editingAgent.metadata, name: e.target.value },
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Descrição:</label>
              <input
                type="text"
                value={editingAgent.metadata.description}
                onChange={(e) =>
                  setEditingAgent({
                    ...editingAgent,
                    metadata: { ...editingAgent.metadata, description: e.target.value },
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Voz Gemini:</label>
                <select
                  value={editingAgent.voice.preferredVoice}
                  onChange={(e) =>
                    setEditingAgent({
                      ...editingAgent,
                      voice: { ...editingAgent.voice, preferredVoice: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                >
                  {voicesList.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Velocidade de Leitura:</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="2.0"
                  value={editingAgent.voice.rateMultiplier}
                  onChange={(e) =>
                    setEditingAgent({
                      ...editingAgent,
                      voice: { ...editingAgent.voice, rateMultiplier: parseFloat(e.target.value) || 1.0 },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">
                Instrução do Sistema para Leitura (TTS):
              </label>
              <textarea
                rows={3}
                value={editingAgent.instructions.ttsSystemInstruction}
                onChange={(e) =>
                  setEditingAgent({
                    ...editingAgent,
                    instructions: { ...editingAgent.instructions, ttsSystemInstruction: e.target.value },
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">
                Instrução do Sistema para Transcrição (STT):
              </label>
              <textarea
                rows={3}
                value={editingAgent.instructions.sttFormattingInstruction}
                onChange={(e) =>
                  setEditingAgent({
                    ...editingAgent,
                    instructions: { ...editingAgent.instructions, sttFormattingInstruction: e.target.value },
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Modelo TTS:</label>
                <select
                  value={editingAgent.modelPreferences?.ttsModelId || 'gemini-3.8-flash-lite-tts'}
                  onChange={(e) =>
                    setEditingAgent({
                      ...editingAgent,
                      modelPreferences: { ...editingAgent.modelPreferences, ttsModelId: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                >
                  <option value="gemini-3.8-flash-lite-tts">Gemini 3.8 Flash-Lite TTS</option>
                  <option value="gemini-3.8-flash-tts">Gemini 3.8 Flash TTS</option>
                  <option value="gemini-3.1-flash-tts-preview">Gemini 3.1 Flash TTS</option>
                  <option value="gemini-2.5-flash-preview-tts">Gemini 2.5 Flash TTS</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Modelo STT:</label>
                <select
                  value={editingAgent.modelPreferences?.sttModelId || 'gemini-3.5-flash-lite'}
                  onChange={(e) =>
                    setEditingAgent({
                      ...editingAgent,
                      modelPreferences: { ...editingAgent.modelPreferences, sttModelId: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                >
                  <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingAgent(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onSaveAgent(editingAgent);
                  setEditingAgent(null);
                }}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                Salvar Persona
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
