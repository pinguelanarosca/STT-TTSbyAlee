/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Controlador de Text-to-Speech (TTS) no Content Script da Extensão Chrome.
 * - Garante uma única operação TTS ativa por vez com token de cancelamento.
 * - Exclusivamente HTMLAudioElement + Blob URL para reprodução nativa sem overhead.
 * - Validação rigorosa de payload e cancelamento total de requisições de rede ao parar.
 */

import { splitTextIntoChunks } from '@shared/utils/textCleaner';
import { base64ToUint8Array } from '@shared/utils/pcmWav';
import { hud } from '../ui/hudController';

const MAX_BASE64_AUDIO_LENGTH = 15 * 1024 * 1024; // 15MB

export class TtsController {
  private audio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private queue: string[] = [];
  private currentChunkIndex = 0;
  private isPaused = false;
  private volume = 1.0;
  private playbackRate = 1.0;
  private activeAgentId?: string;
  private currentOperationId = 0;

  constructor() {
    this.audio = new Audio();
    this.setupAudioListeners();
  }

  private setupAudioListeners(): void {
    if (!this.audio) return;

    this.audio.addEventListener('ended', () => {
      this.playNextChunk();
    });

    this.audio.addEventListener('error', (e) => {
      console.error('[TTS Controller] Erro no elemento de áudio nativo:', e);
      hud.setStatus('idle', 'Erro no áudio');
      this.stop();
    });

    this.audio.addEventListener('pause', () => {
      if (this.audio && this.audio.currentTime < this.audio.duration && !this.audio.ended) {
        this.isPaused = true;
        hud.setPlayingState(false);
      }
    });

    this.audio.addEventListener('play', () => {
      this.isPaused = false;
      hud.setPlayingState(true);
    });
  }

  /**
   * Inicia a narração de um texto. Cancela qualquer operação anterior ativa.
   */
  public async speakText(text: string, agentId?: string): Promise<void> {
    // Incrementa o token de operação para invalidar qualquer callback anterior em trânsito
    const opId = ++this.currentOperationId;
    this.stopInternal(false);

    const rawText = text?.trim();
    if (!rawText) return;

    this.activeAgentId = agentId;
    // Divide textos extensos em blocos de até 600 caracteres para resposta rápida
    this.queue = splitTextIntoChunks(rawText, 600);
    this.currentChunkIndex = 0;

    hud.show();
    hud.setStatus('loading', 'Sintetizando');
    hud.setTextPreview(this.queue[0]);

    await this.requestAndPlayChunk(this.queue[0], opId, this.activeAgentId);
  }

  private async requestAndPlayChunk(chunkText: string, opId: number, agentId?: string): Promise<void> {
    if (opId !== this.currentOperationId) return;

    try {
      chrome.runtime.sendMessage(
        {
          type: 'TTS_REQUEST',
          payload: { text: chunkText, agentId: agentId || this.activeAgentId },
        },
        (response) => {
          // Se a operação foi cancelada ou substituída enquanto aguardava a resposta
          if (opId !== this.currentOperationId) {
            console.log('[TTS Controller] Resposta descartada: operação anterior cancelada.');
            return;
          }

          if (chrome.runtime.lastError) {
            console.error('[TTS Controller] Erro de comunicação runtime:', chrome.runtime.lastError.message);
            hud.setStatus('idle', 'Erro de conexão');
            return;
          }

          if (!response || !response.success || !response.data?.audioBase64) {
            const err = response?.error || 'Falha na resposta do Service Worker';
            console.error('[TTS Controller]', err);
            if (err.includes('Chave')) {
              hud.setStatus('idle', 'Chave Ausente');
              hud.setTextPreview('⚠️ Chave de API Gemini não configurada. Abra as Opções da Extensão para configurar.');
            } else if (err.includes('cancelada') || err.includes('abort')) {
              hud.setStatus('idle', 'Cancelado');
            } else {
              hud.setStatus('idle', 'Erro TTS');
              hud.setTextPreview(`❌ Erro: ${err}`);
            }
            return;
          }

          const { audioBase64, mimeType } = response.data;
          this.playBase64Audio(audioBase64, mimeType || 'audio/wav', opId);
        }
      );
    } catch (err) {
      if (opId === this.currentOperationId) {
        console.error('[TTS Controller] Erro ao despachar TTS_REQUEST:', err);
        hud.setStatus('idle', 'Erro');
      }
    }
  }

  /**
   * Reproduz áudio Base64 exclusivamente via HTMLAudioElement e Blob URL
   */
  public playBase64Audio(base64: string, mimeType: string = 'audio/wav', opId?: number): void {
    if (opId !== undefined && opId !== this.currentOperationId) return;
    if (!this.audio || !base64 || typeof base64 !== 'string') return;

    if (base64.length > MAX_BASE64_AUDIO_LENGTH) {
      console.error('[TTS Controller] Payload de áudio excede 15MB.');
      hud.setStatus('idle', 'Áudio muito grande');
      return;
    }

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    try {
      const rawBytes = base64ToUint8Array(base64);
      if (rawBytes.length < 44) {
        throw new Error('Bytes de áudio inválidos ou corrompidos.');
      }

      const blob = new Blob([rawBytes as unknown as BlobPart], { type: mimeType });
      this.currentObjectUrl = URL.createObjectURL(blob);

      this.audio.src = this.currentObjectUrl;
      this.audio.volume = this.volume;
      this.audio.playbackRate = this.playbackRate;

      this.audio.play()
        .then(() => {
          if (opId === undefined || opId === this.currentOperationId) {
            hud.setPlayingState(true);
            hud.setStatus('playing', `Lendo (${this.currentChunkIndex + 1}/${this.queue.length})`);
          }
        })
        .catch((err) => {
          console.warn('[TTS Controller] Autoplay bloqueado pelo navegador:', err);
          hud.setPlayingState(false);
          hud.setStatus('idle', 'Clique para Ouvir');
        });
    } catch (err) {
      console.error('[TTS Controller] Falha ao criar Blob de áudio:', err);
      hud.setStatus('idle', 'Erro de decodificação');
    }
  }

  private playNextChunk(): void {
    const opId = this.currentOperationId;
    this.currentChunkIndex++;
    if (this.currentChunkIndex < this.queue.length) {
      const nextText = this.queue[this.currentChunkIndex];
      hud.setStatus('loading', `Parte ${this.currentChunkIndex + 1}/${this.queue.length}`);
      hud.setTextPreview(nextText);
      this.requestAndPlayChunk(nextText, opId, this.activeAgentId);
    } else {
      this.stop();
      hud.setStatus('idle', 'Concluído');
    }
  }

  public togglePlayPause(): void {
    if (!this.audio || !this.audio.src) return;

    if (this.audio.paused) {
      this.audio.play().then(() => {
        this.isPaused = false;
        hud.setPlayingState(true);
      }).catch(console.error);
    } else {
      this.audio.pause();
      this.isPaused = true;
      hud.setPlayingState(false);
    }
  }

  private stopInternal(notifyServiceWorker = true): void {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
      } catch {}
    }

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    this.queue = [];
    this.currentChunkIndex = 0;
    this.isPaused = false;
    hud.setPlayingState(false);

    if (notifyServiceWorker) {
      try {
        chrome.runtime.sendMessage({ type: 'TTS_STOP' }).catch(() => {});
      } catch {}
    }
  }

  /**
   * Para a reprodução imediatamente e cancela requisições de rede pendentes
   */
  public stop(): void {
    this.currentOperationId++;
    this.stopInternal(true);
    hud.setStatus('idle', 'Parado');
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audio) this.audio.volume = this.volume;
  }

  public setSpeed(speed: number): void {
    this.playbackRate = Math.max(0.5, Math.min(2.0, speed));
    if (this.audio) this.audio.playbackRate = this.playbackRate;
  }
}

export const tts = new TtsController();
