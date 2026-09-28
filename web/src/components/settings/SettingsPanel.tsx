/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Painel de Configurações Gerais do Web Studio.
 */

import React, { useState } from 'react';
import { Key, Volume2, Save, CheckCircle, RefreshCw, AlertTriangle, RotateCcw } from 'lucide-react';
import { AppStorageSchema } from '@shared/types/storage';
import { geminiApi } from '../../services/geminiApiClient';

interface SettingsPanelProps {
  storageState: AppStorageSchema;
  onUpdateStorage: (partial: Partial<AppStorageSchema>) => Promise<void>;
  onResetStorage: () => Promise<void>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  storageState,
  onUpdateStorage,
  onResetStorage,
}) => {
  const [apiKey, setApiKey] = useState(storageState.api.apiKey);
  const [voice, setVoice] = useState(storageState.audio.preferredVoice);
  const [sampleRate, setSampleRate] = useState(storageState.audio.sampleRate);
  const [testResult, setTestResult] = useState<{ success?: boolean; msg?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = async () => {
    await onUpdateStorage({
      api: { ...storageState.api, apiKey: apiKey.trim() },
      audio: { ...storageState.audio, preferredVoice: voice, sampleRate },
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleTestKey = async () => {
    if (!apiKey) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const ok = await geminiApi.testApiKey(apiKey.trim());
      setTestResult({
        success: ok,
        msg: ok ? 'Chave validada com sucesso no Google AI Studio!' : 'Chave inválida.',
      });
    } catch {
      setTestResult({ success: false, msg: 'Falha na conexão com a API Gemini.' });
    } finally {
      setIsTesting(false);
    }
  };

  const voicesList = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'];

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Configurações do Studio</h2>
          <p className="text-xs text-slate-400 mt-1">
            Gerenciamento seguro de credenciais Gemini e preferências de áudio.
          </p>
        </div>

        {savedNotice && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Salvo com sucesso!</span>
          </span>
        )}
      </div>

      {/* Chave de API */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Key className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Chave de API Gemini</h3>
            <p className="text-xs text-slate-400">Armazenada localmente e nunca exposta em URLs</p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Cole sua chave AIzaSy..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleTestKey}
            disabled={isTesting || !apiKey.trim()}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>Testar</span>
          </button>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              testResult.success
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {testResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{testResult.msg}</span>
          </div>
        )}
      </div>

      {/* Áudio & Voz Padrão */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Volume2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Preferências Acústicas Globais</h3>
            <p className="text-xs text-slate-400">Padrão para novos agentes e players</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Voz Gemini Global:</label>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
            >
              {voicesList.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Sample Rate (Hz):</label>
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
            >
              <option value={24000}>24.000 Hz (Oficial LINEAR16)</option>
              <option value={16000}>16.000 Hz (Telefonia / Voz)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onResetStorage}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restaurar Padrões de Fábrica</span>
        </button>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-lg shadow-blue-600/30 transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>Salvar Configurações</span>
        </button>
      </div>
    </div>
  );
};
