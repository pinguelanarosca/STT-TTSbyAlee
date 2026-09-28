/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Player de áudio de alta precisão com suporte a controle de velocidade e volume.
 * Utiliza Blob Object URLs para evitar travamento da main thread com data URIs.
 */

import { base64ToUint8Array } from '@shared/utils/pcmWav';
import { audioContextManager } from './audioContextManager';

export class AudioPlayer {
  private audioElement: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private isSourcePlaying = false;
  public onEnded?: () => void;
  public onPlayStateChange?: (isPlaying: boolean) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.addEventListener('ended', () => {
        this.onPlayStateChange?.(false);
        this.onEnded?.();
      });
      this.audioElement.addEventListener('pause', () => {
        this.onPlayStateChange?.(false);
      });
      this.audioElement.addEventListener('play', () => {
        this.onPlayStateChange?.(true);
      });
    }
  }

  public async playBase64(base64: string, mimeType: string = 'audio/wav', volume = 1.0, speed = 1.0): Promise<void> {
    this.stop();
    if (!base64) return;

    const rawBytes = base64ToUint8Array(base64);
    const arrayBuffer = rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength) as ArrayBuffer;

    // Tentativa 1: HTMLAudioElement com Blob URL
    if (this.audioElement) {
      try {
        const blob = new Blob([arrayBuffer], { type: mimeType });
        this.currentObjectUrl = URL.createObjectURL(blob);

        this.audioElement.src = this.currentObjectUrl;
        this.audioElement.volume = Math.max(0, Math.min(1, volume));
        this.audioElement.playbackRate = Math.max(0.5, Math.min(2.0, speed));

        await this.audioElement.play();
        this.onPlayStateChange?.(true);
        return;
      } catch (err) {
        console.warn('[AudioPlayer] HTMLAudioElement impedido, alternando para Web Audio API:', err);
      }
    }

    // Tentativa 2: Web Audio API Buffer Source direta
    try {
      const ctx = audioContextManager.getContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();

      source.buffer = audioBuffer;
      source.playbackRate.value = Math.max(0.5, Math.min(2.0, speed));
      gainNode.gain.value = Math.max(0, Math.min(1, volume));

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
      console.error('[AudioPlayer] Falha total na reprodução de áudio:', fallbackErr);
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
      this.audioElement.pause();
      this.audioElement.src = '';
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
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, vol));
    }
    audioContextManager.setMasterVolume(vol);
  }

  public setSpeed(speed: number): void {
    if (this.audioElement) {
      this.audioElement.playbackRate = Math.max(0.5, Math.min(2.0, speed));
    }
  }

  public isPlaying(): boolean {
    return Boolean((this.audioElement && !this.audioElement.paused) || this.isSourcePlaying);
  }
}

export const audioPlayer = new AudioPlayer();
