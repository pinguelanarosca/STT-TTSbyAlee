/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Controlador de Text-to-Speech (TTS) no Content Script da Extensão Chrome.
 * - Fila FIFO real de síntese e reprodução.
 * - Auto-play imediato ao sintetizar.
 * - Suporte a Replay ilimitado com o botão 'Ouvir' preservando o áudio sintetizado.
 * - Ciclo de vida robusto: Sintetizando -> Lendo -> Concluído.
 */

import { splitTextIntoChunks } from '@shared/utils/textCleaner';
import { base64ToUint8Array } from '@shared/utils/pcmWav';
import { hud } from '../ui/hudController';

const MAX_BASE64_AUDIO_LENGTH = 15 * 1024 * 1024; // 15MB

interface TtsQueueTask {
  id: number;
  rawText: string;
  agentId?: string;
  chunks: string[];
  currentChunkIndex: number;
  chunkBlobs: Map<number, string>; // chunkIndex -> ObjectURL
}

export class TtsController {
  private audio: HTMLAudioElement | null = null;
  private queue: TtsQueueTask[] = [];
  private activeTask: TtsQueueTask | null = null;
  private isProcessing = false;
  private nextTaskId = 1;
  private isPaused = false;
  private volume = 1.0;
  private playbackRate = 1.0;

  constructor() {
    this.audio = new Audio();
    this.setupAudioListeners();
  }

  private setupAudioListeners(): void {
    if (!this.audio) return;

    this.audio.addEventListener('ended', () => {
      this.handleChunkEnded();
    });

    this.audio.addEventListener('error', (e) => {
      console.error('[TTS Controller] Erro no elemento de áudio nativo:', e);
      hud.setStatus('idle', 'Erro no áudio');
      this.isPaused = false;
      hud.setPlayingState(false);
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
   * Adiciona um novo pedido de fala à fila FIFO sem interromper tarefas anteriores.
   */
  public async speakText(text: string, agentId?: string): Promise<void> {
    const rawText = text?.trim();
    if (!rawText) return;

    const chunks = splitTextIntoChunks(rawText, 600);
    const task: TtsQueueTask = {
      id: this.nextTaskId++,
      rawText,
      agentId,
      chunks,
      currentChunkIndex: 0,
      chunkBlobs: new Map(),
    };

    this.queue.push(task);
    hud.show();

    if (!this.isProcessing) {
      await this.processNextInQueue();
    }
  }

  /**
   * Processa a próxima tarefa da fila FIFO em ordem.
   */
  private async processNextInQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    this.activeTask = this.queue[0];
    this.activeTask.currentChunkIndex = 0;

    hud.setStatus('loading', 'Sintetizando');
    hud.setTextPreview(this.activeTask.chunks[0]);

    await this.fetchAndPlayChunk(this.activeTask, 0);
  }

  /**
   * Busca e reproduz com auto-play o chunk da tarefa ativa.
   */
  private async fetchAndPlayChunk(task: TtsQueueTask, chunkIdx: number): Promise<void> {
    if (this.activeTask !== task || chunkIdx >= task.chunks.length) return;

    const chunkText = task.chunks[chunkIdx];
    hud.setTextPreview(chunkText);

    // Se já tiver o áudio em cache para este chunk
    const existingUrl = task.chunkBlobs.get(chunkIdx);
    if (existingUrl) {
      this.playObjectUrl(existingUrl, task, chunkIdx);
      return;
    }

    hud.setStatus('loading', 'Sintetizando');

    try {
      chrome.runtime.sendMessage(
        {
          type: 'TTS_REQUEST',
          payload: { text: chunkText, agentId: task.agentId },
        },
        (response) => {
          // Se a tarefa ativa mudou ou foi limpa
          if (this.activeTask !== task) {
            return;
          }

          if (chrome.runtime.lastError) {
            console.error('[TTS Controller] Erro de runtime:', chrome.runtime.lastError.message);
            hud.setStatus('idle', 'Erro de conexão');
            this.finishTaskAndAdvance(task);
            return;
          }

          if (!response || !response.success || !response.data?.audioBase64) {
            const err = response?.error || 'Falha na resposta do Service Worker';
            console.error('[TTS Controller]', err);
            if (err.includes('Chave')) {
              hud.setStatus('idle', 'Chave Ausente');
              hud.setTextPreview('⚠️ Chave de API Gemini não configurada. Abra as Opções da Extensão para configurar.');
            } else {
              hud.setStatus('idle', 'Erro TTS');
              hud.setTextPreview(`❌ Erro: ${err}`);
            }
            this.finishTaskAndAdvance(task);
            return;
          }

          const { audioBase64, mimeType } = response.data;
          const url = this.createBlobUrlFromBase64(audioBase64, mimeType || 'audio/wav');
          if (url) {
            task.chunkBlobs.set(chunkIdx, url);
            this.playObjectUrl(url, task, chunkIdx);
          } else {
            this.finishTaskAndAdvance(task);
          }
        }
      );
    } catch (err) {
      console.error('[TTS Controller] Erro ao despachar TTS_REQUEST:', err);
      hud.setStatus('idle', 'Erro');
      this.finishTaskAndAdvance(task);
    }
  }

  private createBlobUrlFromBase64(base64: string, mimeType: string): string | null {
    if (!base64 || typeof base64 !== 'string' || base64.length > MAX_BASE64_AUDIO_LENGTH) {
      return null;
    }
    try {
      const rawBytes = base64ToUint8Array(base64);
      if (rawBytes.length < 44) return null;
      const blob = new Blob([rawBytes as unknown as BlobPart], { type: mimeType });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('[TTS Controller] Falha ao criar Blob:', err);
      return null;
    }
  }

  private playObjectUrl(objectUrl: string, task: TtsQueueTask, chunkIdx: number): void {
    if (!this.audio || this.activeTask !== task) return;

    this.audio.src = objectUrl;
    this.audio.volume = this.volume;
    this.audio.playbackRate = this.playbackRate;

    // Auto-play garantido ao sintetizar
    this.audio.play()
      .then(() => {
        this.isPaused = false;
        hud.setPlayingState(true);
        const chunkNum = chunkIdx + 1;
        const total = task.chunks.length;
        hud.setStatus('playing', total > 1 ? `Lendo (${chunkNum}/${total})` : 'Lendo');
      })
      .catch((err) => {
        console.warn('[TTS Controller] Autoplay aguardando interação do usuário:', err);
        hud.setPlayingState(false);
        hud.setStatus('idle', 'Clique em Ouvir');
      });
  }

  private handleChunkEnded(): void {
    if (!this.activeTask) return;

    const task = this.activeTask;
    const nextIdx = task.currentChunkIndex + 1;

    if (nextIdx < task.chunks.length) {
      task.currentChunkIndex = nextIdx;
      this.fetchAndPlayChunk(task, nextIdx);
    } else {
      // Tarefa atual concluída
      hud.setStatus('idle', 'Concluído');
      hud.setPlayingState(false);
      this.isPaused = false;

      // Se houver mais tarefas na fila, avança
      if (this.queue.length > 1) {
        this.queue.shift(); // Remove a que acabou
        this.processNextInQueue();
      } else {
        // Deixa a tarefa na lista para permitir Replay ilimitado com o botão 'Ouvir'
        this.isProcessing = false;
      }
    }
  }

  private finishTaskAndAdvance(task: TtsQueueTask): void {
    if (this.activeTask === task) {
      const idx = this.queue.indexOf(task);
      if (idx !== -1) {
        this.queue.splice(idx, 1);
      }
      this.processNextInQueue();
    }
  }

  /**
   * Alterna entre Play/Pause ou executa Replay do início se já concluído.
   * Não realiza nova requisição à API ao repetir.
   */
  public togglePlayPause(): void {
    if (!this.audio) return;

    if (this.audio.src) {
      if (this.audio.ended || this.audio.currentTime >= (this.audio.duration - 0.1 || 0)) {
        // Replay desde o início
        this.audio.currentTime = 0;
        if (this.activeTask) {
          this.activeTask.currentChunkIndex = 0;
          const firstUrl = this.activeTask.chunkBlobs.get(0);
          if (firstUrl && this.audio.src !== firstUrl) {
            this.audio.src = firstUrl;
          }
        }
        this.audio.play()
          .then(() => {
            this.isPaused = false;
            hud.setPlayingState(true);
            hud.setStatus('playing', 'Lendo');
          })
          .catch(console.error);
        return;
      }

      if (this.audio.paused) {
        this.audio.play()
          .then(() => {
            this.isPaused = false;
            hud.setPlayingState(true);
            hud.setStatus('playing', 'Lendo');
          })
          .catch(console.error);
      } else {
        this.audio.pause();
        this.isPaused = true;
        hud.setPlayingState(false);
        hud.setStatus('idle', 'Pausado');
      }
      return;
    }

    if (this.queue.length > 0 && !this.isProcessing) {
      this.processNextInQueue();
    }
  }

  public playBase64Audio(base64: string, mimeType: string = 'audio/wav'): void {
    const url = this.createBlobUrlFromBase64(base64, mimeType);
    if (!url || !this.audio) return;

    this.audio.src = url;
    this.audio.volume = this.volume;
    this.audio.playbackRate = this.playbackRate;
    this.audio.play().then(() => {
      hud.setPlayingState(true);
      hud.setStatus('playing', 'Lendo');
    }).catch(console.error);
  }

  /**
   * Para a reprodução explicitamente e limpa a fila de tarefas.
   */
  public stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }

    // Revoga URLs Blob criadas para liberar memória
    for (const task of this.queue) {
      task.chunkBlobs.forEach((url) => URL.revokeObjectURL(url));
      task.chunkBlobs.clear();
    }

    this.queue = [];
    this.activeTask = null;
    this.isProcessing = false;
    this.isPaused = false;

    hud.setPlayingState(false);
    hud.setStatus('idle', 'Parado');

    try {
      chrome.runtime.sendMessage({ type: 'TTS_STOP' }).catch(() => {});
    } catch {}
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
