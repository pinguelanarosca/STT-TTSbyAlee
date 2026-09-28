/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Controlador de Text-to-Speech (TTS) no Content Script.
 * Gerencia filas, chunking de textos extensos, reprodução com Blob URLs e eventos de controle.
 */

import { splitTextIntoChunks } from '@shared/utils/textCleaner';
import { base64ToUint8Array } from '@shared/utils/pcmWav';
import { hud } from '../ui/hudController';

export class TtsController {
  private audio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private queue: string[] = [];
  private currentChunkIndex = 0;
  private isPaused = false;
  private volume = 1.0;
  private playbackRate = 1.0;
  private activeAgentId?: string;

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
      console.error('[TTS Controller] Erro no elemento de áudio:', e);
      hud.setStatus('idle', 'Erro no áudio');
      this.stop();
    });
  }

  public async speakText(text: string, agentId?: string): Promise<void> {
    this.stop();
    if (!text || !text.trim()) return;

    this.activeAgentId = agentId;
    // Divide textos extensos em blocos de até 600 caracteres para resposta instantânea
    this.queue = splitTextIntoChunks(text, 600);
    this.currentChunkIndex = 0;

    hud.show();
    hud.setStatus('loading', 'Sintetizando');
    hud.setTextPreview(this.queue[0]);

    await this.requestAndPlayChunk(this.queue[0], this.activeAgentId);
  }

  private async requestAndPlayChunk(chunkText: string, agentId?: string): Promise<void> {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'TTS_REQUEST',
          payload: { text: chunkText, agentId: agentId || this.activeAgentId },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[TTS Controller] Erro de runtime:', chrome.runtime.lastError.message);
            hud.setStatus('idle', 'Erro de conexão');
            return;
          }

          if (!response || !response.success || !response.data?.audioBase64) {
            const err = response?.error || 'Falha na resposta do Service Worker';
            console.error('[TTS Controller]', err);
            if (err.includes('Chave')) {
              hud.setStatus('idle', 'Chave Ausente');
              hud.setTextPreview('⚠️ Chave de API Gemini não configurada. Abra as Opções da Extensão (clicando com o botão direito no ícone da extensão -> Opções) e insira sua chave.');
            } else {
              hud.setStatus('idle', 'Erro TTS');
              hud.setTextPreview(`❌ Erro ao sintetizar: ${err}`);
            }
            return;
          }

          const { audioBase64, mimeType } = response.data;
          this.playBase64Audio(audioBase64, mimeType);
        }
      );
    } catch (err) {
      console.error('[TTS Controller] Erro ao despachar TTS_REQUEST:', err);
      hud.setStatus('idle', 'Erro');
    }
  }

  public playBase64Audio(base64: string, mimeType: string = 'audio/wav'): void {
    if (!this.audio || !base64) return;

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    try {
      const rawBytes = base64ToUint8Array(base64);
      const arrayBuffer = rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: mimeType });
      this.currentObjectUrl = URL.createObjectURL(blob);

      this.audio.src = this.currentObjectUrl;
      this.audio.volume = this.volume;
      this.audio.playbackRate = this.playbackRate;

      this.audio.play()
        .then(() => {
          hud.setPlayingState(true);
          hud.setStatus('playing', `Lendo (${this.currentChunkIndex + 1}/${this.queue.length})`);
        })
        .catch((err) => {
          console.warn('[TTS Controller] Auto-play aguardando interação do usuário:', err);
          hud.setPlayingState(false);
        });
    } catch (err) {
      console.error('[TTS Controller] Falha ao criar Blob de áudio:', err);
      hud.setStatus('idle', 'Erro de decodificação');
    }
  }

  private playNextChunk(): void {
    this.currentChunkIndex++;
    if (this.currentChunkIndex < this.queue.length) {
      const nextText = this.queue[this.currentChunkIndex];
      hud.setStatus('loading', `Parte ${this.currentChunkIndex + 1}/${this.queue.length}`);
      hud.setTextPreview(nextText);
      this.requestAndPlayChunk(nextText, this.activeAgentId);
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

  public stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    this.queue = [];
    this.currentChunkIndex = 0;
    this.isPaused = false;
    hud.setPlayingState(false);
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
