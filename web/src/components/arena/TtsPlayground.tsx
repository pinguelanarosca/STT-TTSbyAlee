/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Painel de Testes e Síntese de Voz (TTS) do Test Arena.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, Volume2, Sparkles, RefreshCw, Copy, Check, Radio, X } from 'lucide-react';
import { CanonicalAgent } from '@shared/types/agent';
import { geminiApi } from '../../services/geminiApiClient';
import { audioPlayer } from '../../audio/audioPlayer';
import { audioVisualizer } from '../../audio/audioVisualizer';
import { audioContextManager } from '../../audio/audioContextManager';

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
  const [showPopup, setShowPopup] = useState(false);
  const [popupStatus, setPopupStatus] = useState<'synthesizing' | 'playing' | 'paused' | 'done'>('done');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const popupCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    audioPlayer.onPlayStateChange = (playing) => {
      setIsPlaying(playing);
      if (playing) {
        setPopupStatus('playing');
        if (canvasRef.current) audioVisualizer.startBars(canvasRef.current);
        if (popupCanvasRef.current) audioVisualizer.startBars(popupCanvasRef.current);
      } else {
        setPopupStatus((prev) => (prev === 'playing' ? 'paused' : prev));
        audioVisualizer.stop();
      }
    };

    audioPlayer.onEnded = () => {
      setPopupStatus('done');
      setIsPlaying(false);
    };
  }, []);

  const handleSynthesizeAndPlay = async () => {
    if (!text.trim()) return;

    // Desbloqueia o Web AudioContext imediatamente no clique
    try {
      const ctx = audioContextManager.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(console.error);
      }
    } catch {}

    setIsLoading(true);
    setErrorMsg(null);
    setShowPopup(true);
    setPopupStatus('synthesizing');

    try {
      const response = await geminiApi.synthesizeSpeech({
        text,
        voiceName: activeAgent.voice.preferredVoice,
        rateMultiplier: speed,
        pitchMultiplier: activeAgent.voice.pitchMultiplier,
        systemInstruction: activeAgent.instructions.ttsSystemInstruction,
        modelId: activeAgent.modelPreferences.ttsModelId,
      });

      setPopupStatus('playing');
      await audioPlayer.playBase64(response.audioBase64, response.mimeType, volume, speed);
      onActivityLog('tts', text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setPopupStatus('done');
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-5 relative">
      {/* Pop-up Flutuante de Notificação e Controle de Narração */}
      {showPopup && (
        <div className="absolute -top-4 left-4 right-4 z-30 bg-slate-900/95 backdrop-blur-md border border-blue-500/40 rounded-xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {popupStatus === 'playing' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    popupStatus === 'synthesizing'
                      ? 'bg-amber-400 animate-pulse'
                      : popupStatus === 'playing'
                      ? 'bg-emerald-400'
                      : popupStatus === 'paused'
                      ? 'bg-yellow-400'
                      : 'bg-slate-500'
                  }`}
                ></span>
              </span>
              <span className="text-xs font-semibold text-slate-100">
                {popupStatus === 'synthesizing' && '⚡ Sintetizando Fala com Gemini...'}
                {popupStatus === 'playing' && `▶ Narrando com ${activeAgent.metadata.name} (${activeAgent.voice.preferredVoice})`}
                {popupStatus === 'paused' && '⏸ Narração Pausada'}
                {popupStatus === 'done' && '⏹ Narração Concluída'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                {activeAgent.voice.preferredVoice}
              </span>
            </div>

            <button
              onClick={() => {
                setShowPopup(false);
                if (isPlaying) audioPlayer.stop();
              }}
              className="text-slate-400 hover:text-slate-100 p-1 rounded-md hover:bg-slate-800 transition"
              title="Fechar painel de narração"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-300 line-clamp-2 italic mb-3">
            "{text}"
          </p>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 h-6 bg-slate-950 rounded-lg overflow-hidden flex items-center px-2">
              <canvas ref={popupCanvasRef} width={280} height={20} className="w-full h-full" />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => audioPlayer.togglePlayPause()}
                disabled={popupStatus === 'synthesizing' || popupStatus === 'done'}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1 transition"
              >
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{isPlaying ? 'Pausar' : 'Ouvir'}</span>
              </button>

              <button
                onClick={() => {
                  audioPlayer.stop();
                  setPopupStatus('done');
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                title="Parar áudio"
              >
                <Square className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

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
          onClick={() => {
            audioPlayer.stop();
            setPopupStatus('done');
          }}
          className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          title="Parar áudio"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
