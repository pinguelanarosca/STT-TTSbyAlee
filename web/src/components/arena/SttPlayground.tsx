/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Painel de Transcrição por Voz (STT) do Test Arena.
 */

import React, { useState } from 'react';
import { Mic, Square, RefreshCw, Copy, Check, FileText } from 'lucide-react';
import { CanonicalAgent } from '@shared/types/agent';
import { geminiApi } from '../../services/geminiApiClient';
import { audioRecorder } from '../../audio/audioRecorder';

interface SttPlaygroundProps {
  activeAgent: CanonicalAgent;
  onActivityLog: (type: 'tts' | 'stt' | 'vision', preview: string) => void;
}

export const SttPlayground: React.FC<SttPlaygroundProps> = ({ activeAgent, onActivityLog }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      setIsProcessing(true);
      setErrorMsg(null);

      try {
        const audioData = await audioRecorder.stop();
        const text = await geminiApi.transcribeAudio({
          audioBase64: audioData.base64,
          mimeType: audioData.mimeType,
          formattingInstruction: activeAgent.instructions.sttFormattingInstruction,
          modelId: activeAgent.modelPreferences.sttModelId,
        });

        setTranscription(text);
        onActivityLog('stt', text);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setErrorMsg(null);
      try {
        await audioRecorder.start();
        setIsRecording(true);
      } catch (err) {
        setErrorMsg('Permissão de microfone negada ou indisponível.');
      }
    }
  };

  const handleCopyTranscription = () => {
    if (!transcription) return;
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Mic className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Transcrição de Fala (STT)</h3>
            <p className="text-xs text-slate-400">Modelo: {activeAgent.modelPreferences.sttModelId || 'gemini-3.5-transcribe'}</p>
          </div>
        </div>

        {transcription && (
          <button
            onClick={handleCopyTranscription}
            className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        )}
      </div>

      {/* Caixa de Resultado Transcrito */}
      <div className="min-h-[120px] bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        {transcription ? (
          <p className="text-sm text-slate-200 leading-relaxed font-sans">{transcription}</p>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2 py-4">
            <FileText className="w-6 h-6 stroke-1 text-slate-700" />
            <span className="text-xs">
              {isRecording ? 'Gravando sua voz... fale livremente.' : 'Clique no botão abaixo para começar a gravar.'}
            </span>
          </div>
        )}

        {isRecording && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-900 text-xs text-red-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span>Microfone ativo (capturando áudio)</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
          {errorMsg}
        </div>
      )}

      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400">
        <span className="font-semibold text-slate-300">Instrução ativa: </span>
        <span className="italic">{activeAgent.instructions.sttFormattingInstruction}</span>
      </div>

      <button
        onClick={handleToggleRecording}
        disabled={isProcessing}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition shadow-lg cursor-pointer ${
          isRecording
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 animate-pulse'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
        } disabled:opacity-50`}
      >
        {isProcessing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            <span>Transcrevendo com Gemini 3.5...</span>
          </>
        ) : isRecording ? (
          <>
            <Square className="w-4 h-4" />
            <span>Parar Gravação e Transcrever</span>
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 text-red-400" />
            <span>Iniciar Gravação de Áudio</span>
          </>
        )}
      </button>
    </div>
  );
};
