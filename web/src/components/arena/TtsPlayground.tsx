/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Painel de Testes e Síntese de Voz (TTS) do Test Arena.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, Volume2, Sparkles, RefreshCw, Copy, Check } from 'lucide-react';
import { CanonicalAgent } from '@shared/types/agent';
import { geminiApi } from '../../services/geminiApiClient';
import { audioPlayer } from '../../audio/audioPlayer';
import { audioVisualizer } from '../../audio/audioVisualizer';

interface TtsPlaygroundProps {
  activeAgent: CanonicalAgent;
  onActivityLog: (type: 'tts' | 'stt' | 'vision', preview: string) => void;
}

export const TtsPlayground: React.FC<TtsPlaygroundProps> = ({ activeAgent, onActivityLog }) => {
  const [text, setText] = useState<string>(
    'Olá! Eu sou o assistente inteligente Gemini. Posso ler qualquer texto com entonação humana, pausas naturais e altíssima clareza acústica.'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [speed, setSpeed] = useState(1.0);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    audioPlayer.onPlayStateChange = (playing) => {
      setIsPlaying(playing);
      if (playing && canvasRef.current) {
        audioVisualizer.startBars(canvasRef.current);
      } else {
        audioVisualizer.stop();
      }
    };
  }, []);

  const handleSynthesizeAndPlay = async () => {
    if (!text.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await geminiApi.synthesizeSpeech({
        text,
        voiceName: activeAgent.voice.preferredVoice,
        rateMultiplier: speed,
        pitchMultiplier: activeAgent.voice.pitchMultiplier,
        systemInstruction: activeAgent.instructions.ttsSystemInstruction,
        modelId: activeAgent.modelPreferences.ttsModelId,
      });

      await audioPlayer.playBase64(response.audioBase64, response.mimeType, volume, speed);
      onActivityLog('tts', text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Volume2 className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Síntese de Voz (TTS)</h3>
            <p className="text-xs text-slate-400">Modelo: {activeAgent.modelPreferences.ttsModelId || 'gemini-3.8-flash-lite-tts'}</p>
          </div>
        </div>

        <button
          onClick={handleCopyText}
          className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>

      <div className="relative">
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite ou cole um texto para ser narrado pelo Gemini..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none"
        />
        <div className="absolute right-3 bottom-3 text-xs text-slate-500 font-mono">
          {text.length} chars
        </div>
      </div>

      {/* Visualizador de Áudio */}
      <div className="h-14 bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden flex items-center justify-center p-2 relative">
        <canvas ref={canvasRef} width={360} height={45} className="w-full h-full" />
        {!isPlaying && (
          <span className="absolute text-xs text-slate-600 font-medium">
            Osciloscópio de Áudio (Aguardando reprodução)
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
          {errorMsg}
        </div>
      )}

      {/* Controles Acústicos */}
      <div className="grid grid-cols-2 gap-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Volume</span>
            <span className="font-mono text-slate-300">{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              audioPlayer.setVolume(val);
            }}
            className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Velocidade</span>
            <span className="font-mono text-slate-300">{speed.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={speed}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setSpeed(val);
              audioPlayer.setSpeed(val);
            }}
            className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSynthesizeAndPlay}
          disabled={isLoading || !text.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>{isLoading ? 'Sintetizando...' : 'Gerar e Ouvir Fala'}</span>
        </button>

        <button
          onClick={() => audioPlayer.togglePlayPause()}
          disabled={!audioPlayer.isPlaying() && !isPlaying}
          className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer disabled:opacity-40"
          title={isPlaying ? 'Pausar' : 'Retomar'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button
          onClick={() => audioPlayer.stop()}
          className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          title="Parar áudio"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
