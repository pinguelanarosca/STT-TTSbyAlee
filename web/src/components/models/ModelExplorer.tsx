/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Model Explorer: Catálogo Oficial, Capacidades e Descoberta em Runtime.
 */

import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, CheckCircle2, AlertOctagon, Sparkles, Filter, MapPin } from 'lucide-react';
import { KNOWN_MODELS, TTS_MODELS_WHITELIST, FLASH_LITE_MODELS_WHITELIST, STT_UNARY_MODELS_WHITELIST, STT_LIVE_MODELS_WHITELIST } from '@shared/constants/modelsCatalog';
import { DiscoveredModelInfo } from '@shared/types/models';
import { geminiApi } from '../../services/geminiApiClient';

export const ModelExplorer: React.FC = () => {
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const fetchDiscovered = async () => {
    setIsLoading(true);
    try {
      const data = await geminiApi.discoverModels();
      setDiscoveredModels(data);
    } catch (err) {
      console.warn('Descoberta indisponível, exibindo conhecidos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscovered();
  }, []);

  const knownList = Object.values(KNOWN_MODELS);
  const filteredKnown = filterCategory === 'all'
    ? knownList
    : knownList.filter((m) => m.category === filterCategory);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Explorador de Modelos Gemini (Whitelist Estrita)</h2>
          <p className="text-xs text-slate-400 mt-1">
            Matriz de capacidades e modelos homologados por protocolo: TTS nativo, STT Unary, Visão Flash-Lite.
          </p>
        </div>

        <button
          onClick={fetchDiscovered}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Consultando API...' : 'Atualizar Descoberta'}</span>
        </button>
      </div>

      {/* Cadeias Canônicas de Fallback por Protocolo */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Cadeias Oficiais de Fallback por Tarefa (Zero Cross-Category & Zero-Retry)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-blue-400 font-semibold block uppercase">TTS (Ordem Estrita 1 a 4)</span>
            <div className="text-xs text-slate-200 font-mono mt-1 space-y-0.5">
              {TTS_MODELS_WHITELIST.map((id, idx) => (
                <div key={id} className="flex items-center gap-1.5">
                  <span className="text-slate-500">{idx + 1}.</span>
                  <span>{KNOWN_MODELS[id]?.displayName || id}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-red-400 font-semibold block uppercase">STT (Transcrição de Voz)</span>
            <div className="text-xs text-slate-200 font-mono mt-1 space-y-1">
              <div>Unary: <span className="text-slate-300">Gemini 3.5 Transcribe</span></div>
              <div>Live: <span className="text-slate-300">Gemini 3.5 Transcribe Live</span></div>
              <span className="text-[10px] text-slate-500 mt-1 block">Regra: sttModelId !== ttsModelId</span>
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-emerald-400 font-semibold block uppercase">Flash-Lite / Vision / Auth (1 a 3)</span>
            <div className="text-xs text-slate-200 font-mono mt-1 space-y-0.5">
              {FLASH_LITE_MODELS_WHITELIST.map((id, idx) => (
                <div key={id} className="flex items-center gap-1.5">
                  <span className="text-slate-500">{idx + 1}.</span>
                  <span>{KNOWN_MODELS[id]?.displayName || id}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros de Categoria */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-400 font-medium">Filtrar Categoria:</span>
        <div className="flex gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'tts', label: 'TTS' },
            { id: 'stt_transcription', label: 'STT' },
            { id: 'general_multimodal', label: 'Flash-Lite / Visão' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                filterCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Modelos Conhecidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredKnown.map((model) => (
          <div
            key={model.id}
            className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between ${
              model.deprecated ? 'border-red-950/40 opacity-75' : 'border-slate-800'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-slate-100 text-sm">{model.displayName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    {model.category}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {model.availability.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="text-xs font-mono text-blue-400 mb-2">{model.id}</div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">{model.description}</p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <span>Entrada: {model.inputModalities.audio ? '🎤 ' : ''}{model.inputModalities.text ? '📄 ' : ''}{model.inputModalities.image ? '🖼️ ' : ''}</span>
                <span>Saída: {model.outputModalities.audio ? '🔊 Áudio' : '📄 Texto'}</span>
              </div>
              <div>
                {model.capabilities?.mapsGrounding ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5" /> Maps Grounding
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600">Maps: N/A</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
