/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Player de áudio de alta precisão com suporte a controle de velocidade e volume.
 */

import { audioContextManager } from './audioContextManager';

export class AudioPlayer {
  private audioElement: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
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
    if (!this.audioElement) return;

    audioContextManager.getContext();

    const dataUri = `data:${mimeType};base64,${base64}`;
    this.audioElement.src = dataUri;
    this.audioElement.volume = Math.max(0, Math.min(1, volume));
    this.audioElement.playbackRate = Math.max(0.5, Math.min(2.0, speed));

    try {
      await this.audioElement.play();
    } catch (err) {
      console.warn('[AudioPlayer] Falha ao tocar áudio:', err);
      this.onPlayStateChange?.(false);
    }
  }

  public togglePlayPause(): void {
    if (!this.audioElement || !this.audioElement.src) return;
    if (this.audioElement.paused) {
      this.audioElement.play().catch(console.error);
    } else {
      this.audioElement.pause();
    }
  }

  public stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
    }
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
  }

  public setSpeed(speed: number): void {
    if (this.audioElement) {
      this.audioElement.playbackRate = Math.max(0.5, Math.min(2.0, speed));
    }
  }

  public isPlaying(): boolean {
    return Boolean(this.audioElement && !this.audioElement.paused);
  }
}

export const audioPlayer = new AudioPlayer();
