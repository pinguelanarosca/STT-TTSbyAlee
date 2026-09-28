/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Player de áudio de alta performance e baixo consumo de memória.
 * Utiliza Blob URLs com TypedArrays sem duplicação de buffers na main thread.
 */

import { base64ToUint8Array } from '@shared/utils/pcmWav';
import { audioContextManager } from './audioContextManager';

const MAX_BASE64_AUDIO_LENGTH = 15 * 1024 * 1024; // 15MB limite de segurança

export class AudioPlayer {
  private audioElement: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private isSourcePlaying = false;
  private currentVolume = 1.0;
  private currentSpeed = 1.0;

  public onEnded?: () => void;
  public onPlayStateChange?: (isPlaying: boolean) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.preload = 'auto';
      this.audioElement.addEventListener('ended', () => {
        this.onPlayStateChange?.(false);
        this.onEnded?.();
      });
      this.audioElement.addEventListener('pause', () => {
        // Se a mídia foi pausada e não está finalizada
        if (this.audioElement && this.audioElement.currentTime < this.audioElement.duration) {
          this.onPlayStateChange?.(false);
        }
      });
      this.audioElement.addEventListener('play', () => {
        this.onPlayStateChange?.(true);
      });
      this.audioElement.addEventListener('error', (e) => {
        console.warn('[AudioPlayer] Erro no elemento de áudio nativo:', e);
        this.onPlayStateChange?.(false);
      });
    }
  }

  /**
   * Reproduz um áudio codificado em Base64 com liberação imediata de memória de buffers anteriores.
   */
  public async playBase64(base64: string, mimeType: string = 'audio/wav', volume = 1.0, speed = 1.0): Promise<void> {
    this.stop();
    if (!base64 || typeof base64 !== 'string') return;

    if (base64.length > MAX_BASE64_AUDIO_LENGTH) {
      throw new Error(`Áudio recebido (${Math.round(base64.length / 1024 / 1024)}MB) excede o limite seguro de 15MB.`);
    }

    this.currentVolume = Math.max(0, Math.min(1, volume));
    this.currentSpeed = Math.max(0.5, Math.min(2.0, speed));

    const rawBytes = base64ToUint8Array(base64);

    // Tentativa 1: HTMLAudioElement com Blob URL (Zero Web Audio API overhead)
    if (this.audioElement) {
      try {
        // Constrói o Blob diretamente sobre Uint8Array sem clonar ArrayBuffer
        const blob = new Blob([rawBytes as unknown as BlobPart], { type: mimeType });
        this.currentObjectUrl = URL.createObjectURL(blob);

        this.audioElement.src = this.currentObjectUrl;
        this.audioElement.volume = this.currentVolume;
        this.audioElement.playbackRate = this.currentSpeed;

        await this.audioElement.play();
        this.onPlayStateChange?.(true);
        return;
      } catch (err) {
        console.warn('[AudioPlayer] HTMLAudioElement falhou, acionando fallback Web Audio API:', err);
      }
    }

    // Tentativa 2: Web Audio API (apenas se HTMLAudioElement falhar)
    try {
      const ctx = audioContextManager.getContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Cria cópia segura apenas se necessário para o decodeAudioData
      const arrayBuffer = rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength) as ArrayBuffer;
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();

      source.buffer = audioBuffer;
      source.playbackRate.value = this.currentSpeed;
      gainNode.gain.value = this.currentVolume;

      source.connect(gainNode);
      gainNode.connect(audioContextManager.getMasterGain());

      this.activeSource = source;
      this.isSourcePlaying = true;
      this.onPlayStateChange?.(true);

      source.onended = () => {
        this.isSourcePlaying = false;
        this.activeSource = null;
        this.onPlayStateChange?.(false);
        this.onEnded?.();
      };

      source.start(0);
    } catch (fallbackErr) {
      console.error('[AudioPlayer] Falha na reprodução de áudio:', fallbackErr);
      this.onPlayStateChange?.(false);
    }
  }

  public togglePlayPause(): void {
    if (this.audioElement && this.audioElement.src) {
      if (this.audioElement.paused) {
        this.audioElement.play().catch(console.error);
      } else {
        this.audioElement.pause();
      }
      return;
    }

    if (this.activeSource && this.isSourcePlaying) {
      this.stop();
    }
  }

  public stop(): void {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
      } catch {}
    }

    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {}
      this.activeSource = null;
    }
    this.isSourcePlaying = false;

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    this.onPlayStateChange?.(false);
  }

  public setVolume(vol: number): void {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.audioElement) {
      this.audioElement.volume = this.currentVolume;
    }
    audioContextManager.setMasterVolume(this.currentVolume);
  }

  public setSpeed(speed: number): void {
    this.currentSpeed = Math.max(0.5, Math.min(2.0, speed));
    if (this.audioElement) {
      this.audioElement.playbackRate = this.currentSpeed;
    }
  }

  public isPlaying(): boolean {
    return Boolean((this.audioElement && !this.audioElement.paused && !this.audioElement.ended) || this.isSourcePlaying);
  }
}

export const audioPlayer = new AudioPlayer();
