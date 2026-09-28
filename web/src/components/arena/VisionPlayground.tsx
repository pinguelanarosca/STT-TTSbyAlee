/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Painel de Inspeção Multimodal Visual (Lens / Vision).
 */

import React, { useState } from 'react';
import { Eye, Upload, Sparkles, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { CanonicalAgent } from '@shared/types/agent';
import { geminiApi } from '../../services/geminiApiClient';

interface VisionPlaygroundProps {
  activeAgent: CanonicalAgent;
  onActivityLog: (type: 'tts' | 'stt' | 'vision', preview: string) => void;
}

export const VisionPlayground: React.FC<VisionPlaygroundProps> = ({ activeAgent, onActivityLog }) => {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [query, setQuery] = useState<string>(activeAgent.instructions.lensInspectionInstruction || 'Descreva os elementos e textos visíveis nesta imagem.');
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.replace(/^data:[a-z0-9/]+;base64,/, '');
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageBase64) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const desc = await geminiApi.analyzeVision(imageBase64, query);
      setAnalysis(desc);
      onActivityLog('vision', desc);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Eye className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Gemini Lens / Visão</h3>
            <p className="text-xs text-slate-400">Modelo: gemini-3.8-flash (Multimodal Vision)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Upload da Imagem */}
        <div className="h-44 bg-slate-950 border border-dashed border-slate-800 rounded-xl overflow-hidden flex flex-col items-center justify-center relative p-2 group hover:border-slate-700 transition">
          {imageBase64 ? (
            <img
              src={`data:image/jpeg;base64,${imageBase64}`}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <label className="flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:text-slate-300">
              <Upload className="w-6 h-6 mb-2" />
              <span className="text-xs font-medium">Carregar Imagem para Análise</span>
              <span className="text-[10px] text-slate-600 mt-1">PNG, JPG, WebP</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          )}
          {imageBase64 && (
            <label className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition text-xs text-slate-200">
              <Upload className="w-4 h-4 mr-1.5" />
              <span>Trocar Imagem</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          )}
        </div>

        {/* Prompt de Análise */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-400">Instrução de Visão:</label>
          <textarea
            rows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition resize-none"
          />
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !imageBase64}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition shadow-md shadow-indigo-600/20 disabled:opacity-40 cursor-pointer"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isLoading ? 'Analisando...' : 'Examinar Imagem'}</span>
          </button>
        </div>
      </div>

      {/* Resultado da Análise */}
      {analysis && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 leading-relaxed max-h-40 overflow-y-auto">
          {analysis}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
