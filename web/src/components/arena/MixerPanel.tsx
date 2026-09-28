/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Painel de Comparação Acústica e Mixer de Vozes do Studio.
 */

import React, { useState } from 'react';
import { Sliders, Play, RefreshCw } from 'lucide-react';
import { geminiApi } from '../../services/geminiApiClient';
import { audioPlayer } from '../../audio/audioPlayer';

export const MixerPanel: React.FC = () => {
  const [voiceA, setVoiceA] = useState('Puck');
  const [voiceB, setVoiceB] = useState('Kore');
  const [phrase, setPhrase] = useState('A inteligência artificial transforma como nos comunicamos e trabalhamos todos os dias.');
  const [loadingVoice, setLoadingVoice] = useState<'A' | 'B' | null>(null);

  const handleTestVoice = async (target: 'A' | 'B') => {
    setLoadingVoice(target);
    const chosenVoice = target === 'A' ? voiceA : voiceB;
    try {
      const res = await geminiApi.synthesizeSpeech({
        text: phrase,
        voiceName: chosenVoice,
        rateMultiplier: 1.0,
        pitchMultiplier: 1.0,
        modelId: 'gemini-3.8-flash-lite-tts',
      });
      await audioPlayer.playBase64(res.audioBase64, res.mimeType);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVoice(null);
    }
  };

  const voicesList = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Sliders className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Mixer & Comparador de Vozes</h3>
          <p className="text-xs text-slate-400">Contraste de timbre e entonação lado a lado</p>
        </div>
      </div>

      <input
        type="text"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition"
      />

      <div className="grid grid-cols-2 gap-4">
        {/* Voz A */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400">Voz Canal A</span>
            <select
              value={voiceA}
              onChange={(e) => setVoiceA(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
            >
              {voicesList.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => handleTestVoice('A')}
            disabled={loadingVoice !== null}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-medium transition cursor-pointer"
          >
            {loadingVoice === 'A' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Ouvir Canal A ({voiceA})</span>
          </button>
        </div>

        {/* Voz B */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-400">Voz Canal B</span>
            <select
              value={voiceB}
              onChange={(e) => setVoiceB(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
            >
              {voicesList.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => handleTestVoice('B')}
            disabled={loadingVoice !== null}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-medium transition cursor-pointer"
          >
            {loadingVoice === 'B' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Ouvir Canal B ({voiceB})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
